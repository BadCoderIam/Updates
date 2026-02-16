"use client";

import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";

export default function AppShell({
  title,
  subtitle,
  userId,
  sidebar,
  children,
}: {
  title: string;
  subtitle?: string;
  userId: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main>
      <div className="bgPattern" />
      <div className="heroBlur" />

      <div className="appContainer">
      <div className="shell">
        <aside className="sidebar">{sidebar}</aside>

        <section className="maincol">
          <div className="topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/levelup-pro-logo.svg"
                alt="LevelUp Pro"
                style={{ height: 28, width: "auto", opacity: 0.95 }}
              />
              <div>
                <b>{title}</b>
                {subtitle ? (
                  <div>
                    <small>{subtitle}</small>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="kpiRow">
              <NotificationBell userId={userId} />
              <ThemeToggle />
              <span className="badge" title="Profile" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.18)",
                    display: "inline-block",
                  }}
                />
                <small>{userId}</small>
              </span>
            </div>
          </div>

          {children}
        </section>
            </div>
    </div>
    </main>
  );
}
