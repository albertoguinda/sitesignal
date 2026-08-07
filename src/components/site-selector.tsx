import { MapPin } from "lucide-react";
import type { Site } from "@shared/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ALL_SITES = "all";

export function SiteSelector({
  sites,
  value,
  onChange,
}: {
  sites: Site[];
  value: number | undefined;
  onChange: (siteId: number | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <MapPin className="size-4 shrink-0 text-ink-muted" aria-hidden />
      <Select
        value={value === undefined ? ALL_SITES : String(value)}
        onValueChange={(next) => onChange(next === ALL_SITES ? undefined : Number(next))}
      >
        <SelectTrigger className="w-56" aria-label="Filter by site">
          <SelectValue placeholder="Select a site" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SITES}>All sites</SelectItem>
          <SelectSeparator />
          {sites.map((site) => (
            <SelectItem key={site.id} value={String(site.id)}>
              {site.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
