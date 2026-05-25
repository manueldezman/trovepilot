import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrovePilotVaultV4 (adaptive 60/40)", () => {
  it("allocates deposits ~60/40 at $1.00", async () => {
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

    const Vault = await ethers.getContractFactory("TrovePilotVaultV4");
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

  it("BTC-up minted refill allocates toward 60/40", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    await troveManager.setTrove(await user.getAddress(), ethers.parseUnits("1", 18), ethers.parseUnits("50000", 18), 1);

    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV4");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await vault.setRules({
      targetICR: ethers.parseUnits("1.6", 18),
      bandLowerICR: ethers.parseUnits("1.58", 18),
      bandUpperICR: ethers.parseUnits("1.62", 18),
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      premiumSellBps: 2000,
      discountBuyBps: 2000,
      btcDownEnabled: true,
      btcUpEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    // With empty reserves, minted inflow should allocate to 60/40.
    await vault.runBtcUp("0x1234", BigInt(Math.floor(Date.now() / 1000) + 60));

    const musd = await vault.getMusdReserve(await user.getAddress());
    const usdc = await vault.getUsdcReserve(await user.getAddress());
    // Must have some split (both nonzero) unless mint is tiny.
    expect(musd + usdc).to.be.gt(0);
    expect(musd).to.be.gt(0);
    expect(usdc).to.be.gt(0);
  });

  it("premium/discount revert NOT_NEEDED when already on the right side", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.03", 18));

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

    const Vault = await ethers.getContractFactory("TrovePilotVaultV4");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await vault.setRules({
      targetICR: ethers.parseUnits("1.6", 18),
      bandLowerICR: ethers.parseUnits("1.58", 18),
      bandUpperICR: ethers.parseUnits("1.62", 18),
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      premiumSellBps: 2000,
      discountBuyBps: 2000,
      btcDownEnabled: true,
      btcUpEnabled: true,
      premiumEnabled: true,
      discountEnabled: true
    });

    // Make reserve USDC-heavy via direct deposit allocation by setting MUSD price very high
    // and depositing small amount so allocator converts most to USDC. Then premium shouldn't be needed.
    await vault.setSimulatedMUSDPrice(ethers.parseUnits("2.00", 18));
    await token.approve(await vault.getAddress(), ethers.parseUnits("100", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("100", 18));

    await oracle.setMUSDPrice(ethers.parseUnits("1.03", 18));
    await expect(vault.runPremium()).to.be.revertedWith("NOT_NEEDED");
  });
});
