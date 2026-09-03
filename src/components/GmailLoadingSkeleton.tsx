import React from "react";
import { Mail, RefreshCw } from "lucide-react";

export default function GmailLoadingSkeleton() {
  return (
    <div className="space-y-4 py-2" id="gmail-loading-skeleton">
      {/* Top Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0 shadow-xs">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-1.5" />
            <div className="h-3 w-48 bg-slate-100 rounded animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-slate-200/80 rounded-xl animate-pulse" />
          <div className="h-8 w-24 bg-slate-200/80 rounded-xl animate-pulse" />
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-h-[500px]">
        {/* Left List Skeleton */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="h-9 w-full bg-slate-200/70 rounded-xl animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-16 bg-slate-200/60 rounded-xl animate-pulse" />
            ))}
          </div>

          <div className="glass-panel rounded-2xl p-3 space-y-2 border border-white/80">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 rounded-xl bg-white/70 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3.5 w-1/3 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="h-3.5 w-3/4 bg-slate-200/80 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Preview Skeleton (Desktop) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col glass-panel rounded-2xl p-6 min-h-[500px] border border-white/80 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="space-y-2">
              <div className="h-5 w-64 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-40 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="h-8 w-28 bg-slate-200/70 rounded-xl animate-pulse" />
          </div>

          <div className="space-y-3 pt-4">
            <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
            <div className="h-3.5 w-5/6 bg-slate-100 rounded animate-pulse" />
            <div className="h-3.5 w-4/6 bg-slate-100 rounded animate-pulse" />
            <div className="h-3.5 w-3/4 bg-slate-100 rounded animate-pulse" />
          </div>

          <div className="pt-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>Loading Gmail Workspace...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
