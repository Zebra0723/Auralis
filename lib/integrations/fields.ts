import type { FieldSpec } from "@/lib/integrations/types";

/**
 * The canonical vocabulary. Providers map their own field names onto these keys,
 * which is what lets Auralis answer "which connected services support this field"
 * without hardcoding pairs of services against each other.
 */
export const CANONICAL_PROFILE_FIELDS: Record<string, Omit<FieldSpec, "writable">> = {
  displayName: { key: "displayName", label: "Display name", type: "string" },
  firstName: { key: "firstName", label: "First name", type: "string" },
  lastName: { key: "lastName", label: "Last name", type: "string" },
  email: { key: "email", label: "Email address", type: "email" },
  phone: { key: "phone", label: "Phone number", type: "phone" },
  jobTitle: { key: "jobTitle", label: "Job title", type: "string" },
  company: { key: "company", label: "Company", type: "string" },
  department: { key: "department", label: "Department", type: "string" },
  location: { key: "location", label: "Location", type: "string" },
  bio: { key: "bio", label: "Bio", type: "text" },
  website: { key: "website", label: "Website", type: "url" },
  avatarUrl: { key: "avatarUrl", label: "Profile photo", type: "image" },
  timezone: { key: "timezone", label: "Time zone", type: "string" },
  pronouns: { key: "pronouns", label: "Pronouns", type: "string" },
};

/** Build a provider's field list: `writable` keys can be written, the rest are read-only. */
export function fields(readable: string[], writable: string[] = []): FieldSpec[] {
  return readable.map((key) => {
    const base = CANONICAL_PROFILE_FIELDS[key];
    if (!base) throw new Error(`Unknown canonical field: ${key}`);
    return { ...base, writable: writable.includes(key) };
  });
}

export function fieldLabel(key: string): string {
  return CANONICAL_PROFILE_FIELDS[key]?.label ?? key;
}
