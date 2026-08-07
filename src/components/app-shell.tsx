import { useEffect, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import { Activity, LayoutGrid, LineChart, Palette, LogOut, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useCurrentOrganization } from "@/lib/organization-context";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/analytics", label: "Analytics", icon: LineChart, end: false },
  { to: "/design-system", label: "Design system", icon: Palette, end: false },
];

/** Wall clock in the header — makes "live" feel literal rather than decorative. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-ok" />
        <span className="relative inline-flex size-2 rounded-full bg-ok" />
      </span>
      <span className="tabular">
        {new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        }).format(now)}
      </span>
      <span className="label-caps">UTC</span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { currentOrgId, organizations, setCurrentOrgId } = useCurrentOrganization();

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-brand-contrast"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[100] border-b border-line bg-base/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[96rem] items-center gap-6 px-4 lg:px-6">
          <NavLink to="/" className="flex items-center gap-2.5" aria-label="SiteSignal home">
            <span className="grid size-7 place-items-center rounded-md border border-brand/40 bg-brand-wash">
              <Activity className="size-4 text-brand" aria-hidden />
            </span>
            <span className="text-md font-semibold tracking-tight text-ink">
              Site<span className="text-brand">Signal</span>
            </span>
          </NavLink>

          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors motion-fast",
                    isActive
                      ? "bg-brand-wash text-brand"
                      : "text-ink-muted hover:bg-elevated hover:text-ink",
                  )
                }
              >
                <item.icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <LiveClock />
            
            {user && (
              <div className="flex items-center gap-3">
                {/* Organization selector */}
                {organizations.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Building2 className="size-3.5 text-ink-muted" />
                    <select
                      value={currentOrgId ?? ""}
                      onChange={(e) => setCurrentOrgId(e.target.value || undefined)}
                      className="rounded-md border border-line bg-base px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                      aria-label="Select organization"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="hidden items-center gap-2 text-xs text-ink-muted sm:flex">
                  <User className="size-3.5" />
                  <span>{user.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                  title="Sign out"
                >
                  <LogOut className="size-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[96rem] flex-1 px-4 py-6 lg:px-6">
        {children}
      </main>

      <footer className="border-t border-line px-4 py-4 lg:px-6">
        <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center justify-between gap-2 text-2xs text-ink-faint">
          <span>SiteSignal — asset monitoring template</span>
          <span>Ambient conditions by Open-Meteo · telemetry seeded locally</span>
        </div>
      </footer>
    </div>
  );
}
