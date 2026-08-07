import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder: a muted block with a light sweep across it. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("relative overflow-hidden rounded-sm bg-elevated", className)}
      {...props}
    >
      <span className="absolute inset-0 animate-sweep bg-gradient-to-r from-transparent via-hover to-transparent" />
    </div>
  );
}
