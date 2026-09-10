import { FreelancerProfile } from "../types";

/**
 * ============================================================================
 * GMAIL ENTITLEMENT CONFIGURATION
 * ============================================================================
 * 
 * TEMPORARY TESTING FLAG:
 * Set to `true` during live integration testing so BOTH Free Plan and Pro Plan
 * users can access, connect, read, compose, and test Gmail end-to-end.
 * 
 * TO RESTORE PRODUCTION PRO-ONLY ENFORCEMENT:
 * Simply change `GMAIL_TESTING_OPEN_ACCESS` to `false`.
 * This cleanly re-engages the Pro-only subscription gate across the entire CRM
 * without rewriting or modifying any Gmail integration logic.
 * ============================================================================
 */
export const GMAIL_TESTING_OPEN_ACCESS = false;

/**
 * Determines whether a user profile is on an active Pro plan or has premium status.
 */
export function isProPlanUser(profile?: FreelancerProfile | null): boolean {
  if (!profile) return false;
  return (
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "Annual" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free")
  );
}

/**
 * Checks whether the current user profile is entitled to access and use Gmail.
 * 
 * In TEMPORARY TESTING MODE (`GMAIL_TESTING_OPEN_ACCESS = true`):
 * Returns `true` for both Free and Pro plan users.
 * 
 * When `GMAIL_TESTING_OPEN_ACCESS = false`:
 * Strictly restricts Gmail features to Pro Plan users.
 */
export function canAccessGmail(profile?: FreelancerProfile | null): boolean {
  if (GMAIL_TESTING_OPEN_ACCESS) {
    return true; // Temporarily unlocked for testing on both Free and Pro
  }
  return isProPlanUser(profile);
}

/**
 * Validates Pro entitlement directly against the backend database.
 */
export async function verifyBackendProEntitlement(freelancerId?: string): Promise<boolean> {
  if (!freelancerId) return false;
  try {
    const res = await fetch(`/api/gmail/verify-entitlement?freelancerId=${encodeURIComponent(freelancerId)}`);
    if (res.ok) {
      const data = await res.json();
      return !!data.isPro;
    }
  } catch (err) {
    console.warn("[Entitlement] Backend check error:", err);
  }
  return false;
}
