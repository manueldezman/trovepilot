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
        uint256 safetyICR; // 1e18, e.g. 1.50e18
        uint256 repayBps; // 1000 = 10%
        uint256 premiumThreshold; // 1e18
        uint256 discountThreshold; // 1e18
        uint256 maxReserveUseBps; // cap on reserve usage per action
        uint256 safetyReserveBps; // must sum to 10_000 with opportunityReserveBps
        uint256 opportunityReserveBps;
        bool safetyEnabled;
        bool premiumEnabled;
        bool discountEnabled;
    }

    event ReserveDeposited(address indexed user, address indexed token, uint256 amount);
    event ReserveWithdrawn(address indexed user, address indexed token, uint256 amount);
    event RulesUpdated(address indexed user);
    event RiskStateEvaluated(address indexed user, uint256 icr, bool safetyTriggered);
    event SafetyRepayExecuted(address indexed user, uint256 repayAmount, uint256 icrBefore, uint256 icrAfter);
    event PremiumSimulated(address indexed user, uint256 musdPrice, uint256 notional, uint256 estGain);
    event DiscountSimulated(address indexed user, uint256 musdPrice, uint256 spend, uint256 musdAcquired, uint256 estSavings);
    event AutomationRan(
        address indexed user,
        uint256 btcPrice,
        uint256 musdPrice,
        uint256 icrBefore,
        uint256 icrAfter,
        uint256 safetyBefore,
        uint256 safetyAfter,
        uint256 oppBefore,
        uint256 oppAfter,
        uint256 mask
    );

    mapping(address => StrategyRules) private rules;
    mapping(address => uint256) private safetyReserve;
    mapping(address => uint256) private opportunityReserve;
    mapping(address => uint256) private opportunityMusdAcquired;

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

        // Allow the vault to spend its own MUSD balance when executing real repayments.
        require(IERC20(_musdToken).approve(_borrowerOperationsSignatures, type(uint256).max), "APPROVE_FAIL");
        // Some integrations route repayment via BorrowerOperations; approve it too for safety.
        require(IERC20(_musdToken).approve(_borrowerOperations, type(uint256).max), "APPROVE_FAIL");
    }

    function depositReserve(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(token == musdToken, "TOKEN_NOT_SUPPORTED");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TRANSFER_FROM_FAIL");
        StrategyRules memory r = rules[msg.sender];
        uint256 safetyBps = r.safetyReserveBps;
        uint256 oppBps = r.opportunityReserveBps;
        if (safetyBps == 0 && oppBps == 0) {
            safetyBps = 10_000;
            oppBps = 0;
        }
        require(safetyBps + oppBps == 10_000, "BAD_SPLIT");
        uint256 toSafety = (amount * safetyBps) / 10_000;
        uint256 toOpp = amount - toSafety;
        safetyReserve[msg.sender] += toSafety;
        opportunityReserve[msg.sender] += toOpp;
        emit ReserveDeposited(msg.sender, token, amount);
    }

    function withdrawReserve(address token, uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(token == musdToken, "TOKEN_NOT_SUPPORTED");
        uint256 total = safetyReserve[msg.sender] + opportunityReserve[msg.sender];
        require(total >= amount, "INSUFFICIENT");
        // Withdraw from opportunity first, then safety.
        uint256 opp = opportunityReserve[msg.sender];
        uint256 fromOpp = amount <= opp ? amount : opp;
        uint256 remaining = amount - fromOpp;
        if (fromOpp > 0) opportunityReserve[msg.sender] = opp - fromOpp;
        if (remaining > 0) safetyReserve[msg.sender] -= remaining;
        require(IERC20(token).transfer(msg.sender, amount), "TRANSFER_FAIL");
        emit ReserveWithdrawn(msg.sender, token, amount);
    }

    function getReserveBalance(address user, address token) external view returns (uint256) {
        if (token != musdToken) return 0;
        return safetyReserve[user] + opportunityReserve[user];
    }

    function getSafetyReserve(address user) external view returns (uint256) {
        return safetyReserve[user];
    }

    function getOpportunityReserve(address user) external view returns (uint256) {
        return opportunityReserve[user];
    }

    function getOpportunityMusdAcquired(address user) external view returns (uint256) {
        return opportunityMusdAcquired[user];
    }

    function setRules(StrategyRules calldata r) external {
        require(r.repayBps <= 10_000 && r.maxReserveUseBps <= 10_000, "BPS");
        require(r.safetyReserveBps + r.opportunityReserveBps == 10_000, "BAD_SPLIT");
        rules[msg.sender] = r;
        emit RulesUpdated(msg.sender);
    }

    function getRules(address user) external view returns (StrategyRules memory) {
        return rules[user];
    }

    function previewAutomation(address user)
        external
        view
        returns (
            bool needsSafetyRepay,
            uint256 repayAmount,
            uint256 icr,
            uint256 btcPrice,
            uint256 musdPrice,
            bool premiumActive,
            bool discountActive
        )
    {
        StrategyRules memory r = rules[user];

        btcPrice = marketOracle.getBTCPrice();
        musdPrice = marketOracle.getMUSDPrice();
        if (btcPrice == 0) return (false, 0, 0, btcPrice, musdPrice, false, false);

        ITroveManager tm = ITroveManager(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);

        needsSafetyRepay = r.safetyEnabled && icr < r.safetyICR;

        if (needsSafetyRepay) {
            uint256 debt = tm.getTroveDebt(user);
            if (debt == 0) return (false, 0, icr, btcPrice, musdPrice, false, false);
            uint256 reserve = safetyReserve[user];
            if (reserve == 0) return (true, 0, icr, btcPrice, musdPrice, false, false);

            uint256 targetRepay = (debt * r.repayBps) / 10_000;
            uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
            repayAmount = targetRepay;
            if (repayAmount > maxUse) repayAmount = maxUse;
            if (repayAmount > reserve) repayAmount = reserve;
        }

        // Peg rules depend only on simulated MUSD price, but are suppressed if safety triggers.
        if (!needsSafetyRepay) {
            premiumActive = r.premiumEnabled && musdPrice > r.premiumThreshold;
            discountActive = r.discountEnabled && musdPrice < r.discountThreshold;
        }
    }

    function runAutomation(bytes calldata signature, uint256 deadline) external {
        StrategyRules memory r = rules[msg.sender];

        uint256 btcPrice = marketOracle.getBTCPrice();
        uint256 musdPrice = marketOracle.getMUSDPrice();
        require(btcPrice > 0, "NO_PRICE");

        ITroveManager tm = ITroveManager(troveManager);
        uint256 icrBefore = tm.getCurrentICR(msg.sender, btcPrice);

        uint256 safetyBefore = safetyReserve[msg.sender];
        uint256 oppBefore = opportunityReserve[msg.sender];

        bool safetyTriggered = r.safetyEnabled && icrBefore < r.safetyICR;
        emit RiskStateEvaluated(msg.sender, icrBefore, safetyTriggered);

        uint256 mask = 0;

        if (safetyTriggered) {
            mask |= 1;
            uint256 debt = tm.getTroveDebt(msg.sender);
            uint256 reserve = safetyReserve[msg.sender];
            if (debt == 0 || reserve == 0) {
                emit AutomationRan(
                    msg.sender,
                    btcPrice,
                    musdPrice,
                    icrBefore,
                    icrBefore,
                    safetyBefore,
                    safetyReserve[msg.sender],
                    oppBefore,
                    opportunityReserve[msg.sender],
                    mask
                );
                return;
            }

            uint256 targetRepay = (debt * r.repayBps) / 10_000;
            uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
            uint256 repayAmount = targetRepay;
            if (repayAmount > maxUse) repayAmount = maxUse;
            if (repayAmount > reserve) repayAmount = reserve;
            if (repayAmount == 0) {
                emit AutomationRan(
                    msg.sender,
                    btcPrice,
                    musdPrice,
                    icrBefore,
                    icrBefore,
                    safetyBefore,
                    safetyReserve[msg.sender],
                    oppBefore,
                    opportunityReserve[msg.sender],
                    mask
                );
                return;
            }

            require(signature.length > 0 && deadline > 0, "SIGNATURE_REQUIRED");

            // Accounting first.
            safetyReserve[msg.sender] = reserve - repayAmount;

            (address upper, address lower) = _findRepayHints(msg.sender, debt, repayAmount);

            IBorrowerOperationsSignatures(borrowerOperationsSignatures).repayMUSDWithSignature(
                repayAmount,
                upper,
                lower,
                msg.sender,
                signature,
                deadline
            );

            uint256 icrAfter = tm.getCurrentICR(msg.sender, btcPrice);
            emit SafetyRepayExecuted(msg.sender, repayAmount, icrBefore, icrAfter);
            emit AutomationRan(
                msg.sender,
                btcPrice,
                musdPrice,
                icrBefore,
                icrAfter,
                safetyBefore,
                safetyReserve[msg.sender],
                oppBefore,
                opportunityReserve[msg.sender],
                mask
            );
            return;
        }

        // Peg actions (MUSD price only), executed only when safety is not triggered.
        uint256 icrAfterPeg = icrBefore;

        if (r.premiumEnabled && musdPrice > r.premiumThreshold) {
            mask |= 2;
            // Minimal simulation: "notional" is 10% of opportunity reserve; "gain" is (price-1) * notional.
            uint256 notional = (opportunityReserve[msg.sender] * 1000) / 10_000;
            uint256 gain = (notional * (musdPrice - 1e18)) / 1e18;
            emit PremiumSimulated(msg.sender, musdPrice, notional, gain);
        }

        if (r.discountEnabled && musdPrice < r.discountThreshold) {
            mask |= 4;
            uint256 spend = (opportunityReserve[msg.sender] * 1000) / 10_000;
            // Acquire more MUSD when price < 1: acquired = spend / price (scaled 1e18).
            uint256 acquired = (spend * 1e18) / musdPrice;
            opportunityMusdAcquired[msg.sender] += acquired;
            uint256 savings = acquired > spend ? acquired - spend : 0;
            emit DiscountSimulated(msg.sender, musdPrice, spend, acquired, savings);
        }

        emit AutomationRan(
            msg.sender,
            btcPrice,
            musdPrice,
            icrBefore,
            icrAfterPeg,
            safetyBefore,
            safetyReserve[msg.sender],
            oppBefore,
            opportunityReserve[msg.sender],
            mask
        );
    }

    function _findRepayHints(address borrower, uint256 currentDebt, uint256 repayAmount) internal view returns (address upper, address lower) {
        uint256 coll = ITroveManager(troveManager).getTroveColl(borrower);
        uint256 newDebt = currentDebt - repayAmount;
        uint256 newNICR = IHintHelpers(hintHelpers).computeNominalCR(coll, newDebt);

        uint256 seed = uint256(keccak256(abi.encodePacked(block.prevrandao, borrower, repayAmount)));
        (address approxHint, , ) = IHintHelpers(hintHelpers).getApproxHint(newNICR, 15, seed);
        (upper, lower) = ISortedTroves(sortedTroves).findInsertPosition(newNICR, approxHint, approxHint);
    }

    // Legacy entrypoints removed in favor of runAutomation.
}
