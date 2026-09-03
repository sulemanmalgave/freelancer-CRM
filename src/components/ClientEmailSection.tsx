import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
  Send,
  Sparkles,
  RefreshCw,
  Clock,
  User,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Calendar,
  Zap,
  CornerUpLeft,
  X,
  Lock,
} from "lucide-react";
import { Client, FreelancerProfile, GmailThread, GmailEmailMessage, Task } from "../types";
import {
  connectGmailWithGSI,
  fetchClientThreads,
  sendGmailMessage,
  markThreadAsRead,
  getActiveGmailToken,
} from "../services/gmailService";
import { canAccessGmail } from "../services/gmailEntitlement";
import {
  summarizeEmailWithGemini,
  extractActionItemsWithGemini,
  draftReplyWithGemini,
  ActionItemResult,
} from "../services/geminiEmailService";

interface ClientEmailSectionProps {
  client: Client;
  profile: FreelancerProfile;
  allClients?: Client[];
  onUpdateProfile: (fields: Partial<FreelancerProfile>) => void;
  onAddTask?: (task: Omit<Task, "id" | "freelancerId" | "createdAt">) => void;
  onEmailSentActivity?: (subject: string, to: string) => void;
  onThreadsLoaded?: (threads: GmailThread[]) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

export default function ClientEmailSection({
  client,
  profile,
  allClients = [],
  onUpdateProfile,
  onAddTask,
  onEmailSentActivity,
  onThreadsLoaded,
  onTriggerUpgrade,
}: ClientEmailSectionProps) {
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<GmailThread | null>(null);

  // Composer Modal State
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState(client.email || "");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [composeInReplyTo, setComposeInReplyTo] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);

  // AI Assistant States (Only triggered upon explicit user clicks)
  const [aiLoading, setAiLoading] = useState<string | null>(null); // "summarize" | "actions" | "draft"
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiActionItems, setAiActionItems] = useState<ActionItemResult[]>([]);
  const [showAiActionModal, setShowAiActionModal] = useState(false);

  // Follow-up Task Creation Dialog State
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState(new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0]);
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskSuccessMsg, setTaskSuccessMsg] = useState<string | null>(null);

  // Automatic Client Email Matching state
  const [clientMatchSuggestion, setClientMatchSuggestion] = useState<{
    email: string;
    suggestedClient: Client | null;
  } | null>(null);

  const hasGmailAccess = canAccessGmail(profile);
  const isConnected = !!(profile.gmailConnected && profile.gmailEmail);

  // Load client email threads on mount or when client changes
  const loadThreads = async () => {
    if (!isConnected || !client.email) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const results = await fetchClientThreads(client.email, 12);
      setThreads(results);
      if (onThreadsLoaded) {
        onThreadsLoaded(results);
      }

      // Check for automatic matching suggestions
      for (const th of results) {
        for (const msg of th.messages) {
          if (msg.fromEmail && msg.fromEmail.toLowerCase() !== client.email.toLowerCase() && msg.fromEmail.toLowerCase() !== profile.gmailEmail?.toLowerCase()) {
            const matched = allClients.find((c) => c.email.toLowerCase() === msg.fromEmail?.toLowerCase() && c.id !== client.id);
            if (matched) {
              setClientMatchSuggestion({ email: msg.fromEmail, suggestedClient: matched });
              break;
            }
          }
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch client email threads:", err);
      setErrorMsg(err.message || "Could not retrieve email conversations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadThreads();
    }
  }, [client.id, client.email, isConnected]);

  // Connect handler
  const handleConnectGmail = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await connectGmailWithGSI();
      onUpdateProfile({
        gmailConnected: true,
        gmailEmail: res.email,
        gmailName: res.name || profile.name,
        gmailPicture: res.picture,
        gmailConnectedAt: new Date().toISOString(),
      });
      // Immediately fetch threads after connecting
      const fetched = await fetchClientThreads(client.email, 10, res.accessToken);
      setThreads(fetched);
      if (onThreadsLoaded) onThreadsLoaded(fetched);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect Gmail.");
    } finally {
      setLoading(false);
    }
  };

  // Open Compose
  const handleOpenCompose = (replyToThread?: GmailThread, replyToMessage?: GmailEmailMessage) => {
    setSendSuccessMsg(null);
    setErrorMsg(null);
    if (replyToThread && replyToMessage) {
      setComposeThreadId(replyToThread.id);
      setComposeInReplyTo(replyToMessage.id);
      setComposeTo(replyToMessage.fromEmail || client.email || "");
      setComposeSubject(
        replyToThread.subject.startsWith("Re:") ? replyToThread.subject : `Re: ${replyToThread.subject}`
      );
      setComposeBody("");
    } else {
      setComposeThreadId(undefined);
      setComposeInReplyTo(undefined);
      setComposeTo(client.email || "");
      setComposeSubject("");
      setComposeBody("");
    }
    setComposeOpen(true);
  };

  // Send Email Handler
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      setErrorMsg("Please specify a recipient email address.");
      return;
    }
    if (!composeSubject.trim()) {
      setErrorMsg("Please provide an email subject.");
      return;
    }

    setSending(true);
    setErrorMsg(null);

    try {
      const result = await sendGmailMessage({
        to: composeTo,
        cc: composeCc || undefined,
        bcc: composeBcc || undefined,
        subject: composeSubject,
        body: composeBody,
        threadId: composeThreadId,
        inReplyTo: composeInReplyTo,
        freelancerId: profile.id,
      });

      if (result.success) {
        setSendSuccessMsg(`Email successfully sent to ${composeTo}!`);
        if (onEmailSentActivity) {
          onEmailSentActivity(composeSubject, composeTo);
        }
        setTimeout(() => {
          setComposeOpen(false);
          setSendSuccessMsg(null);
          loadThreads();
        }, 1200);
      }
    } catch (err: any) {
      console.error("Email send failed:", err);
      setErrorMsg(err.message || "Failed to send email. Please check your Gmail connection.");
    } finally {
      setSending(false);
    }
  };

  // AI Summarize Thread / Email (User Explicit Click)
  const handleAiSummarize = async (thread: GmailThread, singleMessage?: GmailEmailMessage) => {
    setAiLoading("summarize");
    setErrorMsg(null);
    try {
      const content = singleMessage ? singleMessage.bodyText || singleMessage.snippet : thread.snippet;
      const threadHistory = thread.messages.map((m) => ({
        from: m.fromName || m.fromEmail || m.from,
        body: m.bodyText || m.snippet,
        date: m.date,
        snippet: m.snippet,
      }));

      const summary = await summarizeEmailWithGemini({
        subject: thread.subject,
        content,
        threadMessages: threadHistory,
        freelancerId: profile.id,
      });

      setAiSummary(summary);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate AI summary.");
    } finally {
      setAiLoading(null);
    }
  };

  // AI Extract Action Items (User Explicit Click)
  const handleAiExtractActions = async (thread: GmailThread, message?: GmailEmailMessage) => {
    setAiLoading("actions");
    setErrorMsg(null);
    try {
      const targetMessage = message || thread.messages[thread.messages.length - 1];
      const content = targetMessage?.bodyText || targetMessage?.snippet || thread.snippet;

      const items = await extractActionItemsWithGemini({
        subject: thread.subject,
        content,
        senderName: targetMessage?.fromName || targetMessage?.fromEmail,
        clientName: client.companyName || client.contactPerson,
        freelancerId: profile.id,
      });

      setAiActionItems(items);
      setShowAiActionModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to extract action items.");
    } finally {
      setAiLoading(null);
    }
  };

  // AI Draft Reply (User Explicit Click)
  const handleAiDraftReply = async (thread: GmailThread, replyIntent?: string) => {
    setAiLoading("draft");
    setErrorMsg(null);
    try {
      const latest = thread.messages[thread.messages.length - 1];
      const content = latest?.bodyText || latest?.snippet || thread.snippet;

      const draft = await draftReplyWithGemini({
        subject: thread.subject,
        content,
        replyContext: replyIntent || "Polite, professional acknowledgement confirming next steps and timeline.",
        senderName: latest?.fromName || client.contactPerson,
        clientName: client.companyName || client.contactPerson,
        myName: profile.name,
        freelancerId: profile.id,
      });

      // Populate into the composer for manual user review & explicit send!
      setComposeThreadId(thread.id);
      setComposeInReplyTo(latest?.id);
      setComposeTo(latest?.fromEmail || client.email || "");
      setComposeSubject(draft.subject || `Re: ${thread.subject}`);
      setComposeBody(draft.body || "");
      setComposeOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate AI draft reply.");
    } finally {
      setAiLoading(null);
    }
  };

  // Create Follow-up Task helper from Action Item or Email
  const handleCreateFollowUp = (title: string, dueDate: string, priority: "Low" | "Medium" | "High", notes?: string) => {
    if (!onAddTask) return;
    onAddTask({
      title,
      dueDate: dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      priority: priority || "Medium",
      status: "Pending",
      completed: false,
      clientId: client.id,
      notes: notes || `Follow-up created from email with ${client.companyName}`,
      relatedEmailSubject: selectedThread?.subject || "Email Follow-up",
    });
    setTaskSuccessMsg(`Follow-up task created: "${title}"`);
    setTimeout(() => {
      setTaskSuccessMsg(null);
      setTaskModalOpen(false);
    }, 1500);
  };

  return (
    <div className="space-y-4" id="client-email-section-root">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-slate-900 tracking-tight">Gmail Conversations</h4>
            {isConnected && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {profile.gmailEmail}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {client.email ? `Matched to ${client.email}` : "No email configured for this client"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <>
              <button
                onClick={loadThreads}
                disabled={loading}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh mailbox threads"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => handleOpenCompose()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer"
                id="compose-client-email-btn"
              >
                <Send size={12} />
                <span>Send Email</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Matching suggestion banner */}
      {clientMatchSuggestion && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs flex items-center justify-between gap-3 text-amber-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Email thread from <strong>{clientMatchSuggestion.email}</strong> matches client{" "}
              <strong>{clientMatchSuggestion.suggestedClient?.companyName || clientMatchSuggestion.suggestedClient?.contactPerson}</strong>.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setClientMatchSuggestion(null)}
              className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
            >
              Ignore
            </button>
          </div>
        </motion.div>
      )}

      {/* Error display */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* PRO GATE FOR USERS WITHOUT GMAIL ENTITLEMENT */}
      {!hasGmailAccess && (
        <div className="p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl text-center space-y-3" id="client-email-pro-locked">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mx-auto flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Pro Feature
            </span>
            <h5 className="font-bold text-sm text-slate-900 mt-2">Gmail Integration is available with Freelancer CRM Pro.</h5>
            <p className="text-xs text-slate-500 mt-1">
              Upgrade to Pro to sync real email conversations with {client.contactPerson || client.companyName}, compose and reply directly, and create follow-up action items.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onTriggerUpgrade && onTriggerUpgrade("gmail_integration")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              id="upgrade-pro-client-email-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Upgrade to Pro</span>
            </button>
          </div>
        </div>
      )}

      {/* NOT CONNECTED STATE */}
      {hasGmailAccess && !isConnected && (
        <div className="p-6 bg-slate-50/70 border border-slate-200/80 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 mx-auto flex items-center justify-center">
            <Mail className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h5 className="font-bold text-sm text-slate-900">Connect Gmail to view client communications</h5>
            <p className="text-xs text-slate-500 mt-1">
              Seamlessly read relevant conversations, send proposals, draft replies with AI assistance, and convert emails into follow-up tasks.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleConnectGmail}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              id="connect-gmail-client-section-btn"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              <span>{loading ? "Connecting..." : "Connect Gmail"}</span>
            </button>
          </div>
        </div>
      )}

      {/* CONNECTED STATE */}
      {hasGmailAccess && isConnected && (
        <>
          {loading && threads.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Searching relevant client email threads...</p>
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
              <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h5 className="text-xs font-bold text-slate-700">No emails found for {client.email}</h5>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Send your first message or exchange emails with {client.contactPerson} to see threads here.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => handleOpenCompose()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Send size={12} />
                  <span>Send Email to {client.contactPerson}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {threads.map((th) => {
                const isSelected = selectedThread?.id === th.id;
                return (
                  <div
                    key={th.id}
                    className={`border rounded-xl transition-all overflow-hidden ${
                      isSelected
                        ? "border-indigo-400 bg-indigo-50/20 shadow-xs"
                        : th.isUnread
                        ? "border-indigo-200 bg-indigo-50/10 hover:border-indigo-300"
                        : "border-slate-200/80 bg-white hover:border-slate-300"
                    }`}
                  >
                    {/* Thread summary line */}
                    <div
                      onClick={() => {
                        setSelectedThread(isSelected ? null : th);
                        if (!isSelected && th.isUnread) {
                          markThreadAsRead(th.id);
                        }
                      }}
                      className="p-3.5 flex items-start justify-between gap-3 cursor-pointer select-none"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {th.isUnread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                          )}
                          <h5
                            className={`text-xs truncate ${
                              th.isUnread ? "font-black text-slate-900" : "font-bold text-slate-800"
                            }`}
                          >
                            {th.subject}
                          </h5>
                          {th.messages.length > 1 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-md">
                              {th.messages.length}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {th.snippet}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                          {new Date(th.lastMessageDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        {isSelected ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* EXPANDED THREAD DETAILS */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-4"
                        >
                          {/* AI Action Header Bar */}
                          <div className="p-3 bg-white border border-indigo-100 rounded-xl shadow-2xs flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                              <Sparkles size={14} className="text-indigo-600" />
                              <span>AI Assistant Tools:</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleAiSummarize(th)}
                                disabled={aiLoading === "summarize"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <Sparkles size={11} className={aiLoading === "summarize" ? "animate-spin" : ""} />
                                <span>{aiLoading === "summarize" ? "Summarizing..." : "Summarize Thread"}</span>
                              </button>
                              <button
                                onClick={() => handleAiExtractActions(th)}
                                disabled={aiLoading === "actions"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <FileCheck size={11} className={aiLoading === "actions" ? "animate-spin" : ""} />
                                <span>{aiLoading === "actions" ? "Extracting..." : "Extract Action Items"}</span>
                              </button>
                              <button
                                onClick={() => handleAiDraftReply(th)}
                                disabled={aiLoading === "draft"}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                <CornerUpLeft size={11} className={aiLoading === "draft" ? "animate-spin" : ""} />
                                <span>{aiLoading === "draft" ? "Drafting..." : "Draft AI Reply"}</span>
                              </button>
                            </div>
                          </div>

                          {/* AI Summary View Box */}
                          {aiSummary && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                                  <Sparkles size={12} className="text-indigo-600" />
                                  Executive Summary
                                </span>
                                <button
                                  onClick={() => setAiSummary(null)}
                                  className="text-indigo-500 hover:text-indigo-700 text-[10px] font-bold cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>
                              <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                                {aiSummary}
                              </div>
                            </motion.div>
                          )}

                          {/* Chronological Messages in this Thread */}
                          <div className="space-y-3">
                            {th.messages.map((msg, idx) => {
                              const isFromClient =
                                msg.fromEmail?.toLowerCase() === client.email?.toLowerCase();
                              return (
                                <div
                                  key={msg.id || idx}
                                  className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                          isFromClient
                                            ? "bg-blue-100 text-blue-700"
                                            : "bg-emerald-100 text-emerald-700"
                                        }`}
                                      >
                                        {(msg.fromName?.[0] || msg.fromEmail?.[0] || "U").toUpperCase()}
                                      </div>
                                      <div>
                                        <span className="text-xs font-bold text-slate-900 block leading-tight">
                                          {msg.fromName || msg.fromEmail}
                                        </span>
                                        <span className="text-[10px] text-slate-400">To: {msg.to}</span>
                                      </div>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {new Date(msg.date).toLocaleString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>

                                  {/* Body text / HTML */}
                                  <div className="text-xs text-slate-700 py-1 leading-relaxed break-words">
                                    {msg.bodyHtml ? (
                                      <div
                                        className="prose prose-xs max-w-none"
                                        dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                                      />
                                    ) : (
                                      <p className="whitespace-pre-line">{msg.bodyText || msg.snippet}</p>
                                    )}
                                  </div>

                                  {/* Message Action Footer */}
                                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px]">
                                    <button
                                      onClick={() => {
                                        setTaskTitle(`Follow up on: ${th.subject}`);
                                        setTaskNotes(`Email from ${msg.fromName || msg.fromEmail}: "${msg.snippet}"`);
                                        setTaskModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-bold transition-colors cursor-pointer"
                                    >
                                      <Calendar size={11} />
                                      <span>Create Follow-up</span>
                                    </button>

                                    <button
                                      onClick={() => handleOpenCompose(th, msg)}
                                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold transition-colors cursor-pointer"
                                    >
                                      <CornerUpLeft size={11} />
                                      <span>Reply to this message</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* AI EXTRACTED ACTION ITEMS MODAL */}
      <AnimatePresence>
        {showAiActionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                    <FileCheck size={16} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">Extracted Action Items</h4>
                </div>
                <button
                  onClick={() => setShowAiActionModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {aiActionItems.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No explicit action items found in this email message.
                </p>
              ) : (
                <div className="space-y-3">
                  {aiActionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{item.title}</span>
                          {item.notes && <p className="text-[11px] text-slate-500 mt-0.5">{item.notes}</p>}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            item.priority === "High"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Clock size={10} />
                          Target: {item.suggestedDueDate || "3 days"}
                        </span>
                        <button
                          onClick={() => {
                            handleCreateFollowUp(
                              item.title,
                              item.suggestedDueDate,
                              item.priority,
                              item.notes
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus size={10} />
                          <span>Add to Tasks</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {taskSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>{taskSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setShowAiActionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CREATE FOLLOW-UP TASK MODAL */}
      <AnimatePresence>
        {taskModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-bold text-sm text-slate-900">Create Follow-up Task</h4>
                <button
                  onClick={() => setTaskModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Task Title</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                    placeholder="e.g. Send proposal revision"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Due Date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(e: any) => setTaskPriority(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500 bg-white"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Context / Notes</label>
                  <textarea
                    rows={2}
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>
              </div>

              {taskSuccessMsg && (
                <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>{taskSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setTaskModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateFollowUp(taskTitle, taskDueDate, taskPriority, taskNotes)}
                  disabled={!taskTitle.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Save Follow-up
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SEND / REPLY EMAIL COMPOSER MODAL */}
      <AnimatePresence>
        {composeOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Send size={15} />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {composeThreadId ? "Reply via Gmail" : "Compose Email via Gmail"}
                  </h4>
                </div>
                <button
                  onClick={() => setComposeOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">To</label>
                  <input
                    type="email"
                    required
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Cc (optional)</label>
                    <input
                      type="text"
                      value={composeCc}
                      onChange={(e) => setComposeCc(e.target.value)}
                      placeholder="colleague@example.com"
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">Bcc (optional)</label>
                    <input
                      type="text"
                      value={composeBcc}
                      onChange={(e) => setComposeBcc(e.target.value)}
                      placeholder="archive@example.com"
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Project proposal & timeline discussion"
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">Message Body</label>
                    <span className="text-[10px] text-slate-400">Review & edit before sending</span>
                  </div>
                  <textarea
                    rows={7}
                    required
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Hi there,&#10;&#10;Following up on our discussion regarding the project deliverables..."
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-indigo-500 leading-relaxed font-sans"
                  />
                </div>

                {sendSuccessMsg && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    <span>{sendSuccessMsg}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl flex items-start gap-1.5">
                    <AlertCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Lock size={10} />
                    Sent securely through your authenticated Gmail
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setComposeOpen(false)}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={sending}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                      id="submit-send-email-btn"
                    >
                      {sending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{sending ? "Sending..." : "Send Email"}</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
