import type { Metadata } from "next";
import { Alexandria, Tajawal, Manrope } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const display = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

const latin = Manrope({
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fitforgecoaching.com"),
  title: "فيت فورج كوتشينج — برامج تدريبية بخطوات واضحة",
  description:
    "برامج تدريب جاهزة بأسعار تناسب الجميع، شرح بالفيديو لكل تمرين، وخطة واضحة تبدأ بها من أول يوم. تدريب أونلاين متابعة شخصية متاح.",
  alternates: {
    canonical: "https://fitforgecoaching.com",
    languages: { en: "https://fitforgecoaching.com", ar: "https://fitforgecoaching.com/ar" },
  },
  openGraph: {
    title: "فيت فورج كوتشينج — برامج تدريبية بخطوات واضحة",
    description:
      "اختار برنامجك وابدأ رحلتك: خطط تدريب مجرّبة، شرح بالفيديو، وأسعار في المتناول.",
    url: "https://fitforgecoaching.com",
    siteName: "FitForge Coaching",
    images: [{ url: "/logo.png" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} ${latin.variable}`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
