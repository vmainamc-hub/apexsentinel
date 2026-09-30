import { configure } from 'mobx';
import ReactDOM from 'react-dom/client';
import { initializeRuntimeSiteConfig } from '@/config/runtime-site-config';
// Removed AnalyticsInitializer import - analytics dependency removed
// See migrate-docs/ANALYTICS_IMPLEMENTATION_GUIDE.md for re-implementation
import { performVersionCheck } from './utils/version-check';
import './styles/index.scss';

import { setupDiagnostics } from './utils/diagnostics';

// Migration cleanup: remove every legacy Deriv token-bearing browser key.
['authToken', 'accountsList', 'clientAccounts', 'callback_token'].forEach(key => localStorage.removeItem(key));
[
    'auth_info',
    'oauth_code_verifier',
    'oauth_code_verifier_timestamp',
    'oauth_csrf_token',
    'oauth_csrf_token_timestamp',
].forEach(key => sessionStorage.removeItem(key));

// Configure MobX to handle multiple instances in production builds
configure({ isolateGlobalState: true });

// Perform version check FIRST - before any other operations
performVersionCheck();

// Set up diagnostics for crash monitoring
setupDiagnostics();

// Removed AnalyticsInitializer() call - analytics dependency removed

const bootstrap = async () => {
    await initializeRuntimeSiteConfig();
    const { AuthWrapper } = await import('./app/AuthWrapper');
    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
};

void bootstrap();
