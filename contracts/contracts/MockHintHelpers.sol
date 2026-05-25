// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockHintHelpers {
    function getApproxHint(uint256, uint256, uint256) external pure returns (address, uint256, uint256) {
        return (address(0), 0, 0);
    }

    function computeNominalCR(uint256 _coll, uint256 _debt) external pure returns (uint256) {
        if (_debt == 0) return type(uint256).max;
        return (_coll * 1e18) / _debt;
    }
}

