-- =============================================================================
-- CMS schema for the Supabase adapter.
--
-- Run once per project: Supabase Dashboard -> SQL Editor -> paste -> Run,
-- or `supabase db push` if you keep migrations in the repo.
--
-- Table shape is explained in adapters/supabase/index.ts: `slug` and `status`
-- are promoted to real, indexed columns because the CMS filters on them
-- constantly; everything else lives in `data` (jsonb) so content models can
-- gain fields without a migration.
--
-- If you change SUPABASE_TABLE_PREFIX, change the prefix here to match.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Content collections -------------------------------------------------------
do $$
declare
  collection text;
  collections text[] := array[
    'pages', 'posts', 'authors', 'destinations', 'regions', 'tours', 'activities',
    'testimonials', 'faqs', 'media', 'menus', 'redirects',
    'users', 'enquiries', 'subscribers', 'activity_log'
  ];
begin
  foreach collection in array collections loop
    execute format($f$
      create table if not exists public.cms_%s (
        id          uuid primary key default gen_random_uuid(),
        slug        text,
        status      text,
        created_at  timestamptz not null default now(),
        updated_at  timestamptz not null default now(),
        data        jsonb not null default '{}'::jsonb
      );
    $f$, collection);

    execute format(
      'create index if not exists cms_%s_status_idx on public.cms_%s (status);',
      collection, collection);

    execute format(
      'create index if not exists cms_%s_updated_at_idx on public.cms_%s (updated_at desc);',
      collection, collection);

    execute format(
      'create index if not exists cms_%s_data_gin on public.cms_%s using gin (data jsonb_path_ops);',
      collection, collection);

    -- Slugs must be unique per collection where present.
    execute format(
      'create unique index if not exists cms_%s_slug_key on public.cms_%s (slug) where slug is not null;',
      collection, collection);
  end loop;
end $$;

-- Singletons (site settings, onboarding flags) ------------------------------
create table if not exists public.cms_kv (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Users need a unique email regardless of slug.
create unique index if not exists cms_users_email_key
  on public.cms_users ((data->>'email'));

-- One row per newsletter address; the repository relies on this under races.
create unique index if not exists cms_subscribers_email_key
  on public.cms_subscribers ((data->>'email'));

-- Redirects are looked up by source path on every unmatched request.
create unique index if not exists cms_redirects_source_key
  on public.cms_redirects ((data->>'source'));

-- =============================================================================
-- Row Level Security
--
-- All CMS access goes through the service-role key on the server, which
-- bypasses RLS. RLS is therefore enabled with NO policies: that denies every
-- anon/authenticated client request while leaving server-side CMS access
-- working. If you query these tables directly from the browser with the anon
-- key, add explicit read policies for the rows you intend to expose.
--
-- TODO(phase-4): tenant-scoped policies for shared-database deployments.
-- =============================================================================
do $$
declare
  collection text;
  collections text[] := array[
    'pages', 'posts', 'authors', 'destinations', 'regions', 'tours', 'activities',
    'testimonials', 'faqs', 'media', 'menus', 'redirects',
    'users', 'enquiries', 'subscribers', 'activity_log', 'kv'
  ];
begin
  foreach collection in array collections loop
    execute format(
      'alter table public.cms_%s enable row level security;', collection);
  end loop;
end $$;
