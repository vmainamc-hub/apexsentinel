import { DerivWSAccountsService } from '@/services/derivws-accounts.service';
import { buildBestBotsFileUrl, generateOAuthURL, getDomainConfigForHost } from '../config';

jest.mock('@/services/derivws-accounts.service');

describe('runtime-only site configuration', () => {
    it('does not expose a hardcoded production hostname configuration', () => {
        expect(getDomainConfigForHost('termicafx.site')).toBeUndefined();
        expect(getDomainConfigForHost('riskmanagers.site')).toBeUndefined();
    });

    it('builds an encoded per-site bot URL', () => {
        expect(buildBestBotsFileUrl('site-id', 'My Bot.xml')).toBe('/site-id/My%20Bot.xml');
    });

    it('gets the authorization URL from the central trader gateway', async () => {
        const authorizationUrl = 'https://auth.deriv.com/oauth2/auth?state=server-generated';
        jest.mocked(DerivWSAccountsService.createAuthorizationURL).mockResolvedValue(authorizationUrl);
        await expect(generateOAuthURL()).resolves.toBe(authorizationUrl);
        expect(DerivWSAccountsService.createAuthorizationURL).toHaveBeenCalledWith('/');
    });
});
