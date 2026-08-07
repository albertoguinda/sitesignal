import type { AlertSeverity, AlertState, AssetStatus } from "@shared/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<AssetStatus, NonNullable<BadgeProps["tone"]>> = {
  ok: "ok",
  warning: "warning",
  critical: "critical",
};

const SEVERITY_TONE: Record<AlertSeverity, NonNullable<BadgeProps["tone"]>> = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

const STATE_TONE: Record<AlertState, NonNullable<BadgeProps["tone"]>> = {
  open: "critical",
  ack: "warning",
  resolved: "neutral",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
  ok: "Nominal",
  warning: "Warning",
  critical: "Critical",
};

/** Solid dot in the status hue — the smallest possible status signal. */
export function StatusDot({ status, className }: { status: AssetStatus; className?: string }) {
  const tone =
    status === "ok" ? "bg-ok" : status === "warning" ? "bg-warning" : "bg-critical";
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", tone, className)}
      aria-hidden
    />
  );
}

export function StatusBadge({ status, className }: { status: AssetStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      <StatusDot status={status} />
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={className}>
      {severity}
    </Badge>
  );
}

export function AlertStateBadge({ state, className }: { state: AlertState; className?: string }) {
  return (
    <Badge tone={STATE_TONE[state]} className={className}>
      {state === "ack" ? "acknowledged" : state}
    </Badge>
  );
}
