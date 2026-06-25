import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
};

type State = {
  hasError: boolean;
  error?: Error;
};

export class ChartErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error) {
    console.error("Chart render failed:", error);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: undefined,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] rounded-2xl border border-red-400/20 bg-red-950/20 p-6 text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.12)]">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-5 text-red-300" />
            <h3 className="font-semibold">
              {this.props.fallbackTitle || "Chart failed to load"}
            </h3>
          </div>

          <p className="mb-4 text-sm text-red-200/80">
            This chart component crashed, but the dashboard is still safe.
          </p>

          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300/30 bg-red-400/10 px-3 py-2 text-sm hover:bg-red-400/20"
            type="button"
          >
            <RefreshCw className="size-4" />
            Retry chart
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
