import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  Clock,
  Calendar,
  AlertCircle,
  Receipt,
  Briefcase,
  CheckCircle2,
  Send,
  ExternalLink,
  Mail,
  Check,
} from "lucide-react";
import { FollowUp, Task, Project, Invoice, Client } from "../types";

interface ActionCenterDropdownProps {
  followUps: FollowUp[];
  tasks: Task[];
  projects: Project[];
  invoices: Invoice[];
  clients: Client[];
  unreadEmailCount: number;
  onOpenInvoiceReminder: (invoice: Invoice) => void;
  onToggleFollowUp: (followUp: FollowUp) => void;
  onNavigateToView: (viewName: string) => void;
}

export default function ActionCenterDropdown({
  followUps,
  tasks,
  projects,
  invoices,
  clients,
  unreadEmailCount,
  onOpenInvoiceReminder,
  onToggleFollowUp,
  onNavigateToView,
}: ActionCenterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const todayStr = new Date().toISOString().split("T")[0];

  // Calculate notifications
  // 1. Overdue follow-ups
  const overdueFollowUps = followUps.filter((f) => {
    if (f.status === "completed") return false;
    const date = f.dueDate.includes("T") ? f.dueDate.split("T")[0] : f.dueDate;
    return date < todayStr;
  });

  // 2. Follow-ups due today
  const todayFollowUps = followUps.filter((f) => {
    if (f.status === "completed") return false;
    const date = f.dueDate.includes("T") ? f.dueDate.split("T")[0] : f.dueDate;
    return date === todayStr;
  });

  // 3. Overdue Invoices
  const overdueInvoices = invoices.filter((inv) => {
    if (inv.status === "Paid") return false;
    return inv.dueDate < todayStr || inv.status === "Overdue";
  });

  // 4. Invoices due today or in next 2 days
  const upcomingInvoices = invoices.filter((inv) => {
    if (inv.status === "Paid") return false;
    return inv.dueDate >= todayStr && inv.dueDate <= todayStr;
  });

  // 5. Tasks due today or overdue
  const urgentTasks = tasks.filter((t) => {
    if (t.completed) return false;
    return t.dueDate && t.dueDate <= todayStr;
  });

  // 6. Project deadlines approaching (next 3 days)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];
  const approachingProjects = projects.filter((p) => {
    if (p.status === "Completed") return false;
    return p.deadline && p.deadline >= todayStr && p.deadline <= threeDaysStr;
  });

  const totalNotifications =
    overdueFollowUps.length +
    todayFollowUps.length +
    overdueInvoices.length +
    urgentTasks.length +
    approachingProjects.length +
    (unreadEmailCount > 0 ? 1 : 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl shadow-xs transition-all relative cursor-pointer"
        title="Action Center & Notifications"
      >
        <Bell size={18} />
        {totalNotifications > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center rounded-full border-2 border-white animate-pulse">
            {totalNotifications > 9 ? "9+" : totalNotifications}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-indigo-600" />
              <span className="text-xs font-bold text-slate-900">Action Center</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {totalNotifications} pending item{totalNotifications !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs">
            {totalNotifications === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-800">You're all caught up!</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  No overdue follow-ups, pending invoices, or urgent deadlines.
                </p>
              </div>
            ) : (
              <>
                {/* Overdue Follow-ups */}
                {overdueFollowUps.map((f) => {
                  const client = clients.find((c) => c.id === f.clientId);
                  return (
                    <div key={f.id} className="p-3.5 hover:bg-amber-50/50 transition-colors flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-red-100 text-red-700 rounded-lg shrink-0 mt-0.5">
                          <AlertCircle size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">{f.title}</p>
                          <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                            Overdue since {f.dueDate.split("T")[0]} • {client?.companyName || "Client"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onToggleFollowUp(f);
                        }}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                        title="Mark Completed"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* Overdue Invoices */}
                {overdueInvoices.map((inv) => {
                  const client = clients.find((c) => c.id === inv.clientId);
                  return (
                    <div key={inv.id} className="p-3.5 hover:bg-red-50/40 transition-colors flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-red-100 text-red-700 rounded-lg shrink-0 mt-0.5">
                          <Receipt size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">
                            Invoice #{inv.invoiceNumber} is overdue
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {client?.companyName} • Due {inv.dueDate}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onOpenInvoiceReminder(inv);
                        }}
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors shrink-0 flex items-center gap-1"
                      >
                        <Send size={11} />
                        <span>Remind</span>
                      </button>
                    </div>
                  );
                })}

                {/* Today's Follow-ups */}
                {todayFollowUps.map((f) => {
                  const client = clients.find((c) => c.id === f.clientId);
                  return (
                    <div key={f.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                          <Clock size={14} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 leading-snug">{f.title}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Due Today • {client?.companyName || "Client"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggleFollowUp(f)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors shrink-0"
                        title="Mark Completed"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  );
                })}

                {/* Approaching Project Deadlines */}
                {approachingProjects.map((p) => (
                  <div key={p.id} className="p-3.5 hover:bg-purple-50/40 transition-colors flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0 mt-0.5">
                        <Briefcase size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 leading-snug">Project Deadline Near</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {p.title} • Due {p.deadline}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateToView("Projects");
                      }}
                      className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-semibold text-[11px] rounded-lg transition-colors shrink-0"
                    >
                      View
                    </button>
                  </div>
                ))}

                {/* Unread Gmail message alert */}
                {unreadEmailCount > 0 && (
                  <div className="p-3.5 hover:bg-blue-50/40 transition-colors flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                        <Mail size={14} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 leading-snug">Unread Client Emails</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          You have {unreadEmailCount} unread message{unreadEmailCount > 1 ? "s" : ""} in Gmail
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onNavigateToView("Gmail");
                      }}
                      className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] rounded-lg transition-colors shrink-0"
                    >
                      Inbox
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
