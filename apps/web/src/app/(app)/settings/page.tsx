"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiGet, type ApiUser } from "@/lib/api";

export default function SettingsPage() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ user: ApiUser }>("/auth/me")
      .then((data) => setUser(data.user))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load settings"));
  }, []);

  return (
    <>
      <PageHeader
        title="Organization / account"
        description="View organization membership for this demo session."
      />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {!user ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="panel" style={{ padding: "1rem 1.1rem" }}>
          <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Organization</h2>
          <dl className="def-grid">
            <dt>Name</dt>
            <dd>{user.organization.name}</dd>
            <dt>Slug</dt>
            <dd className="mono">{user.organization.slug}</dd>
          </dl>
          <h2 style={{ fontSize: "1.05rem", marginTop: "1.5rem" }}>Account</h2>
          <dl className="def-grid">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Role</dt>
            <dd>{user.role}</dd>
          </dl>
          <p className="muted" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
            Password changes and org rename are deferred. Use Sign out in the top bar to end the
            session.
          </p>
        </div>
      )}
    </>
  );
}
