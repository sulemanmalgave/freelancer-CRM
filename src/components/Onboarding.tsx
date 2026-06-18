import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Briefcase, Landmark, Check, Coins, ArrowRight, UserCheck } from "lucide-react";
import { FreelancerProfile } from "../types";
import { detectLocale, generateUUID } from "../utils";

interface OnboardingProps {
  onComplete: (profile: FreelancerProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { country, currency } = detectLocale();

  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [prefCurrency, setPrefCurrency] = useState(currency || "USD");
  const [selectedPlan, setSelectedPlan] = useState<"Free" | "Pro">("Free");
  const [errorMsg, setErrorMsg] = useState("");

  const currenciesList = [
    { code: "USD", symbol: "$", label: "US Dollar ($)" },
    { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
    { code: "EUR", symbol: "€", label: "Euro (€)" },
    { code: "GBP", symbol: "£", label: "British Pound (£)" },
    { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)" },
    { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please specify your professional name.");
      return;
    }

    const freelancerId = generateUUID();
    const newProfile: FreelancerProfile = {
      id: freelancerId,
      name: name.trim(),
      businessName: businessName.trim(),
      currency: prefCurrency,
      country: country,
      plan: selectedPlan,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
    };

    onComplete(newProfile);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass-modal rounded-3xl p-6 sm:p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-650 mb-4 border border-indigo-500/20">
            <Briefcase className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Welcome to Freelancer CRM</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">
            Let's customize your client management portal. Safe, cloud-backed, and optimized for offline use.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* Professional Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 mb-1.5 flex items-center gap-1.5">
              <span>Professional Name *</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Jane Doe, Alex Smith"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg("");
                }}
                className="w-full text-sm py-2.5 px-4 rounded-xl glass-input focus:outline-none focus:border-indigo-500 text-slate-800"
              />
            </div>
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 mb-1.5 flex items-center gap-1.5">
              <span>Business Name <span className="text-[10px] text-slate-400 font-normal">(Optional)</span></span>
            </label>
            <input
              type="text"
              placeholder="e.g. Apex Digital, Jane Studio"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full text-sm py-2.5 px-4 rounded-xl glass-input focus:outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>

          {/* Currency selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 mb-1.5 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              <span>Preferred Currency</span>
            </label>
            <select
              value={prefCurrency}
              onChange={(e) => setPrefCurrency(e.target.value)}
              className="w-full text-sm py-2.5 px-4 rounded-xl glass-input focus:outline-none focus:border-indigo-500 text-slate-800"
            >
              {currenciesList.map((cur) => (
                <option key={cur.code} value={cur.code}>
                  {cur.label}
                </option>
              ))}
            </select>
          </div>

          {/* Plan Choice Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 mb-2">
              Select Workspace Plan
            </label>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div
                onClick={() => setSelectedPlan("Free")}
                className={`cursor-pointer border p-3 rounded-2xl transition-all relative ${
                  selectedPlan === "Free"
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-black/5 bg-black/5 hover:bg-black/10 text-slate-400"
                }`}
              >
                {selectedPlan === "Free" && (
                  <span className="absolute top-2 right-2 bg-slate-700 p-0.5 rounded-full text-white">
                    <Check size={10} />
                  </span>
                )}
                <div className="font-bold text-slate-900">Free Plan</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Upto 20 clients, 10 projects, basic analytics.
                </div>
              </div>

              <div
                onClick={() => setSelectedPlan("Pro")}
                className={`cursor-pointer border p-3 rounded-2xl transition-all relative ${
                  selectedPlan === "Pro"
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-black/5 bg-black/5 hover:bg-black/10 text-slate-450"
                }`}
              >
                {selectedPlan === "Pro" && (
                  <span className="absolute top-2 right-2 bg-violet-600 p-0.5 rounded-full text-white">
                    <Check size={10} />
                  </span>
                )}
                <div className="font-bold text-violet-700 flex items-center gap-1.5">
                  Pro Plan <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md font-semibold">Popular</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {country === "IN" ? "₹99" : "$1.99"}/mo. Unlimited storage, documents, and invoicing.
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-6 py-3 px-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/15 group cursor-pointer"
          >
            <span>Launch CRM Workspace</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
