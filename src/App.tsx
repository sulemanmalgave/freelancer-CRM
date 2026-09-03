import { useState, useEffect, useCallback, lazy, Suspense } from "react";
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
  Zap,
  Download,
  Monitor,
  Notebook,
  Mail,
  Calendar as CalendarIcon,
  FileCheck2,
  Smartphone,
  ChevronRight,
  Lock,
} from "lucide-react";

const logoIcon = "/icon-192.png";

// Types
import { FreelancerProfile, Client, Project, Task, Invoice, Proposal, Lead, DocumentRecord, NoteRecord, FollowUp } from "./types";

// Firebase Services
import { db } from "./firebase";
import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where } from "firebase/firestore";

// Utilities
import { generateUUID, loadAndRecoverCollection, loadAndRecoverProfile, getOrCreatePersistentDeviceId } from "./utils";

// UI Views
import Onboarding from "./components/Onboarding";
import ConnectExistingAccount from "./components/ConnectExistingAccount";
import UpgradeModal from "./components/UpgradeModal";
import { MobileConnectModal } from "./components/MobileConnectModal";
import DashboardView from "./components/DashboardView";
import ClientsView from "./components/ClientsView";
import NotesRecordsView from "./components/NotesRecordsView";
import ProjectsView from "./components/ProjectsView";
import TasksView from "./components/TasksView";
import CalendarView from "./components/CalendarView";
import FollowUpModal from "./components/FollowUpModal";
import InvoicesView from "./components/InvoicesView";
import ProposalsView from "./components/ProposalsView";
import LeadsView from "./components/LeadsView";
import RevenueView from "./components/RevenueView";
import DocumentsView from "./components/DocumentsView";
import SettingsView from "./components/SettingsView";
import PrivacyPolicyView from "./components/PrivacyPolicyView";
import GlobalSearchModal from "./components/GlobalSearchModal";
import DataExportModal from "./components/DataExportModal";
import GmailErrorBoundary from "./components/GmailErrorBoundary";
import GmailLoadingSkeleton from "./components/GmailLoadingSkeleton";
import { canAccessGmail } from "./services/gmailEntitlement";

// Lazy-loaded Gmail View (Code splitting: loads only when Gmail is opened)
const GmailView = lazy(() => import("./components/GmailView"));

export default function App() {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<NoteRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Follow-up modal state
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpModalDefaultDate, setFollowUpModalDefaultDate] = useState<string | undefined>(undefined);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);

  const handleOpenFollowUpModal = useCallback((defaultDate?: string, existingFollowUp?: FollowUp) => {
    setFollowUpModalDefaultDate(defaultDate);
    setEditingFollowUp(existingFollowUp || null);
    setIsFollowUpModalOpen(true);
  }, []);

  // Filter state when navigating to Notes & Records from Client Details
  const [notesClientFilter, setNotesClientFilter] = useState<string>("All");
  const [targetClientIdForModal, setTargetClientIdForModal] = useState<string | undefined>(undefined);

  // Global Search Modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  // Data Export / Backup Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Mobile App Connection Modal state
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Real Gmail Unread Count for sidebar badge
  const [unreadGmailCount, setUnreadGmailCount] = useState<number>(0);

  // System states
  const [activeView, setActiveView] = useState(() => {
    return window.location.pathname === "/privacy-policy" ? "PrivacyPolicy" : "Dashboard";
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"syncing" | "synced" | "offline">("synced");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isConnectExistingOpen, setIsConnectExistingOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return Boolean(params.get("mobile_connect") || params.get("connect_code") || params.get("connect") === "existing");
    }
    return false;
  });

  // Upgrade Modal triggers
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState("");

  // Global Keyboard Shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Upgrade Modal Trigger Helper
  const triggerUpgrade = useCallback((reason: string) => {
    setUpgradeReason(reason);
    setUpgradeOpen(true);
  }, []);

  // PWA Installation state machine
  const [pwaPrompt, setPwaPrompt] = useState<any>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPwaPrompt(e);
      (window as any).deferredPrompt = e;

      const isDismissed = sessionStorage.getItem("pwa_dismissed") === "true";
      if (!isDismissed) {
        setShowPwaBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setPwaPrompt(null);
      (window as any).deferredPrompt = null;
      setShowPwaBanner(false);
      console.log("Freelancer CRM was installed successfully.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Sync view route back and forth with window location pathname
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === "/privacy-policy") {
        setActiveView("PrivacyPolicy");
      } else {
        setActiveView("Dashboard");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (activeView === "PrivacyPolicy") {
      if (window.location.pathname !== "/privacy-policy") {
        window.history.pushState(null, "", "/privacy-policy");
      }
    } else {
      if (window.location.pathname === "/privacy-policy") {
        window.history.pushState(null, "", "/");
      }
    }
  }, [activeView]);

  const triggerPwaInstall = useCallback(async () => {
    try {
      const promptEvent = pwaPrompt || (window as any).deferredPrompt;
      if (!promptEvent) return;

      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log(`User response to installation prompt: ${outcome}`);
    } catch (err) {
      console.warn("PWA prompt interaction failed or blocked:", err);
    } finally {
      setPwaPrompt(null);
      (window as any).deferredPrompt = null;
      setShowPwaBanner(false);
    }
  }, [pwaPrompt]);

  // 1. Initial State Bootstrap from Local Caching with Full Recovery Scanner
  useEffect(() => {
    try {
      const activeProfile = loadAndRecoverProfile();
      if (activeProfile) {
        setProfile(activeProfile);

        // Load and recover cached entities across any legacy or workspace-namespaced keys
        setClients(loadAndRecoverCollection<Client>("clients", activeProfile.id));
        setRecords(loadAndRecoverCollection<NoteRecord>("records", activeProfile.id));
        setProjects(loadAndRecoverCollection<Project>("projects", activeProfile.id));
        setTasks(loadAndRecoverCollection<Task>("tasks", activeProfile.id));
        setFollowUps(loadAndRecoverCollection<FollowUp>("followups", activeProfile.id));
        setInvoices(loadAndRecoverCollection<Invoice>("invoices", activeProfile.id));
        setProposals(loadAndRecoverCollection<Proposal>("proposals", activeProfile.id));
        setLeads(loadAndRecoverCollection<Lead>("leads", activeProfile.id));
        setDocuments(loadAndRecoverCollection<DocumentRecord>("documents", activeProfile.id));
      }
    } catch (e) {
      console.error("Local Storage bootstrap & recovery failed", e);
    }
  }, []);

  // 2. Active Firestore Pull for Cloud Syncing (Non-destructive merge, offline safe)
  const pullCloudData = useCallback(async () => {
    if (!profile?.id) return;

    setCloudSyncStatus("syncing");
    const freelancerId = profile.id;

    try {
      // 1. Fetch remote profile (for plan/subscription status)
      try {
        const profileSnap = await getDoc(doc(db, "freelancers", freelancerId));
        if (profileSnap.exists()) {
          const freshProfile = profileSnap.data() as FreelancerProfile;
          setProfile((prev) => (prev ? { ...prev, ...freshProfile } : freshProfile));
          localStorage.setItem("crm_profile", JSON.stringify(freshProfile));
        }
      } catch (profileErr) {
        console.warn("Could not fetch remote profile (retaining local):", profileErr);
      }

      const buildQuery = (col: string) => query(collection(db, col), where("freelancerId", "==", freelancerId));

      // Helper to merge cloud docs with local list safely (NEVER wipe local data on error or empty remote)
      const mergeCollectionSafe = async <T extends { id: string; freelancerId: string }>(
        colName: string,
        setList: React.Dispatch<React.SetStateAction<T[]>>
      ) => {
        try {
          const snap = await getDocs(buildQuery(colName));
          const cloudItems = snap.docs.map((d) => d.data() as T);

          setList((prevList) => {
            const map = new Map<string, T>();

            // 1. Add all cloud items
            cloudItems.forEach((cItem) => {
              if (cItem && cItem.id) map.set(cItem.id, cItem);
            });

            // 2. Retain any local items not yet on cloud
            const unSyncedLocals: T[] = [];
            prevList.forEach((localItem) => {
              if (localItem && localItem.id) {
                if (!map.has(localItem.id)) {
                  map.set(localItem.id, localItem);
                  unSyncedLocals.push(localItem);
                }
              }
            });

            const merged = Array.from(map.values());
            localStorage.setItem(`crm_${colName}_${freelancerId}`, JSON.stringify(merged));

            // 3. Upload any local-only items to cloud in background
            if (unSyncedLocals.length > 0) {
              unSyncedLocals.forEach((item) => {
                setDoc(doc(db, colName, item.id), item).catch((e) =>
                  console.warn(`Background sync upload failed for ${colName}/${item.id}:`, e)
                );
              });
            }

            return merged;
          });
        } catch (colErr) {
          console.warn(`Cloud read failed for ${colName}, preserving local data:`, colErr);
        }
      };

      await Promise.allSettled([
        mergeCollectionSafe("clients", setClients),
        mergeCollectionSafe("records", setRecords),
        mergeCollectionSafe("projects", setProjects),
        mergeCollectionSafe("tasks", setTasks),
        mergeCollectionSafe("followups", setFollowUps),
        mergeCollectionSafe("invoices", setInvoices),
        mergeCollectionSafe("proposals", setProposals),
        mergeCollectionSafe("leads", setLeads),
        mergeCollectionSafe("documents", setDocuments),
      ]);

      setCloudSyncStatus("synced");
    } catch (err) {
      console.warn("Unable to pull cloud sync parameters. Working offline with local data.", err);
      setCloudSyncStatus("offline");
    }
  }, [profile?.id]);

  useEffect(() => {
    if (profile?.id) {
      pullCloudData();
    }
  }, [profile?.id, pullCloudData]);

  // Stripe session verification handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get("stripe_status");
    const sessionId = params.get("session_id");

    if (stripeStatus === "success" && sessionId) {
      const verifyStripePayment = async () => {
        try {
          setCloudSyncStatus("syncing");
          const res = await fetch(`/api/stripe/verify-session?session_id=${sessionId}`);
          const data = await res.json();

          if (data.success && data.profile) {
            setProfile(data.profile);
            localStorage.setItem("crm_profile", JSON.stringify(data.profile));
            setCloudSyncStatus("synced");

            // Instruct UpgradeModal to show success state and open it!
            sessionStorage.setItem("stripe_payment_success", "true");
            setUpgradeOpen(true);
            setUpgradeReason("stripe_success_redirect");
          }
        } catch (err) {
          console.error("Failed to verify Stripe payment:", err);
        } finally {
          // Clean URL parameters cleanly without refreshing the browser tab
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      };

      verifyStripePayment();
    } else if (stripeStatus === "cancel") {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      alert("Stripe Checkout was cancelled. Your subscription remains unchanged.");
    }
  }, [profile?.id]);

  // Handle connection to existing account & pull cloud data securely
  const handleAccountConnected = useCallback(
    (connectedProfile: FreelancerProfile) => {
      // Ensure onboardingCompleted is explicitly set to true so onboarding never reopens
      const fullProfile: FreelancerProfile = {
        ...connectedProfile,
        onboardingCompleted: true,
      };

      setProfile(fullProfile);
      localStorage.setItem("crm_profile", JSON.stringify(fullProfile));
      setIsConnectExistingOpen(false);

      // Load cached/recovered collections for this profile
      setClients(loadAndRecoverCollection<Client>("clients", fullProfile.id));
      setRecords(loadAndRecoverCollection<NoteRecord>("records", fullProfile.id));
      setProjects(loadAndRecoverCollection<Project>("projects", fullProfile.id));
      setTasks(loadAndRecoverCollection<Task>("tasks", fullProfile.id));
      setFollowUps(loadAndRecoverCollection<FollowUp>("followups", fullProfile.id));
      setInvoices(loadAndRecoverCollection<Invoice>("invoices", fullProfile.id));
      setProposals(loadAndRecoverCollection<Proposal>("proposals", fullProfile.id));
      setLeads(loadAndRecoverCollection<Lead>("leads", fullProfile.id));
      setDocuments(loadAndRecoverCollection<DocumentRecord>("documents", fullProfile.id));

      pullCloudData();
    },
    [pullCloudData]
  );

  // Synchronize desktop profile with backend store
  useEffect(() => {
    if (profile?.id) {
      fetch("/api/mobile/sync-workspace-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      }).catch(() => {});
    }
  }, [profile?.id, profile?.name, profile?.plan]);

  // Network connection restoration listeners for instant offline-to-online sync
  useEffect(() => {
    const handleOnline = () => {
      console.log("[Network] Connection restored. Synchronizing offline buffer...");
      pullCloudData();
    };

    const handleOffline = () => {
      console.log("[Network] Device went offline. Using local buffer.");
      setCloudSyncStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pullCloudData]);

  // Handle manual connect with 6-digit code
  const handleConnectWithCode = useCallback(async (code: string): Promise<boolean> => {
    try {
      const cleanCode = code.replace(/\D/g, "");
      if (cleanCode.length !== 6) return false;

      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      const platform = isIOS ? "iOS" : isAndroid ? "Android" : "Mobile Web";
      const deviceName = isIOS ? "Apple iPhone" : isAndroid ? "Android Phone" : "Mobile Device";
      const clientDeviceId = getOrCreatePersistentDeviceId();

      const res = await fetch("/api/mobile/verify-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingCode: cleanCode,
          clientDeviceId,
          deviceName,
          platform,
          userAgent,
        }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        const fullProfile = {
          ...data.profile,
          onboardingCompleted: true,
        };
        setProfile(fullProfile);
        localStorage.setItem("crm_profile", JSON.stringify(fullProfile));
        if (data.device?.id) {
          localStorage.setItem("crm_mobile_device_id", data.device.id);
        }
        await pullCloudData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Code verification error:", err);
      return false;
    }
  }, [pullCloudData]);

  // Helper: Persist specific entity locally + Firestore push
  const saveEntity = useCallback(async <T extends { id: string; freelancerId: string }>(
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
  }, [profile]);

  // 3. Operational State Mutators

  const handleOnboardingComplete = useCallback(async (newProfile: FreelancerProfile) => {
    setProfile(newProfile);
    localStorage.setItem("crm_profile", JSON.stringify(newProfile));

    // Consolidate and recover any existing offline/test data to this workspace profile
    const recoveredClients = loadAndRecoverCollection<Client>("clients", newProfile.id);
    const recoveredRecords = loadAndRecoverCollection<NoteRecord>("records", newProfile.id);
    const recoveredProjects = loadAndRecoverCollection<Project>("projects", newProfile.id);
    const recoveredTasks = loadAndRecoverCollection<Task>("tasks", newProfile.id);
    const recoveredFollowUps = loadAndRecoverCollection<FollowUp>("followups", newProfile.id);
    const recoveredInvoices = loadAndRecoverCollection<Invoice>("invoices", newProfile.id);
    const recoveredProposals = loadAndRecoverCollection<Proposal>("proposals", newProfile.id);
    const recoveredLeads = loadAndRecoverCollection<Lead>("leads", newProfile.id);
    const recoveredDocuments = loadAndRecoverCollection<DocumentRecord>("documents", newProfile.id);

    setClients(recoveredClients);
    setRecords(recoveredRecords);
    setProjects(recoveredProjects);
    setTasks(recoveredTasks);
    setFollowUps(recoveredFollowUps);
    setInvoices(recoveredInvoices);
    setProposals(recoveredProposals);
    setLeads(recoveredLeads);
    setDocuments(recoveredDocuments);

    try {
      setCloudSyncStatus("syncing");
      await setDoc(doc(db, "freelancers", newProfile.id), newProfile);
      setCloudSyncStatus("synced");
    } catch {
      setCloudSyncStatus("offline");
    }
  }, []);

  const handleUpdateProfile = useCallback(async (updatedFields: Partial<FreelancerProfile>) => {
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
  }, [profile]);

  // Clients Mutators
  const handleAddClient = useCallback((fields: Omit<Client, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const isFree = profile.plan === "Free" && !profile.premium;
    if (isFree && clients.length >= 10) {
      triggerUpgrade("client_limit");
      return;
    }
    const newClient: Client = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...clients, newClient];
    setClients(newList);
    saveEntity("clients", newList, newClient);
  }, [profile, clients, triggerUpgrade, saveEntity]);

  const handleUpdateClient = useCallback((id: string, fields: Partial<Client>) => {
    const updated = clients.map((c) => (c.id === id ? { ...c, ...fields } : c));
    setClients(updated);
    const item = updated.find((c) => c.id === id);
    if (item) saveEntity("clients", updated, item);
  }, [clients, saveEntity]);

  const handleDeleteClient = useCallback((id: string) => {
    const newList = clients.filter((c) => c.id !== id);
    setClients(newList);
    saveEntity("clients", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [clients, profile?.id, saveEntity]);

  // Notes & Records Mutators
  const handleAddRecord = useCallback((fields: Omit<NoteRecord, "id" | "freelancerId" | "createdAt" | "updatedAt">) => {
    if (!profile) return;
    const now = new Date().toISOString();
    const newRecord: NoteRecord = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      createdAt: now,
      updatedAt: now,
    };
    const newList = [newRecord, ...records];
    setRecords(newList);
    saveEntity("records", newList, newRecord);
  }, [profile, records, saveEntity]);

  const handleUpdateRecord = useCallback((id: string, fields: Partial<NoteRecord>) => {
    const now = new Date().toISOString();
    const updated = records.map((r) => (r.id === id ? { ...r, ...fields, updatedAt: now } : r));
    setRecords(updated);
    const item = updated.find((r) => r.id === id);
    if (item) saveEntity("records", updated, item);
  }, [records, saveEntity]);

  const handleDeleteRecord = useCallback((id: string) => {
    const newList = records.filter((r) => r.id !== id);
    setRecords(newList);
    saveEntity("records", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [records, profile?.id, saveEntity]);

  const handleViewClientRecords = useCallback((clientId: string) => {
    setNotesClientFilter(clientId);
    setActiveView("Notes & Records");
  }, []);

  // Projects Mutators
  const handleAddProject = useCallback((fields: Omit<Project, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newProject: Project = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...projects, newProject];
    setProjects(newList);
    saveEntity("projects", newList, newProject);
  }, [profile, projects, saveEntity]);

  const handleUpdateProject = useCallback((id: string, fields: Partial<Project>) => {
    const updated = projects.map((p) => (p.id === id ? { ...p, ...fields } : p));
    setProjects(updated);
    const item = updated.find((p) => p.id === id);
    if (item) saveEntity("projects", updated, item);
  }, [projects, saveEntity]);

  const handleDeleteProject = useCallback((id: string) => {
    const newList = projects.filter((p) => p.id !== id);
    setProjects(newList);
    saveEntity("projects", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [projects, profile?.id, saveEntity]);

  // Tasks Mutators
  const handleAddTask = useCallback((fields: Omit<Task, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const isPro =
      profile.premium === true ||
      profile.plan === "Pro" ||
      profile.plan === "Monthly" ||
      profile.plan === "3 Months" ||
      (profile.plan !== undefined && profile.plan !== "Free");
    const isFree = !isPro;

    // Enforce 5 task limit on Free plan only when creating NEW tasks
    if (isFree && tasks.length >= 5) {
      triggerUpgrade("task_limit");
      return;
    }

    const newTask: Task = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [newTask, ...tasks];
    setTasks(newList);
    saveEntity("tasks", newList, newTask);
  }, [profile, tasks, saveEntity, triggerUpgrade]);

  const handleToggleTask = useCallback((id: string, completed: boolean) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, completed } : t));
    setTasks(updated);
    const item = updated.find((t) => t.id === id);
    if (item) saveEntity("tasks", updated, item);
  }, [tasks, saveEntity]);

  const handleDeleteTask = useCallback((id: string) => {
    const newList = tasks.filter((t) => t.id !== id);
    setTasks(newList);
    saveEntity("tasks", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [tasks, profile?.id, saveEntity]);

  // Invoices Mutators
  const handleAddInvoice = useCallback((fields: Omit<Invoice, "id" | "freelancerId" | "createdAt" | "invoiceNumber">) => {
    if (!profile) return;

    // Sequential base invoice indexing
    const nextSeq = String(invoices.length + 1).padStart(3, "0");
    const newInvoice: Invoice = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      invoiceNumber: `INV-${nextSeq}`,
      createdAt: new Date().toISOString(),
    };
    const newList = [newInvoice, ...invoices];
    setInvoices(newList);
    saveEntity("invoices", newList, newInvoice);
  }, [profile, invoices, saveEntity]);

  const handleUpdateInvoice = useCallback((id: string, fields: Partial<Invoice>) => {
    const updated = invoices.map((inv) => (inv.id === id ? { ...inv, ...fields } : inv));
    setInvoices(updated);
    const item = updated.find((inv) => inv.id === id);
    if (item) saveEntity("invoices", updated, item);
  }, [invoices, saveEntity]);

  const handleDeleteInvoice = useCallback((id: string) => {
    const newList = invoices.filter((inv) => inv.id !== id);
    setInvoices(newList);
    saveEntity("invoices", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [invoices, profile?.id, saveEntity]);

  // Proposals Mutators
  const handleSaveProposal = useCallback((proposal: Proposal) => {
    if (!profile) return;
    const exists = proposals.some((p) => p.id === proposal.id);
    let updatedList: Proposal[];
    if (exists) {
      updatedList = proposals.map((p) => (p.id === proposal.id ? proposal : p));
    } else {
      updatedList = [proposal, ...proposals];
    }
    setProposals(updatedList);
    saveEntity("proposals", updatedList, proposal);
  }, [profile, proposals, saveEntity]);

  const handleDeleteProposal = useCallback((id: string) => {
    const updatedList = proposals.filter((p) => p.id !== id);
    setProposals(updatedList);
    saveEntity("proposals", updatedList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [proposals, profile?.id, saveEntity]);

  const handleConvertProposalToProject = useCallback((proposal: Proposal) => {
    if (!profile) return;
    const newProject: Project = {
      id: generateUUID(),
      freelancerId: profile.id,
      title: proposal.title || `Project for #${proposal.proposalNumber}`,
      clientId: proposal.clientId,
      notes: proposal.description || `Converted from Proposal #${proposal.proposalNumber}`,
      budget: proposal.items.reduce((acc, it) => acc + (it.quantity || 0) * (it.rate || 0), 0),
      deadline: proposal.validUntil,
      status: "In Progress",
      createdAt: new Date().toISOString(),
    };
    const nextProjects = [...projects, newProject];
    setProjects(nextProjects);
    saveEntity("projects", nextProjects, newProject);

    // Update proposal with converted project and status Accepted
    const updatedProposal: Proposal = {
      ...proposal,
      status: "Accepted",
      convertedProjectId: newProject.id,
    };
    handleSaveProposal(updatedProposal);
    setActiveView("Projects");
  }, [profile, projects, saveEntity, handleSaveProposal]);

  const handleConvertProposalToInvoice = useCallback((proposal: Proposal) => {
    if (!profile) return;
    const nextSeq = String(invoices.length + 1).padStart(3, "0");
    const newInvoice: Invoice = {
      id: generateUUID(),
      freelancerId: profile.id,
      invoiceNumber: `INV-${nextSeq}`,
      clientId: proposal.clientId,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: proposal.validUntil || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      services: proposal.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        rate: it.rate,
      })),
      taxRate: proposal.taxRate || 0,
      notes: proposal.notes || `Invoice generated from Proposal #${proposal.proposalNumber}`,
      status: "Draft",
      createdAt: new Date().toISOString(),
    };
    const nextInvoices = [newInvoice, ...invoices];
    setInvoices(nextInvoices);
    saveEntity("invoices", nextInvoices, newInvoice);

    // Update proposal with converted invoice
    const updatedProposal: Proposal = {
      ...proposal,
      convertedInvoiceId: newInvoice.id,
    };
    handleSaveProposal(updatedProposal);
    setActiveView("Invoices");
  }, [profile, invoices, saveEntity, handleSaveProposal]);

  // Leads Mutators
  const handleAddLead = useCallback((fields: Omit<Lead, "id" | "freelancerId" | "createdAt">) => {
    if (!profile) return;
    const newLead: Lead = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      createdAt: new Date().toISOString(),
    };
    const newList = [...leads, newLead];
    setLeads(newList);
    saveEntity("leads", newList, newLead);
  }, [profile, leads, saveEntity]);

  const handleUpdateLead = useCallback((id: string, fields: Partial<Lead>) => {
    const updated = leads.map((l) => (l.id === id ? { ...l, ...fields } : l));
    setLeads(updated);
    const item = updated.find((l) => l.id === id);
    if (item) saveEntity("leads", updated, item);
  }, [leads, saveEntity]);

  const handleDeleteLead = useCallback((id: string) => {
    const newList = leads.filter((l) => l.id !== id);
    setLeads(newList);
    saveEntity("leads", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [leads, profile?.id, saveEntity]);

  // Convert Lead to Verified Client (Delightful business convert helper)
  const handleConvertToClient = useCallback((lead: Lead) => {
    const isFree = (profile?.plan === "Free" || !profile?.plan) && !profile?.premium;
    if (isFree && clients.length >= 10) {
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
  }, [profile, clients.length, triggerUpgrade, handleAddClient, handleUpdateLead]);

  // Documents mutators
  const handleAddDocument = useCallback((fields: Omit<DocumentRecord, "id" | "freelancerId" | "uploadDate" | "createdAt">) => {
    if (!profile) return;
    const newDoc: DocumentRecord = {
      ...fields,
      id: generateUUID(),
      freelancerId: profile.id,
      uploadDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
    };
    const newList = [newDoc, ...documents];
    setDocuments(newList);
    saveEntity("documents", newList, newDoc);
  }, [profile, documents, saveEntity]);

  const handleDeleteDocument = useCallback((id: string) => {
    const newList = documents.filter((doc) => doc.id !== id);
    setDocuments(newList);
    saveEntity("documents", newList, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [documents, profile?.id, saveEntity]);

  // Follow-ups Mutators
  const handleSaveFollowUp = useCallback((followUpData: FollowUp) => {
    if (!profile) return;
    const existingIndex = followUps.findIndex((f) => f.id === followUpData.id);
    const isPro =
      profile.premium === true ||
      profile.plan === "Pro" ||
      profile.plan === "Monthly" ||
      profile.plan === "3 Months" ||
      (profile.plan !== undefined && profile.plan !== "Free");
    const isFree = !isPro;

    // Enforce 5 follow-up limit on Free plan only when creating NEW follow-ups
    if (existingIndex < 0 && isFree && followUps.length >= 5) {
      triggerUpgrade("followup_limit");
      return;
    }

    let updatedList: FollowUp[];
    if (existingIndex >= 0) {
      updatedList = followUps.map((f) => (f.id === followUpData.id ? followUpData : f));
    } else {
      const fullItem: FollowUp = {
        ...followUpData,
        freelancerId: profile.id,
      };
      updatedList = [fullItem, ...followUps];
    }
    setFollowUps(updatedList);
    const target = updatedList.find((f) => f.id === followUpData.id) || followUpData;
    saveEntity("followups", updatedList, { ...target, freelancerId: profile.id });
  }, [profile, followUps, saveEntity, triggerUpgrade]);

  const handleToggleFollowUp = useCallback((followUp: FollowUp) => {
    if (!profile) return;
    const newStatus: "completed" | "pending" = followUp.status === "completed" ? "pending" : "completed";
    const updated: FollowUp[] = followUps.map((f) =>
      f.id === followUp.id
        ? { ...f, status: newStatus, completedAt: newStatus === "completed" ? new Date().toISOString() : undefined }
        : f
    );
    setFollowUps(updated);
    const item = updated.find((f) => f.id === followUp.id);
    if (item) saveEntity("followups", updated, item);
  }, [profile, followUps, saveEntity]);

  const handleDeleteFollowUp = useCallback((id: string) => {
    const updated = followUps.filter((f) => f.id !== id);
    setFollowUps(updated);
    saveEntity("followups", updated, { id, freelancerId: profile?.id || "" } as any, "delete");
  }, [profile?.id, followUps, saveEntity]);

  // Quick triggers from deep dashboard shortcuts
  const handleQuickAddAction = useCallback((action: string) => {
    if (action === "client") {
      setActiveView("Clients");
    } else if (action === "project") {
      setActiveView("Projects");
    } else if (action === "invoice") {
      setActiveView("Invoices");
    } else if (action === "followup") {
      handleOpenFollowUpModal();
    } else if (action === "task") {
      setActiveView("Tasks");
    } else if (action === "calendar") {
      setActiveView("Calendar");
    } else if (action === "proposal") {
      setActiveView("Proposals");
    }
  }, [handleOpenFollowUpModal]);

  // Render Setup Router
  if (activeView === "PrivacyPolicy" && (!profile || !profile.onboardingCompleted)) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans relative py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Back to Home/Onboarding link */}
          <div className="mb-6">
            <button
              onClick={() => {
                setActiveView("Dashboard");
                window.history.pushState(null, "", "/");
              }}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-550 hover:text-indigo-600 transition-colors cursor-pointer"
            >
              &larr; Back to Onboarding
            </button>
          </div>
          <PrivacyPolicyView isPublic={true} />
        </div>
      </div>
    );
  }

  if (!profile || !profile.onboardingCompleted) {
    if (isConnectExistingOpen) {
      return (
        <ConnectExistingAccount
          onBack={() => setIsConnectExistingOpen(false)}
          onAccountConnected={handleAccountConnected}
          initialToken={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mobile_connect") : null}
          initialCode={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("connect_code") : null}
        />
      );
    }

    return (
      <Onboarding
        onComplete={handleOnboardingComplete}
        onConnectExisting={() => setIsConnectExistingOpen(true)}
      />
    );
  }

  const isGmailEntitled = canAccessGmail(profile);

  const menuItems: Array<{ name: string; icon: any; badge?: number | string; isProBadge?: boolean }> = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Clients", icon: Users },
    {
      name: "Gmail",
      icon: Mail,
      badge: isGmailEntitled ? (unreadGmailCount > 0 ? unreadGmailCount : undefined) : "PRO",
      isProBadge: !isGmailEntitled,
    },
    { name: "Notes & Records", icon: Notebook },
    { name: "Projects", icon: FolderGit2 },
    { name: "Tasks", icon: CheckSquare },
    { name: "Calendar", icon: CalendarIcon },
    { name: "Invoices", icon: FileText },
    { name: "Proposals", icon: FileCheck2 },
    { name: "Leads", icon: Star },
    { name: "Revenue", icon: TrendingUp },
    { name: "Documents", icon: FolderUp },
    { name: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-800 transition-colors antialiased font-sans relative overflow-x-hidden">
      {/* Background ambient lighting blobs (static CSS blurs for zero GPU/CPU repainting) */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/10 via-slate-50/40 to-emerald-50/5 z-0 pointer-events-none"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/10 rounded-full blur-[100px] z-0 pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-5%] w-[45%] h-[45%] bg-emerald-400/10 rounded-full blur-[100px] z-0 pointer-events-none"></div>
      <div className="absolute top-[35%] right-[20%] w-[35%] h-[35%] bg-purple-400/5 rounded-full blur-[80px] z-0 pointer-events-none"></div>

      {/* Side Rail View (Left on desktops/tablets, hidden/drawer on mobile) */}
      <aside className="hidden md:flex flex-col w-64 glass-aside shrink-0 select-none pb-6 no-print z-10">
        {/* Brand identity */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-0.5 bg-transparent rounded-xl flex items-center justify-center shrink-0 w-8 h-8 select-none">
              <img src={logoIcon} alt="Freelancer CRM Logo" className="w-8 h-8 rounded-xl object-contain shadow-md shadow-indigo-600/10 ring-1 ring-slate-200/40 hover:scale-108 active:scale-95 transition-all duration-350 ease-out cursor-pointer" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-none">
                Freelancer CRM
              </h1>
              <span className="text-[10px] text-slate-405 mt-1 block">Operations Center</span>
            </div>
          </div>
        </div>

        {/* Dynamic Sync & plan badge */}
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cloudSyncStatus === "synced" && (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
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
              if (profile.plan === "Free" && !profile.premium) triggerUpgrade("upgrade_badge_click");
            }}
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full cursor-pointer transition-all ${
              (profile.premium === true || profile.plan !== "Free")
                ? "bg-emerald-100 text-emerald-800"
                : "bg-indigo-100 text-indigo-805 hover:bg-indigo-600 hover:text-white"
            }`}
          >
            {profile.plan === "Free" && !profile.premium ? "Free" : "Pro"} Plan
          </span>
        </div>

        {/* Primary nav items */}
        <nav className="flex-1 px-4 py-4 space-y-1 relative">
          {/* Quick Search Shortcut Button */}
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="w-full flex items-center justify-between py-2 px-3 mb-3 bg-slate-100/70 hover:bg-slate-200/80 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-slate-400 group-hover:text-indigo-600" />
              <span>Search CRM & Gmail...</span>
            </div>
            <kbd className="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 shadow-xs">
              ⌘K
            </kbd>
          </button>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.name;
            return (
              <motion.button
                key={item.name}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setActiveView(item.name);
                  setSearchTerm("");
                }}
                className={`w-full relative flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isActive
                    ? "text-indigo-650"
                    : "text-slate-500 hover:text-slate-800 hover:bg-black/5"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-indigo-600/15 border border-indigo-500/20 rounded-xl shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon size={16} className={`relative z-10 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
                <span className="relative z-10">{item.name}</span>
                {item.badge !== undefined && (
                  <span
                    className={`relative z-10 ml-auto px-1.5 py-0.5 text-[9px] font-extrabold rounded-full flex items-center gap-0.5 ${
                      item.isProBadge
                        ? "bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs"
                        : "bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {item.isProBadge && <Lock size={8} className="text-amber-600" />}
                    <span>{item.badge}</span>
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Mobile App Connection at the very bottom of sidebar */}
        <div className="px-4 pt-3 pb-2 border-t border-slate-200/50 mt-auto">
          <button
            type="button"
            id="sidebar-mobile-app-btn"
            onClick={() => setIsMobileModalOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/70 border border-slate-200/60 bg-white/80 shadow-2xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                <Smartphone size={15} />
              </div>
              <div className="text-left leading-tight">
                <span className="block text-slate-900 font-bold group-hover:text-indigo-600">Mobile App</span>
                <span className="block text-[10px] text-slate-400 font-normal">Connect Mobile</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {cloudSyncStatus === "synced" ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" title="Connected & Synced" />
              ) : cloudSyncStatus === "syncing" ? (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" title="Syncing..." />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" title="Offline mode" />
              )}
              <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>

        {/* Footer info (humble and useful, no telemetries) */}
        <div className="px-6 pt-3 border-t border-slate-100/10 text-[10px] text-slate-400 flex flex-col gap-1 select-none">
          <span>Signed: {profile.name}</span>
          <button
            onClick={() => setActiveView("PrivacyPolicy")}
            className="text-left font-bold text-slate-450 hover:text-indigo-600 hover:underline transition-all cursor-pointer"
          >
            Privacy Policy
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden glass-aside border-b border-white/10 flex items-center justify-between p-4 px-5 select-none no-print z-20">
        <div className="flex items-center gap-2">
          <div className="p-0.5 bg-transparent rounded-lg flex items-center justify-center shrink-0 w-7 h-7 select-none">
            <img src={logoIcon} alt="Freelancer CRM Logo" className="w-7 h-7 rounded-lg object-contain shadow-sm" referrerPolicy="no-referrer" />
          </div>
          <div>
            <span className="font-extrabold text-xs tracking-tight text-slate-900 block">
              Freelancer CRM
            </span>
            <span className="text-[9px] text-slate-450">Ops Console</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.plan === "Free" && !profile.premium && (
            <button
              onClick={() => triggerUpgrade("mobile_header")}
              className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
            >
              Upgrade
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500"
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
                    isActive ? "bg-indigo-650 text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.name}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-auto px-1.5 py-0.5 text-[9px] font-extrabold rounded-full flex items-center gap-0.5 ${
                        item.isProBadge
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-indigo-100 text-indigo-700"
                      }`}
                    >
                      {item.isProBadge && <Lock size={8} className="text-amber-700" />}
                      <span>{item.badge}</span>
                    </span>
                  )}
                </button>
              );
            })}

            {/* Mobile App Connection Option in Drawer */}
            <div className="pt-2 border-t border-black/5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsMobileModalOpen(true);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 bg-indigo-50/60 border border-indigo-100 hover:bg-indigo-100 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone size={16} className="text-indigo-600" />
                  <span>Mobile App & Sync</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {cloudSyncStatus === "synced" ? (
                    <span className="text-[10px] text-emerald-600 font-bold">Synced</span>
                  ) : cloudSyncStatus === "syncing" ? (
                    <span className="text-[10px] text-indigo-600 font-bold">Syncing</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-bold">Offline</span>
                  )}
                  <ChevronRight size={14} className="text-indigo-600" />
                </div>
              </button>
            </div>

            {/* Mobile Footer Privacy Link */}
            <div className="pt-2 border-t border-black/5 flex justify-center">
              <button
                onClick={() => {
                  setActiveView("PrivacyPolicy");
                  setMobileMenuOpen(false);
                }}
                className="py-1.5 px-3 text-[10px] font-bold text-slate-500 hover:text-indigo-650 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Privacy Policy</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Application Body */}
      <main className="flex-1 flex flex-col p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6 overflow-hidden z-10">
        {/* Dynamic Control Top Search and Meta metrics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-5 no-print">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {activeView}
            </h1>
            <p className="text-xs text-slate-450 mt-1 font-medium">
              {profile.businessName ? `${profile.businessName} Portal` : "Freelancer Workspace Dashboard"}{" "}
              &middot; Account ID: <span className="font-mono text-[10px]">{profile.id.substring(0, 8)}</span>
            </p>
          </div>

          {/* Search box and Global Search trigger */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {["Clients", "Projects", "Invoices", "Leads"].includes(activeView) && (
              <div className="relative flex-1 sm:w-56">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={`Filter ${activeView.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs py-2 px-3 pl-9 glass-input rounded-xl focus:outline-none text-slate-800"
                />
              </div>
            )}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-650 shadow-xs hover:border-indigo-300 transition-all cursor-pointer"
              title="Global Search across CRM & Gmail (Cmd+K / Ctrl+K)"
            >
              <Sparkles size={13} className="text-indigo-600" />
              <span className="hidden md:inline">Universal Search</span>
              <kbd className="text-[10px] font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-500">⌘K</kbd>
            </button>
          </div>
        </div>

        {/* View Switch Router */}
        <div className="flex-1 relative">
          <div key={activeView} className="w-full h-full animate-fade-in">
            {activeView === "Dashboard" && (
                <DashboardView
                  clients={clients}
                  projects={projects}
                  invoices={invoices}
                  leads={leads}
                  followUps={followUps}
                  proposals={proposals}
                  currency={profile.currency}
                  onNavigate={setActiveView}
                  onQuickAdd={handleQuickAddAction}
                  onToggleFollowUp={handleToggleFollowUp}
                  onOpenFollowUpModal={() => handleOpenFollowUpModal()}
                />
              )}

              {activeView === "Clients" && (
                <ClientsView
                  clients={clients}
                  records={records}
                  projects={projects}
                  tasks={tasks}
                  invoices={invoices}
                  documents={documents}
                  profile={profile}
                  searchTerm={searchTerm}
                  initialSelectedClientId={targetClientIdForModal}
                  onAddClient={handleAddClient}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                  onTriggerUpgrade={triggerUpgrade}
                  onViewClientRecords={handleViewClientRecords}
                  onUpdateProfile={handleUpdateProfile}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onNavigateToView={setActiveView}
                />
              )}

              {activeView === "Gmail" && (
                <GmailErrorBoundary onReset={() => setActiveView("Dashboard")}>
                  <Suspense fallback={<GmailLoadingSkeleton />}>
                    <GmailView
                      profile={profile}
                      clients={clients}
                      onUpdateProfile={handleUpdateProfile}
                      onAddTask={handleAddTask}
                      onNavigateToClient={(clientId) => {
                        setTargetClientIdForModal(clientId);
                        setActiveView("Clients");
                      }}
                      onTriggerUpgrade={triggerUpgrade}
                    />
                  </Suspense>
                </GmailErrorBoundary>
              )}

              {activeView === "Notes & Records" && (
                <NotesRecordsView
                  records={records}
                  clients={clients}
                  profile={profile}
                  initialClientIdFilter={notesClientFilter}
                  onAddRecord={handleAddRecord}
                  onUpdateRecord={handleUpdateRecord}
                  onDeleteRecord={handleDeleteRecord}
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
                  profile={profile}
                  onAddTask={handleAddTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onTriggerUpgrade={triggerUpgrade}
                />
              )}

              {activeView === "Calendar" && (
                <CalendarView
                  followUps={followUps}
                  tasks={tasks}
                  projects={projects}
                  invoices={invoices}
                  leads={leads}
                  clients={clients}
                  profile={profile}
                  onOpenFollowUpModal={handleOpenFollowUpModal}
                  onToggleFollowUp={handleToggleFollowUp}
                  onDeleteFollowUp={handleDeleteFollowUp}
                  onToggleTask={(task) => handleToggleTask(task.id, !task.completed)}
                  onSelectClient={(clientId) => {
                    setTargetClientIdForModal(clientId);
                    setActiveView("Clients");
                  }}
                  onNavigateToView={setActiveView}
                  onTriggerUpgrade={triggerUpgrade}
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
                  onUpdateClient={handleUpdateClient}
                  onUpdateProfile={handleUpdateProfile}
                  onTriggerUpgrade={triggerUpgrade}
                />
              )}

              {activeView === "Proposals" && (
                <ProposalsView
                  proposals={proposals}
                  clients={clients}
                  projects={projects}
                  invoices={invoices}
                  profile={profile}
                  searchTerm={searchTerm}
                  onSaveProposal={handleSaveProposal}
                  onDeleteProposal={handleDeleteProposal}
                  onConvertToProject={handleConvertProposalToProject}
                  onConvertToInvoice={handleConvertProposalToInvoice}
                  onUpdateClient={handleUpdateClient}
                  onTriggerUpgrade={triggerUpgrade}
                  onNavigateToClient={(clientId) => {
                    setTargetClientIdForModal(clientId);
                    setActiveView("Clients");
                  }}
                  onOpenGmailConnect={() => {
                    setActiveView("Gmail");
                  }}
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
                  isInstallable={!!pwaPrompt}
                  onInstall={triggerPwaInstall}
                  onNavigate={setActiveView}
                  onOpenExport={() => setIsExportModalOpen(true)}
                  onOpenMobileModal={() => setIsMobileModalOpen(true)}
                />
              )}

              {activeView === "PrivacyPolicy" && (
                <PrivacyPolicyView />
              )}
          </div>
        </div>
      </main>

      {/* Upgrades Core Modal overlay (Simulating App Store and RevenueCat interfaces) */}
      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        profile={profile}
        onUpgradeSuccess={(newPlan, subDetails) => handleUpdateProfile({ plan: newPlan, ...subDetails })}
        triggerReason={upgradeReason}
      />

      {/* Global Universal Search Palette (Cmd+K / Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        clients={clients}
        projects={projects}
        tasks={tasks}
        invoices={invoices}
        proposals={proposals}
        leads={leads}
        documents={documents}
        records={records}
        profile={profile}
        onSelectClient={(clientId) => {
          setTargetClientIdForModal(clientId);
          setActiveView("Clients");
        }}
        onNavigate={(view) => {
          setActiveView(view);
        }}
      />

      {/* Follow Up Modal overlay */}
      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => {
          setIsFollowUpModalOpen(false);
          setEditingFollowUp(null);
          setFollowUpModalDefaultDate(undefined);
        }}
        onSave={handleSaveFollowUp}
        existingFollowUp={editingFollowUp}
        clients={clients}
        leads={leads}
        defaultDate={followUpModalDefaultDate}
      />

      {/* Data Export / Backup Modal */}
      <DataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        clients={clients}
        leads={leads}
        projects={projects}
        tasks={tasks}
        invoices={invoices}
        proposals={proposals}
        followUps={followUps}
        documents={documents}
        notes={records}
        profile={profile}
      />

      {/* Mobile App Connection & Sync Modal */}
      <MobileConnectModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        profile={profile}
        cloudSyncStatus={cloudSyncStatus}
        onTriggerSync={pullCloudData}
        onConnectWithCode={handleConnectWithCode}
      />

      {/* PWA Floating Install Banner */}
      <AnimatePresence>
        {showPwaBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl flex flex-col gap-3"
            id="pwa-install-banner-container"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400">
                  <Monitor className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs tracking-tight text-white leading-none">
                    Install Freelancer CRM
                  </h4>
                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">Enable full screen offline workspace!</span>
                </div>
              </div>
              <button
                onClick={() => {
                  sessionStorage.setItem("pwa_dismissed", "true");
                  setShowPwaBanner(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                id="close-pwa-banner-btn"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[10px] text-slate-300 leading-normal">
              Get faster load speeds, native desktop launches, and continuous offline operations on Windows, Mac, or Android.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerPwaInstall}
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-indigo-600/10"
                id="install-pwa-banner-btn"
              >
                <Download size={12} />
                <span>Install Now</span>
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem("pwa_dismissed", "true");
                  setShowPwaBanner(false);
                }}
                className="px-3 py-1.5 border border-white/10 text-[10px] text-slate-300 font-bold rounded-lg hover:bg-white/5 transition-all text-center cursor-pointer"
                id="dismiss-pwa-banner-btn"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
