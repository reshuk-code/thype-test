-- =============================================================================
-- CMS schema for the self-hosted Postgres adapter.
--
-- The Docker app initializes this schema before starting the web server.
-- Outside Docker, apply it with:
--
--   psql "$POSTGRES_DATABASE_URL" -f adapters/postgres/schema.sql
--
-- If you change POSTGRES_TABLE_PREFIX, update the cms_ prefix here to match.
-- =============================================================================

create extension if not exists "pgcrypto";

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

    execute format(
      'create unique index if not exists cms_%s_slug_key on public.cms_%s (slug) where slug is not null;',
      collection, collection);
  end loop;
end $$;

create table if not exists public.cms_kv (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create unique index if not exists cms_users_email_key
  on public.cms_users ((data->>'email'));

-- One row per newsletter address; the repository relies on this under races.
create unique index if not exists cms_subscribers_email_key
  on public.cms_subscribers ((data->>'email'));

create unique index if not exists cms_redirects_source_key
  on public.cms_redirects ((data->>'source'));
