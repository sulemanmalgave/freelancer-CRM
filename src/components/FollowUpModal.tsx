import React, { useState } from "react";
import { X, Calendar, Clock, AlertCircle, CheckCircle2, User, Sparkles } from "lucide-react";
import { FollowUp, Client, Lead } from "../types";
import { generateUUID } from "../utils";

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (followUp: FollowUp) => void;
  existingFollowUp?: FollowUp | null;
  clients: Client[];
  leads: Lead[];
  defaultClientId?: string;
  defaultLeadId?: string;
  defaultTitle?: string;
  defaultDate?: string;
}

export default function FollowUpModal({
  isOpen,
  onClose,
  onSave,
  existingFollowUp,
  clients,
  leads,
  defaultClientId,
  defaultLeadId,
  defaultTitle,
  defaultDate,
}: FollowUpModalProps) {
  if (!isOpen) return null;

  const [title, setTitle] = useState(
    existingFollowUp?.title || defaultTitle || "Client follow-up check-in"
  );
  const [clientId, setClientId] = useState<string>(
    existingFollowUp?.clientId || defaultClientId || ""
  );
  const [leadId, setLeadId] = useState<string>(
    existingFollowUp?.leadId || defaultLeadId || ""
  );
  const [targetType, setTargetType] = useState<"client" | "lead" | "general">(
    existingFollowUp?.clientId || defaultClientId
      ? "client"
      : existingFollowUp?.leadId || defaultLeadId
      ? "lead"
      : "client"
  );

  // Default date to provided defaultDate or tomorrow
  const getInitialDate = () => {
    if (existingFollowUp?.dueDate) {
      return existingFollowUp.dueDate.split("T")[0];
    }
    if (defaultDate) {
      return defaultDate;
    }
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const [dueDate, setDueDate] = useState(getInitialDate());
  const [dueTime, setDueTime] = useState(
    existingFollowUp?.dueDate && existingFollowUp.dueDate.includes("T")
      ? existingFollowUp.dueDate.split("T")[1]?.slice(0, 5) || "10:00"
      : "10:00"
  );
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    existingFollowUp?.priority || "medium"
  );
  const [notes, setNotes] = useState(existingFollowUp?.notes || "");
  const [error, setError] = useState("");

  const applyPresetDate = (daysToAdd: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysToAdd);
    setDueDate(d.toISOString().split("T")[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please provide a title or purpose for this follow-up.");
      return;
    }

    const fullDueDate = dueTime ? `${dueDate}T${dueTime}:00` : dueDate;

    const followUpData: FollowUp = {
      id: existingFollowUp?.id || generateUUID(),
      freelancerId: existingFollowUp?.freelancerId || "",
      title: title.trim(),
      clientId: targetType === "client" && clientId ? clientId : undefined,
      leadId: targetType === "lead" && leadId ? leadId : undefined,
      dueDate: fullDueDate,
      notes: notes.trim() || undefined,
      status: existingFollowUp?.status || "pending",
      priority,
      createdAt: existingFollowUp?.createdAt || new Date().toISOString(),
    };

    onSave(followUpData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {existingFollowUp ? "Edit Follow-up" : "Schedule Follow-up"}
              </h2>
              <p className="text-xs text-slate-500">
                Stay on top of client touchpoints and never drop a lead
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Schedule Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Quick Schedule
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPresetDate(1)}
                className="py-1.5 px-2.5 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 rounded-lg transition-all text-slate-700 text-center"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => applyPresetDate(3)}
                className="py-1.5 px-2.5 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 rounded-lg transition-all text-slate-700 text-center"
              >
                In 3 Days
              </button>
              <button
                type="button"
                onClick={() => applyPresetDate(7)}
                className="py-1.5 px-2.5 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 rounded-lg transition-all text-slate-700 text-center"
              >
                Next Week
              </button>
              <button
                type="button"
                onClick={() => applyPresetDate(14)}
                className="py-1.5 px-2.5 text-xs font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 rounded-lg transition-all text-slate-700 text-center"
              >
                In 2 Weeks
              </button>
            </div>
          </div>

          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Associate With
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTargetType("client")}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  targetType === "client"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <User size={13} />
                <span>Client</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetType("lead")}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  targetType === "lead"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Sparkles size={13} />
                <span>Lead / Prospect</span>
              </button>
            </div>
          </div>

          {/* Client or Lead dropdown */}
          {targetType === "client" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Client
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
              >
                <option value="">-- General (No Specific Client) --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} {c.contactPerson ? `(${c.contactPerson})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {targetType === "lead" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Lead
              </label>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
              >
                <option value="">-- Select Lead --</option>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.companyName ? `- ${l.companyName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Follow-up Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Follow-up Title / Reason *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError("");
              }}
              placeholder="e.g. Check project requirements, send proposal feedback..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
              required
            />
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar size={12} className="text-slate-400" />
                <span>Due Date *</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                <span>Reminder Time</span>
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-1.5 text-xs font-semibold rounded-lg border capitalize transition-all ${
                    priority === p
                      ? p === "high"
                        ? "bg-red-50 border-red-300 text-red-700"
                        : p === "medium"
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Context Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What specifically do you need to ask or discuss? Any previous context..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 resize-none transition-colors"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>{existingFollowUp ? "Save Changes" : "Create Follow-up"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
