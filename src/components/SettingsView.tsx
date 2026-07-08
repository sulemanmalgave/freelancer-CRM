import React, { useState } from "react";
import { User, Landmark, Coins, ShieldCheck, Sun, Award, Sparkles, RefreshCw, Laptop, Download } from "lucide-react";
import { FreelancerProfile } from "../types";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

interface SettingsViewProps {
  profile: FreelancerProfile;
  onUpdateProfile: (p: Partial<FreelancerProfile>) => void;
  onTriggerUpgrade: (reason: string) => void;
  isInstallable: boolean;
  onInstall: () => void;
  onNavigate?: (view: string) => void;
}

export default function SettingsView({
  profile,
  onUpdateProfile,
  onTriggerUpgrade,
  isInstallable,
  onInstall,
  onNavigate,
}: SettingsViewProps) {
  const [name, setName] = useState(profile?.name || "");
  const [businessName, setBusinessName] = useState(profile?.businessName || "");
  const [currency, setCurrency] = useState(profile?.currency || "USD");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState(profile?.razorpayKeyId || "");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState(profile?.razorpayKeySecret || "");

  const currenciesList = [
    { code: "USD", symbol: "$", label: "US Dollar ($)" },
    { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
    { code: "EUR", symbol: "€", label: "Euro (€)" },
    { code: "GBP", symbol: "£", label: "British Pound (£)" },
    { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)" },
    { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onUpdateProfile({
      name: name.trim(),
      businessName: businessName.trim(),
      currency,
      razorpayKeyId: razorpayKeyId.trim(),
      razorpayKeySecret: razorpayKeySecret.trim(),
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);

    try {
      const pDoc = doc(db, "freelancers", profile.id);
      const pSnap = await getDoc(pDoc);

      if (pSnap.exists()) {
        const stored = pSnap.data() as FreelancerProfile;
        if (stored.premium === true || (stored.plan && stored.plan !== "Free")) {
          onUpdateProfile(stored);
          alert("Subscription entitlements restored from your cloud profile successfully!");
          return;
        }
      }

      await new Promise((r) => setTimeout(r, 1000));
      alert("No active subscription entitlements were found for this account on the server.");
    } catch (err) {
      alert("Unable to locate valid billing parameters on your account.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 text-sm">
      {/* Settings inputs form */}
      <div className="md:col-span-2 p-5 glass-panel rounded-2xl">
        <h3 className="font-bold text-xs uppercase tracking-widest text-slate-450 mb-5">Workspace Customization</h3>

        <form onSubmit={handleSave} className="space-y-4">
          {saveSuccess && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-bold text-center">
              Settings updated successfully both locally and in Firestore cloud!
            </div>
          )}

          <div>
            <label className="block text-slate-505 font-semibold text-xs mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Professional Name *</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full py-2.5 px-4 text-xs glass-input rounded-xl text-slate-850 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-505 font-semibold text-xs mb-1 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Business Identifier / Agency Name</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full py-2.5 px-4 text-xs glass-input rounded-xl text-slate-850 focus:outline-none"
              placeholder="e.g. Apex Studio"
            />
          </div>

          <div>
            <label className="block text-slate-505 font-semibold text-xs mb-1 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              <span>Active Billing Currency</span>
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full py-2.5 px-3 text-xs glass-input rounded-xl text-slate-850 focus:outline-none"
            >
              {currenciesList.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.label}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-5 border-t border-slate-100 space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>Razorpay Integration Credentials</span>
            </h4>
            <p className="text-[11px] text-slate-400 leading-normal">
              Provide your personal Razorpay API credentials to bypass the default system sandbox and connect your custom gateway.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-505 font-semibold text-xs mb-1">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={razorpayKeyId}
                  onChange={(e) => setRazorpayKeyId(e.target.value)}
                  placeholder="rzp_test_..."
                  className="w-full py-2.5 px-4 text-xs glass-input rounded-xl text-slate-850 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-505 font-semibold text-xs mb-1">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  value={razorpayKeySecret}
                  onChange={(e) => setRazorpayKeySecret(e.target.value)}
                  placeholder="Keep secure"
                  className="w-full py-2.5 px-4 text-xs glass-input rounded-xl text-slate-850 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold leading-normal transition-all float-right cursor-pointer"
          >
            Save Profile Configurations
          </button>
        </form>
      </div>

      {/* Visual parameters sidebar */}
      <div className="space-y-4">

        {/* Plan Configuration billing parameters */}
        <div className="p-5 glass-panel rounded-2xl text-xs">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-450 mb-3 block">Billing Entitlements</h3>

          {profile.premium === true || profile.plan !== "Free" ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 mt-2">
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Pro Subscription Active</span>
              </div>
              <div className="text-[10px] text-slate-500 space-y-1">
                <div>Method: <strong className="text-slate-700">{profile.subscriptionMethod || "Direct Gateway"}</strong></div>
                <div>Region: <strong className="text-slate-700">{profile.subscriptionRegion === "IN" ? "India (₹99/mo)" : "International ($2.99/mo)"}</strong></div>
              </div>
              <button
                onClick={() => onTriggerUpgrade("settings_upgrade")}
                className="w-full mt-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sparkles size={11} />
                <span>Manage Subscription</span>
              </button>
            </div>
          ) : (
            <div className="p-3 bg-black/5 border border-black/5 rounded-xl space-y-2.5 mt-2">
              <div className="flex items-center gap-1.5 text-slate-655 font-bold">
                <Landmark className="w-4 h-4" />
                <span>Free Plan Workspace</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Tier limits of up to 20 clients and 10 projects are active. Subscribe to unlock unlimited records.
              </p>
              <div className="flex flex-col gap-1.5 pt-1.5">
                <button
                  onClick={() => onTriggerUpgrade("settings_upgrade")}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold text-center transition-all flex items-center justify-center gap-0.5 cursor-pointer"
                >
                  <Sparkles size={11} />
                  <span>Subscribe Now</span>
                </button>
                <button
                  onClick={() => onTriggerUpgrade("settings_upgrade")}
                  className="w-full py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 text-center flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} />
                  <span>Restore Purchases</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PWA & System Compatibility Integration Card */}
        <div className="p-5 glass-panel rounded-2xl text-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-600">
              <Laptop className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">PWA Integration</h3>
              <p className="text-[9px] text-slate-400">Offline Standalone Workspace</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] text-slate-500 space-y-1 bg-slate-50 border border-slate-100 p-2.5 rounded-xl">
              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span>Caching Engine</span>
                <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span>Offline Access</span>
                <span className="font-semibold text-slate-700">Supported</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Platform Compatibility</span>
                <span className="font-semibold text-slate-700">Win/macOS/Android</span>
              </div>
            </div>

            {isInstallable ? (
              <button
                onClick={onInstall}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-indigo-600/10"
              >
                <Download size={12} />
                <span>Install App on Device</span>
              </button>
            ) : (
              <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 text-indigo-600 rounded-lg text-center text-[9px] font-medium leading-normal">
                App is running-ready on your machine. Browser-native installation is fully compatible with Microsoft Store, Chrome, and Safari.
              </div>
            )}
          </div>
        </div>

        {/* Legal & Compliance Section */}
        <div className="p-5 glass-panel rounded-2xl text-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest text-slate-800">Legal & Compliance</h3>
              <p className="text-[9px] text-slate-400">Security & Privacy Terms</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
            We adhere to strict data custody and Zero-Trust standards. Client profiles, contract briefs, and invoicing structures are synchronized exclusively with your authenticated cloud workspace.
          </p>
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate?.("PrivacyPolicy")}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Read Full Privacy Policy &rarr;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
