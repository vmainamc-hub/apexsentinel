import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useLocation, useNavigate } from 'react-router-dom';
import Tabs from '@/components/shared_ui/tabs/tabs';
import DesktopWrapper from '@/components/shared_ui/desktop-wrapper';
import MobileWrapper from '@/components/shared_ui/mobile-wrapper';
import ChartModal from '../chart/chart-modal';
import Dashboard from '../dashboard';
import BestBots from '../best-bots';
import AutoTrades from '../auto-trades/auto-trades';
import Scanner from '../scanner/scanner';
import Analysistool from '../analysistool';
import TradingViewComponent from '@/components/trading-view-chart/trading-view';
import RunPanel from '../../components/run-panel';
import RunStrategy from '../dashboard/run-strategy';
import DTrader from '../dtrader/dtrader';
import CopyTrading from '../copy-trading/copy-trading';
import Calculator from '../calculator/calculator';
import DigitsAnalysis from '../digits-analysis/digits-analysis';
import { DBOT_TABS, TAB_IDS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './main.scss';

const HASHES = [
    'dashboard',
    'bot_builder',
    'best_bots',
    'dtrader',
    'ai_bots',
    'auto_trades',
    'trading_view',
    'copy_trading',
    'calculator',
    'analysis_tool',
    'digits_analysis',
];

const AppWrapper = observer(() => {
    const { dashboard, run_panel, quick_strategy } = useStore();
    const { active_tab, setActiveTab, active_tour, setActiveTour, setTourDialogVisibility } = dashboard;
    const { is_open } = quick_strategy;
    const { isDesktop } = useDevice();
    const location = useLocation();
    const navigate = useNavigate();

    const tabIndexFromHash = useMemo(() => {
        const hash = location.hash.replace(/^#/, '');
        const index = HASHES.indexOf(hash);
        return index >= 0 ? index : DBOT_TABS.DASHBOARD;
    }, [location.hash]);

    useEffect(() => {
        setActiveTab(tabIndexFromHash);
    }, [setActiveTab, tabIndexFromHash]);

    useEffect(() => {
        const hash = HASHES[active_tab] || HASHES[DBOT_TABS.DASHBOARD];
        if (location.hash.replace(/^#/, '') !== hash) {
            navigate(`${location.search}#${hash}`, { replace: true });
        }
        if (active_tour) setActiveTour('');
        if (is_open) setTourDialogVisibility(false);
        document.body.style.overflow = '';
        document.querySelector('.main__container')?.classList.remove('no-scroll');
    }, [active_tab]);

    const handleTabChange = (index: number) => {
        setActiveTab(index);
        const id = TAB_IDS[index];
        if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0);
    };

    const isRunSurface = active_tab === DBOT_TABS.BOT_BUILDER;

    return (
        <>
            <div className='main'>
                <div className='main__container'>
                    <Tabs active_index={active_tab} className='main__tabs' onTabItemClick={handleTabChange} top>
                        <div label='Dashboard' id='id-dbot-dashboard'>
                            <Dashboard handleTabChange={handleTabChange} />
                        </div>
                        <div label='Bot Builder' id='id-bot-builder' />
                        <div label='Free Bots' id='id-best-bots'>
                            <BestBots />
                        </div>
                        <div label='DTrader' id='id-dtrader'>
                            <DTrader />
                        </div>
                        <div label='AI Bots' id='id-scanner'>
                            <Scanner />
                        </div>
                        <div label='Auto Trades' id='id-auto-trades'>
                            <AutoTrades />
                        </div>
                        <div label='Trading View' id='id-tradingview'>
                            <div className='main__iframe-page'><TradingViewComponent /></div>
                        </div>
                        <div label='Copy Trading' id='id-copy-trading'>
                            <CopyTrading />
                        </div>
                        <div label='Calculator' id='id-calculator'>
                            <Calculator />
                        </div>
                        <div label='Analysis Tool' id='id-analysistool'>
                            <Analysistool />
                        </div>
                        <div label='Digits Analysis' id='id-digits-analysis'>
                            <DigitsAnalysis />
                        </div>
                    </Tabs>
                </div>
            </div>

            <DesktopWrapper>
                {isRunSurface && (
                    <div className='main__run-strategy-wrapper'>
                        <RunStrategy />
                        <RunPanel />
                    </div>
                )}
                <ChartModal />
            </DesktopWrapper>
            <MobileWrapper>{isRunSurface && <RunPanel />}</MobileWrapper>
        </>
    );
});

export default AppWrapper;
