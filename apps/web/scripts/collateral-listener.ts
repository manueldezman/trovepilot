import {
  calculateCollateralAction,
  createAutomationContext,
  executeBtcDown,
  executeBtcUp,
  readLiveBtcPrice
} from "@/lib/server/collateralAutomation";

const configuredPollInterval = Number(process.env.ORACLE_POLL_INTERVAL_MS || "5000");
const pollInterval = Number.isFinite(configuredPollInterval) && configuredPollInterval >= 1000
  ? configuredPollInterval
  : 5000;
const dryRun = process.env.MONITOR_DRY_RUN !== "0";

let checking = false;
let previousPrice: bigint | null = null;

function log(level: "info" | "error", event: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({
    service: "collateral-listener",
    event,
    time: new Date().toISOString(),
    ...data
  });
  if (level === "error") console.error(payload);
  else console.info(payload);
}

async function handleBlock(blockNumber: bigint) {
  if (checking) {
    log("info", "skipped", {
      blockNumber: blockNumber.toString(),
      skipped: true,
      skipReason: "previous check is still running"
    });
    return;
  }

  checking = true;
  try {
    const context = createAutomationContext();
    const btcPrice = await readLiveBtcPrice(context);
    const direction =
      previousPrice === null
        ? "initial"
        : btcPrice < previousPrice
          ? "down"
          : btcPrice > previousPrice
            ? "up"
            : "unchanged";
    previousPrice = btcPrice;

    const check = await calculateCollateralAction(context, btcPrice);
    log("info", "check", {
      blockNumber: blockNumber.toString(),
      dryRun,
      borrower: context.account.address,
      btcPrice: check.btcPrice.toString(),
      priceDirection: direction,
      icr: check.icr.toString(),
      lowerThreshold: check.bandLower.toString(),
      upperThreshold: check.bandUpper.toString(),
      action: check.action,
      skipped: check.action === "none",
      skipReason: check.skipReason
    });

    if (check.action === "none" || dryRun) {
      log("info", "skipped", {
        blockNumber: blockNumber.toString(),
        dryRun,
        btcPrice: check.btcPrice.toString(),
        icr: check.icr.toString(),
        intendedAction: check.action,
        skipped: true,
        skipReason: dryRun && check.action !== "none" ? "dry-run mode" : check.skipReason
      });
      return;
    }

    const execution =
      check.action === "btc-down"
        ? await executeBtcDown(context, check.repayAmount)
        : await executeBtcUp(context, check.mintAmount);

    log("info", "transaction", {
      blockNumber: blockNumber.toString(),
      btcPrice: check.btcPrice.toString(),
      icr: check.icr.toString(),
      action: check.action,
      transactionHash: execution.transactionHash,
      transactionHashes: execution.transactionHashes
    });
  } catch (error) {
    log("error", "error", {
      blockNumber: blockNumber.toString(),
      error: error instanceof Error ? error.message : "Unknown listener error"
    });
  } finally {
    checking = false;
  }
}

async function main() {
  const context = createAutomationContext();
  await readLiveBtcPrice(context);
  log("info", "started", {
    borrower: context.account.address,
    dryRun,
    pollInterval,
    rpcTransport: "new-block polling"
  });

  const unwatch = context.publicClient.watchBlockNumber({
    emitOnBegin: true,
    pollingInterval: pollInterval,
    onBlockNumber: (blockNumber) => {
      void handleBlock(blockNumber);
    },
    onError: (error) => {
      log("error", "watch-error", { error: error.message });
    }
  });

  const shutdown = (signal: string) => {
    unwatch();
    log("info", "stopped", { signal });
    process.exit(0);
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  log("error", "startup-error", {
    error: error instanceof Error ? error.message : "Unknown startup error"
  });
  process.exit(1);
});
