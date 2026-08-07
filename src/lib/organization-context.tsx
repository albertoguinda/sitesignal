import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useOrganizations } from "./organizations";

interface OrganizationContextValue {
  currentOrgId: string | undefined;
  currentOrg: Organization | undefined;
  organizations: Organization[];
  isLoading: boolean;
  setCurrentOrgId: (id: string | undefined) => void;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { data: organizations = [], isLoading } = useOrganizations();
  const [currentOrgId, setCurrentOrgId] = useState<string | undefined>(undefined);

  // Auto-select first organization if none selected
  useEffect(() => {
    if (!isLoading && organizations.length > 0 && currentOrgId === undefined) {
      const firstOrg = organizations[0];
      if (firstOrg) {
        setCurrentOrgId(firstOrg.id);
      }
    }
  }, [isLoading, organizations, currentOrgId]);

  const currentOrg = organizations.find((org) => org.id === currentOrgId);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrgId,
        currentOrg,
        organizations,
        isLoading,
        setCurrentOrgId,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useCurrentOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useCurrentOrganization must be used within OrganizationProvider");
  }
  return context;
}
