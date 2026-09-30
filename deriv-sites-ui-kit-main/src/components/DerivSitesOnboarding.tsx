import { ArrowLeft, ArrowRight, Bot, CreditCard, Globe, Palette, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Plan = "partnership_monthly" | "one_time";

const plans: Array<{ key: Plan; title: string; price: string; helper: string; points: string[] }> = [
  {
    key: "partnership_monthly",
    title: "Partnership monthly",
    price: "17%",
    helper: "Monthly platform share after the website is ready.",
    points: ["Best for lower upfront cost", "Setup proceeds before payment", "Final payment checkpoint remains required"],
  },
  {
    key: "one_time",
    title: "One-time setup",
    price: "KES 25,000",
    helper: "Single setup payment collected at the end.",
    points: ["Best for established site owners", "No monthly platform share", "Final payment checkpoint remains required"],
  },
];

const workflow = [
  { icon: Palette, title: "Brand colors", text: "Choose the site colors and preview the trader UI." },
  { icon: Bot, title: "Free bots", text: "Import XML bots that show on the public Free Bots page." },
  { icon: ShieldCheck, title: "Deriv tools", text: "Select tools and configure the Deriv app scopes." },
  { icon: Globe, title: "Domain", text: "Connect the domain after the site details are ready." },
];

const DerivSitesOnboarding = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<Plan>("partnership_monthly");
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="flex-1 bg-slate-50 px-4 pb-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl pt-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">Start a customer site</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Choose the commercial model now, then configure the site. Payment is collected only after brand, bots, tools and domain are ready.
              </p>
            </div>
            <div className="rounded-md border border-slate-200 px-4 py-3 text-sm">
              <span className="text-slate-500">Payment timing</span>
              <p className="font-semibold">End of wizard</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {plans.map(plan => (
              <button
                key={plan.key}
                onClick={() => setSelectedPlan(plan.key)}
                className={`rounded-lg border p-5 text-left transition ${selectedPlan === plan.key ? "border-sky-500 bg-sky-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">{plan.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{plan.helper}</p>
                  </div>
                  <span className="text-3xl font-semibold">{plan.price}</span>
                </div>
                <ul className="mt-5 space-y-2">
                  {plan.points.map(point => (
                    <li key={point} className="flex items-center gap-2 text-sm text-slate-600">
                      <CreditCard className="h-4 w-4 text-sky-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {workflow.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-md border border-slate-200 p-4">
                  <Icon className="mb-3 h-4 w-4 text-slate-700" />
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{item.text}</p>
                </div>
              );
            })}
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-4 text-sm">
            <Checkbox checked={agreed} onCheckedChange={checked => setAgreed(checked === true)} className="mt-0.5" />
            <span className="text-slate-600">
              I understand this creates a setup draft first. The selected payment option is confirmed at the final wizard step before publishing.
            </span>
          </label>

          <div className="mt-6 flex justify-end">
            <Button disabled={!agreed} onClick={() => navigate("/domains")} className="rounded-md">
              Continue to domain and site setup
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DerivSitesOnboarding;
