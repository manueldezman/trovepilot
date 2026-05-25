import { type Address } from "viem";

function asAddress(v: string | undefined): Address | null {
  if (!v) return null;
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) return null;
  return v as Address;
}

export const addresses = {
  vault: asAddress(process.env.NEXT_PUBLIC_TROVE_PILOT_VAULT_ADDRESS)
};
