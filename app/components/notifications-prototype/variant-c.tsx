// PROTOTYPE — throwaway. Variant C: built on Knock's headless hooks, tuned for
// "act on it now".
//   - small bell with an unread DOT (no number) in the sidebar footer, by
//     Settings
//   - opens a full-height drawer beside the sidebar; each card carries a
//     type-specific action ("Answer", "Review refund", "View reply")
//   - new Notifications also arrive as sonner toasts (try "Simulate arrival")
//   - the inbox page is a dense, bulk-editable table (history, not triage)

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useNotificationsPrototype } from "./store";
import { kindLabel, timeAgo, type MockNotification } from "./mock-data";
import { KindIcon, kindTone } from "./shared";

const actionLabel: Record<MockNotification["kind"], string> = {
  reply: "View reply",
  question: "Answer",
  "first-rating": "See rating",
  "refund-request": "Review refund",
};

/** Sidebar footer slot. */
export function BellC() {
  const { unreadCount, setDrawerOpen, drawerOpen } =
    useNotificationsPrototype();
  return (
    <button
      onClick={() => setDrawerOpen(!drawerOpen)}
      title="Notifications"
      className="relative rounded-md p-1 text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      <Bell className="size-4" />
      {unreadCount > 0 && (
        <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
      )}
    </button>
  );
}

/** Rendered once in the layout. */
export function DrawerC() {
  const { items, drawerOpen, setDrawerOpen, markRead, markAllRead, archive } =
    useNotificationsPrototype();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  if (!drawerOpen) return null;
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;

  return (
    <>
      <div
        className="fixed inset-0 left-56 z-40 bg-black/20"
        onClick={() => setDrawerOpen(false)}
      />
      <div className="fixed bottom-0 left-56 top-0 z-50 flex w-[420px] flex-col border-r bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded p-1 hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-1 border-b px-5 py-2 text-sm">
          {(["unread", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-3 py-1 capitalize",
                tab === t
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t}
            </button>
          ))}
          <button
            onClick={markAllRead}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Mark all read
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {shown.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          )}
          {shown.map((n) => (
            <div
              key={n.id}
              className={cn(
                "rounded-lg border p-3",
                !n.read && "border-primary/40 bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium",
                    kindTone[n.kind]
                  )}
                >
                  <KindIcon kind={n.kind} className="size-3" />
                  {kindLabel[n.kind]}
                </span>
                <span className="truncate text-muted-foreground">
                  {n.courseTitle}
                </span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {timeAgo(n.minutesAgo)}
                </span>
              </div>
              <p className="mt-2 text-sm">
                <strong>{n.actor}</strong> {n.summary}
              </p>
              {n.snippet && (
                <p className="mt-2 rounded bg-muted px-2 py-1.5 text-sm text-muted-foreground">
                  “{n.snippet}”
                </p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => {
                    markRead(n.id);
                    setDrawerOpen(false);
                    navigate(n.href);
                  }}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                >
                  {actionLabel[n.kind]}
                </button>
                {!n.read && (
                  <button
                    onClick={() => markRead(n.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => archive(n.id)}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
        <Link
          to="/notifications"
          onClick={() => setDrawerOpen(false)}
          className="border-t px-5 py-3 text-center text-sm font-medium hover:bg-muted/50"
        >
          Full history →
        </Link>
      </div>
    </>
  );
}

export function InboxC() {
  const { items, markRead, markUnread } = useNotificationsPrototype();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-8">
      <h1 className="text-3xl font-bold">Notification history</h1>
      <p className="mt-1 text-muted-foreground">
        Everything you've been notified about. Kept indefinitely.
      </p>
      <div className="mt-6 flex h-9 items-center gap-2 text-sm">
        {selected.size > 0 && (
          <>
            <span className="text-muted-foreground">
              {selected.size} selected
            </span>
            <button
              onClick={() => {
                selected.forEach(markRead);
                setSelected(new Set());
              }}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Mark read
            </button>
            <button
              onClick={() => {
                selected.forEach(markUnread);
                setSelected(new Set());
              }}
              className="rounded border px-2 py-1 hover:bg-muted"
            >
              Mark unread
            </button>
          </>
        )}
      </div>
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="w-8 py-2" />
            <th className="py-2">Type</th>
            <th className="py-2">What</th>
            <th className="py-2">Course</th>
            <th className="py-2 text-right">When</th>
          </tr>
        </thead>
        <tbody>
          {items.map((n) => (
            <tr
              key={n.id}
              className={cn(
                "border-b hover:bg-muted/40",
                !n.read && "font-semibold"
              )}
            >
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(n.id)}
                  onChange={() => toggle(n.id)}
                />
              </td>
              <td className="py-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                    kindTone[n.kind]
                  )}
                >
                  <KindIcon kind={n.kind} className="size-3" />
                  {kindLabel[n.kind]}
                </span>
              </td>
              <td
                className="cursor-pointer py-2 hover:underline"
                onClick={() => {
                  markRead(n.id);
                  navigate(n.href);
                }}
              >
                {n.actor} {n.summary}
              </td>
              <td className="py-2 text-muted-foreground">{n.courseTitle}</td>
              <td className="py-2 text-right text-muted-foreground">
                {timeAgo(n.minutesAgo)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
