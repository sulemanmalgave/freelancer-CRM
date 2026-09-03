import React, { useState, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderUp,
  FileText,
  Download,
  Trash2,
  Calendar,
  FileCheck,
  ShieldAlert,
  Sparkles,
  FolderLock,
  Plus,
  Search,
  Filter,
  Users,
  Briefcase,
} from "lucide-react";
import { DocumentRecord, Client, Project, FreelancerProfile } from "../types";

interface DocumentsViewProps {
  documents: DocumentRecord[];
  clients?: Client[];
  projects?: Project[];
  profile: FreelancerProfile;
  onAddDocument: (doc: Omit<DocumentRecord, "id" | "freelancerId" | "uploadDate" | "createdAt">) => void;
  onDeleteDocument: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
}

function DocumentsView({
  documents,
  clients = [],
  projects = [],
  profile,
  onAddDocument,
  onDeleteDocument,
  onTriggerUpgrade,
}: DocumentsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [docCategory, setDocCategory] = useState<DocumentRecord["category"]>("Contract");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  const isPro =
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "3 Months";

  // Handle document file reader to base64
  const processFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Please restrict files to 5MB maximum to ensure optimal sync performance.");
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        onAddDocument({
          title: file.name,
          category: docCategory,
          fileType: file.type,
          fileSize: (file.size / 1024).toFixed(1) + " KB",
          content: base64,
          clientId: selectedClientId || undefined,
          projectId: selectedProjectId || undefined,
        });
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("Error reading file format.");
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChangeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDownload = (doc: DocumentRecord) => {
    try {
      const link = document.createElement("a");
      link.href = doc.content;
      link.download = doc.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to download document.");
    }
  };

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients]);

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return documents.filter((doc) => {
      const clientName = (doc.clientId ? clientMap.get(doc.clientId) : "") || "";
      const matchesSearch =
        doc.title.toLowerCase().includes(term) ||
        doc.category.toLowerCase().includes(term) ||
        clientName.toLowerCase().includes(term);

      const matchesCategory = categoryFilter === "All" || doc.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [documents, clientMap, searchTerm, categoryFilter]);

  return (
    <div className="relative min-h-[500px]">
      {/* Gated Lock Overlay for Free Plan */}
      {!isPro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-transparent backdrop-blur-[2.5px] p-6 text-center">
          <div className="p-6 glass-modal rounded-3xl shadow-2xl max-w-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-600 mb-4 border border-violet-200 animate-pulse">
              <FolderLock className="w-8 h-8" />
            </div>
            <span className="text-[10px] tracking-widest font-extrabold uppercase text-indigo-600 block mb-1">
              PRO MODULE
            </span>
            <h3 className="text-lg font-black text-slate-850 leading-tight">
              Secure Document Vault
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Unlock contract backups, deliverables archiving, client-linked asset vaults, and shareable client files.
            </p>

            <button
              onClick={() => onTriggerUpgrade("document_storage")}
              className="mt-5 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1 group cursor-pointer"
            >
              <Sparkles size={12} />
              <span>Unlock Document Vault</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className={`space-y-6 ${!isPro ? "blur-[2px] pointer-events-none select-none opacity-40" : ""}`}>
        {/* Top filter and search bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents by title or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {(["All", "Contract", "Proposal", "Invoice", "Brief", "Asset", "Other"] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  categoryFilter === cat
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 border border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Upload Hub & Associations */}
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl space-y-4 shadow-xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Upload Document
            </h3>

            <div>
              <label className="block text-slate-700 text-xs font-semibold mb-1">
                Document Category
              </label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as any)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="Contract">Contract / Agreement</option>
                <option value="Proposal">Proposal / Scope Document</option>
                <option value="Invoice">Invoice / Receipt</option>
                <option value="Brief">Design / Project Brief</option>
                <option value="Asset">Brand Asset / Image</option>
                <option value="Other">Other Document</option>
              </select>
            </div>

            {/* Client association */}
            <div>
              <label className="block text-slate-700 text-xs font-semibold mb-1">
                Associate with Client (Optional)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">-- No Client (General Vault) --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Drag & Drop Visual Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[150px] ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-slate-200 bg-slate-50/60 hover:border-indigo-400 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleChangeFile}
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip,.json,.xlsx"
              />
              <FolderUp size={24} className="text-slate-400 mb-2" />
              <strong className="text-xs text-slate-800">
                {isUploading ? "Uploading..." : "Click or Drop File to Upload"}
              </strong>
              <span className="text-[10px] text-slate-400 mt-1 max-w-[170px] leading-tight block">
                Supports PDF, ZIP, DOCX, XLSX, Images up to 5MB.
              </span>
            </div>
          </div>

          {/* Documents List */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-5 bg-white border border-slate-200/80 rounded-2xl min-h-[300px] shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck size={16} className="text-indigo-600" />
                  <span>Document Vault Ledger</span>
                </h3>
                <span className="text-xs font-semibold text-slate-400">
                  {filteredDocuments.length} document{filteredDocuments.length !== 1 ? "s" : ""}
                </span>
              </div>

              {filteredDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-slate-400 min-h-[200px]">
                  <FileText className="w-10 h-10 text-slate-300 mb-2 animate-bounce" />
                  <span>No documents found matching your criteria.</span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  <AnimatePresence mode="popLayout">
                    {filteredDocuments.map((doc) => {
                      const client = clients.find((c) => c.id === doc.clientId);
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -6 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          key={doc.id}
                          className="py-3 flex items-center justify-between gap-4 group"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 truncate max-w-md block leading-snug">
                                {doc.title}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium leading-none">
                                <span className="bg-indigo-50 font-bold text-indigo-700 px-1.5 py-0.5 rounded-md">
                                  {doc.category}
                                </span>
                                {client && (
                                  <span className="bg-slate-100 font-bold text-slate-700 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Users size={10} />
                                    <span>{client.companyName}</span>
                                  </span>
                                )}
                                <span>{doc.fileSize}</span>
                                <span className="flex items-center gap-0.5 text-[9px] text-slate-400">
                                  <Calendar size={10} />
                                  <span>{new Date(doc.uploadDate || doc.createdAt).toLocaleDateString()}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 px-2.5 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Download size={11} />
                              <span>Download</span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete document "${doc.title}"?`)) {
                                  onDeleteDocument(doc.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete document"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(DocumentsView);
