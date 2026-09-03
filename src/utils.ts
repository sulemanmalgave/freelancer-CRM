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

// Safely load and recover profile from localStorage
export function loadAndRecoverProfile(): any | null {
  try {
    const cached = localStorage.getItem("crm_profile");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.id) return parsed;
    }

    // Check if there is an alternative profile key in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === "profile" || key.startsWith("crm_profile"))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.id) {
            localStorage.setItem("crm_profile", JSON.stringify(parsed));
            return parsed;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Storage] Error recovering profile:", e);
  }
  return null;
}

// Safely load and recover collection items from localStorage across legacy and workspace-namespaced keys
export function loadAndRecoverCollection<T extends { id: string; freelancerId?: string }>(
  collectionName: string,
  activeFreelancerId: string
): T[] {
  const primaryKey = `crm_${collectionName}_${activeFreelancerId}`;
  const itemsMap = new Map<string, T>();

  // 1. Try primary namespaced key
  try {
    const raw = localStorage.getItem(primaryKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item && item.id) {
            itemsMap.set(item.id, {
              ...item,
              freelancerId: item.freelancerId || activeFreelancerId,
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn(`[Storage] Failed reading primary key ${primaryKey}:`, e);
  }

  // 2. Comprehensive fallback & migration scanner across all localStorage keys
  try {
    const keysToCheck: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        if (
          key === `crm_${collectionName}` ||
          key === collectionName ||
          key.startsWith(`crm_${collectionName}_`)
        ) {
          keysToCheck.push(key);
        }
      }
    }

    keysToCheck.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (item && item.id && !itemsMap.has(item.id)) {
                itemsMap.set(item.id, {
                  ...item,
                  freelancerId: item.freelancerId || activeFreelancerId,
                });
              }
            });
          }
        }
      } catch (e) {
        console.warn(`[Storage] Error inspecting key ${key} during recovery:`, e);
      }
    });
  } catch (e) {
    console.warn("[Storage] Recovery scan encountered an error:", e);
  }

  const consolidatedList = Array.from(itemsMap.values());

  // Resave consolidated list to primary key to maintain consistent single source of truth
  try {
    localStorage.setItem(primaryKey, JSON.stringify(consolidatedList));
  } catch (e) {
    console.warn(`[Storage] Failed caching consolidated ${primaryKey}:`, e);
  }

  return consolidatedList;
}

// Generates and persists a stable client device identifier in localStorage
export function getOrCreatePersistentDeviceId(): string {
  if (typeof window === "undefined") return "dev_default_client";
  try {
    let devId = localStorage.getItem("crm_persistent_device_id");
    if (!devId) {
      const entropy = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      devId = `mob_${entropy}`;
      localStorage.setItem("crm_persistent_device_id", devId);
    }
    return devId;
  } catch {
    return "dev_fallback_client";
  }
}

