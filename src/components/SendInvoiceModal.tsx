import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
  Loader2,
  Sparkles,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Invoice, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";
import { sendGmailMessage, connectGmailWithGSI } from "../services/gmailService";
import { generateInvoicePdf } from "../services/invoicePdfService";

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  client?: Client;
  profile: FreelancerProfile;
  onUpdateInvoice: (id: string, fields: Partial<Invoice>) => void;
  onUpdateClient?: (id: string, fields: Partial<Client>) => void;
  onTriggerUpgrade: (reason: string) => void;
  onOpenGmailConnect?: () => void;
}

export default function SendInvoiceModal({
  isOpen,
  onClose,
  invoice,
  client,
  profile,
  onUpdateInvoice,
  onUpdateClient,
  onTriggerUpgrade,
  onOpenGmailConnect,
}: SendInvoiceModalProps) {
  if (!isOpen || !invoice) return null;

  const isPro =
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free");

  const totalAmount = (invoice.services || []).reduce(
    (acc, s) => acc + (s.quantity || 0) * (s.rate || 0),
    0
  );
  const taxAmount = (totalAmount * (invoice.taxRate || 0)) / 100;
  const grandTotal = totalAmount + taxAmount;
  const currencySymbol = profile.currency || "$";

  // Initial Email state
  const initialEmail = client?.email?.trim() || "";
  const [recipientEmail, setRecipientEmail] = useState(initialEmail);
  const [saveEmailToClient, setSaveEmailToClient] = useState(true);

  const defaultSubject = `Invoice ${invoice.invoiceNumber} from ${
    profile.businessName || profile.name || "Freelancer"
  }`;

  const defaultBody = `Hello ${client?.contactPerson || client?.companyName || "there"},

Please find attached invoice ${invoice.invoiceNumber} for ${formatCurrency(
    grandTotal,
    profile.currency
  )}.

Invoice date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due date: ${new Date(invoice.dueDate).toLocaleDateString()}

Please let me know if you have any questions or require additional payment details.

Best regards,
${profile.name || "Freelancer"}
${profile.businessName && profile.businessName !== profile.name ? profile.businessName : ""}`.trim();

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  // Sync state whenever invoice or client changes
  useEffect(() => {
    if (isOpen && invoice) {
      setRecipientEmail(client?.email?.trim() || "");
      setSubject(
        `Invoice ${invoice.invoiceNumber} from ${
          profile.businessName || profile.name || "Freelancer"
        }`
      );
      setBody(
        `Hello ${client?.contactPerson || client?.companyName || "there"},

Please find attached invoice ${invoice.invoiceNumber} for ${formatCurrency(
          grandTotal,
          profile.currency
        )}.

Invoice date: ${new Date(invoice.issueDate).toLocaleDateString()}
Due date: ${new Date(invoice.dueDate).toLocaleDateString()}

Please let me know if you have any questions or require additional payment details.

Best regards,
${profile.name || "Freelancer"}
${profile.businessName && profile.businessName !== profile.name ? profile.businessName : ""}`.trim()
      );
      setIsSending(false);
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen, invoice?.id, client?.id]);

  const handleDownloadPdfPreview = () => {
    if (!invoice) return;
    try {
      const pdf = generateInvoicePdf(invoice, client, profile);
      pdf.download();
    } catch (err: any) {
      console.error("Failed to generate PDF for preview:", err);
    }
  };

  const handleConnectGmail = async () => {
    try {
      setIsConnectingGmail(true);
      setErrorMsg(null);
      await connectGmailWithGSI();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate Gmail connection.");
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Pro check
    if (!isPro) {
      onTriggerUpgrade("invoice_email_send");
      return;
    }

    // 2. Client Email Validation
    const cleanEmail = recipientEmail.trim();
    if (!cleanEmail) {
      setErrorMsg("Recipient email address is required to send this invoice.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid recipient email address.");
      return;
    }

    // 3. Gmail connection check
    if (!profile.gmailConnected) {
      setErrorMsg("Please connect your Gmail account in order to send invoices directly.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMsg(null);

      // Generate invoice PDF
      const pdfResult = generateInvoicePdf(invoice, client, profile);

      // Send via Gmail API
      const result = await sendGmailMessage({
        to: cleanEmail,
        subject: subject.trim(),
        body: body.trim(),
        attachments: [
          {
            filename: pdfResult.filename,
            mimeType: "application/pdf",
            base64Data: pdfResult.base64,
          },
        ],
        freelancerId: profile.id,
      });

      if (!result || !result.success) {
        throw new Error(result?.error || "Email delivery was rejected by the mail provider.");
      }

      // ONLY after email provider confirms successful delivery:
      const sentTimestamp = new Date().toISOString();
      onUpdateInvoice(invoice.id, {
        status: "Sent",
        sentAt: sentTimestamp,
        sentTo: cleanEmail,
        sendMethod: "gmail",
        lastSendError: undefined,
      });

      // Save email to client profile if requested
      if (saveEmailToClient && client && onUpdateClient && (!client.email || client.email !== cleanEmail)) {
        onUpdateClient(client.id, { email: cleanEmail });
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("[Send Invoice Error]", err);
      const readableError =
        err.message || "Invoice could not be sent. Please try again.";
      setErrorMsg(`Invoice could not be sent. ${readableError}`);

      // Store the last send error on the invoice record for tracking
      onUpdateInvoice(invoice.id, {
        lastSendError: readableError,
      });
    } finally {
      setIsSending(false);
    }
  };

  const clientMissingEmail = !client?.email || !client.email.trim();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-6"
        >
          {/* Header */}
          <div className="p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Mail size={16} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-850">
                  Send Invoice {invoice.invoiceNumber}
                </h3>
                <span className="text-[11px] text-slate-400">
                  To: {client?.companyName || "Client Account"}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSending}
              className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Success Notification */}
          {isSuccess ? (
            <div className="p-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Invoice Sent Successfully
              </h4>
              <p className="text-xs text-slate-500 max-w-sm">
                Invoice #{invoice.invoiceNumber} with attached PDF has been delivered to{" "}
                <strong className="text-slate-800 font-semibold">{recipientEmail}</strong>. Status updated to <strong>Sent</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="p-6 space-y-4">
              {/* Pro plan requirement banner */}
              {!isPro && (
                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Lock size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Pro Feature: Direct Email Delivery
                      </h4>
                      <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        Upgrade to Pro to send invoices and reminders directly to your clients with attached PDFs via Gmail.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onTriggerUpgrade("invoice_email_send")}
                    className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Upgrade to Pro</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Gmail connection warning banner */}
              {isPro && !profile.gmailConnected && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-900">
                        Connect Gmail to Send Invoices
                      </h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        Connect your Gmail account to send invoices directly from Freelancer CRM to your clients.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenGmailConnect || handleConnectGmail}
                    disabled={isConnectingGmail}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isConnectingGmail ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Connecting Gmail...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={13} />
                        <span>Connect Gmail Account</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Client without email prompt */}
              {clientMissingEmail && (
                <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-900 font-bold text-xs">
                    <AlertCircle size={14} className="text-sky-600 shrink-0" />
                    <span>Client email required</span>
                  </div>
                  <p className="text-[11px] text-sky-700 leading-relaxed">
                    This client doesn't have an email address saved. Enter an email address below to send this invoice.
                  </p>
                </div>
              )}

              {/* Error message alert */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <span className="font-semibold">{errorMsg}</span>
                  </div>
                </div>
              )}

              {/* Recipient Email Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. accounts@clientcompany.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                  />
                </div>
                {client && (
                  <label className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveEmailToClient}
                      onChange={(e) => setSaveEmailToClient(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Save this email to client profile ({client.companyName})</span>
                  </label>
                )}
              </div>

              {/* Invoice Quick Summary Card & Attached PDF */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block leading-tight">
                      Invoice_{invoice.invoiceNumber}.pdf
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Gross Amount: <strong className="text-indigo-600">{formatCurrency(grandTotal, profile.currency)}</strong> • Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPdfPreview}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors shrink-0 cursor-pointer"
                  title="Download and view generated invoice PDF"
                >
                  <Download size={11} />
                  <span>Preview PDF</span>
                </button>
              </div>

              {/* Subject Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Body Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={6}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSending || !isPro || !profile.gmailConnected}
                  className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sending invoice...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
