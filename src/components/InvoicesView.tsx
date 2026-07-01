import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check, X, FileText, Download, Printer, Edit3, Trash2, IndianRupee, Sparkles, AlertCircle, ShoppingBag, Send } from "lucide-react";
import { Invoice, Client, FreelancerProfile, InvoiceService } from "../types";
import { formatCurrency } from "../utils";

interface InvoicesViewProps {
  invoices: Invoice[];
  clients: Client[];
  profile: FreelancerProfile;
  searchTerm: string;
  onAddInvoice: (inv: Omit<Invoice, "id" | "freelancerId" | "createdAt" | "invoiceNumber">) => void;
  onUpdateInvoice: (id: string, inv: Partial<Invoice>) => void;
  onDeleteInvoice: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
}

export default function InvoicesView({
  invoices,
  clients,
  profile,
  searchTerm,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onTriggerUpgrade,
}: InvoicesViewProps) {
  const isFree = profile.plan === "Free" && !profile.premium;
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | Invoice["status"]>("All");
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showClientWarning, setShowClientWarning] = useState(false);

  // Form Fields
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 2 weeks default
    return d.toISOString().split("T")[0];
  });
  const [services, setServices] = useState<InvoiceService[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Invoice["status"]>("Draft");

  const filteredInvoices = invoices.filter((i) => {
    const client = clients.find((c) => c.id === i.clientId);
    const clientCompany = client ? client.companyName.toLowerCase() : "";
    const matchesSearch =
      i.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientCompany.includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "All" || i.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const getClientMeta = (cId: string) => {
    return clients.find((c) => c.id === cId);
  };

  const handleOpenAdd = () => {
    if (clients.length === 0) {
      setShowClientWarning(true);
      return;
    }
    // Limit check for free tier
    if (isFree && invoices.length >= 5) {
      onTriggerUpgrade("invoice_limit");
      return;
    }

    setClientId(clients[0].id);
    setServices([{ description: "", quantity: 1, rate: 0 }]);
    setTaxRate(0);
    setNotes("Thank you for your business!");
    setStatus("Draft");
    setIsAdding(true);
  };

  const handleAddServiceLine = () => {
    setServices([...services, { description: "", quantity: 1, rate: 0 }]);
  };

  const handleRemoveServiceLine = (idx: number) => {
    if (services.length === 1) return;
    setServices(services.filter((_, i) => i !== idx));
  };

  const handleServiceChange = (idx: number, field: keyof InvoiceService, value: any) => {
    const updated = [...services];
    if (field === "quantity" || field === "rate") {
      updated[idx][field] = Number(value) || 0;
    } else {
      updated[idx][field] = value;
    }
    setServices(updated);
  };

  const calculateSubtotal = (srvs: InvoiceService[]) => {
    return srvs.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      console.warn("Please allocate a verified client ledger account first.");
      return;
    }

    onAddInvoice({
      clientId,
      issueDate,
      dueDate,
      services,
      taxRate: Number(taxRate) || 0,
      notes: notes.trim(),
      status,
    });

    setIsAdding(false);
  };

  const handlePrint = (inv: Invoice) => {
    // Elegant stylesheet printing standard browser hook
    setPreviewInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Tab filter & billing header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5/2 gap-2">
          {["All", "Draft", "Sent", "Paid", "Overdue"].map((statusOption) => (
            <button
              key={statusOption}
              onClick={() => setActiveTab(statusOption as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === statusOption
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-650/20"
                  : "glass-item text-slate-500 hover:text-slate-800"
              }`}
            >
              {statusOption} ({statusOption === "All" ? invoices.length : invoices.filter((i) => i.status === statusOption).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isFree && (
            <span className="text-[11px] text-slate-400 font-medium">
              Invoices: <strong>{invoices.length}/5</strong>
            </span>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
          >
            <Plus size={14} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl glass-modal rounded-x1/2 rounded-2xl shadow-2xl overflow-hidden my-8"
            >
              <div className="p-5 border-b border-black/5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-805">
                    Draft New Account Invoice
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Will auto-allocate next sequential voucher identifier.
                  </span>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-1 rounded-full hover:bg-black/5 text-slate-400"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                {/* Client Assign & Status */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Debtor Client Partner *</label>
                    <select
                      value={clientId}
                      required
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-805 text-xs focus:outline-none"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.contactPerson})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Initial Invoice Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-805 text-xs focus:outline-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent - Awaiting payment</option>
                      <option value="Paid">Paid - Clear cash receipt</option>
                      <option value="Overdue">Overdue - Late account response</option>
                    </select>
                  </div>
                </div>

                {/* Billing Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Invoice Issue Date</label>
                    <input
                      type="date"
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-850"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Due Date Target</label>
                    <input
                      type="date"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-850"
                    />
                  </div>
                </div>

                {/* Line Items Builder / Services */}
                <div className="space-y-2 border-t border-black/5 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Billable Services & Deliverables</span>
                    <button
                      type="button"
                      onClick={handleAddServiceLine}
                      className="text-[11px] text-indigo-650 font-bold hover:underline cursor-pointer"
                    >
                      + Add Deliverable Line
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {services.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6">
                          <input
                            type="text"
                            required
                            placeholder="Service short description / project milestone"
                            value={item.description}
                            onChange={(e) => handleServiceChange(idx, "description", e.target.value)}
                            className="w-full py-1.5 px-2 glass-input rounded-lg"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Qty"
                            value={item.quantity || ""}
                            onChange={(e) => handleServiceChange(idx, "quantity", e.target.value)}
                            className="w-full py-1.5 px-2 glass-input rounded-lg text-center"
                          />
                        </div>
                        <div className="col-span-3 relative">
                          <span className="absolute left-1.5 top-2 bg-transparent text-[10px] text-slate-400">
                            {profile.currency === "INR" ? "₹" : "$"}
                          </span>
                          <input
                            type="number"
                            min="0"
                            required
                            placeholder="Unit Rate"
                            value={item.rate || ""}
                            onChange={(e) => handleServiceChange(idx, "rate", e.target.value)}
                            className="w-full py-1.5 pl-4 pr-1 glass-input rounded-lg"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceLine(idx)}
                            className="p-1 text-red-550 hover:bg-black/5 rounded-lg cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subtotals & Taxes */}
                <div className="grid md:grid-cols-2 gap-4 border-t border-black/5 pt-4">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">State / Professional Taxes (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="e.g. 18 for 18% GST"
                      value={taxRate || ""}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-850"
                    />
                  </div>

                  <div className="p-3 bg-slate-500/5 border border-black/5 rounded-xl space-y-1.5 text-right font-semibold">
                    <div className="flex items-center justify-between text-[11px] text-slate-450">
                      <span>Subtotal amount:</span>
                      <span className="font-mono">{formatCurrency(calculateSubtotal(services), profile.currency)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-slate-450">
                        <span>Tax computed ({taxRate}%):</span>
                        <span className="font-mono">{formatCurrency(calculateSubtotal(services) * (taxRate / 100), profile.currency)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-black/5 text-sm font-bold text-slate-800">
                      <span>Gross Due Total:</span>
                      <span className="font-mono text-indigo-650">
                        {formatCurrency(calculateSubtotal(services) + calculateSubtotal(services) * (taxRate / 100), profile.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Invoicing Disclaimers / Payment Terms</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-850 resize-none"
                    placeholder="Provide routing codes, standard UPI accounts, late fee regulations..."
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 py-2 border border-white/10 text-slate-500 hover:bg-black/5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Discard Draft
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Approve & Save Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Invoice Detail Overlay */}
      <AnimatePresence>
        {previewInvoice && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto no-print">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden print-layout"
            >
              {/* Actions Header (hidden during printing) */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between no-print">
                <span className="font-bold text-xs text-slate-500">Invoice Review Panel</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrint(previewInvoice)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                  >
                    <Printer size={13} />
                    <span>Print Version</span>
                  </button>
                  <button
                    onClick={() => setPreviewInvoice(null)}
                    className="p-1 rounded-full hover:bg-slate-200 text-slate-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Real Print Template Body */}
              <div className="p-8 space-y-6 text-slate-800 bg-white leading-normal prt">
                {/* Header Row */}
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-extrabold text-indigo-700 tracking-tight">
                      {profile.businessName || "INVOICE"}
                    </h1>
                    {profile.businessName && <span className="text-sm text-slate-500">{profile.name}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-800 font-mono d-block">{previewInvoice.invoiceNumber}</span>
                    <span className="text-xs text-slate-400 block mt-1">Voucher Ledger Ref</span>
                  </div>
                </div>

                {/* Date Fields / Parties details */}
                <div className="grid grid-cols-2 gap-8 border-y border-slate-100 py-6 text-xs text-slate-600">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-2">Billed From (Freelancer)</span>
                    <strong className="text-slate-800 block text-sm">{profile.name}</strong>
                    {profile.businessName && <span className="block text-slate-500 font-medium mt-0.5">{profile.businessName}</span>}
                  </div>

                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-2">Billed To (Client Partner)</span>
                    {getClientMeta(previewInvoice.clientId) ? (
                      <>
                        <strong className="text-slate-800 block text-sm">
                          {getClientMeta(previewInvoice.clientId)?.companyName}
                        </strong>
                        <span className="block text-slate-500 mt-0.5 font-medium">
                          Rep: {getClientMeta(previewInvoice.clientId)?.contactPerson}
                        </span>
                        {getClientMeta(previewInvoice.clientId)?.email && (
                          <span className="block text-slate-400 font-mono mt-0.5">
                            {getClientMeta(previewInvoice.clientId)?.email}
                          </span>
                        )}
                      </>
                    ) : (
                      <strong className="text-slate-400">Direct Workspace Ledger Account</strong>
                    )}
                  </div>
                </div>

                {/* More Details dates */}
                <div className="grid grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Issue Date:</span>
                    <strong className="text-slate-800">{new Date(previewInvoice.issueDate).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Due Date:</span>
                    <strong className="text-slate-800">{new Date(previewInvoice.dueDate).toLocaleDateString()}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Status:</span>
                    <strong className={`uppercase text-[10px] px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      previewInvoice.status === "Paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : previewInvoice.status === "Sent"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {previewInvoice.status}
                    </strong>
                  </div>
                </div>

                {/* Items list table */}
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3">Service Line Deliverable</th>
                      <th className="py-3 text-center w-16">Qty</th>
                      <th className="py-3 text-right w-24">Rate</th>
                      <th className="py-3 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewInvoice.services.map((s, index) => (
                      <tr key={index} className="hover:bg-slate-50/40">
                        <td className="py-3 font-semibold text-slate-800">{s.description || "Milestone execution deliverable"}</td>
                        <td className="py-3 text-center font-mono">{s.quantity}</td>
                        <td className="py-3 text-right font-mono">{formatCurrency(s.rate, profile.currency)}</td>
                        <td className="py-3 text-right font-mono font-semibold text-slate-800">
                          {formatCurrency(s.quantity * s.rate, profile.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary breakouts */}
                <div className="flex justify-end pt-4">
                  <div className="w-64 space-y-2 text-right text-xs">
                    <div className="flex justify-between font-semibold text-slate-500">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatCurrency(calculateSubtotal(previewInvoice.services), profile.currency)}</span>
                    </div>

                    {previewInvoice.taxRate > 0 && (
                      <div className="flex justify-between font-semibold text-slate-500">
                        <span>Tax computed ({previewInvoice.taxRate}%):</span>
                        <span className="font-mono">
                          {formatCurrency(calculateSubtotal(previewInvoice.services) * (previewInvoice.taxRate / 100), profile.currency)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-extrabold text-slate-800 border-t border-slate-200 pt-2.5">
                      <span className="text-indigo-700 font-extrabold uppercase">Total Due:</span>
                      <span className="font-mono text-indigo-700">
                        {formatCurrency(
                          calculateSubtotal(previewInvoice.services) +
                            calculateSubtotal(previewInvoice.services) * (previewInvoice.taxRate / 100),
                          profile.currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer notes */}
                {previewInvoice.notes && (
                  <div className="border-t border-dashed border-slate-100 pt-6 mt-8 text-xs text-slate-400 italic">
                    <strong className="text-slate-600 block not-italic font-bold mb-1">Additional Terms & Disclaimers:</strong>
                    "{previewInvoice.notes}"
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>      {/* Listing Content */}
      {filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl glass-panel text-center">
          <FileText className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No invoices drafted</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {invoices.length === 0
              ? "Your client ledger billing is empty. Start formatting beautiful invoices to secure direct bank transactions."
              : "Recheck search parameters or status filters to locate specific account bills."}
          </p>
          {invoices.length === 0 && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all font-bold cursor-pointer"
            >
              Compose Account Invoice
            </button>
          )}
        </div>
      ) : (
        /* Invoices Visual List */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
          {filteredInvoices.map((inv) => {
            const client = getClientMeta(inv.clientId);
            const sub = calculateSubtotal(inv.services);
            const tax = sub * (inv.taxRate / 100);
            const total = sub + tax;
            const isLate = new Date(inv.dueDate) < new Date() && inv.status !== "Paid";

            return (
              <motion.div
                layout
                key={inv.id}
                className="p-5 rounded-2xl glass-panel glass-highlight transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm font-mono leading-none">
                        {inv.invoiceNumber}
                      </h4>
                      <strong className="text-xs text-indigo-505 font-medium block mt-1 line-clamp-1">
                        To: {client ? client.companyName : "Independent Lead"}
                      </strong>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      inv.status === "Paid"
                        ? "bg-emerald-500/10 text-emerald-650"
                        : inv.status === "Sent"
                        ? "bg-sky-500/10 text-sky-655"
                        : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {inv.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-500 border-t border-black/5 pt-3 mb-4">
                    <div className="flex items-baseline justify-between">
                      <span>Gross Due Total:</span>
                      <strong className="text-slate-850 font-bold font-mono text-sm leading-none text-indigo-600">
                        {formatCurrency(total, profile.currency)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-[11px] mt-2">
                      <span>Billed Date:</span>
                      <span>{new Date(inv.issueDate).toLocaleDateString()}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span>Due Date:</span>
                      <span className={isLate ? "text-red-500 font-semibold" : ""}>
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-2.5 pt-3.5 border-t border-black/5">
                  {inv.status !== "Paid" && (
                    <button
                      onClick={() => onUpdateInvoice(inv.id, { status: "Paid" })}
                      className="p-1 px-2.5 bg-emerald-500/10 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Check size={11} />
                      <span>Mark Paid</span>
                    </button>
                  )}
                  {inv.status === "Draft" && (
                    <button
                      onClick={() => onUpdateInvoice(inv.id, { status: "Sent" })}
                      className="p-1 px-2.5 bg-sky-505/10 text-sky-600 hover:text-white hover:bg-sky-500 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Send size={11} />
                      <span>Release Sent</span>
                    </button>
                  )}

                  <button
                    onClick={() => setPreviewInvoice(inv)}
                    className="p-1 px-2.5 border border-white/20 text-slate-500 hover:text-slate-700 hover:bg-black/5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={11} />
                    <span>View / PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Remove invoice ${inv.invoiceNumber}? This action is permanent.`)) {
                        onDeleteInvoice(inv.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-550 rounded-lg ml-auto opacity-70 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Client Warning Modal Overlay */}
      <AnimatePresence>
        {showClientWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden p-6 border border-slate-100"
            >
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full mb-4">
                  <AlertCircle size={24} />
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm mb-2">
                  Client Profile Required
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Please configure at least one Client profile first before launching billing invoices.
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setShowClientWarning(false)}
                    className="flex-1 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
