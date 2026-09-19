import { observer } from 'mobx-react-lite';
import { localize } from '@deriv-com/translations';
import './menu-items.scss';

const items=[
 {href:'/',label:localize('Dashboard')},
 {href:'/bot-builder',label:localize('Bot Builder')},
 {href:'/bot-store',label:localize('Bot Store')},
 {href:'/dtrader',label:localize('DTrader')},
 {href:'/sentinel-forge',label:localize('Sentinel Forge')},
 {href:'/charts',label:localize('Charts')},
 {href:'/tutorials',label:localize('Tutorials')},
];

export const MenuItems=observer(()=> <nav className="sentinel-main-nav" aria-label="Main navigation">{items.map(item=><a key={item.href} href={item.href}>{item.label}</a>)}</nav>);
export const TradershubLink=observer(()=>null);
type MenuItemsType=typeof MenuItems & {TradershubLink:typeof TradershubLink};
(MenuItems as MenuItemsType).TradershubLink=TradershubLink;
export default MenuItems as MenuItemsType;