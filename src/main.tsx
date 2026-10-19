import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@fontsource-variable/inter";
import "./styles.css";
import "./design-system.css";
import "./styles/editor.css";
import { AppProvider } from "./lib/context";
import { Shell } from "./components/Shell";
import { Spinner } from "./components/Common";
import Home from "./pages/Home";
const Explore = lazy(() => import("./pages/Explore")),
  Details = lazy(() => import("./pages/Details")),
  Customise = lazy(() => import("./pages/Customise")),
  Editor = lazy(() => import("./pages/Editor")),
  Workspace = lazy(() => import("./pages/Workspace")),
  Auth = lazy(() => import("./pages/Auth")),
  Admin = lazy(() => import("./pages/Admin")),
  HowItWorks = lazy(() => import("./pages/HowItWorks")),
  Info = lazy(() => import("./pages/Info"));
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="error-state">
        <h1>Something needs a fresh start.</h1>
        <p>Your saved presentations are still in your workspace.</p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload CampusDeck
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AppProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="explore" element={<Explore />} />
              <Route path="templates" element={<Explore />} />
              {[
                "college",
                "corporate",
                "business",
                "healthcare",
                "research",
                "events",
              ].map((category) => (
                <Route key={category} path={category} element={<Explore />} />
              ))}
              <Route path="templates/:id" element={<Details />} />
              <Route path="customise/:id" element={<Customise />} />
              <Route path="workspace" element={<Workspace />} />
              <Route path="auth" element={<Auth />} />
              <Route path="sign-in" element={<Auth />} />
              <Route path="sign-up" element={<Auth />} />
              <Route path="how-it-works" element={<HowItWorks />} />
              <Route path="admin" element={<Admin />} />
              <Route path="*" element={<Info />} />
            </Route>
            <Route path="editor/:id" element={<Editor />} />
            <Route path="editor" element={<Editor />} />
          </Routes>
        </Suspense>
      </AppProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
