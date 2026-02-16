"use client";

import { useEffect, useMemo, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  scheduledAt?: string | null;
  readAt?: string | null;
};

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const unreadCount = useMemo(() => items.filter(i => !i.readAt).length, [items]);

  async function refresh() {
    const res = await fetch(`/api/users/summary?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (res.ok) setItems(data.notifications ?? []);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} title="Notifications">
        🔔{unreadCount ? ` ${unreadCount}` : ""}
      </button>

      {open && (
        <div className="drawer">
          <div style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <b>Notifications</b>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
          <div style={{ padding: "0 12px 12px 12px" }}>
            {items.length ? items.map(n => (
              <div key={n.id} className="card" style={{ marginTop: 10 }}>
                <p style={{ margin: 0 }}><b>{n.title}</b></p>
                <p style={{ margin: "6px 0" }}><small>{n.type} • {new Date(n.createdAt).toLocaleString()}</small></p>
                <p style={{ margin: 0 }}>{n.body}</p>
                {n.scheduledAt && <p style={{ margin: "6px 0 0 0" }}><small>Scheduled: {new Date(n.scheduledAt).toLocaleString()}</small></p>}
              </div>
            )) : (
              <p><small>No notifications yet.</small></p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
