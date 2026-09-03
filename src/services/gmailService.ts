import { GmailAttachment, GmailEmailMessage, GmailThread } from "../types";
import { verifyBackendProEntitlement } from "./gmailEntitlement";

// In-memory token storage for active session safety (never stored in insecure persistent storage)
let activeAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

// In-memory query cache & in-flight request deduplication map
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const threadCache = new Map<string, CacheEntry<GmailThread[]>>();
const singleThreadCache = new Map<string, CacheEntry<GmailThread>>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 25000; // 25 seconds cache TTL

export function clearGmailCache() {
  threadCache.clear();
  singleThreadCache.clear();
  inFlightRequests.clear();
}

export function getActiveGmailToken(): string | null {
  if (activeAccessToken && Date.now() < tokenExpiresAt) {
    return activeAccessToken;
  }
  // Check sessionStorage as a per-session cache
  try {
    const sessionToken = sessionStorage.getItem("gmail_active_token");
    const sessionExpiry = parseInt(sessionStorage.getItem("gmail_token_expires_at") || "0", 10);
    if (sessionToken && Date.now() < sessionExpiry) {
      activeAccessToken = sessionToken;
      tokenExpiresAt = sessionExpiry;
      return sessionToken;
    }
  } catch (e) {
    console.warn("Could not read token from session storage:", e);
  }
  return null;
}

export function setActiveGmailToken(token: string, expiresInSeconds: number = 3500) {
  activeAccessToken = token;
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  try {
    sessionStorage.setItem("gmail_active_token", token);
    sessionStorage.setItem("gmail_token_expires_at", tokenExpiresAt.toString());
  } catch (e) {
    console.warn("Could not write token to session storage:", e);
  }
}

export function clearActiveGmailToken() {
  activeAccessToken = null;
  tokenExpiresAt = 0;
  clearGmailCache();
  try {
    sessionStorage.removeItem("gmail_active_token");
    sessionStorage.removeItem("gmail_token_expires_at");
  } catch (e) {
    console.warn("Could not clear session storage:", e);
  }
}

export interface GmailProfileResult {
  email: string;
  name?: string;
  picture?: string;
  accessToken: string;
}

/**
 * Dynamically loads Google Identity Services SDK safely if not already present
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).google?.accounts?.oauth2) return resolve();

    const existing = document.getElementById("google-gsi-script") as HTMLScriptElement;
    if (existing) {
      if ((window as any).google?.accounts?.oauth2) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services SDK."));
    document.head.appendChild(script);
  });
}

/**
 * Initiates the Google OAuth token request via Google Identity Services
 */
export async function connectGmailWithGSI(customClientId?: string): Promise<GmailProfileResult> {
  const clientId =
    customClientId ||
    (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
    "446581031176-sp43qc7tblt9n8u8a4hrj1h05rtparor.apps.googleusercontent.com";

  try {
    await loadGsiScript();
  } catch (e) {
    console.warn("Error loading GSI script:", e);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !(window as any).google?.accounts?.oauth2) {
      return reject(
        new Error(
          "Google Identity Services SDK is not yet loaded. Please refresh your browser or check your connection."
        )
      );
    }

    try {
      // Full required scopes for reading, sending, modifying threads and composing messages
      const requiredScopes = [
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" ");

      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: requiredScopes,
        prompt: "select_account consent",
        callback: async (response: any) => {
          if (response.error) {
            console.error("Google OAuth token error:", response);
            return reject(new Error(response.error_description || response.error || "Authentication failed."));
          }

          if (!response.access_token) {
            return reject(new Error("No access token returned from Google."));
          }

          const accessToken = response.access_token;
          const expiresIn = response.expires_in ? parseInt(response.expires_in, 10) : 3500;
          setActiveGmailToken(accessToken, expiresIn);

          // Fetch Google User Info
          try {
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userInfo = await userInfoRes.json();

            resolve({
              accessToken,
              email: userInfo.email || "connected@gmail.com",
              name: userInfo.name || "Connected User",
              picture: userInfo.picture,
            });
          } catch (e) {
            console.warn("Could not fetch user info, using fallback token info:", e);
            resolve({
              accessToken,
              email: "connected@gmail.com",
            });
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      reject(new Error(err.message || "Failed to initialize Google token client."));
    }
  });
}

/**
 * Parses headers from Gmail message
 */
function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}

/**
 * Decodes base64url encoded body from Gmail API
 */
function decodeBase64Url(str: string): string {
  try {
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    return decodeURIComponent(
      Array.prototype.map
        .call(atob(base64), (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    try {
      return atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return "";
    }
  }
}

/**
 * Extracts HTML and plain text bodies from Gmail message payload parts
 */
function extractBody(payload: any): { html: string; text: string } {
  let html = "";
  let text = "";

  if (!payload) return { html, text };

  if (payload.body && payload.body.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === "text/html") {
      html = decoded;
    } else {
      text = decoded;
    }
  }

  if (payload.parts && Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        const nested = extractBody(part);
        if (nested.html) html = nested.html;
        if (nested.text) text = nested.text;
      }
    }
  }

  return { html, text };
}

/**
 * Extracts attachment metadata from Gmail payload parts
 */
function extractAttachments(payload: any): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];
  if (!payload) return attachments;

  const traverse = (part: any) => {
    if (part.filename && part.filename.trim().length > 0) {
      attachments.push({
        id: part.body?.attachmentId || part.partId || `att-${Math.random()}`,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body?.size || 0,
      });
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const p of part.parts) {
        traverse(p);
      }
    }
  };

  traverse(payload);
  return attachments;
}

/**
 * Parse an individual Gmail message object
 */
export function parseGmailMessage(rawMessage: any): GmailEmailMessage {
  const headers = rawMessage.payload?.headers || [];
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const cc = getHeader(headers, "Cc");
  const bcc = getHeader(headers, "Bcc");
  const subject = getHeader(headers, "Subject") || "(No Subject)";
  const date = getHeader(headers, "Date") || new Date().toISOString();
  const labelIds = rawMessage.labelIds || [];
  const isUnread = labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");

  // Extract clean sender name and email
  let fromName = from;
  let fromEmail = from;
  const match = from.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    fromName = match[1].replace(/["']/g, "").trim();
    fromEmail = match[2].trim();
  }

  const { html, text } = extractBody(rawMessage.payload);
  const attachments = extractAttachments(rawMessage.payload);

  return {
    id: rawMessage.id,
    threadId: rawMessage.threadId,
    snippet: rawMessage.snippet || "",
    from,
    fromName,
    fromEmail,
    to,
    cc,
    bcc,
    subject,
    date,
    timestamp: rawMessage.internalDate ? parseInt(rawMessage.internalDate, 10) : new Date(date).getTime(),
    bodyHtml: html,
    bodyText: text || rawMessage.snippet || "",
    isUnread,
    isStarred,
    labelIds,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

/**
 * Normalize Gmail API errors into clean, friendly user messages
 */
function normalizeGmailError(status: number, rawMessage?: string): string {
  if (status === 401) {
    return "Your Gmail connection has expired. Please reconnect.";
  }
  if (status === 403) {
    return "Permission denied by Google. Please ensure necessary Gmail permissions are granted.";
  }
  if (status === 429) {
    return "Gmail rate limit reached. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "Gmail is temporarily unavailable. Please try again.";
  }
  return rawMessage || "Unable to connect to Gmail. Please try again.";
}

/**
 * Fetch thread details by ID (with deduplication & caching)
 */
export async function fetchThreadDetails(threadId: string, customToken?: string): Promise<GmailThread | null> {
  const token = customToken || getActiveGmailToken();
  if (!token) {
    throw new Error("Gmail is not connected. Please connect your account first.");
  }

  // Check cache
  const cached = singleThreadCache.get(threadId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const inflightKey = `thread_${threadId}`;
  if (inFlightRequests.has(inflightKey)) {
    return inFlightRequests.get(inflightKey);
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          clearActiveGmailToken();
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(normalizeGmailError(res.status, err.error?.message));
      }

      const threadData = await res.json();
      const messages: GmailEmailMessage[] = (threadData.messages || []).map((m: any) => parseGmailMessage(m));

      // Sort messages chronologically
      messages.sort((a, b) => a.timestamp - b.timestamp);

      const latestMessage: Partial<GmailEmailMessage> = messages[messages.length - 1] || {};
      const participants = Array.from(new Set(messages.map((m) => m.fromName || m.fromEmail || m.from)));
      const isUnread = messages.some((m) => m.isUnread);
      const isStarred = messages.some((m) => m.isStarred);
      const hasAttachments = messages.some((m) => m.attachments && m.attachments.length > 0);

      const result: GmailThread = {
        id: threadData.id,
        historyId: threadData.historyId,
        snippet: threadData.snippet || latestMessage.snippet || "",
        messages,
        subject: latestMessage.subject || messages[0]?.subject || "(No Subject)",
        lastMessageDate: latestMessage.date || new Date().toISOString(),
        lastMessageTimestamp: latestMessage.timestamp || Date.now(),
        isUnread,
        isStarred,
        hasAttachments,
        participants,
      };

      singleThreadCache.set(threadId, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightRequests.delete(inflightKey);
    }
  })();

  inFlightRequests.set(inflightKey, promise);
  return promise;
}

/**
 * Fetch general or filtered Gmail inbox threads for the dedicated Gmail page
 */
export async function fetchGmailInboxThreads(options: {
  filter?: "all" | "unread" | "starred" | "sent" | "clients";
  searchQuery?: string;
  clientEmails?: string[];
  maxResults?: number;
  customToken?: string;
  forceRefresh?: boolean;
}): Promise<GmailThread[]> {
  const token = options.customToken || getActiveGmailToken();
  if (!token) {
    return [];
  }

  const max = options.maxResults || 20;
  const parts: string[] = [];

  if (options.searchQuery?.trim()) {
    parts.push(options.searchQuery.trim());
  }

  if (options.filter === "unread") {
    parts.push("is:unread");
  } else if (options.filter === "starred") {
    parts.push("is:starred");
  } else if (options.filter === "sent") {
    parts.push("is:sent");
  } else if (options.filter === "clients") {
    const validEmails = (options.clientEmails || []).filter((e) => e && e.includes("@"));
    if (validEmails.length > 0) {
      const emailClauses = validEmails.map((e) => `from:${e} OR to:${e}`).join(" OR ");
      parts.push(`(${emailClauses})`);
    } else {
      return [];
    }
  }

  const query = parts.join(" ");
  const cacheKey = `inbox_${options.filter || "all"}_${query}_${max}`;

  // Check cache if not forcing refresh
  if (!options.forceRefresh) {
    const cached = threadCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Deduplicate in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=${max}`;
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearActiveGmailToken();
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(normalizeGmailError(res.status, err.error?.message));
      }

      const data = await res.json();
      const threadSummaries = data.threads || [];

      if (threadSummaries.length === 0) {
        threadCache.set(cacheKey, { data: [], timestamp: Date.now() });
        return [];
      }

      // Fetch full thread details in parallel (capped at 15 to keep fast)
      const fullThreads = await Promise.all(
        threadSummaries.slice(0, 15).map(async (th: any) => {
          try {
            return await fetchThreadDetails(th.id, token);
          } catch (err) {
            console.warn(`Failed to fetch details for thread ${th.id}:`, err);
            return null;
          }
        })
      );

      const finalThreads = fullThreads.filter((t): t is GmailThread => t !== null);
      threadCache.set(cacheKey, { data: finalThreads, timestamp: Date.now() });
      return finalThreads;
    } catch (err: any) {
      if (err.name === "TypeError" && err.message?.includes("fetch")) {
        throw new Error("Unable to connect to Gmail. Please check your internet connection and try again.");
      }
      throw err;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Fetch relevant client threads (by email address query)
 */
export async function fetchClientThreads(
  clientEmail: string,
  maxResults: number = 8,
  customToken?: string
): Promise<GmailThread[]> {
  const token = customToken || getActiveGmailToken();
  if (!token) {
    return [];
  }

  if (!clientEmail || !clientEmail.includes("@")) {
    return [];
  }

  const cacheKey = `client_${clientEmail.toLowerCase()}_${maxResults}`;
  const cached = threadCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const query = `from:${clientEmail} OR to:${clientEmail}`;
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          clearActiveGmailToken();
        }
        return [];
      }

      const data = await res.json();
      const threadSummaries = data.threads || [];

      // Fetch full details for the top threads in parallel
      const fullThreads = await Promise.all(
        threadSummaries.slice(0, 6).map(async (th: any) => {
          try {
            return await fetchThreadDetails(th.id, token);
          } catch (err) {
            console.warn(`Failed to fetch details for thread ${th.id}:`, err);
            return null;
          }
        })
      );

      const finalThreads = fullThreads.filter((t): t is GmailThread => t !== null);
      threadCache.set(cacheKey, { data: finalThreads, timestamp: Date.now() });
      return finalThreads;
    } catch {
      return [];
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Global search across Gmail messages
 */
export async function searchGmail(
  searchQuery: string,
  maxResults: number = 8,
  customToken?: string
): Promise<GmailThread[]> {
  const token = customToken || getActiveGmailToken();
  if (!token) {
    return [];
  }

  const cacheKey = `search_${searchQuery.trim().toLowerCase()}_${maxResults}`;
  const cached = threadCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(searchQuery)}&maxResults=${maxResults}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        if (res.status === 401) {
          clearActiveGmailToken();
        }
        return [];
      }

      const data = await res.json();
      const threadSummaries = data.threads || [];

      const fullThreads = await Promise.all(
        threadSummaries.slice(0, 6).map(async (th: any) => {
          try {
            return await fetchThreadDetails(th.id, token);
          } catch {
            return null;
          }
        })
      );

      const finalThreads = fullThreads.filter((t): t is GmailThread => t !== null);
      threadCache.set(cacheKey, { data: finalThreads, timestamp: Date.now() });
      return finalThreads;
    } catch {
      return [];
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
}

export interface EmailAttachmentPayload {
  filename: string;
  mimeType: string;
  base64Data: string;
}

/**
 * Helper to construct an RFC 2822 compliant email string and Base64URL-encode it
 */
export function buildRfc2822RawMessage(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  attachments?: EmailAttachmentPayload[];
}): string {
  const isHtml = params.body.includes("<") && params.body.includes(">");
  const formattedHtml = isHtml ? params.body : params.body.replace(/\r\n|\r|\n/g, "<br/>");
  const cleanPlainText = params.body.replace(/<[^>]*>/g, "");

  // UTF-8 safe base64 encoding for the subject header
  let encodedSubject = "";
  try {
    encodedSubject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(params.subject || "(No Subject)")))}?=`;
  } catch {
    encodedSubject = params.subject || "(No Subject)";
  }

  const headers: string[] = [
    `To: ${params.to.trim()}`,
  ];
  if (params.cc && params.cc.trim()) {
    headers.push(`Cc: ${params.cc.trim()}`);
  }
  if (params.bcc && params.bcc.trim()) {
    headers.push(`Bcc: ${params.bcc.trim()}`);
  }
  headers.push(`Subject: ${encodedSubject}`);
  headers.push("MIME-Version: 1.0");

  if (params.inReplyTo && params.inReplyTo.trim()) {
    const rawInReplyTo = params.inReplyTo.trim();
    const formattedInReplyTo = rawInReplyTo.startsWith("<") && rawInReplyTo.endsWith(">")
      ? rawInReplyTo
      : `<${rawInReplyTo}>`;
    headers.push(`In-Reply-To: ${formattedInReplyTo}`);
    headers.push(`References: ${formattedInReplyTo}`);
  }

  let rawMessage = "";

  if (params.attachments && params.attachments.length > 0) {
    const mixedBoundary = `====_CRM_MIXED_${Date.now()}_====`;
    const altBoundary = `====_CRM_ALT_${Date.now()}_====`;
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    const parts = [
      headers.join("\r\n"),
      "",
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      `--${altBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      cleanPlainText,
      "",
      `--${altBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      `<div dir="ltr">${formattedHtml}</div>`,
      "",
      `--${altBoundary}--`,
    ];

    for (const att of params.attachments) {
      const cleanBase64 = (att.base64Data || "").replace(/[\r\n]/g, "");
      const chunked = cleanBase64.match(/.{1,76}/g)?.join("\r\n") || cleanBase64;
      parts.push(
        `--${mixedBoundary}`,
        `Content-Type: ${att.mimeType || "application/octet-stream"}; name="${att.filename || "attachment"}"`,
        `Content-Disposition: attachment; filename="${att.filename || "attachment"}"`,
        "Content-Transfer-Encoding: base64",
        "",
        chunked
      );
    }

    parts.push(`--${mixedBoundary}--`, "");
    rawMessage = parts.join("\r\n");
  } else {
    const boundary = `====_CRM_MIME_${Date.now()}_====`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    const parts = [
      headers.join("\r\n"),
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      cleanPlainText,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      `<div dir="ltr">${formattedHtml}</div>`,
      "",
      `--${boundary}--`,
    ];
    rawMessage = parts.join("\r\n");
  }

  // UTF-8 safe base64url encoding
  const bytes = new TextEncoder().encode(rawMessage);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Send an email or reply through CRM
 */
export async function sendGmailMessage(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
  attachments?: EmailAttachmentPayload[];
  customToken?: string;
  freelancerId?: string;
}): Promise<{ success: boolean; messageId?: string; threadId?: string; error?: string }> {
  // Pro Subscription Enforcement: Verify with backend if freelancerId is present
  if (params.freelancerId) {
    const isPro = await verifyBackendProEntitlement(params.freelancerId);
    if (!isPro) {
      throw new Error("Gmail Integration is available with Freelancer CRM Pro. Please upgrade to Pro to send emails.");
    }
  }

  const token = params.customToken || getActiveGmailToken();
  if (!token) {
    throw new Error("Gmail is not connected. Please connect your Gmail account.");
  }

  const encodedRaw = buildRfc2822RawMessage({
    to: params.to,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    body: params.body,
    inReplyTo: params.inReplyTo,
    attachments: params.attachments,
  });

  const payload: any = { raw: encodedRaw };
  if (params.threadId) {
    payload.threadId = params.threadId;
  }

  // 1. Send directly to Gmail API using the client's direct OAuth token
  try {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        messageId: data.id,
        threadId: data.threadId,
      };
    }

    // If direct send returned 401, session is expired
    if (res.status === 401) {
      clearActiveGmailToken();
      throw new Error("Gmail session expired. Please click 'Reconnect Gmail' to re-authenticate.");
    }

    // Try reading error message
    let errorMsg = `Gmail API error (status ${res.status})`;
    try {
      const errJson = await res.json();
      errorMsg = errJson?.error?.message || errJson?.error_description || errorMsg;
    } catch {
      const errText = await res.text().catch(() => "");
      if (errText && !errText.includes("<html>")) {
        errorMsg = errText;
      }
    }

    if (
      res.status === 403 ||
      errorMsg.toLowerCase().includes("insufficient") ||
      errorMsg.toLowerCase().includes("scope")
    ) {
      clearActiveGmailToken();
      throw new Error(
        "Insufficient Gmail permissions to send emails. Please click 'Grant Permissions & Reconnect' to update your authorization."
      );
    }

    throw new Error(errorMsg);
  } catch (directErr: any) {
    // If direct call had a fatal auth, expired, or scope error, immediately re-throw
    if (
      directErr.message?.includes("expired") ||
      directErr.message?.includes("re-authenticate") ||
      directErr.message?.includes("permissions") ||
      directErr.message?.includes("Insufficient") ||
      directErr.message?.includes("scopes")
    ) {
      throw directErr;
    }

    // Fallback to server route /api/gmail/send
    try {
      const serverRes = await fetch("/api/gmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessToken: token,
          raw: encodedRaw,
          to: params.to,
          cc: params.cc,
          bcc: params.bcc,
          subject: params.subject,
          body: params.body,
          threadId: params.threadId,
          inReplyTo: params.inReplyTo,
          attachments: params.attachments,
          freelancerId: params.freelancerId,
        }),
      });

      const contentType = serverRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const serverData = await serverRes.json();
        if (serverRes.ok && serverData.success) {
          return serverData;
        }
        throw new Error(serverData.error || directErr.message || "Failed to send email.");
      } else {
        throw new Error(directErr.message || `Server returned status ${serverRes.status}`);
      }
    } catch (fallbackErr: any) {
      console.error("[Gmail Send Failed]", directErr, fallbackErr);
      throw new Error(directErr.message || fallbackErr.message || "Failed to send email via Gmail.");
    }
  }
}

/**
 * Toggle thread read/unread status
 */
export async function toggleThreadReadStatus(
  threadId: string,
  isCurrentlyUnread: boolean,
  customToken?: string
): Promise<boolean> {
  const token = customToken || getActiveGmailToken();
  if (!token) return false;

  try {
    const bodyPayload = isCurrentlyUnread
      ? { removeLabelIds: ["UNREAD"] }
      : { addLabelIds: ["UNREAD"] };

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Mark a message or thread as read
 */
export async function markThreadAsRead(threadId: string, customToken?: string): Promise<boolean> {
  return toggleThreadReadStatus(threadId, true, customToken);
}

/**
 * Toggle star/unstar on a thread
 */
export async function toggleThreadStarStatus(
  threadId: string,
  isCurrentlyStarred: boolean,
  customToken?: string
): Promise<boolean> {
  const token = customToken || getActiveGmailToken();
  if (!token) return false;

  try {
    const bodyPayload = isCurrentlyStarred
      ? { removeLabelIds: ["STARRED"] }
      : { addLabelIds: ["STARRED"] };

    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch unread count for real inbox badge
 */
export async function fetchRealUnreadCount(customToken?: string): Promise<number> {
  const token = customToken || getActiveGmailToken();
  if (!token) return 0;

  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?q=is:unread&maxResults=50",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.resultSizeEstimate || (data.threads ? data.threads.length : 0);
  } catch {
    return 0;
  }
}

