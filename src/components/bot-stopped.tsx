import React from 'react';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import { navigateToUrl, reloadPage } from '@/utils/navigation-utils';
import { generateUrlWithRedirect } from '@/utils/url-redirect-utils';
import { Localize, localize } from '@deriv-com/translations';
import Dialog from './shared_ui/dialog';
import { standalone_routes } from './shared';

const BotStopped = observer(() => {
    const { dashboard } = useStore();
    const { is_web_socket_intialised } = dashboard;
    const onClickClose = () => {
        reloadPage();
    };
    return (
        <Dialog
            is_visible={!is_web_socket_intialised}
            is_mobile_full_width
            className={'dc-dialog bot-stopped-dialog'}
            cancel_button_text={localize('Go to Reports')}
            confirm_button_text={localize('Back to Bot')}
            onCancel={() => navigateToUrl(generateUrlWithRedirect(standalone_routes.positions))}
            onConfirm={reloadPage}
            login={() => {}} // Empty function as login is not needed for this dialog
        >
            <div className='dc-dialog__content__header'>
                <Text data-testid='data-title' weight='bold' as='p' align='left' size='s' color='prominent'>
                    <Localize i18n_default_text="You're back online" />
                </Text>
                <div
                    data-testid='data-close-button'
                    onClick={onClickClose}
                    onKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                            e.preventDefault();
                            onClickClose();
                        }
                    }}
                    role='button'
                    aria-label={localize('Close')}
                    tabIndex={0}
                >
                    <span aria-hidden='true' style={{ fontSize: '20px', lineHeight: 1 }}>
                        ×
                    </span>
                </div>
            </div>
            <Text as='p' align='left' size='xs' color='prominent'>
                <Localize i18n_default_text='The bot has stopped, but your trade may still be running. You can check it on the Reports page.' />
            </Text>
        </Dialog>
    );
});

export default BotStopped;
