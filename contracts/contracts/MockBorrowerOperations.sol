// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockBorrowerOperations {
    uint256 private rate; // 1e18

    constructor(uint256 _rate) {
        rate = _rate;
    }

    function borrowingRate() external view returns (uint256) {
        return rate;
    }

    function setBorrowingRate(uint256 _rate) external {
        rate = _rate;
    }
}

