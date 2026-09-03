import React from "react";
import {
  X,
  UserPlus,
  Sparkles,
  Briefcase,
  CheckSquare,
  Receipt,
  FileCheck2,
  Calendar,
  FileText,
  Mail,
  Zap,
} from "lucide-react";

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionType: string) => void;
}

export default function QuickActionsModal({
  isOpen,
  onClose,
  onSelectAction,
}: QuickActionsModalProps) {
  if (!isOpen) return null;

  const actions = [
    {
      id: "client",
      title: "New Client",
      description: "Add an active or prospective client company",
      icon: UserPlus,
      color: "bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-300",
    },
    {
      id: "followup",
      title: "Schedule Follow-up",
      description: "Set a reminder for client check-ins or sales leads",
      icon: Calendar,
      color: "bg-amber-50 text-amber-600 border-amber-100 hover:border-amber-300",
    },
    {
      id: "invoice",
      title: "Create Invoice",
      description: "Draft a new invoice with itemized services & tax",
      icon: Receipt,
      color: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-300",
    },
    {
      id: "proposal",
      title: "Create Proposal",
      description: "Send project quotes & estimates to prospective clients",
      icon: FileCheck2,
      color: "bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-300",
    },
    {
      id: "project",
      title: "New Project",
      description: "Track deliverables, budgets, and deadlines",
      icon: Briefcase,
      color: "bg-blue-50 text-blue-600 border-blue-100 hover:border-blue-300",
    },
    {
      id: "task",
      title: "Add Task",
      description: "Quick task with due date & priority flag",
      icon: CheckSquare,
      color: "bg-rose-50 text-rose-600 border-rose-100 hover:border-rose-300",
    },
    {
      id: "lead",
      title: "Add Lead / Deal",
      description: "Track potential prospects, pipeline stage & budget",
      icon: Sparkles,
      color: "bg-cyan-50 text-cyan-600 border-cyan-100 hover:border-cyan-300",
    },
    {
      id: "note",
      title: "Add Note / Voice Memo",
      description: "Capture client meeting minutes or voice memos",
      icon: FileText,
      color: "bg-teal-50 text-teal-600 border-teal-100 hover:border-teal-300",
    },
    {
      id: "email",
      title: "Compose Email",
      description: "Send an email to a client directly via connected Gmail",
      icon: Mail,
      color: "bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Quick Create</h2>
              <p className="text-xs text-slate-500">What would you like to create?</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Grid */}
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {actions.map((act) => {
            const Icon = act.icon;
            return (
              <button
                key={act.id}
                onClick={() => {
                  onSelectAction(act.id);
                  onClose();
                }}
                className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-xs ${act.color}`}
              >
                <div className="p-2 rounded-lg bg-white shadow-xs shrink-0 mt-0.5">
                  <Icon size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-snug">{act.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{act.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
