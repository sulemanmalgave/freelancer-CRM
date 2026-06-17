import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  CheckSquare,
  FileText,
  TrendingUp,
  FolderUp,
  Settings as SettingsIcon,
  Search,
  Sparkles,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudCheck,
  Menu,
  X,
  Coins,
  Star,
  Zap
} from "lucide-react";

// Types
import { FreelancerProfile, Client, Project, Task, Invoice, Lead, DocumentRecord } from "./types";

// Firebase Services
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";

// UI Views
import Onboarding from "./components/Onboarding";
import UpgradeModal from "./components/UpgradeModal";
import DashboardView from "./components/DashboardView";
import ClientsView from "./components/ClientsView";
import ProjectsView from "./components/ProjectsView";
import TasksView from "./components/TasksView";
import InvoicesView from "./components/InvoicesView";
import LeadsView from "./components/LeadsView";
import RevenueView from "./components/RevenueView";
import DocumentsView from "./components/DocumentsView";
import SettingsView from "./components/SettingsView";

export default function App() {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // System states
  const [activeView, setActiveView] = useState("Dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"syncing" | "synced" | "offline">("synced");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Upgrade Modal triggers
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  const triggerUpgrade = (reason: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  };

  // 1. Initial State Bootstrap from Local Caching
  useEffect(() => {
    // Profile & CRM State Bootstrap
    try {
      const cachedProfile = localStorage.getItem("crm_profile");
      if (cachedProfile) {
        const parsedProfile = JSON.parse(cachedProfile);
        setProfile(parsedProfile);

        // Load cached entities to boot instantly
        setClients(JSON.parse(localStorage.getItem(`crm_clients_${parsedProfile.id}`) || "[]"));
        setProjects(JSON.parse(localStorage.getItem(`crm_projects_${parsedProfile.id}`) || "[]"));
        setTasks(JSON.parse(localStorage.getItem(`crm_tasks_${parsedProfile.id}`) || "[]"));
        setInvoices(JSON.parse(localStorage.getItem(`crm_invoices_${parsedProfile.id}`) || "[]"));
        setLeads(JSON.parse(localStorage.getItem(`crm_leads_${parsedProfile.id}`) || "[]"));
        setDocuments(JSON.parse(localStorage.getItem(`crm_documents_${parsedProfile.id}`) || "[]"));
      }
    } catch (e) {
      console.error("Local Storage bootstrap failed", e);
    }
  }, []);

  // 2. Active Firestore Pull for Cloud Syncing (Asynchronous background)
  useEffect(() => {
    if (!profile?.id) return;

    const pullCloudData = async () => {
      setCloudSyncStatus("syncing");
      try {
        const freelancerId = profile.id;

        // Fetch profile updates (for plan synced status)
        const profileSnap = await getDoc(doc(db, "freelancers", freelancerId));
        if (profileSnap.exists()) {
          const freshProfile = profileSnap.data() as FreelancerProfile;
          setProfile(freshProfile);
          localStorage.setItem("crm_profile", JSON.stringify(freshProfile));
        }

        const buildQuery = (col: string) => query(collection(db, col), where("freelancerId", "==", freelancerId));

        // Background fetching
        const [clientsSnap, projectsSnap, tasksSnap, invoicesSnap, leadsSnap, docsSnap] = await Promise.all([
          getDocs(buildQuery("clients")),
          getDocs(buildQuery("projects")),
          getDocs(buildQuery("tasks")),
          getDocs(buildQuery("invoices")),
          getDocs(buildQuery("leads")),
          getDocs(buildQuery("documents")),
        ]);

        const pulledClients = clientsSnap.docs.map((d) => d.data() as Client);
        const pulledProjects = projectsSnap.docs.map((d) => d.data() as Project);
        const pulledTasks = tasksSnap.docs.map((d) => d.data() as Task);
        const pulledInvoices = invoicesSnap.docs.map((d) => d.data() as Invoice);
        const pulledLeads = leadsSnap.docs.map((d) => d.data() as Lead);
        const pulledDocuments = docsSnap.docs.map((d) => d.data() as DocumentRecord);

        // Update local state and disk caches
        setClients(pulledClients);
        localStorage.setItem(`crm_clients_${freelancerId}`, JSON.stringify(pulledClients));

        setProjects(pulledProjects);
        localStorage.setItem(`crm_projects_${freelancerId}`, JSON.stringify(pulledProjects));

        setTasks(pulledTasks);
        localStorage.setItem(`crm_tasks_${freelancerId}`, JSON.stringify(pulledTasks));

        setInvoices(pulledInvoices);
        localStorage.setItem(`crm_invoices_${freelancerId}`, JSON.stringify(pulledInvoices));

        setLeads(pulledLeads);
        localStorage.setItem(`crm_leads_${freelancerId}`, JSON.stringify(pulledLeads));

        setDocuments(pulledDocuments);
        localStorage.setItem(`crm_documents_${freelancerId}`, JSON.stringify(pulledDocuments));

        setCloudSyncStatus("synced");
      } catch (err) {
        console.warn("Unable to pull cloud sync parameters. Working offline mode.", err);
        setCloudSyncStatus("offline");
      }
    };

    pullCloudData();
  }, [profile?.id]);

  // Helper: Persist specific entity locally + Firestore push
  const saveEntity = async <T extends { id: string; freelancerId: string }>(
    collectionName: string,
    updatedList: T[],
    targetItem: T,
    operation: "set" | "delete" = "set"
  ) => {
    if (!profile) return;
    const cacheKey = `crm_${collectionName}_${profile.id}`;

    // Update localStorage instantly
    localStorage.setItem(cacheKey, JSON.stringify(updatedList));

    // Async push to firebase Firestore
    setCloudSyncStatus("syncing");
    try {
      if (operation === "set") {
        await setDoc(doc(db, collectionName, targetItem.id), targetItem);
      } else {
        await deleteDoc(doc(db, collectionName, targetItem.id));
      }
      setCloudSyncStatus("synced");
    } catch (e) {
      console.warn(`Local save complete. Failed background Cloud writing for: ${collectionName}`, e);
      setCloudSyncStatus("offline");
    }
  };

  // 3. Operational State Mutators

  const handleOnboardingComplete = async (newProfile: FreelancerProfile) => {
    setProfile(newProfile);
    localStorage.setItem("crm_profile", JSON.stringify(newProfile));

    try {
      setCloudSyncStatus("syncing");
      await setDoc(doc(db, "freelancers", newProfile.id), newProfile);
      setCloudSyncStatus("synced");
    } catch {
      setCloudSyncStatus("offline");
    }
  };

  const handleUpdateProfile = async (updatedFields: Partial<FreelancerProfile>) => {
    if (!profile) return;
    const merged = { ...profile, ...updatedFields };
    setProfile(merged);
    localStorage.setItem("crm_profile", JSON.stringify(merged));

    try {
      setCloudSyncStatus("syncing");
      await setDoc(doc(db, "freelancers", profile.id), merged);
      setCloudSyncStatus("synced");
    } catch {
      setCloudSyncStatus("offline");
    }
  };

  // Clients Mutators
  const handleAddClient = (fields: Omit<Client, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newClient: Client = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...clients, newClient];
    setClients(newList);
    saveEntity("clients", newList, newClient);
  };

  const handleUpdateClient = (id: string, fields: Partial<Client>) => {
    const updated = clients.map((c) => (c.id === id ? { ...c, ...fields } : c));
    setClients(updated);
    const item = updated.find((c) => c.id === id);
    if (item) saveEntity("clients", updated, item);
  };

  const handleDeleteClient = (id: string) => {
    const newList = clients.filter((c) => c.id !== id);
    setClients(newList);
    saveEntity("clients", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Projects Mutators
  const handleAddProject = (fields: Omit<Project, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newProject: Project = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...projects, newProject];
    setProjects(newList);
    saveEntity("projects", newList, newProject);
  };

  const handleUpdateProject = (id: string, fields: Partial<Project>) => {
    const updated = projects.map((p) => (p.id === id ? { ...p, ...fields } : p));
    setProjects(updated);
    const item = updated.find((p) => p.id === id);
    if (item) saveEntity("projects", updated, item);
  };

  const handleDeleteProject = (id: string) => {
    const newList = projects.filter((p) => p.id !== id);
    setProjects(newList);
    saveEntity("projects", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Tasks Mutators
  const handleAddTask = (fields: Omit<Task, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newTask: Task = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [newTask, ...tasks];
    setTasks(newList);
    saveEntity("tasks", newList, newTask);
  };

  const handleToggleTask = (id: string, completed: boolean) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed } : t));
    setTasks(updated);
    const item = updated.find((t) => t.id === id);
    if (item) saveEntity("tasks", updated, item);
  };

  const handleDeleteTask = (id: string) => {
    const newList = tasks.filter((t) => t.id !== id);
    setTasks(newList);
    saveEntity("tasks", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Invoices Mutators
  const handleAddInvoice = (fields: Omit<Invoice, "id" | "freelancerId" | "createdAt" | "invoiceNumber">) => {
    if (!profile) return;

    // Sequential base invoice indexing
    const nextSeq = String(invoices.length + 1).padStart(3, "0");
    const newInvoice: Invoice = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      invoiceNumber: `INV-${nextSeq}`,
      createdAt: new Date().toISOString(),
    };
    const newList = [newInvoice, ...invoices];
    setInvoices(newList);
    saveEntity("invoices", newList, newInvoice);
  };

  const handleUpdateInvoice = (id: string, fields: Partial<Invoice>) => {
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, ...fields } : inv));
    setInvoices(updated);
    const item = updated.find((inv) => inv.id === id);
    if (item) saveEntity("invoices", updated, item);
  };

  const handleDeleteInvoice = (id: string) => {
    const newList = invoices.filter((inv) => inv.id !== id);
    setInvoices(newList);
    saveEntity("invoices", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Leads Mutators
  const handleAddLead = (fields: Omit<Lead, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newLead: Lead = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...leads, newLead];
    setLeads(newList);
    saveEntity("leads", newList, newLead);
  };

  const handleUpdateLead = (id: string, fields: Partial<Lead>) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, ...fields } : l));
    setLeads(updated);
    const item = updated.find((l) => l.id === id);
    if (item) saveEntity("leads", updated, item);
  };

  const handleDeleteLead = (id: string) => {
    const newList = leads.filter((l) => l.id !== id);
    setLeads(newList);
    saveEntity("leads", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Convert Lead to Verified Client (Delightful business convert helper)
  const handleConvertToClient = (lead: Lead) => {
    if (profile?.plan === "Free" && clients.length >= 20) {
      triggerUpgrade("client_limit");
      return;
    }

    // 1. Add Client
    handleAddClient({
      companyName: lead.companyName || `${lead.name}'s Corporate Operations`,
      contactPerson: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      notes: `Converted directly from leads funnel. Source: ${lead.source}. Initial notes: ${lead.notes}`,
      status: "Active",
    });

    // 2. Mark Lead as Won/Awarded
    handleUpdateLead(lead.id, { status: "Won" });
  };

  // Documents mutators
  const handleAddDocument = (fields: Omit<DocumentRecord, "id" | "freelancerId" | "uploadDate" | "createdAt">) => {
    if (!profile) return;
    const newDoc: DocumentRecord = {
      ...fields,
      id: crypto.randomUUID(),
      freelancerId: profile.id,
      uploadDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    const newList = [newDoc, ...documents];
    setDocuments(newList);
    saveEntity("documents", newList, newDoc);
  };

  const handleDeleteDocument = (id: string) => {
    const newList = documents.filter((doc) => doc.id !== id);
    setDocuments(newList);
    saveEntity("documents", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  };

  // Render Setup Router
  if (!profile || !profile.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  // Quick triggers from deep dashboard shortcuts
  const handleQuickAddAction = (action: string) => {
    if (action === "client") {
      setActiveView("Clients");
    } else if (action === "project") {
      setActiveView("Projects");
    } else if (action === "invoice") {
      setActiveView("Invoices");
    }
  };

  const menuItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Clients", icon: Users },
    { name: "Projects", icon: FolderGit2 },
    { name: "Tasks", icon: CheckSquare },
    { name: "Invoices", icon: FileText },
    { name: "Leads", icon: Star },
    { name: "Revenue", icon: TrendingUp },
    { name: "Documents", icon: FolderUp },
    { name: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors antialiased font-sans relative overflow-x-hidden">
      {/* Background ambient lighting blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/10 via-slate-50/40 to-emerald-50/5 dark:from-indigo-950/20 dark:via-slate-950 dark:to-emerald-950/20 z-0 pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/10 dark:bg-blue-600/15 rounded-full blur-[130px] z-0 pointer-events-none animate-pulse" style={{ animationDuration: '10s' }}></div>
      <div className="absolute bottom-[10%] right-[-5%] w-[45%] h-[45%] bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-[130px] z-0 pointer-events-none animate-pulse" style={{ animationDuration: '14s' }}></div>
      <div className="absolute top-[35%] right-[20%] w-[35%] h-[35%] bg-purple-400/5 dark:bg-purple-600/10 rounded-full blur-[100px] z-0 pointer-events-none"></div>

      {/* Side Rail View (Left on desktops/tablets, hidden/drawer on mobile) */}
      <aside className="hidden md:flex flex-col w-64 glass-aside shrink-0 select-none pb-6 no-print z-10">
        {/* Brand identity */}
        <div className="p-6 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-550/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white leading-none">
                Freelancer CRM
              </h1>
              <span className="text-[10px] text-slate-405 dark:text-slate-400 mt-1 block">Operations Center</span>
            </div>
          </div>
        </div>

        {/* Dynamic Sync & plan badge */}
        <div className="px-5 py-3 border-b border-white/10 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cloudSyncStatus === "synced" && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold uppercase tracking-wider">
                  Cloud Synced
                </span>
              </>
            )}
            {cloudSyncStatus === "syncing" && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></div>
                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">
                  Syncing...
                </span>
              </>
            )}
            {cloudSyncStatus === "offline" && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                  Offline Buffer
                </span>
              </>
            )}
          </div>

          <span
            onClick={() => {
              if (profile.plan === "Free") triggerUpgrade("upgrade_badge_click");
            }}
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer transition-all ${
              profile.plan === "Pro"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-indigo-100 text-indigo-805 hover:bg-indigo-600 hover:text-white"
            }`}
          >
            {profile.plan} Plan
          </span>
        </div>

        {/* Primary nav items */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveView(item.name);
                  setSearchTerm("");
                }}
                className={`w-full flex items-center gap-3 py-2 px-3.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-indigo-600/15 dark:bg-white/10 text-indigo-650 dark:text-white border border-indigo-500/20 dark:border-white/10 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info (humble and useful, no telemetries) */}
        <div className="px-6 text-[10px] text-slate-400">
          <span>Signed: {profile.name}</span>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden glass-aside border-b border-white/10 flex items-center justify-between p-4 px-5 select-none no-print z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-650 text-white rounded-lg">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-xs tracking-tight text-slate-900 dark:text-white block">
              Freelancer CRM
            </span>
            <span className="text-[9px] text-slate-450">Ops Console</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.plan === "Free" && (
            <button
              onClick={() => triggerUpgrade("mobile_header")}
              className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
            >
              Upgrade
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-500"
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-modal border-b border-white/15 px-4 py-4 space-y-1.5 z-30 relative select-none no-print"
          >
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveView(item.name);
                    setSearchTerm("");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all ${
                    isActive ? "bg-indigo-650 text-white" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Application Body */}
      <main className="flex-1 flex flex-col p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-hidden z-10">
        {/* Dynamic Control Top Search and Meta metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/10 pb-5 no-print">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeView}
            </h1>
            <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 font-medium">
              {profile.businessName ? `${profile.businessName} Portal` : "Freelancer Workspace Dashboard"}{" "}
              &middot; Account ID: <span className="font-mono text-[10px]">{profile.id.substring(0, 8)}</span>
            </p>
          </div>

          {/* Search box (Active on view specific checks) */}
          {["Clients", "Projects", "Invoices", "Leads"].includes(activeView) && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={`Search ${activeView.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs py-2 px-3 pl-9 glass-input rounded-xl focus:outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
          )}
        </div>

        {/* View Switch Router */}
        <div className="flex-1">
          {activeView === "Dashboard" && (
            <DashboardView
              clients={clients}
              projects={projects}
              invoices={invoices}
              leads={leads}
              currency={profile.currency}
              onNavigate={setActiveView}
              onQuickAdd={handleQuickAddAction}
            />
          )}

          {activeView === "Clients" && (
            <ClientsView
              clients={clients}
              profile={profile}
              searchTerm={searchTerm}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              onTriggerUpgrade={triggerUpgrade}
            />
          )}

          {activeView === "Projects" && (
            <ProjectsView
              projects={projects}
              clients={clients}
              profile={profile}
              searchTerm={searchTerm}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onTriggerUpgrade={triggerUpgrade}
            />
          )}

          {activeView === "Tasks" && (
            <TasksView
              tasks={tasks}
              projects={projects}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeView === "Invoices" && (
            <InvoicesView
              invoices={invoices}
              clients={clients}
              profile={profile}
              searchTerm={searchTerm}
              onAddInvoice={handleAddInvoice}
              onUpdateInvoice={handleUpdateInvoice}
              onDeleteInvoice={handleDeleteInvoice}
              onTriggerUpgrade={triggerUpgrade}
            />
          )}

          {activeView === "Leads" && (
            <LeadsView
              leads={leads}
              currency={profile.currency}
              searchTerm={searchTerm}
              onAddLead={handleAddLead}
              onUpdateLead={handleUpdateLead}
              onDeleteLead={handleDeleteLead}
              onConvertToClient={handleConvertToClient}
            />
          )}

          {activeView === "Revenue" && (
            <RevenueView invoices={invoices} profile={profile} onTriggerUpgrade={triggerUpgrade} />
          )}

          {activeView === "Documents" && (
            <DocumentsView
              documents={documents}
              profile={profile}
              onAddDocument={handleAddDocument}
              onDeleteDocument={handleDeleteDocument}
              onTriggerUpgrade={triggerUpgrade}
            />
          )}

          {activeView === "Settings" && (
            <SettingsView
              profile={profile}
              onUpdateProfile={handleUpdateProfile}
              onTriggerUpgrade={triggerUpgrade}
            />
          )}
        </div>
      </main>

      {/* Upgrades Core Modal overlay (Simulating App Store and RevenueCat interfaces) */}
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        profile={profile}
        onUpgradeSuccess={(newPlan) => handleUpdateProfile({ plan: newPlan })}
        triggerReason={upgradeReason}
      />
    </div>
  );
}
