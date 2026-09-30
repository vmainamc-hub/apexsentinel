import clsx from "clsx";
import { observer } from "mobx-react-lite";
import { Outlet } from "react-router-dom";
import { useStore } from "@/hooks/useStore";
import { useDevice } from "@deriv-com/ui";
import Footer from "./footer";
import AppHeader from "./header";
import Body from "./main-body";
import "./layout.scss";

const Layout = observer(() => {
    const { isDesktop } = useDevice();
    const store = useStore();
    const isQuickStrategyActive = store?.quick_strategy?.is_open;

    return (
        <div className={clsx("layout", { responsive: isDesktop, "quick-strategy-active": isQuickStrategyActive && !isDesktop })}>
            <AppHeader />
            <Body><Outlet /></Body>
            {isDesktop && <Footer />}
        </div>
    );
});

export default Layout;
