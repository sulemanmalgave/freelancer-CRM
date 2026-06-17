import { Client, Project, Invoice, Lead } from "./types";

export function formatCurrency(amount: number, currencyCode: string): string {
  const code = (currencyCode || "USD").toUpperCase();
  let symbol = "$";
  if (code === "INR") symbol = "₹";
  else if (code === "EUR") symbol = "€";
  else if (code === "GBP") symbol = "£";
  else if (code === "JPY") symbol = "¥";
  else if (code === "CAD" || code === "AUD") symbol = "A$";

  return `${symbol}${amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function detectLocale(): { country: string; currency: string; symbol: string } {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const locale = navigator.language || "";

    if (
      tz.includes("Kolkata") ||
      tz.includes("Calcutta") ||
      tz.includes("Asia/Kochi") ||
      locale.includes("IN")
    ) {
      return { country: "IN", currency: "INR", symbol: "₹" };
    }
  } catch (e) {
    console.error("Locale detection failed, falling back to US", e);
  }

  return { country: "US", currency: "USD", symbol: "$" };
}

// Generate unique IDs
export function generateUUID(): string {
  try {
    return window.crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
