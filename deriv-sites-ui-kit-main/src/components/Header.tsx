import { Globe } from "lucide-react";

const Header = () => {
  return (
    <header className="flex items-center justify-between py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg gradient-purple flex items-center justify-center glow-purple-subtle">
          <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg sm:text-2xl font-semibold text-foreground">Sites</h1>
          <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Create and manage your Deriv third-party websites</p>
        </div>
      </div>
    </header>
  );
};

export default Header;
