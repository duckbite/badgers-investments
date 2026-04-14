export type InstrumentDisplayInput = {
  readonly name: string;
  readonly symbol: string;
  readonly fallbackId?: string;
};

/** Primary list/chart label: "Company name (TICKER)". */
export function formatInstrumentDisplayLabel(input: InstrumentDisplayInput): string {
  const sym: string = input.symbol.trim();
  const name: string = input.name.trim();
  if (name.length > 0 && sym.length > 0) {
    return `${name} (${sym})`;
  }
  if (name.length > 0) {
    return name;
  }
  if (sym.length > 0) {
    return sym;
  }
  return input.fallbackId ?? '—';
}
