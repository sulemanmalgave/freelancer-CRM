import React, { useState } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  Eye,
  Lock,
  Globe,
  FileText,
  Briefcase,
  Receipt,
  Download,
  ExternalLink,
  ShieldCheck,
  Settings,
  Sparkles,
} from "lucide-react";
import { Client, Project, Invoice, DocumentRecord, Proposal, FreelancerProfile } from "../types";

interface ClientPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  projects: Project[];
  invoices: Invoice[];
  proposals: Proposal[];
  documents: DocumentRecord[];
  profile: FreelancerProfile | null;
  onUpdateClient: (updatedClient: Client) => void;
}

export default function ClientPortalModal({
  isOpen,
  onClose,
  client,
  projects,
  invoices,
  proposals,
  documents,
  profile,
  onUpdateClient,
}: ClientPortalModalProps) {
  if (!isOpen) return null;

  const initialSettings = client.portalSettings || {
    enabled: true,
    shareProjects: true,
    shareInvoices: true,
    shareDocuments: true,
    shareProposals: true,
    welcomeMessage: `Welcome to your dedicated client workspace with ${profile?.businessName || profile?.name || "our team"}.`,
    customNotes: "Feel free to review your deliverables, current invoices, and shared assets below.",
  };

  const [settings, setSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState<"settings" | "preview">("preview");
  const [copiedLink, setCopiedLink] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const currencySymbol = profile?.currency || "$";

  // Filter client-specific items
  const clientProjects = projects.filter((p) => p.clientId === client.id);
  const clientInvoices = invoices.filter((inv) => inv.clientId === client.id);
  const clientProposals = proposals.filter((prop) => prop.clientId === client.id);
  const clientDocuments = documents.filter((doc) => doc.clientId === client.id);

  // Generate shareable link
  const portalUrl = `${window.location.origin}/?portal=${client.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveSettings = () => {
    const updatedClient: Client = {
      ...client,
      portalSettings: settings,
    };
    onUpdateClient(updatedClient);
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Client Portal • {client.companyName}
              </h2>
              <p className="text-xs text-slate-500">
                Share project progress, deliverables, and invoices securely without exposing internal CRM notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Eye size={13} />
                <span>Client Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === "settings"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Settings size={13} />
                <span>Sharing Controls</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "settings" ? (
            /* Settings & Permission Toggles */
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl flex items-start gap-3">
                <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950">
                  <span className="font-bold">Privacy Guaranteed:</span> Private CRM records, internal tasks, voice recordings, lead history, and other clients' data are strictly excluded from the portal.
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Portal Content Controls
                </h3>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Briefcase size={16} className="text-indigo-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Share Active Projects & Deadlines</p>
                      <p className="text-[11px] text-slate-500">Allow client to see project status, start dates, and milestones</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.shareProjects}
                    onChange={(e) => setSettings({ ...settings, shareProjects: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded-sm"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Receipt size={16} className="text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Share Invoices & Payment Status</p>
                      <p className="text-[11px] text-slate-500">Allow client to view invoice numbers, amounts, due dates, and paid status</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.shareInvoices}
                    onChange={(e) => setSettings({ ...settings, shareInvoices: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded-sm"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2.5">
                    <FileText size={16} className="text-blue-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">Share Client Documents & Files</p>
                      <p className="text-[11px] text-slate-500">Allow client to download shared contracts, assets, and specifications</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.shareDocuments}
                    onChange={(e) => setSettings({ ...settings, shareDocuments: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded-sm"
                  />
                </label>
              </div>

              {/* Custom Welcome Message */}
              <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Welcome Notes
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Greeting Message
                  </label>
                  <input
                    type="text"
                    value={settings.welcomeMessage || ""}
                    onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Important Instructions / Bank Details Note
                  </label>
                  <textarea
                    rows={3}
                    value={settings.customNotes || ""}
                    onChange={(e) => setSettings({ ...settings, customNotes: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {savedFeedback ? (
                    <>
                      <Check size={14} />
                      <span>Settings Saved!</span>
                    </>
                  ) : (
                    <span>Save Sharing Settings</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Live Client Portal Preview */
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 max-w-3xl mx-auto space-y-6">
              {/* Preview Banner */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye size={15} />
                  <span>
                    <strong>Client View Simulation:</strong> This is exactly what {client.companyName} sees when visiting their portal.
                  </span>
                </div>
              </div>

              {/* Portal Header */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Client Portal
                  </span>
                  <h1 className="text-xl font-extrabold text-slate-900 mt-1.5">
                    {client.companyName}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Managed by {profile?.businessName || profile?.name || "Freelancer"}
                  </p>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="font-semibold text-slate-900">Primary Contact:</p>
                  <p>{client.contactPerson || "Client Lead"}</p>
                  <p className="text-slate-500">{client.email}</p>
                </div>
              </div>

              {/* Welcome Message Card */}
              {settings.welcomeMessage && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Updates & Information
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {settings.welcomeMessage}
                  </p>
                  {settings.customNotes && (
                    <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                      {settings.customNotes}
                    </p>
                  )}
                </div>
              )}

              {/* Shared Projects */}
              {settings.shareProjects && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase size={14} className="text-indigo-600" />
                      <span>Projects & Deliverables ({clientProjects.length})</span>
                    </h3>
                  </div>

                  {clientProjects.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No active projects currently listed.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {clientProjects.map((p) => (
                        <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-slate-900">{p.title}</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Deadline: {p.deadline || "Ongoing"}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-white border border-slate-200 text-slate-700">
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shared Invoices */}
              {settings.shareInvoices && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt size={14} className="text-emerald-600" />
                      <span>Invoices & Billing ({clientInvoices.length})</span>
                    </h3>
                  </div>

                  {clientInvoices.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No invoices issued to this account.</p>
                  ) : (
                    <div className="space-y-2">
                      {clientInvoices.map((inv) => {
                        const total = inv.services.reduce((s, item) => s + item.quantity * item.rate, 0);
                        return (
                          <div key={inv.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-center">
                            <div>
                              <span className="font-mono font-bold text-slate-900">#{inv.invoiceNumber}</span>
                              <p className="text-[11px] text-slate-500 mt-0.5">Due: {inv.dueDate}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-900">
                                {currencySymbol}{total.toLocaleString()}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                                  inv.status === "Paid"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : inv.status === "Overdue"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Shared Documents */}
              {settings.shareDocuments && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={14} className="text-blue-600" />
                      <span>Shared Documents & Assets ({clientDocuments.length})</span>
                    </h3>
                  </div>

                  {clientDocuments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3">No shared files uploaded yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {clientDocuments.map((doc) => (
                        <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                          <div className="min-w-0 pr-2">
                            <h4 className="font-bold text-slate-900 truncate">{doc.title}</h4>
                            <p className="text-[11px] text-slate-500">{doc.category} • {doc.fileSize}</p>
                          </div>
                          <button
                            onClick={() => {
                              const blob = new Blob([doc.content || ""], { type: "text/plain" });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = doc.title;
                              a.click();
                            }}
                            className="p-1.5 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors shrink-0"
                            title="Download document"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with Copiable Link */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Portal Link:</span>
            <input
              type="text"
              readOnly
              value={portalUrl}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-600 w-full sm:w-72 truncate"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {copiedLink ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Portal Link</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
