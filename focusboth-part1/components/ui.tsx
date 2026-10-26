export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="card metric">
      <div className="card-head" style={{ marginBottom: 0 }}>
        <span className="metric-label">{label}</span>
        <Status tone={tone ?? "good"}>{tone === "bad" ? "Action" : tone === "warn" ? "Watch" : "On track"}</Status>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </div>
  );
}

export function Status({
  children,
  tone = "good",
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <span className={`status ${tone === "neutral" ? "" : tone}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function Progress({ value, warning = false }: { value: number; warning?: boolean }) {
  return (
    <div className={`progress ${warning ? "warn" : ""}`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
