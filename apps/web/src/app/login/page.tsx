"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiPostJson } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const product = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "Claim Checker";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await apiPostJson("/auth/login", { email, password });
      } else {
        await apiPostJson("/auth/register", {
          email,
          password,
          organizationName,
          organizationSlug,
        });
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="brand">{product}</h1>
        <p className="muted">
          Sign in to validate synthetic 837 Professional claim files. Not a compliance
          certification product.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            type="button"
            className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>
        <form className="form-stack" onSubmit={onSubmit}>
          {mode === "register" ? (
            <>
              <div className="field">
                <label htmlFor="orgName">Organization name</label>
                <input
                  id="orgName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                  autoComplete="organization"
                />
              </div>
              <div className="field">
                <label htmlFor="orgSlug">Organization slug</label>
                <input
                  id="orgSlug"
                  value={organizationSlug}
                  onChange={(e) =>
                    setOrganizationSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="demo-billing"
                />
              </div>
            </>
          ) : null}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {error ? (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          ) : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          Start the API on port 3001 before signing in. Synthetic demo:{" "}
          <span className="mono">demo@nexxaura.com</span> /{" "}
          <span className="mono">demo12345</span>
        </p>
      </div>
    </div>
  );
}
