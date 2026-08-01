# TrovePilot

Live demo: https://trovepilot-web-vo95.vercel.app/  
Click the thumbnail below to watch the video demo.  
[![Watch the demo](https://img.youtube.com/vi/Aj58RXZ5Bs0/hqdefault.jpg)](https://youtu.be/Aj58RXZ5Bs0)

TrovePilot is an automation layer for Mezo borrowers that stabilizes target ICR and coordinates dual-asset reserves (MUSD + USDC accounting) through BTC volatility and MUSD peg changes.

## Chainlink CRE redesign

This repository contains the original Mezo implementation. Its collateral monitor runs as an always-on VPS
service and uses a server-side borrower signer to submit BTC-up and BTC-down transactions.

[`trovepilot-cre`](https://github.com/manueldezman/trovepilot-cre) is the follow-up redesign for a Compound
III WBTC/USDC position on Ethereum Sepolia. It replaces the persistent VPS signer with Chainlink CRE
oracle-event and five-minute heartbeat triggers, signed reports, and a constrained receiver contract.

- [CRE architecture](https://github.com/manueldezman/trovepilot-cre/blob/main/docs/ARCHITECTURE.md)
- [Simulation and broadcast evidence](https://github.com/manueldezman/trovepilot-cre/blob/main/docs/CRE_DEMO_EVIDENCE.md)
- [Confirmed Sepolia repayment](https://sepolia.etherscan.io/tx/0x9677805924b2dd83598133caf65d54757fc3d89ddf5391db9f3f7d16f992a492)

## Core behavior

- BTC Down scenarios can trigger debt repayment from reserve flow.
- BTC Up scenarios can mint additional MUSD and route it into reserve.
- MUSD premium/discount scenarios rotate reserve balances using peg-aware conversion logic.
- Reserve operations support deposit/withdraw management from the app.

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, wagmi, viem.
- **Contracts:** Solidity, Hardhat, Mezo-compatible vault contracts.
- **Tooling:** npm workspaces, Vercel deployment.

## Prerequisites

- Node.js 20+
- npm 9+
- Mezo testnet wallet (for live onchain interaction)

## Environment Variables

| Variable | Scope | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_MEZO_RPC_URL` | `apps/web` | Yes | Mezo RPC URL used by frontend reads/writes. |
| `NEXT_PUBLIC_MEZO_CHAIN_ID` | `apps/web` | Yes | Mezo chain ID for wallet/network checks. |
| `NEXT_PUBLIC_MEZO_EXPLORER_URL` | `apps/web` | Yes | Explorer link base for tx linking. |
| `NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS` | `apps/web` | Yes | Active deployed vault contract address. |
| `NEXT_PUBLIC_OLD_TROVE_PILOT_VAULT_ADDRESS` | `apps/web` | No | Previous vault for migration/withdraw UX. |
| `NEXT_PUBLIC_DEMO_AUTOMATION` | `apps/web` | No (local demo only) | Enables local demo signer flow for BTC Up/Down. |
| `DEMO_AUTOMATION_ENABLED` | `apps/web` | No (local demo only) | Enables the server-side demo API routes. |
| `DEMO_BORROWER_PRIVATE_KEY` | `apps/web` | Yes (monitoring) | Server-only key for the borrower whose trove is monitored. |
| `MONITOR_DRY_RUN` | `apps/web` | No | Transactions remain disabled unless explicitly set to `0`. |
| `ORACLE_POLL_INTERVAL_MS` | `apps/web` | No | HTTP RPC new-block polling interval; defaults to 5000 ms. |
| `MEZO_RPC_URL` | `contracts` | Yes (deploy/write) | RPC URL used by Hardhat scripts. |
| `MEZO_CHAIN_ID` | `contracts` | Yes (deploy/write) | Chain ID used by Hardhat network config. |
| `MEZO_PRIVATE_KEY` | `contracts` | Yes (deploy/write) | Deployer private key (never commit). |
| `TROVE_PILOT_VAULT_ADDRESS` | `contracts` | No | Existing deployed vault address for script ops. |
| `MOCK_MARKET_ORACLE_ADDRESS` | `contracts` | No | Optional oracle address used by deploy/script flows. |

## Installation & Quick Start

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp contracts/.env.example contracts/.env
```

Run frontend:

```bash
npm run web:dev
```

Useful contract commands:

```bash
npm run contracts:compile
npm run contracts:test
npm run contracts:deploy:mezo
```

## Repository Structure

```text
trovepilot/
├─ apps/
│  └─ web/                 # Next.js app (dashboard, vault, rules, sim, timeline)
├─ contracts/
│  ├─ contracts/           # Solidity vault contracts
│  ├─ scripts/             # Deployment / operational scripts
│  └─ test/                # Hardhat tests
├─ package.json            # Workspace scripts
└─ README.md
```

## Architecture Overview

- **Web app (`apps/web`)** reads trove/reserve state, configures rules, and triggers automation actions.
- **Vault contracts (`contracts/contracts`)** hold and coordinate reserve accounting plus action execution logic.
- **Mezo protocol integration** provides trove debt/collateral capacity data and borrow/repay operations.
- **Automation model:** target-ICR stabilization + reserve lane coordination under BTC and peg regime changes.

## Oracle-Driven Collateral Monitoring

The always-on listener in `apps/web/scripts/collateral-listener.ts` watches for each new Mezo
block. Mezo's native BTC/USD oracle is updated every block, so a new block is the reliable trigger;
the public oracle documentation does not guarantee a dedicated price-change event log. On every
new block, the listener reads the protocol BTC price and the configured borrower's live collateral,
debt, reserve, and onchain rules. It then:

- runs the existing BTC-down reserve withdrawal and repayment flow below `bandLowerICR`,
- runs the existing BTC-up mint, approval, and reserve deposit flow above `bandUpperICR`,
- or skips when the ICR is within the configured band or the applicable rule is disabled.

The listener and demo API routes share the same server-side calculations, insert-hint generation,
transaction simulation, and transaction execution helpers. The listener always uses the live
protocol price and never writes a simulated price.

Checks are single-flight: a new block is skipped while the previous check or transaction is still
running. The supplied `systemd` unit also uses Linux `flock`, ensuring only one listener process
can run on the VPS.

### Local testing

Fill `apps/web/.env.local`, keep `MONITOR_DRY_RUN=1`, and run:

```bash
npm -w apps/web exec -- tsx --env-file=.env.local scripts/collateral-listener.ts
```

Stop it with `Ctrl+C`. Confirm the structured logs contain block number, check time, BTC price,
price direction, ICR, thresholds, intended action, skipped-run reason, and no transaction hash.

### Ubuntu systemd deployment

The service file assumes the repository is installed at `/opt/trovepilot` and runs under a
dedicated `trovepilot` system user.

```bash
sudo useradd --system --home /opt/trovepilot --shell /usr/sbin/nologin trovepilot
sudo mkdir -p /opt/trovepilot
sudo chown -R trovepilot:trovepilot /opt/trovepilot
```

Clone or copy this repository into `/opt/trovepilot`, then install locked dependencies:

```bash
cd /opt/trovepilot
sudo -u trovepilot npm ci
```

Create `/etc/trovepilot-monitor.env` with permissions `600`:

```dotenv
NEXT_PUBLIC_MEZO_RPC_URL=https://rpc.test.mezo.org
NEXT_PUBLIC_MEZO_CHAIN_ID=31611
NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS=0x...
DEMO_BORROWER_PRIVATE_KEY=0x...
MONITOR_DRY_RUN=1
ORACLE_POLL_INTERVAL_MS=5000
```

Install and start the service:

```bash
sudo install -m 0644 deploy/trovepilot-monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now trovepilot-monitor
sudo systemctl status trovepilot-monitor
sudo journalctl -u trovepilot-monitor -f
```

Confirm the signer owns the monitored trove, has native BTC for gas, and has configured rules and
reserves. After reviewing dry-run logs, set `MONITOR_DRY_RUN=0` in
`/etc/trovepilot-monitor.env` and restart with:

```bash
sudo systemctl restart trovepilot-monitor
```

`DEMO_BORROWER_PRIVATE_KEY` is server-only. Never prefix it with `NEXT_PUBLIC_`, print it, commit
it, or return it from an API. Restrict the environment file to root, use a dedicated limited-funds
automation wallet, and rotate any credential that may have been exposed.

## Example Usage

1. Connect wallet on Mezo testnet.
2. Open/fund reserve via Vault page.
3. Configure target ICR band and peg thresholds on Rules.
4. Trigger BTC Up/Down or peg actions from Simulation/automation controls.
5. Monitor reserve and debt effects in Dashboard and Timeline.

## Testing Instructions

Run contract test suite:

```bash
npm run contracts:test
```

Lint and type-check frontend:

```bash
npm -w apps/web run lint
npm -w apps/web run typecheck
```

Build frontend:

```bash
npm run web:build
```

## License

No license file is currently included in this repository.
