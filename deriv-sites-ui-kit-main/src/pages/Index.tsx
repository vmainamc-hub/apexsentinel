import Header from "@/components/Header";
import DerivSitesOnboarding from "@/components/DerivSitesOnboarding";
import LandingHero from "@/components/LandingHero";
import { useState } from "react";

const Index = () => {
  const [started, setStarted] = useState(false);

  return (
    <>
      <Header />
      {started ? (
        <DerivSitesOnboarding />
      ) : (
        <LandingHero onGetStarted={() => setStarted(true)} />
      )}
    </>
  );
};

export default Index;
