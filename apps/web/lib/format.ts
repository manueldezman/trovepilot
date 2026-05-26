const TEN = 10n;

function pow10(exp: number): bigint {
  if (exp <= 0) return 1n;
  return TEN ** BigInt(exp);
}

function ceilDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error("Division by zero");
  if (a >= 0n) return (a + (b - 1n)) / b;
  // For negative numbers, bigint division truncates toward 0, which is already ceil.
  return a / b;
}

export function formatUnitsCeil(value: bigint, decimals: number, fractionDigits: number): string {
  if (fractionDigits < 0) fractionDigits = 0;
  if (fractionDigits > decimals) fractionDigits = decimals;

  const scaleDown = pow10(decimals - fractionDigits);
  const scaled = ceilDiv(value, scaleDown); // integer in 10^fractionDigits units

  const base = pow10(fractionDigits);
  const intPart = scaled / base;
  const fracPart = scaled % base;

  if (fractionDigits === 0) return intPart.toString();
  return `${intPart.toString()}.${fracPart.toString().padStart(fractionDigits, "0")}`;
}

