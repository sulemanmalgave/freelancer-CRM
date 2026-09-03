import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Mail,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  KeyRound,
  Loader2,
  Building2,
  User,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { FreelancerProfile } from "../types";
import { connectGmailWithGSI } from "../services/gmailService";
import { getOrCreatePersistentDeviceId } from "../utils";

interface ConnectExistingAccountProps {
  onBack: () => void;
  onAccountConnected: (profile: FreelancerProfile) => void;
  initialToken?: string | null;
  initialCode?: string | null;
}

export default function ConnectExistingAccount({
  onBack,
  onAccountConnected,
  initialToken,
  initialCode,
}: ConnectExistingAccountProps) {
  // Screen mode: "options" | "email" | "code"
  const [activeView, setActiveView] = useState<"options" | "email" | "code">("options");

  // QR / Deep-link Pairing State
  const [pairingToken, setPairingToken] = useState<string | null>(initialToken || null);
  const [pairingCode, setPairingCode] = useState<string>(initialCode || "");
  const [pairingStatus, setPairingStatus] = useState<"checking" | "valid" | "expired" | "invalid" | "none">(
    initialToken || initialCode ? "checking" : "none"
  );
  const [workspacePreview, setWorkspacePreview] = useState<{
    id?: string;
    name?: string;
    businessName?: string;
    plan?: string;
    currency?: string;
    email?: string;
  } | null>(null);

  // Form states
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState("");

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const isSubmittingRef = React.useRef(false);

  // Inspect QR or Deep-Link Token on Mount
  useEffect(() => {
    const token = initialToken || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("mobile_connect") : null);
    const code = initialCode || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("connect_code") : null);

    if (token || code) {
      if (token) setPairingToken(token);
      if (code) setPairingCode(code);
      inspectPairingSession(token || undefined, code || undefined);
    }
  }, [initialToken, initialCode]);

  const inspectPairingSession = async (token?: string, code?: string) => {
    setPairingStatus("checking");
    setErrorMsg("");
    try {
      const res = await fetch("/api/mobile/pairing-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairingToken: token,
          pairingCode: code,
        }),
      });

      const data = await res.json();
      if (data.valid && data.profilePreview) {
        setPairingStatus("valid");
        setWorkspacePreview(data.profilePreview);
      } else if (data.error === "expired") {
        setPairingStatus("expired");
        setErrorMsg("This connection code has expired.");
      } else {
        setPairingStatus("invalid");
        setErrorMsg(
          data.message || "Unable to connect your account. Please try again."
        );
      }
    } catch {
      setPairingStatus("invalid");
      setErrorMsg("Unable to connect your account. Please try again.");
    }
  };

  // Helper to complete device registration & workspace connection
  const finishConnection = useCallback(
    (profile: FreelancerProfile, deviceId?: string) => {
      setIsLoading(false);
      setSuccessMsg("Connected successfully");

      // Ensure profile has onboardingCompleted: true so the user is never sent to onboarding
      const completeProfile: FreelancerProfile = {
        ...profile,
        onboardingCompleted: true,
      };

      // Save credentials & active profile
      localStorage.setItem("crm_profile", JSON.stringify(completeProfile));
      if (deviceId) {
        localStorage.setItem("crm_mobile_device_id", deviceId);
      }

      // Clean URL if connect query params exist
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Short delay for user to see success confirmation then open workspace
      setTimeout(() => {
        onAccountConnected(completeProfile);
      }, 500);
    },
    [onAccountConnected]
  );

  // Link device to workspace after authentication if pairing session active
  const linkDeviceIfPairing = async (freelancerId: string, email?: string) => {
    if (pairingToken || pairingCode) {
      try {
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
            pairingToken: pairingToken || undefined,
            pairingCode: pairingCode || undefined,
            clientDeviceId,
            freelancerId,
            userEmail: email,
            deviceName,
            platform,
            userAgent,
          }),
        });
        const data = await res.json();
        return data.device?.id;
      } catch (e) {
        console.warn("Device pairing register error:", e);
      }
    }
    return undefined;
  };

  // 1. Sign In with Google
  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg("");

    try {
      const googleProfile = await connectGmailWithGSI();
      if (!googleProfile || !googleProfile.email) {
        throw new Error("No Google account selected.");
      }

      // Lookup workspace with Google email
      const res = await fetch("/api/auth/lookup-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: googleProfile.email }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        const deviceId = await linkDeviceIfPairing(data.profile.id, googleProfile.email);
        finishConnection(data.profile, deviceId);
      } else {
        setErrorMsg(
          data.message || `No existing account was found for "${googleProfile.email}".`
        );
        setIsLoading(false);
      }
    } catch (err: any) {
      console.warn("Google sign-in error:", err);
      setErrorMsg(err.message || "Unable to connect your account. Please try again.");
      setIsLoading(false);
    }
  };

  // 2. Sign In with Email & Password
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!emailInput.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!passwordInput.trim()) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/email-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.profile) {
        const deviceId = await linkDeviceIfPairing(data.profile.id, emailInput.trim());
        finishConnection(data.profile, deviceId);
      } else if (res.status === 404 || data.error === "not_found") {
        setErrorMsg(
          data.message || `No existing account was found for "${emailInput.trim()}".`
        );
        setIsLoading(false);
      } else if (res.status === 401 || data.error === "invalid_password") {
        setErrorMsg("Incorrect password. Please try again.");
        setIsLoading(false);
      } else {
        setErrorMsg(data.message || "Unable to connect your account. Please try again.");
        setIsLoading(false);
      }
    } catch {
      setErrorMsg("Unable to connect your account. Please try again.");
      setIsLoading(false);
    }
  };

  // 3. Verify 6-Digit Manual Code
  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Atomic Double Submission Prevention: Guard both state & ref
    if (isLoading || isSubmittingRef.current) return;

    // 1. Normalize input: "295 111" -> "295111"
    const cleanCode = manualCodeInput.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setErrorMsg("Invalid connection code. Please check the code and try again.");
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
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
        finishConnection(data.profile, data.device?.id);
      } else if (res.status === 410 || data.error === "expired" || data.error === "used") {
        setPairingStatus("expired");
        setErrorMsg(
          data.message || "This connection code has expired. Generate a new code on your computer."
        );
      } else if (res.status === 404 || data.error === "invalid" || data.error === "workspace_not_found") {
        setErrorMsg(
          data.message || "Invalid connection code. Please check the code and try again."
        );
      } else {
        setErrorMsg(data.message || data.error || "Unable to connect your account. Please try again.");
      }
    } catch (networkErr) {
      console.error("[Mobile Connection] Network error during code verification:", networkErr);
      setErrorMsg("Unable to connect your account. Please check your network and try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };

  // Reset pairing session when code is expired or user wants to generate new code
  const handleResetForNewConnection = () => {
    setPairingStatus("none");
    setPairingToken(null);
    setPairingCode("");
    setErrorMsg("");
    setActiveView("options");
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Back button handler: if in subview, go to options; if in options, go to onboarding
  const handleBackClick = () => {
    if (activeView !== "options") {
      setActiveView("options");
      setErrorMsg("");
    } else {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200/80 relative"
      >
        {/* Navigation Bar / Back button */}
        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100">
          <button
            type="button"
            id="connect-account-back-btn"
            onClick={handleBackClick}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer py-1 px-2.5 -ml-2 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft size={16} />
            <span>&larr; Back</span>
          </button>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            <ShieldCheck size={13} />
            <span>Workspace Sync</span>
          </div>
        </div>

        {/* Title & Introduction */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md shadow-indigo-600/20">
            <Smartphone size={24} />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            CONNECT EXISTING ACCOUNT
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Already using Freelancer CRM? Connect this device to your existing workspace.
          </p>
        </div>

        {/* Success Alert Banner */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-sm"
            >
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <span className="block">{successMsg}</span>
                <span className="text-[10px] text-emerald-600 font-normal">Opening your workspace and synchronizing records...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expired QR / Token State */}
        {pairingStatus === "expired" && !successMsg && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Clock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-900">This connection code has expired.</h2>
              <p className="text-[11px] text-amber-700 mt-0.5 max-w-xs mx-auto leading-relaxed">
                Temporary connection tokens expire for your security. Please generate a new connection from desktop or sign in below.
              </p>
            </div>
            <button
              type="button"
              id="generate-new-connection-btn"
              onClick={handleResetForNewConnection}
              className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Generate New Code</span>
            </button>
          </div>
        )}

        {/* General Error Banner with Try Again */}
        {errorMsg && pairingStatus !== "expired" && !successMsg && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-2xl space-y-2 text-xs">
            <div className="flex items-start gap-2 text-red-700 font-medium">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="block font-bold">{errorMsg}</span>
              </div>
            </div>
            <div className="text-right">
              <button
                type="button"
                id="error-try-again-btn"
                onClick={() => setErrorMsg("")}
                className="text-[11px] font-bold text-red-700 hover:text-red-900 underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Active QR Session Preview Card */}
        {pairingStatus === "valid" && workspacePreview && !successMsg && (
          <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                Workspace Detected
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                <Clock size={11} className="text-amber-500" />
                Active Link
              </span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-indigo-100/80 shadow-2xs space-y-1">
              <div className="flex items-center justify-between">
                <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <User size={13} className="text-indigo-600" />
                  <span>{workspacePreview.name || "Freelancer Workspace"}</span>
                </div>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                  {workspacePreview.plan || "Free"} Plan
                </span>
              </div>
              {workspacePreview.businessName && (
                <div className="text-[11px] text-slate-600 flex items-center gap-1 font-medium">
                  <Building2 size={12} className="text-slate-400" />
                  <span>{workspacePreview.businessName}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-600 leading-tight font-medium">
              Authenticate below to connect this device to your workspace:
            </p>
          </div>
        )}

        {/* View 1: Main Connection Options */}
        {activeView === "options" && !successMsg && (
          <div className="space-y-3">
            {/* Sign In with Google Button */}
            <button
              type="button"
              id="signin-with-google-btn"
              disabled={isLoading}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-300 hover:border-slate-400 disabled:opacity-50 rounded-2xl text-xs font-bold text-slate-800 hover:text-indigo-600 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-2xs group"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-indigo-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>

            {/* Sign In with Email Button */}
            <button
              type="button"
              id="signin-with-email-btn"
              disabled={isLoading}
              onClick={() => {
                setActiveView("email");
                setErrorMsg("");
              }}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-300 hover:border-slate-400 disabled:opacity-50 rounded-2xl text-xs font-bold text-slate-800 hover:text-indigo-600 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs"
            >
              <Mail size={16} className="text-indigo-600" />
              <span>Sign in with Email</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center pt-2">
              <div className="border-t border-slate-200 w-full"></div>
              <span className="bg-white px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Or
              </span>
            </div>

            {/* 6-Digit Code Button */}
            <button
              type="button"
              id="toggle-code-entry-btn"
              onClick={() => {
                setActiveView("code");
                setErrorMsg("");
              }}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200/80 active:scale-[0.99] text-slate-700 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound size={14} className="text-slate-500" />
              <span>Enter 6-digit connection code from desktop</span>
            </button>
          </div>
        )}

        {/* View 2: EMAIL SIGN-IN FORM */}
        {activeView === "email" && !successMsg && (
          <form onSubmit={handleEmailSignIn} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  id="connect-email-input"
                  placeholder="you@company.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full text-xs py-2.5 px-3 pl-9 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-slate-900 bg-white"
                />
                <Mail size={15} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  id="connect-password-input"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setErrorMsg("");
                  }}
                  className="w-full text-xs py-2.5 px-3 pl-9 pr-9 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-slate-900 bg-white"
                />
                <KeyRound size={15} className="absolute left-3 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="submit-email-signin-btn"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("options");
                setErrorMsg("");
              }}
              className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              &larr; Other sign in options
            </button>
          </form>
        )}

        {/* View 3: 6-DIGIT CODE FORM */}
        {activeView === "code" && !successMsg && (
          <form onSubmit={handleManualCodeSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                6-Digit Desktop Connection Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                id="connect-manual-code-input"
                placeholder="482910"
                value={manualCodeInput}
                onChange={(e) => {
                  setManualCodeInput(e.target.value.replace(/\D/g, ""));
                  setErrorMsg("");
                }}
                className="w-full text-center tracking-[0.35em] font-mono text-lg font-bold py-3 px-3 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 text-slate-900 bg-white"
              />
              <p className="text-[11px] text-slate-500 mt-1.5 text-center leading-relaxed">
                Open Freelancer CRM on your computer &rarr; Settings &rarr; Mobile App to view your code.
              </p>
            </div>

            <button
              type="submit"
              id="submit-manual-code-btn"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
              <span>{isLoading ? "Connecting…" : "Verify Code & Connect"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView("options");
                setErrorMsg("");
              }}
              className="w-full py-2 text-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              &larr; Other sign in options
            </button>
          </form>
        )}

        {/* Footer Note */}
        <div className="mt-5 pt-3.5 border-t border-slate-100 text-center text-[10px] text-slate-400">
          Your existing Free or Pro subscription, clients, and CRM records are preserved securely.
        </div>
      </motion.div>
    </div>
  );
}
