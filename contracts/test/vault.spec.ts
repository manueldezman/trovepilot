import { expect } from "chai";
import { ethers } from "hardhat";

describe("TrovePilotVault", () => {
  it("tracks reserve deposits/withdrawals", async () => {
    const [user] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock MUSD", "mMUSD", 18);
    await token.mint(await user.getAddress(), ethers.parseUnits("100", 18));

    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, 0);

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      await token.getAddress(),
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      await oracle.getAddress()
    );

    await token.approve(await vault.getAddress(), ethers.parseUnits("10", 18));
    await vault.depositReserve(await token.getAddress(), ethers.parseUnits("10", 18));

    expect(await vault.getReserveBalance(await user.getAddress(), await token.getAddress())).to.eq(ethers.parseUnits("10", 18));

    await vault.withdrawReserve(await token.getAddress(), ethers.parseUnits("4", 18));
    expect(await vault.getReserveBalance(await user.getAddress(), await token.getAddress())).to.eq(ethers.parseUnits("6", 18));
  });

  it("stores rules and validates bps", async () => {
    const Oracle = await ethers.getContractFactory("MockMarketOracle");
    const oracle = await Oracle.deploy(0, 0);

    const Vault = await ethers.getContractFactory("TrovePilotVault");
    const vault = await Vault.deploy(
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
      await oracle.getAddress()
    );

    await expect(
      vault.setRules({
        minICR: 0,
        repayBps: 10001,
        premiumThreshold: 0,
        discountThreshold: 0,
        maxReserveUseBps: 0,
        collateralDefenseEnabled: true,
        premiumModeEnabled: true,
        discountModeEnabled: true
      })
    ).to.be.revertedWith("BPS");

    await vault.setRules({
      minICR: ethers.parseUnits("1.4", 18),
      repayBps: 1000,
      premiumThreshold: ethers.parseUnits("1.02", 18),
      discountThreshold: ethers.parseUnits("0.98", 18),
      maxReserveUseBps: 2500,
      collateralDefenseEnabled: true,
      premiumModeEnabled: true,
      discountModeEnabled: true
    });

    const r = await vault.getRules(await (await ethers.getSigners())[0].getAddress());
    expect(r.repayBps).to.eq(1000);
  });
});

