"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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

  const BIG = 2 * Math.PI * 150;
  const SMALL = 2 * Math.PI * 34;
  const tone = (c: GrowthGoal["category"]) => (c === "Hobby" ? "#8ee6c8" : c === "Learning" ? "#a98bff" : "#f2d58a");

  return (
    <div className="content">
      <div className="wellgrid">
        <section className="wellhero">
          <div className="eyebrow">Wellbeing &amp; growth</div>
          <h1>Protect the person behind the plan.</h1>
          <div className="wellring-row">
            <div className="wellring">
              <svg width="340" height="340" viewBox="0 0 340 340" aria-hidden="true">
                <circle cx="170" cy="170" r="150" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="26" />
                <circle className="ringarc" cx="170" cy="170" r="150" fill="none" stroke="var(--lime)" strokeWidth="26" strokeLinecap="round"
                  strokeDasharray={BIG} strokeDashoffset={BIG * (1 - Math.min(100, percent) / 100)} transform="rotate(-90 170 170)" style={{ ["--ring" as string]: BIG }} />
              </svg>
              <div className="dial-center"><b>{percent}%</b><span>of this week&apos;s plan</span></div>
            </div>
            <div>
              <div className="wellhours">{totals.completed.toFixed(1)} of {totals.target.toFixed(1)} hours</div>
              <p className="lead" style={{ fontSize: 16 }}>
                {percent < 50
                  ? "Wellbeing hours are being squeezed. Protect a short walk, a hobby block, or a family call before adding another application session."
                  : "Work and life are both getting time this week. Keep the next block small enough to finish."}
              </p>
            </div>
          </div>
          <p className="notice">FocusBoth budgets hours for hobbies, learning, rest and family so the job hunt cannot consume the whole week. A planning helper, not counseling or therapy.</p>
        </section>

        <section className="goallist">
          {goals.map((goal) => {
            const goalPercent = Math.round((goal.completed / goal.weeklyTarget) * 100);
            return (
              <article className="goalrow" key={goal.id}>
                <div className="miniring">
                  <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
                    <circle cx="42" cy="42" r="34" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" />
                    <circle cx="42" cy="42" r="34" fill="none" stroke={tone(goal.category)} strokeWidth="9" strokeLinecap="round"
                      strokeDasharray={SMALL} strokeDashoffset={SMALL * (1 - Math.min(100, goalPercent) / 100)} transform="rotate(-90 42 42)" style={{ transition: "stroke-dashoffset .5s ease" }} />
                  </svg>
                  <span>{goalPercent}%</span>
                </div>
                <div className="goalinfo">
                  <small style={{ color: tone(goal.category) }}>{goal.category}</small>
                  <strong>{goal.title}</strong>
                  <span>{goal.completed.toFixed(1)} of {goal.weeklyTarget.toFixed(1)} hours</span>
                </div>
                <div className="actions">
                  <button className="btn primary" onClick={() => addTime(goal.id, 0.5)}>+ 30 min</button>
                  <button className="btn secondary" onClick={() => addTime(goal.id, -0.5)} disabled={goal.completed === 0}>Undo</button>
                  <button className="btn danger" aria-label={`Remove ${goal.title}`} onClick={() => persist(goals.filter((item) => item.id !== goal.id))}>Remove</button>
                </div>
              </article>
            );
          })}
          {goals.length === 0 && <p className="notice">No goals yet. Add one below.</p>}
        </section>
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
