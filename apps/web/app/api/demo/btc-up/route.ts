import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { defineChain } from "viem";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { mezoPriceFeedAbi, mezoBorrowerOperationsSignaturesAbi, mezoBorrowerOperationsAbi, mezoTroveManagerAbi } from "@/lib/mezoAbis";
import { computeAdjustTroveDigest } from "@/lib/borrowerOpsSignatures";
import { addresses } from "@/lib/addresses";

const MEZO = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  borrowerOperationsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
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
    const chain = defineChain({
      id: envChainId(),
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
    const shouldRun = preview.triggered;
    const mintAmount = BigInt(preview.mintAmount);
    if (mode === "run" && shouldRun && mintAmount > 0n) {
      setTx = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "setSimulatedBTCPrice",
        args: [next],
        gas: 250_000n
      });
      await publicClient.waitForTransactionReceipt({ hash: setTx });

      const nonce = (await publicClient.readContract({
        address: MEZO.borrowerOperationsSignatures,
        abi: mezoBorrowerOperationsSignaturesAbi,
        functionName: "getNonce",
        args: [account.address]
      })) as bigint;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
      const digest = computeAdjustTroveDigest({
        collWithdrawal: 0n,
        debtChange: mintAmount,
        isDebtIncrease: true,
        assetAmount: 0n,
        borrower: account.address,
        recipient: vault,
        nonce,
        deadline,
        chainId: mezoChainId,
        verifyingContract: MEZO.borrowerOperationsSignatures
      });
      const signature = (await sign({ hash: digest, privateKey: pk, to: "hex" })) as `0x${string}`;

      runTx = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "runBtcUp",
        args: [signature, deadline],
        gas: 1_000_000n
      });
      await publicClient.waitForTransactionReceipt({ hash: runTx });
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
      preview: jsonSafe(preview),
      previewAfter: jsonSafe(previewAfter)
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}
