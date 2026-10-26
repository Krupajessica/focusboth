"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompassStore } from "./compass-store";

const navItems = [
  { href: "/", label: "Today", icon: "01" },
  { href: "/visa", label: "Visa Clock", icon: "02" },
  { href: "/jobs", label: "Job Hunt", icon: "03" },
  { href: "/paths", label: "Paths", icon: "04" },
  { href: "/growth", label: "Wellbeing", icon: "05" },
  { href: "/discover", label: "Discover", icon: "06" },
  { href: "/ask", label: "Ask FocusBoth", icon: "07" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, resetDemo } = useCompassStore();
  const initials = data.profile.studentName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>FocusBoth</strong>
            <span>Work and life, same week</span>
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-note">
          <small>Prototype mode</small>
          <p style={{ fontSize: 12, margin: "6px 0 12px", lineHeight: 1.45 }}>
            Your edits stay in this browser. No data leaves this device.
          </p>
          <button className="btn secondary" onClick={resetDemo} style={{ width: "100%" }}>
            Reset demo
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="mobile-top">FocusBoth</span>
          <div className="eyebrow" style={{ marginLeft: "auto" }}>
            Guide and monitor — not a therapist, not a lawyer
          </div>
          <div className="student-chip" style={{ marginLeft: 22 }}>
            <div className="avatar">{initials}</div>
            <span>{data.profile.studentName}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
