const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

export type ApiUser = {
  id: string;
  email: string;
  role: "owner" | "member";
  organization: { id: string; name: string; slug: string };
};

export type ValidationSummary = {
  error: number;
  warning: number;
  info: number;
  findingCount: number;
};

export type UploadRow = {
  id: string;
  filename: string;
  byteSize: number;
  contentHash: string;
  status: string;
  errorSummary: string | null;
  parserErrors: unknown;
  hasStoredFile: boolean;
  transactionSet: string | null;
  igVersion: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on list/detail when API includes claim counts. */
  claimCount?: number | null;
  /** Latest validation run summary; null when no run was persisted. */
  validationSummary?: ValidationSummary | null;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    const message = data.error?.message ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  return parseJson<T>(res);
}

export async function apiPostJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

export async function apiPostEmpty(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(data.error?.message ?? `Request failed (${res.status})`);
  }
}

export async function apiUploadFile(file: File): Promise<{
  upload: UploadRow;
  validationRun: {
    id: string;
    ruleSetVersion: string;
    status: string;
    summary: { error: number; warning: number; info: number } | null;
  } | null;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/uploads`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  return parseJson(res);
}

export function csvExportUrl(runId: string): string {
  return `${API_BASE}/validation-runs/${runId}/export.csv`;
}

/** Download CSV with credentials (cross-origin cookie session). */
export async function downloadCsv(runId: string, filename?: string): Promise<void> {
  const res = await fetch(csvExportUrl(runId), { credentials: "include" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(data.error?.message ?? `CSV export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `validation-run-${runId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { API_BASE };
