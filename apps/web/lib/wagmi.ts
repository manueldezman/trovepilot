import { createConfig, http, createStorage, cookieStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { createPublicClient } from "viem";
import { defineChain } from "viem";
import { mezoChainId, mezoRpcUrl, mezoExplorerUrl } from "@/lib/mezo";

const mezoTestnet = defineChain({
  id: mezoChainId,
  name: "Mezo Testnet",
  nativeCurrency: { name: "BTC", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [mezoRpcUrl] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: mezoExplorerUrl } }
});

export const wagmiConfig = createConfig({
  chains: [mezoTestnet],
  connectors: [injected()],
  storage: createStorage({ storage: cookieStorage }),
  transports: {
    [mezoTestnet.id]: http(mezoRpcUrl)
  }
});

export const publicClient = createPublicClient({
  chain: mezoTestnet,
  transport: http(mezoRpcUrl)
});
