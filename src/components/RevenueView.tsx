import { useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, FileText, Calendar, Wallet, CheckCircle2, AlertCircle, Award, Sparkles } from "lucide-react";
import { Invoice, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";

interface RevenueViewProps {
  invoices: Invoice[];
  profile: FreelancerProfile;
  onTriggerUpgrade: (reason: string) => void;
}

export default function RevenueView({ invoices, profile, onTriggerUpgrade }: RevenueViewProps) {
  // Extract Paid vs Pending
  const paidInvoicesList = invoices.filter((i) => i.status === "Paid");
  const pendingInvoicesList = invoices.filter((i) => i.status === "Sent" || i.status === "Draft" || i.status === "Overdue");

  const calculateInvoiceTotal = (inv: Invoice) => {
    const base = inv.services.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    return base + base * (inv.taxRate / 100);
  };

  const totalPaidRevenue = paidInvoicesList.reduce((acc, i) => acc + calculateInvoiceTotal(i), 0);
  const totalPendingRevenue = pendingInvoicesList.reduce((acc, i) => acc + calculateInvoiceTotal(i), 0);

  // Generate Past 6 Months billing data for bar graphs
  const getPastSixMonths = () => {
    const list = [];
    const date = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
      list.push({
        monthName: d.toLocaleString("default", { month: "short" }),
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        paidAmount: 0,
        pendingAmount: 0,
      });
    }
    return list;
  };

  const monthlyBreakout = getPastSixMonths();

  invoices.forEach((inv) => {
    try {
      const date = new Date(inv.issueDate);
      const mIdx = date.getMonth();
      const yVal = date.getFullYear();

      const match = monthlyBreakout.find((mb) => mb.monthIndex === mIdx && mb.year === yVal);
      if (match) {
        const amt = calculateInvoiceTotal(inv);
        if (inv.status === "Paid") {
          match.paidAmount += amt;
        } else {
          match.pendingAmount += amt;
        }
      }
    } catch {}
  });

  // Calculate maximum monthly value to auto-scale SVG bars
  const maxMonthlyVal = Math.max(
    ...monthlyBreakout.map((mb) => mb.paidAmount + mb.pendingAmount),
    1000 // default min height scale
  );

  return (
    <div className="space-y-6">
      {/* SaaS Pricing Restriction Banner for Free User */}
      {profile.plan === "Free" && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-indigo-600/10">
          <div className="flex items-center gap-2.5 text-center sm:text-left">
            <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Lock in Analytics Pro Insights</h4>
              <p className="text-xs text-indigo-100 mt-0.5">
                Full-scale charts, custom tax parameters, and yearly revenue tracking are limited on the Free plan.
              </p>
            </div>
          </div>
          <button
            onClick={() => onTriggerUpgrade("advanced_charts")}
            className="px-4 py-2 bg-white text-indigo-650 hover:bg-slate-50 text-xs font-bold rounded-xl shadow-md transition-all shrink-0 hover:scale-105"
          >
            Upgrade Workspace
          </button>
        </div>
      )}

      {/* KPI Stats Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl glass-panel glass-highlight flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Total Received Income</span>
            <strong className="text-2xl font-black text-emerald-600 font-mono tracking-tight block">
              {formatCurrency(totalPaidRevenue, profile.currency)}
            </strong>
            <span className="text-[10px] text-slate-400 block font-medium">From {paidInvoicesList.length} cleared bills</span>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-highlight flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Pending / Unpaid Bills</span>
            <strong className="text-2xl font-black text-amber-600 font-mono tracking-tight block">
              {formatCurrency(totalPendingRevenue, profile.currency)}
            </strong>
            <span className="text-[10px] text-slate-400 block font-medium">From {pendingInvoicesList.length} outstanding invoices</span>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-highlight flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Gross Valuation</span>
            <strong className="text-2xl font-black text-purple-600 font-mono tracking-tight block">
              {formatCurrency(totalPaidRevenue + totalPendingRevenue, profile.currency)}
            </strong>
            <span className="text-[10px] text-slate-400 block font-medium">Combined ledger backlog</span>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* SVG Interactive Dashboard Chart (Gated visual states) */}
      <div className={`p-5 rounded-2xl glass-panel relative overflow-hidden ${
        profile.plan === "Free" ? "opacity-75" : ""
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={16} className="text-indigo-500" />
              <span>Rolling 6-Month Income Analytics</span>
            </h3>
            <span className="text-[10px] text-slate-400">Monthly breakdown comparing paid fees vs client receivables.</span>
          </div>
        </div>

        {/* Custom Hand-Drawn SVG Chart */}
        <div className="w-full h-64 mt-4 select-none">
          <svg viewBox="0 0 600 240" className="w-full h-full text-xs">
            {/* Horizontal Grid lines */}
            <line x1="40" y1="20" x2="560" y2="20" stroke="#f1f5f9" strokeDasharray="3" className="stroke-slate-100" />
            <line x1="40" y1="80" x2="560" y2="80" stroke="#f1f5f9" strokeDasharray="3" className="stroke-slate-100" />
            <line x1="40" y1="140" x2="560" y2="140" stroke="#f1f5f9" strokeDasharray="3" className="stroke-slate-100" />
            <line x1="40" y1="200" x2="560" y2="200" stroke="#cbd5e1" className="stroke-slate-200" />

            {/* Render Bars for months */}
            {monthlyBreakout.map((mb, idx) => {
              const xCoord = 70 + idx * 85;
              const paidHeight = (mb.paidAmount / maxMonthlyVal) * 160;
              const pendingHeight = (mb.pendingAmount / maxMonthlyVal) * 160;

              return (
                <g key={idx}>
                  {/* Paid Bar (Bottom) */}
                  {mb.paidAmount > 0 && (
                    <rect
                      x={xCoord}
                      y={200 - paidHeight}
                      width="28"
                      height={paidHeight}
                      fill="#10b981"
                      rx="4"
                      className="transition-all duration-300 hover:opacity-90 cursor-help"
                    />
                  )}

                  {/* Pending Bar (Stacked on top of Paid) */}
                  {mb.pendingAmount > 0 && (
                    <rect
                      x={xCoord}
                      y={200 - paidHeight - pendingHeight}
                      width="28"
                      height={pendingHeight}
                      fill="#f59e0b"
                      rx="4"
                      className="transition-all duration-300 hover:opacity-90 cursor-help"
                    />
                  )}

                  {/* Month Label */}
                  <text
                    x={xCoord + 14}
                    y="220"
                    textAnchor="middle"
                    fill="#94a3b8"
                    className="font-bold text-[10px]"
                  >
                    {mb.monthName}
                  </text>

                  {/* Hover Values over bars */}
                  {(mb.paidAmount > 0 || mb.pendingAmount > 0) && (
                    <g className="opacity-0 hover:opacity-100 transition-opacity duration-200">
                      <rect
                        x={xCoord - 36}
                        y={200 - paidHeight - pendingHeight - 34}
                        width="100"
                        height="28"
                        rx="6"
                        fill="#0f172a"
                      />
                      <text
                        x={xCoord + 14}
                        y={200 - paidHeight - pendingHeight - 16}
                        fill="#fff"
                        textAnchor="middle"
                        className="font-mono text-[9px] font-bold"
                      >
                        {formatCurrency(mb.paidAmount + mb.pendingAmount, profile.currency)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mt-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block"></span>
            <span>Cleared / Fees Received</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-amber-550 bg-amber-500 rounded-sm inline-block"></span>
            <span>Unpaid Deliverables</span>
          </div>
        </div>

        {/* Free Plan Overlays */}
        {profile.plan === "Free" && (
          <div className="absolute inset-0 bg-slate-100/10 backdrop-blur-[1px] flex flex-col justify-center items-center">
            {/* Simple card to block */}
          </div>
        )}
      </div>

      {/* Breakout detail logs of past payments */}
      <div className="p-5 rounded-2xl glass-panel">
        <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-4">Paid Receipts Logs</h4>
        {paidInvoicesList.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-400">
            No payments registered in the system logs.
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {paidInvoicesList.map((inv) => (
              <div key={inv.id} className="p-3 border border-white/20 rounded-xl flex items-center justify-between text-xs hover:bg-black/5">
                <div className="space-y-0.5">
                  <span className="font-bold font-mono text-slate-800">{inv.invoiceNumber}</span>
                  <p className="text-[10px] text-slate-400">Cleared Date: {new Date(inv.issueDate).toLocaleDateString()}</p>
                </div>
                <strong className="text-emerald-500 font-bold font-mono">
                  +{formatCurrency(calculateInvoiceTotal(inv), profile.currency)}
                </strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
