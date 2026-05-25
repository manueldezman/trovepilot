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
    event SafetyRan(address indexed user, uint256 btcPrice, uint256 icrBefore, uint256 icrAfter, uint256 repayAmount);
    event PegRan(address indexed user, uint256 musdPrice, bool premiumActive, bool discountActive);
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
    event SimulatedMarketUpdated(address indexed user, uint256 btcPrice, uint256 musdPrice);

    mapping(address => StrategyRules) private rules;
    mapping(address => uint256) private safetyReserve;
    mapping(address => uint256) private opportunityReserve;
    mapping(address => uint256) private opportunityMusdAcquired;
    mapping(address => uint256) private simulatedBtcPrice;
    mapping(address => uint256) private simulatedMusdPrice;

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

    // Anyone can set their own simulated market state. These values are used by previewAutomation/runAutomation
    // instead of the global oracle feed when non-zero.
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
        require(r.maxReserveUseBps <= 10_000, "BPS");
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

        btcPrice = _getBtcPrice(user);
        musdPrice = _getMusdPrice(user);
        if (btcPrice == 0) return (false, 0, 0, btcPrice, musdPrice, false, false);

        ITroveManager tm = ITroveManager(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);

        needsSafetyRepay = r.safetyEnabled && icr < r.safetyICR;

        if (needsSafetyRepay) {
            uint256 debt = tm.getTroveDebt(user);
            if (debt == 0) return (false, 0, icr, btcPrice, musdPrice, false, false);
            uint256 reserve = safetyReserve[user];
            if (reserve == 0) return (true, 0, icr, btcPrice, musdPrice, false, false);

            uint256 coll = tm.getTroveColl(user);
            // debtTarget = coll * price / safetyICR
            uint256 targetDebt = (coll * btcPrice) / r.safetyICR;
            if (debt <= targetDebt) return (false, 0, icr, btcPrice, musdPrice, false, false);
            uint256 targetRepay = debt - targetDebt;
            uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
            repayAmount = targetRepay;
            if (repayAmount > maxUse) repayAmount = maxUse;
            if (repayAmount > reserve) repayAmount = reserve;
        }

        // Peg rules depend only on simulated MUSD price. Safety does not suppress peg previews.
        premiumActive = r.premiumEnabled && musdPrice > r.premiumThreshold;
        discountActive = r.discountEnabled && musdPrice < r.discountThreshold;
    }

    function previewSafety(address user)
        external
        view
        returns (
            bool triggered,
            uint256 repayAmount,
            uint256 icr,
            uint256 btcPrice,
            uint256 safetyICR,
            uint256 safetyReserveBalance
        )
    {
        StrategyRules memory r = rules[user];
        safetyICR = r.safetyICR;
        safetyReserveBalance = safetyReserve[user];

        btcPrice = _getBtcPrice(user);
        if (btcPrice == 0) return (false, 0, 0, 0, safetyICR, safetyReserveBalance);

        ITroveManager tm = ITroveManager(troveManager);
        icr = tm.getCurrentICR(user, btcPrice);
        triggered = r.safetyEnabled && icr < r.safetyICR;
        if (!triggered) return (false, 0, icr, btcPrice, safetyICR, safetyReserveBalance);

        uint256 debt = tm.getTroveDebt(user);
        if (debt == 0) return (false, 0, icr, btcPrice, safetyICR, safetyReserveBalance);
        uint256 reserve = safetyReserveBalance;
        if (reserve == 0) return (true, 0, icr, btcPrice, safetyICR, safetyReserveBalance);

        uint256 coll = tm.getTroveColl(user);
        uint256 targetDebt = (coll * btcPrice) / r.safetyICR;
        if (debt <= targetDebt) return (false, 0, icr, btcPrice, safetyICR, safetyReserveBalance);
        uint256 targetRepay = debt - targetDebt;
        uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
        repayAmount = targetRepay;
        if (repayAmount > maxUse) repayAmount = maxUse;
        if (repayAmount > reserve) repayAmount = reserve;
    }

    function previewPeg(address user)
        external
        view
        returns (
            uint256 musdPrice,
            bool premiumActive,
            bool discountActive,
            uint256 premiumThreshold,
            uint256 discountThreshold,
            uint256 opportunityReserveBalance,
            uint256 estGain,
            uint256 estSavings
        )
    {
        StrategyRules memory r = rules[user];
        musdPrice = _getMusdPrice(user);
        premiumThreshold = r.premiumThreshold;
        discountThreshold = r.discountThreshold;
        opportunityReserveBalance = opportunityReserve[user];

        premiumActive = r.premiumEnabled && musdPrice > r.premiumThreshold;
        discountActive = r.discountEnabled && musdPrice < r.discountThreshold;

        if (premiumActive) {
            uint256 notional = opportunityReserveBalance;
            estGain = (notional * (musdPrice - 1e18)) / 1e18;
        }
        if (discountActive && musdPrice > 0) {
            uint256 spend = opportunityReserveBalance;
            uint256 acquired = (spend * 1e18) / musdPrice;
            estSavings = acquired > spend ? acquired - spend : 0;
        }
    }

    function runAutomation(bytes calldata signature, uint256 deadline) external {
        StrategyRules memory r = rules[msg.sender];

        uint256 btcPrice = _getBtcPrice(msg.sender);
        uint256 musdPrice = _getMusdPrice(msg.sender);
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

            uint256 coll = tm.getTroveColl(msg.sender);
            uint256 targetDebt = (coll * btcPrice) / r.safetyICR;
            if (debt <= targetDebt) {
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

            uint256 targetRepay = debt - targetDebt;
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

        // Peg actions (MUSD price only). Safety does not suppress peg execution in this legacy runner.
        uint256 icrAfterPeg = icrBefore;

        if (r.premiumEnabled && musdPrice > r.premiumThreshold) {
            mask |= 2;
            // Simulation: deploy 100% of opportunity reserve; "gain" is (price-1) * notional.
            uint256 notional = opportunityReserve[msg.sender];
            uint256 gain = (notional * (musdPrice - 1e18)) / 1e18;
            emit PremiumSimulated(msg.sender, musdPrice, notional, gain);
        }

        if (r.discountEnabled && musdPrice < r.discountThreshold) {
            mask |= 4;
            // Simulation: deploy 100% of opportunity reserve.
            uint256 spend = opportunityReserve[msg.sender];
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

    function runSafety(bytes calldata signature, uint256 deadline) external {
        StrategyRules memory r = rules[msg.sender];

        uint256 btcPrice = _getBtcPrice(msg.sender);
        require(btcPrice > 0, "NO_PRICE");

        ITroveManager tm = ITroveManager(troveManager);
        uint256 icrBefore = tm.getCurrentICR(msg.sender, btcPrice);

        bool safetyTriggered = r.safetyEnabled && icrBefore < r.safetyICR;
        emit RiskStateEvaluated(msg.sender, icrBefore, safetyTriggered);

        if (!safetyTriggered) {
            emit SafetyRan(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 debt = tm.getTroveDebt(msg.sender);
        uint256 reserve = safetyReserve[msg.sender];
        if (debt == 0 || reserve == 0) {
            emit SafetyRan(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 coll = tm.getTroveColl(msg.sender);
        uint256 targetDebt = (coll * btcPrice) / r.safetyICR;
        if (debt <= targetDebt) {
            emit SafetyRan(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        uint256 targetRepay = debt - targetDebt;
        uint256 maxUse = (reserve * r.maxReserveUseBps) / 10_000;
        uint256 repayAmount = targetRepay;
        if (repayAmount > maxUse) repayAmount = maxUse;
        if (repayAmount > reserve) repayAmount = reserve;
        if (repayAmount == 0) {
            emit SafetyRan(msg.sender, btcPrice, icrBefore, icrBefore, 0);
            return;
        }

        require(signature.length > 0 && deadline > 0, "SIGNATURE_REQUIRED");

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
        emit SafetyRan(msg.sender, btcPrice, icrBefore, icrAfter, repayAmount);
    }

    function runPeg() external {
        StrategyRules memory r = rules[msg.sender];
        uint256 musdPrice = _getMusdPrice(msg.sender);

        bool premiumActive = r.premiumEnabled && musdPrice > r.premiumThreshold;
        bool discountActive = r.discountEnabled && musdPrice < r.discountThreshold;

        if (premiumActive) {
            uint256 notional = opportunityReserve[msg.sender];
            uint256 gain = (notional * (musdPrice - 1e18)) / 1e18;
            emit PremiumSimulated(msg.sender, musdPrice, notional, gain);
        }

        if (discountActive && musdPrice > 0) {
            uint256 spend = opportunityReserve[msg.sender];
            uint256 acquired = (spend * 1e18) / musdPrice;
            opportunityMusdAcquired[msg.sender] += acquired;
            uint256 savings = acquired > spend ? acquired - spend : 0;
            emit DiscountSimulated(msg.sender, musdPrice, spend, acquired, savings);
        }

        emit PegRan(msg.sender, musdPrice, premiumActive, discountActive);
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
