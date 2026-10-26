"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHead, Progress, Status } from "@/components/ui";

type GrowthGoal = {
  id: string;
  title: string;
  category: "Hobby" | "Learning" | "Wellbeing";
  weeklyTarget: number;
  completed: number;
};

const STORAGE_KEY = "focusboth-growth-goals-v1";
const DEFAULT_GOALS: GrowthGoal[] = [
  { id: "guitar", title: "Practice guitar", category: "Hobby", weeklyTarget: 4, completed: 1.5 },
  { id: "system-design", title: "System design course", category: "Learning", weeklyTarget: 5, completed: 3 },
  { id: "portfolio", title: "Build portfolio case study", category: "Learning", weeklyTarget: 3, completed: 2 },
  { id: "walk", title: "Walk without a screen", category: "Wellbeing", weeklyTarget: 3.5, completed: 2.5 },
];

export default function GrowthPage() {
  const [goals, setGoals] = useState<GrowthGoal[]>(DEFAULT_GOALS);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<GrowthGoal["category"]>("Hobby");
  const [target, setTarget] = useState(2);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setGoals(JSON.parse(stored) as GrowthGoal[]);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    });
  }, []);

  function persist(next: GrowthGoal[]) {
    setGoals(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addGoal(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    persist([
      ...goals,
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        category,
        weeklyTarget: Math.max(0.5, target),
        completed: 0,
      },
    ]);
    setTitle("");
  }

  function addTime(id: string, hours: number) {
    persist(goals.map((goal) => (goal.id === id ? { ...goal, completed: Math.max(0, goal.completed + hours) } : goal)));
  }

  const totals = useMemo(
    () =>
      goals.reduce(
        (sum, goal) => ({
          target: sum.target + goal.weeklyTarget,
          completed: sum.completed + goal.completed,
        }),
        { target: 0, completed: 0 },
      ),
    [goals],
  );
  const percent = totals.target ? Math.round((totals.completed / totals.target) * 100) : 0;

  return (
    <div className="content">
      <PageHead
        eyebrow="Wellbeing & growth"
        title="Protect the person behind the plan."
        description="Student mental health depends on more than offers. FocusBoth budgets hours for hobbies, learning, rest, and family so the job hunt cannot consume the whole week. This is a planning helper, not counseling or therapy."
        action={<Status tone={percent >= 75 ? "good" : "warn"}>{percent}% of weekly plan</Status>}
      />

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <section className="card span-2">
          <div className="card-head">
            <h2>This week</h2>
            <strong>{totals.completed.toFixed(1)} / {totals.target.toFixed(1)} hours</strong>
          </div>
          <Progress value={percent} warning={percent < 60} />
          <p className="notice">
            Track real time spent, not intentions. Protecting hobby and rest hours is how FocusBoth treats wellbeing as operational, not optional.
          </p>
        </section>
        <section className="card dark">
          <div className="eyebrow" style={{ color: "var(--lime)" }}>Balance signal</div>
          <p className="brief" style={{ fontSize: 16, marginTop: 8 }}>
            {percent < 50
              ? "Wellbeing hours are being squeezed. Protect a short walk, a hobby block, or a family call before adding another application session."
              : "Work and life are both getting time this week. Keep the next block small enough to finish."}
          </p>
          <div className="source">Rule-based summary from weekly targets and logged hours.</div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        {goals.map((goal) => {
          const goalPercent = Math.round((goal.completed / goal.weeklyTarget) * 100);
          return (
            <article className="card growth-card" key={goal.id}>
              <div className="card-head">
                <Status tone={goal.category === "Hobby" ? "good" : goal.category === "Learning" ? "warn" : "neutral"}>
                  {goal.category}
                </Status>
                <button className="btn danger" onClick={() => persist(goals.filter((item) => item.id !== goal.id))}>Remove</button>
              </div>
              <h3 style={{ fontSize: 17 }}>{goal.title}</h3>
              <p className="notice">{goal.completed.toFixed(1)} of {goal.weeklyTarget.toFixed(1)} hours</p>
              <Progress value={goalPercent} warning={goalPercent < 50} />
              <div className="actions" style={{ marginTop: 16 }}>
                <button className="btn primary" onClick={() => addTime(goal.id, 0.5)}>+ 30 min</button>
                <button className="btn secondary" onClick={() => addTime(goal.id, -0.5)} disabled={goal.completed === 0}>Undo 30 min</button>
              </div>
            </article>
          );
        })}
      </div>

      <form className="card" onSubmit={addGoal}>
        <div className="card-head"><h2>Add a weekly goal</h2><span className="notice">Hobbies count too</span></div>
        <div className="form-grid">
          <div className="field span-2">
            <label htmlFor="goalTitle">Goal</label>
            <input id="goalTitle" className="input" placeholder="Photography walk, AWS course…" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="goalCategory">Category</label>
            <select id="goalCategory" className="input" value={category} onChange={(event) => setCategory(event.target.value as GrowthGoal["category"])}>
              <option>Hobby</option>
              <option>Learning</option>
              <option>Wellbeing</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="goalTarget">Weekly target (hours)</label>
            <input id="goalTarget" type="number" min="0.5" max="40" step="0.5" className="input" value={target} onChange={(event) => setTarget(Number(event.target.value))} />
          </div>
        </div>
        <button className="btn primary" style={{ marginTop: 14 }} type="submit">Add goal</button>
        <p className="notice" style={{ marginTop: 12 }}>
          FocusBoth is not a mental-health service. If you are in crisis in the U.S., call or text 988. For visa questions, ask your DSO.
        </p>
      </form>
    </div>
  );
}
