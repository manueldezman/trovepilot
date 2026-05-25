// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockBorrowerOperationsSignatures {
    mapping(address => uint256) public nonces;

    event Repaid(address indexed borrower, uint256 amount, address upperHint, address lowerHint, uint256 deadline);
    event Adjusted(
        address indexed borrower,
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        address upperHint,
        address lowerHint,
        address recipient,
        uint256 deadline
    );

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function repayMUSDWithSignature(
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        bytes memory,
        uint256 _deadline
    ) external {
        nonces[_borrower] += 1;
        emit Repaid(_borrower, _amount, _upperHint, _lowerHint, _deadline);
    }

    function adjustTroveWithSignature(
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        address _borrower,
        address _recipient,
        bytes memory,
        uint256 _deadline
    ) external {
        nonces[_borrower] += 1;
        emit Adjusted(_borrower, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, _recipient, _deadline);
    }
}
