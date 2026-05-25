// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockSortedTroves {
    function findInsertPosition(uint256, address, address) external pure returns (address, address) {
        return (address(0), address(0));
    }
}

