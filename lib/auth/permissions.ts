import type { Permission, PermissionAction, Role, Session } from "@/types/user";

/**
 * Role-based permissions.
 *
 * A permission is `<resource>.<action>`. Roles are bundles of permissions, and
 * a user may be granted extras on top of their role. `*` means everything and
 * is reserved for super admins.
 *
 * These checks are enforced server-side in `lib/auth/guard.ts`. The admin UI
 * also consults them, but only to hide controls the user cannot use — hiding a
 * button is never the authorisation boundary (§17).
 */

/** Resources that can be permission-checked. Mirrors the CMS modules. */
export const RESOURCES = [
  "pages",
  "blog",
  "authors",
  "media",
  "destinations",
  "regions",
  "tours",
  "activities",
  "testimonials",
  "faqs",
  "navigation",
  "seo",
  "redirects",
  "settings",
  "enquiries",
  "bookings",
  "customers",
  "users",
  "roles",
  "integrations",
  "database",
  "developer",
] as const;

export type Resource = (typeof RESOURCES)[number];

const ALL_ACTIONS: PermissionAction[] = [
  "read",
  "create",
  "update",
  "delete",
  "publish",
];

/** Resources an editor-level user is trusted with end-to-end. */
const CONTENT_RESOURCES: Resource[] = [
  "pages",
  "blog",
  "authors",
  "media",
  "destinations",
  "regions",
  "tours",
  "activities",
  "testimonials",
  "faqs",
];

function expand(
  resources: Resource[],
  actions: PermissionAction[],
): Permission[] {
  return resources.flatMap((resource) =>
    actions.map((action): Permission => `${resource}.${action}`),
  );
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Full control, including roles, developer settings and destructive actions.
  super_admin: ["*"],

  // Runs the site day to day. Cannot change roles or touch developer settings.
  admin: [
    ...expand([...RESOURCES], ALL_ACTIONS).filter((permission) => {
      // Admins may look at roles and developer settings but not change them,
      // and may not delete users or the database.
      if (permission.startsWith("roles.")) return permission === "roles.read";
      if (permission.startsWith("developer.")) {
        return permission === "developer.read";
      }
      return (
        permission !== "database.update" &&
        permission !== "database.delete" &&
        permission !== "users.delete"
      );
    }),
  ],

  // Owns the content. Can publish. No users, settings writes or integrations.
  editor: [
    ...expand(CONTENT_RESOURCES, ALL_ACTIONS),
    ...expand(["navigation", "seo", "redirects"], ALL_ACTIONS),
    "enquiries.read",
    "enquiries.update",
    "settings.read",
    "users.read",
  ],

  // Writes content but cannot publish or delete it.
  author: [
    ...expand(CONTENT_RESOURCES, ["read", "create", "update"]),
    "media.delete",
    "settings.read",
  ],

  // Read-only access, for clients who just want to look.
  viewer: [...expand([...RESOURCES], ["read"])],
};

/** The full permission set a role grants. */
export function permissionsForRole(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Does this principal hold `permission`?
 *
 * Accepts a session or a bare role so it can be used before a session exists
 * (for example when previewing what a role would be able to do).
 */
export function hasPermission(
  principal: Pick<Session, "role"> & { extraPermissions?: Permission[] },
  permission: Permission,
): boolean {
  const granted = permissionsForRole(principal.role);
  if (granted.includes("*")) return true;
  if (granted.includes(permission)) return true;
  return principal.extraPermissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  principal: Pick<Session, "role"> & { extraPermissions?: Permission[] },
  permissions: Permission[],
): boolean {
  return permissions.some((permission) =>
    hasPermission(principal, permission),
  );
}

/** Human-readable role labels for the admin UI. */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  author: "Author",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin:
    "Everything, including user roles, developer settings and the database.",
  admin: "Runs the site: all content, media, menus, SEO and settings.",
  editor: "Creates, edits and publishes all content. No user management.",
  author: "Writes and edits content, but cannot publish or delete it.",
  viewer: "Read-only access to the admin panel.",
};

/**
 * TODO(phase-4): per-record ownership, so an author can edit only their own
 * drafts. Needs an `authorId` check in the repositories, not just here.
 */
