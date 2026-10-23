"use client";

import { useEffect } from "react";

/**
 * Client component to handle root entry point redirect.
 * If user is unauthenticated, redirects to /auth/login.
 * If user is authenticated, redirects to /protected (the Payroll Dashboard).
 */
export function AuthRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function checkAuthAndRedirect() {
      try {
        const { createBrowserClient } = await import("@/lib/supabase/client");
        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session?.user) {
          if (window.location.pathname === "/") {
            window.location.replace("/auth/login");
          }
        } else {
          if (window.location.pathname === "/") {
            window.location.replace("/protected");
          }
        }
      } catch {
        if (isMounted && window.location.pathname === "/") {
          window.location.replace("/auth/login");
        }
      }
    }

    checkAuthAndRedirect();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}


