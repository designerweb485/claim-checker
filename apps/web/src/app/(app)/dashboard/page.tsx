"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { apiGet, type UploadRow } from "@/lib/api";

export default function DashboardPage() {
  const [uploads, setUploads] = useState<UploadRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ uploads: UploadRow[] }>("/uploads")
      .then((data) => setUploads(data.uploads))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const stats = useMemo(() => {
    const list = uploads ?? [];
    return {
      total: list.length,
      completed: list.filter((u) => u.status === "completed").length,
      failed: list.filter((u) => u.status === "failed").length,
      // Parse failures, missing validation runs, or rule-engine errors all need attention.
      openErrors: list.filter((u) => {
        if (u.status === "failed" || u.errorSummary) return true;
        if (u.status !== "completed") return false;
        if (!u.validationSummary) return true;
        return (u.validationSummary.error ?? 0) > 0;
      }).length,
    };
  }, [uploads]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Recent uploads and open errors for your organization."
        actions={
          <Link className="btn btn-primary" href="/uploads/new">
            Upload an EDI file
          </Link>
        }
      />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {!uploads ? (
        <p className="muted">Loading uploads…</p>
      ) : uploads.length === 0 ? (
        <EmptyState
          title="No uploads yet"
          body="Upload a synthetic .837, .edi, or .txt file to run deterministic validation."
          action={
            <Link className="btn btn-primary" href="/uploads/new">
              Upload an EDI file
            </Link>
          }
        />
      ) : (
        <>
          <div className="summary-strip" aria-label="Validation summary">
            <div className="summary-item">
              <div className="value">{stats.total}</div>
              <div className="label">Uploads</div>
            </div>
            <div className="summary-item">
              <div className="value">{stats.completed}</div>
              <div className="label">Completed</div>
            </div>
            <div className="summary-item">
              <div className="value">{stats.failed}</div>
              <div className="label">Failed</div>
            </div>
            <div className="summary-item">
              <div className="value">{stats.openErrors}</div>
              <div className="label">Needs attention</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Status</th>
                  <th>IG / version</th>
                  <th>Uploaded</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {uploads.slice(0, 8).map((u) => {
                  const errors = u.validationSummary?.error ?? 0;
                  const needsAttention =
                    u.status === "failed" ||
                    Boolean(u.errorSummary) ||
                    (u.status === "completed" && (!u.validationSummary || errors > 0));
                  return (
                    <tr key={u.id}>
                      <td>{u.filename}</td>
                      <td>
                        <StatusBadge status={u.status} />
                        {needsAttention && u.status === "completed" ? (
                          <>
                            {" "}
                            <StatusBadge status="needs_attention" label="Needs attention" />
                          </>
                        ) : null}
                      </td>
                      <td className="mono">{u.igVersion ?? "—"}</td>
                      <td className="muted">{new Date(u.createdAt).toLocaleString()}</td>
                      <td>
                        <Link href={`/uploads/${u.id}`}>View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
