import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrovePilotVault", () => {
  it("tracks reserve deposits/withdrawals and bucket splits", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("100", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, 0);

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      ethers.Wallet.createRandom().address,
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("10", 18));

    expect(await vault.getReserveBalance(await user.getAddress(), await token.getAddress())).to.eq(ethers.parseUnits("10", 18));
    expect(await vault.getSafetyReserve(await user.getAddress())).to.eq(ethers.parseUnits("10", 18));
    expect(await vault.getOpportunityReserve(await user.getAddress())).to.eq(0);

    await vault.withdrawReserve(await token.getAddress(), ethers.parseUnits("4", 18));
    expect(await vault.getReserveBalance(await user.getAddress(), await token.getAddress())).to.eq(ethers.parseUnits("6", 18));
    expect(await vault.getSafetyReserve(await user.getAddress())).to.eq(ethers.parseUnits("6", 18));

    // Set a split and ensure deposit is bucketed correctly.
    await vault.setRules({
      safetyICR: 0,
      premiumThreshold: 0,
      discountThreshold: 0,
      maxReserveUseBps: 2500,
      safetyReserveBps: 7000,
      opportunityReserveBps: 3000,
      safetyEnabled: false,
      premiumEnabled: false,
      discountEnabled: false
    });

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("10", 18));
    expect(await vault.getSafetyReserve(await user.getAddress())).to.eq(ethers.parseUnits("13", 18));
    expect(await vault.getOpportunityReserve(await user.getAddress())).to.eq(ethers.parseUnits("3", 18));
  });

  it("stores rules and validates bps", async () => {
    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, 0);

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      ethers.Wallet.createRandom().address,
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await expect(
      vault.setRules({
        safetyICR: 0,
        premiumThreshold: 0,
        discountThreshold: 0,
        maxReserveUseBps: 10001,
        safetyReserveBps: 10_000,
        opportunityReserveBps: 0,
        safetyEnabled: true,
        premiumEnabled: true,
        discountEnabled: true
      })
    ).to.be.revertedWith("BPS");

    await expect(
      vault.setRules({
        safetyICR: 0,
        premiumThreshold: 0,
        discountThreshold: 0,
        maxReserveUseBps: 2500,
        safetyReserveBps: 9999,
        opportunityReserveBps: 0,
        safetyEnabled: true,
        premiumEnabled: true,
        discountEnabled: true
      })
    ).to.be.revertedWith("BAD_SPLIT");

    await vault.setRules({
      safetyICR: ethers.parseUnits("1.5", 18),
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 2500,
      safetyReserveBps: 10_000,
      opportunityReserveBps: 0,
      safetyEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    const r = await vault.getRules(await (await ethers.getSigners())[0].getAddress());
    expect(r.maxReserveUseBps).to.eq(2500);
  });

  it("previewAutomation + runAutomation: safety requires signature; peg actions are simulated", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    await troveManager.setTrove(await user.getAddress(), ethers.parseUnits("1", 18), ethers.parseUnits("100", 18), 1);

    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      ethers.Wallet.createRandom().address,
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await vault.setRules({
      safetyICR: ethers.parseUnits("2000", 18), // force safety trigger
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 10_000,
      safetyReserveBps: 10_000,
      opportunityReserveBps: 0,
      safetyEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    await token.approve(await vault.getAddress(), ethers.parseUnits("50", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("50", 18));

    const preview = await vault.previewAutomation(await user.getAddress());
    expect(preview.needsSafetyRepay).to.eq(true);
    expect(preview.repayAmount).to.be.gt(0);
    expect(preview.premiumActive).to.eq(false);
    expect(preview.discountActive).to.eq(false);

    await expect(vault.runAutomation("0x", 0)).to.be.revertedWith("SIGNATURE_REQUIRED");
    await vault.runAutomation("0x1234", BigInt(Math.floor(Date.now() / 1000) + 60));
    expect(await vault.getSafetyReserve(await user.getAddress())).to.eq(0);

    // Now disable safety, enable opportunity reserve, and simulate discount accounting.
    await vault.setRules({
      safetyICR: 0,
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 0,
      safetyReserveBps: 0,
      opportunityReserveBps: 10_000,
      safetyEnabled: false,
      premiumEnabled: true,
      discountEnabled: true
    });

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("10", 18));
    expect(await vault.getOpportunityReserve(await user.getAddress())).to.eq(ethers.parseUnits("10", 18));

    await oracle.setMUSDPrice(ethers.parseUnits("0.97", 18));
    const p2 = await vault.previewAutomation(await user.getAddress());
    expect(p2.needsSafetyRepay).to.eq(false);
    expect(p2.discountActive).to.eq(true);

    await vault.runAutomation("0x", 0);
    expect(await vault.getOpportunityMusdAcquired(await user.getAddress())).to.be.gt(0);
  });

  it("previewSafety/runSafety and previewPeg/runPeg are independent", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    await troveManager.setTrove(await user.getAddress(), ethers.parseUnits("1", 18), ethers.parseUnits("100", 18), 1);

    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      ethers.Wallet.createRandom().address,
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    // Safety enabled, full safety bucket.
    await vault.setRules({
      safetyICR: ethers.parseUnits("2000", 18), // force safety trigger
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 10_000,
      safetyReserveBps: 10_000,
      opportunityReserveBps: 0,
      safetyEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    await token.approve(await vault.getAddress(), ethers.parseUnits("50", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("50", 18));

    const ps = await vault.previewSafety(await user.getAddress());
    expect(ps.triggered).to.eq(true);
    expect(ps.repayAmount).to.be.gt(0);

    await expect(vault.runSafety("0x", 0)).to.be.revertedWith("SIGNATURE_REQUIRED");
    await vault.runSafety("0x1234", BigInt(Math.floor(Date.now() / 1000) + 60));
    expect(await vault.getSafetyReserve(await user.getAddress())).to.eq(0);

    // Peg path uses opportunity bucket and ignores safety state/ICR.
    await vault.setRules({
      safetyICR: ethers.parseUnits("2000", 18),
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 10_000,
      safetyReserveBps: 0,
      opportunityReserveBps: 10_000,
      safetyEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("10", 18));
    expect(await vault.getOpportunityReserve(await user.getAddress())).to.eq(ethers.parseUnits("10", 18));

    await oracle.setMUSDPrice(ethers.parseUnits("0.97", 18));
    const pp = await vault.previewPeg(await user.getAddress());
    expect(pp.discountActive).to.eq(true);

    await vault.runPeg();
    expect(await vault.getOpportunityMusdAcquired(await user.getAddress())).to.be.gt(0);
  });
});
