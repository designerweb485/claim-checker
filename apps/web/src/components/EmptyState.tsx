export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}
