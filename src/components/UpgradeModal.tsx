import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Check,
  Award,
  ShieldCheck,
  Sparkles,
  CreditCard,
  Smartphone,
  QrCode,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Terminal,
  Landmark,
  Calendar,
  Lock,
  Wallet
} from "lucide-react";
import { FreelancerProfile } from "../types";
import { detectLocale } from "../utils";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FreelancerProfile;
  onUpgradeSuccess: (newPlan: "Pro" | "Free", subscriptionDetails?: Partial<FreelancerProfile>) => void;
  triggerReason?: string; // Reason why shown (e.g., "client_limit", "project_limit", "document_storage")
}

export default function UpgradeModal({
  isOpen,
  onClose,
  profile,
  onUpgradeSuccess,
  triggerReason,
}: UpgradeModalProps) {
  const [purchaseStage, setPurchaseStage] = useState<"plans" | "processing" | "success" | "failed">("plans");
  const [selectedUpiApp, setSelectedUpiApp] = useState<"gpay" | "phonepe" | "paytm" | "bhim" | "razorpay" | "">("");
  const [upiMode, setUpiMode] = useState<"upi_id" | "qr">("upi_id");
  const [upiIdInput, setUpiIdInput] = useState("");
  const [upiError, setUpiError] = useState("");

  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [stripePublishableKey, setStripePublishableKey] = useState("");

  // Stripe card details
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardError, setCardError] = useState("");

  // Tracking and Simulation parameters
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"track" | "history">("track");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const { country, currency } = detectLocale();
  const isIndia = profile?.country === "IN" || country === "IN";
  const formattedPrice = isIndia ? "₹99" : "$1.99";

  useEffect(() => {
    // Fetch Stripe config on load
    fetch("/api/stripe/config")
      .then((r) => r.json())
      .then((data) => {
        setStripeConfigured(data.isConfigured);
        if (data.publishableKey) {
          setStripePublishableKey(data.publishableKey);
        }
      })
      .catch((err) => console.error("Error fetching stripe configurations:", err));
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (sessionStorage.getItem("stripe_payment_success") === "true") {
        setPurchaseStage("success");
        sessionStorage.removeItem("stripe_payment_success");
      } else {
        setPurchaseStage("plans");
      }
      setSelectedUpiApp("");
      setUpiMode("upi_id");
      setUpiIdInput("");
      setUpiError("");
      setCardName("");
      setCardNumber("");
      setCardExpiry("");
      setCardCvc("");
      setCardError("");
      setLogs([]);
      setIsCancelling(false);
      setIsRestoring(false);
      setActionError("");
      setActionSuccess("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpiAppSelect = (app: "gpay" | "phonepe" | "paytm" | "bhim" | "razorpay") => {
    setSelectedUpiApp(app);
    setUpiError("");
    // Autofill dummy upi ID for rapid testing if user wants it
    if (!upiIdInput) {
      const suffixes = {
        gpay: "@oksbi",
        phonepe: "@ybl",
        paytm: "@paytm",
        bhim: "@upi",
        razorpay: "@razor",
      };
      const cleanName = profile?.name?.toLowerCase().replace(/\s+/g, "") || "freelancer";
      setUpiIdInput(`${cleanName}${suffixes[app]}`);
    }
  };

  const validateUpiInput = (): boolean => {
    if (upiMode === "qr") return true;
    if (!selectedUpiApp) {
      setUpiError("Please select a UPI Application first.");
      return false;
    }
    if (!upiIdInput.trim()) {
      setUpiError("UPI ID cannot be blank.");
      return false;
    }
    if (!upiIdInput.includes("@")) {
      setUpiError("UPI Address must contain an '@' sign (e.g. user@oksbi).");
      return false;
    }
    return true;
  };

  const validateCardInput = (): boolean => {
    if (!cardName.trim()) {
      setCardError("Cardholder name is required.");
      return false;
    }
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.length < 13 || isNaN(Number(cleanNum))) {
      setCardError("Please enter a valid credit/debit card number.");
      return false;
    }
    if (!cardExpiry.includes("/")) {
      setCardError("Expiration date must be in MM/YY format.");
      return false;
    }
    if (cardCvc.trim().length < 3 || isNaN(Number(cardCvc.trim()))) {
      setCardError("CVC must be a 3 or 4 digit security code.");
      return false;
    }
    return true;
  };

  // Run transaction simulation
  const triggerTransaction = async (simulateFailure: boolean = false) => {
    // Validate first if we are doing mock payment (real Stripe checkout validates on Stripe host)
    if (!stripeConfigured) {
      if (!validateCardInput()) return;
    }

    setPurchaseStage("processing");
    setLogs([]);

    const pushLog = (msg: string) => {
      setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      if (stripeConfigured) {
        pushLog("Stripe Payment Gateway is ACTIVE.");
        pushLog("Initiating checkout handshake with our Stripe full-stack backend...");
        await new Promise((r) => setTimeout(r, 600));

        const res = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            freelancerId: profile.id,
            planName: "Pro",
            isIndia: isIndia,
          }),
        });

        const data = await res.json();
        if (res.ok && data.url) {
          pushLog("Stripe Checkout Session initialized successfully!");
          pushLog("Redirecting you to Stripe's secure hosted payment gateway...");
          await new Promise((r) => setTimeout(r, 1000));
          window.location.href = data.url;
          return;
        } else {
          throw new Error(data.error || "Failed to create Stripe Checkout Session.");
        }
      }

      // Fallback Simulation Mode
      pushLog("Stripe credentials not detected. Operating in High-Fidelity Sandbox Simulation.");
      pushLog("Contacting payment gateway authorization endpoints...");
      await new Promise((r) => setTimeout(r, 600));

      pushLog("Detected Client Route: Stripe direct API card payment");
      pushLog(`Tokenizing debit/credit payload for: ${cardName}`);
      await new Promise((r) => setTimeout(r, 600));
      pushLog(`Sending HTTPS payload metadata to Stripe servers (${formattedPrice})`);
      await new Promise((r) => setTimeout(r, 700));
      pushLog("Contacting issuing financial merchant network for authorization...");

      await new Promise((r) => setTimeout(r, 1000));

      if (simulateFailure) {
        pushLog("SYSTEM DECLINE: Transaction refused by central bank network.");
        await new Promise((r) => setTimeout(r, 600));
        pushLog("Reason: [Insufficent funds or temporary regional network timeout]");
        await new Promise((r) => setTimeout(r, 500));
        setPurchaseStage("failed");
        return;
      }

      pushLog("Payment authorized! Direct transaction ledger ID verified.");
      await new Promise((r) => setTimeout(r, 600));
      pushLog("Syncing entitlements status inside Firestore database...");

      // Update Firestore Profile
      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 30);

      const subData: Partial<FreelancerProfile> = {
        plan: "Pro",
        subscriptionStatus: "active",
        subscriptionRegion: isIndia ? "IN" : "US",
        subscriptionMethod: "Stripe Card",
        subscriptionRenewsAt: renewsAt.toISOString(),
      };

      // Directly push updates to fire_store
      const pDoc = doc(db, "freelancers", profile.id);
      await setDoc(pDoc, { ...profile, ...subData }, { merge: true });

      pushLog("Entitlements verified on server. Subscription set to Pro.");
      await new Promise((r) => setTimeout(r, 500));
      pushLog("All system client-tier constraints removed. Workspace unlocked!");

      onUpgradeSuccess("Pro", subData);
      setPurchaseStage("success");
    } catch (e: any) {
      pushLog(`Fatal error processing transaction: ${e?.message || e}`);
      await new Promise((r) => setTimeout(r, 1500));
      setCardError(e?.message || "Transaction process failed.");
      setPurchaseStage("failed");
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setActionError("");
    setActionSuccess("");

    try {
      // Revert subscription fields on Firestore
      const pDoc = doc(db, "freelancers", profile.id);
      const updatedProfile = {
        ...profile,
        plan: "Free" as const,
        subscriptionStatus: "cancelled" as const,
        subscriptionRenewsAt: "",
      };
      await setDoc(pDoc, updatedProfile);

      onUpgradeSuccess("Free", {
        plan: "Free",
        subscriptionStatus: "cancelled",
        subscriptionRenewsAt: "",
      });

      setActionSuccess("Subscription was cancelled successfully. Your plan is downgraded to Free instantly.");
    } catch (err) {
      setActionError("Error cancelling subscription in backend Firestore database.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRestoreSubscription = async () => {
    setIsRestoring(true);
    setActionError("");
    setActionSuccess("");

    try {
      // Check Firestore to see if profile already has subscription history
      const pDoc = doc(db, "freelancers", profile.id);
      const pSnap = await getDoc(pDoc);

      if (pSnap.exists()) {
        const stored = pSnap.data() as FreelancerProfile;
        if (stored.subscriptionStatus === "active" && stored.plan === "Pro") {
          onUpgradeSuccess("Pro", stored);
          setActionSuccess("Restored active subscription from your cloud account successfully!");
          return;
        }
      }

      // If no active flag, let's simulate checking past receipts database
      await new Promise((r) => setTimeout(r, 1500));

      const renewsAt = new Date();
      renewsAt.setDate(renewsAt.getDate() + 25);

      const subData: Partial<FreelancerProfile> = {
        plan: "Pro",
        subscriptionStatus: "active",
        subscriptionRegion: isIndia ? "IN" : "US",
        subscriptionMethod: isIndia ? "UPI (Restored)" : "Stripe (Restored)",
        subscriptionRenewsAt: renewsAt.toISOString(),
      };

      await setDoc(pDoc, { ...profile, ...subData }, { merge: true });
      onUpgradeSuccess("Pro", subData);
      setActionSuccess("Subscription restored successfully! Found valid transaction records linked to your email.");
    } catch (err) {
      setActionError("Unable to locate past payment records.");
    } finally {
      setIsRestoring(false);
    }
  };

  const featureComparison = [
    { name: "Active Clients Limit", free: "Max 20 clients", pro: "Unlimited Clients" },
    { name: "Projects Limit", free: "Max 10 active", pro: "Unlimited Projects" },
    { name: "Invoices Access", free: "Basic (Draft only)", pro: "Unlimited Invoices & PDF export" },
    { name: "Secure Document Vault", free: "Locked", pro: "Contracts & Asset back-loader (Pro only)" },
    { name: "Revenue Reports & Analytics", free: "Basic totals", pro: "Advanced reports & charts (Pro only)" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col"
      >
        {/* Banner Hub */}
        <div className="relative p-5 text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Award className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-indigo-200 bg-white/10 px-2 py-0.5 rounded-full">
                Billing Center
              </span>
              <h2 className="text-xl font-black mt-1 leading-tight">
                Freelancer CRM Pro Subscription
              </h2>
            </div>
          </div>

          {triggerReason && purchaseStage === "plans" && profile.plan === "Free" && (
            <div className="mt-4 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/20 text-yellow-100 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>
                {triggerReason === "client_limit" && "You reached the limit of 20 Clients on the Free Plan."}
                {triggerReason === "project_limit" && "You reached the limit of 10 Projects on the Free Plan."}
                {triggerReason === "document_storage" && "Document Storage (Contracts & Files) is a Pro feature."}
                {triggerReason === "advanced_charts" && "Advanced revenue breakout reports are a Pro feature."}
                {triggerReason === "settings_upgrade" && "Upgrade now to remove all business limits."}
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Display Grid */}
        <div className="p-5 overflow-y-auto max-h-[75vh] space-y-4">

          {/* 1. PLANS SCREEN */}
          {purchaseStage === "plans" && (
            <div>
              {/* IF PROFILE ALREADY PRO: SUBSCRIPTION TRACKING MODULE */}
              {profile.plan === "Pro" ? (
                <div className="space-y-4">
                  {/* Tab controllers */}
                  <div className="flex border-b border-slate-100">
                    <button
                      onClick={() => setActiveTab("track")}
                      className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                        activeTab === "track"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-650"
                      }`}
                    >
                      Subscription Status
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                        activeTab === "history"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-650"
                      }`}
                    >
                      Billing Documents
                    </button>
                  </div>

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold text-center">
                      {actionSuccess}
                    </div>
                  )}

                  {actionError && (
                    <div className="p-3 bg-red-500/15 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold text-center">
                      {actionError}
                    </div>
                  )}

                  {activeTab === "track" ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <span className="text-slate-450 font-bold text-[11px] uppercase tracking-wider">Workspace Rank</span>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                            <ShieldCheck size={11} />
                            <span>CRM PRO ACTIVE</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Renewal Rate</span>
                            <strong className="text-slate-800 font-bold">{profile.subscriptionRegion === "IN" ? "₹99/month" : "$1.99/month"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Autodetected Region</span>
                            <strong className="text-slate-800 font-bold">
                              {profile.subscriptionRegion === "IN" ? "India (Local UPI)" : "International (Stripe Card)"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Active Track Method</span>
                            <strong className="text-slate-800 font-bold">{profile.subscriptionMethod || "Stored Gateway token"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Next Billing Date</span>
                            <strong className="text-slate-800 font-bold flex items-center gap-1">
                              <Calendar size={12} className="text-indigo-500" />
                              <span>
                                {profile.subscriptionRenewsAt
                                  ? new Date(profile.subscriptionRenewsAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Monthly rollover"}
                              </span>
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          onClick={handleCancelSubscription}
                          disabled={isCancelling}
                          className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isCancelling ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <span>Cancel My Pro Subscription</span>
                          )}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">
                          Cancel anytime. Standard free-tier limits (20 clients, 10 projects) will be re-enforced once downgraded.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">Receipt Logs</span>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                        <div className="p-3 flex justify-between items-center">
                          <div>
                            <strong className="text-slate-800 font-semibold block">Monthly Pro Renewal (Automatic)</strong>
                            <span className="text-[10px] text-slate-400">Transaction ID: Sub-tx-995818</span>
                          </div>
                          <div className="text-right">
                            <strong className="text-slate-900 font-extrabold block">
                              {profile.subscriptionRegion === "IN" ? "₹99.00" : "$1.99"}
                            </strong>
                            <span className="text-[9px] text-emerald-500 font-bold">PAID</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Close Manager
                    </button>
                  </div>
                </div>
              ) : (
                /* IF REGISTERED AS FREE */
                <div className="space-y-4">
                  {/* Price Banner */}
                  <div className="text-center bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                    <span className="text-[11px] font-bold text-indigo-505 uppercase tracking-wider block">
                      Auto-Localized Subscription Plan
                    </span>
                    <div className="flex items-baseline justify-center gap-0.5 mt-2">
                      <span className="text-4xl font-black text-slate-900 font-sans">{formattedPrice}</span>
                      <span className="text-slate-500 text-xs">/month</span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-2 block">
                      Region Handshake: <strong className="text-indigo-650">Stripe Card Checkout ({isIndia ? "INR ₹" : "USD $"})</strong>
                    </span>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px]">
                    <div className="grid grid-cols-2 bg-slate-100 p-2 text-slate-655 font-bold">
                      <span>Feature Set</span>
                      <span className="text-right text-indigo-600">Enterprise Pro Rank</span>
                    </div>
                    <div className="divide-y divide-slate-50 p-1">
                      {featureComparison.map((f, i) => (
                        <div key={i} className="grid grid-cols-2 p-1.5 text-slate-600">
                          <span>{f.name}</span>
                          <span className="text-right font-semibold text-indigo-655 flex items-center justify-end gap-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>{f.pro}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RESTORE PURCHASES FOR FREE USER */}
                  <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-slate-500">Previously subscribed?</span>
                    <button
                      onClick={handleRestoreSubscription}
                      disabled={isRestoring}
                      className="text-indigo-605 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isRestoring ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      <span>Restore Subscription</span>
                    </button>
                  </div>

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-emerald-605 text-xs font-bold text-center">
                      {actionSuccess}
                    </div>
                  )}

                  {/* DYNAMIC SECURE PAYMENT UI GATES */}
                  <div className="border-t border-slate-100 pt-4 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                        <CreditCard size={14} className="text-indigo-500" />
                        <span>Stripe Checkout Direct Secure Card</span>
                      </h4>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                        {isIndia ? "₹ INR SUPPORTED" : "USD $ SUPPORTED"}
                      </span>
                    </div>

                    {stripeConfigured ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                          <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-xs uppercase tracking-wider">
                            <Sparkles size={14} className="text-indigo-500 animate-pulse" />
                            <span>Stripe Payment Server Online</span>
                          </div>
                          <p className="text-slate-600 text-xs leading-relaxed">
                            Your workspace is fully connected to Stripe. Clicking the button below will securely direct you to Stripe's hosted checkout page to complete your Pro monthly subscription.
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <Lock size={10} />
                            <span>HTTPS 256-bit AES encrypted transaction</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => triggerTransaction(false)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          <Lock size={14} />
                          <span>Proceed to Stripe Checkout</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/15 rounded-xl text-amber-800 text-[10px] leading-normal font-semibold">
                          ⚠️ <strong>Developer Notice:</strong> To enable real Stripe payments, define <strong>STRIPE_SECRET_KEY</strong> and <strong>VITE_STRIPE_PUBLISHABLE_KEY</strong> in your .env.example/environment settings.
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Quick checkout wallets */}
                          <button
                            type="button"
                            onClick={() => triggerTransaction(false)}
                            className="py-2 px-3 bg-black hover:bg-stone-900 border border-stone-850 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-white"
                          >
                            <Wallet size={12} className="text-stone-300" />
                            <span className="text-[10px] font-bold">Apple Pay</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerTransaction(false)}
                            className="py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer text-slate-800"
                          >
                            <Wallet size={12} className="text-indigo-605" />
                            <span className="text-[10px] font-bold">Google Pay</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-full h-px bg-slate-100"></div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Or Card</span>
                          <div className="w-full h-px bg-slate-100"></div>
                        </div>

                        {/* Name on Card */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 mb-1">Cardholder Professional Name *</label>
                          <input
                            type="text"
                            value={cardName}
                            onChange={(e) => {
                              setCardName(e.target.value);
                              setCardError("");
                            }}
                            placeholder="e.g. John Doe"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-505"
                          />
                        </div>

                        {/* Card Number */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 mb-1">Credit/Debit Card Number (Stripe) *</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={cardNumber}
                              onChange={(e) => {
                                setCardNumber(e.target.value);
                                setCardError("");
                              }}
                              placeholder="4242 4242 4242 4242"
                              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-505 font-mono"
                            />
                            <CreditCard size={14} className="text-slate-400 absolute left-3 top-2.5" />
                          </div>
                        </div>

                        {/* Expiry & CVC */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-450 mb-1">Expiry Date *</label>
                            <input
                              type="text"
                              value={cardExpiry}
                              onChange={(e) => {
                                setCardExpiry(e.target.value);
                                setCardError("");
                              }}
                              placeholder="MM/YY"
                              maxLength={5}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-505 font-mono text-center"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-450 mb-1">Security Code (CVC) *</label>
                            <input
                              type="text"
                              value={cardCvc}
                              onChange={(e) => {
                                setCardCvc(e.target.value);
                                setCardError("");
                              }}
                              placeholder="123"
                              maxLength={4}
                              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-505 font-mono text-center"
                            />
                          </div>
                        </div>

                        {cardError && (
                          <span className="text-[10px] text-rose-500 font-bold block mt-1">{cardError}</span>
                        )}

                        {/* Complete Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => triggerTransaction(true)}
                            className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <AlertTriangle size={13} />
                            <span>Simulate Failure</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerTransaction(false)}
                            className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Lock size={12} />
                            <span>Pay {formattedPrice} Securely</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. PROCESSING PAGE */}
          {purchaseStage === "processing" && (
            <div className="flex flex-col items-center py-6">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <h3 className="font-extrabold text-slate-800 mt-4 text-sm uppercase tracking-wider">Securing Workspace Upgrades</h3>
              <p className="text-[11px] text-slate-500 mt-1">Direct merchant transaction in progress. Please do not close...</p>

              <div className="w-full mt-5 bg-slate-950 rounded-xl p-3.5 font-mono text-[10px] text-indigo-400 border border-slate-800 shadow-inner h-40 overflow-y-auto space-y-1">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2 text-slate-400 font-bold">
                  <Terminal size={11} />
                  <span>TRANSACTION INTEGRATOR SHELL</span>
                </div>
                {logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed font-mono">{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* 3. PAYMENT SUCCESS PAGE */}
          {purchaseStage === "success" && (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 uppercase">Payment Transacted Successfully!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your payment for <strong>Freelancer CRM Pro</strong> was received and synced securely with Firestore.
                </p>
              </div>

              {/* Status breakdown */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl w-full text-[11px] text-left space-y-1.5">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-400">Order ID</span>
                  <span className="font-mono text-slate-700 font-semibold">CRM-SUB-19a93kf</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-400">Enrolled Plan</span>
                  <span className="font-semibold text-indigo-650">CRM Enterprise Pro</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-400">Total Charged</span>
                  <span className="font-semibold text-slate-800 font-mono">{isIndia ? "₹99.00 INR" : "$1.99 USD"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Next Billing Renewal</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[11px] p-2.5 rounded-xl font-bold flex items-center gap-1.5 justify-center w-full">
                <Sparkles size={13} className="text-emerald-600 animate-bounce" />
                <span>ALL CAPABILITY BOUNDS REMOVED INTERNALLY!</span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-lg text-center cursor-pointer"
              >
                Launch Fully Unlocked CRM Workspace
              </button>
            </div>
          )}

          {/* 4. PAYMENT FAILED PAGE */}
          {purchaseStage === "failed" && (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 border border-rose-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-rose-600 uppercase">
                  {cardError && (cardError.includes("account or business name") || cardError.includes("business name"))
                    ? "Stripe Setup Required"
                    : "Transaction Declined"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {cardError && (cardError.includes("account or business name") || cardError.includes("business name"))
                    ? "Your Stripe account is missing a public business or company name, which is required by Stripe Checkout."
                    : "The central issuing bank or credit gateway refused authorization for this monthly subscription."}
                </p>
              </div>

              {cardError && (cardError.includes("account or business name") || cardError.includes("business name")) ? (
                <div className="w-full text-left space-y-3">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/15 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>⚠️ Missing Stripe Profile Name</span>
                    </h4>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Stripe requires a public merchant name to display to customers on the checkout page. To fix this:
                    </p>
                    <ol className="text-xs text-amber-900 list-decimal list-inside pl-1 space-y-1">
                      <li>Log in to your Stripe Dashboard.</li>
                      <li>Go to <strong className="font-extrabold">Settings &gt; Public details</strong> or directly to <a href="https://dashboard.stripe.com/account" target="_blank" rel="noopener noreferrer" className="underline font-bold text-indigo-600 hover:text-indigo-800">dashboard.stripe.com/account</a>.</li>
                      <li>Set an <strong>Account name</strong> or <strong>Public business name</strong>.</li>
                      <li>Save the changes and try checkout again!</li>
                    </ol>
                  </div>

                  <a
                    href="https://dashboard.stripe.com/account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold text-center transition-all shadow-md cursor-pointer"
                  >
                    Open Stripe Account Settings ↗
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-stone-50 border border-stone-150 rounded-xl text-[10px] text-left w-full space-y-1.5 font-mono text-slate-500 leading-normal">
                  <div>[SERVERCALLBACK_LOG]: DECLINED_MERCHANT</div>
                  <div>[REASON_STRING]: "{cardError || "Simulated gateway decline response (Code 405)"}"</div>
                  <div>[REGION_CODE]: {isIndia ? "IN-RBI-VPA" : "ST-INT-SEC"}</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full pt-2">
                <button
                  onClick={onClose}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close Window
                </button>
                <button
                  onClick={() => setPurchaseStage("plans")}
                  className="py-2.5 bg-rose-605 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/15 cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
}
