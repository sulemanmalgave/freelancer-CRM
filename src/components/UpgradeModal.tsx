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
  Calendar,
  Lock,
  Wallet,
  Globe,
  DollarSign,
  Briefcase
} from "lucide-react";
import { FreelancerProfile } from "../types";
import { detectLocale } from "../utils";
import { db, auth } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FreelancerProfile;
  onUpgradeSuccess: (newPlan: "Pro" | "Free", subscriptionDetails?: Partial<FreelancerProfile>) => void;
  triggerReason?: string; // Reason why shown (e.g., "client_limit", "project_limit", "document_storage")
}

const getCountryName = (code: string) => {
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch (e) {
    const countryNames: Record<string, string> = {
      IN: "India",
      US: "United States",
      GB: "United Kingdom",
      CA: "Canada",
      AU: "Australia",
      DE: "Germany",
      FR: "France",
      SG: "Singapore",
      AE: "United Arab Emirates",
      JP: "Japan"
    };
    return countryNames[code] || code;
  }
};

export default function UpgradeModal({
  isOpen,
  onClose,
  profile,
  onUpgradeSuccess,
  triggerReason,
}: UpgradeModalProps) {
  const [purchaseStage, setPurchaseStage] = useState<"plans" | "processing" | "success" | "failed">("plans");
  const [selectedPlan, setSelectedPlan] = useState<"Monthly" | "3 Months">("Monthly");
  
  // Manual Country Selection
  const { country } = detectLocale();
  const [selectedCountry, setSelectedCountry] = useState<string>(
    profile?.billingCountry || profile?.country || country || "US"
  );
  const [isDetectingCountry, setIsDetectingCountry] = useState(false);
  const [detectionFailed, setDetectionFailed] = useState(false);
  const [showManualSelector, setShowManualSelector] = useState(false);

  // Dynamic settings fetched from backend secure config endpoint
  const [paymentConfig, setPaymentConfig] = useState<{
    razorpayKeyId: string;
    paypalClientId: string;
    razorpayConfigured: boolean;
    paypalConfigured: boolean;
    paypalPlanMonthly: string;
    paypalPlanQuarterly: string;
  } | null>(null);

  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [paymentError, setPaymentError] = useState("");

  const [activeTab, setActiveTab] = useState<"track" | "history">("track");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const isIndia = selectedCountry === "IN";

  // Calculate pricing based on manual region & selection
  const planDetails = {
    "Monthly": {
      amount: isIndia ? 199 : 4.99,
      currencySymbol: isIndia ? "₹" : "$",
      currencyCode: isIndia ? "INR" : "USD",
      label: "Monthly Pro Access",
      savingLabel: null,
    },
    "3 Months": {
      amount: isIndia ? 399 : 11.99,
      currencySymbol: isIndia ? "₹" : "$",
      currencyCode: isIndia ? "INR" : "USD",
      label: "3 Months Pro Saver",
      savingLabel: isIndia ? "Save 33% compared to monthly" : "Save 20% compared to monthly",
    }
  };

  const currentPlanInfo = planDetails[selectedPlan];
  const formattedPrice = `${currentPlanInfo.currencySymbol}${currentPlanInfo.amount}`;

  // Reset states when the modal is closed/opened
  useEffect(() => {
    if (isOpen) {
      setPurchaseStage("plans");
      setSelectedPlan("Monthly");
      setLogs([]);
      setPaymentError("");
      setIsCancelling(false);
      setIsRestoring(false);
      setActionError("");
      setActionSuccess("");
    }
  }, [isOpen]);

  // Geolocation country auto-detection on modal open
  useEffect(() => {
    if (isOpen) {
      setIsDetectingCountry(true);
      setDetectionFailed(false);
      setShowManualSelector(false);

      fetch("/api/detect-country")
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success && data.country) {
            setSelectedCountry(data.country);
            setDetectionFailed(false);
            setShowManualSelector(false);
          } else {
            console.warn("[GeoIP] Auto-detection returned success=false:", data);
            setDetectionFailed(true);
            setShowManualSelector(true);
          }
        })
        .catch((err) => {
          console.error("[GeoIP] Fetch error during auto-detection:", err);
          setDetectionFailed(true);
          setShowManualSelector(true);
        })
        .finally(() => {
          setIsDetectingCountry(false);
        });
    }
  }, [isOpen]);

  // Helper to fetch authorization header securely
  const getAuthHeader = async () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken(true);
        return { "Authorization": `Bearer ${idToken}` };
      }
    } catch (e) {
      console.warn("Failed to retrieve Firebase ID token:", e);
    }
    return {};
  };

  // Save manual country change to cloud and sync state
  const handleCountryChange = async (newCountry: string) => {
    setSelectedCountry(newCountry);
    try {
      const pDoc = doc(db, "freelancers", profile.id);
      await setDoc(pDoc, { billingCountry: newCountry, country: newCountry }, { merge: true });
      console.log(`Saved manual billingCountry "${newCountry}" to Firestore profile.`);
    } catch (e) {
      console.error("Failed to save manual billingCountry to profile:", e);
    }
  };

  // Fetch Payment configuration and load SDK scripts dynamically
  useEffect(() => {
    if (isOpen) {
      setIsLoadingConfig(true);
      fetch(`/api/payment/config?freelancerId=${profile?.id || ""}`)
        .then((r) => r.json())
        .then((data) => {
          setPaymentConfig(data);
          setIsLoadingConfig(false);

          // 1. Dynamic Script Loading for Razorpay (India)
          if (isIndia) {
            if (window.hasOwnProperty("Razorpay")) {
              setRazorpayLoaded(true);
            } else {
              const rzpScript = document.createElement("script");
              rzpScript.src = "https://checkout.razorpay.com/v1/checkout.js";
              rzpScript.async = true;
              rzpScript.onload = () => setRazorpayLoaded(true);
              rzpScript.onerror = () => console.error("Failed to load Razorpay SDK");
              document.body.appendChild(rzpScript);
            }
          }

          // 2. Dynamic Script Loading for PayPal Subscriptions (International)
          if (!isIndia) {
            const oldScript = document.getElementById("paypal-sdk-script");
            if (oldScript) {
              oldScript.remove();
            }

            const ppScript = document.createElement("script");
            ppScript.id = "paypal-sdk-script";
            // Important: Use vault=true and intent=subscription for Subscriptions SDK routing
            ppScript.src = `https://www.paypal.com/sdk/js?client-id=${data.paypalClientId}&vault=true&intent=subscription`;
            ppScript.async = true;
            ppScript.onload = () => setPaypalLoaded(true);
            ppScript.onerror = () => console.error("Failed to load PayPal Subscriptions SDK");
            document.body.appendChild(ppScript);
          }
        })
        .catch((err) => {
          console.error("Error loading secure configurations:", err);
          setIsLoadingConfig(false);
        });
    }
  }, [isOpen, isIndia]);

  // Handle dynamic PayPal Subscriptions Buttons mounting
  useEffect(() => {
    if (paypalLoaded && purchaseStage === "plans" && !isIndia && paymentConfig) {
      const container = document.getElementById("paypal-button-container");
      if (container) {
        // Clear children to avoid double-rendering on selection change
        container.innerHTML = "";
        try {
          (window as any).paypal.Buttons({
            style: {
              layout: "vertical",
              color: "gold",
              shape: "rect",
              label: "subscribe"
            },
            createSubscription: (data: any, actions: any) => {
              setPaymentError("");
              const targetPlanId = selectedPlan === "3 Months" 
                ? paymentConfig.paypalPlanQuarterly 
                : paymentConfig.paypalPlanMonthly;
              
              console.log(`[PayPal] Initiating subscription for plan: ${targetPlanId}`);
              return actions.subscription.create({
                plan_id: targetPlanId,
                custom_id: `${profile.id}:${selectedPlan === "3 Months" ? "quarterly" : "monthly"}`
              });
            },
            onApprove: async (data: any) => {
              setPurchaseStage("processing");
              setLogs([
                `[PayPal] Subscription Approved! ID: ${data.subscriptionID}`,
                "[PayPal] Contacting backend to verify billing agreement state..."
              ]);
              
              try {
                const authHeader = await getAuthHeader();
                const res = await fetch("/api/paypal/verify-subscription", {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    ...authHeader
                  },
                  body: JSON.stringify({
                    planId: selectedPlan === "3 Months" ? "quarterly" : "monthly",
                    subscriptionId: data.subscriptionID,
                    freelancerId: profile.id,
                  }),
                });
                
                const verifyResult = await res.json();
                if (verifyResult.success) {
                  setLogs((prev) => [...prev, "[PayPal] Subscription verified cryptographically! Provisioning active entitlements..."]);
                  
                  onUpgradeSuccess("Pro" as any, verifyResult.profile);
                  setPurchaseStage("success");
                } else {
                  throw new Error(verifyResult.error || "Subscription activation verification rejected.");
                }
              } catch (err: any) {
                console.error("PayPal Subscription verification Error:", err);
                setPaymentError(err.message || "Failed to verify PayPal subscription.");
                setPurchaseStage("failed");
              }
            },
            onCancel: (data: any) => {
              console.log("[PayPal] Subscription checkout was cancelled", data);
              setPaymentError("PayPal subscription checkout was cancelled.");
              setPurchaseStage("plans");
            },
            onError: (err: any) => {
              console.error("PayPal Subscription error:", err);
              setPaymentError("PayPal Subscription process was cancelled or refused by issuing network.");
              setPurchaseStage("failed");
            }
          }).render("#paypal-button-container");
        } catch (e) {
          console.error("PayPal subscription buttons rendering error:", e);
        }
      }
    }
  }, [paypalLoaded, purchaseStage, isIndia, selectedPlan, paymentConfig]);

  // Handle Razorpay Checkout Flow
  const handleRazorpayCheckout = async () => {
    setPaymentError("");
    setPurchaseStage("processing");
    setLogs([
      "[Razorpay] Communicating with secure billing engine...",
      "[Razorpay] Registering order parameters on merchant backend..."
    ]);

    try {
      const authHeader = await getAuthHeader();
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...authHeader
        },
        body: JSON.stringify({
          freelancerId: profile.id,
          planName: selectedPlan,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderData.success || !orderData.orderId) {
        throw new Error(orderData.error || "Failed to establish order on backend.");
      }

      setLogs((prev) => [
        ...prev,
        `[Razorpay] Created order securely: ${orderData.orderId}`,
        "[Razorpay] Launching native payment gateway panel overlay..."
      ]);

      const keyId = paymentConfig?.razorpayKeyId || "";
      if (!keyId) {
        throw new Error("Razorpay Key ID is not configured. Please verify your workspace settings.");
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Freelancer CRM",
        description: `${selectedPlan} Pro Subscription`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          setLogs((prev) => [
            ...prev,
            "[Razorpay] Authorized! Received secure transaction signature.",
            "[Razorpay] Transmitting signature token to verification server..."
          ]);

          try {
            const verificationAuthHeader = await getAuthHeader();
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                ...verificationAuthHeader
              },
              body: JSON.stringify({
                freelancerId: profile.id,
                planName: selectedPlan,
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyResult = await verifyRes.json();
            if (verifyResult.success) {
              setLogs((prev) => [...prev, "[Razorpay] Signature validated successfully! Synced entitlements."]);
              
              onUpgradeSuccess("Pro" as any, verifyResult.profile);
              setPurchaseStage("success");
            } else {
              throw new Error(verifyResult.error || "Signature validation refused by gateway server.");
            }
          } catch (verErr: any) {
            console.error("Razorpay Signature Verification Error:", verErr);
            setPaymentError(verErr.message || "Failed to verify transaction signature securely.");
            setPurchaseStage("failed");
          }
        },
        prefill: {
          name: profile.name || "",
          email: "billing@freelancercrm.com",
        },
        theme: {
          color: "#4F46E5",
        },
        modal: {
          ondismiss: function () {
            setPurchaseStage("plans");
          }
        }
      };

      if ((window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        console.error("Razorpay SDK was not loaded. Cannot proceed with payment.");
        setPaymentError("Razorpay checkout could not be loaded because the SDK script is blocked or unavailable. Please disable ad-blockers or content-blockers and try again.");
        setPurchaseStage("failed");
      }
    } catch (err: any) {
      console.error("Razorpay Checkout Launch Error:", err);
      setPaymentError(err.message || "Failed to open Razorpay checkout window.");
      setPurchaseStage("failed");
    }
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    setActionError("");
    setActionSuccess("");

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to cancel subscription on the server.");
      }

      onUpgradeSuccess("Free", data.profile);
      setActionSuccess("Your active Pro subscription was cancelled successfully. Workspace downgraded to Free.");
    } catch (err: any) {
      setActionError(err.message || "Error cancelling subscription on backend.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRestoreSubscription = async () => {
    setIsRestoring(true);
    setActionError("");
    setActionSuccess("");

    try {
      const pDoc = doc(db, "freelancers", profile.id);
      const pSnap = await getDoc(pDoc);

      if (pSnap.exists()) {
        const stored = pSnap.data() as FreelancerProfile;
        if (stored.premium === true || (stored.plan && stored.plan !== "Free")) {
          onUpgradeSuccess("Pro" as any, stored);
          setActionSuccess("Restored active subscription state from your cloud profile successfully!");
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
      setActionError("No active subscription entitlements were found for this account on the server.");
    } catch (err) {
      setActionError("Unable to locate valid billing parameters on your account.");
    } finally {
      setIsRestoring(false);
    }
  };

  const featureComparison = [
    { name: "Active Clients Limit", free: "Max 20 clients", pro: "Unlimited Clients" },
    { name: "Projects Limit", free: "Max 10 active", pro: "Unlimited Projects" },
    { name: "Invoices Access", free: "Basic (Draft only)", pro: "Unlimited Invoices & PDF export" },
    { name: "Secure Document Vault", free: "Locked", pro: "Contracts & Asset Back-Loader" },
    { name: "Revenue Reports & Analytics", free: "Basic totals", pro: "Advanced Reports & SVG Charts" },
  ];

  if (!isOpen) return null;

  const isConfigured = isIndia ? paymentConfig?.razorpayConfigured : paymentConfig?.paypalConfigured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
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
              <span className="text-[10px] uppercase tracking-widest font-black text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full">
                Billing Manager
              </span>
              <h2 className="text-xl font-black mt-1 leading-tight">
                Freelancer CRM Pro
              </h2>
            </div>
          </div>

          {triggerReason && purchaseStage === "plans" && (!profile.premium && profile.plan === "Free") && (
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
              {/* IF PROFILE ALREADY PREMIUM */}
              {profile.premium === true || profile.plan !== "Free" ? (
                <div className="space-y-4">
                  {/* Tab controllers */}
                  <div className="flex border-b border-slate-100">
                    <button
                      onClick={() => setActiveTab("track")}
                      className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                        activeTab === "track"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Subscription Status
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className={`flex-1 pb-2.5 text-xs font-bold border-b-2 transition-all ${
                        activeTab === "history"
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Billing Details
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
                          <span className="text-slate-400 font-bold text-[11px] uppercase tracking-wider">Workspace Level</span>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                            <ShieldCheck size={11} />
                            <span>CRM PRO ACTIVE</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Tier Level</span>
                            <strong className="text-slate-800 font-bold capitalize">{profile.plan} Plan</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Autodetected Region</span>
                            <strong className="text-slate-800 font-bold">
                              {profile.subscriptionRegion === "IN" ? "India (Razorpay)" : "International (PayPal)"}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Active Provider</span>
                            <strong className="text-slate-800 font-bold">{profile.paymentGateway || profile.subscriptionMethod || "Stored Gateway"}</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Billing Cycle Date</span>
                            <strong className="text-slate-800 font-bold flex items-center gap-1">
                              <Calendar size={12} className="text-indigo-500" />
                              <span>
                                {profile.subscriptionRenewsAt
                                  ? new Date(profile.subscriptionRenewsAt).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Rollover state"}
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
                            <span>Downgrade back to Free Tier</span>
                          )}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">
                          Downgrading will re-enforce the standard limits (20 clients, 10 projects) instantly.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <span className="text-slate-400 font-bold block mb-1">Entitlements Metadata Log</span>
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 p-3 space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">Transaction/Capture ID</span>
                          <span className="font-mono text-slate-700 font-bold break-all">{profile.transactionId || "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2">
                          <span className="text-slate-400">Purchase Date</span>
                          <span className="text-slate-700 font-semibold">{profile.purchaseDate ? new Date(profile.purchaseDate).toLocaleString() : "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2">
                          <span className="text-slate-400">Expiration Date</span>
                          <span className="text-slate-700 font-semibold">{profile.expiryDate ? new Date(profile.expiryDate).toLocaleString() : "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-[11px] pt-2">
                          <span className="text-slate-400">Payment Channel</span>
                          <span className="text-indigo-600 font-bold">{profile.paymentGateway || "N/A"}</span>
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
                  {/* Localized Price Banner Selector with Interactive Selector */}
                  <div className="space-y-3">
                    {isDetectingCountry ? (
                      <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-center gap-2 border border-slate-100 shadow-sm">
                        <RefreshCw size={14} className="text-indigo-600 animate-spin" />
                        <span className="text-xs font-semibold text-slate-500 animate-pulse">Detecting your billing country...</span>
                      </div>
                    ) : showManualSelector ? (
                      <div className="bg-slate-100 p-3 rounded-xl space-y-2 border border-slate-200">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Globe size={11} className="text-indigo-600 animate-spin" />
                            <span>Select Billing Country / Region (Manual Override)</span>
                          </label>
                          <select
                            value={selectedCountry}
                            onChange={(e) => handleCountryChange(e.target.value)}
                            className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all cursor-pointer"
                          >
                            <option value="IN">🇮🇳 India (₹ INR Plan - Razorpay)</option>
                            <option value="US">🇺🇸 United States ($ USD Plan - PayPal)</option>
                            <option value="GB">🇬🇧 United Kingdom ($ USD Plan - PayPal)</option>
                            <option value="CA">🇨🇦 Canada ($ USD Plan - PayPal)</option>
                            <option value="AU">🇦🇺 Australia ($ USD Plan - PayPal)</option>
                            <option value="DE">🇩🇪 Germany ($ USD Plan - PayPal)</option>
                            <option value="FR">🇫🇷 France ($ USD Plan - PayPal)</option>
                            <option value="SG">🇸🇬 Singapore ($ USD Plan - PayPal)</option>
                            <option value="AE">🇦🇪 United Arab Emirates ($ USD Plan - PayPal)</option>
                            <option value="JP">🇯🇵 Japan ($ USD Plan - PayPal)</option>
                          </select>
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold text-center">
                          Billing region dictates payment router & pricing currency code.
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-100 p-3.5 rounded-xl flex items-center justify-between gap-3 border border-slate-200">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <Globe size={14} className="text-emerald-600 animate-pulse" />
                          <span>
                            Detected region: <strong className="text-slate-900">{getCountryName(selectedCountry)}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowManualSelector(true)}
                          className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 hover:underline transition-all cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("Monthly")}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-center items-center relative ${
                          selectedPlan === "Monthly"
                            ? "border-indigo-600 bg-indigo-50/20 shadow-md shadow-indigo-600/5"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Monthly Plan</span>
                        <div className="flex items-baseline gap-0.5">
                          <strong className="text-xl font-black text-slate-900">
                            {isIndia ? "₹199" : "$4.99"}
                          </strong>
                          <span className="text-[10px] text-slate-400">/mo</span>
                        </div>
                        <span className="text-[9px] text-slate-450 mt-1">Flexible subscription</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPlan("3 Months")}
                        className={`p-3.5 rounded-2xl border text-center transition-all flex flex-col justify-center items-center relative ${
                          selectedPlan === "3 Months"
                            ? "border-indigo-600 bg-indigo-50/20 shadow-md shadow-indigo-600/5"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span className="absolute -top-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-full">Saver Pack</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">3 Months</span>
                        <div className="flex items-baseline gap-0.5">
                          <strong className="text-xl font-black text-slate-900">
                            {isIndia ? "₹399" : "$11.99"}
                          </strong>
                          <span className="text-[10px] text-slate-400">/total</span>
                        </div>
                        <span className="text-[8px] text-emerald-600 font-extrabold mt-1">
                          {isIndia ? "Save 33% (~₹133/mo)" : "Save 20% (~$3.99/mo)"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="border border-slate-100 rounded-xl overflow-hidden text-[11px] shadow-sm">
                    <div className="grid grid-cols-2 bg-slate-50 p-2 text-slate-500 font-bold border-b border-slate-100">
                      <span>Feature Matrix</span>
                      <span className="text-right text-indigo-600 uppercase">Pro Workspace Level</span>
                    </div>
                    <div className="divide-y divide-slate-50 p-1">
                      {featureComparison.map((f, i) => (
                        <div key={i} className="grid grid-cols-2 p-1.5 text-slate-600">
                          <span>{f.name}</span>
                          <span className="text-right font-semibold text-indigo-650 flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{f.pro}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RESTORE PURCHASES */}
                  <div className="flex justify-between items-center text-xs p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <span className="text-slate-500">Already paid from another machine?</span>
                    <button
                      onClick={handleRestoreSubscription}
                      disabled={isRestoring}
                      className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 text-[11px]"
                    >
                      {isRestoring ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <RefreshCw size={11} />
                      )}
                      <span>Restore Cloud License</span>
                    </button>
                  </div>

                  {actionSuccess && (
                    <div className="p-3 bg-emerald-500/15 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold text-center">
                      {actionSuccess}
                    </div>
                  )}

                  {paymentError && (
                    <div className="p-3 bg-rose-500/15 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-bold text-center flex items-center gap-1.5 justify-center">
                      <AlertCircle size={13} />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {/* DYNAMIC SECURE PAYMENT GATEWAYS */}
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Lock size={13} className="text-indigo-600 animate-pulse" />
                        <span>Secure Routed Gateway</span>
                      </h4>
                      <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">
                        {isIndia ? "Razorpay INR" : "PayPal USD"}
                      </span>
                    </div>

                    {isLoadingConfig ? (
                      <div className="py-4 flex justify-center items-center gap-2 text-slate-400 text-xs font-medium">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Initializing payment SDK configs...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Dev Sandbox simulation warning if credentials aren't loaded */}
                        {!isConfigured && (
                          <div className="p-3 border border-rose-500/20 bg-rose-500/10 text-rose-950 rounded-xl text-[10px] leading-normal font-semibold flex items-start gap-1.5">
                            <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              {isIndia ? (
                                <>
                                  <strong>Gateway Key Required:</strong> Your server-side Razorpay credentials are not configured. Please define <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in your environment variables to activate the checkout.
                                </>
                              ) : (
                                <>
                                  <strong>Gateway Key Required:</strong> Your server-side PayPal credentials are not configured. Please define <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> in your environment variables to activate the checkout.
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* RENDER RAZORPAY COMPONENT (INDIA) */}
                        {isIndia && (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={handleRazorpayCheckout}
                              disabled={!isConfigured}
                              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                            >
                              <Smartphone size={14} />
                              <span>Pay {formattedPrice} with Razorpay (UPI / Card)</span>
                            </button>
                            <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                              Accepts UPI (Google Pay, PhonePe, Paytm, BHIM), Cards (RuPay, Visa, Mastercard), Net Banking, and Wallets.
                            </p>
                          </div>
                        )}

                        {/* RENDER PAYPAL COMPONENT (OUTSIDE INDIA) */}
                        {!isIndia && (
                          <div className="space-y-3">
                            {isConfigured ? (
                              <div className="min-h-[100px] w-full" id="paypal-button-container" key={selectedPlan}>
                                {/* PayPal Script injects Buttons container here */}
                              </div>
                            ) : (
                              <div className="p-4 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-center text-xs space-y-2">
                                <Wallet size={18} className="mx-auto text-slate-400" />
                                <p className="font-semibold text-slate-700">PayPal Gateway Unconfigured</p>
                                <p className="text-[10px] text-slate-400 leading-normal">
                                  Your PayPal client ID is missing. Please define <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> in the server environment variables to initiate PayPal Checkout.
                                </p>
                              </div>
                            )}
                            <p className="text-[9px] text-slate-400 text-center leading-relaxed">
                              Pay securely via credit card, debit card, or international PayPal wallets. Verified by PayPal Merchant services.
                            </p>
                          </div>
                        )}
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
              <h3 className="font-extrabold text-slate-800 mt-4 text-sm uppercase tracking-wider">Contacting Central Broker</h3>
              <p className="text-[11px] text-slate-500 mt-1">Direct merchant transaction in progress. Please do not close...</p>

              <div className="w-full mt-5 bg-slate-950 rounded-xl p-3.5 font-mono text-[10px] text-indigo-400 border border-slate-800 shadow-inner h-40 overflow-y-auto space-y-1">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 mb-2 text-slate-400 font-bold">
                  <Terminal size={11} />
                  <span>SECURE GATEWAY INTEGRATOR TERMINAL</span>
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
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 border border-emerald-200 shadow-sm">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Purchase Successful!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your billing parameters were received and verified successfully. Cloud subscription unlocked!
                </p>
              </div>

              {/* Status breakdown */}
              <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl w-full text-[11px] text-left space-y-1.5">
                <div className="flex justify-between border-b border-slate-250/50 pb-1.5">
                  <span className="text-slate-400">Merchant Gateway</span>
                  <span className="font-semibold text-slate-700">{isIndia ? "Razorpay API Checkout" : "PayPal SDK Merchant"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-250/50 pb-1.5">
                  <span className="text-slate-400">Enrolled Plan</span>
                  <span className="font-extrabold text-indigo-600">{selectedPlan} Plan</span>
                </div>
                <div className="flex justify-between border-b border-slate-250/50 pb-1.5">
                  <span className="text-slate-400">Total Charged</span>
                  <span className="font-bold text-slate-800 font-mono">{formattedPrice} {currentPlanInfo.currencyCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entitlement Period</span>
                  <span className="font-semibold text-emerald-600">
                    Active for {selectedPlan === "Monthly" ? "1 Month" : "3 Months"}
                  </span>
                </div>
              </div>

              <div className="pt-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[10px] p-2.5 rounded-xl font-bold flex items-center gap-1.5 justify-center w-full">
                <Sparkles size={13} className="text-emerald-600 animate-bounce" />
                <span>WORKSPACE CAPACITY LIMITS REMOVED INTERNALLY!</span>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md text-center cursor-pointer"
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
                <h3 className="text-lg font-black text-rose-600 uppercase">Transaction Declined</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The merchant broker or issuing network refused authorization for this monthly subscription.
                </p>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] text-left w-full space-y-1.5 font-mono text-slate-500 leading-normal">
                <div>[SERVERCALLBACK_LOG]: TRANSACTION_ABORTED</div>
                <div>[REASON_STRING]: "{paymentError || "Direct merchant decline or validation timeout"}"</div>
                <div>[GATEWAY_PROVIDER]: {isIndia ? "Razorpay Core" : "PayPal API Proxy"}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full pt-2">
                <button
                  onClick={onClose}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close Window
                </button>
                <button
                  onClick={() => setPurchaseStage("plans")}
                  className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/15 cursor-pointer"
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
