import { Snowflake, Gift, TreePine, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const HolidayMaintenance = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a1f2e] via-[#0f1419] to-[#1a1f2e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated snowflakes background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <Snowflake
            key={i}
            className="absolute text-white/20 animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              width: `${12 + Math.random() * 16}px`,
              height: `${12 + Math.random() * 16}px`,
            }}
          />
        ))}
      </div>

      <Card className="max-w-2xl w-full bg-card/95 backdrop-blur-sm border-primary/20 shadow-2xl relative z-10">
        <CardContent className="p-8 md:p-12 text-center space-y-6">
          {/* Holiday icons */}
          <div className="flex justify-center items-center gap-4 text-primary">
            <TreePine className="h-10 w-10 text-green-500" />
            <Gift className="h-12 w-12 text-red-500 animate-bounce" />
            <TreePine className="h-10 w-10 text-green-500" />
          </div>

          {/* Main greeting */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-red-400 via-green-400 to-red-400 bg-clip-text text-transparent">
              Merry Christmas & Happy New Year!
            </h1>
            <div className="flex justify-center">
              <PartyPopper className="h-6 w-6 text-yellow-500" />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-4 text-muted-foreground">
            <p className="text-lg">
              Thank you for the overwhelming response! We've received a tremendous number of website requests during this festive season.
            </p>
            
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <p className="text-foreground font-medium">
                🎄 Platform access is temporarily paused while we process all submitted applications.
              </p>
            </div>

            <p>
              Our team is taking a well-deserved break during the holidays while also working hard to process all your requests. We'll be back within <span className="text-primary font-semibold">3 to 4 days</span>.
            </p>

            <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
              <p className="text-yellow-200/90">
                📝 <strong>Note:</strong> If you left your site in draft mode, don't worry! You'll be able to complete your application when we return.
              </p>
            </div>

            <p className="text-sm italic">
              We appreciate your patience and wish you a wonderful holiday season!
            </p>
          </div>

          {/* Footer decoration */}
          <div className="flex justify-center gap-2 pt-4">
            <span className="text-2xl">🎅</span>
            <span className="text-2xl">🎁</span>
            <span className="text-2xl">⛄</span>
            <span className="text-2xl">🎄</span>
            <span className="text-2xl">✨</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HolidayMaintenance;
