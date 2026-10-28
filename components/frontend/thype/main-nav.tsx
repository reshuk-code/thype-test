"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";

import type { ResolvedMenuItem } from "@/types/navigation";

/**
 * Is `href` the section the reader is in?
 *
 * Prefix match on whole segments, so /category/asia/ highlights "Asia" and
 * /category/asian-food/ does not. The home link only matches itself.
 */
function isActive(href: string | null, pathname: string): boolean {
  if (!href || /^https?:/i.test(href)) return false;
  const clean = (value: string) => value.replace(/\/+$/, "") || "/";
  const target = clean(href);
  const current = clean(pathname);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

function ItemLink({
  item,
  pathname,
  className,
}: {
  item: ResolvedMenuItem;
  pathname: string;
  className?: string;
}) {
  const active = isActive(item.href, pathname);

  if (!item.href) {
    return <span className={className}>{item.label}</span>;
  }

  return (
    <Link
      href={item.href}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noreferrer" : undefined}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
      className={className}
    >
      {item.label}
    </Link>
  );
}

/**
 * The main navigation band.
 *
 * A Client Component only to know the current path (for the active state) and
 * to open the mobile panel. The menu itself comes resolved from the layout,
 * which reads it from Navigation in the admin.
 */
export function MainNav({ items }: { items: ResolvedMenuItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const panelId = useId();

  // Close the panel after navigating. Adjusted during render rather than in an
  // effect, per the project's lint rule on synchronous setState in effects.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <>
      <nav aria-label="Main" className="hidden lg:block">
        <ul className="flex items-stretch gap-x-2">
          {items.map((item) => (
            <li key={item.id} className="group relative flex">
              <ItemLink
                item={item}
                pathname={pathname}
                className="relative flex items-center px-4 py-[1.4rem] font-label text-[0.9375rem] font-bold uppercase text-ink transition-colors hover:text-bronze-strong data-[active]:text-bronze-strong data-[active]:before:absolute data-[active]:before:inset-x-0 data-[active]:before:top-0 data-[active]:before:h-px data-[active]:before:bg-bronze"
              />
              {item.children.length > 0 ? (
                <ul className="invisible absolute left-0 top-full z-40 min-w-56 border border-line bg-white py-2 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 motion-reduce:transition-none">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <ItemLink
                        item={child}
                        pathname={pathname}
                        className="block px-4 py-2 font-label text-sm font-semibold uppercase text-ink hover:bg-sage hover:text-bronze-strong data-[active]:text-bronze-strong"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="-ml-2 flex items-center gap-2 p-2 font-label text-sm font-bold uppercase text-ink lg:hidden"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        Menu
      </button>

      <nav
        id={panelId}
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full z-40 border-t border-line bg-sage px-4 pb-6 shadow-md lg:hidden"
      >
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="py-1">
              <ItemLink
                item={item}
                pathname={pathname}
                className="block py-3 font-label text-[0.9375rem] font-bold uppercase text-ink data-[active]:text-bronze-strong"
              />
              {item.children.length > 0 ? (
                <ul className="mb-2 ml-4 border-l border-line pl-4">
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <ItemLink
                        item={child}
                        pathname={pathname}
                        className="block py-2 font-label text-sm font-semibold uppercase text-ink data-[active]:text-bronze-strong"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
