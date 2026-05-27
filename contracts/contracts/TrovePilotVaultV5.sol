// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * TrovePilotVaultV5
 * - Makes "Opportunity Liquidity" (USDC placeholder) withdrawable by treating it as MUSD-backed accounting.
 * - No simulated-price conversion is used for withdrawals.
 *
 * NOTE:
 * - The contract still holds real ERC-20 MUSD only.
 * - `usdcReserve` is a placeholder lane backed by MUSD, stored in MUSD units (18 decimals).
 * - Premium/discount rotations simply rebalance between lanes; they keep price-based estimates only for UI/timeline.
 */

interface IERC20V5 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ITroveManagerV5 {
    function getTroveColl(address borrower) external view returns (uint256);
    function getTroveDebt(address borrower) external view returns (uint256);
    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
}

interface ISortedTrovesV5 {
    function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) external view returns (address, address);
}

interface IHintHelpersV5 {
    function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed) external view returns (address, uint256, uint256);
    function computeNominalCR(uint256 _coll, uint256 _debt) external pure returns (uint256);
}

interface IBorrowerOperationsSignaturesV5 {
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

interface IBorrowerOperationsV5 {
    function borrowingRate() external view returns (uint256);
}

interface IMockMarketOracleV5 {
    function getBTCPrice() external view returns (uint256);
    function getMUSDPrice() external view returns (uint256);
}

contract TrovePilotVaultV5 {
    uint256 public constant TARGET_MUSD_BPS = 6000;
    uint256 public constant TARGET_USDC_BPS = 4000;
    uint256 internal constant ONE = 1e18;

    struct StrategyRulesV5 {
        uint256 targetICR; // 1e18
        uint256 bandLowerICR; // 1e18
        uint256 bandUpperICR; // 1e18
        uint256 premiumThreshold; // 1e18
        uint256 discountThreshold; // 1e18
        uint256 premiumSellBps; // 0..10_000 (max per run)
        uint256 discountBuyBps; // 0..10_000 (max per run)
        bool btcDownEnabled;
        bool btcUpEnabled;
        bool premiumEnabled;
        bool discountEnabled;
    }

    event ReserveDeposited(address indexed user, uint256 amount);
    event ReserveWithdrawn(address indexed user, uint256 amount);
    event ReserveAllocated(address indexed user, uint256 musdIn, uint256 musdKept, uint256 usdcAdded, uint256 musdPrice);
    event RulesUpdated(address indexed user);
    event SimulatedMarketUpdated(address indexed user, uint256 btcPrice, uint256 musdPrice);

    event BtcDownExecuted(address indexed user, uint256 btcPrice, uint256 icrBefore, uint256 icrAfter, uint256 repayAmount);
    event BtcUpExecuted(address indexed user, uint256 btcPrice, uint256 icrBefore, uint256 icrAfter, uint256 mintAmount);
    event PremiumRotated(address indexed user, uint256 musdPrice, uint256 sellMusd, uint256 estUsdcOut);
    event DiscountRotated(address indexed user, uint256 musdPrice, uint256 spendUsdc, uint256 estMusdOut);

    mapping(address => StrategyRulesV5) private rules;
    mapping(address => uint256) private musdReserve;
    // NOTE: "Opportunity Liquidity" placeholder backed by MUSD, stored in MUSD units (18d).
    mapping(address => uint256) private usdcReserve;

    mapping(address => uint256) private simulatedBtcPrice;
    mapping(address => uint256) private simulatedMusdPrice;

    address public immutable musdToken;
    address public immutable troveManager;
    address public immutable borrowerOperations;
    address public immutable hintHelpers;
    address public immutable sortedTroves;
    address public immutable borrowerOperationsSignatures;
    IMockMarketOracleV5 public immutable marketOracle;

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
        marketOracle = IMockMarketOracleV5(_marketOracle);

        IERC20V5(_musdToken).approve(_borrowerOperationsSignatures, type(uint256).max);
    }

    // ---------------------------
    // Reserve getters
    // ---------------------------

    function getMusdReserve(address user) external view returns (uint256) {
        return musdReserve[user];
    }

    function getUsdcReserve(address user) external view returns (uint256) {
        return usdcReserve[user];
    }

    // ---------------------------
    // Rules
    // ---------------------------

    function setRules(StrategyRulesV5 calldata r) external {
        require(r.premiumSellBps <= 10_000 && r.discountBuyBps <= 10_000, "BPS");
        require(r.bandLowerICR <= r.targetICR && r.targetICR <= r.bandUpperICR, "BAD_BAND");
        rules[msg.sender] = r;
        emit RulesUpdated(msg.sender);
    }

    function getRules(address user) external view returns (StrategyRulesV5 memory) {
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
    // Allocation (incoming MUSD)
    // ---------------------------

    function _allocateIncomingMusd(address user, uint256 musdIn) internal returns (uint256 musdKept, uint256 usdcAdded) {
        // Rebalance the TOTAL reserve state toward 60/40 after each inflow.
        // In V5, "USDC" is a placeholder lane backed by MUSD; both lanes are tracked in MUSD units.
        uint256 s = musdReserve[user];
        uint256 o = usdcReserve[user];
        uint256 newTotal = s + o + musdIn;
        uint256 targetS = (newTotal * TARGET_MUSD_BPS) / 10_000;

        if (s >= targetS) {
            musdKept = 0;
        } else {
            uint256 needS = targetS - s;
            musdKept = needS > musdIn ? musdIn : needS;
        }
        usdcAdded = musdIn - musdKept;
        musdReserve[user] = s + musdKept;
        usdcReserve[user] = o + usdcAdded;
    }

    // ---------------------------
    // Deposits/withdrawals (MUSD only)
    // ---------------------------

    function depositReserveMUSD(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20V5(musdToken).transferFrom(msg.sender, address(this), amount), "TRANSFER_FAIL");
        emit ReserveDeposited(msg.sender, amount);

        (uint256 musdKept, uint256 usdcAdded) = _allocateIncomingMusd(msg.sender, amount);
        emit ReserveAllocated(msg.sender, amount, musdKept, usdcAdded, _getMusdPrice(msg.sender));
    }

    // Withdraw real MUSD from either Stability or Opportunity lane (both MUSD-backed).
    function withdrawReserveMUSD(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");

        uint256 s = musdReserve[msg.sender];
        uint256 o = usdcReserve[msg.sender];
        require(s + o >= amount, "INSUFFICIENT");

        if (s >= amount) {
            musdReserve[msg.sender] = s - amount;
        } else {
            uint256 rem = amount - s;
            musdReserve[msg.sender] = 0;
            usdcReserve[msg.sender] = o - rem;
        }

        require(IERC20V5(musdToken).transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit ReserveWithdrawn(msg.sender, amount);
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
        StrategyRulesV5 memory r = rules[user];
        btcPrice = _getBtcPrice(user);
        bandLower = r.bandLowerICR;
        targetICR = r.targetICR;
        musdReserveBal = musdReserve[user];

        if (!r.btcDownEnabled || btcPrice == 0) return (false, 0, 0, btcPrice, bandLower, targetICR, musdReserveBal);

        ITroveManagerV5 tm = ITroveManagerV5(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);
        triggered = icr < r.bandLowerICR;
        if (!triggered) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 debt = tm.getTroveDebt(user);
        uint256 coll = tm.getTroveColl(user);
        if (coll == 0) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (debt <= targetDebt) return (false, 0, icr, btcPrice, bandLower, targetICR, musdReserveBal);

        uint256 desired = debt - targetDebt;
        repayAmount = desired;
        if (repayAmount > musdReserveBal) repayAmount = musdReserveBal;
    }

    function previewBtcUp(address user)
        external
        view
        returns (bool triggered, uint256 mintAmount, uint256 icr, uint256 btcPrice, uint256 bandUpper, uint256 targetICR)
    {
        StrategyRulesV5 memory r = rules[user];
        btcPrice = _getBtcPrice(user);
        bandUpper = r.bandUpperICR;
        targetICR = r.targetICR;

        if (!r.btcUpEnabled || btcPrice == 0) return (false, 0, 0, btcPrice, bandUpper, targetICR);

        ITroveManagerV5 tm = ITroveManagerV5(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);
        triggered = icr > r.bandUpperICR;
        if (!triggered) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 debt = tm.getTroveDebt(user);
        uint256 coll = tm.getTroveColl(user);
        if (coll == 0) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 targetDebt = (coll * btcPrice) / r.targetICR;
        if (targetDebt <= debt) return (false, 0, icr, btcPrice, bandUpper, targetICR);

        uint256 deltaComposite = targetDebt - debt;
        uint256 rate = IBorrowerOperationsV5(borrowerOperations).borrowingRate(); // 1e18
        mintAmount = (deltaComposite * ONE) / (ONE + rate);
    }

    function previewPremium(address user)
        external
        view
        returns (bool active, uint256 musdPrice, uint256 sellMusd, uint256 estUsdcOut, uint256 musdReserveBal, uint256 usdcReserveBal)
    {
        StrategyRulesV5 memory r = rules[user];
        musdPrice = _getMusdPrice(user);
        musdReserveBal = musdReserve[user];
        usdcReserveBal = usdcReserve[user];

        active = r.premiumEnabled && musdPrice > r.premiumThreshold;
        if (!active) return (false, musdPrice, 0, 0, musdReserveBal, usdcReserveBal);

        sellMusd = (musdReserveBal * r.premiumSellBps) / 10_000;
        estUsdcOut = (sellMusd * musdPrice) / ONE; // estimate only
    }

    function previewDiscount(address user)
        external
        view
        returns (bool active, uint256 musdPrice, uint256 spendUsdc, uint256 estMusdOut, uint256 musdReserveBal, uint256 usdcReserveBal)
    {
        StrategyRulesV5 memory r = rules[user];
        musdPrice = _getMusdPrice(user);
        musdReserveBal = musdReserve[user];
        usdcReserveBal = usdcReserve[user];

        active = r.discountEnabled && musdPrice > 0 && musdPrice < r.discountThreshold;
        if (!active) return (false, musdPrice, 0, 0, musdReserveBal, usdcReserveBal);

        spendUsdc = (usdcReserveBal * r.discountBuyBps) / 10_000; // placeholder lane in MUSD units
        estMusdOut = (spendUsdc * ONE) / musdPrice; // estimate only
    }

    // ---------------------------
    // Scenario runners (unchanged signatures)
    // ---------------------------

    function runBtcDown(bytes calldata signature, uint256 deadline) external {
        StrategyRulesV5 memory r = rules[msg.sender];
        require(r.btcDownEnabled, "DISABLED");

        uint256 btcPrice = _getBtcPrice(msg.sender);
        require(btcPrice > 0, "NO_PRICE");

        ITroveManagerV5 tm = ITroveManagerV5(troveManager);
        uint256 icrBefore = tm.getCurrentICR(msg.sender, btcPrice);
        if (icrBefore >= r.bandLowerICR) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 debt = tm.getTroveDebt(msg.sender);
        uint256 coll = tm.getTroveColl(msg.sender);
        if (coll == 0) {
            emit BtcDownExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

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

        IBorrowerOperationsSignaturesV5(borrowerOperationsSignatures).repayMUSDWithSignature(
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
        StrategyRulesV5 memory r = rules[msg.sender];
        require(r.btcUpEnabled, "DISABLED");

        uint256 btcPrice = _getBtcPrice(msg.sender);
        require(btcPrice > 0, "NO_PRICE");

        ITroveManagerV5 tm = ITroveManagerV5(troveManager);
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
        uint256 rate = IBorrowerOperationsV5(borrowerOperations).borrowingRate();
        uint256 mintAmount = (deltaComposite * ONE) / (ONE + rate);
        if (mintAmount == 0) {
            emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        require(signature.length > 0 && deadline > 0, "SIGNATURE_REQUIRED");

        (address upper, address lower) = _findMintHints(msg.sender, debt, mintAmount);
        IBorrowerOperationsSignaturesV5(borrowerOperationsSignatures).adjustTroveWithSignature(
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

        // Allocate minted inflow between lanes (amount-based).
        (uint256 musdKept, uint256 usdcAdded) = _allocateIncomingMusd(msg.sender, mintAmount);
        emit ReserveAllocated(msg.sender, mintAmount, musdKept, usdcAdded, _getMusdPrice(msg.sender));

        uint256 icrAfter = tm.getCurrentICR(msg.sender, btcPrice);
        emit BtcUpExecuted(msg.sender, btcPrice, icrBefore, icrAfter, mintAmount);
    }

    function runPremium() external {
        StrategyRulesV5 memory r = rules[msg.sender];
        require(r.premiumEnabled, "DISABLED");

        uint256 musdPrice = _getMusdPrice(msg.sender);
        require(musdPrice > r.premiumThreshold, "NOT_ACTIVE");

        uint256 s = musdReserve[msg.sender];
        uint256 sellMusd = (s * r.premiumSellBps) / 10_000;
        if (sellMusd == 0) {
            emit PremiumRotated(msg.sender, musdPrice, 0, 0);
            return;
        }
        musdReserve[msg.sender] = s - sellMusd;
        uint256 estUsdcOut = (sellMusd * musdPrice) / ONE;
        usdcReserve[msg.sender] = usdcReserve[msg.sender] + estUsdcOut;
        emit PremiumRotated(msg.sender, musdPrice, sellMusd, estUsdcOut);
    }

    function runDiscount() external {
        StrategyRulesV5 memory r = rules[msg.sender];
        require(r.discountEnabled, "DISABLED");

        uint256 musdPrice = _getMusdPrice(msg.sender);
        require(musdPrice > 0 && musdPrice < r.discountThreshold, "NOT_ACTIVE");

        uint256 u = usdcReserve[msg.sender];
        uint256 spendUsdc = (u * r.discountBuyBps) / 10_000;
        if (spendUsdc == 0) {
            emit DiscountRotated(msg.sender, musdPrice, 0, 0);
            return;
        }
        uint256 estMusdOut = (spendUsdc * ONE) / musdPrice;
        usdcReserve[msg.sender] = u - spendUsdc;
        musdReserve[msg.sender] = musdReserve[msg.sender] + estMusdOut;
        emit DiscountRotated(msg.sender, musdPrice, spendUsdc, estMusdOut);
    }

    // ---------------------------
    // Hint helpers
    // ---------------------------

    function _findRepayHints(address borrower, uint256 currentDebt, uint256 repayAmount) internal view returns (address upper, address lower) {
        uint256 newDebt = currentDebt - repayAmount;
        uint256 coll = ITroveManagerV5(troveManager).getTroveColl(borrower);
        uint256 nicr = IHintHelpersV5(hintHelpers).computeNominalCR(coll, newDebt);
        (address approxHint, , ) = IHintHelpersV5(hintHelpers).getApproxHint(nicr, 50, uint256(uint160(borrower)));
        (upper, lower) = ISortedTrovesV5(sortedTroves).findInsertPosition(nicr, approxHint, approxHint);
    }

    function _findMintHints(address borrower, uint256 currentDebt, uint256 mintAmount) internal view returns (address upper, address lower) {
        uint256 rate = IBorrowerOperationsV5(borrowerOperations).borrowingRate();
        uint256 fee = (mintAmount * rate) / ONE;
        uint256 newDebt = currentDebt + mintAmount + fee;
        uint256 coll = ITroveManagerV5(troveManager).getTroveColl(borrower);
        uint256 nicr = IHintHelpersV5(hintHelpers).computeNominalCR(coll, newDebt);
        (address approxHint, , ) = IHintHelpersV5(hintHelpers).getApproxHint(nicr, 50, uint256(uint160(borrower)));
        (upper, lower) = ISortedTrovesV5(sortedTroves).findInsertPosition(nicr, approxHint, approxHint);
    }
}
