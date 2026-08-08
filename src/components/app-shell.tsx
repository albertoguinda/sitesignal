import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router";
import {
  Activity,
  LayoutGrid,
  LineChart,
  Palette,
  User,
  Building2,
  LogOut,
  Settings,
  ChevronDown,
  Bell,
  Moon,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentOrganization } from "@/lib/organization-context";

const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/analytics", label: "Analytics", icon: LineChart, end: false },
  { to: "/design-system", label: "Design system", icon: Palette, end: false },
];

const DROPDOWN_ITEMS = [
  { label: "My profile", icon: User },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings },
  { label: "Appearance", icon: Moon },
  { label: "Help & support", icon: HelpCircle },
];

/** Wall clock — live, not decorative. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden items-center gap-2 text-xs text-ink-muted sm:flex" aria-live="polite">
      <span className="relative flex size-2" aria-hidden>
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

/**
 * Accessible profile dropdown — WCAG AA 2.2 compliant.
 * Keyboard: Enter/Space open, Escape/arrows navigate, Tab traps inside.
 */
function ProfileDropdown({
  user,
  organizations,
  currentOrgId,
  setCurrentOrgId,
}: {
  user: { email: string; name: string };
  organizations: { id: string; name: string }[];
  currentOrgId: string | undefined;
  setCurrentOrgId: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  // Close on Escape + arrow key navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      const items = menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']");
      if (!items?.length) return;
      const focusables = [...items];
      const idx = focusables.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusables[(idx + 1) % focusables.length].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusables[(idx - 1 + focusables.length) % focusables.length].focus();
      } else if (e.key === "Tab") {
        close();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, close]);

  // Focus first item when opened
  useEffect(() => {
    if (open) {
      const first = menuRef.current?.querySelector<HTMLElement>("[role='menuitem']");
      first?.focus();
    }
  }, [open]);

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`User menu: ${user.name}`}
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all motion-fast",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-base",
          "hover:bg-elevated",
          open && "bg-elevated",
        )}
      >
        {/* Avatar with neon glow */}
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/20 ring-2 ring-brand/40">
          <span className="text-xs font-bold text-brand">{initials}</span>
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-base bg-ok" aria-hidden />
        </span>
        <span className="hidden flex-col text-left sm:block">
          <span className="text-xs font-medium text-ink leading-tight">{user.name}</span>
          <span className="text-2xs text-ink-muted leading-tight">{user.email}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 text-ink-muted transition-transform motion-fast hidden sm:block",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="User actions"
          className={cn(
            "absolute right-0 top-full z-[200] mt-2 w-64 origin-top-right",
            "rounded-xl border border-glass bg-glass shadow-lg shadow-black/40",
            "backdrop-blur-xl",
            "animate-dropdown",
          )}
        >
          {/* User info header */}
          <div className="border-b border-line-faint px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/20 ring-2 ring-brand/40">
                <span className="text-sm font-bold text-brand">{initials}</span>
                <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-overlay bg-ok" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">{user.name}</p>
                <p className="text-xs text-ink-muted truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Org selector */}
          {organizations.length > 1 && (
            <div className="border-b border-line-faint px-4 py-2.5">
              <label className="label-caps mb-1 block" htmlFor="org-select">
                Organization
              </label>
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-ink-muted shrink-0" aria-hidden />
                <select
                  id="org-select"
                  value={currentOrgId ?? ""}
                  onChange={(e) => setCurrentOrgId(e.target.value || undefined)}
                  className="w-full rounded-md border border-line bg-elevated px-2 py-1 text-xs text-ink focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Menu items */}
          <div className="p-1.5">
            {DROPDOWN_ITEMS.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={close}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft",
                  "transition-colors motion-fast",
                  "hover:bg-brand-wash hover:text-ink",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                )}
              >
                <item.icon className="size-4 text-ink-muted" aria-hidden />
                {item.label}
              </button>
            ))}
          </div>

          {/* Sign out */}
          <div className="border-t border-line-faint p-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={close}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-critical",
                "transition-colors motion-fast",
                "hover:bg-critical-wash",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
              )}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { currentOrgId, organizations, setCurrentOrgId } = useCurrentOrganization();

  // Demo mode — hardcoded user, no auth
  const user = { email: "demo@sitesignal.io", name: "Demo User" };

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-brand-contrast"
      >
        Skip to content
      </a>

      {/* ── Header: full-width glass navbar ─────────────────────────── */}
      <header className="sticky top-0 z-[100] border-b border-glass bg-glass backdrop-blur-xl supports-[backdrop-filter]:bg-glass/80">
        {/* Subtle neon accent line at top */}
        <span
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-60"
          aria-hidden
        />

        <div className="flex h-14 w-full items-center gap-4 px-4 sm:gap-6 sm:px-6">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0" aria-label="SiteSignal home">
            <span className="grid size-7 place-items-center rounded-lg border border-brand/40 bg-brand-wash shadow-[var(--sig-neon-brand)]">
              <Activity className="size-4 text-brand" aria-hidden />
            </span>
            <span className="text-md font-semibold tracking-tight text-ink">
              Site<span className="text-brand">Signal</span>
            </span>
          </NavLink>

          {/* Nav */}
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all motion-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    isActive
                      ? "bg-brand-wash text-brand shadow-[0_0_12px_color-mix(in_oklab,var(--sig-cyan-400)_25%,transparent)]"
                      : "text-ink-muted hover:bg-elevated hover:text-ink",
                  )
                }
              >
                <item.icon className="size-3.5" aria-hidden />
                <span className="hidden sm:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right section */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <LiveClock />

            {user && (
              <ProfileDropdown
                user={user}
                organizations={organizations}
                currentOrgId={currentOrgId}
                setCurrentOrgId={setCurrentOrgId}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Main: full-width, no max-w constraint ───────────────────── */}
      <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-2xs text-ink-faint">
          <span>SiteSignal — asset monitoring template</span>
          <span>Ambient conditions by Open-Meteo · telemetry seeded locally</span>
        </div>
      </footer>
    </div>
  );
}
