"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiGet } from "@/lib/api";

type Rule = {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  version: string;
  applicability: string;
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [version, setVersion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ ruleSetVersion: string; rules: Rule[] }>("/rules")
      .then((data) => {
        setRules(data.rules);
        setVersion(data.ruleSetVersion);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load rules"));
  }, []);

  return (
    <>
      <PageHeader
        title="Rule reference"
        description="Enabled deterministic validation rules for this deployment."
      />
      {error ? <div className="alert alert-error">{error}</div> : null}
      {version ? (
        <p className="muted" style={{ marginTop: 0 }}>
          Rule-set version: <span className="mono">{version}</span>
        </p>
      ) : null}
      {!rules ? (
        <p className="muted">Loading rules…</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Version</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{r.title}</td>
                  <td>{r.severity}</td>
                  <td>{r.category}</td>
                  <td className="mono">{r.version}</td>
                  <td>
                    <div>{r.description}</div>
                    <div className="muted" style={{ marginTop: "0.25rem" }}>
                      {r.applicability}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
