import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  createdAt: string;
}

interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string | null;
  email: string;
  name: string | null;
}

interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[];
}

export const orgQueryKeys = {
  all: ["organizations"] as const,
  detail: (id: string) => ["organizations", id] as const,
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Non-JSON error body
    }
    throw new Error(message);
  }

  return response.json();
}

export function useOrganizations() {
  return useQuery({
    queryKey: orgQueryKeys.all,
    queryFn: () => request<Organization[]>("/organizations"),
  });
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: orgQueryKeys.detail(id ?? ""),
    queryFn: () => request<OrganizationWithMembers>(`/organizations/${id}`),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; slug: string; description?: string }) =>
      request<Organization>("/organizations", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.all });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      request<Organization>(`/organizations/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.detail(variables.id) });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      request<{ message: string }>(`/organizations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.all });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      email,
      role,
    }: {
      orgId: string;
      email: string;
      role: string;
    }) =>
      request<{ message: string }>(`/organizations/${orgId}/invite`, {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.detail(variables.orgId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orgId,
      memberId,
    }: {
      orgId: string;
      memberId: string;
    }) =>
      request<{ message: string }>(`/organizations/${orgId}/members/${memberId}`, {
        method: "DELETE",
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orgQueryKeys.detail(variables.orgId) });
    },
  });
}
