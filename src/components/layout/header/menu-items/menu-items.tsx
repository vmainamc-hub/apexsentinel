// ========================================
// MENU ITEMS PLACEHOLDER FOR WHITE-LABELING
// ========================================
//
// This component is intentionally a no-op. The app's one real navigation is
// the tab bar in src/pages/main/main.tsx (Dashboard | Bot Builder | Bot Store
// | DTrader | Sentinel Forge | Charts | Tutorials). A duplicate copy of that
// same list was previously rendered here as a second header row during the
// Sentinel Forge integration — do not resurrect it; it produces two stacked
// navigation layers showing the same links. See git history of this file at
// commit 655245c for the original (pre-integration) version this restores.
//
// Third-party developers can add custom menu items here.
//
// EXAMPLE USAGE:
// --------------
// import { observer } from 'mobx-react-lite';
// import { useStore } from '@/hooks/useStore';
// import { useTranslations } from '@deriv-com/translations';
// import { MenuItem, Text } from '@deriv-com/ui';
//
// export const MenuItems = observer(() => {
//     const { localize } = useTranslations();
//     const store = useStore();
//     const is_logged_in = store?.client?.is_logged_in ?? false;
//
//     if (!is_logged_in) return null;
//
//     return (
//         <>
//             <MenuItem
//                 as='a'
//                 className='app-header__menu'
//                 href='/your-page'
//                 leftComponent={YourIcon}
//             >
//                 <Text>{localize('Your Menu Item')}</Text>
//             </MenuItem>
//         </>
//     );
// });
//
// For mobile menu items, see:
// src/components/layout/header/mobile-menu/use-mobile-menu-config.tsx

import { observer } from 'mobx-react-lite';

export const MenuItems = observer(() => {
    // No menu items by default - add your custom menu items here
    return null;
});

export const TradershubLink = observer(() => {
    // No default Traders Hub link - add your custom navigation here if needed
    return null;
});

// Create a namespace for MenuItems to include TradershubLink
type MenuItemsType = typeof MenuItems & {
    TradershubLink: typeof TradershubLink;
};

// Assign TradershubLink to MenuItems
(MenuItems as MenuItemsType).TradershubLink = TradershubLink;

export default MenuItems as MenuItemsType;
