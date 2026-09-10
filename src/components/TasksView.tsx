import React, { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Check,
  Square,
  CheckSquare,
  Trash2,
  Calendar,
  KanbanSquare,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Task, Project, FreelancerProfile } from "../types";

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  profile?: FreelancerProfile;
  onAddTask: (task: Omit<Task, "id" | "freelancerId" | "createdAt">) => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

function TasksView({
  tasks = [],
  projects = [],
  profile,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onTriggerUpgrade,
}: TasksViewProps) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("Medium");

  const [filterProject, setFilterProject] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");

  // Pro entitlement status check
  const isPro =
    profile?.premium === true ||
    profile?.plan === "Pro" ||
    profile?.plan === "Monthly" ||
    profile?.plan === "Annual" ||
    profile?.plan === "3 Months" ||
    (profile?.plan !== undefined && profile?.plan !== "Free");
  const isFree = !isPro;
  const taskCount = tasks.length;
  const isTaskLimitReached = isFree && taskCount >= 5;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTaskLimitReached) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade("task_limit");
      }
      return;
    }

    if (!title.trim()) return;

    onAddTask({
      title: title.trim(),
      projectId: projectId || undefined,
      dueDate,
      priority,
      completed: false,
    });

    setTitle("");
    setProjectId("");
    setDueDate("");
    setPriority("Medium");
  };

  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.title);
    }
    return map;
  }, [projects]);

  const getProjectTitle = (pId?: string) => {
    if (!pId) return "";
    return projectMap.get(pId) || "";
  };

  const { activeTasks, completedTasks } = useMemo(() => {
    const filtered = tasks.filter((t) => {
      const matchesProject = filterProject === "All" || t.projectId === filterProject;
      const matchesPriority = filterPriority === "All" || t.priority === filterPriority;
      return matchesProject && matchesPriority;
    });

    const active = filtered.filter((t) => !t.completed);
    const completed = filtered.filter((t) => t.completed);
    return { activeTasks: active, completedTasks: completed };
  }, [tasks, filterProject, filterPriority]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Total Tasks
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-900">{taskCount}</span>
            <span className="text-[11px] text-indigo-600 font-semibold">Workspace</span>
          </div>
        </div>

        {/* Entitlement Task Limit Card */}
        <div
          className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all ${
            isTaskLimitReached
              ? "border-amber-300 ring-1 ring-amber-400/20 bg-amber-50/20"
              : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Tasks
            </span>
            {isTaskLimitReached ? (
              <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md">
                Limit reached
              </span>
            ) : isPro ? (
              <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-md">
                Pro
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-md">
                Free Plan
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span
              className={`text-xl font-extrabold ${
                isTaskLimitReached ? "text-amber-600" : isPro ? "text-slate-900" : "text-slate-900"
              }`}
            >
              {isPro ? "Unlimited" : `${taskCount} / 5`}
            </span>
            <span
              className={`text-[11px] font-semibold ${
                isPro
                  ? "text-indigo-600"
                  : isTaskLimitReached
                  ? "text-amber-600 font-bold"
                  : "text-slate-500"
              }`}
            >
              {isPro ? "Pro" : isTaskLimitReached ? "Limit reached" : "Available"}
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Active / Todo
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-blue-600">
              {activeTasks.length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">In Progress</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Completed
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-emerald-600">
              {completedTasks.length}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold">Done</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Task Creation & Filters (Sidebar-ish) */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl glass-panel">
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <KanbanSquare size={16} className="text-indigo-500" />
              <span>Create Action Task</span>
            </h3>

            {isTaskLimitReached && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">Task limit reached (5/5)</p>
                    <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                      You've reached the 5-task limit on the Free plan. Upgrade to Pro to create unlimited tasks and manage your work without limits.
                    </p>
                  </div>
                </div>
                {onTriggerUpgrade && (
                  <button
                    type="button"
                    onClick={() => onTriggerUpgrade("task_limit")}
                    className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Sparkles size={12} />
                    <span>Upgrade to Pro for Unlimited Tasks</span>
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  placeholder="e.g. Write design brief / upload proposal..."
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">
                  Assign to Project <span className="font-normal text-[10px] text-slate-400">(Optional)</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full py-2 px-3 glass-input rounded-xl text-slate-850 text-xs focus:outline-none"
                >
                  <option value="">Independent Task</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-md cursor-pointer ${
                  isTaskLimitReached
                    ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/10"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10"
                }`}
              >
                {isTaskLimitReached ? (
                  <>
                    <Sparkles size={14} />
                    <span>+ Add Task (Limit Reached - Upgrade)</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Add Task</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Filters Panel */}
          <div className="p-5 rounded-2xl glass-panel text-xs">
            <h4 className="font-bold text-slate-800 mb-3 uppercase tracking-wider">
              Quick Filters
            </h4>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1">Project Match</label>
                <select
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
                  className="w-full py-1.5 px-2 glass-input rounded-lg text-xs"
                >
                  <option value="All">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Priority Level</label>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="w-full py-1.5 px-2 glass-input rounded-lg text-xs"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Task List Grid Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active Checklist */}
          <div className="p-5 rounded-2xl glass-panel">
            <div className="flex items-center justify-between border-b border-black/5 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <span>Todo Checklist</span>
                <span className="text-xs bg-indigo-500/10 px-2 py-0.5 rounded-full text-indigo-600">
                  {activeTasks.length} left
                </span>
              </h3>
            </div>

            {activeTasks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center justify-center">
                <Check className="w-8 h-8 text-indigo-400/80 mb-2 border border-indigo-200/50 p-1 rounded-full animate-bounce" />
                <span>Excellent! No outstanding tasks listed for matching criteria.</span>
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                <AnimatePresence mode="popLayout">
                  {activeTasks.map((t) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, x: 20 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      key={t.id}
                      className="flex items-start justify-between gap-3 py-3 group"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleTask(t.id, true)}
                          className="p-1 px-1.5 border border-white/20 hover:text-indigo-600 hover:border-indigo-500 rounded-lg transition-colors mt-0.5 cursor-pointer"
                        >
                          <Square size={15} />
                        </button>
                        <div>
                          <p className="text-sm font-bold text-slate-800 leading-tight">
                            {t.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                            {t.projectId && (
                              <span className="bg-indigo-500/10 text-indigo-600 px-1.5 py-0.5 rounded-md">
                                {getProjectTitle(t.projectId)}
                              </span>
                            )}
                            {t.dueDate && (
                              <span className="flex items-center gap-1 text-slate-450">
                                <Calendar size={11} />
                                <span>{new Date(t.dueDate).toLocaleDateString()}</span>
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded-md ${
                                t.priority === "High"
                                  ? "bg-red-500/10 text-red-650 font-semibold"
                                  : t.priority === "Medium"
                                  ? "bg-amber-500/10 text-amber-655"
                                  : "bg-slate-500/10 text-slate-400"
                              }`}
                            >
                              {t.priority} priority
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteTask(t.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Completed Checklist */}
          {completedTasks.length > 0 && (
            <div className="p-5 rounded-2xl glass-panel opacity-75 hover:opacity-100 transition-opacity">
              <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest border-b border-black/5 pb-2 mb-3">
                Completed Tasks ({completedTasks.length})
              </h3>

              <div className="divide-y divide-black/5">
                <AnimatePresence mode="popLayout">
                  {completedTasks.map((t) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                      key={t.id}
                      className="flex items-center justify-between gap-3 py-2.5 group"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleTask(t.id, false)}
                          className="text-emerald-500 hover:text-slate-400 p-0.5 cursor-pointer"
                        >
                          <CheckSquare size={16} />
                        </button>
                        <span className="text-xs text-slate-400 line-through">
                          {t.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteTask(t.id)}
                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(TasksView);
