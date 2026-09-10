import React, { useState, useMemo, useEffect } from "react";
import {
  FileCheck2,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Eye,
  Briefcase,
  Receipt,
  Sparkles,
  AlertCircle,
  Copy,
  FolderPlus,
  Mail,
  Printer,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Proposal, ProposalItem, Client, Project, Invoice, FreelancerProfile } from "../types";
import { generateUUID, formatCurrency } from "../utils";
import { generateProposalPdf } from "../services/proposalPdfService";
import SendProposalModal from "./SendProposalModal";

interface ProposalsViewProps {
  proposals: Proposal[];
  clients: Client[];
  projects?: Project[];
  invoices?: Invoice[];
  profile: FreelancerProfile | null;
  searchTerm?: string;
  initialOpenCreate?: boolean;
  onSaveProposal: (proposal: Proposal) => void;
  onDeleteProposal: (id: string) => void;
  onConvertToProject?: (proposal: Proposal) => void;
  onConvertToInvoice?: (proposal: Proposal) => void;
  onUpdateClient?: (id: string, fields: Partial<Client>) => void;
  onTriggerUpgrade: (reason: string) => void;
  onNavigateToClient?: (clientId: string) => void;
  onOpenGmailConnect?: () => void;
}

export default function ProposalsView({
  proposals = [],
  clients = [],
  projects = [],
  invoices = [],
  profile,
  searchTerm: externalSearchTerm = "",
  initialOpenCreate = false,
  onSaveProposal,
  onDeleteProposal,
  onConvertToProject,
  onConvertToInvoice,
  onUpdateClient,
  onTriggerUpgrade,
  onNavigateToClient,
  onOpenGmailConnect,
}: ProposalsViewProps) {
  // Pro entitlement status check (Free plan maximum 5 proposals)
  const isPro =
    profile?.premium === true ||
    profile?.plan === "Pro" ||
    profile?.plan === "Monthly" ||
    profile?.plan === "Annual" ||
    profile?.plan === "3 Months" ||
    (profile?.plan !== undefined && profile?.plan !== "Free");
  const isFree = !isPro;
  const proposalCount = proposals.length;
  const isProposalLimitReached = isFree && proposalCount >= 5;

  // Search & Filters
  const [internalSearchTerm, setInternalSearchTerm] = useState("");
  const activeSearch = externalSearchTerm || internalSearchTerm;
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Error boundary simulation / recovery state
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(initialOpenCreate && !isProposalLimitReached);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);
  const [sendModalProposal, setSendModalProposal] = useState<Proposal | null>(null);

  // If initially requested to open create but limit is reached, trigger upgrade screen
  useEffect(() => {
    if (initialOpenCreate && isProposalLimitReached && onTriggerUpgrade) {
      onTriggerUpgrade("proposal_limit");
    }
  }, [initialOpenCreate, isProposalLimitReached, onTriggerUpgrade]);

  // Form State
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split("T")[0];
  });
  const [status, setStatus] = useState<Proposal["status"]>("Draft");
  const [discountRate, setDiscountRate] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState(
    "Payment terms: 50% upfront deposit before kickoff, 50% upon milestone completion. Quote valid for 14 days."
  );
  const [items, setItems] = useState<ProposalItem[]>([
    { description: "Scope Deliverable / Professional Service", quantity: 1, rate: 1200 },
  ]);
  const [formError, setFormError] = useState("");

  const currencySymbol = profile?.currency || "$";

  // Filter projects when a specific client is selected in the form
  const clientProjects = useMemo(() => {
    if (!clientId) return [];
    return projects.filter((p) => p.clientId === clientId);
  }, [projects, clientId]);

  // Selected client for form
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId);
  }, [clients, clientId]);

  const openCreateModal = () => {
    try {
      if (isProposalLimitReached) {
        if (onTriggerUpgrade) {
          onTriggerUpgrade("proposal_limit");
        }
        return;
      }

      setEditingProposal(null);
      const defaultClientId = clients.length > 0 ? clients[0].id : "";
      setClientId(defaultClientId);
      setProjectId("");
      setTitle("Project Scope & Quotation");
      setDescription("Comprehensive scope of deliverables, milestones, and project execution roadmap.");
      
      const nextNum = (proposals.length + 1).toString().padStart(3, "0");
      setProposalNumber(`PROP-${nextNum}`);
      
      const today = new Date().toISOString().split("T")[0];
      setIssueDate(today);
      
      const d = new Date();
      d.setDate(d.getDate() + 14);
      setValidUntil(d.toISOString().split("T")[0]);
      
      setStatus("Draft");
      setDiscountRate(0);
      setTaxRate(0);
      setNotes("Thank you for considering our proposal. We are eager to partner with you and achieve outstanding outcomes!");
      setTerms("Payment terms: 50% upfront deposit before project kickoff, 50% upon final sign-off. Quote valid for 14 days.");
      setItems([{ description: "Core Deliverable / Scope of Work", quantity: 1, rate: 1500 }]);
      setFormError("");
      setIsFormModalOpen(true);
    } catch (err: any) {
      console.error("Error opening create proposal modal", err);
      setHasError(true);
      setErrorMessage(err.message || "Failed to initialize proposal form.");
    }
  };

  const openEditModal = (p: Proposal) => {
    try {
      setEditingProposal(p);
      setClientId(p.clientId || (clients[0]?.id || ""));
      setProjectId(p.projectId || "");
      setTitle(p.title || "");
      setDescription(p.description || "");
      setProposalNumber(p.proposalNumber || "");
      setIssueDate(p.issueDate || new Date().toISOString().split("T")[0]);
      setValidUntil(p.validUntil || "");
      setStatus(p.status || "Draft");
      setDiscountRate(Number(p.discountRate) || 0);
      setTaxRate(Number(p.taxRate) || 0);
      setNotes(p.notes || "");
      setTerms(p.terms || "");
      setItems(p.items && p.items.length > 0 ? [...p.items] : [{ description: "Service", quantity: 1, rate: 0 }]);
      setFormError("");
      setIsFormModalOpen(true);
    } catch (err: any) {
      console.error("Error editing proposal", err);
      setHasError(true);
      setErrorMessage(err.message || "Failed to load proposal details.");
    }
  };

  const handleDuplicateProposal = (original: Proposal) => {
    try {
      if (isProposalLimitReached) {
        if (onTriggerUpgrade) {
          onTriggerUpgrade("proposal_limit");
        }
        return;
      }

      const nextNum = (proposals.length + 1).toString().padStart(3, "0");
      const duplicated: Proposal = {
        ...original,
        id: generateUUID(),
        proposalNumber: `PROP-${nextNum}`,
        title: `${original.title} (Copy)`,
        status: "Draft",
        issueDate: new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
        convertedProjectId: undefined,
        convertedInvoiceId: undefined,
        sentAt: undefined,
        sentTo: undefined,
        sendMethod: undefined,
        lastSendError: undefined,
      };
      onSaveProposal(duplicated);
    } catch (err: any) {
      console.error("Failed to duplicate proposal", err);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, rate: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ProposalItem, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const calculateSubtotal = (itemList: ProposalItem[]) => {
    return (itemList || []).reduce(
      (acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
      0
    );
  };

  const calculateTotal = (itemList: ProposalItem[], disc: number, tax: number) => {
    const sub = calculateSubtotal(itemList);
    const discountAmt = (sub * (Number(disc) || 0)) / 100;
    const afterDisc = Math.max(0, sub - discountAmt);
    const taxAmt = (afterDisc * (Number(tax) || 0)) / 100;
    return afterDisc + taxAmt;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProposal && isProposalLimitReached) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade("proposal_limit");
      }
      return;
    }

    if (!clientId) {
      setFormError("Please select a client for this proposal.");
      return;
    }
    if (!title.trim()) {
      setFormError("Please enter a proposal title.");
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setFormError("All item descriptions must be filled.");
      return;
    }

    const proposalData: Proposal = {
      id: editingProposal?.id || generateUUID(),
      freelancerId: editingProposal?.freelancerId || profile?.id || "",
      proposalNumber: proposalNumber.trim() || `PROP-${Date.now().toString().slice(-4)}`,
      clientId,
      projectId: projectId || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      issueDate,
      validUntil,
      items,
      discountRate: Number(discountRate) || 0,
      taxRate: Number(taxRate) || 0,
      notes: notes.trim() || undefined,
      terms: terms.trim() || undefined,
      status,
      convertedProjectId: editingProposal?.convertedProjectId,
      convertedInvoiceId: editingProposal?.convertedInvoiceId,
      sentAt: editingProposal?.sentAt,
      sentTo: editingProposal?.sentTo,
      sendMethod: editingProposal?.sendMethod,
      lastSendError: editingProposal?.lastSendError,
      createdAt: editingProposal?.createdAt || new Date().toISOString(),
    };

    onSaveProposal(proposalData);
    setIsFormModalOpen(false);
  };

  const handleDownloadPdf = (p: Proposal) => {
    try {
      const client = clients.find((c) => c.id === p.clientId);
      if (!profile) return;
      const pdf = generateProposalPdf(p, client, profile);
      pdf.download();
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      alert("Unable to generate PDF. Please check proposal information.");
    }
  };

  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      const clientName = client?.companyName || client?.contactPerson || "";
      const matchesSearch =
        p.title.toLowerCase().includes(activeSearch.toLowerCase()) ||
        p.proposalNumber.toLowerCase().includes(activeSearch.toLowerCase()) ||
        clientName.toLowerCase().includes(activeSearch.toLowerCase());

      const matchesStatus = statusFilter === "All" || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [proposals, clients, activeSearch, statusFilter]);

  const getStatusBadge = (st: Proposal["status"]) => {
    switch (st) {
      case "Accepted":
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 size={11} />
            <span>Accepted</span>
          </span>
        );
      case "Sent":
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-sky-50 text-sky-700 rounded-full border border-sky-200 inline-flex items-center gap-1">
            <Send size={11} />
            <span>Sent</span>
          </span>
        );
      case "Viewed":
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 rounded-full border border-purple-200 inline-flex items-center gap-1">
            <Eye size={11} />
            <span>Viewed</span>
          </span>
        );
      case "Rejected":
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 text-rose-700 rounded-full border border-rose-200 inline-flex items-center gap-1">
            <XCircle size={11} />
            <span>Rejected</span>
          </span>
        );
      case "Expired":
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200 inline-flex items-center gap-1">
            <Clock size={11} />
            <span>Expired</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 inline-flex items-center gap-1">
            <Edit2 size={11} />
            <span>Draft</span>
          </span>
        );
    }
  };

  // Error State Recovery Screen
  if (hasError) {
    return (
      <div className="p-8 bg-white border border-rose-200 rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900">Unable to load proposals</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {errorMessage || "Please try again. Your proposal records are safely preserved in your workspace."}
          </p>
        </div>
        <button
          onClick={() => {
            setHasError(false);
            setErrorMessage("");
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <RefreshCw size={13} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileCheck2 className="text-indigo-600" size={24} />
              <span>Proposals</span>
            </h1>
            {isProposalLimitReached ? (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                <AlertCircle size={12} className="text-amber-600" />
                <span>5/5 Proposals used</span>
              </span>
            ) : isFree ? (
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                Proposals: {proposalCount}/5
              </span>
            ) : (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                <Sparkles size={11} />
                <span>Pro &middot; Unlimited</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, manage, and track professional proposals for your clients.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openCreateModal}
            className={`px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isProposalLimitReached
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white"
            }`}
          >
            {isProposalLimitReached ? <Sparkles size={14} /> : <Plus size={15} />}
            <span>+ Create Proposal</span>
          </button>
        </div>
      </div>

      {/* Free Plan Limit Notice Banner */}
      {isProposalLimitReached && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <AlertCircle size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">
                5/5 Proposals used (Free Plan Limit Reached)
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                You've reached the Free plan limit of 5 proposals. Upgrade to Pro to create more proposals.
              </p>
            </div>
          </div>
          <button
            onClick={() => onTriggerUpgrade("proposal_limit")}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles size={13} />
            <span>Upgrade to Pro</span>
          </button>
        </div>
      )}

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className={`p-4 bg-white border rounded-2xl shadow-xs transition-all ${
            isProposalLimitReached
              ? "border-amber-300 ring-1 ring-amber-400/20 bg-amber-50/10"
              : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Proposals
            </span>
            {isFree ? (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                  isProposalLimitReached
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {isProposalLimitReached ? "Limit reached" : "Free Plan"}
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-50 text-indigo-700">
                Pro
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <p
              className={`text-xl font-extrabold ${
                isProposalLimitReached ? "text-amber-600" : "text-slate-900"
              }`}
            >
              {isFree ? `${proposalCount} / 5` : `${proposalCount}`}
            </p>
            <span
              className={`text-[11px] font-medium ${
                isProposalLimitReached
                  ? "text-amber-600 font-bold"
                  : isFree
                  ? "text-slate-500"
                  : "text-slate-400"
              }`}
            >
              {isFree ? (isProposalLimitReached ? "5/5 used" : "Max 5") : "Unlimited"}
            </span>
          </div>
        </div>
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Accepted Quotes</span>
          <p className="text-xl font-extrabold text-emerald-700 mt-1">
            {proposals.filter((p) => p.status === "Accepted").length}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">Sent & Pending</span>
          <p className="text-xl font-extrabold text-sky-700 mt-1">
            {proposals.filter((p) => p.status === "Sent" || p.status === "Viewed").length}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Accepted Value</span>
          <p className="text-xl font-extrabold text-indigo-700 mt-1">
            {formatCurrency(
              proposals
                .filter((p) => p.status === "Accepted")
                .reduce((sum, p) => sum + calculateTotal(p.items, p.discountRate || 0, p.taxRate || 0), 0),
              profile?.currency
            )}
          </p>
        </div>
      </div>

      {/* 3. Search & Status Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client, title, or proposal #..."
            value={internalSearchTerm}
            onChange={(e) => setInternalSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(["All", "Draft", "Sent", "Viewed", "Accepted", "Rejected", "Expired"] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 border border-transparent"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Proposals List or Empty State */}
      {filteredProposals.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <FileCheck2 size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {activeSearch || statusFilter !== "All" ? "No matching proposals" : "No proposals yet"}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5 leading-relaxed">
            {activeSearch || statusFilter !== "All"
              ? "No proposals match your search keyword or selected status filter."
              : "Create your first proposal and send a professional offer to your client."}
          </p>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus size={15} />
            <span>+ Create Proposal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProposals.map((proposal) => {
            const client = clients.find((c) => c.id === proposal.clientId);
            const connectedProject = projects.find((p) => p.id === proposal.projectId);
            const total = calculateTotal(proposal.items, proposal.discountRate || 0, proposal.taxRate || 0);

            return (
              <div
                key={proposal.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Proposal # and Status */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          #{proposal.proposalNumber}
                        </span>
                        {connectedProject && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[130px]">
                            {connectedProject.title}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-1.5 leading-snug">{proposal.title}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          if (client && onNavigateToClient) {
                            onNavigateToClient(client.id);
                          }
                        }}
                        className="text-xs text-indigo-600 hover:underline font-semibold mt-0.5 block text-left cursor-pointer"
                      >
                        {client ? client.companyName : "Unassigned Client"}
                        {client?.contactPerson ? ` (${client.contactPerson})` : ""}
                      </button>
                    </div>
                    <div>{getStatusBadge(proposal.status)}</div>
                  </div>

                  {/* Summary Scope Box */}
                  <div className="my-3 py-2.5 px-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="flex justify-between items-center font-medium text-slate-600 mb-1">
                      <span>
                        {proposal.items.length} item{proposal.items.length > 1 ? "s" : ""} itemized
                      </span>
                      <span className="font-extrabold text-sm text-slate-900">
                        {formatCurrency(total, profile?.currency)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {proposal.items.map((i) => i.description).join(" • ")}
                    </p>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      Issued: {proposal.issueDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} className="text-slate-400" />
                      Valid until: {proposal.validUntil}
                    </span>
                  </div>

                  {/* Delivery notification if sent */}
                  {proposal.sentAt && (
                    <div className="mb-3 text-[10px] text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Send size={10} />
                        Delivered to: {proposal.sentTo || "client"}
                      </span>
                      <span>{new Date(proposal.sentAt).toLocaleDateString()}</span>
                    </div>
                  )}

                  {proposal.lastSendError && (
                    <div className="mb-3 text-[10px] text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 flex items-center gap-1">
                      <AlertCircle size={11} className="shrink-0" />
                      <span className="truncate">{proposal.lastSendError}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {/* Left: View, Edit, Duplicate, PDF, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewProposal(proposal)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="View / Preview Proposal"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      onClick={() => openEditModal(proposal)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Proposal"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDuplicateProposal(proposal)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Duplicate Proposal"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => handleDownloadPdf(proposal)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Download PDF"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete proposal #${proposal.proposalNumber}?`)) {
                          onDeleteProposal(proposal.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Proposal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Right: Send & Conversion Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSendModalProposal(proposal)}
                      className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Send Proposal via Gmail"
                    >
                      <Send size={12} />
                      <span>Send</span>
                    </button>

                    {proposal.status === "Accepted" && onConvertToProject && (
                      <button
                        onClick={() => onConvertToProject(proposal)}
                        className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Create a project from this accepted proposal"
                      >
                        <Briefcase size={12} />
                        <span>Project</span>
                      </button>
                    )}

                    {onConvertToInvoice && (
                      <button
                        onClick={() => onConvertToInvoice(proposal)}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Generate invoice from this proposal"
                      >
                        <Receipt size={12} />
                        <span>Invoice</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. CREATE / EDIT PROPOSAL MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileCheck2 size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingProposal ? `Edit Proposal #${proposalNumber}` : "Create Proposal"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Configure client scope, pricing breakdown, deliverables, and terms
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Client & Project Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => {
                      setClientId(e.target.value);
                      setProjectId("");
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Select Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} {c.contactPerson ? `(${c.contactPerson})` : ""} {c.email ? `• ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                  {selectedClient && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Email: {selectedClient.email || "No email on file"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Related Project <span className="text-slate-400">(Optional)</span>
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="">-- None / General Scope --</option>
                    {clientProjects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.title} ({proj.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Proposal Number, Status & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proposal # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={proposalNumber}
                    onChange={(e) => setProposalNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Proposal["status"])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Viewed">Viewed</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Proposal Title & Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Proposal Title / Scope <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Website Redesign & Brand Identity Package"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description / Project Scope Summary
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of project goals, background, or objective..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Items & Services Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Services / Deliverable Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Description of service / deliverable..."
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                          required
                        />
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value) || 1)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center text-slate-900"
                        />
                      </div>
                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, "rate", Number(e.target.value) || 0)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900"
                        />
                      </div>
                      <div className="w-24 text-right font-bold text-xs text-slate-800 px-1">
                        {formatCurrency(item.quantity * item.rate, profile?.currency)}
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Discounts, Taxes & Calculation Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Notes for Client
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Scope assumes 2 rounds of creative revisions."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Terms & Payment Schedule
                    </label>
                    <textarea
                      rows={2}
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="e.g. 50% upfront, 50% on milestone completion."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs resize-none"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(calculateSubtotal(items), profile?.currency)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Discount (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={discountRate}
                      onChange={(e) => setDiscountRate(Number(e.target.value) || 0)}
                      className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right text-slate-900"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">Tax / VAT (%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                      className="w-20 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right text-slate-900"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-indigo-700">
                    <span>Total Estimate:</span>
                    <span>
                      {formatCurrency(
                        calculateTotal(items, discountRate, taxRate),
                        profile?.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>{editingProposal ? "Update Proposal" : "Save Proposal"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. PROPOSAL PREVIEW MODAL */}
      {previewProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileCheck2 className="text-indigo-600" size={18} />
                <h3 className="text-base font-bold text-slate-900">
                  #{previewProposal.proposalNumber} - {previewProposal.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewProposal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Proposal Branding Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {profile?.businessName || profile?.name || "Freelancer Workspace"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">{profile?.name}</p>
                  {profile?.gmailEmail && <p className="text-[11px] text-slate-400">{profile.gmailEmail}</p>}
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                    #{previewProposal.proposalNumber}
                  </span>
                  <div className="mt-1.5">{getStatusBadge(previewProposal.status)}</div>
                </div>
              </div>

              {/* Client and Validity */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                    Prepared For
                  </span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">
                    {clients.find((c) => c.id === previewProposal.clientId)?.companyName || "Client"}
                  </p>
                  <p className="text-slate-600">
                    {clients.find((c) => c.id === previewProposal.clientId)?.contactPerson}
                  </p>
                  <p className="text-slate-600">
                    {clients.find((c) => c.id === previewProposal.clientId)?.email}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                    Proposal Details
                  </span>
                  <p className="text-slate-700 mt-0.5">
                    <strong>Issue Date:</strong> {previewProposal.issueDate}
                  </p>
                  <p className="text-slate-700">
                    <strong>Valid Until:</strong> {previewProposal.validUntil}
                  </p>
                </div>
              </div>

              {/* Scope Title & Description */}
              {previewProposal.description && (
                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-950">
                  <span className="font-bold block mb-0.5">Scope Summary:</span>
                  <p>{previewProposal.description}</p>
                </div>
              )}

              {/* Scope Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Deliverable / Service</th>
                      <th className="py-2.5 px-3 text-center w-16">Qty</th>
                      <th className="py-2.5 px-3 text-right w-24">Rate</th>
                      <th className="py-2.5 px-3 text-right w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewProposal.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.description}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {formatCurrency(item.rate, profile?.currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(item.quantity * item.rate, profile?.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(calculateSubtotal(previewProposal.items), profile?.currency)}
                    </span>
                  </div>
                  {previewProposal.discountRate ? (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount ({previewProposal.discountRate}%):</span>
                      <span>
                        -
                        {formatCurrency(
                          (calculateSubtotal(previewProposal.items) * previewProposal.discountRate) / 100,
                          profile?.currency
                        )}
                      </span>
                    </div>
                  ) : null}
                  {previewProposal.taxRate ? (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax ({previewProposal.taxRate}%):</span>
                      <span>
                        +
                        {formatCurrency(
                          (Math.max(
                            0,
                            calculateSubtotal(previewProposal.items) -
                              (calculateSubtotal(previewProposal.items) * (previewProposal.discountRate || 0)) / 100
                          ) *
                            previewProposal.taxRate) /
                            100,
                          profile?.currency
                        )}
                      </span>
                    </div>
                  ) : null}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-extrabold text-indigo-700">
                    <span>Total Estimate:</span>
                    <span>
                      {formatCurrency(
                        calculateTotal(
                          previewProposal.items,
                          previewProposal.discountRate || 0,
                          previewProposal.taxRate || 0
                        ),
                        profile?.currency
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes & Terms */}
              {(previewProposal.notes || previewProposal.terms) && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                  {previewProposal.notes && (
                    <div>
                      <span className="font-bold text-slate-700 block">Notes:</span>
                      <p className="text-slate-600 mt-0.5">{previewProposal.notes}</p>
                    </div>
                  )}
                  {previewProposal.terms && (
                    <div>
                      <span className="font-bold text-slate-700 block">Terms & Conditions:</span>
                      <p className="text-slate-600 mt-0.5">{previewProposal.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(previewProposal)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = previewProposal;
                    setPreviewProposal(null);
                    setSendModalProposal(p);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={13} />
                  <span>Send Proposal</span>
                </button>

                {onConvertToInvoice && (
                  <button
                    type="button"
                    onClick={() => {
                      onConvertToInvoice(previewProposal);
                      setPreviewProposal(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Receipt size={13} />
                    <span>Convert to Invoice</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SEND PROPOSAL EMAIL MODAL */}
      {sendModalProposal && profile && (
        <SendProposalModal
          isOpen={!!sendModalProposal}
          onClose={() => setSendModalProposal(null)}
          proposal={sendModalProposal}
          client={clients.find((c) => c.id === sendModalProposal.clientId)}
          profile={profile}
          onUpdateProposal={(updated) => {
            onSaveProposal(updated);
            setSendModalProposal(null);
          }}
          onUpdateClient={onUpdateClient}
          onTriggerUpgrade={onTriggerUpgrade}
          onOpenGmailConnect={onOpenGmailConnect}
        />
      )}
    </div>
  );
}
