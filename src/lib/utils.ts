let cryptoObj: Crypto | undefined;

function getCrypto(): Crypto | undefined {
  if (typeof window === "undefined") return undefined;
  return window.crypto;
}

export function uuid(): string {
  cryptoObj = getCrypto();
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatMoney(
  amount: number,
  currency = "EGP",
  lang: "en" | "ar" = "en"
): string {
  if (currency === "EGP") {
    const grouped = amount.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
    return lang === "ar" ? `${grouped} ج.م` : `LE ${grouped}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function classNames(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
