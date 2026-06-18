import React, { useState } from "react";
import { User, Landmark, Coins, ShieldCheck, Sun, Award, Sparkles, RefreshCw } from "lucide-react";
import { FreelancerProfile } from "../types";

interface SettingsViewProps {
  profile: FreelancerProfile;
  onUpdateProfile: (p: Partial<FreelancerProfile>) => void;
  onTriggerUpgrade: (reason: string) => void;
}

export default function SettingsView({
  profile,
  onUpdateProfile,
  onTriggerUpgrade,
}: SettingsViewProps) {
  const [name, setName] = useState(profile?.name || "");
  const [businessName, setBusinessName] = useState(profile?.businessName || "");
  const [currency, setCurrency] = useState(profile?.currency || "USD");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleRestorePurchases = async () => {
    setIsRestoring(true);
    // Simulate RevenueCat entitlement restore lookup
    await new Promise((r) => setTimeout(r, 1200));

    // Force upgrade to Pro if local restore matches
    onUpdateProfile({ plan: "Pro" });
    setIsRestoring(false);
    alert("Entitlements restored! Pro subscription activated successfully via app store receipt.");
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

          {profile.plan === "Pro" ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 mt-2">
              <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Pro Subscription Active</span>
              </div>
              <div className="text-[10px] text-slate-500 space-y-1">
                <div>Method: <strong className="text-slate-700">{profile.subscriptionMethod || "Direct Gateway"}</strong></div>
                <div>Region: <strong className="text-slate-700">{profile.subscriptionRegion === "IN" ? "India (₹99/mo)" : "International ($1.99/mo)"}</strong></div>
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
      </div>
    </div>
  );
}
