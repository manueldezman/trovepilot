import { NextResponse } from "next/server";
import {
  calculateCollateralAction,
  createAutomationContext,
  executeBtcDown,
  readLiveBtcPrice,
  readSimulatedBtcPrice,
  setSimulatedBtcPrice
} from "@/lib/server/collateralAutomation";

type Body = {
  mode: "preview" | "run";
  pct?: number;
  address?: `0x${string}`;
};

function clampPct(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_AUTOMATION_ENABLED !== "1") {
      return new Response("Not found", { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    if (body.mode !== "preview" && body.mode !== "run") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const context = createAutomationContext();
    if (!body.address) return NextResponse.json({ error: "Missing address" }, { status: 400 });
    if (body.address.toLowerCase() !== context.account.address.toLowerCase()) {
      return NextResponse.json(
        { error: `Connected wallet (${body.address}) does not match demo signer (${context.account.address})` },
        { status: 400 }
      );
    }

    const [simulatedPrice, livePrice] = await Promise.all([
      readSimulatedBtcPrice(context),
      readLiveBtcPrice(context)
    ]);
    const basePrice = simulatedPrice > 0n ? simulatedPrice : livePrice;
    const btcPrice = (basePrice * BigInt(100 - clampPct(body.pct))) / 100n;
    const check = await calculateCollateralAction(context, btcPrice);

    let setTx: `0x${string}` | null = null;
    let runTx: `0x${string}` | null = null;
    let runError: string | null = null;
    let attemptedSet = false;
    let attemptedRun = false;
    let stage: "none" | "set" | "run" = "none";

    if (body.mode === "run") {
      if (check.action !== "btc-down") {
        runError = `Execution skipped: ${check.skipReason || "BTC-down trigger is false"}.`;
      } else {
        try {
          attemptedSet = true;
          stage = "set";
          setTx = await setSimulatedBtcPrice(context, btcPrice);
          attemptedRun = true;
          stage = "run";
          runTx = (await executeBtcDown(context, check.repayAmount)).transactionHash;
        } catch (error) {
          runError = error instanceof Error ? error.message : "BTC down execution failed";
        }
      }
    }

    const checkAfter = body.mode === "run" ? await calculateCollateralAction(context, btcPrice) : null;
    return NextResponse.json({
      mode: body.mode,
      demoAddress: context.account.address,
      setTx,
      runTx,
      runError,
      attemptedSet,
      attemptedRun,
      stage,
      shouldRun: check.action === "btc-down",
      repayAmount: check.repayAmount.toString(),
      preview: {
        triggered: check.action === "btc-down",
        repayAmount: check.repayAmount.toString(),
        icr: check.icr.toString(),
        btcPrice: check.btcPrice.toString(),
        bandLower: check.bandLower.toString(),
        targetICR: check.targetICR.toString(),
        musdReserve: check.musdReserve.toString()
      },
      previewAfter: checkAfter
        ? {
            triggered: checkAfter.action === "btc-down",
            repayAmount: checkAfter.repayAmount.toString(),
            icr: checkAfter.icr.toString(),
            btcPrice: checkAfter.btcPrice.toString(),
            bandLower: checkAfter.bandLower.toString(),
            targetICR: checkAfter.targetICR.toString(),
            musdReserve: checkAfter.musdReserve.toString()
          }
        : null
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
