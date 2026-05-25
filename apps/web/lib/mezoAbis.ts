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
  { type: "function", name: "getTroveStatus", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "getTroveMaxBorrowingCapacity",
    stateMutability: "view",
    inputs: [{ name: "borrower", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const mezoPriceFeedAbi = [{ type: "function", name: "fetchPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const;

export const mezoBorrowerOperationsSignaturesAbi = [
  { type: "function", name: "getNonce", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] }
] as const;

export const mezoBorrowerOperationsAbi = [
  {
    type: "function",
    name: "openTrove",
    stateMutability: "payable",
    inputs: [
      { name: "_debtAmount", type: "uint256" },
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "addColl",
    stateMutability: "payable",
    inputs: [
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "withdrawMUSD",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_amount", type: "uint256" },
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "refinance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_upperHint", type: "address" },
      { name: "_lowerHint", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "borrowingRate",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "minNetDebt",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const mezoHintHelpersAbi = [
  {
    type: "function",
    name: "computeNominalCR",
    stateMutability: "view",
    inputs: [
      { name: "_coll", type: "uint256" },
      { name: "_debt", type: "uint256" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "getApproxHint",
    stateMutability: "view",
    inputs: [
      { name: "_CR", type: "uint256" },
      { name: "_numTrials", type: "uint256" },
      { name: "_inputRandomSeed", type: "uint256" }
    ],
    outputs: [
      { name: "hintAddress", type: "address" },
      { name: "diff", type: "uint256" },
      { name: "latestRandomSeed", type: "uint256" }
    ]
  }
] as const;

export const mezoSortedTrovesAbi = [
  {
    type: "function",
    name: "findInsertPosition",
    stateMutability: "view",
    inputs: [
      { name: "_NICR", type: "uint256" },
      { name: "_prevId", type: "address" },
      { name: "_nextId", type: "address" }
    ],
    outputs: [
      { name: "prevId", type: "address" },
      { name: "nextId", type: "address" }
    ]
  }
] as const;
