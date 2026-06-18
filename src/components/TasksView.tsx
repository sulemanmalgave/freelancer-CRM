import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Check, Square, CheckSquare, Trash2, Calendar, Star, KanbanSquare, AlertCircle } from "lucide-react";
import { Task, Project } from "../types";

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (task: Omit<Task, "id" | "freelancerId" | "createdAt">) => void;
  onToggleTask: (id: string, completed: boolean) => void;
  onDeleteTask: (id: string) => void;
}

export default function TasksView({
  tasks,
  projects,
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: TasksViewProps) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("Medium");

  const [filterProject, setFilterProject] = useState<string>("All");
  const [filterPriority, setFilterPriority] = useState<string>("All");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  const getProjectTitle = (pId?: string) => {
    if (!pId) return "";
    const p = projects.find((item) => item.id === pId);
    return p ? p.title : "";
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesProject = filterProject === "All" || t.projectId === filterProject;
    const matchesPriority = filterPriority === "All" || t.priority === filterPriority;
    return matchesProject && matchesPriority;
  });

  const activeTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Task Creation & Filters (Sidebar-ish) */}
      <div className="space-y-6">
        <div className="p-5 rounded-2xl glass-panel">
          <h3 className="font-bold text-sm text-slate-805 uppercase tracking-wider mb-4 flex items-center gap-2">
            <KanbanSquare size={16} className="text-indigo-500" />
            <span>Create Action Task</span>
          </h3>

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
              <label className="block text-slate-500 font-semibold mb-1">Assign to Project <span className="font-normal text-[10px] text-slate-400">(Optional)</span></label>
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
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-md shadow-indigo-600/10"
            >
              <Plus size={14} />
              <span>Add Task</span>
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
              {activeTasks.map((t) => (
                <div key={t.id} className="flex items-start justify-between gap-3 py-3 group">
                  <div className="flex items-start gap-3">
                    <button
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
                        <span className={`px-1.5 py-0.5 rounded-md ${
                          t.priority === "High"
                            ? "bg-red-500/10 text-red-650 font-semibold"
                            : t.priority === "Medium"
                            ? "bg-amber-500/10 text-amber-655"
                            : "bg-slate-500/10 text-slate-400"
                        }`}>
                          {t.priority} priority
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTask(t.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
              {completedTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 group">
                  <div className="flex items-center gap-3">
                    <button
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
                    onClick={() => onDeleteTask(t.id)}
                    className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
