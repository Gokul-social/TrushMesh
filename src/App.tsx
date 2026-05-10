import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Explorer } from "./pages/Explorer";
import { JobDetail } from "./pages/JobDetail";
import { Landing } from "./pages/Landing";

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
  );
}
