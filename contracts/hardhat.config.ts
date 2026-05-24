import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

const chainId = Number(process.env.MEZO_CHAIN_ID || "31611");
const url = process.env.MEZO_RPC_URL || "https://rpc.test.mezo.org";
const pk = process.env.MEZO_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    mezoTestnet: {
      chainId,
      url,
      accounts: pk ? [pk] : []
    }
  }
};

export default config;
