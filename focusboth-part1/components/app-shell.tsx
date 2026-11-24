"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCompassStore } from "./compass-store";

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const navItems = [
  { href: "/", label: "Today", icon: icon("M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8") },
  { href: "/visa", label: "Visa Clock", icon: icon("M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 7v5l3 2") },
  { href: "/jobs", label: "Job Hunt", icon: icon("M4 8h16v11H4zM9 8V5h6v3M4 13h16") },
  { href: "/paths", label: "Paths", icon: icon("M6 19a2 2 0 1 0 0-4a2 2 0 0 0 0 4M18 9a2 2 0 1 0 0-4a2 2 0 0 0 0 4M8 17h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5") },
  { href: "/growth", label: "Wellbeing", icon: icon("M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10") },
  { href: "/discover", label: "Discover", icon: icon("M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M15.5 8.5l-2 5l-5 2l2-5z") },
  { href: "/ask", label: "Ask FocusBoth", icon: icon("M5 18l-1 3l4-2h8a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v7a4 4 0 0 0 1 3M9 10h6M9 13h4") },
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
          <div className="brand-mark" aria-hidden="true" />
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
