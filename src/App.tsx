import { lazy } from "react";
import { Route, Routes, Navigate } from "react-router";
import { AppShell } from "@/components/app-shell";
import { AuthProvider, useAuth } from "@/lib/auth";
import { OrganizationProvider } from "@/lib/organization-context";
import { Skeleton } from "@/components/ui/skeleton";
import OverviewPage from "@/routes/overview";
import LoginPage from "@/routes/login";

// three.js and Recharts only load on the routes that need them.
const AssetDetailPage = lazy(() => import("@/routes/asset-detail"));
const AnalyticsPage = lazy(() => import("@/routes/analytics"));
const DesignSystemPage = lazy(() => import("@/routes/design-system"));
const NotFoundPage = lazy(() => import("@/routes/not-found"));

function RouteFallback() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <OverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/assets/:id"
            element={
              <ProtectedRoute>
                <AssetDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/design-system"
            element={
              <ProtectedRoute>
                <DesignSystemPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </OrganizationProvider>
    </AuthProvider>
  );
}
