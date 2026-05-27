import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { defineChain } from "viem";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { mezoPriceFeedAbi, mezoBorrowerOperationsAbi, mezoHintHelpersAbi, mezoSortedTrovesAbi, mezoTroveManagerAbi } from "@/lib/mezoAbis";
import { addresses } from "@/lib/addresses";

const MEZO = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
} as const;

function envChainId(): number {
  const v = process.env.NEXT_PUBLIC_MEZO_CHAIN_ID;
  const n = v ? Number(v) : 31611;
  return Number.isFinite(n) ? n : 31611;
}

function envRpcUrl(): string {
  return process.env.NEXT_PUBLIC_MEZO_RPC_URL || "https://rpc.test.mezo.org";
}

type Body = {
  mode: "preview" | "run";
  pct?: number;
  address?: `0x${string}`;
};

function required(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function clampPct(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function jsonSafe<T>(v: T): any {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v as any)) out[k] = jsonSafe(val);
    return out;
  }
  return v;
}

function normalizePreview(p: any) {
  return {
    triggered: Boolean(p?.triggered ?? p?.[0]),
    mintAmount: ((p?.mintAmount ?? p?.[1]) as bigint).toString(),
    icr: ((p?.icr ?? p?.[2]) as bigint).toString(),
    btcPrice: ((p?.btcPrice ?? p?.[3]) as bigint).toString(),
    bandUpper: ((p?.bandUpper ?? p?.[4]) as bigint).toString(),
    targetICR: ((p?.targetICR ?? p?.[5]) as bigint).toString()
  };
}

export async function POST(req: Request) {
  try {
    if (process.env.DEMO_AUTOMATION_ENABLED !== "1") {
      return new Response("Not found", { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const mode = body.mode;
    if (mode !== "preview" && mode !== "run") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });

    const vault = addresses.vault;
    if (!vault) throw new Error("Missing NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS");

    const pk = required("DEMO_BORROWER_PRIVATE_KEY", process.env.DEMO_BORROWER_PRIVATE_KEY) as `0x${string}`;
    const account = privateKeyToAccount(pk);

    const caller = body.address?.toLowerCase();
    if (!caller) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    if (caller !== account.address.toLowerCase()) {
      return NextResponse.json({ error: `Connected wallet (${body.address}) does not match demo signer (${account.address})` }, { status: 400 });
    }

    const rpcUrl = envRpcUrl();
    const chainId = envChainId();
    const chain = defineChain({
      id: chainId,
      name: "Mezo Testnet",
      nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } }
    });

    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

    const pct = clampPct(body.pct);
    const [simBtc, protocolBtc] = await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "getSimulatedBTCPrice", args: [account.address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.priceFeed, abi: mezoPriceFeedAbi, functionName: "fetchPrice" }) as Promise<bigint>
    ]);
    const base = simBtc > 0n ? simBtc : protocolBtc;
    const next = (base * BigInt(100 + pct)) / 100n;

    // Side-effect free preview: compute same logic as vault using `next` as btc price.
    const [rules, coll, debt, borrowingRate] = await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "getRules", args: [account.address] }) as Promise<any>,
      publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [account.address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [account.address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "borrowingRate" }) as Promise<bigint>
    ]);

    const r: any = rules;
    const bandUpper = (r.bandUpperICR ?? r[2]) as bigint;
    const targetICR = (r.targetICR ?? r[0]) as bigint;
    const btcUpEnabled = Boolean(r.btcUpEnabled ?? r[8]);
    let icr = 0n;
    let triggeredCalc = false;
    let mintAmountCalc = 0n;
    if (btcUpEnabled && next > 0n && coll > 0n) {
      icr = (await publicClient.readContract({
        address: MEZO.troveManager,
        abi: mezoTroveManagerAbi,
        functionName: "getCurrentICR",
        args: [account.address, next]
      })) as bigint;
      triggeredCalc = icr > bandUpper;
      if (triggeredCalc) {
        const targetDebt = (coll * next) / targetICR;
        if (targetDebt > debt) {
          const deltaComposite = targetDebt - debt;
          mintAmountCalc = (deltaComposite * 10n ** 18n) / (10n ** 18n + borrowingRate);
        }
      }
    }

    const preview = {
      triggered: triggeredCalc,
      mintAmount: mintAmountCalc.toString(),
      icr: icr.toString(),
      btcPrice: next.toString(),
      bandUpper: bandUpper.toString(),
      targetICR: targetICR.toString()
    };

    let runTx: `0x${string}` | null = null;
    let setTx: `0x${string}` | null = null;
    let runError: string | null = null;
    let attemptedSet = false;
    let attemptedRun = false;
    let stage: "none" | "set" | "run" = "none";
    const shouldRun = preview.triggered;
    const mintAmount = BigInt(preview.mintAmount);
    if (mode === "run") {
      if (!shouldRun) {
        runError = "Execution skipped: trigger is false at run time.";
      } else if (mintAmount <= 0n) {
        runError = "Execution skipped: mint amount is 0.";
      } else {
      try {
        attemptedSet = true;
        stage = "set";
        setTx = await walletClient.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "setSimulatedBTCPrice",
          args: [next],
          gas: 250_000n
        });
        const setReceipt = await publicClient.waitForTransactionReceipt({ hash: setTx });
        if (setReceipt.status !== "success") {
          runError = "setSimulatedBTCPrice transaction reverted";
          throw new Error(runError ?? "setSimulatedBTCPrice transaction reverted");
        }

        attemptedRun = true;
        stage = "run";

        // Production-safe path for demo mode:
        // 1) Mint MUSD to borrower wallet via BorrowerOperations.withdrawMUSD
        // 2) Approve vault
        // 3) Deposit minted MUSD to reserve
        const [collNow, debtNow, rate] = (await Promise.all([
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [account.address] }),
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [account.address] }),
          publicClient.readContract({ address: MEZO.borrowerOperations, abi: mezoBorrowerOperationsAbi, functionName: "borrowingRate" })
        ])) as [bigint, bigint, bigint];

        const fee = (mintAmount * rate) / 10n ** 18n;
        const newDebt = debtNow + mintAmount + fee;
        const nicr = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "computeNominalCR",
          args: [collNow, newDebt]
        })) as bigint;
        const seed = BigInt(Date.now());
        const approx = (await publicClient.readContract({
          address: MEZO.hintHelpers,
          abi: mezoHintHelpersAbi,
          functionName: "getApproxHint",
          args: [nicr, 50n, seed]
        })) as any;
        const hintAddress = (approx.hintAddress ?? approx[0]) as `0x${string}`;
        const pos = (await publicClient.readContract({
          address: MEZO.sortedTroves,
          abi: mezoSortedTrovesAbi,
          functionName: "findInsertPosition",
          args: [nicr, hintAddress, hintAddress]
        })) as any;
        const upperHint = (pos.prevId ?? pos[0]) as `0x${string}`;
        const lowerHint = (pos.nextId ?? pos[1]) as `0x${string}`;

        try {
          await publicClient.simulateContract({
            account: account.address,
            address: MEZO.borrowerOperations,
            abi: mezoBorrowerOperationsAbi,
            functionName: "withdrawMUSD",
            args: [mintAmount, upperHint, lowerHint]
          });
        } catch (e: any) {
          runError = e?.shortMessage || e?.message || "withdrawMUSD simulation failed";
          throw new Error(runError ?? "withdrawMUSD simulation failed");
        }

        runTx = await walletClient.writeContract({
          address: MEZO.borrowerOperations,
          abi: mezoBorrowerOperationsAbi,
          functionName: "withdrawMUSD",
          args: [mintAmount, upperHint, lowerHint],
          gas: 1_000_000n
        });
        const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: runTx });
        if (mintReceipt.status !== "success") {
          runError = "withdrawMUSD transaction reverted";
          throw new Error(runError ?? "withdrawMUSD transaction reverted");
        }

        const approveTx = await walletClient.writeContract({
          address: MEZO.musd,
          abi: [
            {
              type: "function",
              name: "approve",
              stateMutability: "nonpayable",
              inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
              outputs: [{ type: "bool" }]
            }
          ] as const,
          functionName: "approve",
          args: [vault, mintAmount],
          gas: 200_000n
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
        if (approveReceipt.status !== "success") {
          runError = "approve transaction reverted";
          throw new Error(runError ?? "approve transaction reverted");
        }

        const depositTx = await walletClient.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "depositReserveMUSD",
          args: [mintAmount],
          gas: 350_000n
        });
        const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositTx });
        if (depositReceipt.status !== "success") {
          runError = "depositReserveMUSD transaction reverted";
        }
      } catch (e: any) {
        runError = e?.shortMessage || e?.message || "BTC up execution failed";
      }
      }
    }

    const previewAfter =
      mode === "run"
        ? normalizePreview(
            (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "previewBtcUp", args: [account.address] })) as any
          )
        : null;

    return NextResponse.json({
      mode,
      demoAddress: account.address,
      setTx,
      runTx,
      runError,
      attemptedSet,
      attemptedRun,
      stage,
      shouldRun,
      mintAmount: mintAmount.toString(),
      preview: jsonSafe(preview),
      previewAfter: jsonSafe(previewAfter)
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}
