import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Search,
  RefreshCw,
  Plus,
  Inbox,
  Star,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Paperclip,
  ArrowLeft,
  Sparkles,
  Reply,
  Forward,
  CheckSquare,
  ExternalLink,
  ChevronDown,
  X,
  User,
  SlidersHorizontal,
  MailCheck,
  MailQuestion,
  CornerUpLeft,
  Calendar,
  Layers,
  ChevronRight,
  Link2,
  FileText,
  ShieldCheck,
  Check,
  Lock,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import {
  Client,
  FreelancerProfile,
  GmailEmailMessage,
  GmailThread,
  Task,
} from "../types";
import {
  connectGmailWithGSI,
  fetchGmailInboxThreads,
  sendGmailMessage,
  toggleThreadReadStatus,
  toggleThreadStarStatus,
  getActiveGmailToken,
  clearActiveGmailToken,
} from "../services/gmailService";
import { canAccessGmail } from "../services/gmailEntitlement";

interface GmailViewProps {
  profile: FreelancerProfile;
  clients: Client[];
  onUpdateProfile: (fields: Partial<FreelancerProfile>) => void;
  onAddTask: (task: Omit<Task, "id" | "freelancerId" | "createdAt">) => void;
  onEmailSentActivity?: (clientId: string, subject: string, recipient: string) => void;
  onNavigateToClient?: (clientId: string) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

type FilterType = "all" | "unread" | "starred" | "sent" | "clients";

interface ActionItemResult {
  title: string;
  suggestedDueDate?: string;
  priority?: "High" | "Medium" | "Low";
  notes?: string;
}

export default function GmailView({
  profile,
  clients,
  onUpdateProfile,
  onAddTask,
  onEmailSentActivity,
  onNavigateToClient,
  onTriggerUpgrade,
}: GmailViewProps) {
  // Check Gmail Entitlement Access (Centrally managed via gmailEntitlement; temporarily open for testing)
  const isGmailEntitled = canAccessGmail(profile);
  const isPro = isGmailEntitled;

  // Connection state
  const isConnected = !!(profile.gmailConnected && profile.gmailEmail);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Threads & Filters
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Selected thread for conversation pane
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  // Link to Client Dialog State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedClientIdToLink, setSelectedClientIdToLink] = useState<string>("");

  // Follow-up Task Modal State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(
    new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]
  );
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskClientId, setTaskClientId] = useState<string>("");

  // AI Feature States (manual trigger only)
  const [aiLoading, setAiLoading] = useState<"summarize" | "actions" | "draft" | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiActionItems, setAiActionItems] = useState<ActionItemResult[]>([]);
  const [showAiActionDrawer, setShowAiActionDrawer] = useState(false);
  const [draftTone, setDraftTone] = useState<string>("Professional & Concise");

  // Client Email Mapping Lookup
  const clientEmailMap = useMemo(() => {
    const map = new Map<string, Client>();
    for (const client of clients) {
      if (client.email && client.email.trim()) {
        map.set(client.email.toLowerCase().trim(), client);
      }
    }
    return map;
  }, [clients]);

  const clientEmailsList = useMemo(() => {
    return clients.map((c) => c.email).filter(Boolean);
  }, [clients]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Auto-hide success toast after 4s
  useEffect(() => {
    if (successToast) {
      const timer = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successToast]);

  // Fetch threads when filter, search, or connection changes
  const loadThreads = async (isManualRefresh: boolean = false) => {
    if (!isGmailEntitled || !isConnected) return;
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    try {
      const results = await fetchGmailInboxThreads({
        filter: activeFilter,
        searchQuery: debouncedSearch,
        clientEmails: activeFilter === "clients" ? clientEmailsList : undefined,
        maxResults: 20,
        forceRefresh: isManualRefresh,
      });

      // Match each thread with CRM clients
      const enhancedThreads = results.map((th) => {
        let matchedClient: Client | undefined;

        // Check sender of each message
        for (const msg of th.messages) {
          if (msg.fromEmail && clientEmailMap.has(msg.fromEmail.toLowerCase())) {
            matchedClient = clientEmailMap.get(msg.fromEmail.toLowerCase());
            break;
          }
          if (msg.to) {
            const toEmails = msg.to.split(",").map((s) => s.replace(/.*<(.+)>.*/, "$1").trim().toLowerCase());
            for (const toEmail of toEmails) {
              if (clientEmailMap.has(toEmail)) {
                matchedClient = clientEmailMap.get(toEmail);
                break;
              }
            }
          }
        }

        return {
          ...th,
          matchedClientId: matchedClient?.id,
          matchedClientName: matchedClient?.contactPerson || matchedClient?.companyName,
        };
      });

      setThreads(enhancedThreads);

      // If a thread was previously selected, keep it selected if still in list
      if (selectedThreadId) {
        const stillExists = enhancedThreads.some((t) => t.id === selectedThreadId);
        if (!stillExists && enhancedThreads.length > 0 && window.innerWidth >= 1024) {
          setSelectedThreadId(enhancedThreads[0].id);
        }
      } else if (enhancedThreads.length > 0 && window.innerWidth >= 1024) {
        setSelectedThreadId(enhancedThreads[0].id);
      }
    } catch (err: any) {
      console.warn("Failed to load Gmail threads:", err);
      setErrorMsg(err.message || "Failed to load emails from Gmail.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isGmailEntitled && isConnected) {
      loadThreads(false);
    }
  }, [isGmailEntitled, isConnected, activeFilter, debouncedSearch]);

  // Active selected thread object
  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === selectedThreadId) || null;
  }, [threads, selectedThreadId]);

  // Detected client for the active thread
  const activeThreadClient = useMemo(() => {
    if (!activeThread) return null;
    if (activeThread.matchedClientId) {
      return clients.find((c) => c.id === activeThread.matchedClientId) || null;
    }
    // Search participants against CRM clients
    for (const msg of activeThread.messages) {
      if (msg.fromEmail && clientEmailMap.has(msg.fromEmail.toLowerCase())) {
        return clientEmailMap.get(msg.fromEmail.toLowerCase()) || null;
      }
    }
    return null;
  }, [activeThread, clients, clientEmailMap]);

  // Connect Gmail
  const handleConnectGmail = async () => {
    if (!isGmailEntitled) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade("gmail_integration");
      }
      return;
    }
    setConnecting(true);
    setConnectError(null);
    try {
      const result = await connectGmailWithGSI();
      onUpdateProfile({
        gmailConnected: true,
        gmailEmail: result.email,
        gmailName: result.name || profile.name,
        gmailPicture: result.picture,
        gmailConnectedAt: new Date().toISOString(),
      });
      setSuccessToast(`Connected to Gmail as ${result.email}`);
    } catch (err: any) {
      console.error("Gmail connection error:", err);
      setConnectError(err.message || "Failed to authorize with Google.");
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Gmail
  const handleDisconnectGmail = () => {
    clearActiveGmailToken();
    onUpdateProfile({
      gmailConnected: false,
      gmailEmail: undefined,
      gmailName: undefined,
      gmailPicture: undefined,
      gmailConnectedAt: undefined,
    });
    setThreads([]);
    setSelectedThreadId(null);
    setSuccessToast("Gmail account disconnected successfully.");
  };

  // Star / Unstar Thread
  const handleToggleStar = async (e: React.MouseEvent, thread: GmailThread) => {
    e.stopPropagation();
    const newStarredState = !thread.isStarred;

    // Optimistic UI update
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, isStarred: newStarredState } : t))
    );

    try {
      await toggleThreadStarStatus(thread.id, !!thread.isStarred);
    } catch (err) {
      console.warn("Failed to toggle star:", err);
      // Revert on error
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, isStarred: thread.isStarred } : t))
      );
    }
  };

  // Mark Read / Unread
  const handleToggleRead = async (thread: GmailThread) => {
    const newUnreadState = !thread.isUnread;

    // Optimistic UI update
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, isUnread: newUnreadState } : t))
    );

    try {
      await toggleThreadReadStatus(thread.id, thread.isUnread);
    } catch (err) {
      console.warn("Failed to toggle read status:", err);
      setThreads((prev) =>
        prev.map((t) => (t.id === thread.id ? { ...t, isUnread: thread.isUnread } : t))
      );
    }
  };

  // Open Compose modal fresh
  const handleOpenNewCompose = () => {
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeSubject("");
    setComposeBody("");
    setComposeThreadId(undefined);
    setComposeInReplyTo(undefined);
    setShowCcBcc(false);
    setComposeError(null);
    setIsComposeOpen(true);
  };

  // Open Reply
  const handleOpenReply = (thread: GmailThread, isForward: boolean = false) => {
    const latestMsg = thread.messages[thread.messages.length - 1];
    const replyRecipient = isForward
      ? ""
      : latestMsg?.fromEmail || latestMsg?.from || "";

    const prefix = isForward ? "Fwd: " : "Re: ";
    const cleanSubject = thread.subject.replace(/^(Re|Fwd):\s*/i, "");

    setComposeTo(replyRecipient);
    setComposeCc("");
    setComposeBcc("");
    setComposeSubject(`${prefix}${cleanSubject}`);
    setComposeThreadId(isForward ? undefined : thread.id);
    setComposeInReplyTo(isForward ? undefined : latestMsg?.id);
    setShowCcBcc(false);
    setComposeError(null);

    // Initial quoting
    const quoteHeader = `\n\n--- On ${latestMsg?.date || "previous email"}, ${latestMsg?.from || "Sender"} wrote: ---\n`;
    const quoteBody = (latestMsg?.bodyText || latestMsg?.snippet || "")
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");

    setComposeBody(`${quoteHeader}${quoteBody}`);
    setIsComposeOpen(true);
  };

  // Send Email through real Gmail API
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      setComposeError("Recipient email (To) is required.");
      return;
    }
    if (!composeSubject.trim()) {
      setComposeError("Subject is required.");
      return;
    }
    if (!composeBody.trim()) {
      setComposeError("Message body cannot be empty.");
      return;
    }

    setSendingEmail(true);
    setComposeError(null);

    try {
      const result = await sendGmailMessage({
        to: composeTo.trim(),
        cc: composeCc.trim() || undefined,
        bcc: composeBcc.trim() || undefined,
        subject: composeSubject.trim(),
        body: composeBody,
        threadId: composeThreadId,
        inReplyTo: composeInReplyTo,
        freelancerId: profile.id,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to send email.");
      }

      setIsComposeOpen(false);
      setSuccessToast(`Email successfully sent to ${composeTo.trim()}`);

      // Check if recipient is a CRM client to log activity
      const recipientMatch = clientEmailMap.get(composeTo.trim().toLowerCase());
      if (recipientMatch && onEmailSentActivity) {
        onEmailSentActivity(recipientMatch.id, composeSubject.trim(), composeTo.trim());
      }

      // Refresh threads
      loadThreads(true);
    } catch (err: any) {
      console.error("Failed to send email:", err);
      setComposeError(err.message || "Failed to send email through Gmail. Please verify your connection.");
    } finally {
      setSendingEmail(false);
    }
  };

  // Link thread to client
  const handleLinkThreadToClient = () => {
    if (!selectedClientIdToLink || !activeThread) return;
    const targetClient = clients.find((c) => c.id === selectedClientIdToLink);
    if (!targetClient) return;

    // Update active thread locally
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? {
              ...t,
              matchedClientId: targetClient.id,
              matchedClientName: targetClient.contactPerson || targetClient.companyName,
            }
          : t
      )
    );

    setIsLinkModalOpen(false);
    setSuccessToast(`Thread linked to ${targetClient.contactPerson || targetClient.companyName}`);
  };

  // Follow-up task creation from email
  const handleOpenTaskModal = () => {
    if (!activeThread) return;
    const latestMsg = activeThread.messages[activeThread.messages.length - 1];
    setTaskTitle(`Follow up: ${activeThread.subject.replace(/^(Re|Fwd):\s*/i, "")}`);
    setTaskDueDate(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
    setTaskPriority("Medium");
    setTaskNotes(`From email thread with ${latestMsg?.from || "client"}:\n"${activeThread.snippet}"`);
    setTaskClientId(activeThreadClient?.id || "");
    setIsTaskModalOpen(true);
  };

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    onAddTask({
      title: taskTitle.trim(),
      dueDate: taskDueDate,
      priority: taskPriority,
      completed: false,
      clientId: taskClientId || undefined,
      notes: taskNotes,
      relatedEmailId: activeThread?.id,
      relatedEmailSubject: activeThread?.subject,
    });

    setIsTaskModalOpen(false);
    setSuccessToast("Follow-up task created in CRM");
  };

  // AI Summarize (Manual trigger)
  const handleAiSummarize = async () => {
    if (!activeThread) return;
    setAiLoading("summarize");
    setAiSummary(null);

    try {
      const messagesForAi = activeThread.messages.map((m) => ({
        from: m.from,
        date: m.date,
        body: m.bodyText || m.snippet,
      }));

      const res = await fetch("/api/gemini/summarize-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: activeThread.subject,
          threadMessages: messagesForAi,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate AI summary.");
      }

      setAiSummary(data.summary);
    } catch (err: any) {
      console.error("AI Summarize error:", err);
      setErrorMsg(err.message || "Failed to summarize email with Gemini AI.");
    } finally {
      setAiLoading(null);
    }
  };

  // AI Extract Action Items (Manual trigger)
  const handleAiExtractActions = async () => {
    if (!activeThread) return;
    setAiLoading("actions");
    setAiActionItems([]);

    try {
      const latestMsg = activeThread.messages[activeThread.messages.length - 1];
      const combinedBody = activeThread.messages
        .map((m) => `${m.from} wrote:\n${m.bodyText || m.snippet}`)
        .join("\n\n");

      const res = await fetch("/api/gemini/extract-action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: activeThread.subject,
          content: combinedBody,
          senderName: latestMsg?.fromName || latestMsg?.from,
          clientName: activeThreadClient?.contactPerson || activeThreadClient?.companyName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to extract action items.");
      }

      setAiActionItems(data.actionItems || []);
      setShowAiActionDrawer(true);
    } catch (err: any) {
      console.error("AI Action items extraction error:", err);
      setErrorMsg(err.message || "Failed to extract action items.");
    } finally {
      setAiLoading(null);
    }
  };

  // AI Draft Reply (Manual trigger)
  const handleAiDraftReply = async () => {
    if (!activeThread) return;
    setAiLoading("draft");

    try {
      const latestMsg = activeThread.messages[activeThread.messages.length - 1];
      const res = await fetch("/api/gemini/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: activeThread.subject,
          content: latestMsg?.bodyText || latestMsg?.snippet || "",
          senderName: latestMsg?.fromName || latestMsg?.from,
          clientName: activeThreadClient?.contactPerson || activeThreadClient?.companyName,
          myName: profile.name,
          replyContext: `Tone: ${draftTone}. Professional freelance business owner response.`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate draft reply.");
      }

      // Pre-fill composer modal with generated draft (never auto-sends)
      setComposeTo(latestMsg?.fromEmail || latestMsg?.from || "");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject(data.draft?.subject || `Re: ${activeThread.subject}`);
      setComposeBody(data.draft?.body || "");
      setComposeThreadId(activeThread.id);
      setComposeInReplyTo(latestMsg?.id);
      setShowCcBcc(false);
      setComposeError(null);
      setIsComposeOpen(true);
      setSuccessToast("AI draft reply ready for review in Composer.");
    } catch (err: any) {
      console.error("AI Draft Reply error:", err);
      setErrorMsg(err.message || "Failed to generate smart draft reply.");
    } finally {
      setAiLoading(null);
    }
  };

  // Convert 1-click AI Action Item to CRM Task
  const handleAddAiActionAsTask = (item: ActionItemResult) => {
    onAddTask({
      title: item.title,
      dueDate: item.suggestedDueDate || new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      priority: item.priority || "Medium",
      completed: false,
      clientId: activeThreadClient?.id || undefined,
      notes: `Extracted by Gemini AI from email thread '${activeThread?.subject}':\n${item.notes || ""}`,
      relatedEmailId: activeThread?.id,
      relatedEmailSubject: activeThread?.subject,
    });

    // Remove added item from AI list
    setAiActionItems((prev) => prev.filter((a) => a.title !== item.title));
    setSuccessToast(`Task added to CRM: ${item.title}`);
  };

  // =========================================================================
  // RENDER: PRO GATE (FOR USERS WITHOUT GMAIL ENTITLEMENT)
  // =========================================================================
  if (!isGmailEntitled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                <Mail className="w-4 h-4" />
              </div>
              <span>Gmail Inbox & Client Communications</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Synchronize email conversations with your CRM clients and manage follow-ups.
            </p>
          </div>
        </div>

        {/* Pro Upgrade Screen Card */}
        <div className="p-8 sm:p-12 rounded-2xl glass-panel text-center max-w-2xl mx-auto shadow-xs border border-white/80 space-y-6 my-6" id="gmail-pro-gate-screen">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto shadow-sm">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
              <Sparkles size={11} className="text-amber-500" />
              Pro Feature
            </span>
            <h3 className="text-xl font-black text-slate-900">
              Gmail Integration is available with Freelancer CRM Pro.
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Connect Gmail to view and manage client conversations, send and reply to emails directly from your CRM, extract follow-up action items, and draft responses with AI assistance.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onTriggerUpgrade && onTriggerUpgrade("gmail_integration")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/15 cursor-pointer"
              id="upgrade-to-pro-gmail-btn"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Upgrade to Pro</span>
            </button>
          </div>

          {/* Preserved Account Notice for users who connected during testing */}
          {isConnected && profile.gmailEmail && (
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-left flex items-center gap-3 max-w-md mx-auto">
              {profile.gmailPicture ? (
                <img
                  src={profile.gmailPicture}
                  alt={profile.gmailName || "Google Account"}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                  {profile.gmailEmail[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-800 truncate">
                  Account: {profile.gmailEmail}
                </p>
                <p className="text-[10px] text-slate-500">
                  Your Gmail connection is preserved and will resume immediately upon upgrading to Pro.
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-6 grid sm:grid-cols-3 gap-4 text-left">
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Live Inbox Sync
              </span>
              <p className="text-[10px] text-slate-500">
                Direct client conversations matched to your CRM records.
              </p>
            </div>
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Send size={13} className="text-indigo-500" />
                In-App Send & Reply
              </span>
              <p className="text-[10px] text-slate-500">
                Compose, reply, and maintain email history without leaving CRM.
              </p>
            </div>
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Sparkles size={13} className="text-amber-500" />
                AI Drafts & Actions
              </span>
              <p className="text-[10px] text-slate-500">
                1-click follow-up tasks and smart email drafts.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: NOT CONNECTED STATE
  // =========================================================================
  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-xs">
                <Mail className="w-4 h-4" />
              </div>
              <span>Gmail Inbox & Client Communications</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Synchronize email conversations with your CRM clients and manage follow-ups.
            </p>
          </div>
        </div>

        {/* Clean Empty State Card */}
        <div className="p-8 sm:p-12 rounded-2xl glass-panel text-center max-w-2xl mx-auto shadow-xs border border-white/80 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto shadow-sm">
            <Mail className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-900">Gmail not connected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Connect Gmail to view client conversations, send and reply to emails, and manage email follow-ups from Freelancer CRM.
            </p>
          </div>

          {connectError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-left flex items-start gap-2 max-w-md mx-auto">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Connection Failed: </span>
                <span>{connectError}</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={handleConnectGmail}
              disabled={connecting}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/15 cursor-pointer disabled:opacity-50"
              id="connect-gmail-page-btn"
            >
              {connecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{connecting ? "Connecting with Google..." : "Connect Gmail"}</span>
            </button>
          </div>

          <div className="border-t border-slate-100 pt-6 grid sm:grid-cols-3 gap-4 text-left">
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <CheckCircle2 size={13} className="text-emerald-500" />
                Direct Client Sync
              </span>
              <p className="text-[10px] text-slate-500">
                Matches conversations automatically to your client records by email.
              </p>
            </div>
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Sparkles size={13} className="text-indigo-500" />
                AI Smart Assistance
              </span>
              <p className="text-[10px] text-slate-500">
                Generate summaries, action items, and draft replies on demand.
              </p>
            </div>
            <div className="p-3 bg-white/60 rounded-xl border border-slate-200/50">
              <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <ShieldCheck size={13} className="text-blue-500" />
                Safe & Private
              </span>
              <p className="text-[10px] text-slate-500">
                Direct Google OAuth token authentication with zero mock data.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: CONNECTED GMAIL INBOX DASHBOARD
  // =========================================================================
  return (
    <div className="space-y-4" id="gmail-page-container">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between shadow-xs z-30"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span className="font-semibold">{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-600 hover:text-emerald-800 cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0 shadow-xs">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">Gmail Inbox</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {profile.gmailEmail}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Manage client communications, replies, follow-ups, and AI insights.
            </p>
          </div>
        </div>

        {/* Top actions: Reconnect, Disconnect, Refresh & Compose */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleConnectGmail}
            disabled={connecting}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-600 rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
            title="Reconnect or re-authorize Google account"
            id="reconnect-gmail-btn"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${connecting ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
            <span className="hidden sm:inline">{connecting ? "Connecting..." : "Reconnect"}</span>
          </button>

          <button
            onClick={handleDisconnectGmail}
            className="p-2 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Disconnect Gmail account"
            id="disconnect-gmail-btn"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>

          <button
            onClick={() => loadThreads(true)}
            disabled={refreshing || loading}
            className="p-2 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl border border-slate-200/80 shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh inbox"
            id="refresh-gmail-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenNewCompose}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            id="compose-email-btn"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Compose</span>
          </button>
        </div>
      </div>

      {/* Main 2-Pane Container (Responsive: list + conversation pane) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[620px]">
        {/* Left Pane: Search + Filter Tabs + Thread List (5 cols on lg) */}
        <div
          className={`lg:col-span-5 flex flex-col space-y-3 ${
            selectedThreadId && "hidden lg:flex"
          }`}
        >
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Gmail..."
              className="w-full py-2 pl-9 pr-8 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
              id="gmail-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
            {[
              { id: "all", label: "All", icon: Inbox },
              { id: "unread", label: "Unread", icon: MailCheck },
              { id: "starred", label: "Starred", icon: Star },
              { id: "sent", label: "Sent", icon: Send },
              { id: "clients", label: "Client Emails", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveFilter(tab.id as FilterType);
                  }}
                  className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all shrink-0 cursor-pointer text-xs ${
                    isActive
                      ? "bg-indigo-600 text-white font-bold shadow-xs"
                      : "bg-white/80 hover:bg-white text-slate-600 border border-slate-200/70"
                  }`}
                >
                  <Icon size={12} className={isActive ? "text-white" : "text-slate-400"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Threads List Box */}
          <div className="glass-panel rounded-2xl p-2 max-h-[640px] overflow-y-auto space-y-1.5 border border-white/80">
            {loading && threads.length === 0 ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-3 rounded-xl skeleton-shimmer space-y-2">
                    <div className="h-3 w-1/3 bg-slate-200/70 rounded"></div>
                    <div className="h-3.5 w-3/4 bg-slate-200/90 rounded"></div>
                    <div className="h-2.5 w-1/2 bg-slate-200/50 rounded"></div>
                  </div>
                ))}
              </div>
            ) : errorMsg ? (
              <div className="p-6 text-center text-slate-500 text-xs space-y-2">
                <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                <p className="font-semibold text-slate-800">{errorMsg}</p>
                <button
                  onClick={() => loadThreads(true)}
                  className="px-3 py-1 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            ) : threads.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <Mail className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="font-semibold text-slate-600">No conversations found</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  {debouncedSearch
                    ? `No emails match "${debouncedSearch}".`
                    : activeFilter === "clients"
                    ? "No emails found matching your CRM client contact addresses."
                    : "Your Gmail inbox is clear."}
                </p>
              </div>
            ) : (
              threads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                const latestMsg = thread.messages[thread.messages.length - 1];
                const dateDisplay = new Date(thread.lastMessageTimestamp).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" }
                );

                return (
                  <motion.div
                    key={thread.id}
                    layoutId={`thread-item-${thread.id}`}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setSelectedThreadId(thread.id);
                      if (thread.isUnread) {
                        handleToggleRead(thread);
                      }
                    }}
                    className={`p-3 rounded-xl transition-all cursor-pointer border relative text-left ${
                      isSelected
                        ? "bg-indigo-50/90 border-indigo-200 shadow-xs"
                        : thread.isUnread
                        ? "bg-white border-slate-200/90 shadow-xs font-semibold"
                        : "bg-white/60 hover:bg-white border-transparent hover:border-slate-200/60"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {thread.isUnread && (
                      <div className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                    )}

                    <div className="flex items-start justify-between gap-2 pl-2">
                      <div className="min-w-0 flex-1">
                        {/* Sender & Matched Client Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-xs truncate ${
                              thread.isUnread ? "font-extrabold text-slate-900" : "font-bold text-slate-700"
                            }`}
                          >
                            {latestMsg?.fromName || latestMsg?.from || "Unknown Sender"}
                          </span>

                          {thread.matchedClientName && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md shrink-0">
                              <Users size={9} />
                              {thread.matchedClientName}
                            </span>
                          )}

                          {thread.messages.length > 1 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({thread.messages.length})
                            </span>
                          )}
                        </div>

                        {/* Subject */}
                        <h4
                          className={`text-xs truncate mt-0.5 ${
                            thread.isUnread ? "font-bold text-slate-900" : "text-slate-700"
                          }`}
                        >
                          {thread.subject || "(No Subject)"}
                        </h4>

                        {/* Snippet Preview */}
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal">
                          {thread.snippet || "No preview available"}
                        </p>
                      </div>

                      {/* Right Meta: Date, Star, Attachment */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          {dateDisplay}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {thread.hasAttachments && (
                            <span title="Has attachments" className="inline-flex items-center">
                              <Paperclip size={11} className="text-slate-400" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleToggleStar(e, thread)}
                            className="text-slate-300 hover:text-amber-500 transition-colors p-0.5 cursor-pointer"
                          >
                            <Star
                              size={12}
                              className={
                                thread.isStarred ? "text-amber-400 fill-amber-400" : ""
                              }
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Opened Conversation View (7 cols on lg) */}
        <div
          className={`lg:col-span-7 ${
            !selectedThreadId ? "hidden lg:block" : "block"
          }`}
        >
          {activeThread ? (
            <div className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/80 space-y-4 max-h-[720px] overflow-y-auto">
              {/* Header Bar with Back Button (on mobile) & Actions */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="min-w-0 space-y-1">
                  {/* Mobile Back Button */}
                  <button
                    onClick={() => setSelectedThreadId(null)}
                    className="lg:hidden inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-indigo-600 mb-1 cursor-pointer"
                  >
                    <ArrowLeft size={13} />
                    <span>Back to Inbox</span>
                  </button>

                  <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                    {activeThread.subject || "(No Subject)"}
                  </h3>

                  {/* Client Linking Badge Bar */}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {activeThreadClient ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800">
                        <Users size={12} className="text-emerald-600" />
                        <span>Linked to {activeThreadClient.contactPerson || activeThreadClient.companyName}</span>
                        {onNavigateToClient && (
                          <button
                            onClick={() => onNavigateToClient(activeThreadClient.id)}
                            className="ml-1 text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer text-[11px]"
                          >
                            View Client
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedClientIdToLink(clients[0]?.id || "");
                          setIsLinkModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition-colors cursor-pointer"
                      >
                        <Link2 size={12} />
                        <span>Link to Client</span>
                      </button>
                    )}

                    <span className="text-[11px] text-slate-400">
                      {activeThread.messages.length} message
                      {activeThread.messages.length > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Top Action Icons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleToggleStar(e, activeThread)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer"
                    title={activeThread.isStarred ? "Unstar" : "Star"}
                  >
                    <Star
                      size={14}
                      className={activeThread.isStarred ? "text-amber-400 fill-amber-400" : ""}
                    />
                  </button>

                  <button
                    onClick={() => handleToggleRead(activeThread)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 cursor-pointer"
                    title={activeThread.isUnread ? "Mark as Read" : "Mark as Unread"}
                  >
                    <MailCheck size={14} />
                  </button>

                  <button
                    onClick={handleOpenTaskModal}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer flex items-center gap-1 text-xs font-semibold"
                    title="Create follow-up task in CRM"
                  >
                    <CheckSquare size={13} className="text-indigo-600" />
                    <span className="hidden sm:inline">Follow-up</span>
                  </button>
                </div>
              </div>

              {/* AI Quick Actions Bar (Manual Trigger Only) */}
              <div className="p-3 bg-gradient-to-r from-indigo-50/60 to-purple-50/50 rounded-xl border border-indigo-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles size={12} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-indigo-950 block">Gemini AI Assistant</span>
                    <span className="text-[10px] text-indigo-700/80">Click an action to analyze this thread on-demand</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handleAiSummarize}
                    disabled={aiLoading !== null}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiLoading === "summarize" ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <FileText size={11} />
                    )}
                    <span>Summarize</span>
                  </button>

                  <button
                    onClick={handleAiExtractActions}
                    disabled={aiLoading !== null}
                    className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiLoading === "actions" ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <CheckSquare size={11} />
                    )}
                    <span>Extract Actions</span>
                  </button>

                  <button
                    onClick={handleAiDraftReply}
                    disabled={aiLoading !== null}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
                  >
                    {aiLoading === "draft" ? (
                      <RefreshCw size={11} className="animate-spin" />
                    ) : (
                      <Reply size={11} />
                    )}
                    <span>Draft Reply</span>
                  </button>
                </div>
              </div>

              {/* AI Summary Display Card */}
              {aiSummary && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 bg-white border border-indigo-100 rounded-xl shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-indigo-600" />
                      AI Thread Summary
                    </span>
                    <button
                      onClick={() => setAiSummary(null)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap leading-relaxed font-sans text-xs">
                    {aiSummary}
                  </div>
                </motion.div>
              )}

              {/* AI Action Items Drawer */}
              {showAiActionDrawer && aiActionItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-white border border-indigo-100 rounded-xl shadow-xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckSquare size={13} className="text-indigo-600" />
                      Extracted Follow-up Tasks ({aiActionItems.length})
                    </span>
                    <button
                      onClick={() => setShowAiActionDrawer(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-2 pt-1">
                    {aiActionItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 text-xs block">{item.title}</span>
                          <span className="text-[10px] text-slate-500">
                            Due: {item.suggestedDueDate || "In 3 days"} &bull; Priority: {item.priority || "Medium"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddAiActionAsTask(item)}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Plus size={11} />
                          <span>Add Task</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Conversation Messages Stream */}
              <div className="space-y-3.5 pt-1">
                {activeThread.messages.map((msg, idx) => {
                  const isLatest = idx === activeThread.messages.length - 1;
                  const fromDisplayName = msg.fromName || msg.from;

                  return (
                    <div
                      key={msg.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isLatest
                          ? "bg-white border-slate-200/90 shadow-xs"
                          : "bg-white/70 border-slate-200/50"
                      }`}
                    >
                      {/* Message Header */}
                      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0 text-xs uppercase">
                            {fromDisplayName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 truncate">{fromDisplayName}</span>
                              {msg.fromEmail && (
                                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                                  &lt;{msg.fromEmail}&gt;
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              To: {msg.to}
                              {msg.cc ? ` &bull; Cc: ${msg.cc}` : ""}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {new Date(msg.timestamp).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      {/* Message Body Content */}
                      <div className="pt-3 text-xs text-slate-800 leading-relaxed overflow-x-auto">
                        {msg.bodyHtml ? (
                          <div
                            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                            className="prose prose-sm max-w-none text-slate-800 text-xs font-sans"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap font-sans text-xs">
                            {msg.bodyText || msg.snippet}
                          </p>
                        )}
                      </div>

                      {/* Attachments Section */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Attachments ({msg.attachments.length})
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs"
                              >
                                <Paperclip size={12} className="text-slate-500" />
                                <span className="font-medium text-slate-700 truncate max-w-[160px]">
                                  {att.filename}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {Math.round(att.size / 1024)} KB
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick Reply Action Bar */}
              <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenReply(activeThread, false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    <Reply size={13} />
                    <span>Reply</span>
                  </button>

                  <button
                    onClick={() => handleOpenReply(activeThread, true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    <Forward size={13} />
                    <span>Forward</span>
                  </button>
                </div>

                <button
                  onClick={handleOpenTaskModal}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <CheckSquare size={13} />
                  <span>Create Follow-up</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 text-xs space-y-3 min-h-[400px] flex flex-col items-center justify-center border border-white/80">
              <Mail className="w-10 h-10 text-slate-300 stroke-[1.2]" />
              <div>
                <p className="font-bold text-slate-600 text-sm">No Conversation Selected</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Select an email thread from the list on the left to view messages and insights.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COMPOSE / REPLY MODAL */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isComposeOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden text-xs my-8"
              id="gmail-compose-modal"
            >
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-indigo-400" />
                  <span className="font-bold text-sm">
                    {composeThreadId ? "Reply via Gmail" : "Compose New Email"}
                  </span>
                </div>
                <button
                  onClick={() => setIsComposeOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Compose Form */}
              <form onSubmit={handleSendEmail} className="p-5 space-y-3">
                {composeError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-600" />
                      <span className="leading-relaxed font-medium">{composeError}</span>
                    </div>
                    {(composeError.includes("permission") ||
                      composeError.includes("scope") ||
                      composeError.includes("expired") ||
                      composeError.includes("Reconnect") ||
                      composeError.includes("authorization")) && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setConnecting(true);
                              const result = await connectGmailWithGSI();
                              onUpdateProfile({
                                gmailConnected: true,
                                gmailEmail: result.email,
                                gmailName: result.name || profile.name,
                                gmailPicture: result.picture,
                                gmailConnectedAt: new Date().toISOString(),
                              });
                              setComposeError(null);
                              setSuccessToast("Gmail permissions granted successfully! You can now send.");
                            } catch (err: any) {
                              setComposeError(err.message || "Failed to authorize Gmail permissions.");
                            } finally {
                              setConnecting(false);
                            }
                          }}
                          disabled={connecting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={connecting ? "animate-spin" : ""} />
                          <span>{connecting ? "Authorizing..." : "Grant Permissions & Reconnect Gmail"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* To Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">To *</label>
                    <button
                      type="button"
                      onClick={() => setShowCcBcc(!showCcBcc)}
                      className="text-[11px] text-indigo-600 font-semibold hover:underline cursor-pointer"
                    >
                      {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
                    </button>
                  </div>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    id="compose-to-input"
                  />

                  {/* Client quick picker if blank */}
                  {!composeTo && clients.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">Quick Select:</span>
                      {clients.slice(0, 4).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setComposeTo(c.email)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[10px] font-semibold cursor-pointer"
                        >
                          {c.contactPerson || c.companyName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* CC & BCC Fields */}
                {showCcBcc && (
                  <div className="grid sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        CC
                      </label>
                      <input
                        type="email"
                        value={composeCc}
                        onChange={(e) => setComposeCc(e.target.value)}
                        placeholder="cc@example.com"
                        className="w-full py-1.5 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        BCC
                      </label>
                      <input
                        type="email"
                        value={composeBcc}
                        onChange={(e) => setComposeBcc(e.target.value)}
                        placeholder="bcc@example.com"
                        className="w-full py-1.5 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Subject Field */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Project proposal & timeline update..."
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none font-semibold"
                    id="compose-subject-input"
                  />
                </div>

                {/* Message Body */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                    Message Body *
                  </label>
                  <textarea
                    required
                    rows={8}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Write your email message here..."
                    className="w-full py-2.5 px-3.5 glass-input rounded-xl text-slate-800 text-xs focus:outline-none font-sans leading-relaxed"
                    id="compose-body-textarea"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span>Sent via authenticated Gmail API</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsComposeOpen(false)}
                      disabled={sendingEmail}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/15 transition-all cursor-pointer disabled:opacity-50"
                      id="send-email-submit-btn"
                    >
                      {sendingEmail ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      <span>{sendingEmail ? "Sending via Gmail..." : "Send Email"}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* LINK TO CLIENT MODAL */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isLinkModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Link2 size={15} className="text-indigo-600" />
                  Link Conversation to Client
                </span>
                <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <p className="text-slate-500 leading-relaxed">
                Associate this email thread with an existing client in your CRM. This thread will also appear in their client activity timeline.
              </p>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Client *</label>
                <select
                  value={selectedClientIdToLink}
                  onChange={(e) => setSelectedClientIdToLink(e.target.value)}
                  className="w-full py-2.5 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none font-semibold"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contactPerson || c.companyName} ({c.email || "No email"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkThreadToClient}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  Confirm Link
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* FOLLOW-UP TASK MODAL */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 text-xs space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CheckSquare size={15} className="text-indigo-600" />
                  Create Follow-up Task
                </span>
                <button onClick={() => setIsTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateTaskSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Due Date *</label>
                    <input
                      type="date"
                      required
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assign to Client (Optional)</label>
                  <select
                    value={taskClientId}
                    onChange={(e) => setTaskClientId(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="">-- None --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contactPerson || c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notes & Context</label>
                  <textarea
                    rows={3}
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTaskModalOpen(false)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
