import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Award, ShieldCheck, Sparkles, CreditCard, Play, Terminal } from "lucide-react";
import { FreelancerProfile } from "../types";
import { formatCurrency, detectLocale } from "../utils";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FreelancerProfile;
  onUpgradeSuccess: (newPlan: "Pro") => void;
  triggerReason?: string; // Reason why shown (e.g., "client_limit", "project_limit", "document_storage")
}

export default function UpgradeModal({
  isOpen,
  onClose,
  profile,
  onUpgradeSuccess,
  triggerReason,
}: UpgradeModalProps) {
  const [purchaseStage, setPurchaseStage] = useState<"plans" | "processing" | "success">("plans");
  const [paymentMethod, setPaymentMethod] = useState<"web" | "play" | "revenuecat" | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { country, currency, symbol } = detectLocale();

  const isIndia = profile?.country === "IN" || country === "IN";
  const formattedPrice = isIndia ? "₹99" : "$1.99";

  useEffect(() => {
    if (isOpen) {
      setPurchaseStage("plans");
      setPaymentMethod(null);
      setLogs([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const simulatePayment = async (method: "web" | "play" | "revenuecat") => {
    setPaymentMethod(method);
    setPurchaseStage("processing");
    setLogs([]);

    const addLog = (msg: string) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      if (method === "play") {
        addLog("Launching Android Google Play Billing library version 6.1.0...");
        await new Promise((r) => setTimeout(r, 800));
        addLog(`Querying SKU 'crm_pro_monthly_subscription' for country '${profile?.country || country}'...`);
        await new Promise((r) => setTimeout(r, 600));
        addLog(`SKU located. Setting price to ${formattedPrice} per month.`);
        await new Promise((r) => setTimeout(r, 600));
        addLog("Showing secure interactive Android Play Billing overlay...");
        await new Promise((r) => setTimeout(r, 1000));
        addLog("User authenticated payment via play balance / saved card.");
        await new Promise((r) => setTimeout(r, 600));
        addLog("Retrieving encrypted purchase token...");
      } else if (method === "revenuecat") {
        addLog("Initializing RevenueCat SDK (Purchases-JS)...");
        await new Promise((r) => setTimeout(r, 800));
        addLog("Fetching available packages for workspace identifier...");
        await new Promise((r) => setTimeout(r, 600));
        addLog(`Displaying RevenueCat offering for localized region: ${isIndia ? "India" : "Global"}...`);
        await new Promise((r) => setTimeout(r, 800));
        addLog(`Sending purchase request for product: crm_pro_${isIndia ? "inr" : "usd"}_monthly`);
        await new Promise((r) => setTimeout(r, 1000));
        addLog("Syncing entitlements with RevenueCat backend API...");
      } else {
        addLog("Initializing secure Stripe checkout gateway...");
        await new Promise((r) => setTimeout(r, 800));
        addLog(`Creating checkout session for default currency: ${profile?.currency || currency}...`);
        await new Promise((r) => setTimeout(r, 600));
        addLog("Authorizing secure credit/debit card capture...");
        await new Promise((r) => setTimeout(r, 1000));
        addLog("Payment token authorized by issuing financial institution.");
      }

      await new Promise((r) => setTimeout(r, 600));
      addLog("Validating secure payment parameters on server...");
      await new Promise((r) => setTimeout(r, 800));
      addLog("Entitlement upgraded: 'PRO_FEATURES_UNLOCKED' now active.");
      await new Promise((r) => setTimeout(r, 500));
      addLog("Configuring unlimited workspace limits inside Firestore db...");
      await new Promise((r) => setTimeout(r, 500));

      setPurchaseStage("success");
      onUpgradeSuccess("Pro");
    } catch (e) {
      addLog("Error authorizing purchase. Please attempt another option.");
    }
  };

  const featureComparison = [
    { name: "Active Clients", free: "Max 20 clients", pro: "Unlimited Clients" },
    { name: "Projects", free: "Max 10 active", pro: "Unlimited Projects" },
    { name: "Invoices", free: "Basic & Manual", pro: "Unlimited Invoices & PDF generation" },
    { name: "Document Storage", free: "Unsupported", pro: "Contracts & Asset Management upload" },
    { name: "Revenue Analytics", free: "Basic counters", pro: "Interactive historic graphs & breakouts" },
    { name: "Multi-currency Support", free: "Single currency", pro: "Automatic locale currency mapping" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="relative p-6 text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Award className="w-8 h-8 text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full">
                SaaS Upgrade Hub
              </span>
              <h2 className="text-2xl font-bold mt-1">Upgrade to Freelancer CRM Pro</h2>
            </div>
          </div>

          {triggerReason && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-100 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>
                {triggerReason === "client_limit" && "You reached the limit of 20 Clients on the Free Plan."}
                {triggerReason === "project_limit" && "You reached the limit of 10 Projects on the Free Plan."}
                {triggerReason === "document_storage" && "Document Storage (Contracts & Files) is a Pro feature."}
                {triggerReason === "advanced_charts" && "Interactive revenue trends and custom filters are a Pro feature."}
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {purchaseStage === "plans" && (
            <div>
              <div className="text-center mb-6">
                <span className="text-sm text-slate-500 dark:text-slate-400">Monthly Subscription Plan</span>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{formattedPrice}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-sm">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">
                  Cancel anytime. Automatically configured for region: <strong className="text-indigo-500">{profile?.country || country}</strong>
                </p>
              </div>

              {/* Feature Grid / Comparison */}
              <div className="mb-8 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden text-sm">
                <div className="grid grid-cols-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                  <div>Capability</div>
                  <div className="text-center text-slate-500 font-medium">Free Tier</div>
                  <div className="text-right text-indigo-600 dark:text-indigo-400">Pro features</div>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {featureComparison.map((f, idx) => (
                    <div key={idx} className="grid grid-cols-3 p-2.5 text-slate-600 dark:text-slate-400">
                      <div className="font-medium text-slate-800 dark:text-slate-300">{f.name}</div>
                      <div className="text-center">{f.free}</div>
                      <div className="text-right font-medium text-indigo-600 dark:text-indigo-400 flex items-center justify-end gap-1">
                        <Check className="w-4 h-4 text-emerald-500 inline" /> {f.pro}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Methods selector */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-2">Select Your Billing Method:</h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <button
                    onClick={() => simulatePayment("revenuecat")}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-violet-500 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-all text-center group"
                  >
                    <Sparkles className="w-5 h-5 text-violet-500 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">RevenueCat</span>
                    <span className="text-[10px] text-slate-400 mt-1">Cross-platform entitlements</span>
                  </button>

                  <button
                    onClick={() => simulatePayment("play")}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all text-center group"
                  >
                    <Play className="w-5 h-5 text-emerald-500 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Google Play Billing</span>
                    <span className="text-[10px] text-slate-400 mt-1">Direct store connection</span>
                  </button>

                  <button
                    onClick={() => simulatePayment("web")}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all text-center group"
                  >
                    <CreditCard className="w-5 h-5 text-indigo-500 mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Web Payments</span>
                    <span className="text-[10px] text-slate-400 mt-1">Stripe Direct Gateway</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {purchaseStage === "processing" && (
            <div className="flex flex-col items-center py-6">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 mt-4 text-base">Processing Pro Entitlements</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Please wait while the subscription transaction secures...</p>

              <div className="w-full mt-6 bg-slate-950 rounded-xl p-4 font-mono text-[11px] text-emerald-400 border border-slate-800 shadow-inner h-44 overflow-y-auto space-y-1">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2 text-slate-400">
                  <Terminal size={12} />
                  <span>SECURE AGENT BILLING CONSOLE</span>
                </div>
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-snug">{log}</div>
                ))}
              </div>
            </div>
          )}

          {purchaseStage === "success" && (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center text-emerald-500 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 mb-4 animate-bounce">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Workspace Upgraded to Pro!</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-sm">
                All limitations are removed completely! You can now manage unlimited clients, projects, invoices, and store secure files from your dashboard.
              </p>

              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-indigo-600/20"
              >
                Go back to CRM Workspace
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
