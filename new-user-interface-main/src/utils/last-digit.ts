/**
 * Last digit of a Deriv tick quote, using the market's pip size so that
 * trailing zeros are preserved (1234.50 -> 0, not 5).
 * `Number(String(q).replace('.', '').slice(-1))` drops the zero and is wrong.
 */
export const lastDigit = (quote: number | string, pipSize?: number): number => {
    const value = Number(quote);
    if (!Number.isFinite(value)) return NaN;
    const decimals = Number.isInteger(pipSize) && (pipSize as number) >= 0 ? (pipSize as number) : (String(quote).split('.')[1] || '').length;
    return Number(value.toFixed(decimals).slice(-1));
};
