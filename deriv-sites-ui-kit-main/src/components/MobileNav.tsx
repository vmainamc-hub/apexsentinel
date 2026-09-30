import { useState } from "react";
import { Menu, Globe, Link2, Bell, Bot, Headphones, Settings, LogOut, LayoutGrid, Sparkles, BarChart3, Shield } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  notification?: boolean;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: Globe, label: "Sites", path: "/" },
  { icon: Link2, label: "Domains", path: "/domains" },
  { icon: Bot, label: "XML Bots", path: "/xml-bots" },
  { icon: Headphones, label: "Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
  { icon: Shield, label: "Admin", path: "/admin", adminOnly: true },
];

const MobileNav = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useAdminRole();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
    navigate('/auth');
    setOpen(false);
  };

  const handleNavClick = () => {
    setOpen(false);
  };

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50 sidebar-bg border-b border-sidebar-border">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center glow-purple-subtle">
            <LayoutGrid className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h1 className="text-foreground font-semibold text-sm leading-tight">DerivSites</h1>
            <p className="text-muted-foreground text-xs">Trading Platform</p>
          </div>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Menu className="w-6 h-6 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[280px] sidebar-bg border-l border-sidebar-border p-0">
            <div className="flex flex-col h-full">
              {/* User info */}
              {user && (
                <div className="px-5 py-4 border-b border-sidebar-border">
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              )}

              {/* Navigation */}
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {filteredNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      onClick={handleNavClick}
                      className={cn(
                        "nav-item relative",
                        isActive && "nav-item-active"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isActive ? "gradient-purple glow-purple-subtle" : "bg-muted/50"
                      )}>
                        <item.icon className={cn(
                          "w-4 h-4",
                          isActive ? "text-foreground" : "text-muted-foreground"
                        )} />
                      </div>
                      <span className={cn(
                        "text-sm font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {item.label}
                      </span>
                      
                      {item.notification && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-notification-red" />
                      )}
                      
                      {isActive && (
                        <Sparkles className="w-3.5 h-3.5 text-primary ml-auto" />
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom section */}
              <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
                <button onClick={handleSignOut} className="nav-item w-full">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Sign Out</span>
                </button>

                <p className="text-xs text-muted-foreground/60 px-4 pt-2">
                  © 2025 DerivSites
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default MobileNav;
