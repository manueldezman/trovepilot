import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
    repayAmount: ((p?.repayAmount ?? p?.[1]) as bigint).toString(),
    icr: ((p?.icr ?? p?.[2]) as bigint).toString(),
    btcPrice: ((p?.btcPrice ?? p?.[3]) as bigint).toString(),
    bandLower: ((p?.bandLower ?? p?.[4]) as bigint).toString(),
    targetICR: ((p?.targetICR ?? p?.[5]) as bigint).toString(),
    musdReserve: ((p?.musdReserve ?? p?.[6]) as bigint).toString()
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
    const next = (base * BigInt(100 - pct)) / 100n;

    // Preview should be side-effect free. Compute the same logic as the vault preview using `next` as btc price.
    const [rules, musdReserveBal, coll, debt] = await Promise.all([
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "getRules", args: [account.address] }) as Promise<any>,
      publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "getMusdReserve", args: [account.address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [account.address] }) as Promise<bigint>,
      publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [account.address] }) as Promise<bigint>
    ]);

    const r: any = rules;
    const bandLower = (r.bandLowerICR ?? r[1]) as bigint;
    const targetICR = (r.targetICR ?? r[0]) as bigint;
    const btcDownEnabled = Boolean(r.btcDownEnabled ?? r[7]);
    let icr = 0n;
    let triggeredCalc = false;
    let repayAmountCalc = 0n;
    if (btcDownEnabled && next > 0n && debt > 0n) {
      icr = (await publicClient.readContract({
        address: MEZO.troveManager,
        abi: mezoTroveManagerAbi,
        functionName: "getCurrentICR",
        args: [account.address, next]
      })) as bigint;
      triggeredCalc = icr < bandLower;
      if (triggeredCalc) {
        const targetDebt = (coll * next) / targetICR;
        if (debt > targetDebt) {
          const desired = debt - targetDebt;
          repayAmountCalc = desired > musdReserveBal ? musdReserveBal : desired;
        }
      }
    }

    const preview = {
      triggered: triggeredCalc,
      repayAmount: repayAmountCalc.toString(),
      icr: icr.toString(),
      btcPrice: next.toString(),
      bandLower: bandLower.toString(),
      targetICR: targetICR.toString(),
      musdReserve: musdReserveBal.toString()
    };
    const shouldRun = preview.triggered;
    const repayAmount = BigInt(preview.repayAmount);

    let runTx: `0x${string}` | null = null;
    let setTx: `0x${string}` | null = null;
    let runError: string | null = null;
    let attemptedSet = false;
    let attemptedRun = false;
    let stage: "none" | "set" | "run" = "none";
    if (mode === "run") {
      if (!shouldRun) {
        runError = "Execution skipped: trigger is false at run time.";
      } else if (repayAmount <= 0n) {
        runError = "Execution skipped: repay amount is 0.";
      } else {
      try {
        // Now apply the simulated price onchain (compounds only on run).
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
          throw new Error(runError);
        }

        // Production-safe path for demo mode:
        // 1) withdraw reserve from vault to wallet
        // 2) repay from wallet via BorrowerOperations.repayMUSD
        attemptedRun = true;
        stage = "run";
        const withdrawTx = await walletClient.writeContract({
          address: vault,
          abi: vaultAbi,
          functionName: "withdrawReserveMUSD",
          args: [repayAmount],
          gas: 350_000n
        });
        const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
        if (withdrawReceipt.status !== "success") {
          runError = "withdrawReserveMUSD transaction reverted";
          throw new Error(runError);
        }

        const [collNow, debtNow] = (await Promise.all([
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveColl", args: [account.address] }),
          publicClient.readContract({ address: MEZO.troveManager, abi: mezoTroveManagerAbi, functionName: "getTroveDebt", args: [account.address] })
        ])) as [bigint, bigint];
        const newDebt = debtNow > repayAmount ? debtNow - repayAmount : 0n;
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
            functionName: "repayMUSD",
            args: [repayAmount, upperHint, lowerHint]
          });
        } catch (e: any) {
          runError = e?.shortMessage || e?.message || "repayMUSD simulation failed";
          throw new Error(runError);
        }
        runTx = await walletClient.writeContract({
          address: MEZO.borrowerOperations,
          abi: mezoBorrowerOperationsAbi,
          functionName: "repayMUSD",
          args: [repayAmount, upperHint, lowerHint],
          gas: 800_000n
        });
        const runReceipt = await publicClient.waitForTransactionReceipt({ hash: runTx });
        if (runReceipt.status !== "success") {
          runError = "repayMUSD transaction reverted";
        }
      } catch (e: any) {
        runError = e?.shortMessage || e?.message || "BTC down execution failed";
      }
      }
    }

    const previewAfter =
      mode === "run"
        ? normalizePreview(
            (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "previewBtcDown", args: [account.address] })) as any
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
      repayAmount: repayAmount.toString(),
      preview: jsonSafe(preview),
      previewAfter: jsonSafe(previewAfter)
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}
