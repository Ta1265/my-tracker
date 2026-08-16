
export const formatValue = (val: number| null | undefined, format: 'USD' | 'PERCENTAGE', fracDigits?: number) => {
  const value = val || 0;
  const absValue = Math.abs(value);

  if (!fracDigits && format === 'USD') {
    if (absValue >= 1000) {
      fracDigits = 0;
    } else if (absValue >= 1) {
      fracDigits = 2;
    } else if (absValue >= 0.01) {
      fracDigits = 4;
    } else if (absValue >= 0.001) {
      fracDigits = 6;
    } else {
      fracDigits = 8;
    }
    // if (value < 100000) {
      // const integerDigits = Math.floor(value).toString().length;
      // if (integerDigits >= 4) {
      //   fracDigits = 0;
      // } else if (integerDigits >= 2) {
      //   fracDigits = 2
      // } else if (integerDigits >= 1) {
      //   fracDigits = 2;
      // } else {
      //   fracDigits = 5;
      // }
      // fracDigits = Math.max(6 - integerDigits, 0);
    // }
  }
  if (!fracDigits && format === 'PERCENTAGE') {
    fracDigits = 2;
  }

  if (format === 'USD') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: fracDigits,
      maximumFractionDigits: fracDigits,
    });
  }
  return value.toFixed(fracDigits);
}