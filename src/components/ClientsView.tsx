import React, { useState, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Mail,
  Phone,
  Users,
  Check,
  X,
  ShieldAlert,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Link2,
  PlusCircle,
  ExternalLink,
  Clock,
  CheckSquare,
  FolderGit2,
  FolderUp,
  Notebook,
  Send,
  Building,
  Activity,
} from "lucide-react";
import {
  Client,
  FreelancerProfile,
  NoteRecord,
  Project,
  Task,
  Invoice,
  DocumentRecord,
  GmailThread,
} from "../types";
import ClientEmailSection from "./ClientEmailSection";
import ClientActivityTimeline from "./ClientActivityTimeline";

interface ClientsViewProps {
  clients: Client[];
  records?: NoteRecord[];
  projects?: Project[];
  tasks?: Task[];
  invoices?: Invoice[];
  documents?: DocumentRecord[];
  profile: FreelancerProfile;
  searchTerm: string;
  initialSelectedClientId?: string;
  onAddClient: (client: Omit<Client, "id" | "freelancerId" | "createdAt">) => void;
  onUpdateClient: (id: string, client: Partial<Client>) => void;
  onDeleteClient: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
  onViewClientRecords?: (clientId: string) => void;
  onUpdateProfile?: (fields: Partial<FreelancerProfile>) => void;
  onAddTask?: (task: Omit<Task, "id" | "freelancerId" | "createdAt">) => void;
  onToggleTask?: (id: string, completed: boolean) => void;
  onNavigateToView?: (view: string) => void;
}

function ClientsView({
  clients,
  records = [],
  projects = [],
  tasks = [],
  invoices = [],
  documents = [],
  profile,
  searchTerm,
  initialSelectedClientId,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onTriggerUpgrade,
  onViewClientRecords,
  onUpdateProfile,
  onAddTask,
  onToggleTask,
  onNavigateToView,
}: ClientsViewProps) {
  const isFree = profile.plan === "Free" && !profile.premium;
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Lead" | "Active" | "Inactive">("Active");

  // Important Links state
  const [importantLinks, setImportantLinks] = useState<{ id: string; name: string; url: string }[]>([]);
  const [linksCollapsed, setLinksCollapsed] = useState(true);
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({});
  const [selectedClientForDetails, setSelectedClientForDetails] = useState<Client | null>(null);
  const [detailTab, setDetailTab] = useState<
    "Overview" | "Emails" | "Activity" | "Projects" | "Tasks" | "Invoices" | "Documents" | "Notes"
  >("Overview");
  const [clientThreads, setClientThreads] = useState<GmailThread[]>([]);

  // Automatically select client if initialSelectedClientId is provided
  useEffect(() => {
    if (initialSelectedClientId) {
      const found = clients.find((c) => c.id === initialSelectedClientId);
      if (found) {
        setSelectedClientForDetails(found);
      }
    }
  }, [initialSelectedClientId, clients]);

  // Filter & Search local state
  const [filterStatus, setFilterStatus] = useState<"All" | "Lead" | "Active" | "Inactive">("All");

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clients.filter((c) => {
      const matchesSearch =
        c.companyName.toLowerCase().includes(term) ||
        c.contactPerson.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term);
      const matchesFilter = filterStatus === "All" || c.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [clients, searchTerm, filterStatus]);

  const resetForm = () => {
    setCompanyName("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setNotes("");
    setStatus("Active");
    setImportantLinks([]);
    setLinksCollapsed(true);
    setUrlErrors({});
  };

  const handleOpenAdd = () => {
    if (isFree && clients.length >= 10) {
      onTriggerUpgrade("client_limit");
      return;
    }
    resetForm();
    setIsAdding(true);
  };

  const isValidUrl = (val: string) => {
    if (!val.trim()) return true;
    try {
      const testUrl = val.includes("://") ? val : "https://" + val;
      const url = new URL(testUrl);
      return url.host.includes(".");
    } catch {
      return false;
    }
  };

  const formatUrl = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const handleAddLinkField = () => {
    const newId = Math.random().toString(36).substring(2, 9);
    setImportantLinks([...importantLinks, { id: newId, name: "", url: "" }]);
  };

  const handleDeleteLinkField = (id: string) => {
    setImportantLinks(importantLinks.filter(link => link.id !== id));
    const newErrors = { ...urlErrors };
    delete newErrors[id];
    setUrlErrors(newErrors);
  };

  const handleUpdateLinkField = (id: string, field: "name" | "url", value: string) => {
    setImportantLinks(importantLinks.map(link => {
      if (link.id === id) {
        const updatedLink = { ...link, [field]: value };
        if (field === "url") {
          if (value && !isValidUrl(value)) {
            setUrlErrors(prev => ({ ...prev, [id]: "Please enter a valid URL (e.g. https://example.com)" }));
          } else {
            setUrlErrors(prev => {
              const copy = { ...prev };
              delete copy[id];
              return copy;
            });
          }
        }
        return updatedLink;
      }
      return link;
    }));
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim()) return;

    const linksToSave = importantLinks
      .filter((link) => link.name.trim() || link.url.trim())
      .map((link) => ({
        id: link.id,
        name: link.name.trim() || "Untitled Link",
        url: formatUrl(link.url),
      }));

    const hasInvalidUrl = linksToSave.some((link) => !isValidUrl(link.url));
    if (hasInvalidUrl) {
      alert("Please fix the invalid URLs before saving.");
      return;
    }

    onAddClient({
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      status,
      importantLinks: linksToSave,
    });
    setIsAdding(false);
    resetForm();
  };

  const handleStartEdit = (client: Client) => {
    setEditingClient(client);
    setCompanyName(client.companyName);
    setContactPerson(client.contactPerson);
    setEmail(client.email);
    setPhone(client.phone);
    setNotes(client.notes);
    setStatus(client.status);
    setImportantLinks(client.importantLinks || []);
    setLinksCollapsed(false);
    setUrlErrors({});
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !companyName.trim() || !contactPerson.trim()) return;

    const linksToSave = importantLinks
      .filter((link) => link.name.trim() || link.url.trim())
      .map((link) => ({
        id: link.id,
        name: link.name.trim() || "Untitled Link",
        url: formatUrl(link.url),
      }));

    const hasInvalidUrl = linksToSave.some((link) => !isValidUrl(link.url));
    if (hasInvalidUrl) {
      alert("Please fix the invalid URLs before saving.");
      return;
    }

    onUpdateClient(editingClient.id, {
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      status,
      importantLinks: linksToSave,
    });
    setEditingClient(null);
  };

  return (
    <div className="space-y-6">
      {/* Free Plan Client Limit Banner */}
      {isFree && clients.length > 10 && (
        <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/80 rounded-2xl text-indigo-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-600 text-white rounded-xl shrink-0 shadow-xs">
              <Sparkles size={15} />
            </div>
            <div>
              <p className="font-bold text-indigo-950 text-xs">
                Your {clients.length} existing clients are preserved
              </p>
              <p className="text-[11px] text-indigo-700/90 mt-0.5">
                The Free Plan limit is now 10 clients. All your existing client data is safe and fully accessible. Upgrade to Pro to add new clients.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTriggerUpgrade("client_limit")}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-xs shrink-0 cursor-pointer shadow-sm shadow-indigo-600/20"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {isFree && clients.length === 10 && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-600 text-white rounded-xl shrink-0 shadow-xs">
              <ShieldAlert size={15} />
            </div>
            <div>
              <p className="font-bold text-amber-950 text-xs">
                You've reached the 10-client limit on the Free Plan
              </p>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Upgrade your plan to add more clients and unlock unlimited workspace capabilities.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onTriggerUpgrade("client_limit")}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all text-xs shrink-0 cursor-pointer shadow-sm shadow-amber-600/20"
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {["All", "Active", "Lead", "Inactive"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer ${
                filterStatus === tab
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                  : "glass-item border border-white/20 text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab} ({tab === "All" ? clients.length : clients.filter((c) => c.status === tab).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isFree && (
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <span>
                Clients: <strong>{clients.length}</strong>{clients.length <= 10 ? "/10" : " (Limit: 10)"}
              </span>
              {clients.length > 10 && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
                  Preserved
                </span>
              )}
            </span>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
          >
            <Plus size={14} />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Adding / Editing Modal Panel */}
      <AnimatePresence>
        {(isAdding || editingClient) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  {isAdding ? "Register New Client" : `Edit Details: ${editingClient?.companyName}`}
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClient(null);
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </motion.button>
              </div>

              <form onSubmit={isAdding ? handleSubmitAdd : handleSubmitEdit} className="p-5 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                    placeholder="e.g. Acme Tech Solutions"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Primary Rep / Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                    placeholder="e.g. Rachel Green"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                      placeholder="rachel@acme.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                      placeholder="+1 (555) 321-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Account Relationship Status</label>
                  <div className="flex gap-2">
                    {["Active", "Lead", "Inactive"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s as any)}
                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                          status === s
                            ? "border-indigo-500 bg-indigo-50 text-indigo-600"
                            : "border-slate-200 bg-transparent text-slate-500"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Collapsible Important Links Section */}
                <div className="border border-slate-200/60 rounded-xl overflow-hidden bg-slate-500/5">
                  <button
                    type="button"
                    onClick={() => setLinksCollapsed(!linksCollapsed)}
                    className="w-full flex items-center justify-between p-3 text-left font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Link2 size={14} className="text-indigo-600" />
                      <span>Important Links {importantLinks.length > 0 ? `(${importantLinks.length})` : ""}</span>
                    </div>
                    {linksCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>

                  {!linksCollapsed && (
                    <div className="p-3 border-t border-slate-200/50 space-y-3 bg-slate-50/50">
                      {importantLinks.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic text-center py-2">
                          No links added yet. Click below to add a link.
                        </p>
                      ) : (
                        <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                          {importantLinks.map((link, idx) => (
                            <div key={link.id} className="p-2.5 bg-white border border-slate-100 rounded-xl space-y-2 relative shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Link #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteLinkField(link.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove Link"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">Link Name</label>
                                  <input
                                    type="text"
                                    required
                                    value={link.name}
                                    onChange={(e) => handleUpdateLinkField(link.id, "name", e.target.value)}
                                    className="w-full py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                    placeholder="e.g. Figma Design"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">URL</label>
                                  <input
                                    type="text"
                                    required
                                    value={link.url}
                                    onChange={(e) => handleUpdateLinkField(link.id, "url", e.target.value)}
                                    className={`w-full py-1 px-2.5 bg-slate-50 border rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500 ${
                                      urlErrors[link.id] ? "border-red-400" : "border-slate-200"
                                    }`}
                                    placeholder="e.g. figma.com/file/..."
                                  />
                                  {urlErrors[link.id] && (
                                    <span className="text-[9px] text-red-500 mt-0.5 block">{urlErrors[link.id]}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAddLinkField}
                        className="w-full py-1.5 border border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-650 hover:bg-indigo-50/50 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <PlusCircle size={13} />
                        <span>Add Another Link</span>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Internal Relationship Logs / Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none resize-none"
                    placeholder="Hourly rates, past contracts discussion, preferred tools..."
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingClient(null);
                    }}
                    className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {isAdding ? "Add Client" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">
            {clients.length === 0 ? "No Clients in Workspace" : "No matching clients found"}
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {clients.length === 0
              ? "Your client ledger is currently empty. Get started by cataloging your first corporate or independent client partner."
              : "Refine your keyword queries or clear status filters to locate specific client entities."}
          </p>
          {clients.length === 0 && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
            >
              Add First Client
            </button>
          )}
        </div>
      ) : (
        /* Clients List/Grid */
        <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredClients.map((client) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                key={client.id}
                onClick={() => setSelectedClientForDetails(client)}
                className="p-5 glass-panel glass-highlight rounded-2xl hover:border-indigo-300 transition-all flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-base line-clamp-1">
                        {client.companyName}
                      </h4>
                      <span className="text-xs font-medium text-slate-400 mt-0.5 block">
                        Rep: {client.contactPerson}
                      </span>
                    </div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      client.status === "Active"
                        ? "bg-emerald-500/10 text-emerald-650"
                        : client.status === "Lead"
                        ? "bg-violet-500/10 text-violet-650"
                        : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {client.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-black/5 pt-2.5 mb-4">
                    {client.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail size={13} className="text-slate-400" />
                        <a href={`mailto:${client.email}`} className="hover:underline hover:text-indigo-650 line-clamp-1" onClick={(e) => e.stopPropagation()}>
                          {client.email}
                        </a>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-slate-400" />
                        <span className="font-mono">{client.phone}</span>
                      </div>
                    )}
                    {client.notes && (
                      <p className="text-[11px] text-slate-450 mt-2 bg-slate-500/5 p-2 rounded-lg italic line-clamp-2">
                        "{client.notes}"
                      </p>
                    )}

                    {client.importantLinks && client.importantLinks.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-slate-250/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Important Links</span>
                        <div className="flex flex-wrap gap-1.5">
                          {client.importantLinks.map((link) => (
                            <a
                              key={link.id}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-55/40 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-lg text-[10px] font-semibold transition-all border border-indigo-100/30"
                            >
                              <Link2 size={10} />
                              <span className="max-w-[80px] truncate">{link.name}</span>
                              <ExternalLink size={8} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 border-t border-black/5 pt-3 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(client);
                    }}
                    className="p-1 px-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Remove ${client.companyName} from database?`)) {
                        onDeleteClient(client.id);
                      }
                    }}
                    className="p-1 px-2.5 border border-red-200 text-red-500 hover:text-white hover:bg-red-500 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={11} />
                    <span>Delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      {/* Smart Client Profile Details Modal */}
      <AnimatePresence>
        {selectedClientForDetails && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              {/* Top Banner Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm">
                    {selectedClientForDetails.companyName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base sm:text-lg text-slate-800">
                        {selectedClientForDetails.companyName}
                      </h3>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          selectedClientForDetails.status === "Active"
                            ? "bg-emerald-500/10 text-emerald-700"
                            : selectedClientForDetails.status === "Lead"
                            ? "bg-violet-500/10 text-violet-700"
                            : "bg-slate-500/10 text-slate-600"
                        }`}
                      >
                        {selectedClientForDetails.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{selectedClientForDetails.contactPerson}</span>
                      {selectedClientForDetails.email && (
                        <>
                          <span>&bull;</span>
                          <span className="font-medium text-slate-600">{selectedClientForDetails.email}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const client = selectedClientForDetails;
                      setSelectedClientForDetails(null);
                      handleStartEdit(client);
                    }}
                    className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => setSelectedClientForDetails(null)}
                    className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1 px-4 border-b border-slate-200 bg-white overflow-x-auto no-scrollbar shrink-0 text-xs font-semibold text-slate-600">
                {[
                  { id: "Overview", label: "Overview", icon: Building },
                  { id: "Emails", label: "Gmail & AI", icon: Mail },
                  { id: "Activity", label: "Activity Timeline", icon: Activity },
                  { id: "Projects", label: "Projects", icon: FolderGit2 },
                  { id: "Tasks", label: "Tasks & Follow-ups", icon: CheckSquare },
                  { id: "Invoices", label: "Invoices", icon: FileText },
                  { id: "Documents", label: "Documents", icon: FolderUp },
                  { id: "Notes", label: "Notes & Voice", icon: Notebook },
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = detailTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setDetailTab(t.id as any)}
                      className={`flex items-center gap-1.5 py-3 px-3 border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? "border-indigo-600 text-indigo-600 font-bold bg-indigo-50/40"
                          : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <Icon size={14} className={isActive ? "text-indigo-600" : "text-slate-400"} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Body */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/40 text-sm space-y-5">
                {/* 1. Overview Tab */}
                {detailTab === "Overview" && (
                  <div className="space-y-5">
                    {/* Representative Info */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Contact Information
                      </h4>
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-semibold block">Contact Person</span>
                          <span className="font-bold text-slate-800 text-xs">{selectedClientForDetails.contactPerson}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-semibold block">Email Address</span>
                          {selectedClientForDetails.email ? (
                            <a
                              href={`mailto:${selectedClientForDetails.email}`}
                              className="text-xs font-bold text-indigo-600 hover:underline truncate block"
                            >
                              {selectedClientForDetails.email}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No email provided</span>
                          )}
                        </div>
                        <div className="p-3 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 font-semibold block">Phone</span>
                          {selectedClientForDetails.phone ? (
                            <span className="text-xs font-mono font-bold text-slate-800">
                              {selectedClientForDetails.phone}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No phone provided</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Important Links Section */}
                    <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Important Links & Resources
                        </h4>
                      </div>
                      {selectedClientForDetails.importantLinks && selectedClientForDetails.importantLinks.length > 0 ? (
                        <div className="grid sm:grid-cols-2 gap-2">
                          {selectedClientForDetails.importantLinks.map((link) => (
                            <div
                              key={link.id}
                              className="flex items-center justify-between p-2.5 bg-indigo-50/30 border border-indigo-100 rounded-lg"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <Link2 size={13} className="text-indigo-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 text-xs truncate">{link.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono truncate">{link.url}</p>
                                </div>
                              </div>
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold shrink-0 flex items-center gap-1"
                              >
                                <span>Open</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic text-center py-2">
                          No links attached yet. Edit client to add shared drives, project boards, or briefs.
                        </p>
                      )}
                    </div>

                    {/* Internal Notes */}
                    {selectedClientForDetails.notes && (
                      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                          Internal Notes & Context
                        </h4>
                        <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                          {selectedClientForDetails.notes}
                        </p>
                      </div>
                    )}

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Active Projects</span>
                        <span className="text-lg font-extrabold text-indigo-600">
                          {projects.filter((p) => p.clientId === selectedClientForDetails.id).length}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Open Tasks</span>
                        <span className="text-lg font-extrabold text-amber-600">
                          {tasks.filter((t) => t.clientId === selectedClientForDetails.id && !t.completed).length}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Invoices</span>
                        <span className="text-lg font-extrabold text-emerald-600">
                          {invoices.filter((i) => i.clientId === selectedClientForDetails.id).length}
                        </span>
                      </div>
                      <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 font-semibold block uppercase">Documents</span>
                        <span className="text-lg font-extrabold text-slate-700">
                          {documents.length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Emails Tab */}
                {detailTab === "Emails" && (
                  <ClientEmailSection
                    client={selectedClientForDetails}
                    profile={profile}
                    onUpdateProfile={onUpdateProfile || (() => {})}
                    onTriggerUpgrade={onTriggerUpgrade}
                    onAddTask={(task) => {
                      if (onAddTask) {
                        onAddTask(task);
                      }
                    }}
                    onThreadsLoaded={(threads) => setClientThreads(threads)}
                  />
                )}

                {/* 3. Activity Timeline Tab */}
                {detailTab === "Activity" && (
                  <ClientActivityTimeline
                    client={selectedClientForDetails}
                    threads={clientThreads}
                    invoices={invoices}
                    tasks={tasks}
                    projects={projects}
                    records={records}
                    documents={documents}
                  />
                )}

                {/* 4. Projects Tab */}
                {detailTab === "Projects" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Client Projects
                      </h4>
                      {onNavigateToView && (
                        <button
                          onClick={() => {
                            setSelectedClientForDetails(null);
                            onNavigateToView("Projects");
                          }}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Manage Projects &rarr;</span>
                        </button>
                      )}
                    </div>
                    {(() => {
                      const clientProjects = projects.filter((p) => p.clientId === selectedClientForDetails.id);
                      if (clientProjects.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                            No projects linked to this client yet.
                          </div>
                        );
                      }
                      return (
                        <div className="grid gap-2.5">
                          {clientProjects.map((proj) => (
                            <div
                              key={proj.id}
                              className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-200 transition-colors"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-800">{proj.title}</span>
                                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full font-semibold text-slate-600">
                                    {proj.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{proj.notes}</p>
                              </div>
                              <span className="text-xs font-bold text-indigo-600 font-mono">
                                {profile.currency} {proj.budget?.toLocaleString() || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 5. Tasks & Follow-ups Tab */}
                {detailTab === "Tasks" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Client Tasks & Follow-ups
                      </h4>
                      {onNavigateToView && (
                        <button
                          onClick={() => {
                            setSelectedClientForDetails(null);
                            onNavigateToView("Tasks");
                          }}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Manage Tasks &rarr;</span>
                        </button>
                      )}
                    </div>
                    {(() => {
                      const clientTasks = tasks.filter((t) => t.clientId === selectedClientForDetails.id);
                      if (clientTasks.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                            No tasks or follow-ups created for this client yet.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {clientTasks.map((t) => (
                            <div
                              key={t.id}
                              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={t.completed}
                                  onChange={(e) => onToggleTask && onToggleTask(t.id, e.target.checked)}
                                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                />
                                <div>
                                  <span
                                    className={`text-xs font-semibold ${
                                      t.completed ? "line-through text-slate-400" : "text-slate-800"
                                    }`}
                                  >
                                    {t.title}
                                  </span>
                                  {t.dueDate && (
                                    <span className="text-[10px] text-slate-400 block">
                                      Due: {new Date(t.dueDate).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  t.priority === "High"
                                    ? "bg-red-50 text-red-600"
                                    : t.priority === "Medium"
                                    ? "bg-amber-50 text-amber-600"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {t.priority}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 6. Invoices Tab */}
                {detailTab === "Invoices" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Client Invoices
                      </h4>
                      {onNavigateToView && (
                        <button
                          onClick={() => {
                            setSelectedClientForDetails(null);
                            onNavigateToView("Invoices");
                          }}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Manage Invoices &rarr;</span>
                        </button>
                      )}
                    </div>
                    {(() => {
                      const clientInvoices = invoices.filter((i) => i.clientId === selectedClientForDetails.id);
                      if (clientInvoices.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                            No invoices generated for this client yet.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {clientInvoices.map((inv) => (
                            <div
                              key={inv.id}
                              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-800">
                                    Invoice #{inv.id.substring(0, 6)}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      inv.status === "Paid"
                                        ? "bg-emerald-50 text-emerald-700"
                                        : inv.status === "Overdue"
                                        ? "bg-red-50 text-red-600"
                                        : "bg-amber-50 text-amber-600"
                                    }`}
                                  >
                                    {inv.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  Issued: {new Date(inv.issueDate || inv.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="font-bold text-xs text-slate-800 font-mono">
                                {profile.currency}{" "}
                                {((inv.services || []).reduce((acc, s) => acc + (s.quantity || 0) * (s.rate || 0), 0) * (1 + (inv.taxRate || 0) / 100)).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 7. Documents Tab */}
                {detailTab === "Documents" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        CRM Documents & Briefs
                      </h4>
                      {onNavigateToView && (
                        <button
                          onClick={() => {
                            setSelectedClientForDetails(null);
                            onNavigateToView("Documents");
                          }}
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <span>Manage Documents &rarr;</span>
                        </button>
                      )}
                    </div>
                    {(() => {
                      if (documents.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                            No documents attached yet.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {documents.map((doc) => (
                            <div
                              key={doc.id}
                              className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FolderUp size={16} className="text-indigo-600 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-bold text-xs text-slate-800 truncate block">
                                    {doc.title}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {doc.category} &bull; {doc.fileType?.toUpperCase() || "FILE"} &bull;{" "}
                                    {new Date(doc.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              {doc.content && (
                                <button
                                  onClick={() => {
                                    if (onNavigateToView) {
                                      setSelectedClientForDetails(null);
                                      onNavigateToView("Documents");
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                                >
                                  <span>View in Docs</span>
                                  <ExternalLink size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 8. Notes & Voice Tab */}
                {detailTab === "Notes" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Client Notes & Voice Recordings
                      </h4>
                      {onViewClientRecords && (
                        <button
                          onClick={() => {
                            const cId = selectedClientForDetails.id;
                            setSelectedClientForDetails(null);
                            onViewClientRecords(cId);
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Open All in Notes & Voice &rarr;</span>
                        </button>
                      )}
                    </div>
                    {(() => {
                      const clientRecords = records.filter((r) => r.clientId === selectedClientForDetails.id);
                      if (clientRecords.length === 0) {
                        return (
                          <div className="p-6 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                            No notes or voice recordings for this client yet.
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {clientRecords.map((r) => (
                            <div key={r.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-800">{r.title || "Untitled Record"}</span>
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                                  {r.type === "voice_recording" ? "Voice" : "Note"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-2">{r.content || r.description}</p>
                              <span className="text-[10px] text-slate-400 block">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400">
                  Client ID: <span className="font-mono text-slate-600">{selectedClientForDetails.id}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const client = selectedClientForDetails;
                      setSelectedClientForDetails(null);
                      handleStartEdit(client);
                    }}
                    className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Edit3 size={13} />
                    <span>Edit Details</span>
                  </button>
                  <button
                    onClick={() => setSelectedClientForDetails(null)}
                    className="py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(ClientsView);
