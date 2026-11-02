"use client";

import { AnatomyExplorer } from "@/components/three/AnatomyExplorer";
import { SectionHeading } from "@/components/ui/Reveal";
import { useI18n } from "@/lib/i18n";

export default function ExplorePage() {
  const { t } = useI18n();
  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-28 md:py-36">
      <SectionHeading
        eyebrow={t("footer_explore3d")}
        title={t("footer_explore3d")}
        copy={t("demo_content_note")}
      />
      <div className="mt-12">
        <AnatomyExplorer />
      </div>
    </div>
  );
}
