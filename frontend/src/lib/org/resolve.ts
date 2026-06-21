import type { OrgChart } from "../../types/contracts";

export interface OwnerIdentity { name: string; role: string; }

export function resolveOwner(org: OrgChart | null | undefined, token: string): OwnerIdentity {
  const hit = org?.owners?.[token];
  return hit ? { name: hit.name, role: hit.role } : { name: token, role: "" };
}

export function ownerName(org: OrgChart | null | undefined, token: string | null | undefined): string {
  if (!token) return "";
  return resolveOwner(org, token).name;
}
