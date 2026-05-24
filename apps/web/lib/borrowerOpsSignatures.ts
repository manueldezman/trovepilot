import { type Address, concatHex, encodeAbiParameters, keccak256, pad, stringToBytes, toHex } from "viem";

const DOMAIN_TYPEHASH = keccak256(stringToBytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));
const SIGNING_DOMAIN_HASH = keccak256(stringToBytes("BorrowerOperationsSignatures"));
const SIGNATURE_VERSION_HASH = keccak256(stringToBytes("1"));

const REPAY_MUSD_TYPEHASH = keccak256(
  stringToBytes("RepayMUSD(uint256 amount,address borrower,uint256 nonce,uint256 deadline)")
);

export function computeRepayMusdDigest(args: {
  amount: bigint;
  borrower: Address;
  nonce: bigint;
  deadline: bigint;
  chainId: number;
  verifyingContract: Address;
}): `0x${string}` {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" }
      ],
      [DOMAIN_TYPEHASH, SIGNING_DOMAIN_HASH, SIGNATURE_VERSION_HASH, BigInt(args.chainId), args.verifyingContract]
    )
  );

  const data = encodeAbiParameters([{ type: "uint256" }, { type: "address" }], [args.amount, args.borrower]);

  const structHash = keccak256(concatHex([REPAY_MUSD_TYPEHASH, data, pad(toHex(args.nonce), { size: 32 }), pad(toHex(args.deadline), { size: 32 })]));

  return keccak256(concatHex(["0x1901", domainSeparator, structHash]));
}

