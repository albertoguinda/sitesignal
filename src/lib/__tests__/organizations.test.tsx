import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import {
  useOrganizations,
  useOrganization,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
  useInviteMember,
  useRemoveMember,
  orgQueryKeys,
} from "../organizations";

// Create a wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("useOrganizations()", () => {
  it("fetches organizations successfully", async () => {
    const mockOrgs = [
      {
        id: "org-1",
        name: "Acme Corp",
        slug: "acme-corp",
        description: "A great company",
        logoUrl: null,
        createdAt: "2024-01-01",
      },
      {
        id: "org-2",
        name: "TechStart",
        slug: "techstart",
        description: null,
        logoUrl: null,
        createdAt: "2024-02-01",
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrgs,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useOrganizations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOrgs);
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal server error" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useOrganizations(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });
});

describe("useCreateOrganization()", () => {
  it("creates organization successfully", async () => {
    const mockOrg = {
      id: "org-new",
      name: "New Corp",
      slug: "new-corp",
      description: "A new company",
      logoUrl: null,
      createdAt: "2024-03-01",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrg,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: "New Corp",
        slug: "new-corp",
        description: "A new company",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOrg);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "New Corp",
          slug: "new-corp",
          description: "A new company",
        }),
      })
    );
  });

  it("handles creation error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Slug already taken" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateOrganization(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          name: "Existing Corp",
          slug: "existing-corp",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Slug already taken");
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useInviteMember()", () => {
  it("invites member successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Member added successfully" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useInviteMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        orgId: "org-1",
        email: "new@example.com",
        role: "member",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations/org-1/invite",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "new@example.com",
          role: "member",
        }),
      })
    );
  });

  it("handles invite error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "User not found" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useInviteMember(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          orgId: "org-1",
          email: "nonexistent@example.com",
          role: "member",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("User not found");
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe("useOrganization()", () => {
  it("fetches a single organization", async () => {
    const mockOrg = {
      id: "org-1",
      name: "Acme Corp",
      slug: "acme-corp",
      description: "A great company",
      logoUrl: null,
      createdAt: "2024-01-01",
      members: [],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrg,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useOrganization("org-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOrg);
  });

  it("does not fetch when id is undefined", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useOrganization(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useUpdateOrganization()", () => {
  it("updates organization successfully", async () => {
    const mockOrg = {
      id: "org-1",
      name: "Updated Corp",
      slug: "acme-corp",
      description: "Updated",
      logoUrl: null,
      createdAt: "2024-01-01",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrg,
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateOrganization(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: "org-1",
        name: "Updated Corp",
        description: "Updated",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOrg);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations/org-1",
      expect.objectContaining({ method: "PUT" })
    );
  });
});

describe("useDeleteOrganization()", () => {
  it("deletes organization successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Deleted" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteOrganization(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("org-1");
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations/org-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("useRemoveMember()", () => {
  it("removes member successfully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Removed" }),
    });

    const wrapper = createWrapper();
    const { result } = renderHook(() => useRemoveMember(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        orgId: "org-1",
        memberId: "member-1",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations/org-1/members/member-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("orgQueryKeys", () => {
  it("generates correct query keys", () => {
    expect(orgQueryKeys.all).toEqual(["organizations"]);
    expect(orgQueryKeys.detail("org-1")).toEqual(["organizations", "org-1"]);
  });
});
