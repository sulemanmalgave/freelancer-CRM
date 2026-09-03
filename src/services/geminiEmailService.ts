export interface ActionItemResult {
  title: string;
  suggestedDueDate: string;
  priority: "High" | "Medium" | "Low";
  notes?: string;
}

export interface DraftReplyResult {
  subject: string;
  body: string;
}

/**
 * Summarize an individual email message or full conversation thread
 */
export async function summarizeEmailWithGemini(params: {
  subject: string;
  content: string;
  threadMessages?: Array<{ from: string; body: string; date: string; snippet?: string }>;
  freelancerId?: string;
}): Promise<string> {
  const res = await fetch("/api/gemini/summarize-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to generate AI email summary.");
  }

  return data.summary;
}

/**
 * Extract structured action items and follow-ups from an email
 */
export async function extractActionItemsWithGemini(params: {
  subject: string;
  content: string;
  senderName?: string;
  clientName?: string;
  freelancerId?: string;
}): Promise<ActionItemResult[]> {
  const res = await fetch("/api/gemini/extract-action-items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to extract action items.");
  }

  return data.actionItems || [];
}

/**
 * Generate a professional draft reply
 */
export async function draftReplyWithGemini(params: {
  subject: string;
  content: string;
  replyContext?: string;
  senderName?: string;
  clientName?: string;
  myName?: string;
  freelancerId?: string;
}): Promise<DraftReplyResult> {
  const res = await fetch("/api/gemini/draft-reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to generate AI draft reply.");
  }

  return data.draft || { subject: `Re: ${params.subject}`, body: "" };
}
