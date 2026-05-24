// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockMarketOracle {
    address public immutable admin;

    uint256 private btcPrice;
    uint256 private musdPrice;

    event BTCPriceUpdated(uint256 price);
    event MUSDPriceUpdated(uint256 price);

    modifier onlyAdmin() {
        require(msg.sender == admin, "ONLY_ADMIN");
        _;
    }

    constructor(uint256 initialBtcPrice, uint256 initialMusdPrice) {
        admin = msg.sender;
        btcPrice = initialBtcPrice;
        musdPrice = initialMusdPrice;
    }

    function setBTCPrice(uint256 price) external onlyAdmin {
        btcPrice = price;
        emit BTCPriceUpdated(price);
    }

    function setMUSDPrice(uint256 price) external onlyAdmin {
        musdPrice = price;
        emit MUSDPriceUpdated(price);
    }

    function getBTCPrice() external view returns (uint256) {
        return btcPrice;
    }

    function getMUSDPrice() external view returns (uint256) {
        return musdPrice;
    }
}
