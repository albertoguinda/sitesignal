import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { OrganizationProvider } from "@/lib/organization-context";
import OverviewPage from "@/routes/overview";

// three.js and Recharts only load on the routes that need them.
const AssetDetailPage = lazy(() => import("@/routes/asset-detail"));
const AnalyticsPage = lazy(() => import("@/routes/analytics"));
const DesignSystemPage = lazy(() => import("@/routes/design-system"));
const NotFoundPage = lazy(() => import("@/routes/not-found"));

function LazyRoute({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex items-center justify-center p-8 text-sm text-ink-faint">Loading...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <OrganizationProvider>
      <Routes>
        <Route
          path="/"
          element={
            <AppShell>
              <OverviewPage />
            </AppShell>
          }
        />
        <Route
          path="/assets/:id"
          element={
            <AppShell>
              <LazyRoute><AssetDetailPage /></LazyRoute>
            </AppShell>
          }
        />
        <Route
          path="/analytics"
          element={
            <AppShell>
              <LazyRoute><AnalyticsPage /></LazyRoute>
            </AppShell>
          }
        />
        <Route
          path="/design-system"
          element={
            <AppShell>
              <LazyRoute><DesignSystemPage /></LazyRoute>
            </AppShell>
          }
        />
        <Route path="*" element={<LazyRoute><NotFoundPage /></LazyRoute>} />
      </Routes>
    </OrganizationProvider>
  );
}
