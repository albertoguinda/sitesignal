import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide leading-none whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line bg-elevated text-ink-soft",
        brand: "border-brand/40 bg-brand-wash text-brand",
        ok: "border-ok-line bg-ok-wash text-ok",
        warning: "border-warning-line bg-warning-wash text-warning",
        critical: "border-critical-line bg-critical-wash text-critical",
        info: "border-info-line bg-info-wash text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
