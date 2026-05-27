import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrovePilotVaultV5 (withdrawable opportunity lane)", () => {
  it("allocates deposits 60/40 by amount", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV5");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await token.approve(await vault.getAddress(), ethers.parseUnits("100", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("100", 18));

    const musd = await vault.getMusdReserve(await user.getAddress());
    const usdc = await vault.getUsdcReserve(await user.getAddress());

    expect(musd).to.eq(ethers.parseUnits("60", 18));
    expect(usdc).to.eq(ethers.parseUnits("40", 18));
  });

  it("withdrawReserveMUSD can draw from opportunity lane", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV5");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await token.approve(await vault.getAddress(), ethers.parseUnits("100", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("100", 18)); // 60/40

    // Withdraw 80: consumes 60 stability + 20 opportunity.
    await vault.withdrawReserveMUSD(ethers.parseUnits("80", 18));

    const musd = await vault.getMusdReserve(await user.getAddress());
    const usdc = await vault.getUsdcReserve(await user.getAddress());
    expect(musd).to.eq(0);
    expect(usdc).to.eq(ethers.parseUnits("20", 18));
  });
});

