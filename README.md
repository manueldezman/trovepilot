# Live Demo

https://trovepilot-web-vo95.vercel.app/

# TrovePilot

TrovePilot is an adaptive reserve coordination layer for Mezo borrowers.

It helps a borrower:
- monitor trove health and reserve state,
- simulate BTC and MUSD market scenarios,
- run BTC-up/BTC-down operational actions,
- rotate reserve liquidity across stability and opportunity lanes.

## Core behavior

- BTC Down scenarios can trigger debt repayment from reserve flow.
- BTC Up scenarios can mint additional MUSD and route it into reserve.
- MUSD premium/discount scenarios rotate reserve balances using peg-aware conversion logic.
- Reserve operations support deposit/withdraw management from the app.

## Tech stack

- `apps/web`: Next.js + wagmi + viem
- `contracts`: Hardhat + Solidity vault contracts

## Repo layout

- `apps/web/` - frontend app
- `contracts/` - smart contracts, tests, deployment scripts

## Prerequisites

- Node.js 20+
- npm 9+

## Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp contracts/.env.example contracts/.env
```

## Run locally

Frontend:

```bash
npm run web:dev
```

Contracts:

```bash
npm run contracts:compile
npm run contracts:test
```

Deploy to Mezo testnet (requires `contracts/.env`):

```bash
npm run contracts:deploy:mezo
```

## Environment notes

Environment variables are only required for local development setup (`apps/web/.env.local` and `contracts/.env`).

For quick product testing, use the live demo link at the top of this README.
