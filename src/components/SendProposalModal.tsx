import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Mail,
  Send,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Download,
  Loader2,
  Sparkles,
  Lock,
  ArrowRight,
} from "lucide-react";
import { Proposal, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";
import { sendGmailMessage, connectGmailWithGSI } from "../services/gmailService";
import { generateProposalPdf } from "../services/proposalPdfService";

interface SendProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal | null;
  client?: Client;
  profile: FreelancerProfile;
  onUpdateProposal: (proposal: Proposal) => void;
  onUpdateClient?: (id: string, fields: Partial<Client>) => void;
  onTriggerUpgrade: (reason: string) => void;
  onOpenGmailConnect?: () => void;
}

export default function SendProposalModal({
  isOpen,
  onClose,
  proposal,
  client,
  profile,
  onUpdateProposal,
  onUpdateClient,
  onTriggerUpgrade,
  onOpenGmailConnect,
}: SendProposalModalProps) {
  if (!isOpen || !proposal) return null;

  const isPro =
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free");

  const items = proposal.items && proposal.items.length > 0 ? proposal.items : [];
  const subtotal = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.rate || 0), 0);
  const discountRate = Number(proposal.discountRate) || 0;
  const discountAmount = (subtotal * discountRate) / 100;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxRate = Number(proposal.taxRate) || 0;
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = taxableAmount + taxAmount;

  // Initial Email state
  const initialEmail = client?.email?.trim() || "";
  const [recipientEmail, setRecipientEmail] = useState(initialEmail);
  const [saveEmailToClient, setSaveEmailToClient] = useState(true);

  const defaultSubject = `Proposal ${proposal.proposalNumber}: ${proposal.title} from ${
    profile.businessName || profile.name || "Freelancer"
  }`;

  const defaultBody = `Hello ${client?.contactPerson || client?.companyName || "there"},

Thank you for the opportunity to submit our proposal for "${proposal.title}".

Please find attached our detailed scope and estimate #${proposal.proposalNumber} for ${formatCurrency(
    grandTotal,
    profile.currency
  )}.

• Issue Date: ${new Date(proposal.issueDate).toLocaleDateString()}
• Valid Until: ${new Date(proposal.validUntil).toLocaleDateString()}

Please review the attached proposal. Feel free to reply directly to this email if you would like any adjustments or have any questions.

Best regards,
${profile.name || "Freelancer"}
${profile.businessName && profile.businessName !== profile.name ? profile.businessName : ""}`.trim();

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  // Sync state whenever proposal or client changes
  useEffect(() => {
    if (isOpen && proposal) {
      setRecipientEmail(client?.email?.trim() || "");
      setSubject(
        `Proposal ${proposal.proposalNumber}: ${proposal.title} from ${
          profile.businessName || profile.name || "Freelancer"
        }`
      );
      setBody(
        `Hello ${client?.contactPerson || client?.companyName || "there"},

Thank you for the opportunity to submit our proposal for "${proposal.title}".

Please find attached our detailed scope and estimate #${proposal.proposalNumber} for ${formatCurrency(
          grandTotal,
          profile.currency
        )}.

• Issue Date: ${new Date(proposal.issueDate).toLocaleDateString()}
• Valid Until: ${new Date(proposal.validUntil).toLocaleDateString()}

Please review the attached proposal. Feel free to reply directly to this email if you would like any adjustments or have any questions.

Best regards,
${profile.name || "Freelancer"}
${profile.businessName && profile.businessName !== profile.name ? profile.businessName : ""}`.trim()
      );
      setIsSending(false);
      setErrorMsg(null);
      setIsSuccess(false);
    }
  }, [isOpen, proposal?.id, client?.email]);

  const clientMissingEmail = !client?.email?.trim();

  const handleConnectGmail = async () => {
    try {
      setIsConnectingGmail(true);
      setErrorMsg(null);
      const token = await connectGmailWithGSI();
      if (token) {
        profile.gmailConnected = true;
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to connect Gmail. Please try again.");
    } finally {
      setIsConnectingGmail(false);
    }
  };

  const handleDownloadPdfPreview = () => {
    try {
      const pdf = generateProposalPdf(proposal, client, profile);
      pdf.download();
    } catch (err: any) {
      console.error("PDF preview generation error:", err);
      setErrorMsg("Failed to generate PDF preview.");
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Pro check
    if (!isPro) {
      onTriggerUpgrade("proposal_email_send");
      return;
    }

    // 2. Client Email Validation
    const cleanEmail = recipientEmail.trim();
    if (!cleanEmail) {
      setErrorMsg("Recipient email address is required to send this proposal.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg("Please enter a valid recipient email address.");
      return;
    }

    // 3. Gmail connection check
    if (!profile.gmailConnected) {
      setErrorMsg("Please connect your Gmail account in order to send proposals directly.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMsg(null);

      // Generate proposal PDF
      const pdfResult = generateProposalPdf(proposal, client, profile);

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
      const updatedProposal: Proposal = {
        ...proposal,
        status: "Sent",
        sentAt: sentTimestamp,
        sentTo: cleanEmail,
        sendMethod: "gmail",
        lastSendError: undefined,
      };

      onUpdateProposal(updatedProposal);

      // Save email to client profile if requested
      if (saveEmailToClient && client && onUpdateClient && (!client.email || client.email !== cleanEmail)) {
        onUpdateClient(client.id, { email: cleanEmail });
      }

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error("[Send Proposal Error]", err);
      const readableError =
        err.message || "Proposal could not be sent. Please try again.";
      setErrorMsg(`Proposal could not be sent. ${readableError}`);

      // Store the last send error on proposal
      const updatedProposal: Proposal = {
        ...proposal,
        lastSendError: readableError,
      };
      onUpdateProposal(updatedProposal);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Mail size={16} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span>Send Proposal via Gmail</span>
                  <Sparkles size={13} className="text-amber-500" />
                </h3>
                <p className="text-[11px] text-slate-500">
                  Deliver proposal #{proposal.proposalNumber} with attached PDF to your client
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {isSuccess ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-50">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Proposal Delivered!</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Proposal #{proposal.proposalNumber} was sent successfully to{" "}
                <strong>{recipientEmail}</strong> with PDF attached.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} className="p-6 overflow-y-auto space-y-4">
              {/* Pro Feature Callout */}
              {!isPro && (
                <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Lock size={14} className="text-amber-600" />
                    <span>Pro Feature: Direct Email & PDF Automation</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Direct proposal sending via connected Gmail with automated PDF generation is available on the Pro plan.
                  </p>
                  <button
                    type="button"
                    onClick={() => onTriggerUpgrade("proposal_email_send")}
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
                        Connect Gmail to Send Proposals
                      </h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        Connect your Gmail account to send proposals directly from Freelancer CRM to your clients.
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
                    This client doesn't have an email address saved. Enter an email address below to send this proposal.
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
                    placeholder="e.g. client@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors"
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

              {/* Proposal Quick Summary Card & Attached PDF */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <FileCheck2 size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-800 block leading-tight">
                      Proposal_{proposal.proposalNumber}.pdf
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Amount: <strong className="text-indigo-600">{formatCurrency(grandTotal, profile.currency)}</strong> • Valid Until: {new Date(proposal.validUntil).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPdfPreview}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors shrink-0 cursor-pointer"
                  title="Download and view generated proposal PDF"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors resize-none leading-relaxed"
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
                      <span>Sending proposal...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Send Proposal</span>
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
