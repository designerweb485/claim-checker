"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet, apiPostEmpty, type ApiUser } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/uploads/new", label: "Upload" },
  { href: "/uploads", label: "History" },
  { href: "/rules", label: "Rules" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const product = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "Claim Checker";

  useEffect(() => {
    let cancelled = false;
    apiGet<{ user: ApiUser }>("/auth/me")
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function logout() {
    try {
      await apiPostEmpty("/auth/logout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout failed");
      return;
    }
    router.replace("/login");
  }

  if (!user) {
    return (
      <div className="auth-page">
        <p className="muted">Loading session…</p>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="brand">{product}</div>
        <nav>
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${active ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          Synthetic demo data · Not a compliance certification.
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary mobile-nav-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-label="Open navigation"
            >
              Menu
            </button>
            <span className="muted">{user.organization.name}</span>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span className="muted">{user.email}</span>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
        <div className="canvas">
          {error ? <div className="alert alert-error">{error}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
