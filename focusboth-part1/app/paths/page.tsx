"use client";

import { useState } from "react";
import { useCompassStore } from "@/components/compass-store";
import { Status } from "@/components/ui";
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
      <div className="visa-head">
        <div>
          <div className="eyebrow">Path navigator</div>
          <h1>{data.paths.length === 3 ? "Three paths." : "Your paths."} One deadline.</h1>
        </div>
        <span className="notice" style={{ fontSize: 15 }}>Checked against your EAD end, {data.profile.eadEndDate}</span>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        {data.paths.map((path) => {
          const evaluation = evaluatePath(path, data.profile);
          const leads = bestFeasible?.path.id === path.id;
          return (
            <button
              key={path.id}
              className={`pathcol ${leads ? "leads" : ""} ${evaluation.feasible ? "" : "blocked"} ${selectedId === path.id ? "selected" : ""}`}
              onClick={() => setSelectedId(path.id)}
            >
              <div className="pathcol-top">
                {leads ? <span className="chip solid">Leads</span> : <span />}
                <Status tone={evaluation.feasible ? "good" : "bad"}>{evaluation.feasible ? "Feasible" : "Blocked"}</Status>
              </div>
              <h2>{path.name}</h2>
              <p>{path.description}</p>
              <div className="pathcol-num"><b>{path.runwayMonths.toFixed(1)}</b><span> months of runway</span></div>
              <ul>
                {evaluation.checks.map((check) => (
                  <li key={check.label} className={check.pass ? "" : "fail"}>
                    <i>{check.pass ? "✓" : "✕"}</i>
                    <span>{check.label}<small>{check.detail}</small></span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <section className="card dark whycard">
        <div>
          <div className="eyebrow" style={{ color: "#fff" }}>Why this result: {selected.name}</div>
          <p className="brief" style={{ margin: "8px 0 0" }}>{result.recommendation}</p>
        </div>
        <div className="source" style={{ border: 0, padding: 0 }}>Inputs used: EAD end {data.profile.eadEndDate}; path start {selected.startDate}; {selected.weeklyHours} weekly hours; E-Verify and employer-relationship toggles from the scenario.</div>
      </section>

      <div className="alert" style={{ marginTop: 18 }}>
        <strong>Explainable by design</strong>
        <span>The rule engine decides pass or fail. The generated paragraph only translates that result into plain language. This prevents a language model from inventing visa rules.</span>
      </div>
    </div>
  );
}
