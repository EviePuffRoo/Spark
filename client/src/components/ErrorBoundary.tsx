import { Component, type ErrorInfo, type ReactNode } from "react";

// A class component because React's error-boundary API (getDerivedStateFromError
// / componentDidCatch) has no hook equivalent. Catches render/lifecycle errors
// anywhere in the tree below it and shows a full-screen fallback instead of the
// blank white screen an uncaught error would otherwise leave behind. Does NOT
// catch errors in event handlers, async code, or its own render — those still
// need their own try/catch.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-boundary-screen">
        <div className="error-boundary-panel">
          <h1>Something went wrong</h1>
          <p className="hint">
            Spark hit an unexpected error and couldn't continue. Nothing you were working on
            was lost — worlds, characters, and rosters are all saved as you go — but this
            screen needs a reload to recover.
          </p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reload Spark
          </button>
          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
