import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import type { HardhatUserConfig } from "hardhat/config";

const chainId = Number(process.env.MEZO_CHAIN_ID || "31611");
const url = process.env.MEZO_RPC_URL || "https://rpc.test.mezo.org";
const pkRaw = process.env.MEZO_PRIVATE_KEY?.trim();
const pk =
  pkRaw && /^0x[0-9a-fA-F]{64}$/.test(pkRaw)
    ? pkRaw
    : pkRaw && /^[0-9a-fA-F]{64}$/.test(pkRaw)
      ? (`0x${pkRaw}` as const)
      : undefined;
const accounts = pk ? [pk] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true }
  },
  networks: {
    mezoTestnet: {
      chainId,
      url,
      accounts
    }
  }
};

export default config;
