import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ThemeScript } from "@/components/cms/theme";
import { ThemeProvider } from "@/components/cms/theme-provider";
import { TopLoader } from "@/components/ui/top-loader";
import { Toaster } from "@/components/ui/toaster";
import { getCmsConfig } from "@/lib/cms/config";
import { resolveAuth } from "@/lib/connections/resolve";

/**
 * Outer admin layout: providers only.
 *
 * The authenticated chrome (sidebar, header) lives in the `(dashboard)` route
 * group so that /admin/login and /admin/setup can render without it.
 */
export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin",
  },
  // The admin must never be indexed, whatever the site settings say.
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const config = getCmsConfig();
  const auth = resolveAuth();

  const shell = (
    <ThemeProvider>
      {/*
        Rendered here, from a Server Component, so it is written straight into
        the HTML and runs before the first paint. That is the whole reason the
        theming is local rather than next-themes: the library rendered this
        same script from a Client Component, which React 19 warns about on
        every client render.
      */}
      <ThemeScript />
      <div data-cms-admin={config.admin.basePath}>{children}</div>
      <TopLoader className="bg-primary" />
      <Toaster />
    </ThemeProvider>
  );

  // Clerk needs its provider around anything that reads its session. Projects
  // on any other provider never load it.
  if (auth.id === "clerk" && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { ClerkProvider } = await import("@clerk/nextjs");
    return <ClerkProvider>{shell}</ClerkProvider>;
  }

  return shell;
}
