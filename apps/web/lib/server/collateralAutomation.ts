import { createPublicClient, createWalletClient, defineChain, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { addresses } from "@/lib/addresses";
import { erc20Abi, vaultAbi } from "@/lib/trovePilotAbis";
import {
  mezoBorrowerOperationsAbi,
  mezoHintHelpersAbi,
  mezoPriceFeedAbi,
  mezoSortedTrovesAbi,
  mezoTroveManagerAbi
} from "@/lib/mezoAbis";

export const MEZO = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
} as const;

const ONE = 10n ** 18n;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export function createAutomationContext() {
  const vault = addresses.vault;
  if (!vault) throw new Error("Missing NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS");

  const privateKey = required("DEMO_BORROWER_PRIVATE_KEY", process.env.DEMO_BORROWER_PRIVATE_KEY) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.NEXT_PUBLIC_MEZO_RPC_URL || "https://rpc.test.mezo.org";
  const configuredChainId = Number(process.env.NEXT_PUBLIC_MEZO_CHAIN_ID || "31611");
  const chainId = Number.isFinite(configuredChainId) ? configuredChainId : 31611;
  const chain = defineChain({
    id: chainId,
    name: "Mezo Testnet",
    nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  });

  return {
    account,
    vault,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ chain, transport: http(rpcUrl), account })
  };
}

export type AutomationContext = ReturnType<typeof createAutomationContext>;

export async function readLiveBtcPrice(context: AutomationContext): Promise<bigint> {
  return context.publicClient.readContract({
    address: MEZO.priceFeed,
    abi: mezoPriceFeedAbi,
    functionName: "fetchPrice"
  });
}

export async function readSimulatedBtcPrice(context: AutomationContext): Promise<bigint> {
  return context.publicClient.readContract({
    address: context.vault,
    abi: vaultAbi,
    functionName: "getSimulatedBTCPrice",
    args: [context.account.address]
  });
}

export type CollateralCheck = {
  btcPrice: bigint;
  collateral: bigint;
  debt: bigint;
  icr: bigint;
  targetICR: bigint;
  bandLower: bigint;
  bandUpper: bigint;
  btcDownEnabled: boolean;
  btcUpEnabled: boolean;
  musdReserve: bigint;
  repayAmount: bigint;
  mintAmount: bigint;
  action: "btc-down" | "btc-up" | "none";
  skipReason: string | null;
};

export async function calculateCollateralAction(
  context: AutomationContext,
  btcPrice: bigint
): Promise<CollateralCheck> {
  const [rules, collateral, debt, musdReserve, borrowingRate] = await Promise.all([
    context.publicClient.readContract({
      address: context.vault,
      abi: vaultAbi,
      functionName: "getRules",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveColl",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveDebt",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: context.vault,
      abi: vaultAbi,
      functionName: "getMusdReserve",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.borrowerOperations,
      abi: mezoBorrowerOperationsAbi,
      functionName: "borrowingRate"
    })
  ]);

  const targetICR = rules.targetICR;
  const bandLower = rules.bandLowerICR;
  const bandUpper = rules.bandUpperICR;
  let icr = 0n;
  if (btcPrice > 0n && debt > 0n) {
    icr = await context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getCurrentICR",
      args: [context.account.address, btcPrice]
    });
  }

  let repayAmount = 0n;
  let mintAmount = 0n;
  let action: CollateralCheck["action"] = "none";
  let skipReason: string | null = null;

  if (btcPrice === 0n || debt === 0n || collateral === 0n || targetICR === 0n) {
    skipReason = "vault state or strategy rules are not initialized";
  } else if (icr < bandLower) {
    if (!rules.btcDownEnabled) {
      skipReason = "BTC-down automation is disabled";
    } else {
      const targetDebt = (collateral * btcPrice) / targetICR;
      const desired = debt > targetDebt ? debt - targetDebt : 0n;
      repayAmount = desired > musdReserve ? musdReserve : desired;
      if (repayAmount > 0n) action = "btc-down";
      else skipReason = "repayment amount is zero or reserve is empty";
    }
  } else if (icr > bandUpper) {
    if (!rules.btcUpEnabled) {
      skipReason = "BTC-up automation is disabled";
    } else {
      const targetDebt = (collateral * btcPrice) / targetICR;
      const deltaComposite = targetDebt > debt ? targetDebt - debt : 0n;
      mintAmount = (deltaComposite * ONE) / (ONE + borrowingRate);
      if (mintAmount > 0n) action = "btc-up";
      else skipReason = "mint amount is zero";
    }
  } else {
    skipReason = "ICR is within the configured safe range";
  }

  return {
    btcPrice,
    collateral,
    debt,
    icr,
    targetICR,
    bandLower,
    bandUpper,
    btcDownEnabled: rules.btcDownEnabled,
    btcUpEnabled: rules.btcUpEnabled,
    musdReserve,
    repayAmount,
    mintAmount,
    action,
    skipReason
  };
}

async function getInsertHints(context: AutomationContext, collateral: bigint, newDebt: bigint) {
  const nicr = await context.publicClient.readContract({
    address: MEZO.hintHelpers,
    abi: mezoHintHelpersAbi,
    functionName: "computeNominalCR",
    args: [collateral, newDebt]
  });
  const approx = await context.publicClient.readContract({
    address: MEZO.hintHelpers,
    abi: mezoHintHelpersAbi,
    functionName: "getApproxHint",
    args: [nicr, 50n, BigInt(Date.now())]
  });
  const position = await context.publicClient.readContract({
    address: MEZO.sortedTroves,
    abi: mezoSortedTrovesAbi,
    functionName: "findInsertPosition",
    args: [nicr, approx[0], approx[0]]
  });
  return { upperHint: position[0], lowerHint: position[1] };
}

async function requireSuccessfulReceipt(context: AutomationContext, hash: Hash, label: string) {
  const receipt = await context.publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} transaction reverted`);
}

export async function setSimulatedBtcPrice(context: AutomationContext, btcPrice: bigint): Promise<Hash> {
  const hash = await context.walletClient.writeContract({
    address: context.vault,
    abi: vaultAbi,
    functionName: "setSimulatedBTCPrice",
    args: [btcPrice],
    gas: 250_000n
  });
  await requireSuccessfulReceipt(context, hash, "setSimulatedBTCPrice");
  return hash;
}

export async function executeBtcDown(context: AutomationContext, amount: bigint) {
  const transactionHashes: Hash[] = [];
  const withdrawHash = await context.walletClient.writeContract({
    address: context.vault,
    abi: vaultAbi,
    functionName: "withdrawReserveMUSD",
    args: [amount],
    gas: 350_000n
  });
  transactionHashes.push(withdrawHash);
  await requireSuccessfulReceipt(context, withdrawHash, "withdrawReserveMUSD");

  const [collateral, debt] = await Promise.all([
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveColl",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveDebt",
      args: [context.account.address]
    })
  ]);
  const hints = await getInsertHints(context, collateral, debt > amount ? debt - amount : 0n);
  await context.publicClient.simulateContract({
    account: context.account.address,
    address: MEZO.borrowerOperations,
    abi: mezoBorrowerOperationsAbi,
    functionName: "repayMUSD",
    args: [amount, hints.upperHint, hints.lowerHint]
  });
  const transactionHash = await context.walletClient.writeContract({
    address: MEZO.borrowerOperations,
    abi: mezoBorrowerOperationsAbi,
    functionName: "repayMUSD",
    args: [amount, hints.upperHint, hints.lowerHint],
    gas: 800_000n
  });
  transactionHashes.push(transactionHash);
  await requireSuccessfulReceipt(context, transactionHash, "repayMUSD");
  return { transactionHash, transactionHashes };
}

export async function executeBtcUp(context: AutomationContext, amount: bigint) {
  const transactionHashes: Hash[] = [];
  const [collateral, debt, borrowingRate] = await Promise.all([
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveColl",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.troveManager,
      abi: mezoTroveManagerAbi,
      functionName: "getTroveDebt",
      args: [context.account.address]
    }),
    context.publicClient.readContract({
      address: MEZO.borrowerOperations,
      abi: mezoBorrowerOperationsAbi,
      functionName: "borrowingRate"
    })
  ]);
  const fee = (amount * borrowingRate) / ONE;
  const hints = await getInsertHints(context, collateral, debt + amount + fee);
  await context.publicClient.simulateContract({
    account: context.account.address,
    address: MEZO.borrowerOperations,
    abi: mezoBorrowerOperationsAbi,
    functionName: "withdrawMUSD",
    args: [amount, hints.upperHint, hints.lowerHint]
  });

  const transactionHash = await context.walletClient.writeContract({
    address: MEZO.borrowerOperations,
    abi: mezoBorrowerOperationsAbi,
    functionName: "withdrawMUSD",
    args: [amount, hints.upperHint, hints.lowerHint],
    gas: 1_000_000n
  });
  transactionHashes.push(transactionHash);
  await requireSuccessfulReceipt(context, transactionHash, "withdrawMUSD");

  const approveHash = await context.walletClient.writeContract({
    address: MEZO.musd,
    abi: erc20Abi,
    functionName: "approve",
    args: [context.vault, amount],
    gas: 200_000n
  });
  transactionHashes.push(approveHash);
  await requireSuccessfulReceipt(context, approveHash, "approve");

  const depositHash = await context.walletClient.writeContract({
    address: context.vault,
    abi: vaultAbi,
    functionName: "depositReserveMUSD",
    args: [amount],
    gas: 350_000n
  });
  transactionHashes.push(depositHash);
  await requireSuccessfulReceipt(context, depositHash, "depositReserveMUSD");
  return { transactionHash, transactionHashes };
}

export function serializeCheck(check: CollateralCheck) {
  return Object.fromEntries(
    Object.entries(check).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value])
  );
}
