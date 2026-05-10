import { Component, Suspense, lazy, type ReactNode, type ErrorInfo } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Explorer } from "./pages/Explorer";
import { JobDetail } from "./pages/JobDetail";
import { Landing } from "./pages/Landing";

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; componentStack: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TrustMesh] Uncaught render error:", error, info);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgb(14 19 32)",
            color: "rgb(236 242 255)",
            fontFamily: "Plus Jakarta Sans, sans-serif",
            padding: "2rem",
            textAlign: "center"
          }}
        >
          <div style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            TrustMesh couldn't start
          </div>
          <p style={{ color: "rgb(148 163 184)", maxWidth: "480px", lineHeight: 1.6 }}>
            A startup error occurred. Try refreshing the page. If the problem persists, clear site
            data in your browser settings.
          </p>
          <button
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.5rem",
              borderRadius: "999px",
              background: "rgb(99 102 241)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 600
            }}
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <pre
            style={{
              marginTop: "1.5rem",
              fontSize: "0.75rem",
              color: "rgb(100 116 139)",
              maxWidth: "600px",
              textAlign: "left",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}
          >
            {this.state.error.message}
            {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ""}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const Deploy = lazy(async () => ({
  default: (await import("./pages/Deploy")).Deploy
}));

const Analytics = lazy(async () => ({
  default: (await import("./pages/Analytics")).Analytics
}));

const About = lazy(async () => ({
  default: (await import("./pages/About")).About
}));

const Docs = lazy(async () => ({
  default: (await import("./pages/Docs")).Docs
}));

const Nodes = lazy(async () => ({
  default: (await import("./pages/Nodes")).Nodes
}));

const Settings = lazy(async () => ({
  default: (await import("./pages/Settings")).Settings
}));

const Support = lazy(async () => ({
  default: (await import("./pages/Support")).Support
}));

function RouteFallback() {
  return <div className="min-h-[calc(100vh-5rem)] bg-silk-bg" />;
}

export function App() {
  return (
    <RootErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/about" element={<About />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/support" element={<Support />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
    </RootErrorBoundary>
  );
}
