import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { defineChain } from "viem";
import { MEZO, mezoChainId, mezoRpcUrl } from "@/lib/mezo";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { mezoPriceFeedAbi, mezoBorrowerOperationsSignaturesAbi, mezoTroveManagerAbi } from "@/lib/mezoAbis";
import { computeRepayMusdDigest } from "@/lib/borrowerOpsSignatures";
import { addresses } from "@/lib/addresses";

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

    const chain = defineChain({
      id: mezoChainId,
      name: "Mezo Testnet",
      nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
      rpcUrls: { default: { http: [mezoRpcUrl] } }
    });

    const publicClient = createPublicClient({ chain, transport: http(mezoRpcUrl) });
    const walletClient = createWalletClient({ chain, transport: http(mezoRpcUrl), account });

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
    if (mode === "run" && shouldRun && repayAmount > 0n) {
      // Now apply the simulated price onchain (compounds only on run).
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
      const digest = computeRepayMusdDigest({
        amount: repayAmount,
        borrower: account.address,
        nonce,
        deadline,
        chainId: mezoChainId,
        verifyingContract: MEZO.borrowerOperationsSignatures
      });
      const signature = (await sign({ hash: digest, privateKey: pk, to: "hex" })) as `0x${string}`;

      runTx = await walletClient.writeContract({
        address: vault,
        abi: vaultAbi,
        functionName: "runBtcDown",
        args: [signature, deadline],
        gas: 800_000n
      });
      await publicClient.waitForTransactionReceipt({ hash: runTx });
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
      preview: jsonSafe(preview),
      previewAfter: jsonSafe(previewAfter)
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message ?? "Unknown error" }, { status: 500 });
  }
}
