export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  }
] as const;

export const mockMarketOracleAbi = [
  { type: "function", name: "setBTCPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "setMUSDPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "getBTCPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getMUSDPrice", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;

export const vaultAbi = [
  {
    type: "function",
    name: "depositReserve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "withdrawReserve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getReserveBalance",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "setRules",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "rules",
        type: "tuple",
        components: [
          { name: "minICR", type: "uint256" },
          { name: "repayBps", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "maxReserveUseBps", type: "uint256" },
          { name: "collateralDefenseEnabled", type: "bool" },
          { name: "premiumModeEnabled", type: "bool" },
          { name: "discountModeEnabled", type: "bool" }
        ]
      }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getRules",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "minICR", type: "uint256" },
          { name: "repayBps", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "maxReserveUseBps", type: "uint256" },
          { name: "collateralDefenseEnabled", type: "bool" },
          { name: "premiumModeEnabled", type: "bool" },
          { name: "discountModeEnabled", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "previewCollateralDefense",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "repayAmount", type: "uint256" },
      { name: "oldICR", type: "uint256" },
      { name: "newNICR", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "executeCollateralDefense",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: []
  },
  { type: "function", name: "executePremiumResponse", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "executeDiscountResponse", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "event", name: "ReserveDeposited", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "token", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "ReserveWithdrawn", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "token", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "RulesUpdated", inputs: [{ indexed: true, name: "user", type: "address" }], anonymous: false },
  {
    type: "event",
    name: "CollateralDefenseExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "repayAmount", type: "uint256" },
      { indexed: false, name: "oldICR", type: "uint256" },
      { indexed: false, name: "newICR", type: "uint256" }
    ],
    anonymous: false
  },
  { type: "event", name: "PremiumResponseExecuted", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "musdPrice", type: "uint256" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "DiscountResponseExecuted", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "musdPrice", type: "uint256" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false }
] as const;
