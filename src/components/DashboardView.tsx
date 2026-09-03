import React, { useMemo, memo } from "react";
import { motion } from "motion/react";
import {
  Users,
  FolderGit2,
  FileText,
  Sparkles,
  Plus,
  Clock,
  ExternalLink,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Receipt,
  FileCheck2,
  Send,
  Zap,
  Briefcase,
} from "lucide-react";
import { Client, Project, Invoice, Lead, FollowUp, Proposal } from "../types";
import { formatCurrency } from "../utils";

interface DashboardViewProps {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  leads: Lead[];
  followUps?: FollowUp[];
  proposals?: Proposal[];
  currency: string;
  onNavigate: (view: string) => void;
  onQuickAdd: (action: string) => void;
  onToggleFollowUp?: (followUp: FollowUp) => void;
  onOpenInvoiceReminder?: (invoice: Invoice) => void;
  onOpenFollowUpModal?: () => void;
}

function DashboardView({
  clients,
  projects,
  invoices,
  leads,
  followUps = [],
  proposals = [],
  currency,
  onNavigate,
  onQuickAdd,
  onToggleFollowUp,
  onOpenInvoiceReminder,
  onOpenFollowUpModal,
}: DashboardViewProps) {
  const totalClients = clients.length;
  const activeProjects = useMemo(() => {
    return projects.filter(
      (p) => p.status === "In Progress" || p.status === "Not Started"
    ).length;
  }, [projects]);

  const pendingInvoices = useMemo(() => {
    return invoices.filter(
      (i) => i.status === "Sent" || i.status === "Draft"
    ).length;
  }, [invoices]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = now.toISOString().split("T")[0];

  const { paidInvoicesThisMonth, revenueThisMonth, overdueInvoices, pendingBillsList } = useMemo(() => {
    const paidThisMonth = invoices.filter((inv) => {
      if (inv.status !== "Paid") return false;
      try {
        const issueDate = new Date(inv.issueDate);
        return (
          issueDate.getMonth() === currentMonth &&
          issueDate.getFullYear() === currentYear
        );
      } catch {
        return false;
      }
    });

    const rev = paidThisMonth.reduce((acc, inv) => {
      const linesTotal = inv.services.reduce(
        (sum, s) => sum + s.quantity * s.rate,
        0
      );
      const taxAddon = linesTotal * ((inv.taxRate || 0) / 100);
      return acc + linesTotal + taxAddon;
    }, 0);

    const overdue = invoices.filter((inv) => {
      if (inv.status === "Paid") return false;
      return inv.dueDate < todayStr || inv.status === "Overdue";
    });

    const pendingBills = [...invoices]
      .filter((i) => i.status === "Sent" || i.status === "Draft")
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      )
      .slice(0, 4);

    return {
      paidInvoicesThisMonth: paidThisMonth,
      revenueThisMonth: rev,
      overdueInvoices: overdue,
      pendingBillsList: pendingBills,
    };
  }, [invoices, currentMonth, currentYear, todayStr]);

  // Active follow-ups due today or overdue
  const { overdueFollowUps, todayFollowUps } = useMemo(() => {
    const overdueF = followUps.filter((f) => {
      if (f.status === "completed") return false;
      const d = f.dueDate.includes("T") ? f.dueDate.split("T")[0] : f.dueDate;
      return d < todayStr;
    });

    const todayF = followUps.filter((f) => {
      if (f.status === "completed") return false;
      const d = f.dueDate.includes("T") ? f.dueDate.split("T")[0] : f.dueDate;
      return d === todayStr;
    });

    return { overdueFollowUps: overdueF, todayFollowUps: todayF };
  }, [followUps, todayStr]);

  const urgentProjects = useMemo(() => {
    return [...projects]
      .filter((p) => p.status !== "Completed" && p.deadline)
      .sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      )
      .slice(0, 4);
  }, [projects]);

  const getClientMeta = (cId: string) => {
    const c = clients.find((item) => item.id === cId);
    return c ? `${c.companyName} (${c.contactPerson})` : "Direct Client";
  };

  const getCurrencySymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    return "$";
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.02,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.99 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.2, ease: "easeOut" as const },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 select-none"
    >
      {/* Welcome Banner */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-white/40 border-indigo-200/40 shadow-sm"
      >
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <span>Workspace Operations Control</span>
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time monitoring of client communications, active deliverables, smart follow-ups, and automated cashflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onQuickAdd("client")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Client</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => (onOpenFollowUpModal ? onOpenFollowUpModal() : onQuickAdd("followup"))}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-all cursor-pointer"
          >
            <Clock size={14} />
            <span>Follow-up</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onQuickAdd("invoice")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-950 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Receipt size={14} />
            <span>Invoice</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onQuickAdd("proposal")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all cursor-pointer"
          >
            <FileCheck2 size={14} />
            <span>Proposal</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Action Required Alert Strip (Overdue Follow-ups or Invoices) */}
      {(overdueFollowUps.length > 0 || overdueInvoices.length > 0) && (
        <motion.div
          variants={itemVariants}
          className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertCircle size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Action Items Requiring Your Attention
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {overdueFollowUps.length > 0 && `${overdueFollowUps.length} follow-up${overdueFollowUps.length > 1 ? "s" : ""} overdue. `}
                {overdueInvoices.length > 0 && `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""} awaiting overdue reminder.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {overdueInvoices.length > 0 && onOpenInvoiceReminder && (
              <button
                onClick={() => onOpenInvoiceReminder(overdueInvoices[0])}
                className="px-3 py-1.5 bg-white text-amber-800 hover:bg-amber-100 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <Send size={12} />
                <span>Send Invoice Reminder</span>
              </button>
            )}
            <button
              onClick={() => onNavigate("Calendar")}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              View Schedule
            </button>
          </div>
        </motion.div>
      )}

      {/* Grid KPI Cards */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Clients */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Clients")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Clients
            </span>
            <div className="p-1.5 bg-indigo-50 rounded-xl text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900">{totalClients}</span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Active Directory</span>
          </div>
        </motion.div>

        {/* Active Projects */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Projects")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Projects
            </span>
            <div className="p-1.5 bg-sky-50 rounded-xl text-sky-600">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900">{activeProjects}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">In Progress</span>
          </div>
        </motion.div>

        {/* Pending Invoices */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Invoices")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Invoices
            </span>
            <div className="p-1.5 bg-amber-50 rounded-xl text-amber-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900">{pendingInvoices}</span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Pending Payment</span>
          </div>
        </motion.div>

        {/* Revenue This Month */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Revenue")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              This Month
            </span>
            <div className="p-1.5 bg-emerald-50 rounded-xl text-emerald-600 font-bold font-mono text-xs">
              {getCurrencySymbol(currency)}
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900 truncate block">
              {formatCurrency(revenueThisMonth, currency)}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Collected</span>
          </div>
        </motion.div>

        {/* Proposals */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Proposals")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Proposals
            </span>
            <div className="p-1.5 bg-purple-50 rounded-xl text-purple-600">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900">{proposals.length}</span>
            <span className="text-[10px] text-purple-600 font-semibold block mt-0.5">
              {proposals.filter((p) => p.status === "Accepted").length} Accepted
            </span>
          </div>
        </motion.div>

        {/* Follow-ups Today */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -3, transition: { duration: 0.15 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate("Calendar")}
          className="cursor-pointer p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Follow-ups
            </span>
            <div className="p-1.5 bg-amber-50 rounded-xl text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900">
              {todayFollowUps.length + overdueFollowUps.length}
            </span>
            <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Due / Overdue</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Grid Lists Detail */}
      <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
        {/* Project Deadlines */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 size={16} className="text-indigo-600" />
              <span>Project Delivery Deadlines</span>
            </h3>
            <button
              onClick={() => onNavigate("Projects")}
              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {urgentProjects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No active projects with deadlines.
            </div>
          ) : (
            <div className="space-y-2.5">
              {urgentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate("Projects")}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl cursor-pointer transition-all flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="font-bold text-slate-800 truncate">{p.title}</h4>
                    <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                      {getClientMeta(p.clientId)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        new Date(p.deadline) < new Date()
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-sky-50 text-sky-600 border border-sky-200"
                      }`}
                    >
                      {p.deadline ? new Date(p.deadline).toLocaleDateString() : "No Date"}
                    </span>
                    <span className="text-[11px] text-slate-700 font-bold block mt-1 font-mono">
                      {formatCurrency(p.budget, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outstanding Invoices & Follow-ups */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-emerald-600" />
              <span>Awaiting Client Payments</span>
            </h3>
            <button
              onClick={() => onNavigate("Invoices")}
              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Invoices</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {pendingBillsList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No outstanding sent invoices. Great work tracking accounts!
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingBillsList.map((inv) => {
                const total = inv.services.reduce(
                  (accum, s) => accum + s.quantity * s.rate,
                  0
                );
                const tax = total * ((inv.taxRate || 0) / 100);
                const isOverdue = inv.dueDate < todayStr;

                return (
                  <div
                    key={inv.id}
                    className="p-3 bg-slate-50 border border-slate-100 rounded-xl transition-all flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">
                          #{inv.invoiceNumber}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-md">
                            Overdue
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                        {getClientMeta(inv.clientId)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-slate-900 font-mono block">
                          {formatCurrency(total + tax, currency)}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Due: {inv.dueDate}
                        </span>
                      </div>
                      {onOpenInvoiceReminder && (
                        <button
                          onClick={() => onOpenInvoiceReminder(inv)}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors cursor-pointer"
                          title="Send payment reminder"
                        >
                          <Send size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default memo(DashboardView);
