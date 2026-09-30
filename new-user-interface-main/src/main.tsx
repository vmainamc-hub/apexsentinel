import { configure } from 'mobx';
import ReactDOM from 'react-dom/client';
import { performVersionCheck } from './utils/version-check';
import './styles/index.scss';
import { setupDiagnostics } from './utils/diagnostics';

['authToken', 'accountsList', 'clientAccounts', 'callback_token'].forEach(key => localStorage.removeItem(key));
[
    'auth_info',
    'oauth_code_verifier',
    'oauth_code_verifier_timestamp',
    'oauth_csrf_token',
    'oauth_csrf_token_timestamp',
].forEach(key => sessionStorage.removeItem(key));

configure({ isolateGlobalState: true });
performVersionCheck();
setupDiagnostics();

const bootstrap = async () => {
    const { AuthWrapper } = await import('./app/AuthWrapper');
    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
};

void bootstrap();
