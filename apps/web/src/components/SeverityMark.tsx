export function SeverityMark({
  severity,
  children,
}: {
  severity: string;
  children: React.ReactNode;
}) {
  const s = severity.toLowerCase();
  const cls =
    s === "error"
      ? "severity severity-error"
      : s === "warning"
        ? "severity severity-warning"
        : "severity severity-info";
  const label = s === "error" ? "Error" : s === "warning" ? "Warning" : "Info";
  return (
    <div className={cls}>
      <div className="severity-label">{label}</div>
      {children}
    </div>
  );
}
