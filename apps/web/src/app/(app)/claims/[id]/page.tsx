"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SeverityMark } from "@/components/SeverityMark";
import { apiGet } from "@/lib/api";

type ClaimDetail = {
  id: string;
  uploadId: string;
  claimControlNumber: string;
  totalCharge: string | null;
  placeOfServiceCode: string | null;
  billingProviderNpi: string | null;
  billingProviderName: string | null;
  subscriberMemberId: string | null;
  subscriberLastName: string | null;
  subscriberFirstName: string | null;
  diagnoses: Array<{ id: string; sequence: number; code: string; codeSet: string }>;
  lines: Array<{
    id: string;
    lineNumber: number;
    procedureCode: string | null;
    charge: string | null;
    units: string | null;
    unitCode: string | null;
    diagnosisPointers: number[];
    serviceDate: string | null;
  }>;
  findings: Array<{
    id: string;
    ruleId: string;
    severity: string;
    message: string;
    suggestedAction: string | null;
  }>;
};

export default function ClaimDetailPage() {
  const params = useParams<{ id: string }>();
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ claim: ClaimDetail }>(`/claims/${params.id}`)
      .then((data) => setClaim(data.claim))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load claim"));
  }, [params.id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!claim) return <p className="muted">Loading claim…</p>;

  return (
    <>
      <PageHeader
        title={`Claim ${claim.claimControlNumber}`}
        description="Claim summary, service lines, and related findings."
        actions={
          <Link className="btn btn-secondary" href={`/uploads/${claim.uploadId}`}>
            Back to upload
          </Link>
        }
      />

      <div className="panel" style={{ padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
        <dl className="def-grid">
          <dt>Total charge</dt>
          <dd>{claim.totalCharge ?? "—"}</dd>
          <dt>Place of service</dt>
          <dd className="mono">{claim.placeOfServiceCode ?? "—"}</dd>
          <dt>Billing provider</dt>
          <dd>
            {claim.billingProviderName ?? "—"}{" "}
            <span className="mono">{claim.billingProviderNpi ?? ""}</span>
          </dd>
          <dt>Subscriber</dt>
          <dd>
            {[claim.subscriberLastName, claim.subscriberFirstName].filter(Boolean).join(", ") || "—"}{" "}
            <span className="mono">{claim.subscriberMemberId ?? ""}</span>
          </dd>
        </dl>
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>Diagnoses</h2>
      <div className="table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Code set</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {claim.diagnoses.map((d) => (
              <tr key={d.id}>
                <td>{d.sequence}</td>
                <td className="mono">{d.codeSet}</td>
                <td className="mono">{d.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>Service lines</h2>
      <div className="table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Line</th>
              <th>Procedure</th>
              <th>Charge</th>
              <th>Units</th>
              <th>Pointers</th>
              <th>Service date</th>
            </tr>
          </thead>
          <tbody>
            {claim.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.lineNumber}</td>
                <td className="mono">{l.procedureCode ?? "—"}</td>
                <td>{l.charge ?? "—"}</td>
                <td>
                  {l.units ?? "—"} {l.unitCode ?? ""}
                </td>
                <td className="mono">{l.diagnosisPointers.join(",") || "—"}</td>
                <td className="mono">{l.serviceDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 style={{ fontSize: "1.05rem" }}>Findings</h2>
      {claim.findings.length === 0 ? (
        <p className="muted">No findings for this claim.</p>
      ) : (
        <div className="stack-gap">
          {claim.findings.map((f) => (
            <SeverityMark key={f.id} severity={f.severity}>
              <div className="mono">{f.ruleId}</div>
              <div>{f.message}</div>
              {f.suggestedAction ? (
                <div className="muted" style={{ marginTop: "0.35rem" }}>
                  Suggested action: {f.suggestedAction}
                </div>
              ) : null}
            </SeverityMark>
          ))}
        </div>
      )}
    </>
  );
}
