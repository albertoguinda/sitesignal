import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationProvider, useCurrentOrganization } from "../organization-context";

// Mock useOrganizations
vi.mock("../organizations", () => ({
  useOrganizations: vi.fn(),
}));

import { useOrganizations } from "../organizations";
const mockUseOrganizations = vi.mocked(useOrganizations);

function TestConsumer() {
  const { currentOrgId, currentOrg, organizations, isLoading, setCurrentOrgId } = useCurrentOrganization();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="orgCount">{organizations.length}</span>
      <span data-testid="currentOrgId">{currentOrgId ?? "none"}</span>
      <span data-testid="currentOrgName">{currentOrg?.name ?? "none"}</span>
      <button onClick={() => setCurrentOrgId("org-2")}>Switch</button>
    </div>
  );
}

function renderWithProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        <TestConsumer />
      </OrganizationProvider>
    </QueryClientProvider>
  );
}

describe("organization-context.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching organizations", () => {
    mockUseOrganizations.mockReturnValue({ data: undefined, isLoading: true } as any);
    renderWithProvider();

    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("orgCount").textContent).toBe("0");
  });

  it("auto-selects first organization", async () => {
    mockUseOrganizations.mockReturnValue({
      data: [
        { id: "org-1", name: "Org 1", slug: "org-1" },
        { id: "org-2", name: "Org 2", slug: "org-2" },
      ],
      isLoading: false,
    } as any);

    renderWithProvider();

    expect(screen.getByTestId("currentOrgId").textContent).toBe("org-1");
    expect(screen.getByTestId("currentOrgName").textContent).toBe("Org 1");
  });

  it("shows all organizations", () => {
    mockUseOrganizations.mockReturnValue({
      data: [
        { id: "org-1", name: "Org 1", slug: "org-1" },
        { id: "org-2", name: "Org 2", slug: "org-2" },
      ],
      isLoading: false,
    } as any);

    renderWithProvider();
    expect(screen.getByTestId("orgCount").textContent).toBe("2");
  });

  it("allows switching organizations", async () => {
    mockUseOrganizations.mockReturnValue({
      data: [
        { id: "org-1", name: "Org 1", slug: "org-1" },
        { id: "org-2", name: "Org 2", slug: "org-2" },
      ],
      isLoading: false,
    } as any);

    renderWithProvider();

    expect(screen.getByTestId("currentOrgId").textContent).toBe("org-1");

    await act(async () => {
      screen.getByRole("button", { name: "Switch" }).click();
    });

    expect(screen.getByTestId("currentOrgId").textContent).toBe("org-2");
    expect(screen.getByTestId("currentOrgName").textContent).toBe("Org 2");
  });

  it("shows 'none' when no organizations exist", () => {
    mockUseOrganizations.mockReturnValue({ data: [], isLoading: false } as any);

    renderWithProvider();
    expect(screen.getByTestId("currentOrgId").textContent).toBe("none");
  });

  it("throws when used outside provider", () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow("useCurrentOrganization must be used within OrganizationProvider");

    spy.mockRestore();
  });
});
