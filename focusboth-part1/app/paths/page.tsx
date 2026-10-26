"use client";

import { useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { PageHead, Progress, Status } from "@/components/ui";
import { evaluatePath } from "@/lib/compass-engine";

export default function PathsPage() {
  const { data } = useCompassStore();
  const [selectedId, setSelectedId] = useState(data.paths[0]?.id ?? "");
  const selected = data.paths.find((path) => path.id === selectedId) ?? data.paths[0];
  const result = evaluatePath(selected, data.profile);
  const bestFeasible = data.paths
    .map((path) => ({ path, result: evaluatePath(path, data.profile) }))
    .filter((item) => item.result.feasible)
    .sort((a, b) => b.path.runwayMonths - a.path.runwayMonths)[0];

  return (
    <div className="content">
      <PageHead
        eyebrow="Path navigator"
        title="Test a decision against the clock."
        description="Compare realistic career scenarios using the same dates and explicit rules — before asking AI to explain the result."
        action={<Status>{bestFeasible ? `${bestFeasible.path.name} leads` : "No feasible path"}</Status>}
      />

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        {data.paths.map((path) => {
          const evaluation = evaluatePath(path, data.profile);
          return (
            <button
              key={path.id}
              className={`card path-card ${selectedId === path.id ? "selected" : ""}`}
              style={{ textAlign: "left", color: "inherit" }}
              onClick={() => setSelectedId(path.id)}
            >
              <div className="card-head">
                <h3>{path.name}</h3>
                <Status tone={evaluation.feasible ? "good" : "bad"}>{evaluation.feasible ? "Feasible" : "Blocked"}</Status>
              </div>
              <p className="lead" style={{ fontSize: 12, minHeight: 58 }}>{path.description}</p>
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span className="notice">Authorized runway</span>
                  <strong style={{ fontSize: 12 }}>{path.runwayMonths.toFixed(1)} months</strong>
                </div>
                <Progress value={(path.runwayMonths / 8) * 100} warning={!evaluation.feasible} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-2">
        <section className="card">
          <div className="card-head">
            <div><div className="eyebrow">Rule engine</div><h2 style={{ marginTop: 4 }}>{selected.name}</h2></div>
            <Status tone={result.feasible ? "good" : "bad"}>{result.feasible ? "4 / 4 clear" : `${result.checks.filter((c) => c.pass).length} / 4 clear`}</Status>
          </div>
          {result.checks.map((check) => (
            <div className="constraint" key={check.label}>
              <span className={`constraint-mark ${check.pass ? "" : "fail"}`}>{check.pass ? "✓" : "×"}</span>
              <div>
                <strong style={{ fontSize: 13 }}>{check.label}</strong>
                <p className="notice" style={{ margin: "3px 0 0" }}>{check.detail}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="card dark">
          <div className="card-head">
            <div><div className="eyebrow" style={{ color: "var(--lime)" }}>Coordinator explanation</div><h2 style={{ marginTop: 4 }}>Why this result?</h2></div>
            <Status>Grounded</Status>
          </div>
          <p className="brief">{result.recommendation}</p>
          <div className="source">Inputs used: EAD end {data.profile.eadEndDate}; path start {selected.startDate}; {selected.weeklyHours} weekly hours; E-Verify and employer-relationship toggles from the scenario.</div>
        </section>
      </div>

      <div className="alert" style={{ marginTop: 18 }}>
        <strong>Explainable by design</strong>
        <span>The rule engine decides pass or fail. The generated paragraph only translates that result into plain language. This prevents a language model from inventing visa rules.</span>
      </div>
    </div>
  );
}
