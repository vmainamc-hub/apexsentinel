import { Globe, Plus, Sparkles } from "lucide-react";

const EmptyState = () => {
  return (
    <div className="flex-1 px-8 pb-8">
      <div className="dashed-border rounded-2xl panel-bg min-h-[500px] flex flex-col items-center justify-center p-12">
        {/* Globe icon with glow */}
        <div className="w-20 h-20 rounded-2xl gradient-purple flex items-center justify-center glow-purple mb-6 animate-glow-pulse">
          <Globe className="w-10 h-10 text-foreground" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground mb-3">
          No sites yet
        </h2>

        {/* Description */}
        <p className="text-muted-foreground text-center max-w-md mb-8 leading-relaxed">
          Get started by creating your first site. You can customize branding, colors, and deploy it with just a few clicks.
        </p>

        {/* CTA Button */}
        <button className="btn-primary flex items-center gap-2 px-6 py-3 text-base group">
          <Plus className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
          <span>Create Your First Site</span>
          <Sparkles className="w-4 h-4 opacity-70" />
        </button>
      </div>
    </div>
  );
};

export default EmptyState;
