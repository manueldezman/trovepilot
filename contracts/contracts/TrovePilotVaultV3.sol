// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20V3 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ITroveManagerV3 {
    function getTroveColl(address borrower) external view returns (uint256);
    function getTroveDebt(address borrower) external view returns (uint256);
    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
    function getTroveStatus(address borrower) external view returns (uint256);
}

interface ISortedTrovesV3 {
    function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) external view returns (address, address);
}

interface IHintHelpersV3 {
    function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed) external view returns (address, uint256, uint256);
    function computeNominalCR(uint256 _coll, uint256 _debt) external pure returns (uint256);
}

interface IBorrowerOperationsSignaturesV3 {
    function getNonce(address user) external view returns (uint256);

    function repayMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        bytes memory _signature,
        uint256 _deadline
    ) external;

    function adjustTroveWithSignature(
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory _signature,
        uint256 _deadline
    ) external;
}

interface IBorrowerOperationsV3 {
    function borrowingRate() external view returns (uint256);
}

interface IMockMarketOracleV3 {
    function getBTCPrice() external view returns (uint256);
    function getMUSDPrice() external view returns (uint256);
}

contract TrovePilotVaultV3 {
    struct StrategyRulesV3 {
        uint256 targetICR; // 1e18
        uint256 bandLowerICR; // 1e18
        uint256 bandUpperICR; // 1e18
        uint256 premiumThreshold; // 1e18
        uint256 discountThreshold; // 1e18
        uint256 premiumSellBps; // 0..10_000
        uint256 discountBuyBps; // 0..10_000
        bool btcDownEnabled;
        bool btcUpEnabled;
        bool premiumEnabled;
        bool discountEnabled;
    }

    event ReserveDeposited(address indexed user, uint256 amount);
    event ReserveWithdrawn(address indexed user, uint256 amount);
    event RulesUpdated(address indexed user);

    event SimulatedMarketUpdated(address indexed user, uint256 btcPrice, uint256 musdPrice);

    event BtcDownExecuted(address indexed user, uint256 btcPrice, uint256 icrBefore, uint256 icrAfter, uint256 repayAmount);
    event BtcUpExecuted(address indexed user, uint256 btcPrice, uint256 icrBefore, uint256 icrAfter, uint256 mintAmount);
    event PremiumRotated(address indexed user, uint256 musdPrice, uint256 sellMusd, uint256 estUsdcOut);
    event DiscountRotated(address indexed user, uint256 musdPrice, uint256 spendUsdc, uint256 estMusdOut);

    mapping(address => StrategyRulesV3) private rules;
    mapping(address => uint256) private musdReserve;
    mapping(address => uint256) private usdcReserve;

    mapping(address => uint256) private simulatedBtcPrice;
    mapping(address => uint256) private simulatedMusdPrice;

    address public immutable musdToken;
    address public immutable troveManager;
    address public immutable borrowerOperations;
    address public immutable hintHelpers;
    address public immutable sortedTroves;
    address public immutable borrowerOperationsSignatures;
    IMockMarketOracleV3 public immutable marketOracle;

    constructor(
        address _musdToken,
        address _troveManager,
        address _borrowerOperations,
        address _borrowerOperationsSignatures,
        address _hintHelpers,
        address _sortedTroves,
        address _marketOracle
    ) {
        require(
            _musdToken != address(0) &&
                _troveManager != address(0) &&
                _borrowerOperations != address(0) &&
                _borrowerOperationsSignatures != address(0) &&
                _hintHelpers != address(0) &&
                _sortedTroves != address(0) &&
                _marketOracle != address(0),
            "BAD_ADDR"
        );
        musdToken = _musdToken;
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        borrowerOperationsSignatures = _borrowerOperationsSignatures;
        hintHelpers = _hintHelpers;
        sortedTroves = _sortedTroves;
        marketOracle = IMockMarketOracleV3(_marketOracle);

        // Allow signature contract to pull MUSD from the vault for repayments.
        IERC20V3(_musdToken).approve(_borrowerOperationsSignatures, type(uint256).max);
    }

    // ---------------------------
    // Reserve (MUSD real, USDC simulated)
    // ---------------------------

    function depositReserveMUSD(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20V3(musdToken).transferFrom(msg.sender, address(this), amount), "TRANSFER_FAIL");
        musdReserve[msg.sender] += amount;
        emit ReserveDeposited(msg.sender, amount);
    }

    function withdrawReserveMUSD(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        uint256 r = musdReserve[msg.sender];
        require(r >= amount, "INSUFFICIENT");
        musdReserve[msg.sender] = r - amount;
        require(IERC20V3(musdToken).transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit ReserveWithdrawn(msg.sender, amount);
    }

    function getMusdReserve(address user) external view returns (uint256) {
        return musdReserve[user];
    }

    function getUsdcReserve(address user) external view returns (uint256) {
        return usdcReserve[user];
    }

    // ---------------------------
    // Rules
    // ---------------------------

    function setRules(StrategyRulesV3 calldata r) external {
        require(r.premiumSellBps <= 10_000 && r.discountBuyBps <= 10_000, "BPS");
        require(r.bandLowerICR <= r.targetICR && r.targetICR <= r.bandUpperICR, "BAD_BAND");
        rules[msg.sender] = r;
        emit RulesUpdated(msg.sender);
    }

    function getRules(address user) external view returns (StrategyRulesV3 memory) {
        return rules[user];
    }

    // ---------------------------
    // Per-user simulated market state
    // ---------------------------

    function setSimulatedBTCPrice(uint256 price) external {
        simulatedBtcPrice[msg.sender] = price;
        emit SimulatedMarketUpdated(msg.sender, price, _getMusdPrice(msg.sender));
    }

    function setSimulatedMUSDPrice(uint256 price) external {
        simulatedMusdPrice[msg.sender] = price;
        emit SimulatedMarketUpdated(msg.sender, _getBtcPrice(msg.sender), price);
    }

    function resetSimulatedMarket() external {
        simulatedBtcPrice[msg.sender] = 0;
        simulatedMusdPrice[msg.sender] = 0;
        emit SimulatedMarketUpdated(msg.sender, _getBtcPrice(msg.sender), _getMusdPrice(msg.sender));
    }

    function getSimulatedBTCPrice(address user) external view returns (uint256) {
        return simulatedBtcPrice[user];
    }

    function getSimulatedMUSDPrice(address user) external view returns (uint256) {
        return simulatedMusdPrice[user];
    }

    function _getBtcPrice(address user) internal view returns (uint256) {
        uint256 v = simulatedBtcPrice[user];
        return v == 0 ? marketOracle.getBTCPrice() : v;
    }

    function _getMusdPrice(address user) internal view returns (uint256) {
        uint256 v = simulatedMusdPrice[user];
        return v == 0 ? marketOracle.getMUSDPrice() : v;
    }

    // ---------------------------
    // Previews
    // ---------------------------

    function previewBtcDown(address user)
        external
        view
        returns (
            bool triggered,
            uint256 repayAmount,
            uint256 icr,
            uint256 btcPrice,
            uint256 bandLower,
            uint256 targetICR,
            uint256 musdReserveBal
        )
    {
        StrategyRulesV3 memory r = rules[user];
        btcPrice = _getBtcPrice(user);
        bandLower = r.bandLowerICR;
        targetICR = r.targetICR;
        musdReserveBal = musdReserve[user];

        if (!r.btcDownEnabled || btcPrice == 0) return (false, 0, 0, btcPrice, bandLower, targetICR, musdReserveBal);

        ITroveManagerV3 tm = ITroveManagerV3(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);
        triggered = icr < r.bandLowerICR;
        if (!triggered) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 debt = tm.getTroveDebt(user);
        if (debt == 0) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 coll = tm.getTroveColl(user);
        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (debt <= targetDebt) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 desired = debt - targetDebt;
        repayAmount = desired;
        if (repayAmount > musdReserveBal) repayAmount = musdReserveBal;
    }

    function previewBtcUp(address user)
        external
        view
        returns (
            bool triggered,
            uint256 mintAmount,
            uint256 icr,
            uint256 btcPrice,
            uint256 bandUpper,
            uint256 targetICR
        )
    {
        StrategyRulesV3 memory r = rules[user];
        btcPrice = _getBtcPrice(user);
        bandUpper = r.bandUpperICR;
        targetICR = r.targetICR;

        if (!r.btcUpEnabled || btcPrice == 0) return (false, 0, 0, btcPrice, bandUpper, targetICR);

        ITroveManagerV3 tm = ITroveManagerV3(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);
        triggered = icr > r.bandUpperICR;
        if (!triggered) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 debt = tm.getTroveDebt(user);
        uint256 coll = tm.getTroveColl(user);
        if (coll == 0) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (targetDebt <= debt) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 deltaComposite = targetDebt - debt;
        uint256 rate = IBorrowerOperationsV3(borrowerOperations).borrowingRate(); // 1e18
        mintAmount = (deltaComposite * 1e18) / (1e18 + rate);
    }

    function previewPremium(address user)
        external
        view
        returns (
            bool active,
            uint256 musdPrice,
            uint256 sellMusd,
            uint256 estUsdcOut,
            uint256 musdReserveBal,
            uint256 usdcReserveBal
        )
    {
        StrategyRulesV3 memory r = rules[user];
        musdPrice = _getMusdPrice(user);
        musdReserveBal = musdReserve[user];
        usdcReserveBal = usdcReserve[user];

        active = r.premiumEnabled && musdPrice > r.premiumThreshold;
        if (!active) return (false, musdPrice, 0, 0, musdReserveBal, usdcReserveBal);
        sellMusd = (musdReserveBal * r.premiumSellBps) / 10_000;
        estUsdcOut = (sellMusd * musdPrice) / 1e18;
    }

    function previewDiscount(address user)
        external
        view
        returns (
            bool active,
            uint256 musdPrice,
            uint256 spendUsdc,
            uint256 estMusdOut,
            uint256 musdReserveBal,
            uint256 usdcReserveBal
        )
    {
        StrategyRulesV3 memory r = rules[user];
        musdPrice = _getMusdPrice(user);
        musdReserveBal = musdReserve[user];
        usdcReserveBal = usdcReserve[user];

        active = r.discountEnabled && musdPrice < r.discountThreshold && musdPrice > 0;
        if (!active) return (false, musdPrice, 0, 0, musdReserveBal, usdcReserveBal);
        spendUsdc = (usdcReserveBal * r.discountBuyBps) / 10_000;
        estMusdOut = (spendUsdc * 1e18) / musdPrice;
    }

    // ---------------------------
    // Runners (scenario-only)
    // ---------------------------

    function runBtcDown(bytes calldata signature, uint256 deadline) external {
        StrategyRulesV3 memory r = rules[msg.sender];
        require(r.btcDownEnabled, "DISABLED");

        uint256 btcPrice = _getBtcPrice(msg.sender);
        require(btcPrice > 0, "NO_PRICE");

        ITroveManagerV3 tm = ITroveManagerV3(troveManager);
        uint256 icrBefore = tm.getCurrentICR(msg.sender, btcPrice);
        if (icrBefore >= r.bandLowerICR) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 debt = tm.getTroveDebt(msg.sender);
        if (debt == 0) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 coll = tm.getTroveColl(msg.sender);
        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (debt <= targetDebt) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 desired = debt - targetDebt;
        uint256 reserve = musdReserve[msg.sender];
        uint256 repayAmount = desired;
        if (repayAmount > reserve) repayAmount = reserve;
        if (repayAmount == 0) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        require(signature.length > 0 && deadline > 0, "SIGNATURE_REQUIRED");

        musdReserve[msg.sender] = reserve - repayAmount;
        (address upper, address lower) = _findRepayHints(msg.sender, debt, repayAmount);

        IBorrowerOperationsSignaturesV3(borrowerOperationsSignatures).repayMUSDWithSignature(
            repayAmount,
            upper,
            lower,
            msg.sender,
            signature,
            deadline
        );

        uint256 icrAfter = tm.getCurrentICR(msg.sender, btcPrice);
        emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrAfter, repayAmount);
    }

    function runBtcUp(bytes calldata signature, uint256 deadline) external {
        StrategyRulesV3 memory r = rules[msg.sender];
        require(r.btcUpEnabled, "DISABLED");

        uint256 btcPrice = _getBtcPrice(msg.sender);
        require(btcPrice > 0, "NO_PRICE");

        ITroveManagerV3 tm = ITroveManagerV3(troveManager);
        uint256 icrBefore = tm.getCurrentICR(msg.sender, btcPrice);
        if (icrBefore <= r.bandUpperICR) {
            emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 debt = tm.getTroveDebt(msg.sender);
        uint256 coll = tm.getTroveColl(msg.sender);
        if (coll == 0) {
            emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (targetDebt <= debt) {
            emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 deltaComposite = targetDebt - debt;
        uint256 rate = IBorrowerOperationsV3(borrowerOperations).borrowingRate();
        uint256 mintAmount = (deltaComposite * 1e18) / (1e18 + rate);
        if (mintAmount == 0) {
            emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        require(signature.length > 0 && deadline > 0, "SIGNATURE_REQUIRED");

        // Increase debt; minted MUSD goes to the vault (recipient).
        (address upper, address lower) = _findMintHints(msg.sender, debt, mintAmount);
        IBorrowerOperationsSignaturesV3(borrowerOperationsSignatures).adjustTroveWithSignature(
            0,
            mintAmount,
            true,
            upper,
            lower,
            msg.sender,
            address(this),
            signature,
            deadline
        );

        // Credit minted MUSD to the user's reserve accounting.
        musdReserve[msg.sender] += mintAmount;

        uint256 icrAfter = tm.getCurrentICR(msg.sender, btcPrice);
        emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrAfter, mintAmount);
    }

    function runPremium() external {
        StrategyRulesV3 memory r = rules[msg.sender];
        require(r.premiumEnabled, "DISABLED");

        uint256 musdPrice = _getMusdPrice(msg.sender);
        require(musdPrice > r.premiumThreshold, "NOT_ACTIVE");

        uint256 reserve = musdReserve[msg.sender];
        uint256 sellMusd = (reserve * r.premiumSellBps) / 10_000;
        require(sellMusd > 0, "ZERO");

        uint256 usdcOut = (sellMusd * musdPrice) / 1e18;
        musdReserve[msg.sender] = reserve - sellMusd;
        usdcReserve[msg.sender] += usdcOut;
        emit PremiumRotated(msg.sender, musdPrice, sellMusd, usdcOut);
    }

    function runDiscount() external {
        StrategyRulesV3 memory r = rules[msg.sender];
        require(r.discountEnabled, "DISABLED");

        uint256 musdPrice = _getMusdPrice(msg.sender);
        require(musdPrice > 0 && musdPrice < r.discountThreshold, "NOT_ACTIVE");

        uint256 reserve = usdcReserve[msg.sender];
        uint256 spendUsdc = (reserve * r.discountBuyBps) / 10_000;
        require(spendUsdc > 0, "ZERO");

        uint256 musdOut = (spendUsdc * 1e18) / musdPrice;
        usdcReserve[msg.sender] = reserve - spendUsdc;
        musdReserve[msg.sender] += musdOut;
        emit DiscountRotated(msg.sender, musdPrice, spendUsdc, musdOut);
    }

    // ---------------------------
    // Hint helpers (same MVP approach as before)
    // ---------------------------

    function _findRepayHints(address borrower, uint256 currentDebt, uint256 repayAmount) internal view returns (address upper, address lower) {
        uint256 coll = ITroveManagerV3(troveManager).getTroveColl(borrower);
        uint256 newDebt = currentDebt - repayAmount;
        uint256 nicr = IHintHelpersV3(hintHelpers).computeNominalCR(coll, newDebt);
        (address approx, , ) = IHintHelpersV3(hintHelpers).getApproxHint(nicr, 15, 42);
        (upper, lower) = ISortedTrovesV3(sortedTroves).findInsertPosition(nicr, approx, approx);
    }

    function _findMintHints(address borrower, uint256 currentDebt, uint256 mintAmount) internal view returns (address upper, address lower) {
        uint256 coll = ITroveManagerV3(troveManager).getTroveColl(borrower);
        uint256 newDebt = currentDebt + mintAmount;
        uint256 nicr = IHintHelpersV3(hintHelpers).computeNominalCR(coll, newDebt);
        (address approx, , ) = IHintHelpersV3(hintHelpers).getApproxHint(nicr, 15, 42);
        (upper, lower) = ISortedTrovesV3(sortedTroves).findInsertPosition(nicr, approx, approx);
    }
}

