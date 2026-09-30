import { ArrowRight, Bot, Check, CreditCard, Globe, Palette, Rocket, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingHeroProps {
  onGetStarted: () => void;
}

const plans = [
  {
    name: "Partnership monthly",
    price: "17%",
    description: "A monthly platform share for traders who want lower upfront cost.",
  },
  {
    name: "One-time setup",
    price: "KES 25,000",
    description: "A single payment for customers who prefer to settle setup once.",
  },
];

const workflow = [
  { icon: CreditCard, title: "Choose plan", text: "Pick 17% monthly partnership or KES 25,000 one-time." },
  { icon: Palette, title: "Design the site", text: "Set colors, branding and preview the public trader experience." },
  { icon: Bot, title: "Import free bots", text: "Upload XML bots that appear on the Free Bots page." },
  { icon: Globe, title: "Configure domain", text: "Set the domain, callback URL and deploy through Netlify." },
];

const LandingHero = ({ onGetStarted }: LandingHeroProps) => {
  return (
    <div className="flex-1 bg-slate-50 px-4 pb-12 text-slate-950 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl pt-8">
        <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800">
              <Settings2 className="h-3.5 w-3.5" />
              Site manager workflow
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-5xl">
              Build each trader site first. Take payment at the end.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              The manager now guides every customer through plan choice, branding, live preview,
              free bot import, Deriv tools and domain setup before the final payment and publish step.
            </p>
          </div>
          <Button onClick={onGetStarted} size="lg" className="h-11 rounded-md">
            Start setup
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {plans.map(plan => (
            <div key={plan.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-slate-950">{plan.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
                </div>
                <span className="text-3xl font-semibold text-slate-950">{plan.price}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            );
          })}
        </div>

        <section className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-emerald-950">What changed</h2>
              <div className="mt-3 grid gap-2 text-sm text-emerald-800 sm:grid-cols-2">
                {["Two payment choices only", "Setup happens before payment", "Payment moved to final step", "GitHub and Netlify publish remains after payment"].map(item => (
                  <div key={item} className="flex items-center gap-2"><Check className="h-4 w-4" />{item}</div>
                ))}
              </div>
            </div>
            <Rocket className="hidden h-10 w-10 text-emerald-700 md:block" />
          </div>
        </section>
      </section>
    </div>
  );
};

export default LandingHero;
