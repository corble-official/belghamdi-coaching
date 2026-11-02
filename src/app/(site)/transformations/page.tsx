"use client";

import { TransformationTimeline } from "@/components/site/TransformationTimeline";
import { Reveal } from "@/components/ui/Reveal";
import { useAdminStore } from "@/lib/demo/admin-store";
import { useI18n } from "@/lib/i18n";

export default function TransformationsPage() {
  const { t } = useI18n();
  const transformations = useAdminStore((s) => s.transformations).filter((x) => x.visible);

  return (
    <div className="pt-32 pb-28">
      <div className="max-w-5xl mx-auto px-5 md:px-8 lg:px-10">
        <Reveal>
          <p className="eyebrow mb-4">{t("transformations_q")}</p>
          <h1 className="heading-xl text-balance text-4xl md:text-6xl max-w-3xl">
            {t("transformations_headline")}
          </h1>
          <p className="body-lg mt-5 max-w-2xl">{t("transformations_copy")}</p>
        </Reveal>
        <div className="mt-16">
          <TransformationTimeline items={transformations} />
        </div>
        <p className="text-xs text-muted mt-10 text-center">{t("transformations_note")}</p>
      </div>
    </div>
  );
}
