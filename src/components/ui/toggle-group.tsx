import type { ComponentProps } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

export function ToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-line bg-sunken p-1",
        className,
      )}
      {...props}
    />
  );
}

export function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex h-7 min-w-9 items-center justify-center rounded-sm px-2.5 text-xs font-semibold text-ink-muted",
        "transition-colors motion-fast hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        "data-[state=on]:bg-elevated data-[state=on]:text-ink data-[state=on]:shadow-sm",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
