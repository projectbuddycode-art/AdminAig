/** Integer minor units as a fixed two-decimal major-unit string. */
export function decimalFromCents(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error("Money amounts must be integer cents.");
  }
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const major = Math.floor(absolute / 100);
  const minor = absolute % 100;
  return `${negative ? "-" : ""}${major}.${String(minor).padStart(2, "0")}`;
}
