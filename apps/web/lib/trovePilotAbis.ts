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
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const vaultAbi = [
  // Reserve (MUSD only; USDC is simulated accounting)
  { type: "function", name: "depositReserveMUSD", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdrawReserveMUSD", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "getMusdReserve", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getUsdcReserve", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },

  // Rules
  {
    type: "function",
    name: "setRules",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "rules",
        type: "tuple",
        components: [
          { name: "targetICR", type: "uint256" },
          { name: "bandLowerICR", type: "uint256" },
          { name: "bandUpperICR", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "premiumSellBps", type: "uint256" },
          { name: "discountBuyBps", type: "uint256" },
          { name: "btcDownEnabled", type: "bool" },
          { name: "btcUpEnabled", type: "bool" },
          { name: "premiumEnabled", type: "bool" },
          { name: "discountEnabled", type: "bool" }
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
          { name: "targetICR", type: "uint256" },
          { name: "bandLowerICR", type: "uint256" },
          { name: "bandUpperICR", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "premiumSellBps", type: "uint256" },
          { name: "discountBuyBps", type: "uint256" },
          { name: "btcDownEnabled", type: "bool" },
          { name: "btcUpEnabled", type: "bool" },
          { name: "premiumEnabled", type: "bool" },
          { name: "discountEnabled", type: "bool" }
        ]
      }
    ]
  },

  // Simulated market state (per user)
  { type: "function", name: "setSimulatedBTCPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "setSimulatedMUSDPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "resetSimulatedMarket", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "getSimulatedBTCPrice", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSimulatedMUSDPrice", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },

  // Scenario previews
  {
    type: "function",
    name: "previewBtcDown",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "triggered", type: "bool" },
      { name: "repayAmount", type: "uint256" },
      { name: "icr", type: "uint256" },
      { name: "btcPrice", type: "uint256" },
      { name: "bandLower", type: "uint256" },
      { name: "targetICR", type: "uint256" },
      { name: "musdReserve", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "previewBtcUp",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "triggered", type: "bool" },
      { name: "mintAmount", type: "uint256" },
      { name: "icr", type: "uint256" },
      { name: "btcPrice", type: "uint256" },
      { name: "bandUpper", type: "uint256" },
      { name: "targetICR", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "previewPremium",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "musdPrice", type: "uint256" },
      { name: "sellMusd", type: "uint256" },
      { name: "estUsdcOut", type: "uint256" },
      { name: "musdReserve", type: "uint256" },
      { name: "usdcReserve", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "previewDiscount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "musdPrice", type: "uint256" },
      { name: "spendUsdc", type: "uint256" },
      { name: "estMusdOut", type: "uint256" },
      { name: "musdReserve", type: "uint256" },
      { name: "usdcReserve", type: "uint256" }
    ]
  },

  // Scenario runners
  {
    type: "function",
    name: "runBtcDown",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "runBtcUp",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: []
  },
  { type: "function", name: "runPremium", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "runDiscount", stateMutability: "nonpayable", inputs: [], outputs: [] },

  // Events
  { type: "event", name: "ReserveDeposited", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "ReserveWithdrawn", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  {
    type: "event",
    name: "ReserveAllocated",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "musdIn", type: "uint256" },
      { indexed: false, name: "musdKept", type: "uint256" },
      { indexed: false, name: "usdcAdded", type: "uint256" },
      { indexed: false, name: "musdPrice", type: "uint256" }
    ],
    anonymous: false
  },
  { type: "event", name: "RulesUpdated", inputs: [{ indexed: true, name: "user", type: "address" }], anonymous: false },
  { type: "event", name: "SimulatedMarketUpdated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "btcPrice", type: "uint256" }, { indexed: false, name: "musdPrice", type: "uint256" }], anonymous: false },
  {
    type: "event",
    name: "BtcDownExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "btcPrice", type: "uint256" },
      { indexed: false, name: "icrBefore", type: "uint256" },
      { indexed: false, name: "icrAfter", type: "uint256" },
      { indexed: false, name: "repayAmount", type: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "BtcUpExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "btcPrice", type: "uint256" },
      { indexed: false, name: "icrBefore", type: "uint256" },
      { indexed: false, name: "icrAfter", type: "uint256" },
      { indexed: false, name: "mintAmount", type: "uint256" }
    ],
    anonymous: false
  },
  { type: "event", name: "PremiumRotated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "musdPrice", type: "uint256" }, { indexed: false, name: "sellMusd", type: "uint256" }, { indexed: false, name: "estUsdcOut", type: "uint256" }], anonymous: false },
  { type: "event", name: "DiscountRotated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "musdPrice", type: "uint256" }, { indexed: false, name: "spendUsdc", type: "uint256" }, { indexed: false, name: "estMusdOut", type: "uint256" }], anonymous: false }
] as const;
