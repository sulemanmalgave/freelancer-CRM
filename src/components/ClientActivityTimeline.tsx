import { useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  FileText,
  FolderGit2,
  Mail,
  Notebook,
  Mic,
  FolderUp,
  UserPlus,
  Send,
  Clock,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Client, Project, Task, Invoice, DocumentRecord, NoteRecord, GmailThread } from "../types";

interface ClientActivityTimelineProps {
  client: Client;
  projects: Project[];
  tasks: Task[];
  invoices: Invoice[];
  documents: DocumentRecord[];
  records: NoteRecord[];
  threads?: GmailThread[];
  onNavigateTab?: (tab: string) => void;
}

interface TimelineEvent {
  id: string;
  type:
    | "client_created"
    | "note_added"
    | "voice_recording_added"
    | "project_created"
    | "task_created"
    | "task_completed"
    | "invoice_created"
    | "invoice_paid"
    | "document_uploaded"
    | "email_received"
    | "email_sent";
  title: string;
  description?: string;
  date: string;
  timestamp: number;
  badgeText?: string;
  badgeColor?: string;
  linkTab?: string;
}

export default function ClientActivityTimeline({
  client,
  projects,
  tasks,
  invoices,
  documents,
  records,
  threads = [],
  onNavigateTab,
}: ClientActivityTimelineProps) {
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    // 1. Client Creation Event
    if (client.createdAt) {
      list.push({
        id: `client-create-${client.id}`,
        type: "client_created",
        title: `Client profile created for ${client.companyName || client.contactPerson}`,
        description: `Contact: ${client.contactPerson} (${client.email || "No email"})`,
        date: client.createdAt,
        timestamp: new Date(client.createdAt).getTime(),
        badgeText: "Profile",
        badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
        linkTab: "Overview",
      });
    }

    // 2. Projects Events
    projects.forEach((proj) => {
      if (proj.createdAt) {
        list.push({
          id: `proj-create-${proj.id}`,
          type: "project_created",
          title: `Project initiated: ${proj.title}`,
          description: `Budget: ${proj.budget ? "$" + proj.budget.toLocaleString() : "TBD"} &middot; Status: ${proj.status}`,
          date: proj.createdAt,
          timestamp: new Date(proj.createdAt).getTime(),
          badgeText: proj.status,
          badgeColor:
            proj.status === "Completed"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-blue-50 text-blue-700 border-blue-200",
          linkTab: "Projects",
        });
      }
    });

    // 3. Tasks & Follow-ups Events
    tasks.forEach((task) => {
      if (task.createdAt) {
        list.push({
          id: `task-create-${task.id}`,
          type: "task_created",
          title: `Task / Follow-up logged: ${task.title}`,
          description: `Due: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"} &middot; Priority: ${task.priority}`,
          date: task.createdAt,
          timestamp: new Date(task.createdAt).getTime(),
          badgeText: task.priority + " Priority",
          badgeColor:
            task.priority === "High"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-slate-100 text-slate-700 border-slate-200",
          linkTab: "Tasks",
        });
      }
      if (task.completed) {
        list.push({
          id: `task-done-${task.id}`,
          type: "task_completed",
          title: `Task completed: ${task.title}`,
          description: `Marked as done for ${client.companyName}`,
          date: task.dueDate || task.createdAt,
          timestamp: new Date(task.dueDate || task.createdAt).getTime() + 1000,
          badgeText: "Completed",
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          linkTab: "Tasks",
        });
      }
    });

    // 4. Invoices Events
    invoices.forEach((inv) => {
      const totalAmount = (inv.services || []).reduce(
        (sum, s) => sum + (s.quantity || 0) * (s.rate || 0),
        0
      );
      if (inv.createdAt) {
        list.push({
          id: `inv-create-${inv.id}`,
          type: "invoice_created",
          title: `Invoice ${inv.invoiceNumber} generated`,
          description: `Amount: $${totalAmount.toLocaleString()} &middot; Status: ${inv.status}`,
          date: inv.createdAt,
          timestamp: new Date(inv.createdAt).getTime(),
          badgeText: inv.status,
          badgeColor:
            inv.status === "Paid"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200",
          linkTab: "Invoices",
        });
      }
      if (inv.status === "Paid") {
        list.push({
          id: `inv-paid-${inv.id}`,
          type: "invoice_paid",
          title: `Payment received for Invoice ${inv.invoiceNumber}`,
          description: `Total of $${totalAmount.toLocaleString()} verified and settled`,
          date: inv.dueDate || inv.createdAt,
          timestamp: new Date(inv.dueDate || inv.createdAt).getTime() + 2000,
          badgeText: "Paid in Full",
          badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
          linkTab: "Invoices",
        });
      }
    });

    // 5. Notes & Audio Recordings
    records.forEach((rec) => {
      if (rec.type === "voice_recording") {
        list.push({
          id: `rec-audio-${rec.id}`,
          type: "voice_recording_added",
          title: `Voice recording attached: ${rec.audioFileName || "Audio Memo"}`,
          description: rec.description || `Duration: ${rec.duration ? rec.duration + "s" : "Audio file"}`,
          date: rec.createdAt,
          timestamp: new Date(rec.createdAt).getTime(),
          badgeText: "Voice Note",
          badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
          linkTab: "Notes",
        });
      } else {
        list.push({
          id: `rec-note-${rec.id}`,
          type: "note_added",
          title: `Client note recorded: ${rec.title || "Quick Note"}`,
          description: rec.content ? rec.content.substring(0, 90) + (rec.content.length > 90 ? "..." : "") : "",
          date: rec.createdAt,
          timestamp: new Date(rec.createdAt).getTime(),
          badgeText: "Note",
          badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
          linkTab: "Notes",
        });
      }
    });

    // 6. Documents
    documents.forEach((doc) => {
      if (doc.createdAt) {
        list.push({
          id: `doc-${doc.id}`,
          type: "document_uploaded",
          title: `Document uploaded: ${doc.title}`,
          description: `Category: ${doc.category} &middot; Size: ${doc.fileSize || "File"}`,
          date: doc.createdAt,
          timestamp: new Date(doc.createdAt).getTime(),
          badgeText: doc.category,
          badgeColor: "bg-sky-50 text-sky-700 border-sky-200",
          linkTab: "Documents",
        });
      }
    });

    // 7. Gmail Threads & Messages
    threads.forEach((th) => {
      (th.messages || []).forEach((msg) => {
        const isFromClient = msg.fromEmail?.toLowerCase() === client.email?.toLowerCase();
        list.push({
          id: `email-${msg.id}`,
          type: isFromClient ? "email_received" : "email_sent",
          title: isFromClient ? `Email received: ${msg.subject}` : `Email sent: ${msg.subject}`,
          description: msg.snippet,
          date: msg.date,
          timestamp: msg.timestamp || new Date(msg.date).getTime(),
          badgeText: isFromClient ? "From Client" : "Sent by You",
          badgeColor: isFromClient
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200",
          linkTab: "Emails",
        });
      });
    });

    // Sort newest first
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list;
  }, [client, projects, tasks, invoices, documents, records, threads]);

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "client_created":
        return <UserPlus className="w-3.5 h-3.5 text-indigo-600" />;
      case "project_created":
        return <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />;
      case "task_created":
        return <Clock className="w-3.5 h-3.5 text-amber-600" />;
      case "task_completed":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "invoice_created":
        return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
      case "invoice_paid":
        return <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />;
      case "document_uploaded":
        return <FolderUp className="w-3.5 h-3.5 text-sky-600" />;
      case "note_added":
        return <Notebook className="w-3.5 h-3.5 text-indigo-600" />;
      case "voice_recording_added":
        return <Mic className="w-3.5 h-3.5 text-purple-600" />;
      case "email_received":
        return <Mail className="w-3.5 h-3.5 text-blue-600" />;
      case "email_sent":
        return <Send className="w-3.5 h-3.5 text-emerald-600" />;
      default:
        return <Calendar className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getIconBg = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "client_created":
      case "note_added":
      case "invoice_created":
        return "bg-indigo-50 border-indigo-200";
      case "project_created":
      case "email_received":
        return "bg-blue-50 border-blue-200";
      case "task_completed":
      case "invoice_paid":
      case "email_sent":
        return "bg-emerald-50 border-emerald-200";
      case "voice_recording_added":
        return "bg-purple-50 border-purple-200";
      case "document_uploaded":
        return "bg-sky-50 border-sky-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  return (
    <div className="space-y-4" id="client-activity-timeline-container">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-slate-900 tracking-tight">Client Activity Timeline</h4>
          <p className="text-[11px] text-slate-500">
            Chronological audit trail of all projects, tasks, invoices, notes, and emails for this client.
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
          {events.length} Events
        </span>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-10 px-4 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h5 className="text-xs font-bold text-slate-700">No activity logged yet</h5>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Activity events will automatically appear here as you create projects, tasks, invoices, or exchange emails.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-200/80 space-y-4 my-2">
          {events.map((evt) => (
            <div key={evt.id} className="relative group">
              {/* Dot Icon marker */}
              <div
                className={`absolute -left-[31px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center shadow-2xs ${getIconBg(
                  evt.type
                )}`}
              >
                {getEventIcon(evt.type)}
              </div>

              {/* Event card */}
              <div className="p-3 bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-xl transition-all shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-xs font-bold text-slate-900 leading-snug">{evt.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {evt.badgeText && (
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 border rounded-full ${
                          evt.badgeColor || "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {evt.badgeText}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                      {new Date(evt.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {evt.description && (
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {evt.description}
                  </p>
                )}

                {evt.linkTab && onNavigateTab && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => onNavigateTab(evt.linkTab!)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      <span>View in {evt.linkTab}</span>
                      <ArrowRight size={10} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
