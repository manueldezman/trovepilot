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
    IMockMarketOracle public immutable marketOracle;

    constructor(
        address _musdToken,
        address _troveManager,
        address _borrowerOperations,
        address _hintHelpers,
        address _marketOracle
    ) {
        require(_musdToken != address(0) && _troveManager != address(0) && _borrowerOperations != address(0) && _marketOracle != address(0), "BAD_ADDR");
        musdToken = _musdToken;
        troveManager = _troveManager;
        borrowerOperations = _borrowerOperations;
        hintHelpers = _hintHelpers;
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

    function executeCollateralDefense() external {
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
        uint256 repayAmount = targetRepay;
        if (repayAmount > maxUse) repayAmount = maxUse;
        if (repayAmount > reserve) repayAmount = reserve;
        require(repayAmount > 0, "ZERO_REPAY");

        // Reserve accounting first.
        reserves[msg.sender][musdToken] = reserve - repayAmount;

        // Approve BorrowerOperations to pull MUSD from this vault.
        require(IERC20(musdToken).approve(borrowerOperations, repayAmount), "APPROVE_FAIL");

        // NOTE: Real Mezo repay call is wired after ABI inspection.
        // For now, we only emit the execution event with an unchanged ICR.
        // Implementation will replace this with a BorrowerOperations repay/adjust call.
        uint256 newICR = oldICR;
        emit CollateralDefenseExecuted(msg.sender, repayAmount, oldICR, newICR);
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
