export function formatUSD(value: number, wrapIfNegative = false): string {
  let usd: string;
  if (Math.abs(value) < 10) {
    usd = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  } else {
    usd = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }
  if (wrapIfNegative && value < 0) {
    usd = `(${usd})`;
  }
  return usd;
}

// Deliberately distinct from formatUSD, not a bug to unify: for 1234.56, formatUSD
// yields "$1,235" (thresholded, 0 decimals above $10) while this yields "$1,234.56"
// (always 2 decimals, no threshold). Used only by product/[product]'s route-local
// formatter, which this ports verbatim.
export function formatUsdPrecise(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
