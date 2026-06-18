import React, { useState, useRef } from "react";
import { motion } from "motion/react";
import { FolderUp, FileText, Download, Trash2, Calendar, FileCheck, ShieldAlert, Sparkles, FolderLock, Plus } from "lucide-react";
import { DocumentRecord, FreelancerProfile } from "../types";

interface DocumentsViewProps {
  documents: DocumentRecord[];
  profile: FreelancerProfile;
  onAddDocument: (doc: Omit<DocumentRecord, "id" | "freelancerId" | "uploadDate" | "createdAt">) => void;
  onDeleteDocument: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
}

export default function DocumentsView({
  documents,
  profile,
  onAddDocument,
  onDeleteDocument,
  onTriggerUpgrade,
}: DocumentsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [docCategory, setDocCategory] = useState<DocumentRecord["category"]>("Contract");
  const [isUploading, setIsUploading] = useState(false);

  const isPro = profile.plan === "Pro";

  // Handle document file reader to base64
  const processFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("Please restrict files to 5MB maximum to ensure optimal client-side index syncing.");
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
        });
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert("Error reading source content format.");
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

  // Convert base64 back to file blob download
  const handleDownload = (doc: DocumentRecord) => {
    try {
      const link = document.createElement("a");
      link.href = doc.content;
      link.download = doc.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to compile source document streams.");
    }
  };

  const sampleMockDocs = [
    { title: "Standard NDA Agreement Template.pdf", category: "Contract", fileSize: "240 KB", date: "2026-06-12" },
    { title: "Figma App Design Handover Package.zip", category: "Project File", fileSize: "4.2 MB", date: "2026-06-14" },
    { title: "Technical Architecture Schematics.pdf", category: "Client File", fileSize: "1.1 MB", date: "2026-06-15" },
  ];

  return (
    <div className="relative min-h-[500px]">
      {/* Dynamic Gated Lock Overlay for Free Plan */}
      {!isPro && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-transparent backdrop-blur-[2.5px] p-6 text-center">
          <div className="p-6 glass-modal rounded-3xl shadow-2xl max-w-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center text-violet-650 mb-4 border border-violet-200 animate-pulse">
              <FolderLock className="w-8 h-8" />
            </div>
            <span className="text-[10px] tracking-widest font-extrabold uppercase text-indigo-505 block mb-1">
              PRO MODULE UNTIL PREMIUM
            </span>
            <h3 className="text-lg font-black text-slate-850 leading-tight">
              Secure Document Vault Gated
            </h3>
            <p className="text-xs text-slate-500 mt-2">
              Unlock contract backups, deliverables archiving, and direct browser-native invoice client assets uploading.
            </p>

            <button
              onClick={() => onTriggerUpgrade("document_storage")}
              className="mt-5 w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1 group"
            >
              <Sparkles size={12} />
              <span>Unlock Document Vault</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Area (blurred if Free) */}
      <div className={`space-y-6 ${!isPro ? "blur-[2px] pointer-events-none select-none opacity-40" : ""}`}>
        {/* Upload Hub Grid Component */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* File Picker Control */}
          <div className="p-5 glass-panel rounded-2xl space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-450">Vault Settings</h3>

            <div>
              <label className="block text-slate-505 text-xs font-semibold mb-1">Document Category</label>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value as any)}
                className="w-full py-2 px-3 glass-input rounded-xl text-xs text-slate-805 focus:outline-none"
              >
                <option value="Contract">Project Contract</option>
                <option value="Client File">Client Asset Folder</option>
                <option value="Project File">Deliverable ZIP / Brief</option>
              </select>
            </div>

            {/* Drag & Drop Visual Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
                dragActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-black/10 bg-black/5 hover:border-indigo-500 hover:bg-black/10"
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
                {isUploading ? "Uploading..." : "Select or Drop Local Work File"}
              </strong>
              <span className="text-[10px] text-slate-400 mt-1 max-w-[150px] leading-tight block">
                Supports PDF, ZIP, DOCX, Images up to 5MB.
              </span>
            </div>
          </div>

          {/* Documents Lists Grid Columns */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-5 glass-panel rounded-2xl min-h-[300px]">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <FileCheck size={16} className="text-indigo-500" />
                <span>Operational Vault Ledger</span>
                <span className="text-xs font-normal text-slate-400 ml-auto leading-none">
                  Total stored: {documents.length}
                </span>
              </h3>

              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-slate-400 min-h-[200px]">
                  <FileText className="w-10 h-10 text-slate-300 mb-2 animate-bounce" />
                  <span>No documents currently listed. Drag contract files or receipts to build backups.</span>
                </div>
              ) : (
                <div className="divide-y divide-black/5 text-xs">
                  {documents.map((doc) => (
                    <div key={doc.id} className="py-3 flex items-center justify-between gap-4 group">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-2 bg-black/5 border border-white/20 text-indigo-500 rounded-xl shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-805 truncate max-w-md block leading-snug">
                            {doc.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-450 font-medium leading-none">
                            <span className="bg-black/5 font-bold text-indigo-650 px-1.5 py-0.5 rounded-md">
                              {doc.category}
                            </span>
                            <span>{doc.fileSize}</span>
                            <span className="flex items-center gap-0.5 text-[9px]">
                              <Calendar size={10} />
                              <span>{new Date(doc.uploadDate || doc.createdAt).toLocaleDateString()}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-1 px-2 border border-white/10 hover:bg-black/10 text-slate-500 hover:text-indigo-600 rounded-lg text-[10px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                        >
                          <Download size={11} />
                          <span>Get File</span>
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove file "${doc.title}" entirely lock vaults?`)) {
                              onDeleteDocument(doc.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-red-500 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Simulated Background list of files for visual placeholder depth under Free mask */}
      {!isPro && (
        <div className="pointer-events-none select-none blur-[1.5px] opacity-15 space-y-4">
          <div className="p-5 glass-panel text-xs">
            <h4 className="font-bold text-slate-450 mb-3 uppercase tracking-wider">Example Documents Locked Ledger</h4>
            <div className="divide-y divide-black/5">
              {sampleMockDocs.map((item, id) => (
                <div key={id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-slate-400" />
                    <span className="font-bold text-slate-700">{item.title}</span>
                  </div>
                  <span className="bg-black/5 px-1.5 py-0.5 rounded-md text-[9px] text-slate-400 font-bold">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
