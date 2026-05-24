// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ITroveManager {
    function getTroveColl(address borrower) external view returns (uint256);
    function getTroveDebt(address borrower) external view returns (uint256);
    function getCurrentICR(address borrower, uint256 price) external view returns (uint256);
    function getTroveStatus(address borrower) external view returns (uint256);
}

interface ISortedTroves {
    function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) external view returns (address, address);
}

interface IHintHelpers {
    function getApproxHint(uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed) external view returns (address, uint256, uint256);
    function computeNominalCR(uint256 _coll, uint256 _debt) external pure returns (uint256);
}

interface IBorrowerOperationsSignatures {
    function getNonce(address user) external view returns (uint256);
    function repayMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        bytes memory _signature,
        uint256 _deadline
    ) external;
}

interface IMockMarketOracle {
    function getBTCPrice() external view returns (uint256);
    function getMUSDPrice() external view returns (uint256);
}

contract TrovePilotVault {
    struct StrategyRules {
        uint256 minICR; // 1e18, e.g. 1.40e18
        uint256 repayBps; // 1000 = 10%
        uint256 premiumThreshold; // 1e18
        uint256 discountThreshold; // 1e18
        uint256 maxReserveUseBps; // cap on reserve usage per action
        bool collateralDefenseEnabled;
        bool premiumModeEnabled;
        bool discountModeEnabled;
    }

    event ReserveDeposited(address indexed user, address indexed token, uint256 amount);
    event ReserveWithdrawn(address indexed user, address indexed token, uint256 amount);
    event RulesUpdated(address indexed user);
    event CollateralDefenseExecuted(address indexed user, uint256 repayAmount, uint256 oldICR, uint256 newICR);
    event PremiumResponseExecuted(address indexed user, uint256 musdPrice, uint256 amount);
    event DiscountResponseExecuted(address indexed user, uint256 musdPrice, uint256 amount);

    mapping(address => mapping(address => uint256)) private reserves;
    mapping(address => StrategyRules) private rules;

    address public immutable musdToken;
    address public immutable troveManager;
    address public immutable borrowerOperations;
    address public immutable hintHelpers;
    address public immutable sortedTroves;
    address public immutable borrowerOperationsSignatures;
    IMockMarketOracle public immutable marketOracle;

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
        marketOracle = IMockMarketOracle(_marketOracle);
    }

    function depositReserve(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAIL");
        reserves[msg.sender][token] += amount;
        emit ReserveDeposited(msg.sender, token, amount);
    }

    function withdrawReserve(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        uint256 bal = reserves[msg.sender][token];
        require(bal >= amount, "INSUFFICIENT");
        reserves[msg.sender][token] = bal - amount;
        require(IERC20(token).transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit ReserveWithdrawn(msg.sender, token, amount);
    }

    function getReserveBalance(address user, address token) external view returns (uint256) {
        return reserves[user][token];
    }

    function setRules(StrategyRules calldata r) external {
        require(r.repayBps <= 10_000 && r.maxReserveUseBps <= 10_000, "BPS");
        rules[msg.sender] = r;
        emit RulesUpdated(msg.sender);
    }

    function getRules(address user) external view returns (StrategyRules memory) {
        return rules[user];
    }

    function previewCollateralDefense(address user) external view returns (uint256 repayAmount, uint256 oldICR, uint256 newNICR) {
        StrategyRules memory r = rules[user];
        if (!r.collateralDefenseEnabled) return (0, 0, 0);

        uint256 btcPrice = marketOracle.getBTCPrice();
        if (btcPrice == 0) return (0, 0, 0);

        ITroveManager tm = ITroveManager(troveManager);
        oldICR = tm.getCurrentICR(user, btcPrice);
        if (oldICR >= r.minICR) return (0, oldICR, 0);

        uint256 debt = tm.getTroveDebt(user);
        if (debt == 0) return (0, oldICR, 0);

        uint256 reserve = reserves[user][musdToken];
        if (reserve == 0) return (0, oldICR, 0);

        uint256 targetRepay = (debt * r.repayBps) / 10_000;
        uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
        repayAmount = targetRepay;
        if (repayAmount > maxUse) repayAmount = maxUse;
        if (repayAmount > reserve) repayAmount = reserve;

        if (repayAmount == 0) return (0, oldICR, 0);

        uint256 coll = tm.getTroveColl(user);
        uint256 newDebt = debt - repayAmount;
        if (newDebt == 0) return (0, oldICR, 0);

        newNICR = IHintHelpers(hintHelpers).computeNominalCR(coll, newDebt);
    }

    function executeCollateralDefense(uint256 amount, bytes calldata signature, uint256 deadline) external {
        StrategyRules memory r = rules[msg.sender];
        require(r.collateralDefenseEnabled, "DISABLED");

        uint256 btcPrice = marketOracle.getBTCPrice();
        require(btcPrice > 0, "NO_PRICE");

        ITroveManager tm = ITroveManager(troveManager);
        uint256 oldICR = tm.getCurrentICR(msg.sender, btcPrice);
        require(oldICR < r.minICR, "NOT_NEEDED");

        uint256 debt = tm.getTroveDebt(msg.sender);
        require(debt > 0, "NO_DEBT");

        uint256 reserve = reserves[msg.sender][musdToken];
        require(reserve > 0, "NO_RESERVE");

        uint256 targetRepay = (debt * r.repayBps) / 10_000;
        uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
        uint256 cap = targetRepay;
        if (cap > maxUse) cap = maxUse;
        if (cap > reserve) cap = reserve;
        require(amount > 0 && amount <= cap, "BAD_AMOUNT");

        // Reserve accounting first.
        reserves[msg.sender][musdToken] = reserve - amount;

        (address upper, address lower) = _findRepayHints(msg.sender, debt, amount);

        // Real Mezo repayment using BorrowerOperationsSignatures. The user signs an authorization for `amount`,
        // and this vault pays from its own MUSD balance (as the `_caller`).
        IBorrowerOperationsSignatures(borrowerOperationsSignatures).repayMUSDWithSignature(
            amount,
            upper,
            lower,
            msg.sender,
            signature,
            deadline
        );

        uint256 newICR = tm.getCurrentICR(msg.sender, btcPrice);
        emit CollateralDefenseExecuted(msg.sender, amount, oldICR, newICR);
    }

    function _findRepayHints(address borrower, uint256 currentDebt, uint256 repayAmount) internal view returns (address upper, address lower) {
        uint256 coll = ITroveManager(troveManager).getTroveColl(borrower);
        uint256 newDebt = currentDebt - repayAmount;
        uint256 newNICR = IHintHelpers(hintHelpers).computeNominalCR(coll, newDebt);

        uint256 seed = uint256(keccak256(abi.encodePacked(block.prevrandao, borrower, repayAmount)));
        (address approxHint, , ) = IHintHelpers(hintHelpers).getApproxHint(newNICR, 15, seed);
        (upper, lower) = ISortedTroves(sortedTroves).findInsertPosition(newNICR, approxHint, approxHint);
    }

    function executePremiumResponse() external {
        StrategyRules memory r = rules[msg.sender];
        require(r.premiumModeEnabled, "DISABLED");
        uint256 price = marketOracle.getMUSDPrice();
        require(price > r.premiumThreshold, "NO_PREMIUM");
        emit PremiumResponseExecuted(msg.sender, price, 0);
    }

    function executeDiscountResponse() external {
        StrategyRules memory r = rules[msg.sender];
        require(r.discountModeEnabled, "DISABLED");
        uint256 price = marketOracle.getMUSDPrice();
        require(price < r.discountThreshold, "NO_DISCOUNT");
        emit DiscountResponseExecuted(msg.sender, price, 0);
    }
}
