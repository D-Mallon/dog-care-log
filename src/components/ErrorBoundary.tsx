import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled app error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream p-6">
          <div className="w-full max-w-sm rounded-3xl border border-warm-brown/10 bg-white p-6 text-center shadow-sm">
            <div className="mb-3 text-4xl" aria-hidden="true">
              🐾
            </div>
            <h1 className="mb-2 text-xl font-bold font-fraunces text-warm-brown">
              Something went wrong
            </h1>
            <p className="mb-5 text-sm text-text-muted">
              Loggi hit an unexpected error. Your saved care history is still
              safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-xl bg-warm-brown py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Reload Loggi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
