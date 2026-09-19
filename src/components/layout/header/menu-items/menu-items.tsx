import { observer } from 'mobx-react-lite';
import { useLocation } from 'react-router';
import { localize } from '@deriv-com/translations';
import './menu-items.scss';

// All seven products are tabs rendered inside the single '/' route by
// src/pages/main/main.tsx, selected via a URL hash (see the 'hash' array
// there: dashboard | bot_builder | bot_store | dtrader | sentinel_forge |
// chart | tutorial). Linking any of them to a real path like '/dtrader' 404s,
// because the router only registers '/' and '/preview' — there is no
// standalone route per product.
const items = [
    { hash: 'dashboard', label: localize('Dashboard') },
    { hash: 'bot_builder', label: localize('Bot Builder') },
    { hash: 'bot_store', label: localize('Bot Store') },
    { hash: 'dtrader', label: localize('DTrader') },
    { hash: 'sentinel_forge', label: localize('Sentinel Forge') },
    { hash: 'chart', label: localize('Charts') },
    { hash: 'tutorial', label: localize('Tutorials') },
];

export const MenuItems = observer(() => {
    const location = useLocation();
    const isActive = (item: (typeof items)[number]) =>
        location.pathname === '/' && (location.hash.replace('#', '') || 'dashboard') === item.hash;

    return (
        <nav className='sentinel-main-nav' aria-label='Main navigation'>
            {items.map(item => (
                <a key={item.hash} href={'/#' + item.hash} aria-current={isActive(item) ? 'page' : undefined}>
                    {item.label}
                </a>
            ))}
        </nav>
    );
});
export const TradershubLink=observer(()=>null);
type MenuItemsType=typeof MenuItems & {TradershubLink:typeof TradershubLink};
(MenuItems as MenuItemsType).TradershubLink=TradershubLink;
export default MenuItems as MenuItemsType;
