import type {
  AuthProviderId,
  DatabaseProviderId,
  ProviderDefinition,
  StorageProviderId,
} from "@/types/connections";

/**
 * The provider catalogue.
 *
 * This is data, not code: the Connections screen renders whatever is listed
 * here, so adding a provider is a definition plus an adapter — no UI changes.
 *
 * Each field names the environment variable that supplies it; that is the
 * only source. Nothing here is entered through the admin.
 *
 * `status` is stated honestly. "unverified" means the code is written but has
 * not been run against a live instance of that provider; the admin shows that
 * badge rather than implying everything is equally proven.
 */

export const DATABASE_PROVIDERS: ProviderDefinition<DatabaseProviderId>[] = [
  {
    id: "local",
    kind: "database",
    label: "Local files",
    description:
      "JSON files under .cms-data/. No setup, no account. Development only.",
    status: "stable",
    fields: [],
    setup: [
      "Nothing to configure — this is the default so a fresh clone runs immediately.",
      "Not suitable for production: no cross-process locking, and serverless hosts wipe the filesystem between requests.",
    ],
  },
  {
    id: "supabase",
    kind: "database",
    label: "Supabase",
    description: "Postgres over Supabase's API. The recommended production backend.",
    status: "stable",
    docsUrl: "https://supabase.com/dashboard",
    fields: [
      {
        name: "url",
        label: "Project URL",
        required: true,
        envVar: "SUPABASE_URL",
        help: "Supabase dashboard → Project Settings → Data API.",
      },
      {
        name: "serviceRoleKey",
        label: "Service role key",
        required: true,
        envVar: "SUPABASE_SERVICE_ROLE_KEY",
        help: "Server-side only. It bypasses row level security, so never prefix it with NEXT_PUBLIC_.",
      },
      {
        name: "tablePrefix",
        label: "Table prefix",
        envVar: "SUPABASE_TABLE_PREFIX",
        help: "Lets CMS tables share a database with your own. Defaults to cms_.",
      },
    ],
    setup: [
      "Create a project at supabase.com.",
      "Open SQL Editor and run adapters/supabase/schema.sql from this repository.",
      "Copy the project URL and service role key from Project Settings → API.",
    ],
  },
  {
    id: "neon",
    kind: "database",
    label: "Neon",
    description: "Serverless Postgres, queried over HTTP. Good fit for Vercel.",
    status: "unverified",
    docsUrl: "https://console.neon.tech",
    fields: [
      {
        name: "connectionString",
        label: "Connection string",
        required: true,
        envVar: "NEON_DATABASE_URL",
        help: "Neon console → your project → Connection Details. Use the pooled connection string.",
      },
      {
        name: "tablePrefix",
        label: "Table prefix",
        envVar: "NEON_TABLE_PREFIX",
        help: "Defaults to cms_.",
      },
    ],
    setup: [
      "Create a project at neon.tech.",
      "Run adapters/neon/schema.sql from this repository in the Neon SQL Editor.",
      "Copy the connection string from the project dashboard.",
    ],
  },
  {
    id: "postgres",
    kind: "database",
    label: "Postgres",
    description: "Self-hosted Postgres over TCP. Good fit for Docker on a VPS.",
    status: "unverified",
    fields: [
      {
        name: "connectionString",
        label: "Connection string",
        required: true,
        envVar: "POSTGRES_DATABASE_URL",
        help: "Example: postgresql://cms:cms_password@postgres:5432/cms",
      },
      {
        name: "tablePrefix",
        label: "Table prefix",
        envVar: "POSTGRES_TABLE_PREFIX",
        help: "Defaults to cms_.",
      },
    ],
    setup: [
      "Run adapters/postgres/schema.sql once, or use the provided docker-compose.yml to initialise the database automatically.",
      "Set CMS_DATABASE=postgres and POSTGRES_DATABASE_URL in the app environment.",
    ],
  },
  {
    id: "mongodb",
    kind: "database",
    label: "MongoDB",
    description: "MongoDB Atlas or a self-hosted cluster.",
    status: "unverified",
    requiresPackage: "mongodb",
    docsUrl: "https://cloud.mongodb.com",
    fields: [
      {
        name: "uri",
        label: "Connection URI",
        required: true,
        envVar: "MONGODB_URI",
      },
      {
        name: "database",
        label: "Database name",
        envVar: "MONGODB_DB",
      },
    ],
    setup: [
      "Install the driver: npm install mongodb",
      "Allow your server's IP address in the Atlas network access list.",
    ],
  },
  {
    id: "firebase",
    kind: "database",
    label: "Firebase",
    description: "Not implemented yet — see docs/ROADMAP.md (Phase 4).",
    status: "unavailable",
    requiresPackage: "firebase-admin",
    fields: [],
  },
];

export const STORAGE_PROVIDERS: ProviderDefinition<StorageProviderId>[] = [
  {
    id: "local",
    kind: "storage",
    label: "Local files",
    description: "Writes to public/uploads/. Fine on a single server, lost on serverless.",
    status: "stable",
    fields: [],
  },
  {
    id: "supabase",
    kind: "storage",
    label: "Supabase Storage",
    description: "A public bucket in your Supabase project.",
    status: "stable",
    fields: [
      {
        name: "url",
        label: "Project URL",
        required: true,
        envVar: "SUPABASE_URL",
        help: "The same variable the Supabase database adapter uses.",
      },
      {
        name: "serviceRoleKey",
        label: "Service role key",
        required: true,
        envVar: "SUPABASE_SERVICE_ROLE_KEY",
        help: "Shared with the Supabase database connection.",
      },
      {
        name: "bucket",
        label: "Bucket name",
        envVar: "SUPABASE_STORAGE_BUCKET",
        help: "Defaults to media.",
      },
    ],
    setup: ["Supabase dashboard → Storage → New bucket → name it, mark it Public."],
  },
  {
    id: "s3",
    kind: "storage",
    label: "S3-compatible",
    description:
      "Neon Object Storage, AWS S3, Cloudflare R2. Verified on Neon; the bucket must allow public reads.",
    status: "stable",
    fields: [
      {
        name: "endpoint",
        label: "Endpoint",
        envVar: "STORAGE_S3_ENDPOINT",
        help: "Neon: the branch's storage endpoint (Console → Connect → Storage). Leave blank for AWS.",
      },
      {
        name: "region",
        label: "Region",
        envVar: "STORAGE_S3_REGION",
        help: "e.g. ap-southeast-1. R2 uses auto.",
      },
      {
        name: "bucket",
        label: "Bucket",
        required: true,
        envVar: "STORAGE_S3_BUCKET",
      },
      {
        name: "accessKeyId",
        label: "Access key ID",
        required: true,
        envVar: "STORAGE_S3_ACCESS_KEY_ID",
        help: "Neon: the credential's token_id (nak_live_…).",
      },
      {
        name: "secretAccessKey",
        label: "Secret access key",
        required: true,
        envVar: "STORAGE_S3_SECRET_ACCESS_KEY",
        help: "Server-side only. Neon: s3_secret_access_key (nsk_live_…).",
      },
      {
        name: "publicUrl",
        label: "Public URL",
        envVar: "STORAGE_S3_PUBLIC_URL",
        help: "Optional CDN or custom domain in front of the bucket. Defaults to endpoint/bucket.",
      },
    ],
    setup: [
      "Neon: Console → Object storage → New bucket → access level public_read.",
      "Neon: Settings → Credentials → create one with storage:read and storage:write.",
      "Full walkthrough: docs/DEPLOY-VERCEL-NEON.md.",
    ],
  },
];

export const AUTH_PROVIDERS: ProviderDefinition<AuthProviderId>[] = [
  {
    id: "credentials",
    kind: "auth",
    label: "Built in",
    description:
      "Email and password stored in this CMS, hashed with scrypt. No third-party account needed.",
    status: "stable",
    signInMode: "credentials",
    fields: [],
  },
  {
    id: "supabase",
    kind: "auth",
    label: "Supabase Auth",
    description:
      "Supabase verifies the password; the CMS still issues the session and owns roles.",
    status: "unverified",
    signInMode: "credentials",
    docsUrl: "https://supabase.com/docs/guides/auth",
    fields: [
      {
        name: "url",
        label: "Project URL",
        required: true,
        envVar: "SUPABASE_AUTH_URL",
        help: "Falls back to SUPABASE_URL if you leave this unset.",
      },
      {
        name: "anonKey",
        label: "Anon / publishable key",
        required: true,
        envVar: "SUPABASE_AUTH_ANON_KEY",
        help: "The anon key is enough to verify a password. The service role key is not needed here.",
      },
    ],
    setup: [
      "Supabase dashboard → Authentication → create the users who should reach the admin.",
      "Add a CMS user under Users with the same email address, so the CMS knows their role.",
    ],
  },
  {
    id: "neon",
    kind: "auth",
    label: "Neon Auth",
    description:
      "Neon Auth (Stack Auth) verifies the password; the CMS issues the session and owns roles.",
    status: "unverified",
    signInMode: "credentials",
    docsUrl: "https://neon.tech/docs/neon-auth/overview",
    fields: [
      {
        name: "projectId",
        label: "Project ID",
        required: true,
        envVar: "NEON_AUTH_PROJECT_ID",
        help: "Neon console → Auth → Configuration.",
      },
      {
        name: "publishableClientKey",
        label: "Publishable client key",
        required: true,
        envVar: "NEON_AUTH_PUBLISHABLE_KEY",
      },
      {
        name: "secretServerKey",
        label: "Secret server key",
        required: true,
        envVar: "NEON_AUTH_SECRET_KEY",
      },
    ],
    setup: [
      "Enable Auth in your Neon project.",
      "Create the users who should reach the admin.",
      "Add a CMS user under Users with the same email address, so the CMS knows their role.",
    ],
  },
  {
    id: "clerk",
    kind: "auth",
    label: "Clerk",
    description:
      "Clerk owns the sign-in screen and the session. The CMS reads it and applies its own roles.",
    status: "unverified",
    signInMode: "hosted",
    docsUrl: "https://dashboard.clerk.com",
    fields: [
      {
        name: "publishableKey",
        label: "Publishable key",
        required: true,
        envVar: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        help: "This one is safe in the browser — that is what it is for.",
      },
      {
        name: "secretKey",
        label: "Secret key",
        required: true,
        envVar: "CLERK_SECRET_KEY",
      },
    ],
    setup: [
      "Create an application at dashboard.clerk.com.",
      "Enable the sign-in methods you want.",
      "Add a CMS user under Users with the same email address, so the CMS knows their role.",
      "Clerk starts before any CMS code runs, so CMS_AUTH=clerk must be in .env.local too.",
    ],
  },
];

export function databaseProvider(
  id: DatabaseProviderId,
): ProviderDefinition<DatabaseProviderId> | undefined {
  return DATABASE_PROVIDERS.find((provider) => provider.id === id);
}

export function storageProvider(
  id: StorageProviderId,
): ProviderDefinition<StorageProviderId> | undefined {
  return STORAGE_PROVIDERS.find((provider) => provider.id === id);
}

export function authProvider(
  id: AuthProviderId,
): ProviderDefinition<AuthProviderId> | undefined {
  return AUTH_PROVIDERS.find((provider) => provider.id === id);
}

export function providersFor(kind: "database" | "storage" | "auth") {
  if (kind === "database") return DATABASE_PROVIDERS as ProviderDefinition[];
  if (kind === "storage") return STORAGE_PROVIDERS as ProviderDefinition[];
  return AUTH_PROVIDERS as ProviderDefinition[];
}
