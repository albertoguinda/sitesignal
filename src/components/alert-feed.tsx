import { Link } from "react-router";
import { BellRing } from "lucide-react";
import type { Alert, AlertWithAsset } from "@shared/types";
import { AlertStateBadge, SeverityBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states";
import { formatDateTime, formatRelative, splitAssetName } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEVERITY_RAIL: Record<AlertWithAsset["severity"], string> = {
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-critical",
};

export function AlertFeed({
  alerts,
  showAsset = true,
  className,
}: {
  alerts: AlertWithAsset[];
  showAsset?: boolean;
  className?: string;
}) {
  if (alerts.length === 0) {
    return (
      <EmptyState
        icon={<BellRing className="size-4" aria-hidden />}
        title="No alerts in scope"
        description="Every asset here is reporting within its configured limits."
      />
    );
  }

  return (
    <ul className={cn("divide-y divide-line-faint", className)}>
      {alerts.map((alert) => {
        const { code, label } = splitAssetName(alert.assetName);
        return (
          <li key={alert.id} className="relative flex gap-3 px-4 py-3 transition-colors motion-fast hover:bg-elevated/50">
            <span
              className={cn(
                "absolute left-1 top-3 h-[calc(100%-1.5rem)] w-0.5 rounded-full",
                SEVERITY_RAIL[alert.severity],
                alert.state === "resolved" && "opacity-35",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <SeverityBadge severity={alert.severity} />
                <AlertStateBadge state={alert.state} />
                {showAsset ? (
                  <Link
                    to={`/assets/${alert.assetId}`}
                    className="rounded-sm text-xs font-medium text-ink-soft transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <span className="tabular text-ink-muted">{code}</span> {label}
                  </Link>
                ) : null}
              </div>
              <p
                className={cn(
                  "mt-1.5 text-sm",
                  alert.state === "resolved" ? "text-ink-muted" : "text-ink-soft",
                )}
              >
                {alert.message}
              </p>
              <p className="mt-1 text-2xs text-ink-faint">
                <time dateTime={alert.openedAt} title={formatDateTime(alert.openedAt)}>
                  {formatRelative(alert.openedAt)}
                </time>
                {showAsset ? <span> · {alert.siteName}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Asset-scoped variant: same layout, without the asset and site references. */
export function AlertHistory({ alerts, siteName }: { alerts: Alert[]; siteName: string }) {
  return (
    <AlertFeed
      showAsset={false}
      alerts={alerts.map((alert) => ({
        ...alert,
        assetName: "",
        assetType: "pump",
        siteId: 0,
        siteName,
      }))}
    />
  );
}
