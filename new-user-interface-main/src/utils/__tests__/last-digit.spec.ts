import { lastDigit } from '../last-digit';

describe('lastDigit', () => {
    it('keeps trailing zeros using pip size', () => {
        expect(lastDigit(1234.5, 2)).toBe(0);
        expect(lastDigit(1234.56, 2)).toBe(6);
        expect(lastDigit(100, 3)).toBe(0);
    });
    it('falls back to the printed decimals without pip size', () => {
        expect(lastDigit('1234.57')).toBe(7);
    });
    it('returns NaN for invalid quotes', () => {
        expect(lastDigit('abc')).toBeNaN();
    });
});
