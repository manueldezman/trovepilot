import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount, sign } from "viem/accounts";
import { defineChain } from "viem";
import { MEZO, mezoChainId, mezoRpcUrl } from "@/lib/mezo";
import { vaultAbi } from "@/lib/trovePilotAbis";
import { mezoPriceFeedAbi, mezoBorrowerOperationsSignaturesAbi } from "@/lib/mezoAbis";
import { computeAdjustTroveDigest } from "@/lib/borrowerOpsSignatures";
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

export async function POST(req: Request) {
  try {
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

    let setTx: `0x${string}` | null = null;
    if (mode === "preview") {
      const pct = clampPct(body.pct);
      const [simBtc, protocolBtc] = await Promise.all([
        publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "getSimulatedBTCPrice", args: [account.address] }) as Promise<bigint>,
        publicClient.readContract({ address: MEZO.priceFeed, abi: mezoPriceFeedAbi, functionName: "fetchPrice" }) as Promise<bigint>
      ]);
      const base = simBtc > 0n ? simBtc : protocolBtc;
      const next = (base * BigInt(100 + pct)) / 100n;
      setTx = await walletClient.writeContract({ address: vault, abi: vaultAbi, functionName: "setSimulatedBTCPrice", args: [next] });
      await publicClient.waitForTransactionReceipt({ hash: setTx });
    }

    const preview = (await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "previewBtcUp", args: [account.address] })) as any;
    const triggered = Boolean(preview.triggered ?? preview[0]);
    const mintAmount = (preview.mintAmount ?? preview[1]) as bigint;

    let runTx: `0x${string}` | null = null;
    if (mode === "run" && triggered && mintAmount > 0n) {
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

      runTx = await walletClient.writeContract({ address: vault, abi: vaultAbi, functionName: "runBtcUp", args: [signature, deadline] });
      await publicClient.waitForTransactionReceipt({ hash: runTx });
    }

    const previewAfter = mode === "run" ? ((await publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "previewBtcUp", args: [account.address] })) as any) : null;

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
