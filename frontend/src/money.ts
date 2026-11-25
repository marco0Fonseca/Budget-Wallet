/** Convert a pt-BR monetary input to integer cents without floating-point rounding. */
export function parseBrlAmountCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(trimmed)) return null;
  const normalized = trimmed.replaceAll('.', '');
  if (normalized.length > 20) return null;
  const [reais, centavos = ''] = normalized.split(',');
  const result = BigInt(reais!) * 100n + BigInt(centavos.padEnd(2, '0'));
  return result > 0n && result <= 2_147_483_647n ? Number(result) : null;
}
