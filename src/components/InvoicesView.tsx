import React, { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Check,
  X,
  FileText,
  Download,
  Printer,
  Trash2,
  AlertCircle,
  Send,
  Mail,
  Loader2,
  RefreshCw,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { Invoice, Client, FreelancerProfile, InvoiceService } from "../types";
import { formatCurrency } from "../utils";
import {
  sendGmailMessage,
  connectGmailWithGSI,
  getActiveGmailToken,
} from "../services/gmailService";
import { canAccessGmail } from "../services/gmailEntitlement";
import {
  generateInvoicePdfBase64,
  downloadInvoicePdf,
} from "../utils/invoicePdfGenerator";
import InvoiceReminderModal from "./InvoiceReminderModal";

interface InvoicesViewProps {
  invoices: Invoice[];
  clients: Client[];
  profile: FreelancerProfile;
  searchTerm: string;
  onAddInvoice: (inv: Omit<Invoice, "id" | "freelancerId" | "createdAt" | "invoiceNumber">) => void;
  onUpdateInvoice: (id: string, inv: Partial<Invoice>) => void;
  onDeleteInvoice: (id: string) => void;
  onUpdateClient?: (id: string, fields: Partial<Client>) => void;
  onUpdateProfile?: (fields: Partial<FreelancerProfile>) => void;
  onTriggerUpgrade: (reason: string) => void;
  onOpenReminderModal?: (invoice: Invoice) => void;
}

function InvoicesView({
  invoices,
  clients,
  profile,
  searchTerm,
  onAddInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onUpdateClient,
  onUpdateProfile,
  onTriggerUpgrade,
}: InvoicesViewProps) {
  const isPro =
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "Annual" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free");

  const isFree = !isPro;

  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState<"All" | Invoice["status"]>("All");
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [showClientWarning, setShowClientWarning] = useState(false);

  // Email Sending States
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [showGmailConnectModal, setShowGmailConnectModal] = useState(false);
  const [pendingSendInvoice, setPendingSendInvoice] = useState<Invoice | null>(null);

  // Missing Client Email Modal State
  const [emailModalInvoice, setEmailModalInvoice] = useState<Invoice | null>(null);
  const [customRecipientEmail, setCustomRecipientEmail] = useState("");
  const [saveEmailToProfile, setSaveEmailToProfile] = useState(true);
  const [emailInputError, setEmailInputError] = useState("");

  // Notification Toast / Banner State
  const [bannerNotice, setBannerNotice] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Active Reminder Modal State
  const [reminderModalInvoice, setReminderModalInvoice] = useState<Invoice | null>(null);

  // Create Form Fields
  const [clientId, setClientId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [services, setServices] = useState<InvoiceService[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState("Thank you for your business! Payment is due upon receipt.");
  const [status, setStatus] = useState<Invoice["status"]>("Draft");

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    for (const c of clients) {
      map.set(c.id, c);
    }
    return map;
  }, [clients]);

  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return invoices.filter((i) => {
      const client = clientMap.get(i.clientId);
      const clientCompany = client ? client.companyName.toLowerCase() : "";
      const matchesSearch =
        i.invoiceNumber.toLowerCase().includes(term) ||
        clientCompany.includes(term);
      const matchesTab = activeTab === "All" || i.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [invoices, clientMap, searchTerm, activeTab]);

  const getClientMeta = (cId: string) => {
    return clientMap.get(cId);
  };

  const calculateSubtotal = (srvs: InvoiceService[]) => {
    return srvs.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0);
  };

  const handleOpenAdd = () => {
    if (clients.length === 0) {
      setShowClientWarning(true);
      return;
    }
    if (isFree && invoices.length >= 5) {
      onTriggerUpgrade("invoice_limit");
      return;
    }

    setClientId(clients[0].id);
    setServices([{ description: "", quantity: 1, rate: 0 }]);
    setTaxRate(0);
    setNotes("Thank you for your business! Payment is due upon receipt.");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
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

  // Helper to validate email string
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  /**
   * Connect Gmail handler
   */
  const handleConnectGmail = async (andResumeInvoice?: Invoice | null) => {
    if (!canAccessGmail(profile)) {
      setShowGmailConnectModal(false);
      onTriggerUpgrade("gmail_integration");
      return;
    }

    try {
      setConnectingGmail(true);
      const res = await connectGmailWithGSI();
      if (res && res.email) {
        if (onUpdateProfile) {
          onUpdateProfile({
            gmailConnected: true,
            gmailEmail: res.email,
            gmailName: res.name || profile.name,
            gmailPicture: res.picture,
            gmailConnectedAt: new Date().toISOString(),
          });
        }
        setShowGmailConnectModal(false);
        setBannerNotice({
          type: "success",
          title: "Gmail Connected",
          message: `Successfully connected ${res.email}. You can now send invoices directly!`,
        });

        const target = andResumeInvoice || pendingSendInvoice;
        if (target) {
          setPendingSendInvoice(null);
          // Resume send with small delay for state update
          setTimeout(() => {
            handleInitiateSend(target);
          }, 300);
        }
      }
    } catch (err: any) {
      setBannerNotice({
        type: "error",
        title: "Connection Failed",
        message: err.message || "Failed to connect Gmail. Please try again.",
      });
    } finally {
      setConnectingGmail(false);
    }
  };

  /**
   * Main entry point when user clicks "Send" / "Send Invoice" / "Resend"
   */
  const handleInitiateSend = async (inv: Invoice) => {
    // 1. Pro Entitlement Check
    if (isFree) {
      onTriggerUpgrade("invoice_email");
      return;
    }

    // 2. Gmail Connection Check
    const hasToken = !!getActiveGmailToken();
    const isGmailConnected = !!(profile.gmailConnected && profile.gmailEmail);
    if (!isGmailConnected || !hasToken) {
      setPendingSendInvoice(inv);
      setShowGmailConnectModal(true);
      return;
    }

    // 3. Client Email Check
    const client = getClientMeta(inv.clientId);
    const clientEmail = client?.email?.trim();

    if (!clientEmail || !isValidEmail(clientEmail)) {
      // Prompt user with "Client email required" dialog
      setEmailModalInvoice(inv);
      setCustomRecipientEmail(clientEmail || "");
      setSaveEmailToProfile(true);
      setEmailInputError("");
      return;
    }

    // Client email exists and is valid -> Proceed to send
    await executeSendInvoice(inv, clientEmail, false);
  };

  /**
   * Submit email from "Client email required" dialog
   */
  const handleSendWithCustomEmail = async () => {
    if (!emailModalInvoice) return;
    const trimmed = customRecipientEmail.trim();
    if (!trimmed) {
      setEmailInputError("Please enter an email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailInputError("Please enter a valid email address (e.g. client@company.com).");
      return;
    }

    const inv = emailModalInvoice;
    const saveToClient = saveEmailToProfile;
    setEmailModalInvoice(null);
    setEmailInputError("");

    await executeSendInvoice(inv, trimmed, saveToClient);
  };

  /**
   * Core execution of the real email sending workflow
   */
  const executeSendInvoice = async (
    inv: Invoice,
    targetEmail: string,
    saveToClient: boolean
  ) => {
    const client = getClientMeta(inv.clientId);
    setSendingInvoiceId(inv.id);
    setBannerNotice(null);

    try {
      // 1. Calculate invoice amounts
      const subtotal = calculateSubtotal(inv.services);
      const taxAmount = subtotal * ((inv.taxRate || 0) / 100);
      const grandTotal = subtotal + taxAmount;
      const formattedTotal = formatCurrency(grandTotal, profile.currency);

      // 2. Generate PDF Base64
      const pdfBase64 = generateInvoicePdfBase64(inv, client, profile);
      const cleanInvoiceNumber = inv.invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_");
      const pdfFilename = `Invoice_${cleanInvoiceNumber}.pdf`;

      // 3. Build Email Content
      const clientGreeting = client?.contactPerson || client?.companyName || "there";
      const senderName = profile.name || "Freelancer";
      const businessName = profile.businessName || senderName;
      const subject = `Invoice #${inv.invoiceNumber} from ${businessName} (${formattedTotal})`;

      const htmlServicesRows = inv.services
        .map(
          (s) =>
            `<tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${s.description || "Milestone Deliverable"}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #475569;">${s.quantity}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">${formatCurrency(s.rate, profile.currency)}</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; color: #1e293b;">${formatCurrency(s.quantity * s.rate, profile.currency)}</td>
            </tr>`
        )
        .join("");

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #334155; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #1e293b; color: #ffffff; padding: 24px; text-align: left;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${businessName}</h1>
            <p style="margin: 4px 0 0; font-size: 13px; color: #cbd5e1;">Invoice #${inv.invoiceNumber}</p>
          </div>

          <div style="padding: 24px;">
            <p style="font-size: 15px; margin-top: 0;">Hi <strong>${clientGreeting}</strong>,</p>
            <p style="font-size: 14px; color: #475569;">
              Thank you for working with us! Please find attached Invoice <strong>#${inv.invoiceNumber}</strong> for the amount of <strong>${formattedTotal}</strong>, due on <strong>${new Date(inv.dueDate).toLocaleDateString()}</strong>.
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="color: #64748b; padding-bottom: 6px;">Invoice Number:</td>
                  <td style="font-weight: 600; text-align: right; padding-bottom: 6px; color: #0f172a;">${inv.invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding-bottom: 6px;">Issue Date:</td>
                  <td style="font-weight: 600; text-align: right; padding-bottom: 6px; color: #0f172a;">${new Date(inv.issueDate).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding-bottom: 6px;">Due Date:</td>
                  <td style="font-weight: 600; text-align: right; padding-bottom: 6px; color: #0f172a;">${new Date(inv.dueDate).toLocaleDateString()}</td>
                </tr>
                <tr style="border-top: 1px solid #cbd5e1;">
                  <td style="font-weight: 700; font-size: 15px; color: #4338ca; padding-top: 10px;">Total Due:</td>
                  <td style="font-weight: 700; font-size: 16px; color: #4338ca; text-align: right; padding-top: 10px;">${formattedTotal}</td>
                </tr>
              </table>
            </div>

            <h4 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px;">Breakdown of Services</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #475569; text-transform: uppercase; font-size: 11px;">
                  <th style="padding: 8px 12px; text-align: left;">Deliverable</th>
                  <th style="padding: 8px 12px; text-align: center;">Qty</th>
                  <th style="padding: 8px 12px; text-align: right;">Rate</th>
                  <th style="padding: 8px 12px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${htmlServicesRows}
              </tbody>
            </table>

            ${
              inv.notes
                ? `<div style="background-color: #f8fafc; border-left: 3px solid #6366f1; padding: 12px; font-size: 12px; color: #475569; margin-bottom: 20px;">
                    <strong>Payment Notes:</strong><br/>${inv.notes}
                   </div>`
                : ""
            }

            <p style="font-size: 13px; color: #64748b;">
              📎 The official invoice PDF document is attached to this email for your accounting records.
            </p>

            <div style="border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 16px; font-size: 13px; color: #475569;">
              Best regards,<br/>
              <strong>${senderName}</strong><br/>
              ${profile.businessName ? `<span>${profile.businessName}</span><br/>` : ""}
              ${profile.gmailEmail ? `<span style="color: #64748b; font-size: 12px;">${profile.gmailEmail}</span>` : ""}
            </div>
          </div>
        </div>
      `;

      // 4. Send via Gmail Integration
      const result = await sendGmailMessage({
        to: targetEmail,
        subject,
        body: emailHtml,
        attachments: [
          {
            filename: pdfFilename,
            mimeType: "application/pdf",
            base64Data: pdfBase64,
          },
        ],
        freelancerId: profile.id,
      });

      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      // 5. Update Client Email if requested and changed
      if (saveToClient && client && onUpdateClient) {
        onUpdateClient(client.id, { email: targetEmail });
      }

      // 6. SUCCESS: Update invoice status to "Sent" with audit metadata
      const sentTimestamp = new Date().toISOString();
      onUpdateInvoice(inv.id, {
        status: "Sent",
        sentAt: sentTimestamp,
        sentTo: targetEmail,
        sendMethod: "Gmail",
        lastSendError: undefined,
      });

      // Update preview if currently open
      if (previewInvoice && previewInvoice.id === inv.id) {
        setPreviewInvoice({
          ...previewInvoice,
          status: "Sent",
          sentAt: sentTimestamp,
          sentTo: targetEmail,
          sendMethod: "Gmail",
          lastSendError: undefined,
        });
      }

      setBannerNotice({
        type: "success",
        title: "Invoice Sent Successfully",
        message: `Invoice #${inv.invoiceNumber} has been delivered to ${targetEmail} with the generated PDF attached.`,
      });
    } catch (err: any) {
      console.error("[Invoice Send Failed]", err);
      const errMsg = err.message || "Invoice could not be sent. Please try again.";

      // CRITICAL: DO NOT mark invoice as Sent. Keep status and persist error for user transparency.
      onUpdateInvoice(inv.id, {
        lastSendError: errMsg,
      });

      const isAuthError =
        errMsg.toLowerCase().includes("expired") ||
        errMsg.toLowerCase().includes("reconnect") ||
        errMsg.toLowerCase().includes("re-authenticate") ||
        errMsg.toLowerCase().includes("401");

      setBannerNotice({
        type: "error",
        title: "Invoice Could Not Be Sent",
        message: errMsg,
        actionLabel: isAuthError ? "Reconnect Gmail" : "Retry Send",
        onAction: isAuthError
          ? () => handleConnectGmail(inv)
          : () => executeSendInvoice(inv, targetEmail, saveToClient),
      });
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleDownloadPdf = (inv: Invoice) => {
    const client = getClientMeta(inv.clientId);
    downloadInvoicePdf(inv, client, profile);
  };

  const handlePrint = (inv: Invoice) => {
    setPreviewInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  return (
    <div className="space-y-6" id="invoices-view-container">
      {/* Dynamic Status / Error / Success Notification Banner */}
      <AnimatePresence>
        {bannerNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`p-4 rounded-2xl border flex items-start justify-between gap-3 shadow-sm ${
              bannerNotice.type === "success"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                : bannerNotice.type === "error"
                ? "bg-red-50/90 border-red-200 text-red-900"
                : "bg-indigo-50/90 border-indigo-200 text-indigo-900"
            }`}
            id="invoice-notification-banner"
          >
            <div className="flex items-start gap-3">
              {bannerNotice.type === "success" ? (
                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-xl mt-0.5">
                  <Check size={16} />
                </div>
              ) : bannerNotice.type === "error" ? (
                <div className="p-1.5 bg-red-100 text-red-600 rounded-xl mt-0.5">
                  <AlertCircle size={16} />
                </div>
              ) : (
                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-xl mt-0.5">
                  <Mail size={16} />
                </div>
              )}
              <div>
                <h4 className="font-bold text-xs leading-tight">{bannerNotice.title}</h4>
                <p className="text-xs opacity-90 mt-0.5 max-w-xl">{bannerNotice.message}</p>
                {bannerNotice.actionLabel && bannerNotice.onAction && (
                  <button
                    onClick={bannerNotice.onAction}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 hover:bg-white text-xs font-bold rounded-lg border border-black/10 shadow-xs transition-all cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    <span>{bannerNotice.actionLabel}</span>
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setBannerNotice(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
              {statusOption} (
              {statusOption === "All"
                ? invoices.length
                : invoices.filter((i) => i.status === statusOption).length}
              )
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
            className="flex items-center gap-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5 cursor-pointer"
            id="create-invoice-header-btn"
          >
            <Plus size={14} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Modal: Create Invoice */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-8 border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Draft New Account Invoice
                  </h3>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Configure deliverable line rates and client account details
                  </span>
                </div>
                <button
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Select Client Profile */}
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">
                      Select Client Account *
                    </label>
                    <select
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                      required
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.contactPerson}) {c.email ? `• ${c.email}` : "• (No email)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Initial Status */}
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">
                      Initial Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                    >
                      <option value="Draft">Draft (Unsent)</option>
                      <option value="Sent">Sent</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                      required
                    />
                  </div>
                </div>

                {/* Service Line Items */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Invoice Line Deliverables
                    </span>
                    <button
                      type="button"
                      onClick={handleAddServiceLine}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Deliverable Line</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {services.map((srv, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Deliverable Description (e.g. UX Design & Implementation)"
                          value={srv.description}
                          onChange={(e) => handleServiceChange(idx, "description", e.target.value)}
                          className="flex-3 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                          required
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          min="1"
                          value={srv.quantity}
                          onChange={(e) => handleServiceChange(idx, "quantity", e.target.value)}
                          className="w-16 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800 text-center"
                          required
                        />
                        <div className="relative w-28">
                          <input
                            type="number"
                            placeholder="Rate"
                            min="0"
                            step="any"
                            value={srv.rate || ""}
                            onChange={(e) => handleServiceChange(idx, "rate", e.target.value)}
                            className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800 text-right pr-2"
                            required
                          />
                        </div>
                        {services.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceLine(idx)}
                            className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tax rate and summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-slate-600 text-xs font-semibold mb-1">
                      Tax Rate (% applied to subtotal)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      placeholder="e.g. 18 for 18% GST / VAT"
                      value={taxRate || ""}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800"
                    />
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-center space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Subtotal:</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(calculateSubtotal(services), profile.currency)}
                      </span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Tax ({taxRate}%):</span>
                        <span className="font-mono">
                          {formatCurrency(
                            calculateSubtotal(services) * (taxRate / 100),
                            profile.currency
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-extrabold text-slate-800 border-t border-slate-200 pt-1">
                      <span>Gross Due:</span>
                      <span className="font-mono text-indigo-600">
                        {formatCurrency(
                          calculateSubtotal(services) +
                            calculateSubtotal(services) * (taxRate / 100),
                          profile.currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-slate-600 text-xs font-semibold mb-1">
                    Payment Instructions / Additional Notes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide wire instructions, UPI details, or contract milestone reference..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-medium text-slate-800 resize-none"
                  />
                </div>

                {/* Form Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                  >
                    Create & Save Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Missing Client Email ("Client email required") */}
      <AnimatePresence>
        {emailModalInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-6 border border-slate-200"
              id="client-email-required-modal"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Client email required
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    This client doesn't have an email address. Enter an email address to send this invoice.
                  </p>
                </div>
              </div>

              <div className="space-y-4 my-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Recipient Email Address *
                  </label>
                  <input
                    type="email"
                    placeholder="client@company.com"
                    value={customRecipientEmail}
                    onChange={(e) => {
                      setCustomRecipientEmail(e.target.value);
                      if (emailInputError) setEmailInputError("");
                    }}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden transition-colors ${
                      emailInputError
                        ? "border-red-400 focus:border-red-500"
                        : "border-slate-200 focus:border-indigo-500"
                    }`}
                    autoFocus
                    required
                  />
                  {emailInputError && (
                    <p className="text-[11px] text-red-500 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle size={12} />
                      <span>{emailInputError}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <input
                    type="checkbox"
                    id="save-client-email-toggle"
                    checked={saveEmailToProfile}
                    onChange={(e) => setSaveEmailToProfile(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded-sm border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label
                    htmlFor="save-client-email-toggle"
                    className="text-xs text-slate-700 font-medium cursor-pointer select-none"
                  >
                    Save this email to client profile for future invoices
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setEmailModalInvoice(null);
                    setEmailInputError("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendWithCustomEmail}
                  disabled={sendingInvoiceId === emailModalInvoice.id}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/10 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="submit-client-email-send-btn"
                >
                  {sendingInvoiceId === emailModalInvoice.id ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending Invoice...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal: Connect Gmail to send invoices */}
      <AnimatePresence>
        {showGmailConnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden p-6 border border-slate-200"
              id="connect-gmail-invoice-modal"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Connect Gmail to send invoices
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Connect your Gmail account to send invoices directly from Freelancer CRM. Invoices are delivered straight to your clients with attached PDFs from your official email.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 my-4 text-xs text-slate-600 space-y-1.5">
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Real email delivery via official Google APIs</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Automatic PDF attachment generated on send</span>
                </div>
                <div className="flex items-center gap-2 font-medium text-slate-800">
                  <Check size={14} className="text-emerald-600 shrink-0" />
                  <span>Immediate status confirmation & delivery tracking</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowGmailConnectModal(false);
                    setPendingSendInvoice(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConnectGmail(pendingSendInvoice)}
                  disabled={connectingGmail}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/15 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  id="connect-gmail-action-btn"
                >
                  {connectingGmail ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={13} />
                      <span>Connect Gmail</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Invoice Detail Overlay */}
      <AnimatePresence>
        {previewInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto no-print"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden my-6 border border-slate-200"
            >
              {/* Modal Top Bar */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                    <FileText size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800">
                      Invoice Review & Export
                    </span>
                    <span className="block text-[10px] text-slate-400 font-mono">
                      {previewInvoice.invoiceNumber}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleInitiateSend(previewInvoice)}
                    disabled={sendingInvoiceId === previewInvoice.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    title="Send invoice with PDF via Gmail"
                  >
                    {sendingInvoiceId === previewInvoice.id ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={12} />
                        <span>{previewInvoice.status === "Sent" ? "Resend Email" : "Send via Gmail"}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleDownloadPdf(previewInvoice)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                    title="Download PDF"
                  >
                    <Download size={12} />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handlePrint(previewInvoice)}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-xl transition-all cursor-pointer"
                    title="Print Document"
                  >
                    <Printer size={15} />
                  </button>

                  <button
                    onClick={() => setPreviewInvoice(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-all cursor-pointer ml-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Printable invoice card content */}
              <div id="printable-invoice" className="p-8 space-y-6 text-slate-800 bg-white">
                {/* Header info */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                      {profile.businessName || profile.name || "INVOICE"}
                    </h2>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Professional Freelance Services
                    </span>
                    {profile.gmailEmail && (
                      <span className="text-xs text-slate-400 font-mono block mt-0.5">
                        {profile.gmailEmail}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-indigo-700 font-mono block">
                      {previewInvoice.invoiceNumber}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                      previewInvoice.status === "Paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : previewInvoice.status === "Sent"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {previewInvoice.status}
                    </span>
                  </div>
                </div>

                {/* Parties Details */}
                <div className="grid grid-cols-2 gap-8 border-b border-slate-100 pb-5 text-xs text-slate-600">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Billed From
                    </span>
                    <strong className="text-slate-900 block text-sm">{profile.name}</strong>
                    {profile.businessName && (
                      <span className="block text-slate-500 font-medium">{profile.businessName}</span>
                    )}
                  </div>

                  <div>
                    <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Billed To
                    </span>
                    {getClientMeta(previewInvoice.clientId) ? (
                      <>
                        <strong className="text-slate-900 block text-sm">
                          {getClientMeta(previewInvoice.clientId)?.companyName}
                        </strong>
                        <span className="block text-slate-500 font-medium">
                          Attn: {getClientMeta(previewInvoice.clientId)?.contactPerson}
                        </span>
                        {getClientMeta(previewInvoice.clientId)?.email ? (
                          <span className="block text-indigo-600 font-mono mt-0.5">
                            {getClientMeta(previewInvoice.clientId)?.email}
                          </span>
                        ) : (
                          <span className="text-amber-600 text-[11px] font-medium block mt-0.5">
                            (No email saved in client profile)
                          </span>
                        )}
                      </>
                    ) : (
                      <strong className="text-slate-400">Direct Client Account</strong>
                    )}
                  </div>
                </div>

                {/* Dates & Metadata */}
                <div className="grid grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Issue Date:</span>
                    <strong className="text-slate-900">{new Date(previewInvoice.issueDate).toLocaleDateString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Due Date:</span>
                    <strong className="text-slate-900">{new Date(previewInvoice.dueDate).toLocaleDateString()}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Currency:</span>
                    <strong className="text-slate-900 font-mono">{profile.currency || "USD"}</strong>
                  </div>
                </div>

                {/* Services Table */}
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5">Deliverable</th>
                      <th className="py-2.5 text-center w-16">Qty</th>
                      <th className="py-2.5 text-right w-24">Rate</th>
                      <th className="py-2.5 text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewInvoice.services.map((s, index) => (
                      <tr key={index} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-semibold text-slate-800">
                          {s.description || "Project deliverable"}
                        </td>
                        <td className="py-2.5 text-center font-mono">{s.quantity}</td>
                        <td className="py-2.5 text-right font-mono">{formatCurrency(s.rate, profile.currency)}</td>
                        <td className="py-2.5 text-right font-mono font-semibold text-slate-900">
                          {formatCurrency(s.quantity * s.rate, profile.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary Breakout */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-2 text-right text-xs">
                    <div className="flex justify-between font-semibold text-slate-500">
                      <span>Subtotal:</span>
                      <span className="font-mono">{formatCurrency(calculateSubtotal(previewInvoice.services), profile.currency)}</span>
                    </div>

                    {previewInvoice.taxRate > 0 && (
                      <div className="flex justify-between font-semibold text-slate-500">
                        <span>Tax ({previewInvoice.taxRate}%):</span>
                        <span className="font-mono">
                          {formatCurrency(
                            calculateSubtotal(previewInvoice.services) * (previewInvoice.taxRate / 100),
                            profile.currency
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-2">
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

                {/* Delivery details if sent */}
                {previewInvoice.sentAt && (
                  <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl text-xs text-sky-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Send size={14} className="text-sky-600" />
                      <span>
                        Delivered via Gmail to <strong>{previewInvoice.sentTo}</strong> on{" "}
                        {new Date(previewInvoice.sentAt).toLocaleDateString()} at{" "}
                        {new Date(previewInvoice.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Footer notes */}
                {previewInvoice.notes && (
                  <div className="border-t border-dashed border-slate-200 pt-4 text-xs text-slate-500">
                    <strong className="text-slate-700 block font-bold mb-1">Notes & Terms:</strong>
                    <p className="italic">{previewInvoice.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoices List Display */}
      {filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl glass-panel text-center">
          <FileText className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No invoices drafted</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {invoices.length === 0
              ? "Your client ledger billing is empty. Start composing invoices to send professional PDFs and receive payments."
              : "Recheck search parameters or status filters to locate specific invoices."}
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
        <motion.div layout className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
          <AnimatePresence mode="popLayout">
            {filteredInvoices.map((inv) => {
              const client = getClientMeta(inv.clientId);
              const sub = calculateSubtotal(inv.services);
              const tax = sub * ((inv.taxRate || 0) / 100);
              const total = sub + tax;
              const isLate = new Date(inv.dueDate) < new Date() && inv.status !== "Paid";
              const isSending = sendingInvoiceId === inv.id;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  key={inv.id}
                  className="p-5 rounded-2xl glass-panel glass-highlight transition-all flex flex-col justify-between group"
                  id={`invoice-card-${inv.id}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm font-mono leading-none">
                          {inv.invoiceNumber}
                        </h4>
                        <strong className="text-xs text-indigo-600 font-medium block mt-1 line-clamp-1">
                          To: {client ? client.companyName : "Direct Client Account"}
                        </strong>
                        {client?.email && (
                          <span className="text-[11px] text-slate-400 font-mono block line-clamp-1">
                            {client.email}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[9px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                          inv.status === "Paid"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : inv.status === "Sent"
                            ? "bg-sky-500/10 text-sky-600"
                            : isLate
                            ? "bg-red-500/10 text-red-600"
                            : "bg-slate-500/10 text-slate-500"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 border-t border-black/5 pt-3 mb-3">
                      <div className="flex items-baseline justify-between">
                        <span>Total Due:</span>
                        <strong className="text-slate-850 font-bold font-mono text-sm leading-none text-indigo-600">
                          {formatCurrency(total, profile.currency)}
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-[11px] mt-2">
                        <span>Billed:</span>
                        <span>{new Date(inv.issueDate).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span>Due:</span>
                        <span className={isLate ? "text-red-500 font-semibold" : ""}>
                          {new Date(inv.dueDate).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Delivery information if sent */}
                      {inv.sentAt && inv.sentTo && (
                        <div className="text-[10px] text-sky-700 bg-sky-50/80 p-1.5 rounded-lg border border-sky-100/80 flex items-center gap-1.5 mt-2">
                          <Check size={11} className="text-sky-600 shrink-0" />
                          <span className="truncate">
                            Sent to {inv.sentTo} ({new Date(inv.sentAt).toLocaleDateString()})
                          </span>
                        </div>
                      )}

                      {/* Error state if send failed */}
                      {inv.lastSendError && inv.status !== "Sent" && (
                        <div className="text-[10px] text-red-700 bg-red-50 p-1.5 rounded-lg border border-red-200 flex items-start gap-1.5 mt-2">
                          <AlertCircle size={12} className="text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold block">Delivery Failed</span>
                            <span className="text-[9.5px] text-red-600/90 truncate block">
                              {inv.lastSendError}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-1.5 mt-2 pt-3 border-t border-black/5 flex-wrap">
                    {/* Mark Paid button for unpaid */}
                    {inv.status !== "Paid" && (
                      <button
                        onClick={() => onUpdateInvoice(inv.id, { status: "Paid" })}
                        className="p-1 px-2.5 bg-emerald-500/10 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Mark invoice as paid"
                      >
                        <Check size={11} />
                        <span>Paid</span>
                      </button>
                    )}

                    {/* Send Invoice Action for Draft */}
                    {inv.status === "Draft" && (
                      <button
                        onClick={() => handleInitiateSend(inv)}
                        disabled={isSending}
                        className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                        title="Send invoice via Gmail with attached PDF"
                      >
                        {isSending ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send size={11} />
                            <span>Send Invoice</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Resend Action for Sent invoices */}
                    {inv.status === "Sent" && (
                      <button
                        onClick={() => handleInitiateSend(inv)}
                        disabled={isSending}
                        className="p-1 px-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Resend invoice email"
                      >
                        {isSending ? (
                          <>
                            <Loader2 size={11} className="animate-spin" />
                            <span>Resending...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw size={10} />
                            <span>Resend</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Remind Action for Unpaid invoices */}
                    {inv.status !== "Paid" && (
                      <button
                        onClick={() => setReminderModalInvoice(inv)}
                        className="p-1 px-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Send payment reminder or copy follow-up message"
                      >
                        <Mail size={11} />
                        <span>Remind</span>
                      </button>
                    )}

                    {/* View / PDF */}
                    <button
                      onClick={() => setPreviewInvoice(inv)}
                      className="p-1 px-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ml-auto"
                      title="Preview invoice & PDF"
                    >
                      <FileText size={11} />
                      <span>View</span>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm(`Remove invoice ${inv.invoiceNumber}? This action is permanent.`)) {
                          onDeleteInvoice(inv.id);
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-lg opacity-70 group-hover:opacity-100 cursor-pointer"
                      title="Delete Invoice"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Integrated Reminder Modal */}
      {reminderModalInvoice && (
        <InvoiceReminderModal
          isOpen={!!reminderModalInvoice}
          onClose={() => setReminderModalInvoice(null)}
          invoice={reminderModalInvoice}
          client={getClientMeta(reminderModalInvoice.clientId)}
          profile={profile}
          onReminderSent={(invoiceId) => {
            onUpdateInvoice(invoiceId, {
              lastReminderSentAt: new Date().toISOString(),
              reminderCount: (reminderModalInvoice.reminderCount || 0) + 1,
            });
            setBannerNotice({
              type: "success",
              title: "Reminder Delivered",
              message: `Payment reminder for Invoice #${reminderModalInvoice.invoiceNumber} has been sent.`,
            });
          }}
        />
      )}

      {/* Client Profile Warning Modal */}
      <AnimatePresence>
        {showClientWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
                  Please create at least one Client profile first before launching billing invoices.
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(InvoicesView);
