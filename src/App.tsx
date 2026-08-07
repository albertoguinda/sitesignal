import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import OverviewPage from "@/routes/overview";

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

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
