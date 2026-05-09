import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { Explorer } from "./pages/Explorer";
import { Deploy } from "./pages/Deploy";
import { JobDetail } from "./pages/JobDetail";

function DocsPlaceholder() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-28">
      <div className="neo-raised p-8">
        <h1 className="text-2xl font-semibold text-silk-text-primary">Docs</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-silk-text-secondary">
          The audit explorer is wired and ready. This route is a placeholder for operator docs,
          runbooks, and protocol notes.
        </p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-silk-bg">
        <NavBar />
        <Routes>
          <Route path="/" element={<Explorer />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/deploy" element={<Deploy />} />
          <Route path="/docs" element={<DocsPlaceholder />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
