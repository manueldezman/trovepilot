export const mezoTroveManagerAbi = [
  { type: "function", name: "getTroveColl", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getTroveDebt", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getCurrentICR",
    stateMutability: "view",
    inputs: [
      { name: "borrower", type: "address" },
      { name: "price", type: "uint256" }
    ],
    outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] }
] as const;

export const mezoPriceFeedAbi = [{ type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const;

export const mezoBorrowerOperationsSignaturesAbi = [
  { type: "function", name: "getNonce", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] }
] as const;
