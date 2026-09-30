import { Bell, Sparkles } from "lucide-react";

const PlatformUpdates = () => {
  return (
    <div className="flex-1 p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-glow/20 flex items-center justify-center">
            <Bell className="w-6 h-6 text-purple-glow" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Platform Updates</h1>
            <p className="text-muted-foreground text-sm">Stay informed about the latest platform changes</p>
          </div>
        </div>
      </div>

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-glow/10 border border-purple-glow/20 text-purple-glow text-sm mb-8">
        <Sparkles className="w-4 h-4" />
        <span>All platform updates in one place</span>
      </div>

      {/* Empty State */}
      <div className="rounded-2xl border border-dashed border-white/10 bg-panel-bg p-16 flex flex-col items-center justify-center">
        <div className="w-20 h-20 rounded-2xl bg-purple-glow/10 flex items-center justify-center mb-6 animate-pulse-subtle">
          <Bell className="w-10 h-10 text-purple-glow" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">No updates yet</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Future platform updates, new features, and important announcements will appear here. Check back soon!
        </p>
      </div>
    </div>
  );
};

export default PlatformUpdates;
