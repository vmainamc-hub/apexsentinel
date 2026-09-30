import { 
  Globe, 
  Link2, 
  Bell, 
  Bot, 
  Headphones, 
  Settings,
  LogOut,
  Sparkles,
  LayoutGrid,
  BarChart3,
  Shield,
  Code
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";

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
  { icon: Code, label: "API Platforms", path: "/api-platforms" },
  { icon: Headphones, label: "Support", path: "/support" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
  { icon: Shield, label: "Admin", path: "/admin", adminOnly: true },
];

const Sidebar = () => {
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
  };

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="hidden lg:flex w-[260px] h-screen sidebar-bg border-r border-sidebar-border flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center glow-purple-subtle">
          <LayoutGrid className="w-4 h-4 text-foreground" />
        </div>
        <div>
          <h1 className="text-foreground font-semibold text-base leading-tight">DerivSites</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Trading Platform</p>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="px-5 pb-4">
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/20 text-primary mt-1">
              <Shield className="w-3 h-3" />
              Admin
            </span>
          )}
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
              
              {/* Notification dot */}
              {item.notification && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-notification-red" />
              )}
              
              {/* Sparkle icon for active */}
              {isActive && (
                <Sparkles className="w-3.5 h-3.5 text-primary ml-auto" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-3">
        {/* Theme toggle */}
        <div className="nav-item justify-between">
          <span className="text-sm text-muted-foreground">Theme</span>
          <div className="w-11 h-6 rounded-full bg-primary/20 relative cursor-pointer">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 rounded-full gradient-purple glow-purple-subtle transition-all duration-200" />
          </div>
        </div>

        {/* Sign Out */}
        <button onClick={handleSignOut} className="nav-item w-full">
          <LogOut className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Sign Out</span>
        </button>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground/60 px-4 pt-2">
          © 2025 DerivSites
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
