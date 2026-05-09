import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell, PlaceholderScreen, shellPageMeta } from "./components/AppShell";
import { Explorer } from "./pages/Explorer";
import { JobDetail } from "./pages/JobDetail";
import { Landing } from "./pages/Landing";
import { Settings } from "./pages/Settings";

const Deploy = lazy(async () => ({
  default: (await import("./pages/Deploy")).Deploy
}));

function RouteFallback() {
  return <div className="min-h-[calc(100vh-5rem)] bg-silk-bg" />;
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="/explorer" element={<Explorer />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/deploy" element={<Deploy />} />
            <Route
              path="/docs"
              element={<PlaceholderScreen {...shellPageMeta.docs} ctaLabel="Open Explorer" />}
            />
            <Route
              path="/about"
              element={<PlaceholderScreen {...shellPageMeta.about} ctaLabel="Return to Landing" ctaTo="/" />}
            />
            <Route
              path="/analytics"
              element={<PlaceholderScreen {...shellPageMeta.analytics} ctaLabel="View Active Jobs" />}
            />
            <Route
              path="/nodes"
              element={<PlaceholderScreen {...shellPageMeta.nodes} ctaLabel="Open Explorer" />}
            />
            <Route
              path="/settings"
              element={<Settings />}
            />
            <Route
              path="/support"
              element={<PlaceholderScreen {...shellPageMeta.support} ctaLabel="Back to Explorer" />}
            />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
