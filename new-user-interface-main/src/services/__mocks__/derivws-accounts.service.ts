// Mock for DerivWSAccountsService
export const DerivWSAccountsService = {
    fetchAccountsList: jest.fn(),
    storeAccounts: jest.fn(),
    getStoredAccounts: jest.fn(),
    clearStoredAccounts: jest.fn(),
    clearCache: jest.fn(),
    fetchOTPWebSocketURL: jest.fn(),
    getAuthenticatedWebSocketURL: jest.fn(),
    createAuthorizationURL: jest.fn(),
    getSession: jest.fn(),
    logout: jest.fn(),
};
