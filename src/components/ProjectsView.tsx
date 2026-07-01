import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check, X, Edit3, Trash2, Calendar, Coins, FolderKanban, FolderGit2, ArrowRight, LayoutGrid, CalendarDays, AlertCircle } from "lucide-react";
import { Project, Client, FreelancerProfile } from "../types";
import { formatCurrency } from "../utils";

interface ProjectsViewProps {
  projects: Project[];
  clients: Client[];
  profile: FreelancerProfile;
  searchTerm: string;
  onAddProject: (project: Omit<Project, "id" | "freelancerId" | "createdAt">) => void;
  onUpdateProject: (id: string, project: Partial<Project>) => void;
  onDeleteProject: (id: string) => void;
  onTriggerUpgrade: (reason: string) => void;
}

export default function ProjectsView({
  projects,
  clients,
  profile,
  searchTerm,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onTriggerUpgrade,
}: ProjectsViewProps) {
  const isFree = profile.plan === "Free" && !profile.premium;
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showClientWarning, setShowClientWarning] = useState(false);

  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");

  // Form Fields
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [budget, setBudget] = useState<number>(0);
  const [deadline, setDeadline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<Project["status"]>("Not Started");
  const [notes, setNotes] = useState("");

  const [filterStatus, setFilterStatus] = useState<"All" | Project["status"]>("All");

  const filteredProjects = projects.filter((p) => {
    const client = clients.find((c) => c.id === p.clientId);
    const clientName = client ? `${client.companyName} ${client.contactPerson}`.toLowerCase() : "";
    const matchesSearch =
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clientName.includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "All" || p.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  // Timeline bounds and visual timeline month scale
  const earliestDate = filteredProjects.reduce((acc, p) => {
    const d = p.startDate || p.createdAt?.split("T")[0];
    if (!d) return acc;
    return d < acc ? d : acc;
  }, new Date().toISOString().split("T")[0]);

  const latestDate = filteredProjects.reduce((acc, p) => {
    const d = p.endDate || p.deadline;
    if (!d) return acc;
    return d > acc ? d : acc;
  }, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);

  const startParsed = new Date(earliestDate);
  const timelineStart = new Date(startParsed.getFullYear(), startParsed.getMonth(), 1);

  const endParsed = new Date(latestDate);
  const timelineEnd = new Date(endParsed.getFullYear(), endParsed.getMonth() + 1, 0);

  const totalDuration = timelineEnd.getTime() - timelineStart.getTime() || 1;

  const months: { name: string; offset: number; width: number }[] = [];
  let currentMonthIterator = new Date(timelineStart);
  while (currentMonthIterator < timelineEnd) {
    const mStart = new Date(currentMonthIterator.getFullYear(), currentMonthIterator.getMonth(), 1);
    const mEnd = new Date(currentMonthIterator.getFullYear(), currentMonthIterator.getMonth() + 1, 1);

    const offsetRange = ((mStart.getTime() - timelineStart.getTime()) / totalDuration) * 100;
    const widthRange = ((Math.min(mEnd.getTime(), timelineEnd.getTime()) - mStart.getTime()) / totalDuration) * 100;

    months.push({
      name: mStart.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      offset: offsetRange,
      width: widthRange,
    });

    currentMonthIterator.setMonth(currentMonthIterator.getMonth() + 1);
  }

  const resetForm = () => {
    setTitle("");
    setClientId("");
    setBudget(0);
    setDeadline("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setProgress(0);
    setStatus("Not Started");
    setNotes("");
  };

  const handleOpenAdd = () => {
    if (clients.length === 0) {
      setShowClientWarning(true);
      return;
    }
    if (isFree && projects.length >= 10) {
      onTriggerUpgrade("project_limit");
      return;
    }
    resetForm();
    if (clients.length > 0) setClientId(clients[0].id);
    setIsAdding(true);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientId) return;

    onAddProject({
      title: title.trim(),
      clientId,
      budget: Number(budget) || 0,
      deadline: endDate || deadline,
      startDate: startDate || new Date().toISOString().split("T")[0],
      endDate: endDate || deadline,
      progress: Number(progress) || 0,
      status,
      notes: notes.trim(),
    });
    setIsAdding(false);
    resetForm();
  };

  const handleStartEdit = (p: Project) => {
    setEditingProject(p);
    setTitle(p.title);
    setClientId(p.clientId);
    setBudget(p.budget);
    setDeadline(p.deadline || "");
    setStartDate(p.startDate || p.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0]);
    setEndDate(p.endDate || p.deadline || "");
    setProgress(p.progress || 0);
    setStatus(p.status || "Not Started");
    setNotes(p.notes || "");
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !title.trim() || !clientId) return;

    onUpdateProject(editingProject.id, {
      title: title.trim(),
      clientId,
      budget: Number(budget) || 0,
      deadline: endDate || deadline,
      startDate,
      endDate: endDate || deadline,
      progress: Number(progress) || 0,
      status,
      notes: notes.trim(),
    });
    setEditingProject(null);
  };

  const getClientMeta = (cId: string) => {
    const c = clients.find((item) => item.id === cId);
    return c ? `${c.companyName} (${c.contactPerson})` : "Unassigned Client";
  };

  return (
    <div className="space-y-6">
      {/* Filters and Add Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {["All", "Not Started", "In Progress", "On Hold", "Completed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterStatus(tab as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm transition-all cursor-pointer ${
                  filterStatus === tab
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15"
                    : "glass-item border border-white/20 text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab} ({tab === "All" ? projects.length : projects.filter((p) => p.status === tab).length})
              </button>
            ))}
          </div>

          <div className="h-5 w-[1px] bg-black/10 hidden md:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center bg-black/5 p-1 rounded-xl border border-black/5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "grid"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <LayoutGrid size={12} />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`p-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "timeline"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              <CalendarDays size={12} />
              <span>Timeline</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isFree && (
            <span className="text-[11px] text-slate-400 font-medium">
              Projects: <strong>{projects.length}/10</strong>
            </span>
          )}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5"
          >
            <Plus size={14} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Adding/Editing Popup Interface */}
      <AnimatePresence>
        {(isAdding || editingProject) && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800">
                  {isAdding ? "Initiate Project Contract" : `Edit Project: ${editingProject?.title}`}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingProject(null);
                  }}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={isAdding ? handleSubmitAdd : handleSubmitEdit} className="p-5 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Project Identifier / Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                    placeholder="e.g. Website Redesign v2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Assign Client Partner *</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.contactPerson})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Total Budget Amt *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">
                        {profile.currency === "INR" ? "₹" : "$"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={budget || ""}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        className="w-full py-2 pl-7 pr-3 glass-input rounded-xl text-slate-800 focus:outline-none font-mono text-xs"
                        placeholder="2500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Project Status</label>
                    <select
                      value={status}
                      onChange={(e) => {
                        const newStatus = e.target.value as Project["status"];
                        setStatus(newStatus);
                        if (newStatus === "Completed") {
                          setProgress(100);
                        }
                      }}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none text-xs"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">End / Target Date *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDeadline(e.target.value);
                      }}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 p-3 bg-black/5 rounded-xl border border-black/5">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-slate-500">Visual Project Progress</label>
                    <span className="text-xs font-mono font-black text-indigo-650">{progress}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={progress}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setProgress(val);
                        if (val === 100) {
                          setStatus("Completed");
                        } else if (val > 0 && status === "Not Started") {
                          setStatus("In Progress");
                        }
                      }}
                      className="flex-1 accent-indigo-605 cursor-pointer h-1 bg-black/10 rounded-lg appearance-none"
                    />
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setProgress(0)}
                        className="px-1.5 py-0.5 bg-black/10 border border-white/10 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                      >
                        0%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProgress(50);
                          if (status === "Not Started") setStatus("In Progress");
                        }}
                        className="px-1.5 py-0.5 bg-black/10 border border-white/10 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProgress(100);
                          setStatus("Completed");
                        }}
                        className="px-1.5 py-0.5 bg-black/10 border border-white/10 rounded text-[9px] font-bold hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                      >
                        100%
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Project Deliverables / Brief</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-850 focus:outline-none resize-none"
                    placeholder="Deliverables: Figma files, hosting setup, git repo hand over..."
                  />
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingProject(null);
                    }}
                    className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {isAdding ? "Initiate Project" : "Save Project"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <FolderKanban className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No projects listed</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {projects.length === 0
              ? "You haven't initialized any deliverables or customer task agreements. Start tracking work contracts here."
              : "Refine your keyword search queries or status filters to view active deliverables."}
          </p>
          {projects.length === 0 && (
            <button
              onClick={handleOpenAdd}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all font-bold"
            >
              Add First Project
            </button>
          )}
        </div>
      ) : viewMode === "timeline" ? (
        /* Timeline visual component */
        <div className="glass-panel p-5 rounded-2xl space-y-4 overflow-hidden shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between no-print border-b border-black/5 pb-3 gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <CalendarDays size={16} className="text-indigo-500" />
                <span>Project Timeline & Progress Gantt</span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-450 mt-0.5">
                Visual tracking of work agreements duration spans and deliverables completion states.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold">
              <span className="flex items-center gap-1 text-slate-455">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500/35 border border-indigo-500/50" />
                <span>Planned / Active</span>
              </span>
              <span className="flex items-center gap-1 text-slate-455">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/35 border border-emerald-500/50" />
                <span>Completed</span>
              </span>
              <span className="flex items-center gap-1 text-slate-455">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/35 border border-amber-500/50" />
                <span>On Hold</span>
              </span>
            </div>
          </div>

          {/* Horizontally scrollable Gantt schedule track */}
          <div className="overflow-x-auto select-none pt-2 scrollbar-thin">
            <div className="min-w-[760px] relative pb-2">
              
              {/* Scale headers: Month labels */}
              <div className="h-10 flex border border-black/5 bg-black/5 rounded-t-xl overflow-hidden font-mono text-[10px] font-bold text-slate-400">
                {/* Spacer */}
                <div className="w-[200px] border-r border-black/5 shrink-0 flex items-center pl-4 font-sans text-xs text-slate-600 font-extrabold">
                  Project Workspace
                </div>
                <div className="flex-1 relative h-full">
                  {months.map((m, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 border-r border-black/5 flex items-center justify-center text-center px-1 truncate"
                      style={{ left: `${m.offset}%`, width: `${m.width}%` }}
                    >
                      {m.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Lanes content containing horizontal bars */}
              <div className="relative divide-y divide-black/5 border-x border-b border-black/5 rounded-b-xl overflow-hidden">
                {/* Vertical dash lines matching the months */}
                <div className="absolute top-0 bottom-0 left-[200px] right-0 pointer-events-none z-0">
                  {months.map((m, idx) => (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 border-r border-black/10 border-dashed"
                      style={{ left: `${m.offset}%` }}
                    />
                  ))}
                </div>

                {filteredProjects.map((p) => {
                  const pStart = p.startDate ? new Date(p.startDate) : new Date(p.createdAt || Date.now());
                  const pEnd = p.endDate ? new Date(p.endDate) : (p.deadline ? new Date(p.deadline) : new Date(pStart.getTime() + 14 * 24 * 60 * 60 * 1000));

                  const leftP = Math.max(0, Math.min(100, ((pStart.getTime() - timelineStart.getTime()) / totalDuration) * 100));
                  const endP = Math.max(0, Math.min(100, ((pEnd.getTime() - timelineStart.getTime()) / totalDuration) * 100));
                  const widthP = Math.max(3, endP - leftP); // at least 3% width

                  const isOverdue = p.deadline && new Date(p.deadline) < new Date() && p.status !== "Completed";

                  return (
                    <div key={p.id} className="flex h-16 relative z-10 hover:bg-black/5 items-center">
                      <div className="w-[200px] shrink-0 pr-4 pl-4 flex flex-col justify-center border-r border-black/5 h-full z-10 bg-slate-50 whitespace-nowrap overflow-hidden">
                        <h4
                          onClick={() => handleStartEdit(p)}
                          className="font-bold text-xs text-slate-800 truncate hover:text-indigo-600 cursor-pointer"
                        >
                          {p.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                          {getClientMeta(p.clientId)}
                        </span>
                      </div>

                      <div className="flex-1 relative h-full flex items-center px-4 bg-transparent">
                        <div
                          onClick={() => handleStartEdit(p)}
                          className={`absolute h-8 rounded-xl flex items-center shadow-sm select-none cursor-pointer group/bar transition-all overflow-hidden border ${
                            p.status === "Completed"
                              ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-700"
                              : p.status === "On Hold"
                              ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-700"
                              : "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-700"
                          }`}
                          style={{ left: `${leftP}%`, width: `${widthP}%` }}
                        >
                          {/* Inside filled visual indicator progress bar */}
                          <div
                            className={`absolute top-0 bottom-0 left-0 transition-all pointer-events-none opacity-20 duration-500 ${
                              p.status === "Completed"
                                ? "bg-emerald-505"
                                : p.status === "On Hold"
                                ? "bg-amber-505"
                                : "bg-indigo-605"
                            }`}
                            style={{ width: `${p.progress || 0}%` }}
                          />

                          <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-bold truncate">
                            <span className="truncate flex items-center gap-1">
                              <span>{p.progress || 0}%</span>
                              <span className="text-[9px] font-normal text-slate-400 font-sans">({pStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - {pEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})})</span>
                            </span>
                            <span className={`text-[8px] font-black px-1.5 py-0.2 rounded shrink-0 uppercase tracking-wider ${
                              isOverdue ? "bg-red-500/20 text-red-600 animate-pulse animate-duration-1000" : "bg-black/5"
                            }`}>
                              {isOverdue ? "Overdue" : p.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>
      ) : (
        /* Projects Visual Grid */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const isOverdue = p.deadline && new Date(p.deadline) < new Date() && p.status !== "Completed";
            const pStart = p.startDate ? new Date(p.startDate) : new Date(p.createdAt || Date.now());
            const pEnd = p.endDate ? new Date(p.endDate) : (p.deadline ? new Date(p.deadline) : null);
            return (
              <motion.div
                layout
                key={p.id}
                className="p-5 glass-panel glass-highlight rounded-2xl transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-1">
                        {p.title}
                      </h4>
                      <span className="text-[11px] font-medium text-indigo-650 mt-0.5 block line-clamp-1">
                        {getClientMeta(p.clientId)}
                      </span>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      p.status === "Completed"
                        ? "bg-emerald-500/10 text-emerald-650"
                        : p.status === "In Progress"
                        ? "bg-sky-500/10 text-sky-655"
                        : p.status === "On Hold"
                        ? "bg-amber-500/10 text-amber-655"
                        : "bg-slate-500/10 text-slate-400"
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  <div className="space-y-3 border-t border-black/5 pt-3 mb-4 text-xs">
                    {/* Visual Progress Slider gauge inside the card */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-450 font-medium">Agreement Progress</span>
                        <strong className="text-indigo-600 font-mono font-bold">
                          {p.progress || 0}%
                        </strong>
                      </div>
                      <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full pointer-events-none rounded-full transition-all duration-500 ${
                            p.status === "Completed"
                              ? "bg-emerald-500"
                              : p.status === "On Hold"
                              ? "bg-amber-500"
                              : "bg-indigo-600"
                          }`}
                          style={{ width: `${p.progress || 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-slate-400">
                      <span>Total Value:</span>
                      <strong className="text-slate-800 font-mono font-bold">
                        {formatCurrency(p.budget, profile.currency)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Project Duration:</span>
                      <strong className="text-[10px] sm:text-[11px] font-bold text-slate-700 flex items-center gap-0.5">
                        <Calendar size={11} className="text-indigo-505 shrink-0 mr-0.5" />
                        <span>{pStart.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                        <span className="text-slate-400 font-normal mx-1">to</span>
                        <span className={isOverdue ? "text-red-500 animate-pulse font-black" : ""}>
                          {pEnd ? pEnd.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: '2-digit'}) : 'Not set'}
                        </span>
                      </strong>
                    </div>

                    {p.notes && (
                      <p className="text-[11px] text-slate-450 bg-slate-500/5 p-2 rounded-lg italic line-clamp-2 mt-2">
                        "{p.notes}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-1.5 border-t border-black/5 pt-3 opacity-90 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="p-1 px-2 border border-slate-205 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete project contract: "${p.title}"? This cannot be undone.`)) {
                        onDeleteProject(p.id);
                      }
                    }}
                    className="p-1 px-2 border border-red-200 text-red-550 hover:text-white hover:bg-red-500 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={11} />
                    <span>Delete</span>
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
                  Please configure at least one Client profile first before launching active project contracts.
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
