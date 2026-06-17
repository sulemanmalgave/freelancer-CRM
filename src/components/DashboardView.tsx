import { motion } from "motion/react";
import { Users, FolderGit2, FileText, Sparkles, Plus, Clock, ExternalLink } from "lucide-react";
import { Client, Project, Invoice, Lead } from "../types";
import { formatCurrency } from "../utils";

interface DashboardViewProps {
  clients: Client[];
  projects: Project[];
  invoices: Invoice[];
  leads: Lead[];
  currency: string;
  onNavigate: (view: string) => void;
  onQuickAdd: (action: string) => void;
}

export default function DashboardView({
  clients,
  projects,
  invoices,
  leads,
  currency,
  onNavigate,
  onQuickAdd,
}: DashboardViewProps) {
  // Compute metric numbers
  const totalClients = clients.length;
  const activeProjects = projects.filter((p) => p.status === "In Progress" || p.status === "Not Started").length;
  const pendingInvoices = invoices.filter((i) => i.status === "Sent" || i.status === "Draft").length;

  // Revenue this month: sum of Paid invoices with issueDate within current calendar month
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentYear = now.getFullYear();

  const paidInvoicesThisMonth = invoices.filter((inv) => {
    if (inv.status !== "Paid") return false;
    try {
      const issueDate = new Date(inv.issueDate);
      return issueDate.getMonth() === currentMonth && issueDate.getFullYear() === currentYear;
    } catch (e) {
      return false;
    }
  });

  const revenueThisMonth = paidInvoicesThisMonth.reduce((acc, inv) => {
    const linesTotal = inv.services.reduce((sum, s) => sum + s.quantity * s.rate, 0);
    const taxAddon = linesTotal * (inv.taxRate / 100);
    return acc + linesTotal + taxAddon;
  }, 0);

  // Upcoming follow ups: leads with followUpDate in the prospective future
  const upcomingFollowups = leads.filter((l) => {
    if (!l.followUpDate) return false;
    try {
      const fDate = new Date(l.followUpDate);
      fDate.setHours(23, 59, 59, 999);
      return fDate >= now && l.status !== "Won" && l.status !== "Lost";
    } catch {
      return false;
    }
  }).length;

  // Let's grab some active things for quick dashboard glance
  const recentClients = [...clients]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 3);

  const urgentProjects = [...projects]
    .filter((p) => p.status !== "Completed" && p.deadline)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 3);

  const pendingBillsList = [...invoices]
    .filter((i) => i.status === "Sent")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  // Helper mapping client ID to Company/Contact
  const getClientMeta = (cId: string) => {
    const c = clients.find((item) => item.id === cId);
    return c ? `${c.companyName} (${c.contactPerson})` : "Direct Project";
  };

  const getCurrencySymbol = (code: string) => {
    if (code === "INR") return "₹";
    if (code === "EUR") return "€";
    if (code === "GBP") return "£";
    return "$";
  };

  return (
    <div className="space-y-8 select-none">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel bg-white/20 dark:bg-slate-900/35 border-indigo-200/20 dark:border-white/5 shadow-md">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <span>Workspace Operations Control</span>
            <Sparkles className="w-5 h-5 text-indigo-500 animate-pulse" />
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time visual monitoring of client conversions, active milestones, and automated cashflows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onQuickAdd("client")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/10 hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Client</span>
          </button>
          <button
            onClick={() => onQuickAdd("project")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white border border-white/40 dark:border-slate-800 bg-white/35 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl backdrop-blur-md transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
          <button
            onClick={() => onQuickAdd("invoice")}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white border border-white/40 dark:border-slate-800 bg-white/35 dark:bg-white/5 hover:bg-white/50 dark:hover:bg-white/10 rounded-xl backdrop-blur-md transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Clients */}
        <div
          onClick={() => onNavigate("Clients")}
          className="cursor-pointer p-4 rounded-2xl glass-panel glass-highlight hover:border-indigo-305 dark:hover:border-indigo-800/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Total Clients
            </span>
            <div className="p-1.5 bg-indigo-50/55 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
              {totalClients}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-semibold">
              <span>Database Sync Active</span>
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <div
          onClick={() => onNavigate("Projects")}
          className="cursor-pointer p-4 rounded-2xl glass-panel glass-highlight hover:border-sky-305 dark:hover:border-sky-800/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Active Milestones
            </span>
            <div className="p-1.5 bg-sky-50/55 dark:bg-sky-950/40 rounded-xl text-sky-600 dark:text-sky-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
              {activeProjects}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
              <span>Delivery Pipeline</span>
            </div>
          </div>
        </div>

        {/* Pending Invoices */}
        <div
          onClick={() => onNavigate("Invoices")}
          className="cursor-pointer p-4 rounded-2xl glass-panel glass-highlight hover:border-amber-305 dark:hover:border-amber-800/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Pending Invoices
            </span>
            <div className="p-1.5 bg-amber-50/55 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
              {pendingInvoices}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-500">
              <span>Awaiting client payment</span>
            </div>
          </div>
        </div>

        {/* Revenue This Month */}
        <div
          onClick={() => onNavigate("Revenue")}
          className="cursor-pointer p-4 rounded-2xl glass-panel glass-highlight hover:border-emerald-305 dark:hover:border-emerald-800/40 transition-all flex flex-col justify-between col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Paid This Month
            </span>
            <div className="p-1.5 bg-emerald-50/55 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <span className="text-xs font-bold font-mono">{getCurrencySymbol(currency)}</span>
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white truncate block">
              {formatCurrency(revenueThisMonth, currency)}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-semibold">
              <span>Received Clear Fees</span>
            </div>
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div
          onClick={() => onNavigate("Leads")}
          className="cursor-pointer p-4 rounded-2xl glass-panel glass-highlight hover:border-violet-305 dark:hover:border-violet-800/40 transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Key Follow-ups
            </span>
            <div className="p-1.5 bg-violet-50/55 dark:bg-violet-950/40 rounded-xl text-violet-600 dark:text-violet-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-white">
              {upcomingFollowups}
            </span>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-violet-500">
              <span>Warm lead queue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Lists Detail */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Overdue/Near Deadline Projects */}
        <div className="p-5 rounded-2xl glass-panel">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FolderGit2 size={16} className="text-indigo-500" />
              <span>Project Delivery Deadlines</span>
            </h3>
            <button
              onClick={() => onNavigate("Projects")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {urgentProjects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
              No active projects with deadlines. Enjoy some quiet days!
            </div>
          ) : (
            <div className="space-y-3">
              {urgentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onNavigate("Projects")}
                  className="p-3 glass-item rounded-xl cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                      {p.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-0.5 block line-clamp-1">
                      Client: {getClientMeta(p.clientId)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      new Date(p.deadline) < new Date()
                        ? "bg-red-500/10 text-red-600 dark:text-red-450"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    }`}>
                      {p.deadline ? new Date(p.deadline).toLocaleDateString() : "No Date"}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block font-medium font-mono">
                      {formatCurrency(p.budget, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outstanding Invoices */}
        <div className="p-5 rounded-2xl glass-panel">
          <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3 mb-4">
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" />
              <span>Awaiting Client Payments</span>
            </h3>
            <button
              onClick={() => onNavigate("Invoices")}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View Invoices</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {pendingBillsList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
              No outstanding sent invoices. Great work tracking accounts!
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBillsList.map((inv) => {
                const total = inv.services.reduce((accum, s) => accum + s.quantity * s.rate, 0);
                const tax = total * (inv.taxRate / 100);
                return (
                  <div
                    key={inv.id}
                    onClick={() => onNavigate("Invoices")}
                    className="p-3 glass-item rounded-xl cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {inv.invoiceNumber}
                      </h4>
                      <span className="text-[10px] text-slate-400 mt-0.5 block line-clamp-1">
                        To: {getClientMeta(inv.clientId)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-indigo-605 dark:text-indigo-400 font-mono block">
                        {formatCurrency(total + tax, currency)}
                      </span>
                      <span className="text-[10px] text-amber-500 font-medium block mt-0.5 font-sans">
                        Due: {new Date(inv.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
