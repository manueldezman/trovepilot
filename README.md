# TrovePilot

Autopilot for Bitcoin-backed borrowing on Mezo (MUSD troves).

## Repo layout

- `contracts/`: TrovePilotVault + MockMarketOracle (Hardhat)
- `apps/web/`: Demo UI (Next.js)

## Prereqs

- Node.js 20+
- npm 9+

## Setup

```bash
npm install
```

## Environment

Copy the example envs and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp contracts/.env.example contracts/.env
```

## Run web

```bash
npm run web:dev
```

## Contracts

Compile:

```bash
npm run contracts:compile
```

Deploy to Mezo testnet (requires `contracts/.env`):

```bash
npm run contracts:deploy:mezo
```
