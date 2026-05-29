# TrovePilot

Live demo: https://trovepilot-web-vo95.vercel.app/  
Video demo: https://youtu.be/Aj58RXZ5Bs0  
TrovePilot is an automation layer for Mezo borrowers that stabilizes target ICR and coordinates dual-asset reserves (MUSD + USDC accounting) through BTC volatility and MUSD peg changes.

## Features

- Automated ICR stabilization around user-configurable target/band.
- Dual-lane reserve coordination: Stability Liquidity (MUSD) + Opportunity Liquidity (USDC accounting).
- BTC Up/Down automation flows with reserve-aware debt and mint actions.
- Peg premium/discount reserve rotation logic.
- Vault operations for reserve deposit/withdraw workflows and migration-friendly upgrades.
- Timeline and dashboard views for reserve state and automation activity.

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
| `DEMO_BORROWER_PRIVATE_KEY` | `apps/web` | No (local demo only) | Server-only key for local demo automation route. |
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

Build frontend:

```bash
npm run web:build
```

## License

No license file is currently included in this repository.
