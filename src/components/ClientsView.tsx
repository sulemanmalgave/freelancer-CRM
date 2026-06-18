import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Search, Edit3, Trash2, Mail, Phone, Users, Check, X, ShieldAlert, FileText, Sparkles } from "lucide-react";
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
  const [isAdding, setIsAdding] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"Lead" | "Active" | "Inactive">("Active");

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
  };

  const handleOpenAdd = () => {
    if (profile.plan === "Free" && clients.length >= 20) {
      onTriggerUpgrade("client_limit");
      return;
    }
    resetForm();
    setIsAdding(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactPerson.trim()) return;

    onAddClient({
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      status,
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
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !companyName.trim() || !contactPerson.trim()) return;

    onUpdateClient(editingClient.id, {
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      email: email.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      status,
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
          {profile.plan === "Free" && (
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
              className="p-5 glass-panel glass-highlight rounded-2xl hover:border-indigo-300 transition-all flex flex-col justify-between group"
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
                      <a href={`mailto:${client.email}`} className="hover:underline hover:text-indigo-650 line-clamp-1">
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
                </div>
              </div>

              <div className="flex justify-end gap-1.5 border-t border-black/5 pt-3 opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(client)}
                  className="p-1 px-2.5 border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                >
                  <Edit3 size={11} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => {
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
    </div>
  );
}
