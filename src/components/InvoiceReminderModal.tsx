import React, { useState } from "react";
import { X, Mail, Send, Copy, Check, AlertCircle, Clock, Sparkles, FileText } from "lucide-react";
import { Invoice, Client, FreelancerProfile } from "../types";
import { sendGmailMessage } from "../services/gmailService";

interface InvoiceReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  client?: Client;
  profile: FreelancerProfile | null;
  onReminderSent: (invoiceId: string) => void;
}

export default function InvoiceReminderModal({
  isOpen,
  onClose,
  invoice,
  client,
  profile,
  onReminderSent,
}: InvoiceReminderModalProps) {
  if (!isOpen || !invoice) return null;

  const totalAmount = invoice.services.reduce(
    (acc, s) => acc + s.quantity * s.rate,
    0
  );
  const taxAmount = (totalAmount * (invoice.taxRate || 0)) / 100;
  const grandTotal = totalAmount + taxAmount;
  const currencySymbol = profile?.currency || "$";

  // Calculate days overdue or days left
  const dueDateObj = new Date(invoice.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDateObj.setHours(0, 0, 0, 0);
  const diffTime = today.getTime() - dueDateObj.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays > 0;

  // Determine initial template type
  const initialType = isOverdue
    ? "overdue"
    : diffDays === 0
    ? "due_today"
    : "due_soon";

  const [templateType, setTemplateType] = useState<"due_soon" | "due_today" | "overdue">(initialType);

  const getTemplateContent = (type: "due_soon" | "due_today" | "overdue") => {
    const clientName = client?.contactPerson || client?.companyName || "there";
    const myName = profile?.name || "Freelancer";
    const myBusiness = profile?.businessName || myName;

    if (type === "due_soon") {
      return {
        subject: `Friendly Reminder: Invoice #${invoice.invoiceNumber} due on ${invoice.dueDate}`,
        body: `Hi ${clientName},\n\nI hope you're having a great week!\n\nThis is a friendly reminder that Invoice #${invoice.invoiceNumber} for ${currencySymbol}${grandTotal.toLocaleString()} is scheduled for payment on ${invoice.dueDate}.\n\nPlease let me know if you need any additional payment details or copies of the invoice.\n\nThank you for your business!\n\nBest regards,\n${myName}\n${myBusiness}`,
      };
    } else if (type === "due_today") {
      return {
        subject: `Invoice #${invoice.invoiceNumber} is Due Today`,
        body: `Hi ${clientName},\n\nI hope you're doing well.\n\nThis is a quick notification that Invoice #${invoice.invoiceNumber} for the amount of ${currencySymbol}${grandTotal.toLocaleString()} is due today (${invoice.dueDate}).\n\nIf you have already processed the transfer, please disregard this note. Otherwise, feel free to reply with any questions.\n\nBest regards,\n${myName}\n${myBusiness}`,
      };
    } else {
      return {
        subject: `Payment Follow-up: Invoice #${invoice.invoiceNumber} (${diffDays} days overdue)`,
        body: `Hi ${clientName},\n\nI am writing to follow up on Invoice #${invoice.invoiceNumber} for ${currencySymbol}${grandTotal.toLocaleString()}, which was due on ${invoice.dueDate} (${diffDays} days ago).\n\nCould you please check on the payment status with your accounts team and confirm when we might expect the transfer?\n\nIf you need another copy of the invoice or banking coordinates, please let me know and I will gladly provide them.\n\nThank you,\n${myName}\n${myBusiness}`,
      };
    }
  };

  const [subject, setSubject] = useState(getTemplateContent(initialType).subject);
  const [body, setBody] = useState(getTemplateContent(initialType).body);
  const [recipientEmail, setRecipientEmail] = useState(client?.email || "");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleTemplateChange = (type: "due_soon" | "due_today" | "overdue") => {
    setTemplateType(type);
    const tpl = getTemplateContent(type);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  const handleCopy = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendGmail = async () => {
    if (!profile?.gmailConnected) {
      setStatusMessage({
        text: "Please connect your Gmail in Settings to send emails directly.",
        type: "error",
      });
      return;
    }

    if (!recipientEmail.trim()) {
      setStatusMessage({
        text: "Recipient email is required.",
        type: "error",
      });
      return;
    }

    try {
      setSending(true);
      setStatusMessage(null);

      await sendGmailMessage({
        to: recipientEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        freelancerId: profile.id,
      });

      setStatusMessage({
        text: "Invoice reminder sent successfully via Gmail!",
        type: "success",
      });
      onReminderSent(invoice.id);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatusMessage({
        text: err.message || "Failed to send email. Please check your Gmail connection.",
        type: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Invoice Payment Reminder
              </h2>
              <p className="text-xs text-slate-500">
                Invoice #{invoice.invoiceNumber} • {currencySymbol}{grandTotal.toLocaleString()} • Due {invoice.dueDate}
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

        <div className="p-6 overflow-y-auto space-y-4">
          {/* Overdue alert badge if applicable */}
          {isOverdue && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <Clock size={14} className="shrink-0 text-red-600" />
              <span>
                This invoice is currently <strong>{diffDays} days overdue</strong>. A polite follow-up is recommended.
              </span>
            </div>
          )}

          {/* Template Switcher */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Select Template
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateChange("due_soon")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                  templateType === "due_soon"
                    ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                📅 Due Soon
              </button>
              <button
                type="button"
                onClick={() => handleTemplateChange("due_today")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                  templateType === "due_today"
                    ? "bg-amber-50 border-amber-300 text-amber-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ⏰ Due Today
              </button>
              <button
                type="button"
                onClick={() => handleTemplateChange("overdue")}
                className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                  templateType === "overdue"
                    ? "bg-red-50 border-red-300 text-red-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                🚨 Overdue Follow-up
              </button>
            </div>
          </div>

          {/* Recipient Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recipient Email *
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Content (Editable) *
            </label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 resize-none font-mono text-[11px] leading-relaxed transition-colors"
            />
          </div>

          {/* Status feedback message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {statusMessage.type === "success" ? (
                <Check size={14} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={14} className="shrink-0 text-red-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-600" />
                <span className="text-emerald-600">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Message</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            {profile?.gmailConnected ? (
              <button
                type="button"
                onClick={handleSendGmail}
                disabled={sending}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send size={13} className={sending ? "animate-spin" : ""} />
                <span>{sending ? "Sending..." : "Send via Gmail"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Copy size={13} />
                <span>Copy & Send Manually</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
