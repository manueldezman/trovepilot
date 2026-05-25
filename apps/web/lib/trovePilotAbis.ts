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
  { type: "function", name: "getSafetyReserve", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getOpportunityReserve", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getOpportunityMusdAcquired", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "setRules",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "rules",
        type: "tuple",
        components: [
          { name: "safetyICR", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "maxReserveUseBps", type: "uint256" },
          { name: "safetyReserveBps", type: "uint256" },
          { name: "opportunityReserveBps", type: "uint256" },
          { name: "safetyEnabled", type: "bool" },
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
          { name: "safetyICR", type: "uint256" },
          { name: "premiumThreshold", type: "uint256" },
          { name: "discountThreshold", type: "uint256" },
          { name: "maxReserveUseBps", type: "uint256" },
          { name: "safetyReserveBps", type: "uint256" },
          { name: "opportunityReserveBps", type: "uint256" },
          { name: "safetyEnabled", type: "bool" },
          { name: "premiumEnabled", type: "bool" },
          { name: "discountEnabled", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "previewAutomation",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "needsSafetyRepay", type: "bool" },
      { name: "repayAmount", type: "uint256" },
      { name: "icr", type: "uint256" },
      { name: "btcPrice", type: "uint256" },
      { name: "musdPrice", type: "uint256" },
      { name: "premiumActive", type: "bool" },
      { name: "discountActive", type: "bool" }
    ]
  },
  {
    type: "function",
    name: "previewSafety",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "triggered", type: "bool" },
      { name: "repayAmount", type: "uint256" },
      { name: "icr", type: "uint256" },
      { name: "btcPrice", type: "uint256" },
      { name: "safetyICR", type: "uint256" },
      { name: "safetyReserveBalance", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "previewPeg",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "musdPrice", type: "uint256" },
      { name: "premiumActive", type: "bool" },
      { name: "discountActive", type: "bool" },
      { name: "premiumThreshold", type: "uint256" },
      { name: "discountThreshold", type: "uint256" },
      { name: "opportunityReserveBalance", type: "uint256" },
      { name: "estGain", type: "uint256" },
      { name: "estSavings", type: "uint256" }
    ]
  },
  { type: "function", name: "setSimulatedBTCPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "setSimulatedMUSDPrice", stateMutability: "nonpayable", inputs: [{ name: "price", type: "uint256" }], outputs: [] },
  { type: "function", name: "resetSimulatedMarket", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "getSimulatedBTCPrice", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getSimulatedMUSDPrice", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "runAutomation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "runSafety",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "deadline", type: "uint256" }
    ],
    outputs: []
  },
  { type: "function", name: "runPeg", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "event", name: "ReserveDeposited", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "token", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "ReserveWithdrawn", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: true, name: "token", type: "address" }, { indexed: false, name: "amount", type: "uint256" }], anonymous: false },
  { type: "event", name: "RulesUpdated", inputs: [{ indexed: true, name: "user", type: "address" }], anonymous: false },
  { type: "event", name: "RiskStateEvaluated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "icr", type: "uint256" }, { indexed: false, name: "safetyTriggered", type: "bool" }], anonymous: false },
  {
    type: "event",
    name: "SafetyRepayExecuted",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "repayAmount", type: "uint256" },
      { indexed: false, name: "icrBefore", type: "uint256" },
      { indexed: false, name: "icrAfter", type: "uint256" }
    ],
    anonymous: false
  },
  { type: "event", name: "PremiumSimulated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "musdPrice", type: "uint256" }, { indexed: false, name: "notional", type: "uint256" }, { indexed: false, name: "estGain", type: "uint256" }], anonymous: false },
  {
    type: "event",
    name: "DiscountSimulated",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "musdPrice", type: "uint256" },
      { indexed: false, name: "spend", type: "uint256" },
      { indexed: false, name: "musdAcquired", type: "uint256" },
      { indexed: false, name: "estSavings", type: "uint256" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "SafetyRan",
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
    name: "PegRan",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "musdPrice", type: "uint256" },
      { indexed: false, name: "premiumActive", type: "bool" },
      { indexed: false, name: "discountActive", type: "bool" }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "AutomationRan",
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "btcPrice", type: "uint256" },
      { indexed: false, name: "musdPrice", type: "uint256" },
      { indexed: false, name: "icrBefore", type: "uint256" },
      { indexed: false, name: "icrAfter", type: "uint256" },
      { indexed: false, name: "safetyBefore", type: "uint256" },
      { indexed: false, name: "safetyAfter", type: "uint256" },
      { indexed: false, name: "oppBefore", type: "uint256" },
      { indexed: false, name: "oppAfter", type: "uint256" },
      { indexed: false, name: "mask", type: "uint256" }
    ],
    anonymous: false
  },
  { type: "event", name: "SimulatedMarketUpdated", inputs: [{ indexed: true, name: "user", type: "address" }, { indexed: false, name: "btcPrice", type: "uint256" }, { indexed: false, name: "musdPrice", type: "uint256" }], anonymous: false }
] as const;
