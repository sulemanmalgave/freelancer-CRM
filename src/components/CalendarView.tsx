import React, { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  CheckSquare,
  FileText,
  AlertCircle,
  Plus,
  Filter,
  CheckCircle2,
  CalendarDays,
  List,
  User,
  Star,
  Receipt,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Edit2,
  Trash2,
} from "lucide-react";
import { FollowUp, Task, Project, Invoice, Client, Lead, FreelancerProfile } from "../types";

export interface CalendarViewProps {
  followUps?: FollowUp[];
  tasks?: Task[];
  projects?: Project[];
  invoices?: Invoice[];
  leads?: Lead[];
  clients?: Client[];
  profile?: FreelancerProfile;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenFollowUpModal: (defaultDate?: string, existingFollowUp?: FollowUp) => void;
  onToggleFollowUp: (followUp: FollowUp) => void;
  onDeleteFollowUp?: (id: string) => void;
  onToggleTask: (task: Task) => void;
  onSelectClient?: (clientId: string) => void;
  onNavigateToView?: (viewName: string) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

export type CalendarItemType = "followup" | "task" | "project" | "invoice" | "lead";

export interface CalendarEventItem {
  id: string;
  type: CalendarItemType;
  title: string;
  date: string; // YYYY-MM-DD format
  time?: string;
  clientName?: string;
  clientId?: string;
  completed?: boolean;
  priority?: string;
  amount?: number;
  statusText?: string;
  original: any;
}

// Timezone-safe date string helper (YYYY-MM-DD)
function formatDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseDateToKey(dateInput?: string): string {
  if (!dateInput) return "";
  if (typeof dateInput !== "string") return "";
  if (dateInput.includes("T")) {
    return dateInput.split("T")[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    return formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
  } catch {
    return "";
  }
}

export default function CalendarView({
  followUps = [],
  tasks = [],
  projects = [],
  invoices = [],
  leads = [],
  clients = [],
  profile,
  isLoading = false,
  error = null,
  onRetry,
  onOpenFollowUpModal,
  onToggleFollowUp,
  onDeleteFollowUp,
  onToggleTask,
  onSelectClient,
  onNavigateToView,
  onTriggerUpgrade,
}: CalendarViewProps) {
  const today = new Date();
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [viewMode, setViewMode] = useState<"month" | "agenda">("month");
  const [filterType, setFilterType] = useState<"all" | CalendarItemType>("all");
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);

  // Pro entitlement status check
  const isPro =
    profile?.premium === true ||
    profile?.plan === "Pro" ||
    profile?.plan === "Monthly" ||
    profile?.plan === "3 Months" ||
    (profile?.plan !== undefined && profile?.plan !== "Free");
  const isFree = !isPro;
  const followUpCount = (followUps || []).length;
  const isFollowUpLimitReached = isFree && followUpCount >= 5;

  const handleScheduleClick = (defaultDate?: string) => {
    if (isFollowUpLimitReached) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade("followup_limit");
      } else {
        onOpenFollowUpModal(defaultDate);
      }
      return;
    }
    onOpenFollowUpModal(defaultDate);
  };

  // Month navigation helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Aggregate all CRM events with dates safely using useMemo
  const allEvents: CalendarEventItem[] = useMemo(() => {
    const list: CalendarEventItem[] = [];

    // Client map for instant lookup
    const clientMap = new Map<string, Client>();
    (clients || []).forEach((c) => {
      if (c && c.id) clientMap.set(c.id, c);
    });

    // 1. Follow-ups
    (followUps || []).forEach((f) => {
      if (!f || !f.dueDate) return;
      const client = f.clientId ? clientMap.get(f.clientId) : undefined;
      const dateKey = parseDateToKey(f.dueDate);
      if (!dateKey) return;

      const timePart = f.dueDate.includes("T") ? f.dueDate.split("T")[1]?.slice(0, 5) : undefined;
      list.push({
        id: `fu-${f.id}`,
        type: "followup",
        title: f.title || "Follow-up",
        date: dateKey,
        time: timePart,
        clientName: client?.companyName || client?.contactPerson,
        clientId: f.clientId,
        completed: f.status === "completed",
        priority: f.priority || "medium",
        original: f,
      });
    });

    // 2. Tasks
    (tasks || []).forEach((t) => {
      if (!t || !t.dueDate) return;
      const client = t.clientId ? clientMap.get(t.clientId) : undefined;
      const dateKey = parseDateToKey(t.dueDate);
      if (!dateKey) return;

      list.push({
        id: `t-${t.id}`,
        type: "task",
        title: t.title || "Task",
        date: dateKey,
        clientName: client?.companyName,
        clientId: t.clientId,
        completed: !!t.completed,
        priority: t.priority?.toLowerCase() || "medium",
        original: t,
      });
    });

    // 3. Projects Deadlines
    (projects || []).forEach((p) => {
      if (!p || !p.deadline) return;
      const client = p.clientId ? clientMap.get(p.clientId) : undefined;
      const dateKey = parseDateToKey(p.deadline);
      if (!dateKey) return;

      list.push({
        id: `p-${p.id}`,
        type: "project",
        title: `Project Deadline: ${p.title || "Untitled"}`,
        date: dateKey,
        clientName: client?.companyName,
        clientId: p.clientId,
        completed: p.status === "Completed",
        statusText: p.status,
        original: p,
      });
    });

    // 4. Invoices Due Date
    (invoices || []).forEach((inv) => {
      if (!inv || !inv.dueDate) return;
      const client = inv.clientId ? clientMap.get(inv.clientId) : undefined;
      const dateKey = parseDateToKey(inv.dueDate);
      if (!dateKey) return;

      const total = (inv.services || []).reduce(
        (sum, s) => sum + (Number(s.quantity) || 0) * (Number(s.rate) || 0),
        0
      );
      list.push({
        id: `inv-${inv.id}`,
        type: "invoice",
        title: `Invoice #${inv.invoiceNumber || ""} Due`,
        date: dateKey,
        clientName: client?.companyName,
        clientId: inv.clientId,
        completed: inv.status === "Paid",
        statusText: inv.status,
        amount: total,
        original: inv,
      });
    });

    // 5. Leads Follow-up Dates
    (leads || []).forEach((lead) => {
      if (!lead || !lead.followUpDate) return;
      const dateKey = parseDateToKey(lead.followUpDate);
      if (!dateKey) return;

      list.push({
        id: `lead-${lead.id}`,
        type: "lead",
        title: `Lead Follow-up: ${lead.name || lead.companyName || "Prospective Lead"}`,
        date: dateKey,
        clientName: lead.companyName || lead.name,
        completed: lead.status === "Won" || lead.status === "Lost",
        statusText: lead.status,
        original: lead,
      });
    });

    return list;
  }, [followUps, tasks, projects, invoices, leads, clients]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (filterType === "all") return allEvents;
    return allEvents.filter((ev) => ev.type === filterType);
  }, [allEvents, filterType]);

  // Generate Month Grid days safely without timezone shift
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    // Previous month padding
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dateStr = formatDateKey(prevYear, prevMonthIdx, d);
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayKey,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = formatDateKey(year, month, i);
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: true,
        isToday: dateStr === todayKey,
      });
    }

    // Next month padding to fill a clean 35 or 42 grid
    const nextYear = month === 11 ? year + 1 : year;
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const targetCellCount = days.length > 35 ? 42 : 35;
    const remainingCells = targetCellCount - days.length;

    for (let i = 1; i <= remainingCells; i++) {
      const dateStr = formatDateKey(nextYear, nextMonthIdx, i);
      days.push({
        dateStr,
        dayNum: i,
        isCurrentMonth: false,
        isToday: dateStr === todayKey,
      });
    }

    return days;
  }, [year, month, todayKey]);

  const getEventBadgeClass = (type: CalendarItemType, completed?: boolean) => {
    if (completed) {
      return "bg-slate-100 text-slate-500 line-through border-slate-200";
    }
    switch (type) {
      case "followup":
        return "bg-amber-50 text-amber-700 border-amber-200 font-semibold";
      case "task":
        return "bg-blue-50 text-blue-700 border-blue-200 font-semibold";
      case "project":
        return "bg-purple-50 text-purple-700 border-purple-200 font-bold";
      case "invoice":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold";
      case "lead":
        return "bg-pink-50 text-pink-700 border-pink-200 font-semibold";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getEventIcon = (type: CalendarItemType) => {
    switch (type) {
      case "followup":
        return <Clock size={12} className="text-amber-500 shrink-0" />;
      case "task":
        return <CheckSquare size={12} className="text-blue-500 shrink-0" />;
      case "project":
        return <Briefcase size={12} className="text-purple-500 shrink-0" />;
      case "invoice":
        return <Receipt size={12} className="text-emerald-500 shrink-0" />;
      case "lead":
        return <Star size={12} className="text-pink-500 shrink-0" />;
      default:
        return <CalendarIcon size={12} className="text-slate-500 shrink-0" />;
    }
  };

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((ev) => ev.date === selectedDay);
  }, [filteredEvents, selectedDay]);

  // Selected date formatted for display
  const selectedDateDisplay = useMemo(() => {
    try {
      const [y, m, d] = selectedDay.split("-").map(Number);
      if (!y || !m || !d) return selectedDay;
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return selectedDay;
    }
  }, [selectedDay]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Error state notification if data fetch fails */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-800 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <div>
              <span className="font-bold">Sync warning:</span> {error}
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer"
            >
              <RefreshCw size={12} />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Calendar & Schedule
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Stay organized and keep track of important deadlines, tasks and follow-ups.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "month"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <CalendarDays size={13} />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "agenda"
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <List size={13} />
              <span>Agenda</span>
            </button>
          </div>

          <button
            onClick={() => handleScheduleClick(selectedDay)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-indigo-500/20"
          >
            <Plus size={14} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Overview Statistics / Top Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Total Scheduled
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-slate-900">{allEvents.length}</span>
            <span className="text-[11px] text-indigo-600 font-semibold">Across CRM</span>
          </div>
        </div>
        <div
          className={`p-3.5 bg-white border rounded-2xl shadow-xs transition-all ${
            isFollowUpLimitReached
              ? "border-amber-300 ring-1 ring-amber-400/20 bg-amber-50/20"
              : "border-slate-200/80"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Follow-ups
            </span>
            {isFollowUpLimitReached ? (
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
                isFollowUpLimitReached ? "text-amber-600" : isPro ? "text-slate-900" : "text-amber-600"
              }`}
            >
              {isPro ? "Unlimited" : `${followUpCount} / 5`}
            </span>
            <span
              className={`text-[11px] font-semibold ${
                isPro
                  ? "text-indigo-600"
                  : isFollowUpLimitReached
                  ? "text-amber-600 font-bold"
                  : "text-slate-500"
              }`}
            >
              {isPro ? "Pro" : isFollowUpLimitReached ? "Limit reached" : "Available"}
            </span>
          </div>
        </div>
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Task Deadlines
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-blue-600">
              {allEvents.filter((e) => e.type === "task" && !e.completed).length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Open Tasks</span>
          </div>
        </div>
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Project Deadlines
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-extrabold text-purple-600">
              {allEvents.filter((e) => e.type === "project" && !e.completed).length}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">Active</span>
          </div>
        </div>
      </div>

      {/* Filter Row and Month Navigator */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-bold text-slate-900 min-w-36 text-center select-none">
            {monthNames[month]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            title="Next Month"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={todayMonth}
            className={`ml-2 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              selectedDay === todayKey && month === today.getMonth() && year === today.getFullYear()
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : "text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Today
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(
            [
              { id: "all", label: "All Items", count: allEvents.length },
              { id: "followup", label: "Follow-ups", count: allEvents.filter((e) => e.type === "followup").length },
              { id: "task", label: "Tasks", count: allEvents.filter((e) => e.type === "task").length },
              { id: "project", label: "Projects", count: allEvents.filter((e) => e.type === "project").length },
              { id: "invoice", label: "Invoices", count: allEvents.filter((e) => e.type === "invoice").length },
              { id: "lead", label: "Leads", count: allEvents.filter((e) => e.type === "lead").length },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilterType(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterType === filter.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100 border border-transparent"
              }`}
            >
              <span>{filter.label}</span>
              {filter.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    filterType === filter.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Lightweight Loading Skeleton Overlay (if fetching data) */}
      {isLoading && (
        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600 animate-pulse">
          <RefreshCw size={13} className="animate-spin" />
          <span>Updating calendar schedule...</span>
        </div>
      )}

      {/* Main View Grid / Agenda */}
      {viewMode === "month" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Month Calendar Grid (3 Columns on Large screens) */}
          <div className="lg:col-span-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs overflow-hidden">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 select-none">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Cells */}
            <div className="grid grid-cols-7 gap-1.5 mt-2">
              {calendarDays.map((cell, idx) => {
                const dayEvents = filteredEvents.filter((ev) => ev.date === cell.dateStr);
                const isSelected = selectedDay === cell.dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(cell.dateStr)}
                    className={`min-h-20 sm:min-h-24 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20"
                        : cell.isToday
                        ? "bg-amber-50/50 border-amber-300"
                        : cell.isCurrentMonth
                        ? "bg-white hover:bg-slate-50 border-slate-200/70"
                        : "bg-slate-50/50 border-slate-100 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          cell.isToday
                            ? "bg-indigo-600 text-white font-black"
                            : isSelected
                            ? "bg-indigo-200 text-indigo-900 font-extrabold"
                            : cell.isCurrentMonth
                            ? "text-slate-800"
                            : "text-slate-400"
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1 rounded">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Preview Pills */}
                    <div className="space-y-1 mt-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[10px] px-1.5 py-0.5 rounded-md border truncate leading-tight ${getEventBadgeClass(
                            ev.type,
                            ev.completed
                          )}`}
                          title={`${ev.title} (${ev.date})`}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] font-bold text-slate-500 block px-0.5">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Details Sidebar (1 Column on Large screens) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{selectedDateDisplay}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {selectedDayEvents.length} scheduled event
                    {selectedDayEvents.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleScheduleClick(selectedDay)}
                  className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                  title="Add follow-up for this day"
                >
                  <Plus size={15} />
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-slate-100/90 my-2">
                  <div className="w-10 h-10 bg-white rounded-xl mx-auto flex items-center justify-center text-slate-400 border border-slate-200/80 mb-2.5 shadow-xs">
                    <Clock size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">No events on this day</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Click the + button above to schedule a client follow-up or create a task.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleScheduleClick(selectedDay)}
                    className="mt-3.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Add Follow-up</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  {selectedDayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                        ev.completed
                          ? "bg-slate-50 border-slate-200 opacity-65"
                          : "bg-white border-slate-200 shadow-xs hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {getEventIcon(ev.type)}
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${getEventBadgeClass(
                                ev.type,
                                ev.completed
                              )}`}
                            >
                              {ev.type}
                            </span>
                            {ev.priority && (
                              <span className="text-[9px] font-bold text-slate-400 uppercase">
                                &middot; {ev.priority}
                              </span>
                            )}
                          </div>
                          <h4
                            className={`font-bold text-slate-900 leading-snug truncate ${
                              ev.completed ? "line-through text-slate-400" : ""
                            }`}
                          >
                            {ev.title}
                          </h4>
                          {ev.clientName && (
                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1">
                              <User size={10} className="text-slate-400" />
                              <span>{ev.clientName}</span>
                            </p>
                          )}
                          {ev.time && (
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                              <Clock size={10} />
                              <span>{ev.time}</span>
                            </p>
                          )}
                          {ev.amount !== undefined && (
                            <p className="text-[11px] font-black text-emerald-700 mt-1">
                              ${ev.amount.toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* Quick complete checkboxes for actionable events */}
                        {ev.type === "followup" && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => onToggleFollowUp(ev.original)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                ev.completed
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                                  : "text-slate-400 hover:text-emerald-600 border-slate-200 hover:bg-emerald-50"
                              }`}
                              title={ev.completed ? "Mark as pending" : "Mark as completed"}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              onClick={() => onOpenFollowUpModal(undefined, ev.original)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                              title="Edit follow-up"
                            >
                              <Edit2 size={13} />
                            </button>
                            {onDeleteFollowUp && (
                              <button
                                onClick={() => {
                                  if (window.confirm("Delete this scheduled follow-up?")) {
                                    onDeleteFollowUp(ev.original.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                                title="Delete follow-up"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                        {ev.type === "task" && (
                          <button
                            onClick={() => onToggleTask(ev.original)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              ev.completed
                                ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                                : "text-slate-400 hover:text-emerald-600 border-slate-200 hover:bg-emerald-50"
                            }`}
                            title={ev.completed ? "Mark as pending" : "Mark as completed"}
                          >
                            <CheckSquare size={15} />
                          </button>
                        )}
                        {ev.clientId && onSelectClient && (
                          <button
                            onClick={() => onSelectClient(ev.clientId!)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                            title="View Client Details"
                          >
                            <ArrowRight size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Helper footer */}
            <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-400 flex items-center justify-between">
              <span>All dates local time</span>
              <button
                type="button"
                onClick={() => setSelectedDay(todayKey)}
                className="text-indigo-600 hover:underline font-bold cursor-pointer"
              >
                Go to Today
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Agenda / List View */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center max-w-md mx-auto">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center mb-3">
                <CalendarIcon size={24} />
              </div>
              <h3 className="text-sm font-black text-slate-900">No Scheduled Activities</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Your calendar is clear. Schedule client follow-ups, project milestones, or invoice payment dates.
              </p>
              <button
                onClick={() => handleScheduleClick(todayKey)}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Schedule First Follow-up</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ev) => (
                  <div
                    key={ev.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="pt-0.5">{getEventIcon(ev.type)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`px-2 py-0.2 text-[9px] font-black rounded border uppercase whitespace-nowrap ${getEventBadgeClass(
                              ev.type,
                              ev.completed
                            )}`}
                          >
                            {ev.type}
                          </span>
                          {ev.priority && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {ev.priority}
                            </span>
                          )}
                        </div>
                        <p
                          className={`font-bold text-slate-900 truncate ${
                            ev.completed ? "line-through text-slate-400" : ""
                          }`}
                        >
                          {ev.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {ev.clientName || "General Event"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-mono text-slate-700 font-bold block">{ev.date}</span>
                        {ev.time && <span className="text-[10px] text-slate-400 font-mono">{ev.time}</span>}
                      </div>

                      {ev.type === "followup" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onToggleFollowUp(ev.original)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              ev.completed
                                ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                                : "text-slate-400 hover:text-emerald-600 border-slate-200"
                            }`}
                            title={ev.completed ? "Mark pending" : "Mark completed"}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                          <button
                            onClick={() => onOpenFollowUpModal(undefined, ev.original)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                            title="Edit follow-up"
                          >
                            <Edit2 size={13} />
                          </button>
                          {onDeleteFollowUp && (
                            <button
                              onClick={() => {
                                if (window.confirm("Delete this scheduled follow-up?")) {
                                  onDeleteFollowUp(ev.original.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                              title="Delete follow-up"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}

                      {ev.type === "task" && (
                        <button
                          onClick={() => onToggleTask(ev.original)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            ev.completed
                              ? "bg-emerald-50 text-emerald-600 border-emerald-300"
                              : "text-slate-400 hover:text-emerald-600 border-slate-200"
                          }`}
                          title={ev.completed ? "Mark pending" : "Mark completed"}
                        >
                          <CheckSquare size={15} />
                        </button>
                      )}

                      {ev.clientId && onSelectClient && (
                        <button
                          onClick={() => onSelectClient(ev.clientId!)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-all cursor-pointer"
                          title="View Client Details"
                        >
                          <ArrowRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Global Empty State (if absolutely 0 events across the whole CRM) */}
      {allEvents.length === 0 && (
        <div className="p-8 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50 border border-indigo-100 rounded-3xl text-center max-w-xl mx-auto shadow-xs">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-indigo-600/20">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            Welcome to your Calendar
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto leading-relaxed">
            Stay organized and keep track of important deadlines, tasks and follow-ups.
            Any project milestones, task due dates, invoice reminders, and scheduled check-ins will automatically show up here.
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={() => handleScheduleClick(todayKey)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/15 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Schedule Follow-up</span>
            </button>
            {onNavigateToView && (
              <button
                onClick={() => onNavigateToView("Tasks")}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare size={14} />
                <span>Go to Tasks</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
