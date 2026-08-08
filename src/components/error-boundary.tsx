import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-sunken p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-warning" />
            <p className="text-sm font-medium text-ink">
              Something went wrong loading this section.
            </p>
            <p className="text-xs text-ink-faint">
              {this.state.error?.message ?? "Unknown error"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
