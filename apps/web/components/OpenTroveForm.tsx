"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseEther } from "viem";
import { useOpenTrove } from "@/hooks/useOpenTrove";
import { useProtocolBtcPrice } from "@/hooks/useProtocolBtcPrice";
import { useBorrowParams } from "@/hooks/useBorrowParams";
import { useAccount } from "wagmi";
import { useProtocolTrove } from "@/hooks/useProtocolTrove";
import { useWriteContract } from "wagmi";
import { MEZO, mezoExplorerUrl, mezoChainId } from "@/lib/mezo";
import { useChainId } from "wagmi";
import { mezoBorrowerOperationsAbi } from "@/lib/mezoAbis";
import { publicClient } from "@/lib/wagmi";

const GAS_COMP = 200n * 10n ** 18n;
// Minimum MUSD minted to wallet (excludes 200 MUSD gas compensation).
const MIN_MINTED = 1800n * 10n ** 18n;
const ONE = 10n ** 18n;

export function OpenTroveForm() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [btc, setBtc] = useState("0.01");
  const [icrPct, setIcrPct] = useState(140);
  const [addCollBtc, setAddCollBtc] = useState("0.001");

  const btcValue = useMemo(() => {
    try {
      return parseEther(btc || "0");
    } catch {
      return 0n;
    }
  }, [btc]);

  const addCollValue = useMemo(() => {
    try {
      return parseEther(addCollBtc || "0");
    } catch {
      return 0n;
    }
  }, [addCollBtc]);

  const { data: protocolPrice, isLoading: priceLoading, error: priceError } = useProtocolBtcPrice();
  const { data: borrowParams, isLoading: paramsLoading, error: paramsError } = useBorrowParams();
  const { data: trove } = useProtocolTrove(address ?? undefined, protocolPrice);

  const isActive = trove?.status === 1n;

  const calc = useMemo(() => {
    if (!protocolPrice || !borrowParams) return null;

    const targetICR = (BigInt(icrPct) * ONE) / 100n;
    if (targetICR <= 0n) return null;

    const compositeDebt = (btcValue * protocolPrice) / targetICR;
    if (compositeDebt <= GAS_COMP) {
      return {
        targetICR,
        compositeDebt,
        netDebt: 0n,
        debtAmount: 0n,
        fee: 0n,
        reasons: ["Collateral too low for chosen ICR"]
      };
    }

    const netDebt = compositeDebt - GAS_COMP;
    const borrowingRate = borrowParams.borrowingRate; // 1e18
    const debtAmount = (netDebt * ONE) / (ONE + borrowingRate);
    const fee = netDebt > debtAmount ? netDebt - debtAmount : 0n;

    const reasons: string[] = [];
    if (debtAmount < MIN_MINTED) reasons.push("Minimum borrow is 1800 MUSD");
    if (netDebt < borrowParams.minNetDebt) reasons.push(`Below Mezo minNetDebt (${formatUnits(borrowParams.minNetDebt, 18)} MUSD)`);

    return { targetICR, compositeDebt, netDebt, debtAmount, fee, reasons };
  }, [borrowParams, btcValue, icrPct, protocolPrice]);

  const { openTrove, isPending, error, txUrl } = useOpenTrove();

  const disabled = isPending || btcValue <= 0n || !calc || calc.debtAmount <= 0n || calc.reasons.length > 0;
  const belowMinMinted = Boolean(calc && calc.debtAmount > 0n && calc.debtAmount < MIN_MINTED);

  const mintMore = useMemo(() => {
    if (!protocolPrice || !borrowParams || !trove) return null;
    if (trove.status !== 1n) return null;

    const targetICR = (BigInt(icrPct) * ONE) / 100n;
    if (targetICR <= 0n) return null;

    const targetCompositeDebt = (trove.collateral * protocolPrice) / targetICR;
    if (targetCompositeDebt <= trove.debt) {
      return { amount: 0n, reasons: ["Target ICR too high for additional mint (no headroom)"] };
    }

    const headroomComposite = targetCompositeDebt - trove.debt;
    const borrowingRate = borrowParams.borrowingRate;
    const reasons: string[] = [];

    // Capacity cap: BorrowerOps requires maxBorrowingCapacity >= debt + (amount + fee).
    const cap = trove.maxBorrowingCapacity;
    if (cap <= trove.debt) {
      reasons.push("Borrowing capacity exhausted (maxBorrowingCapacity <= current debt)");
      return { amount: 0n, reasons };
    }
    const capacityHeadroom = cap - trove.debt;

    // Conservative: solve for amount where amount + fee ~= headroom.
    const maxByICR = (headroomComposite * ONE) / (ONE + borrowingRate);
    const maxByCapacity = (capacityHeadroom * ONE) / (ONE + borrowingRate);
    let amount = maxByICR < maxByCapacity ? maxByICR : maxByCapacity;

    // Safety buffer (5%) to avoid rounding/fee edge reverts.
    amount = (amount * 95n) / 100n;

    if (amount < MIN_MINTED) reasons.push("Minimum mint increment is 1800 MUSD");
    return { amount, reasons };
  }, [borrowParams, icrPct, protocolPrice, trove]);

  const { writeContractAsync } = useWriteContract();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionTx, setActionTx] = useState<`0x${string}` | null>(null);

  async function doAddColl() {
    setActionError(null);
    setActionTx(null);
    if (!isConnected || !address) return setActionError("Connect a wallet first");
    if (chainId !== mezoChainId) return setActionError(`Wrong network (expected chainId ${mezoChainId})`);
    if (addCollValue <= 0n) return setActionError("Collateral must be > 0");
    try {
      const hash = await writeContractAsync({
        address: MEZO.borrowerOperations,
        abi: mezoBorrowerOperationsAbi,
        functionName: "addColl",
        args: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"],
        value: addCollValue
      });
      setActionTx(hash);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function doMintMore() {
    setActionError(null);
    setActionTx(null);
    if (!isConnected || !address) return setActionError("Connect a wallet first");
    if (chainId !== mezoChainId) return setActionError(`Wrong network (expected chainId ${mezoChainId})`);
    const amt = mintMore?.amount ?? 0n;
    if (amt <= 0n) return setActionError("No mint headroom for selected ICR");
    if (amt < MIN_MINTED) return setActionError("Minimum mint increment is 1800 MUSD");
    try {
      const sim = await publicClient.simulateContract({
        account: address,
        address: MEZO.borrowerOperations,
        abi: mezoBorrowerOperationsAbi,
        functionName: "withdrawMUSD",
        args: [amt, "0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"]
      });

      const hash = await writeContractAsync({
        ...sim.request,
        gas: sim.request.gas
      } as any);
      setActionTx(hash);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  async function doRefinance() {
    setActionError(null);
    setActionTx(null);
    if (!isConnected || !address) return setActionError("Connect a wallet first");
    if (chainId !== mezoChainId) return setActionError(`Wrong network (expected chainId ${mezoChainId})`);
    try {
      const sim = await publicClient.simulateContract({
        account: address,
        address: MEZO.borrowerOperations,
        abi: mezoBorrowerOperationsAbi,
        functionName: "refinance",
        args: ["0x0000000000000000000000000000000000000000", "0x0000000000000000000000000000000000000000"]
      });
      const hash = await writeContractAsync({ ...(sim.request as any), gas: sim.request.gas } as any);
      setActionTx(hash);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }

  return (
    <section style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 14, background: "var(--panel)" }}>
      <h2 style={{ marginTop: 0 }}>Open Trove (BTC → mint MUSD)</h2>
      <p style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
        This mints real MUSD by opening a Mezo trove via <code>BorrowerOperations.openTrove</code>, using Mezo&apos;s onchain BTC price (
        <code>PriceFeed.fetchPrice()</code>). For MVP, we pass empty hints (0x0, 0x0).
      </p>

      {isActive ? (
        <>
          <div style={{ marginTop: 10, padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "rgba(15,23,42,0.03)" }}>
            <div style={{ fontWeight: 650 }}>Trove active</div>
            <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
              <Row label="Collateral" value={trove ? `${formatUnits(trove.collateral, 18)} BTC` : "—"} />
              <Row label="Debt (composite)" value={trove ? `${formatUnits(trove.debt, 18)} MUSD` : "—"} />
              <Row label="ICR (protocol price)" value={trove ? `${formatUnits(trove.icr, 18)}x` : "—"} />
              <Row label="Max borrowing capacity" value={trove ? `${formatUnits(trove.maxBorrowingCapacity, 18)} MUSD` : "—"} />
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
	              <button
	                onClick={doRefinance}
	                style={{
	                  padding: "10px 12px",
	                  borderRadius: 12,
	                  border: "1px solid var(--border)",
	                  background: "rgba(15,23,42,0.04)",
	                  color: "var(--text)"
	                }}
	              >
                Refinance (update capacity)
              </button>
              <div style={{ alignSelf: "center", color: "var(--muted)", fontSize: 12 }}>
                Use after adding collateral to refresh max borrowing capacity.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <Field label="Add BTC collateral (native)" value={addCollBtc} onChange={setAddCollBtc} />
            <button
              onClick={doAddColl}
              disabled={addCollValue <= 0n}
              style={{
                alignSelf: "end",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--accentFill)",
                color: "var(--text)"
              }}
            >
              Add collateral
            </button>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Mint more MUSD (derived from target ICR)</div>
            <div style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Target collateralization ratio (ICR)</span>
              <input type="range" min={110} max={250} step={1} value={icrPct} onChange={(e) => setIcrPct(Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12 }}>
                <span>110%</span>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                  {icrPct}%
                </span>
                <span>250%</span>
              </div>
            </div>

            <Row label="Additional mint (est.)" value={mintMore ? `${formatUnits(mintMore.amount, 18)} MUSD` : "—"} />
            {mintMore && mintMore.reasons.length > 0 ? (
              <div style={{ color: "#fbbf24", fontSize: 12 }}>{mintMore.reasons.join(" • ")}</div>
            ) : null}

            <button
              onClick={doMintMore}
              disabled={!mintMore || mintMore.amount <= 0n || mintMore.reasons.length > 0}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: !mintMore || mintMore.reasons.length > 0 ? "rgba(15,23,42,0.04)" : "var(--accentFill)",
                color: "var(--text)"
              }}
            >
              Mint more MUSD
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          <Field label="BTC collateral (native)" value={btc} onChange={setBtc} />
          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Target collateralization ratio (ICR)</span>
            <input type="range" min={110} max={250} step={1} value={icrPct} onChange={(e) => setIcrPct(Number(e.target.value))} />
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12 }}>
              <span>110%</span>
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                {icrPct}%
              </span>
              <span>250%</span>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
        <Row label="Protocol BTC price" value={priceLoading ? "Loading…" : priceError ? "Error" : protocolPrice ? formatUnits(protocolPrice, 18) : "—"} />
        <Row label="Borrowing rate" value={paramsLoading ? "Loading…" : paramsError ? "Error" : borrowParams ? `${formatUnits(borrowParams.borrowingRate, 18)} (1e18)` : "—"} />
        {!isActive ? (
          <>
            <Row label="Estimated minted MUSD" value={calc ? `${formatUnits(calc.debtAmount, 18)} MUSD` : "—"} />
            <Row label="Estimated borrowing fee" value={calc ? `${formatUnits(calc.fee, 18)} MUSD` : "—"} />
            <Row label="Gas compensation" value="200.0 MUSD" />
            <Row label="Net debt" value={calc ? `${formatUnits(calc.netDebt, 18)} MUSD` : "—"} />
            <Row label="Composite debt" value={calc ? `${formatUnits(calc.compositeDebt, 18)} MUSD` : "—"} />
          </>
        ) : null}
      </div>

      {!isActive ? (
        <>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              disabled={disabled}
              onClick={() => openTrove({ collateralValue: btcValue, debtAmount: calc!.debtAmount })}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: disabled ? (belowMinMinted ? "var(--criticalSoft)" : "rgba(15,23,42,0.04)") : "var(--accentFill)",
                color: "var(--text)"
              }}
            >
              {isPending ? "Submitting…" : belowMinMinted ? "Minimum 1800 MUSD required" : "Open trove + mint MUSD"}
            </button>
            {txUrl ? (
              <a href={txUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "var(--muted)", fontSize: 13 }}>
                View transaction
              </a>
            ) : null}
          </div>

          {calc && calc.reasons.length > 0 ? (
            <div style={{ marginTop: 10, color: "#fbbf24", fontSize: 12 }}>
              {calc.reasons.join(" • ")}
            </div>
          ) : null}
          {error ? <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{error.message}</div> : null}
        </>
      ) : null}

      {actionTx ? (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <a href={`${mezoExplorerUrl}/tx/${actionTx}`} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "var(--muted)" }}>
            View last action tx
          </a>
        </div>
      ) : null}
      {actionError ? <div style={{ marginTop: 10, color: "#fda4af", fontSize: 12 }}>{actionError}</div> : null}
    </section>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.03)",
          color: "var(--text)"
        }}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
        {value}
      </div>
    </div>
  );
}
