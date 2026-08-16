export const formatUSD = (value: number, wrapIfNegative = false) => {
  let usd;
  if (Math.abs(value) < 10) {
    usd = value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  } else {
    usd =  value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  }
  if (wrapIfNegative && value < 0) {
    usd = `(${usd})`;
  }
  return usd;
};
