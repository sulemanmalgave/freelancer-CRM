import React, { useState } from "react";
import {
  X,
  Download,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  Users,
  Briefcase,
  CheckSquare,
  Receipt,
  Sparkles,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import {
  Client,
  Lead,
  Project,
  Task,
  Invoice,
  Proposal,
  FollowUp,
  DocumentRecord,
  NoteRecord,
  FreelancerProfile,
} from "../types";

interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  leads: Lead[];
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  proposals: Proposal[];
  followUps: FollowUp[];
  documents: DocumentRecord[];
  notes: NoteRecord[];
  profile: FreelancerProfile | null;
}

export default function DataExportModal({
  isOpen,
  onClose,
  clients,
  leads,
  projects,
  tasks,
  invoices,
  proposals,
  followUps,
  documents,
  notes,
  profile,
}: DataExportModalProps) {
  if (!isOpen) return null;

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Helper to convert array of objects to standard CSV string
  const convertToCSV = (headers: string[], rows: (string | number | undefined)[][]) => {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(escapeCsv).join(",");
    const bodyLines = rows.map((row) => row.map(escapeCsv).join(","));
    return [headerLine, ...bodyLines].join("\r\n");
  };

  const triggerDownload = (filename: string, content: string, mimeType = "text/csv;charset=utf-8;") => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  // Export 1: Clients CSV
  const exportClients = () => {
    const headers = ["ID", "Company Name", "Contact Person", "Email", "Phone", "Status", "Created At", "Notes"];
    const rows = clients.map((c) => [c.id, c.companyName, c.contactPerson, c.email, c.phone, c.status, c.createdAt, c.notes]);
    const csv = convertToCSV(headers, rows);
    triggerDownload(`clients_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 2: Leads CSV
  const exportLeads = () => {
    const headers = ["ID", "Name", "Company Name", "Email", "Phone", "Source", "Status", "Budget", "Follow Up Date", "Created At", "Notes"];
    const rows = leads.map((l) => [l.id, l.name, l.companyName, l.email, l.phone, l.source, l.status, l.budget, l.followUpDate, l.createdAt, l.notes]);
    const csv = convertToCSV(headers, rows);
    triggerDownload(`leads_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 3: Projects CSV
  const exportProjects = () => {
    const headers = ["ID", "Client Name", "Project Title", "Budget", "Deadline", "Status", "Progress", "Created At", "Notes"];
    const rows = projects.map((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      return [p.id, client?.companyName || "Unassigned", p.title, p.budget, p.deadline, p.status, p.progress || 0, p.createdAt, p.notes];
    });
    const csv = convertToCSV(headers, rows);
    triggerDownload(`projects_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 4: Tasks CSV
  const exportTasks = () => {
    const headers = ["ID", "Task Title", "Client", "Project", "Due Date", "Priority", "Completed", "Created At", "Notes"];
    const rows = tasks.map((t) => {
      const client = clients.find((c) => c.id === t.clientId);
      const project = projects.find((p) => p.id === t.projectId);
      return [t.id, t.title, client?.companyName || "", project?.title || "", t.dueDate, t.priority, t.completed ? "Yes" : "No", t.createdAt, t.notes || ""];
    });
    const csv = convertToCSV(headers, rows);
    triggerDownload(`tasks_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 5: Invoices CSV
  const exportInvoices = () => {
    const headers = ["Invoice #", "Client Name", "Issue Date", "Due Date", "Subtotal", "Tax Rate (%)", "Total Amount", "Status", "Notes"];
    const rows = invoices.map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      const subtotal = inv.services.reduce((sum, s) => sum + s.quantity * s.rate, 0);
      const total = subtotal + (subtotal * (inv.taxRate || 0)) / 100;
      return [inv.invoiceNumber, client?.companyName || "", inv.issueDate, inv.dueDate, subtotal, inv.taxRate || 0, total, inv.status, inv.notes];
    });
    const csv = convertToCSV(headers, rows);
    triggerDownload(`invoices_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 6: Proposals CSV
  const exportProposals = () => {
    const headers = ["Proposal #", "Client Name", "Title", "Issue Date", "Valid Until", "Total Amount", "Status", "Notes"];
    const rows = proposals.map((prop) => {
      const client = clients.find((c) => c.id === prop.clientId);
      const subtotal = prop.items.reduce((sum, it) => sum + it.quantity * it.rate, 0);
      const disc = (subtotal * (prop.discountRate || 0)) / 100;
      const afterDisc = Math.max(0, subtotal - disc);
      const tax = (afterDisc * (prop.taxRate || 0)) / 100;
      const total = afterDisc + tax;
      return [prop.proposalNumber, client?.companyName || "", prop.title, prop.issueDate, prop.validUntil, total, prop.status, prop.notes || ""];
    });
    const csv = convertToCSV(headers, rows);
    triggerDownload(`proposals_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 7: Follow-ups CSV
  const exportFollowUps = () => {
    const headers = ["ID", "Title", "Client", "Due Date", "Status", "Priority", "Created At", "Notes"];
    const rows = followUps.map((f) => {
      const client = clients.find((c) => c.id === f.clientId);
      return [f.id, f.title, client?.companyName || "", f.dueDate, f.status, f.priority || "medium", f.createdAt, f.notes || ""];
    });
    const csv = convertToCSV(headers, rows);
    triggerDownload(`followups_export_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 8: Documents Metadata CSV
  const exportDocuments = () => {
    const headers = ["ID", "Title", "Category", "File Type", "File Size", "Upload Date", "Client ID", "Project ID"];
    const rows = documents.map((d) => [d.id, d.title, d.category, d.fileType, d.fileSize, d.uploadDate, d.clientId || "", d.projectId || ""]);
    const csv = convertToCSV(headers, rows);
    triggerDownload(`documents_metadata_${new Date().toISOString().split("T")[0]}.csv`, csv);
  };

  // Export 9: Full CRM Backup (JSON)
  const exportFullBackupJSON = () => {
    const dataBackup = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      profile,
      clients,
      leads,
      projects,
      tasks,
      invoices,
      proposals,
      followUps,
      documents,
      notes,
    };
    const jsonStr = JSON.stringify(dataBackup, null, 2);
    triggerDownload(`freelancer_crm_full_backup_${new Date().toISOString().split("T")[0]}.json`, jsonStr, "application/json");
  };

  const exportCards = [
    { title: "Clients", count: clients.length, icon: Users, color: "text-indigo-600 bg-indigo-50", onExport: exportClients },
    { title: "Invoices", count: invoices.length, icon: Receipt, color: "text-emerald-600 bg-emerald-50", onExport: exportInvoices },
    { title: "Proposals & Quotes", count: proposals.length, icon: FileSpreadsheet, color: "text-purple-600 bg-purple-50", onExport: exportProposals },
    { title: "Projects", count: projects.length, icon: Briefcase, color: "text-blue-600 bg-blue-50", onExport: exportProjects },
    { title: "Tasks", count: tasks.length, icon: CheckSquare, color: "text-rose-600 bg-rose-50", onExport: exportTasks },
    { title: "Leads & Prospects", count: leads.length, icon: Sparkles, color: "text-cyan-600 bg-cyan-50", onExport: exportLeads },
    { title: "Follow-ups", count: followUps.length, icon: Calendar, color: "text-amber-600 bg-amber-50", onExport: exportFollowUps },
    { title: "Documents Metadata", count: documents.length, icon: FileText, color: "text-teal-600 bg-teal-50", onExport: exportDocuments },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Data Export & Backup Center</h2>
              <p className="text-xs text-slate-500">
                Export your CRM records to standard CSV files or download a complete JSON backup
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              <span>
                Exported <strong>{downloadSuccess}</strong> successfully!
              </span>
            </div>
          )}

          {/* Full Backup Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <Database size={16} className="text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Full System Backup</h3>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Download a unified snapshot of all clients, projects, tasks, invoices, follow-ups, and notes.
              </p>
            </div>
            <button
              onClick={exportFullBackupJSON}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Download size={14} />
              <span>Full JSON Backup</span>
            </button>
          </div>

          {/* CSV Individual Exports Grid */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
              Export Individual Datasets (CSV)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {exportCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-indigo-300 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${card.color}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{card.title}</h4>
                        <p className="text-[11px] text-slate-400">{card.count} record{card.count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <button
                      onClick={card.onExport}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Download size={12} />
                      <span>CSV</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Exports strictly contain your own data and do not delete or modify original records.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
