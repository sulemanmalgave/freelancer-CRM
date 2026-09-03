import React, { useState, useEffect, useCallback } from "react";
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  RefreshCw,
  X,
  ShieldCheck,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ExternalLink,
  Wifi,
  WifiOff,
  Sparkles,
  ChevronRight,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { FreelancerProfile, ConnectedDevice } from "../types";
import { getOrCreatePersistentDeviceId } from "../utils";

interface MobileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: FreelancerProfile;
  cloudSyncStatus: "synced" | "syncing" | "offline" | "error";
  onTriggerSync: () => Promise<void>;
  onConnectWithCode?: (code: string) => Promise<boolean>;
}

export const MobileConnectModal: React.FC<MobileConnectModalProps> = ({
  isOpen,
  onClose,
  profile,
  cloudSyncStatus,
  onTriggerSync,
  onConnectWithCode,
}) => {
  const [activeTab, setActiveTab] = useState<"connect" | "devices" | "enter_code">("connect");
  const [pairingCode, setPairingCode] = useState<string>("");
  const [pairingToken, setPairingToken] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [deepLink, setDeepLink] = useState<string>("");
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [isDisconnectingId, setIsDisconnectingId] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("Just now");
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string>("");

  // Enter Code form state (if user is on mobile connecting to desktop)
  const [inputCode, setInputCode] = useState<string>("");
  const [isVerifyingInputCode, setIsVerifyingInputCode] = useState<boolean>(false);
  const [inputCodeError, setInputCodeError] = useState<string>("");
  const [inputCodeSuccess, setInputCodeSuccess] = useState<boolean>(false);

  // Generate pairing code & token
  const generateNewPairingCode = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoadingCode(true);
    try {
      const res = await fetch("/api/mobile/create-pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freelancerId: profile.id,
          profile,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPairingCode(data.pairingCode);
        setPairingToken(data.pairingToken);
        setExpiresAt(data.expiresAt);

        // Formulate complete deep link with origin
        const origin = window.location.origin;
        const completeLink = `${origin}/?mobile_connect=${data.pairingToken}`;
        setDeepLink(completeLink);

        const remaining = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsRemaining(remaining > 0 ? remaining : 600);
      }
    } catch (err) {
      console.warn("Could not generate mobile pairing code online, using local backup session:", err);
      // Fallback offline pairing code
      const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
      const fallbackToken = `mob_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const exp = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      setPairingCode(fallbackCode);
      setPairingToken(fallbackToken);
      setExpiresAt(exp);
      const origin = window.location.origin;
      setDeepLink(`${origin}/?mobile_connect=${fallbackToken}`);
      setSecondsRemaining(600);
    } finally {
      setIsLoadingCode(false);
    }
  }, [profile?.id]);

  // Fetch connected devices list
  const fetchDevices = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoadingDevices(true);
    try {
      const res = await fetch(`/api/mobile/devices?freelancerId=${profile.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.devices)) {
        setDevices(data.devices);
      }
    } catch (err) {
      console.warn("Could not fetch connected devices:", err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [profile?.id]);

  // Handle modal open
  useEffect(() => {
    if (isOpen) {
      generateNewPairingCode();
      fetchDevices();
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
  }, [isOpen, generateNewPairingCode, fetchDevices]);

  // Countdown timer for pairing code expiration
  useEffect(() => {
    if (!isOpen || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, expiresAt]);

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCopyCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.warn("Clipboard write failed:", e);
    }
  };

  const handleCopyLink = async () => {
    if (!deepLink) return;
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.warn("Clipboard write failed:", e);
    }
  };

  const handleDisconnectDevice = async (deviceId: string) => {
    if (!confirm("Disconnect this mobile device? This removes the session without deleting any CRM data.")) {
      return;
    }
    setIsDisconnectingId(deviceId);
    try {
      const res = await fetch("/api/mobile/devices/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, freelancerId: profile.id }),
      });
      const data = await res.json();
      if (data.success) {
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      }
    } catch (err) {
      console.error("Failed to disconnect device:", err);
    } finally {
      setIsDisconnectingId(null);
    }
  };

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    setSyncErrorMessage("");
    try {
      await onTriggerSync();
      setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch (err: any) {
      setSyncErrorMessage(err?.message || "Sync encountered a network issue. Retrying in background.");
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleVerifyInputCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    setIsVerifyingInputCode(true);
    setInputCodeError("");
    setInputCodeSuccess(false);

    try {
      if (onConnectWithCode) {
        const ok = await onConnectWithCode(inputCode.trim());
        if (ok) {
          setInputCodeSuccess(true);
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setInputCodeError("Invalid or expired connection code. Please check your desktop screen.");
        }
      } else {
        const res = await fetch("/api/mobile/verify-pairing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pairingCode: inputCode.trim(),
            clientDeviceId: getOrCreatePersistentDeviceId(),
            deviceName: "Mobile Web Device",
            platform: "Mobile Web",
          }),
        });
        const data = await res.json();
        if (data.success && data.profile) {
          localStorage.setItem("crm_profile", JSON.stringify(data.profile));
          setInputCodeSuccess(true);
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        } else {
          setInputCodeError(data.error || "Invalid code. Please try again.");
        }
      }
    } catch (err: any) {
      setInputCodeError(err?.message || "Verification failed. Check your internet connection.");
    } finally {
      setIsVerifyingInputCode(false);
    }
  };

  if (!isOpen) return null;

  const formattedCodeDisplay = pairingCode
    ? `${pairingCode.slice(0, 3)} ${pairingCode.slice(3)}`
    : "--- ---";

  return (
    <div
      id="mobile-connect-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80 shadow-xs">
              <Smartphone size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Use Freelancer CRM on Mobile</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Connect your mobile app to this account to access your CRM data anywhere.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 pb-0 border-b border-slate-100 flex gap-2">
          <button
            onClick={() => setActiveTab("connect")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "connect"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Connect Mobile
          </button>
          <button
            onClick={() => setActiveTab("devices")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "devices"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>Connected Devices</span>
            {devices.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-extrabold">
                {devices.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("enter_code")}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "enter_code"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound size={12} />
            <span>Enter Code</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: Connect via QR / Code */}
          {activeTab === "connect" && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      cloudSyncStatus === "synced"
                        ? "bg-emerald-500 ring-4 ring-emerald-100"
                        : cloudSyncStatus === "syncing"
                        ? "bg-indigo-500 animate-ping"
                        : cloudSyncStatus === "offline"
                        ? "bg-amber-500 ring-4 ring-amber-100"
                        : "bg-red-500"
                    }`}
                  />
                  <div>
                    <span className="font-bold text-slate-800">
                      Status:{" "}
                      {cloudSyncStatus === "synced"
                        ? "Connected & Synced"
                        : cloudSyncStatus === "syncing"
                        ? "Syncing in background..."
                        : cloudSyncStatus === "offline"
                        ? "Offline Buffer Active"
                        : "Sync Error"}
                    </span>
                    <span className="text-slate-400 block text-[11px]">
                      Last synced: {lastSyncedTime}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleManualSync}
                  disabled={isManualSyncing}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw
                    size={12}
                    className={isManualSyncing ? "animate-spin text-indigo-600" : "text-slate-500"}
                  />
                  <span>{isManualSyncing ? "Syncing..." : "Sync Now"}</span>
                </button>
              </div>

              {syncErrorMessage && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span>{syncErrorMessage}</span>
                </div>
              )}

              {/* QR Code and Short Code Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                {/* QR Code Card */}
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                  <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-200/80 relative group">
                    {isLoadingCode ? (
                      <div className="w-36 h-36 flex items-center justify-center">
                        <RefreshCw size={24} className="animate-spin text-indigo-600" />
                      </div>
                    ) : deepLink ? (
                      <QRCodeSVG
                        value={deepLink}
                        size={144}
                        level="M"
                        includeMargin={false}
                        className="rounded-lg"
                      />
                    ) : (
                      <div className="w-36 h-36 flex items-center justify-center text-slate-400">
                        <QrCode size={40} />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 mt-3 flex items-center gap-1">
                    <QrCode size={13} className="text-indigo-600" />
                    <span>Scan with mobile camera</span>
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Opens your workspace instantly
                  </span>
                </div>

                {/* Connection Code Card */}
                <div className="p-5 bg-indigo-50/40 rounded-2xl border border-indigo-100 flex flex-col justify-between h-full space-y-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">
                      Short Connection Code
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Type this 6-digit code on your mobile device:
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-indigo-200/80 shadow-2xs">
                    <span className="font-mono text-xl font-black text-indigo-950 tracking-wider">
                      {formattedCodeDisplay}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Copy code"
                    >
                      {copiedCode ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Expiration and Refresh */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock size={12} className="text-slate-400" />
                      <span>
                        {secondsRemaining > 0 ? (
                          <>Expires in <strong className="text-slate-700">{formatCountdown(secondsRemaining)}</strong></>
                        ) : (
                          <span className="text-red-500 font-bold">Code expired</span>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={generateNewPairingCode}
                      disabled={isLoadingCode}
                      className="font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} className={isLoadingCode ? "animate-spin" : ""} />
                      <span>New code</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Deep Link & Security Note */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">Connection Deep-Link:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {copiedLink ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copiedLink ? "Link Copied!" : "Copy Link"}</span>
                    </button>
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1"
                      title="Test connection in new tab"
                    >
                      <ExternalLink size={13} />
                      <span>Open Link</span>
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Secure & Zero-Credential:</strong> No passwords or payment details are stored in the QR code. Pairing tokens are temporary, single-use, and expire automatically.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Connected Devices */}
          {activeTab === "devices" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800">Paired Mobile Devices</h3>
                  <p className="text-xs text-slate-500">
                    Devices currently authorized to access this Freelancer CRM workspace.
                  </p>
                </div>
                <button
                  onClick={fetchDevices}
                  disabled={isLoadingDevices}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Refresh device list"
                >
                  <RefreshCw size={14} className={isLoadingDevices ? "animate-spin" : ""} />
                </button>
              </div>

              {isLoadingDevices ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <RefreshCw size={24} className="animate-spin text-indigo-600" />
                  <span className="text-xs">Loading connected devices...</span>
                </div>
              ) : devices.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <Smartphone size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">No Mobile Devices Connected Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Scan the QR code on the "Connect Mobile" tab with your phone to link your first device.
                  </p>
                  <button
                    onClick={() => setActiveTab("connect")}
                    className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>Connect Now</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          {device.platform === "iOS" ? (
                            <Smartphone size={18} />
                          ) : device.platform === "Android" ? (
                            <Smartphone size={18} />
                          ) : (
                            <Laptop size={18} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {device.deviceName || "Mobile Device"}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-slate-100 text-slate-600">
                              {device.platform || "Mobile"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Last active: {new Date(device.lastActiveAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnectDevice(device.id)}
                        disabled={isDisconnectingId === device.id}
                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl border border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Disconnect device without touching CRM data"
                      >
                        <Trash2 size={12} />
                        <span>{isDisconnectingId === device.id ? "Revoking..." : "Disconnect"}</span>
                      </button>
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400 text-center pt-2">
                    Disconnecting a device removes that device's session. All CRM data remains completely intact.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Enter Code (For connecting this client to another workspace) */}
          {activeTab === "enter_code" && (
            <form onSubmit={handleVerifyInputCode} className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-900">
                <p className="font-bold">Connect this device to an existing Freelancer CRM account</p>
                <p className="text-indigo-700 mt-0.5">
                  Enter the 6-digit connection code displayed on your desktop screen:
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  6-Digit Connection Code
                </label>
                <input
                  type="text"
                  maxLength={7}
                  placeholder="e.g. 839 201"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-mono text-lg font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
                  required
                />
              </div>

              {inputCodeError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{inputCodeError}</span>
                </div>
              )}

              {inputCodeSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Connected successfully! Synchronizing workspace...</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingInputCode || !inputCode.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isVerifyingInputCode ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={14} />
                    <span>Connect Workspace</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Encrypted cloud database synchronization</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
