import { Component, ErrorInfo, ReactNode } from "react";
import { Mail, RefreshCw, ShieldAlert, ArrowLeft, ShieldCheck } from "lucide-react";
import { clearActiveGmailToken } from "../services/gmailService";

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onNavigateToDashboard?: () => void;
  onTriggerReconnect?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class GmailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Gmail Error Boundary Caught]", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReconnect = () => {
    clearActiveGmailToken();
    this.setState({ hasError: false, error: null });
    if (this.props.onTriggerReconnect) {
      this.props.onTriggerReconnect();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-6 py-6" id="gmail-error-boundary-screen">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-xs">
                  <Mail className="w-4 h-4" />
                </div>
                <span>Gmail Inbox & Communications</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Synchronize email conversations with your CRM clients and manage follow-ups.
              </p>
            </div>
          </div>

          <div className="p-8 sm:p-10 rounded-2xl glass-panel text-center max-w-2xl mx-auto shadow-xs border border-white/80 space-y-5 my-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Unable to display Gmail at this moment
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                An unexpected issue occurred while rendering your Gmail inbox. Your client records, projects, invoices, and CRM data remain completely safe and intact.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-red-50/80 border border-red-200/80 rounded-xl text-left max-w-md mx-auto text-xs text-red-700 font-mono">
                <span className="font-bold text-red-900 font-sans block mb-1">Details:</span>
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                id="gmail-error-retry-btn"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>

              <button
                onClick={this.handleReconnect}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                id="gmail-error-reconnect-btn"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Reconnect Gmail</span>
              </button>

              {this.props.onNavigateToDashboard && (
                <button
                  onClick={this.props.onNavigateToDashboard}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  id="gmail-error-dashboard-btn"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Dashboard</span>
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
