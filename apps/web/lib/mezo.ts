import { type Address } from "viem";

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}. Copy apps/web/.env.example to apps/web/.env.local and fill it.`);
  return v;
}

export const mezoChainId = Number(requiredEnv("NEXT_PUBLIC_MEZO_CHAIN_ID"));
export const mezoRpcUrl = requiredEnv("NEXT_PUBLIC_MEZO_RPC_URL");
export const mezoExplorerUrl = requiredEnv("NEXT_PUBLIC_MEZO_EXPLORER_URL");

export const MEZO: Record<string, Address> = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  borrowerOperationsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
};
