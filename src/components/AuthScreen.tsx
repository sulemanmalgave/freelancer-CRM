import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  ChevronLeft,
} from "lucide-react";
import { FreelancerProfile } from "../types";

interface AuthScreenProps {
  initialMode?: "signin" | "signup";
  onAuthSuccess: (profile: FreelancerProfile, token: string, collections?: any) => void;
  onConnectCode?: () => void;
}

export default function AuthScreen({
  initialMode = "signin",
  onAuthSuccess,
  onConnectCode,
}: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(initialMode);

  // Sign In state
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // Sign Up state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [previewCodeNotice, setPreviewCodeNotice] = useState<string | null>(null);

  // Status & UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Clear messages when switching views
  const switchMode = (newMode: "signin" | "signup" | "forgot") => {
    setMode(newMode);
    setErrorMessage("");
    setSuccessMessage("");
    setPreviewCodeNotice(null);
  };

  // 1. Handle Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validations
    if (!signupName.trim()) {
      setErrorMessage("Name is required.");
      return;
    }
    if (!signupEmail.trim()) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!emailRegex.test(signupEmail.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!signupPassword) {
      setErrorMessage("Password is required.");
      return;
    }
    if (signupPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (!signupConfirmPassword) {
      setErrorMessage("Confirm Password is required.");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setErrorMessage("Password and Confirm Password must match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
          confirmPassword: signupConfirmPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.profile) {
        setSuccessMessage("Account created successfully! Loading your workspace...");
        // Store session token safely (never passwords)
        if (data.token) {
          localStorage.setItem("crm_auth_token", data.token);
        }
        setTimeout(() => {
          onAuthSuccess(data.profile, data.token, data.collections);
        }, 300);
      } else if (res.status === 409 || data.error === "account_exists") {
        setErrorMessage("An account with this email address already exists. Please sign in instead.");
      } else {
        setErrorMessage(data.message || "Failed to create account. Please try again.");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!signinEmail.trim()) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!emailRegex.test(signinEmail.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!signinPassword) {
      setErrorMessage("Password is required.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signinEmail.trim(),
          password: signinPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.profile) {
        setSuccessMessage("Signed in successfully! Loading workspace...");
        if (data.token) {
          localStorage.setItem("crm_auth_token", data.token);
        }
        setTimeout(() => {
          onAuthSuccess(data.profile, data.token, data.collections);
        }, 300);
      } else if (res.status === 401 || data.error === "invalid_credentials") {
        setErrorMessage("Invalid email address or password. Please try again.");
      } else {
        setErrorMessage(data.message || "Failed to sign in. Please verify your credentials.");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle Forgot Password Request
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setPreviewCodeNotice(null);

    if (!forgotEmail.trim()) {
      setErrorMessage("Email is required.");
      return;
    }
    if (!emailRegex.test(forgotEmail.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setForgotStep("reset");
        setSuccessMessage("If an account exists with that email, a 6-digit verification code has been generated.");
        if (data.previewCode) {
          setPreviewCodeNotice(`Verification Code: ${data.previewCode}`);
          setResetCode(data.previewCode);
        }
      } else {
        setErrorMessage(data.message || "Failed to process password reset request.");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Handle Password Reset Completion
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!resetCode.trim()) {
      setErrorMessage("Verification code is required.");
      return;
    }
    if (!newPassword) {
      setErrorMessage("New password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage("New Password and Confirm Password must match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: resetCode.trim(),
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMessage("Password reset successfully! Please sign in with your new password.");
        setSigninEmail(forgotEmail.trim());
        setSigninPassword("");
        setTimeout(() => {
          switchMode("signin");
        }, 1500);
      } else {
        setErrorMessage(data.message || "Invalid or expired verification code.");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-5%] w-[45%] h-[45%] bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-modal rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 border border-slate-200/80"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-0.5 bg-transparent rounded-2xl flex items-center justify-center shrink-0 w-14 h-14 select-none mb-3 shadow-md shadow-indigo-600/10 ring-1 ring-slate-200/50">
            <img
              src="/icon-192.png"
              alt="Freelancer CRM"
              className="w-14 h-14 rounded-2xl object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Freelancer CRM
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === "signup" && "Create your secure account to manage clients & projects"}
            {mode === "signin" && "Sign in to access your CRM workspace and records"}
            {mode === "forgot" && "Reset your account password securely"}
          </p>
        </div>

        {/* Mode Toggle Tabs (Sign In / Create Account) */}
        {mode !== "forgot" && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl mb-6 border border-slate-200/60">
            <button
              type="button"
              id="tab-signin-btn"
              onClick={() => switchMode("signin")}
              className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${
                mode === "signin"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-signup-btn"
              onClick={() => switchMode("signup")}
              className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${
                mode === "signup"
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div
            id="auth-error-banner"
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div
            id="auth-success-banner"
            className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium flex items-start gap-2.5 animate-fadeIn"
          >
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Developer / Preview code notice */}
        {previewCodeNotice && (
          <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-800 text-xs font-semibold flex items-center justify-between">
            <span>{previewCodeNotice}</span>
            <span className="text-[10px] text-indigo-500 font-normal">Auto-filled</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: SIGN UP PAGE                                     */}
        {/* Fields: Name, Email Address, Create Password, Confirm Password */}
        {/* Button: "Create Account"                                 */}
        {/* ========================================================= */}
        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* 1. Name */}
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  id="signup-name"
                  placeholder="e.g. Jane Doe"
                  required
                  value={signupName}
                  onChange={(e) => {
                    setSignupName(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 2. Email Address */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  id="signup-email"
                  placeholder="name@example.com"
                  required
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* 3. Create Password */}
            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Create Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showSignupPassword ? "text" : "password"}
                  id="signup-password"
                  placeholder="Minimum 8 characters"
                  required
                  value={signupPassword}
                  onChange={(e) => {
                    setSignupPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showSignupPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Must be at least 8 characters. Hashed securely with scrypt.
              </p>
            </div>

            {/* 4. Confirm Password */}
            <div>
              <label
                htmlFor="signup-confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound size={16} />
                </div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="signup-confirm-password"
                  placeholder="Re-enter your password"
                  required
                  value={signupConfirmPassword}
                  onChange={(e) => {
                    setSignupConfirmPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Signup Button: "Create Account" */}
            <button
              type="submit"
              id="signup-create-account-btn"
              disabled={isLoading}
              className="w-full mt-5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-3 text-center">
              <p className="text-xs text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: SIGN IN PAGE                                     */}
        {/* Fields: Email Address, Password                          */}
        {/* Button: "Sign In"                                        */}
        {/* ========================================================= */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Email Address */}
            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  id="signin-email"
                  placeholder="name@example.com"
                  required
                  value={signinEmail}
                  onChange={(e) => {
                    setSigninEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="signin-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  id="forgot-password-trigger"
                  onClick={() => {
                    setForgotEmail(signinEmail);
                    switchMode("forgot");
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showSigninPassword ? "text" : "password"}
                  id="signin-password"
                  placeholder="Enter your password"
                  required
                  value={signinPassword}
                  onChange={(e) => {
                    setSigninPassword(e.target.value);
                    setErrorMessage("");
                  }}
                  className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowSigninPassword(!showSigninPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  aria-label="Toggle sign in password visibility"
                >
                  {showSigninPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button: "Sign In" */}
            <button
              type="submit"
              id="signin-submit-btn"
              disabled={isLoading}
              className="w-full mt-5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-3 text-center">
              <p className="text-xs text-slate-500">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline"
                >
                  Create Account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: FORGOT PASSWORD FLOW                              */}
        {/* Step 1: Request Code / Step 2: Reset with Code            */}
        {/* ========================================================= */}
        {mode === "forgot" && (
          <div>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 mb-2"
              >
                <ChevronLeft size={14} /> Back to Sign In
              </button>
            </div>

            {forgotStep === "request" ? (
              <form onSubmit={handleForgotRequest} className="space-y-4">
                <div>
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Registered Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      id="forgot-email"
                      placeholder="name@example.com"
                      required
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    We will generate a secure 6-digit verification code to reset your password.
                  </p>
                </div>

                <button
                  type="submit"
                  id="forgot-submit-btn"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="reset-code"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    6-Digit Verification Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="reset-code"
                    maxLength={6}
                    placeholder="123456"
                    required
                    value={resetCode}
                    onChange={(e) => {
                      setResetCode(e.target.value);
                      setErrorMessage("");
                    }}
                    className="w-full text-center tracking-widest font-mono text-lg py-2 px-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="reset-new-password"
                      placeholder="Minimum 8 characters"
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full text-sm py-2.5 pl-10 pr-10 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Confirm New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <KeyRound size={16} />
                    </div>
                    <input
                      type="password"
                      id="reset-confirm-password"
                      placeholder="Re-enter new password"
                      required
                      value={confirmNewPassword}
                      onChange={(e) => {
                        setConfirmNewPassword(e.target.value);
                        setErrorMessage("");
                      }}
                      className="w-full text-sm py-2.5 pl-10 pr-4 rounded-xl bg-white border border-slate-300 focus:outline-none focus:border-indigo-500 text-slate-900"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  id="reset-password-submit-btn"
                  disabled={isLoading}
                  className="w-full mt-4 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin text-white" />
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Multi-Device / Desktop Pairing Option */}
        {onConnectCode && (
          <div className="mt-6 pt-4 border-t border-slate-200/80 text-center">
            <button
              type="button"
              id="connect-with-desktop-code-btn"
              onClick={onConnectCode}
              className="text-xs text-slate-500 hover:text-indigo-600 font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <Smartphone size={14} className="text-slate-400" />
              <span>Connect via 6-Digit Desktop Code</span>
            </button>
          </div>
        )}

        {/* Security badge footer */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Encrypted with scrypt • No plain-text passwords</span>
        </div>
      </motion.div>
    </div>
  );
}
