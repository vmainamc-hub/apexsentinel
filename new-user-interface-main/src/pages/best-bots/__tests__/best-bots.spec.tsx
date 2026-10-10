jest.mock('@/external/bot-skeleton', () => ({
    load: jest.fn(),
    save_types: { LOCAL: 'local' },
}));

jest.mock('@/hooks/useStore', () => ({
    useStore: jest.fn(),
}));

import { getBestBotsForFolder } from '../best-bots';

describe('Best Bots domain catalogs', () => {
    it('uses Termica-branded names for the TermicaFX folder', () => {
        const bots = getBestBotsForFolder('termicafx.site');

        expect(bots).toHaveLength(15);
        expect(bots.every(bot => bot.name.toLowerCase().includes('termica'))).toBe(true);
        expect(bots[0]).toMatchObject({
            name: 'Termica Pro Bot',
            file: 'D1-BY MR.DUKE(+254702490526).xml',
        });
    });

    it('serves the Apex Sentinel catalogue from its own folder', () => {
        const bots = getBestBotsForFolder('apex-sentinel');

        expect(bots.map(bot => bot.name)).toEqual(['grffy v1', 'Mr Duke Speed Bot.1', 'Wealth Generator']);
        expect(bots.every(bot => bot.file.endsWith('.xml'))).toBe(true);
    });

    it('no longer resolves the inherited RiskManagers folder', () => {
        expect(getBestBotsForFolder('riskmanagers.site')).toEqual([]);
    });

    it('does not leak another domain catalog for an unknown folder', () => {
        expect(getBestBotsForFolder('future-domain.site')).toEqual([]);
    });
});
