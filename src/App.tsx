import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell, PlaceholderScreen, shellPageMeta } from "./components/AppShell";
import { Explorer } from "./pages/Explorer";
import { Deploy } from "./pages/Deploy";
import { JobDetail } from "./pages/JobDetail";
import { Landing } from "./pages/Landing";

export function App() {
  return (
    <BrowserRouter>
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
            element={<PlaceholderScreen {...shellPageMeta.settings} ctaLabel="Back to Explorer" />}
          />
          <Route
            path="/support"
            element={<PlaceholderScreen {...shellPageMeta.support} ctaLabel="Back to Explorer" />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
