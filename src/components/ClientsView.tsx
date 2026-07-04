import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Edit3, Trash2, Mail, Phone, Users, Check, X, ShieldAlert, FileText, Sparkles, ChevronDown, ChevronUp, Link2, PlusCircle, ExternalLink } from "lucide-react";
import { Client, FreelancerProfile } from "../types";

interface ClientsViewProps {
  clients: Client[];
  profile: FreelancerProfile;
  searchTerm: string;
  onAddClient: (client: Omit<Client, "id" | "freelancerId" | "createdAt">) => void;
  onUpdateClient: (id: string, client: Partial<Client>) => void;
  onDeleteClient: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
}

export default function ClientsView({
  clients,
  profile,
  searchTerm,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onTriggerUpgrade,
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

  // Filter & Search local state
  const [filterStatus, setFilterStatus] = useState<"All" | "Lead" | "Active" | "Inactive">("All");

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

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
    if (isFree && clients.length >= 20) {
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
            <span className="text-[11px] text-slate-400 font-medium">
              Clients: <strong>{clients.length}/20</strong>
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  {isAdding ? "Register New Client" : `Edit Details: ${editingClient?.companyName}`}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingClient(null);
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
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
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <Users className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No matching clients found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {clients.length === 0
              ? "Your client ledger is currently empty. Get started by cataloging your first corporate or independent client partner."
              : "Refine your keyword queries or clean status filters to locate specific client entities."}
          </p>
          {clients.length === 0 && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all"
            >
              Add First Client
            </button>
          )}
        </div>
      ) : (
        /* Clients List/Grid */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <motion.div
              layout
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
                  className="p-1 px-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
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
                  className="p-1 px-2.5 border border-red-200 text-red-500 hover:text-white hover:bg-red-500 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                >
                  <Trash2 size={11} />
                  <span>Delete</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      {/* Client Details Modal */}
      <AnimatePresence>
        {selectedClientForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    selectedClientForDetails.status === "Active"
                      ? "bg-emerald-500/10 text-emerald-755"
                      : selectedClientForDetails.status === "Lead"
                      ? "bg-violet-500/10 text-violet-755"
                      : "bg-slate-500/10 text-slate-400"
                  }`}>
                    {selectedClientForDetails.status}
                  </span>
                  <h3 className="font-extrabold text-lg text-slate-800 mt-1">
                    {selectedClientForDetails.companyName}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedClientForDetails(null)}
                  className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto text-sm">
                {/* Contact Representative */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Representative Details</h4>
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2.5">
                    <p className="text-slate-800 font-semibold flex items-center gap-2">
                      <Users size={14} className="text-slate-400" />
                      <span>{selectedClientForDetails.contactPerson}</span>
                    </p>
                    {selectedClientForDetails.email && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail size={14} className="text-slate-400" />
                        <a href={`mailto:${selectedClientForDetails.email}`} className="hover:underline hover:text-indigo-650" onClick={(e) => e.stopPropagation()}>
                          {selectedClientForDetails.email}
                        </a>
                      </div>
                    )}
                    {selectedClientForDetails.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        <span className="font-mono">{selectedClientForDetails.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Important Links Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Important Links</h4>
                  {selectedClientForDetails.importantLinks && selectedClientForDetails.importantLinks.length > 0 ? (
                    <div className="space-y-2">
                      {selectedClientForDetails.importantLinks.map((link) => (
                        <div key={link.id} className="flex items-center justify-between p-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl hover:bg-indigo-50/50 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                              <Link2 size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-xs truncate">{link.name}</p>
                              <p className="text-[10px] text-slate-450 truncate font-mono">{link.url}</p>
                            </div>
                          </div>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all hover:scale-[1.02]"
                          >
                            <span>Open</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl text-center">
                      No important links attached to this client.
                    </p>
                  )}
                </div>

                {/* Relationship Notes */}
                {selectedClientForDetails.notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internal Notes & History</h4>
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-wrap">
                        {selectedClientForDetails.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-[10px] text-slate-400 flex justify-between border-t border-slate-100 pt-4">
                  <span>Created: {new Date(selectedClientForDetails.createdAt).toLocaleDateString()}</span>
                  <span>ID: {selectedClientForDetails.id}</span>
                </div>
              </div>

              {/* Footer actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex gap-2">
                <button
                  onClick={() => {
                    const client = selectedClientForDetails;
                    setSelectedClientForDetails(null);
                    handleStartEdit(client);
                  }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={13} />
                  <span>Edit Details</span>
                </button>
                <button
                  onClick={() => setSelectedClientForDetails(null)}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
