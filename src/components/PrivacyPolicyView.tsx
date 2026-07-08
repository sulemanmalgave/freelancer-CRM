import React from "react";
import { motion } from "motion/react";
import {
  Shield,
  Lock,
  Database,
  CreditCard,
  Globe,
  Mail,
  Trash2,
  FileText,
  Key,
  Smartphone,
  Eye,
  CheckCircle2
} from "lucide-react";

interface PrivacyPolicyViewProps {
  isPublic?: boolean;
}

export default function PrivacyPolicyView({ isPublic = false }: PrivacyPolicyViewProps) {
  const currentYear = new Date().getFullYear();

  const sections = [
    {
      title: "1. What Information We Collect",
      icon: Eye,
      color: "text-indigo-600 bg-indigo-50",
      content: (
        <div className="space-y-3">
          <p>
            Freelancer CRM is a client-management tool built to operate offline-first with cloud persistence. We collect the following data to provide and improve the application's core features:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Freelancer Profile Data:</strong> Professional name, business/agency identifier, country, active billing currency, and optional custom Razorpay API credentials.
            </li>
            <li>
              <strong>Client & Lead Records:</strong> Names, contact emails, phone numbers, physical addresses, website/social profiles, notes, and deal conversion metrics.
            </li>
            <li>
              <strong>Projects & Tasks:</strong> Project titles, billable rates, deadline thresholds, progress status, and task checkboxes.
            </li>
            <li>
              <strong>Financials & Invoicing:</strong> Invoiced items, sub-totals, tax configurations, and transaction records.
            </li>
            <li>
              <strong>Uploaded Documents:</strong> Reference names, descriptions, and file metadata associated with project briefs or contracts.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "2. How We Store and Sync Your Data",
      icon: Database,
      color: "text-emerald-600 bg-emerald-50",
      content: (
        <div className="space-y-3">
          <p>
            We respect your ownership over your data and implement a hybrid storage architecture:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Local Caching (LocalStorage):</strong> To deliver near-instant loading speeds and enable full offline functionality, all client and workspace records are cached securely in your local browser storage.
            </li>
            <li>
              <strong>Cloud Persistence (Google Cloud Firestore):</strong> All local data is securely synchronized in real-time with Google Cloud Firestore. This ensures you never lose work if your browser cache is cleared, and allows seamless multi-device access.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "3. Payment Gateways and API Key Security",
      icon: Key,
      color: "text-amber-600 bg-amber-50",
      content: (
        <div className="space-y-3">
          <p>
            The application contains built-in features to upgrade to premium workspace tiers and request custom payments from your clients:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Subscription Billing (Stripe & PayPal):</strong> When purchasing a Pro subscription, payments are processed directly and securely by Stripe or PayPal. We never collect or store your payment card numbers.
            </li>
            <li>
              <strong>Custom Razorpay Keys:</strong> If you optionally supply your own Razorpay Key ID and Key Secret in Settings to invoice clients, they are stored securely in your private, authenticated Firestore profile and are only utilized server-side to construct transaction objects.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "4. Geolocation Detection",
      icon: Globe,
      color: "text-sky-600 bg-sky-50",
      content: (
        <div className="space-y-3">
          <p>
            We use server-side country headers and a quick IP-based fallback lookup via <code>ip-api.com</code> during checkout. This auto-detection is performed solely to direct you to the correct regional pricing plans (e.g., INR plans via Razorpay or USD plans via PayPal) and is not saved or tracked long-term.
          </p>
        </div>
      ),
    },
    {
      title: "5. Data Retention, Control, and Deletion",
      icon: Trash2,
      color: "text-red-600 bg-red-50",
      content: (
        <div className="space-y-3">
          <p>
            You hold total control over your business data:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Permanent Deletion:</strong> Any client, lead, project, invoice, or document deleted inside the CRM interface is permanently erased from both your browser's local cache and the cloud database in real-time.
            </li>
            <li>
              <strong>Account Removal:</strong> You can clear your entire profile and local database entries from the workspace anytime to wipe your local cache entirely.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "6. Security Implementation",
      icon: Lock,
      color: "text-indigo-600 bg-indigo-50",
      content: (
        <div className="space-y-3">
          <p>
            We protect your professional workspaces using multi-layered safeguards:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong>Zero-Trust Database Rules:</strong> Our Firestore security rules enforce strict Attribute-Based Access Control (ABAC). It is mathematically impossible for another user to view, edit, or list your clients, projects, or documents.
            </li>
            <li>
              <strong>HTTPS Encryption:</strong> All communications between your PWA, the server, payment gateways, and Firestore are fully encrypted in transit using industry-standard SSL/TLS protocols.
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "7. Children's Privacy",
      icon: Smartphone,
      color: "text-teal-600 bg-teal-50",
      content: (
        <p>
          Freelancer CRM is designed strictly for adult professionals, independent contractors, and business owners. We do not knowingly collect or solicit any personal information from children under the age of 13.
        </p>
      ),
    },
    {
      title: "8. Policy Updates & Contact",
      icon: Mail,
      color: "text-pink-600 bg-pink-50",
      content: (
        <div className="space-y-3">
          <p>
            We may occasionally update this Privacy Policy to reflect app updates or regulatory changes. Any modifications will be posted here with an updated "Last Modified" date.
          </p>
          <p>
            If you have questions regarding this Privacy Policy, your cached information, or wish to exercise your data deletion rights, you can reach us directly:
          </p>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex items-center gap-3 mt-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="font-semibold text-xs text-slate-800">Privacy Support Email</p>
              <a
                href="mailto:sulemanmalgave1@gmail.com"
                className="text-xs text-indigo-600 hover:underline font-bold"
              >
                sulemanmalgave1@gmail.com
              </a>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={`space-y-8 select-none ${isPublic ? "py-4 animate-fade-in" : ""}`}>
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-slate-900 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-550/20 via-purple-550/10 to-transparent pointer-events-none"></div>
        <div className="space-y-2 relative z-10 text-center md:text-left">
          <span className="text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            Security & Legal
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-2">Privacy Policy</h2>
          <p className="text-slate-400 text-xs max-w-lg leading-relaxed">
            Learn how we collect, store, and protect your clients, invoices, and business data inside our secure, offline-first CRM.
          </p>
        </div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl shrink-0">
          <Shield size={36} className="text-indigo-400 animate-pulse" />
        </div>
      </div>

      {/* Intro Metrics Grid */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <Lock size={16} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">100% Isolated</h4>
            <p className="text-[10px] text-slate-450 mt-0.5 leading-normal">Zero-Trust database security policies block cross-user data access.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database size={16} />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">Local Cache First</h4>
            <p className="text-[10px] text-slate-450 mt-0.5 leading-normal">CRM processes operate instantly offline inside your browser's local sandbox.</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CheckCircle2 size={16} className="text-indigo-500" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">Last Updated</h4>
            <p className="text-[10px] text-slate-450 mt-0.5 leading-normal">July 2026. Explicitly matching real-time database schema specifications.</p>
          </div>
        </div>
      </div>

      {/* Privacy Policy Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.3 }}
              className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${section.color}`}>
                    <Icon size={16} />
                  </div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
                    {section.title}
                  </h3>
                </div>
                <div className="text-xs text-slate-550 leading-relaxed font-medium">
                  {section.content}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Interactive Quick-Agreement banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left space-y-1">
          <p className="font-extrabold text-xs text-slate-805">Your Privacy and Agency Autonomy are Guaranteed</p>
          <p className="text-[10px] text-slate-500 leading-normal max-w-xl">
            By using Freelancer CRM, you agree to our local storage and secure Google Firestore sync mechanism. We never monetize or sell client contact details, invoice structures, or document records.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-200">
          <Shield size={14} className="text-indigo-600 animate-pulse" />
          <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider">Secure Workspace</span>
        </div>
      </div>

      {/* Elegant minimalist footnote */}
      <div className="text-center text-[10px] text-slate-400 py-4 border-t border-slate-100">
        &copy; {currentYear} Freelancer CRM. All rights reserved. Registered under secure cloud infrastructure.
      </div>
    </div>
  );
}
