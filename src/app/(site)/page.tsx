"use client";

import { useEffect } from "react";
import { HomeHero } from "@/components/site/home/Hero";
import {
  TrustStrip,
  ProgramsSection,
  WhySection,
  ResultsSection,
  HowItWorksHome,
  CoachingSection,
  CoachSection,
  VideoHubSection,
  TestimonialsHome,
  FaqHome,
  FinalCtaHome,
} from "@/components/site/home/Sections";
import { useAdminStore } from "@/lib/demo/admin-store";

export default function HomePage() {
  const setSeed = useAdminStore((s) => s.setSeed);
  useEffect(() => {
    setSeed();
  }, [setSeed]);

  return (
    <>
      <HomeHero />
      <TrustStrip />
      <ProgramsSection />
      <WhySection />
      <ResultsSection />
      <HowItWorksHome />
      <CoachingSection />
      <CoachSection />
      <VideoHubSection />
      <TestimonialsHome />
      <FaqHome />
      <FinalCtaHome />
    </>
  );
}
