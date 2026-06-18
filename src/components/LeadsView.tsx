import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check, X, ShieldAlert, Star, Phone, Mail, Calendar, UserCheck, Trash2, Edit3, Award, Sparkles } from "lucide-react";
import { Lead, Client } from "../types";
import { formatCurrency } from "../utils";

interface LeadsViewProps {
  leads: Lead[];
  currency: string;
  searchTerm: string;
  onAddLead: (lead: Omit<Lead, "id" | "freelancerId" | "createdAt">) => void;
  onUpdateLead: (id: string, lead: Partial<Lead>) => void;
  onDeleteLead: (id: string) => void;
  onConvertToClient: (lead: Lead) => void;
}

export default function LeadsView({
  leads,
  currency,
  searchTerm,
  onAddLead,
  onUpdateLead,
  onDeleteLead,
  onConvertToClient,
}: LeadsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("LinkedIn");
  const [followUpDate, setFollowUpDate] = useState("");
  const [status, setStatus] = useState<Lead["status"]>("New");
  const [budget, setBudget] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const [activePipelineStage, setActivePipelineStage] = useState<"All" | Lead["status"]>("All");

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = activePipelineStage === "All" || l.status === activePipelineStage;
    return matchesSearch && matchesStage;
  });

  const resetForm = () => {
    setName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setSource("LinkedIn");
    setFollowUpDate("");
    setStatus("New");
    setBudget(0);
    setNotes("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddLead({
      name: name.trim(),
      companyName: companyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      source,
      followUpDate,
      status,
      budget: Number(budget) || 0,
      notes: notes.trim(),
    });

    setIsAdding(false);
    resetForm();
  };

  const handleStartEdit = (l: Lead) => {
    setEditingLead(l);
    setName(l.name);
    setCompanyName(l.companyName || "");
    setEmail(l.email || "");
    setPhone(l.phone || "");
    setSource(l.source || "LinkedIn");
    setFollowUpDate(l.followUpDate || "");
    setStatus(l.status || "New");
    setBudget(l.budget || 0);
    setNotes(l.notes || "");
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead || !name.trim()) return;

    onUpdateLead(editingLead.id, {
      name: name.trim(),
      companyName: companyName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      source,
      followUpDate,
      status,
      budget: Number(budget) || 0,
      notes: notes.trim(),
    });

    setEditingLead(null);
  };

  return (
    <div className="space-y-6">
      {/* Category selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5/2 gap-2">
          {["All", "New", "Contacted", "Proposal Sent", "Won", "Lost"].map((pStage) => (
            <button
              key={pStage}
              onClick={() => setActivePipelineStage(pStage as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activePipelineStage === pStage
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-650/20"
                  : "glass-item text-slate-500 hover:text-slate-800"
              }`}
            >
              {pStage} ({pStage === "All" ? leads.length : leads.filter((l) => l.status === pStage).length})
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
        >
          <Plus size={14} />
          <span>Log Lead</span>
        </button>
      </div>

      {/* Interactive modal form */}
      <AnimatePresence>
        {(isAdding || editingLead) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-2xl overflow-hidden my-6"
            >
              <div className="p-5 border-b border-black/5 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  {isAdding ? "Document New Prospect Lead" : `Edit Lead: ${editingLead?.name}`}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingLead(null);
                  }}
                  className="p-1 rounded-full hover:bg-black/5 text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={isAdding ? handleSubmitAdd : handleSubmitEdit} className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Lead Contact Person *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    placeholder="e.g. Monica Geller"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    placeholder="e.g. Monica Kitchen Catering"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Email Match</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                      placeholder="monica@kitchen.org"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                      placeholder="+1 (555) 789-0123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Lead Original Source</label>
                    <select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    >
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Upwork">Upwork</option>
                      <option value="Fiverr">Fiverr</option>
                      <option value="Referral">Client Referral</option>
                      <option value="Website">Personal Website</option>
                      <option value="Conference">Conference / Meetup</option>
                      <option value="Cold Email">Cold Outreach</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Forecast Valuation</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 bg-transparent text-slate-400 font-bold">
                        {currency === "INR" ? "₹" : "$"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={budget || ""}
                        onChange={(e) => setBudget(Number(e.target.value) || 0)}
                        className="w-full py-2 pl-6 pr-2 glass-input rounded-xl text-slate-808 text-xs focus:outline-none font-mono"
                        placeholder="1200"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Follow-up target</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Deal Pipeline Stage</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-805 text-xs focus:outline-none"
                    >
                      <option value="New">New Prospect</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Proposal Sent">Proposal Transmitted</option>
                      <option value="Won">Deal Awarded (Won)</option>
                      <option value="Lost">Closed Out (Lost)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Internal Conversion Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none resize-none"
                    placeholder="Wants React build, 1-month timeline, high priority referral..."
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingLead(null);
                    }}
                    className="flex-1 py-2 border border-white/10 text-slate-500 hover:bg-black/5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isAdding ? "Register Lead" : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>      {/* Render Lead items */}
      {filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl glass-panel text-center">
          <Star className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No pipeline prospects</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {leads.length === 0
              ? "Your business development channel is currently clear. Direct new contact entries or opportunities to log them here."
              : "Recheck the stage filter categories to locate prospects matching your criteria."}
          </p>
          {leads.length === 0 && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all font-bold cursor-pointer"
            >
              Log First Lead
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((l) => {
            const isDueToday = l.followUpDate && new Date(l.followUpDate).toDateString() === new Date().toDateString();
            return (
              <motion.div
                layout
                key={l.id}
                className="p-5 rounded-2xl glass-panel glass-highlight transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-1">
                        {l.name}
                      </h4>
                      {l.companyName && (
                        <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block line-clamp-1">
                          Org: {l.companyName}
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      l.status === "Won"
                        ? "bg-emerald-500/10 text-emerald-650"
                        : l.status === "Proposal Sent" || l.status === "Contacted"
                        ? "bg-indigo-500/10 text-indigo-650"
                        : l.status === "New"
                        ? "bg-sky-500/10 text-sky-655"
                        : "bg-red-500/10 text-red-550"
                    }`}>
                      {l.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-black/5 pt-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span>Proximity Source:</span>
                      <strong className="font-medium text-slate-700 bg-black/5 px-1.5 py-0.5 rounded-md">
                        {l.source}
                      </strong>
                    </div>

                    {l.budget > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Expected Value:</span>
                        <strong className="font-bold text-slate-800 font-mono">
                          {formatCurrency(l.budget, currency)}
                        </strong>
                      </div>
                    )}

                    {l.followUpDate && (
                      <div className="flex items-center justify-between">
                        <span>Follow-up Due:</span>
                        <span className={`flex items-center gap-1 text-[11px] font-medium ${
                          isDueToday ? "text-amber-500 font-semibold" : "text-slate-550"
                        }`}>
                          <Calendar size={11} />
                          <span>{new Date(l.followUpDate).toLocaleDateString()}</span>
                        </span>
                      </div>
                    )}

                    {l.notes && (
                      <p className="text-[11px] text-slate-450 p-2 rounded-lg bg-black/5 italic mt-2 line-clamp-2">
                        "{l.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-black/5 pt-3 opacity-90 group-hover:opacity-100 transition-opacity">
                  {/* Convert to client option */}
                  {l.status !== "Won" ? (
                    <button
                      onClick={() => onConvertToClient(l)}
                      className="p-1 px-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-650 hover:text-white hover:bg-indigo-600 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck size={11} />
                      <span>Convert to Client</span>
                    </button>
                  ) : (
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <Award size={12} />
                      <span>Account Won!</span>
                    </span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleStartEdit(l)}
                      className="p-1 hover:text-indigo-600 text-slate-400 transition-colors cursor-pointer"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Remove prospect lead "${l.name}"?`)) {
                          onDeleteLead(l.id);
                        }
                      }}
                      className="p-1 hover:text-red-500 text-slate-400 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
