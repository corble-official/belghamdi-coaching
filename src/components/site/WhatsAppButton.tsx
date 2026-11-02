"use client";

import { BUSINESS } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

export function WhatsAppButton() {
  const { t } = useI18n();
  return (
    <a
      href={BUSINESS.whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("wa_float_label")}
      title={t("wa_float_label")}
      className="fixed z-40 bottom-5 flex items-center justify-center h-[52px] w-[52px] rounded-full bg-forest text-white shadow-lg hover:bg-forest/90 hover:scale-105 transition-all"
      style={{ insetInlineEnd: "1.25rem" }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.65-1.57-.9-2.15-.23-.56-.47-.48-.65-.49h-.55c-.2 0-.5.07-.77.35-.27.3-1.02 1-1.02 2.42 0 1.43 1.04 2.81 1.19 3 .15.2 2.05 3.14 4.97 4.4.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.9 6.99c-.01 5.45-4.45 9.88-9.9 9.88m8.43-18.31a11.8 11.8 0 0 0-8.42-3.49C6.15 0 .08 6.06.07 13.51c0 2.38.62 4.71 1.81 6.76L0 24l3.88-1.02a11.88 11.88 0 0 0 5.68 1.45h.01c6.9 0 12.53-5.61 12.54-12.51a12.42 12.42 0 0 0-3.63-8.44" />
      </svg>
    </a>
  );
}
