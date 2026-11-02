const TONE: Record<string, string> = {
  completed: "status status-completed",
  clean: "status status-completed",
  failed: "status status-failed",
  needs_attention: "status status-failed",
  processing: "status status-processing",
  pending: "status status-processing",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const key = status.toLowerCase();
  const cls = TONE[key] ?? "status status-processing";
  return <span className={cls}>{label ?? status}</span>;
}
