import { NextResponse } from "next/server";
import {
  calculateCollateralAction,
  createAutomationContext,
  executeBtcUp,
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
    const btcPrice = (basePrice * BigInt(100 + clampPct(body.pct))) / 100n;
    const check = await calculateCollateralAction(context, btcPrice);

    let setTx: `0x${string}` | null = null;
    let runTx: `0x${string}` | null = null;
    let runError: string | null = null;
    let attemptedSet = false;
    let attemptedRun = false;
    let stage: "none" | "set" | "run" = "none";

    if (body.mode === "run") {
      if (check.action !== "btc-up") {
        runError = `Execution skipped: ${check.skipReason || "BTC-up trigger is false"}.`;
      } else {
        try {
          attemptedSet = true;
          stage = "set";
          setTx = await setSimulatedBtcPrice(context, btcPrice);
          attemptedRun = true;
          stage = "run";
          runTx = (await executeBtcUp(context, check.mintAmount)).transactionHash;
        } catch (error) {
          runError = error instanceof Error ? error.message : "BTC up execution failed";
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
      shouldRun: check.action === "btc-up",
      mintAmount: check.mintAmount.toString(),
      preview: {
        triggered: check.action === "btc-up",
        mintAmount: check.mintAmount.toString(),
        icr: check.icr.toString(),
        btcPrice: check.btcPrice.toString(),
        bandUpper: check.bandUpper.toString(),
        targetICR: check.targetICR.toString()
      },
      previewAfter: checkAfter
        ? {
            triggered: checkAfter.action === "btc-up",
            mintAmount: checkAfter.mintAmount.toString(),
            icr: checkAfter.icr.toString(),
            btcPrice: checkAfter.btcPrice.toString(),
            bandUpper: checkAfter.bandUpper.toString(),
            targetICR: checkAfter.targetICR.toString()
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
