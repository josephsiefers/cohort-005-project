// PROTOTYPE — throwaway. Variant B: no bell. Built on Knock's headless hooks.
//   - "Notifications" is a sidebar nav item with an UNREAD count
//   - the queues it overlaps (Questions, Refund Requests) get their own inline
//     unread badges in the nav
//   - the inbox page is the main surface: filter rail by event type, list
//     grouped by day, per-row read/unread toggle
// Nothing pops up; you find out when you look at the sidebar.

import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Inbox, Check, Circle } from "lucide-react";
import { cn } from "~/lib/utils";
import { useNotificationsPrototype } from "./store";
import {
  dayBucket,
  kindLabel,
  timeAgo,
  type NotificationKind,
} from "./mock-data";
import { CountPill, Initials, KindIcon, kindTone } from "./shared";

/** Sidebar slot at the top of the nav. */
export function NavItemB() {
  const { unreadCount } = useNotificationsPrototype();
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Inbox className="size-4" />
      Notifications
      <CountPill count={unreadCount} />
    </NavLink>
  );
}

const queueKinds: Record<string, NotificationKind> = {
  "/instructor/questions": "question",
  "/admin/refunds": "refund-request",
};

/** Inline badge on an existing queue's nav item. */
export function QueueBadgeB({ to }: { to: string }) {
  const { items } = useNotificationsPrototype();
  const kind = queueKinds[to];
  if (!kind) return null;
  const count = items.filter((n) => n.kind === kind && !n.read).length;
  return <CountPill count={count} className="bg-violet-600" />;
}

export function InboxB() {
  const { items, markRead, markUnread, markAllRead } =
    useNotificationsPrototype();
  const navigate = useNavigate();
  const [kind, setKind] = useState<NotificationKind | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const kinds = Array.from(new Set(items.map((n) => n.kind)));
  const shown = items.filter(
    (n) => (kind === "all" || n.kind === kind) && (!unreadOnly || !n.read)
  );
  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map((b) => ({ b, xs: shown.filter((n) => dayBucket(n.minutesAgo) === b) }))
    .filter((g) => g.xs.length > 0);

  return (
    <div className="flex h-full">
      <aside className="w-56 shrink-0 border-r p-4">
        <h1 className="mb-4 text-xl font-bold">Notifications</h1>
        <div className="space-y-1">
          {(["all", ...kinds] as const).map((k) => {
            const count = items.filter(
              (n) => (k === "all" || n.kind === k) && !n.read
            ).length;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                  kind === k
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                {k === "all" ? (
                  <Inbox className="size-4" />
                ) : (
                  <KindIcon kind={k} />
                )}
                {k === "all" ? "All" : kindLabel[k]}
                <CountPill count={count} />
              </button>
            );
          })}
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
          />
          Unread only
        </label>
      </aside>

      <section className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex justify-end">
            <button
              onClick={markAllRead}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </button>
          </div>
          {groups.length === 0 && (
            <p className="py-16 text-center text-muted-foreground">
              Nothing here.
            </p>
          )}
          {groups.map(({ b, xs }) => (
            <div key={b} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {b}
              </h2>
              <ul className="divide-y rounded-lg border">
                {xs.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => {
                      markRead(n.id);
                      navigate(n.href);
                    }}
                    className={cn(
                      "group flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/40",
                      !n.read && "bg-primary/5"
                    )}
                  >
                    <Initials name={n.actor} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm", !n.read && "font-semibold")}>
                        {n.actor} {n.summary}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.courseTitle} · {timeAgo(n.minutesAgo)}
                      </p>
                    </div>
                    <button
                      title={n.read ? "Mark as unread" : "Mark as read"}
                      onClick={(e) => {
                        e.stopPropagation();
                        n.read ? markUnread(n.id) : markRead(n.id);
                      }}
                      className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"
                    >
                      {n.read ? (
                        <Circle className="size-4" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </button>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium",
                        kindTone[n.kind]
                      )}
                    >
                      {kindLabel[n.kind]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
