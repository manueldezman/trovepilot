import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrovePilotVaultV3", () => {
  it("deposits/withdraws MUSD reserve", async () => {
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
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV3");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("10", 18));
    expect(await vault.getMusdReserve(await user.getAddress())).to.eq(ethers.parseUnits("10", 18));

    await vault.withdrawReserveMUSD(ethers.parseUnits("4", 18));
    expect(await vault.getMusdReserve(await user.getAddress())).to.eq(ethers.parseUnits("6", 18));
  });

  it("validates rules (band + bps)", async () => {
    const [user] = await ethers.getSigners();

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
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV3");
    const vault = await Vault.deploy(
      await token.getAddress(),
      await troveManager.getAddress(),
      await borrowerOps.getAddress(),
      await borrowerOpsSigs.getAddress(),
      await hintHelpers.getAddress(),
      await sortedTroves.getAddress(),
      await oracle.getAddress()
    );

    await expect(
      vault.setRules({
        targetICR: ethers.parseUnits("1.6", 18),
        bandLowerICR: ethers.parseUnits("1.7", 18),
        bandUpperICR: ethers.parseUnits("1.8", 18),
        premiumThreshold: 0,
        discountThreshold: 0,
        premiumSellBps: 0,
        discountBuyBps: 0,
        btcDownEnabled: true,
        btcUpEnabled: true,
        premiumEnabled: true,
        discountEnabled: true
      })
    ).to.be.revertedWith("BAD_BAND");

    await expect(
      vault.setRules({
        targetICR: ethers.parseUnits("1.6", 18),
        bandLowerICR: ethers.parseUnits("1.58", 18),
        bandUpperICR: ethers.parseUnits("1.62", 18),
        premiumThreshold: 0,
        discountThreshold: 0,
        premiumSellBps: 10_001,
        discountBuyBps: 0,
        btcDownEnabled: true,
        btcUpEnabled: true,
        premiumEnabled: true,
        discountEnabled: true
      })
    ).to.be.revertedWith("BPS");

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

    const r = await vault.getRules(await user.getAddress());
    expect(r.premiumSellBps).to.eq(2000);
  });

  it("BTC down: previews repay and requires signature when repay > 0", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("1000", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    // coll=1 BTC, debt=100k => ICR = 1.0 (below band)
    await troveManager.setTrove(await user.getAddress(), ethers.parseUnits("1", 18), ethers.parseUnits("100000", 18), 1);

    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV3");
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

    await token.approve(await vault.getAddress(), ethers.parseUnits("50", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("50", 18));

    const p = await vault.previewBtcDown(await user.getAddress());
    expect(p.triggered).to.eq(true);
    expect(p.repayAmount).to.be.gt(0);

    await expect(vault.runBtcDown("0x", 0)).to.be.revertedWith("SIGNATURE_REQUIRED");
    await vault.runBtcDown("0x1234", BigInt(Math.floor(Date.now() / 1000) + 60));
    expect(await vault.getMusdReserve(await user.getAddress())).to.be.lt(ethers.parseUnits("50", 18));
  });

  it("BTC up: previews mint and requires signature when mint > 0", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(ethers.parseUnits("100000", 18), ethers.parseUnits("1.00", 18));

    const TroveManager = await ethers.getContractFactory("MockTroveManager");
    const troveManager = await TroveManager.deploy();
    // coll=1 BTC, debt=50k => ICR = 2.0 (above band upper)
    await troveManager.setTrove(await user.getAddress(), ethers.parseUnits("1", 18), ethers.parseUnits("50000", 18), 1);

    const HintHelpers = await ethers.getContractFactory("MockHintHelpers");
    const hintHelpers = await HintHelpers.deploy();
    const SortedTroves = await ethers.getContractFactory("MockSortedTroves");
    const sortedTroves = await SortedTroves.deploy();
    const BorrowerOpsSigs = await ethers.getContractFactory("MockBorrowerOperationsSignatures");
    const borrowerOpsSigs = await BorrowerOpsSigs.deploy();
    const BorrowerOps = await ethers.getContractFactory("MockBorrowerOperations");
    const borrowerOps = await BorrowerOps.deploy(ethers.parseUnits("0.001", 18));

    const Vault = await ethers.getContractFactory("TrovePilotVaultV3");
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

    const p = await vault.previewBtcUp(await user.getAddress());
    expect(p.triggered).to.eq(true);
    expect(p.mintAmount).to.be.gt(0);

    await expect(vault.runBtcUp("0x", 0)).to.be.revertedWith("SIGNATURE_REQUIRED");
    await vault.runBtcUp("0x1234", BigInt(Math.floor(Date.now() / 1000) + 60));
    expect(await vault.getMusdReserve(await user.getAddress())).to.be.gt(0);
  });

  it("premium/discount rotate between MUSD reserve and simulated USDC reserve", async () => {
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

    const Vault = await ethers.getContractFactory("TrovePilotVaultV3");
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

    await token.approve(await vault.getAddress(), ethers.parseUnits("100", 18));
    await vault.depositReserveMUSD(ethers.parseUnits("100", 18));

    const beforeM = await vault.getMusdReserve(await user.getAddress());
    await vault.runPremium();
    const afterM = await vault.getMusdReserve(await user.getAddress());
    const usdc = await vault.getUsdcReserve(await user.getAddress());
    expect(afterM).to.be.lt(beforeM);
    expect(usdc).to.be.gt(0);

    await oracle.setMUSDPrice(ethers.parseUnits("0.92", 18));
    await vault.runDiscount();
    expect(await vault.getMusdReserve(await user.getAddress())).to.be.gt(afterM);
  });
});

