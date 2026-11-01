import type { Metadata } from "next";
import {
  Space_Grotesk,
  Inter,
  Instrument_Serif,
  Noto_Kufi_Arabic,
  IBM_Plex_Sans_Arabic,
} from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

const displayAr = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-display-ar",
  display: "swap",
});

const bodyAr = IBM_Plex_Sans_Arabic({
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic"],
  variable: "--font-body-ar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "بلهامدي كوتشينج — برامج تدريب وإشراف شخصي",
  description:
    "برامج تدريب جاهزة وإشراف شخصي متابَع أسبوعيًا. تدريب مبني على العلم، تقدّم يقاس.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body
        className={`${display.variable} ${body.variable} ${serif.variable} ${displayAr.variable} ${bodyAr.variable}`}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
