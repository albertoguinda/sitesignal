import { lazy } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/app-shell";
import { OrganizationProvider } from "@/lib/organization-context";
import OverviewPage from "@/routes/overview";

// three.js and Recharts only load on the routes that need them.
const AssetDetailPage = lazy(() => import("@/routes/asset-detail"));
const AnalyticsPage = lazy(() => import("@/routes/analytics"));
const DesignSystemPage = lazy(() => import("@/routes/design-system"));
const NotFoundPage = lazy(() => import("@/routes/not-found"));

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
              <AssetDetailPage />
            </AppShell>
          }
        />
        <Route
          path="/analytics"
          element={
            <AppShell>
              <AnalyticsPage />
            </AppShell>
          }
        />
        <Route
          path="/design-system"
          element={
            <AppShell>
              <DesignSystemPage />
            </AppShell>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </OrganizationProvider>
  );
}
