export function formatMaskedMoney(input: {
  readonly masked: boolean;
  readonly decimalString: string;
  readonly currencyCode: string;
}): string {
  if (input.masked) {
    return '••••••';
  }
  const n: number = Number.parseFloat(input.decimalString);
  if (!Number.isFinite(n)) {
    return input.decimalString;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: input.currencyCode }).format(n);
}

export function formatMaskedNumber(input: {
  readonly masked: boolean;
  readonly decimalString: string;
  readonly minimumFractionDigits?: number;
  readonly maximumFractionDigits?: number;
}): string {
  if (input.masked) {
    return '••••';
  }
  const n: number = Number.parseFloat(input.decimalString);
  if (!Number.isFinite(n)) {
    return input.decimalString;
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: input.minimumFractionDigits ?? 2,
    maximumFractionDigits: input.maximumFractionDigits ?? 4,
  }).format(n);
}
