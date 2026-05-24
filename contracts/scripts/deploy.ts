import { ethers } from "hardhat";

const MEZO = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  borrowerOperationsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
} as const;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer=", await deployer.getAddress());

  const Oracle = await ethers.getContractFactory("MockMarketOracle");
  const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));
  await oracle.waitForDeployment();

  const Vault = await ethers.getContractFactory("TrovePilotVault");
  const vault = await Vault.deploy(
    MEZO.musd,
    MEZO.troveManager,
    MEZO.borrowerOperations,
    MEZO.borrowerOperationsSignatures,
    MEZO.hintHelpers,
    MEZO.sortedTroves,
    await oracle.getAddress()
  );
  await vault.waitForDeployment();

  console.log("MOCK_MARKET_ORACLE_ADDRESS=", await oracle.getAddress());
  console.log("TROVE_PILOT_VAULT_ADDRESS=", await vault.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
