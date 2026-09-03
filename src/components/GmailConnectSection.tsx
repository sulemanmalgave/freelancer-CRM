import { useState } from "react";
import { motion } from "motion/react";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Lock,
} from "lucide-react";
import { FreelancerProfile } from "../types";
import {
  connectGmailWithGSI,
  clearActiveGmailToken,
  getActiveGmailToken,
} from "../services/gmailService";
import { canAccessGmail } from "../services/gmailEntitlement";

interface GmailConnectSectionProps {
  profile: FreelancerProfile;
  onUpdateProfile: (fields: Partial<FreelancerProfile>) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

export default function GmailConnectSection({
  profile,
  onUpdateProfile,
  onTriggerUpgrade,
}: GmailConnectSectionProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasGmailAccess = canAccessGmail(profile);
  const isConnected = !!(profile.gmailConnected && profile.gmailEmail);
  const hasActiveSession = !!getActiveGmailToken();

  const handleConnect = async () => {
    if (!hasGmailAccess) {
      if (onTriggerUpgrade) {
        onTriggerUpgrade("gmail_integration");
      }
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await connectGmailWithGSI();
      onUpdateProfile({
        gmailConnected: true,
        gmailEmail: result.email,
        gmailName: result.name || profile.name,
        gmailPicture: result.picture,
        gmailConnectedAt: new Date().toISOString(),
      });
      setSuccessMsg(`Successfully connected to Gmail as ${result.email}`);
    } catch (err: any) {
      console.error("Gmail connection error:", err);
      setErrorMsg(err.message || "Failed to authorize with Google. Please ensure popups are allowed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearActiveGmailToken();
    onUpdateProfile({
      gmailConnected: false,
      gmailEmail: undefined,
      gmailName: undefined,
      gmailPicture: undefined,
      gmailConnectedAt: undefined,
    });
    setSuccessMsg("Gmail account has been disconnected.");
    setErrorMsg(null);
  };

  const handleReconnect = async () => {
    await handleConnect();
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs relative overflow-hidden" id="gmail-integration-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">Gmail Integration</h3>
              {!hasGmailAccess ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full">
                  <Lock size={10} className="text-amber-600" />
                  Pro Feature
                </span>
              ) : isConnected ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                  <CheckCircle2 size={10} />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sync client email conversations, compose & reply from CRM, and extract follow-up action items.
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          {!hasGmailAccess ? (
            isConnected ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onTriggerUpgrade && onTriggerUpgrade("gmail_integration")}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Upgrade to Pro</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  title="Remove account connection"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                id="connect-gmail-btn"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>Upgrade to Connect</span>
              </button>
            )
          ) : !isConnected ? (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              id="connect-gmail-btn"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{loading ? "Connecting..." : "Connect Gmail"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReconnect}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                title="Refresh Google Token"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                <span>Reconnect</span>
              </button>
              <button
                onClick={handleDisconnect}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                id="disconnect-gmail-btn"
              >
                <LogOut className="w-3 h-3" />
                <span>Disconnect</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notice for Free users with preserved connection */}
      {!hasGmailAccess && isConnected && profile.gmailEmail && (
        <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center gap-3 text-left">
          {profile.gmailPicture ? (
            <img
              src={profile.gmailPicture}
              alt={profile.gmailName || "Google Account"}
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-amber-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 font-bold flex items-center justify-center shrink-0 text-xs">
              {profile.gmailEmail[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-800 truncate">
              Connected: {profile.gmailEmail}
            </p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Gmail connection preserved. Upgrade to Pro to activate inbox sync and send emails.
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <span className="font-bold">Connection Notice:</span> {errorMsg}
          </div>
        </motion.div>
      )}

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {/* Connected Account Detail view */}
      {isConnected ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-3">
            {profile.gmailPicture ? (
              <img
                src={profile.gmailPicture}
                alt={profile.gmailName || "Gmail User"}
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold text-sm flex items-center justify-center">
                {(profile.gmailEmail?.[0] || "G").toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Connected Google Account
              </span>
              <p className="text-xs font-bold text-slate-900 truncate">
                {profile.gmailName || profile.gmailEmail}
              </p>
              <p className="text-[11px] text-slate-500 truncate font-mono">{profile.gmailEmail}</p>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Integration Status
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active & Synced
              </span>
            </div>
            <div className="text-[11px] text-slate-600 flex items-center justify-between">
              <span>Connected:</span>
              <span className="font-medium text-slate-800">
                {profile.gmailConnectedAt
                  ? new Date(profile.gmailConnectedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Active"}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 flex items-center justify-between">
              <span>Token Status:</span>
              <span className={`font-semibold ${hasActiveSession ? "text-emerald-600" : "text-amber-600"}`}>
                {hasActiveSession ? "Active Session" : "Requires Click Reconnect"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 p-4 bg-slate-50/70 border border-slate-200/60 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-indigo-50 text-indigo-600 mt-0.5">
                <Mail size={13} />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-800 font-bold">Client Email Inbox</strong>
                <span className="text-slate-500">View relevant client conversations inside each client hub.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 mt-0.5">
                <Sparkles size={13} />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-800 font-bold">AI Assistant Tools</strong>
                <span className="text-slate-500">Summarize threads and generate 1-click follow-up tasks.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-blue-50 text-blue-600 mt-0.5">
                <ShieldCheck size={13} />
              </div>
              <div className="text-[11px]">
                <strong className="block text-slate-800 font-bold">Zero Data Exposure</strong>
                <span className="text-slate-500">Encrypted transmission, zero token exposure, minimum scopes.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy guarantee note */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Lock size={11} className="text-slate-400" />
          <span>OAuth 2.0 with minimum Gmail permissions &middot; Strictly your account data</span>
        </div>
        <a
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-600 flex items-center gap-1 transition-colors"
        >
          <span>Google Security</span>
          <ExternalLink size={10} />
        </a>
      </div>
    </div>
  );
}
