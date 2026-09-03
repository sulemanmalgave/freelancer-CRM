import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Users,
  FolderGit2,
  CheckSquare,
  FileText,
  Star,
  FolderUp,
  Notebook,
  Mail,
  ArrowRight,
  X,
  Sparkles,
  Command,
  Clock,
  FileCheck2,
} from "lucide-react";
import {
  Client,
  Project,
  Task,
  Invoice,
  Lead,
  DocumentRecord,
  NoteRecord,
  Proposal,
  GmailThread,
  FreelancerProfile,
} from "../types";
import { searchGmail } from "../services/gmailService";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  proposals?: Proposal[];
  leads: Lead[];
  documents: DocumentRecord[];
  records: NoteRecord[];
  profile: FreelancerProfile;
  onNavigate: (view: string, targetId?: string) => void;
  onSelectClient?: (clientId: string) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  clients,
  projects,
  tasks,
  invoices,
  proposals = [],
  leads,
  documents,
  records,
  profile,
  onNavigate,
  onSelectClient,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [emailResults, setEmailResults] = useState<GmailThread[]>([]);
  const [searchingEmails, setSearchingEmails] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery("");
      setEmailResults([]);
    }
  }, [isOpen]);

  // Debounced search for Gmail messages when connected
  useEffect(() => {
    if (!isOpen || !query.trim() || query.length < 2 || !profile.gmailConnected) {
      setEmailResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingEmails(true);
      try {
        const results = await searchGmail(query, 5);
        setEmailResults(results);
      } catch {
        setEmailResults([]);
      } finally {
        setSearchingEmails(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [isOpen, query, profile.gmailConnected]);

  const {
    matchedClients,
    matchedProjects,
    matchedTasks,
    matchedInvoices,
    matchedProposals,
    matchedLeads,
    matchedDocs,
    matchedRecords,
    totalResults,
  } = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      return {
        matchedClients: [],
        matchedProjects: [],
        matchedTasks: [],
        matchedInvoices: [],
        matchedProposals: [],
        matchedLeads: [],
        matchedDocs: [],
        matchedRecords: [],
        totalResults: emailResults.length,
      };
    }

    const mClients = clients.filter(
      (c) =>
        c.companyName?.toLowerCase().includes(q) ||
        c.contactPerson?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );

    const mProjects = projects.filter(
      (p) => p.title?.toLowerCase().includes(q) || p.notes?.toLowerCase().includes(q)
    );

    const mTasks = tasks.filter(
      (t) => t.title?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)
    );

    const mInvoices = invoices.filter(
      (i) =>
        i.invoiceNumber?.toLowerCase().includes(q) ||
        i.notes?.toLowerCase().includes(q) ||
        i.status?.toLowerCase().includes(q)
    );

    const mProposals = proposals.filter(
      (p) =>
        p.proposalNumber?.toLowerCase().includes(q) ||
        p.title?.toLowerCase().includes(q) ||
        p.notes?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
    );

    const mLeads = leads.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.companyName?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q)
    );

    const mDocs = documents.filter(
      (d) => d.title?.toLowerCase().includes(q) || d.category?.toLowerCase().includes(q)
    );

    const mRecords = records.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.content?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );

    const count =
      mClients.length +
      mProjects.length +
      mTasks.length +
      mInvoices.length +
      mProposals.length +
      mLeads.length +
      mDocs.length +
      mRecords.length +
      emailResults.length;

    return {
      matchedClients: mClients,
      matchedProjects: mProjects,
      matchedTasks: mTasks,
      matchedInvoices: mInvoices,
      matchedProposals: mProposals,
      matchedLeads: mLeads,
      matchedDocs: mDocs,
      matchedRecords: mRecords,
      totalResults: count,
    };
  }, [query, clients, projects, tasks, invoices, proposals, leads, documents, records, emailResults.length]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15 }}
          className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
          id="global-search-modal-container"
        >
          {/* Top Search Bar */}
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search clients, projects, tasks, invoices, leads, notes, and emails..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full text-sm font-medium focus:outline-none text-slate-800 placeholder:text-slate-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
            <kbd className="hidden sm:inline-block text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!query.trim() ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Search className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">Type a keyword to start searching</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Instant search across all your clients, projects, follow-ups, invoices, and Gmail messages.
                </p>
              </div>
            ) : totalResults === 0 && !searchingEmails ? (
              <div className="py-8 text-center text-slate-400 space-y-1">
                <p className="text-xs font-bold text-slate-700">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-slate-400">Try searching for a client name, invoice number, or project.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. Clients */}
                {matchedClients.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <Users size={11} />
                      Clients ({matchedClients.length})
                    </span>
                    <div className="space-y-1">
                      {matchedClients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => {
                            if (onSelectClient) onSelectClient(client.id);
                            onNavigate("Clients", client.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {client.companyName || client.contactPerson}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {client.contactPerson} &middot; {client.email || "No email"}
                            </span>
                          </div>
                          <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Projects */}
                {matchedProjects.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <FolderGit2 size={11} />
                      Projects ({matchedProjects.length})
                    </span>
                    <div className="space-y-1">
                      {matchedProjects.map((proj) => (
                        <div
                          key={proj.id}
                          onClick={() => {
                            onNavigate("Projects", proj.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {proj.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Budget: ${proj.budget?.toLocaleString() || "0"} &middot; Status: {proj.status}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                            {proj.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Invoices */}
                {matchedInvoices.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <FileText size={11} />
                      Invoices ({matchedInvoices.length})
                    </span>
                    <div className="space-y-1">
                      {matchedInvoices.map((inv) => (
                        <div
                          key={inv.id}
                          onClick={() => {
                            onNavigate("Invoices", inv.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {inv.invoiceNumber}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Due: {inv.dueDate || "N/A"} &middot; Status: {inv.status}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              inv.status === "Paid"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proposals */}
                {matchedProposals.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <FileCheck2 size={11} />
                      Proposals ({matchedProposals.length})
                    </span>
                    <div className="space-y-1">
                      {matchedProposals.map((prop) => (
                        <div
                          key={prop.id}
                          onClick={() => {
                            onNavigate("Proposals", prop.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              #{prop.proposalNumber} - {prop.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Valid Until: {prop.validUntil || "N/A"} &middot; Status: {prop.status}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              prop.status === "Accepted"
                                ? "bg-emerald-50 text-emerald-700"
                                : prop.status === "Sent"
                                ? "bg-sky-50 text-sky-700"
                                : "bg-purple-50 text-purple-700"
                            }`}
                          >
                            {prop.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Tasks & Follow-ups */}
                {matchedTasks.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <CheckSquare size={11} />
                      Tasks & Follow-ups ({matchedTasks.length})
                    </span>
                    <div className="space-y-1">
                      {matchedTasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => {
                            onNavigate("Tasks", task.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span
                              className={`text-xs font-bold ${
                                task.completed
                                  ? "line-through text-slate-400"
                                  : "text-slate-900 group-hover:text-indigo-600"
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Due: {task.dueDate || "No date"} &middot; Priority: {task.priority}
                            </span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              task.priority === "High"
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Leads */}
                {matchedLeads.length > 0 && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <Star size={11} />
                      Leads ({matchedLeads.length})
                    </span>
                    <div className="space-y-1">
                      {matchedLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => {
                            onNavigate("Leads", lead.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {lead.name} ({lead.companyName})
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Source: {lead.source} &middot; Status: {lead.status}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                            {lead.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Documents & Notes */}
                {(matchedDocs.length > 0 || matchedRecords.length > 0) && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <Notebook size={11} />
                      Documents & Notes ({matchedDocs.length + matchedRecords.length})
                    </span>
                    <div className="space-y-1">
                      {matchedDocs.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => {
                            onNavigate("Documents", doc.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {doc.title}
                            </span>
                            <span className="text-[11px] text-slate-500 block">Category: {doc.category}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-700 rounded-md">
                            {doc.category}
                          </span>
                        </div>
                      ))}
                      {matchedRecords.map((rec) => (
                        <div
                          key={rec.id}
                          onClick={() => {
                            onNavigate("Notes & Records", rec.id);
                            onClose();
                          }}
                          className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600">
                              {rec.title || (rec.type === "voice_recording" ? "Voice Memo" : "Note")}
                            </span>
                            <span className="text-[11px] text-slate-500 block line-clamp-1">
                              {rec.content || rec.description || "Voice recording"}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                            {rec.type === "voice_recording" ? "Voice" : "Note"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 7. Gmail Emails */}
                {(emailResults.length > 0 || searchingEmails) && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1.5">
                      <Mail size={11} />
                      Gmail Messages {searchingEmails ? "(Searching...)" : `(${emailResults.length})`}
                    </span>
                    {emailResults.length > 0 && (
                      <div className="space-y-1">
                        {emailResults.map((th) => (
                          <div
                            key={th.id}
                            onClick={() => {
                              // Find matching client if any
                              const matched = clients.find((c) =>
                                th.messages.some(
                                  (m) =>
                                    m.fromEmail?.toLowerCase() === c.email?.toLowerCase() ||
                                    m.to?.toLowerCase().includes(c.email?.toLowerCase())
                                )
                              );
                              if (matched) {
                                if (onSelectClient) onSelectClient(matched.id);
                                onNavigate("Clients", matched.id);
                              } else {
                                onNavigate("Clients");
                              }
                              onClose();
                            }}
                            className="p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 block truncate">
                                {th.subject}
                              </span>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {th.snippet}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                              {new Date(th.lastMessageDate).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
