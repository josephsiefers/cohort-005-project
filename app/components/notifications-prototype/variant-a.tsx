// PROTOTYPE — throwaway. Variant A: what Knock's ready-made components give us
// out of the box, approximated by hand (no Knock SDK installed):
//   - NotificationIconButton  → bell + badge in the sidebar header
//   - NotificationFeedPopover → the dropdown
//   - NotificationFeed        → the inbox page, same cells full-width
// Updated after round 1 of the grilling: the bell shows a DOT while anything is
// unread (opening the popover changes nothing); clicking a cell marks it read;
// no archive; All/Unread filter only; course title on every row.
// No inline badges on the queues and no toasts: the bell is the only surface.

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Bell } from "lucide-react";
import { cn } from "~/lib/utils";
import { useNotificationsPrototype } from "./store";
import { timeAgo, type MockNotification } from "./mock-data";
import { Initials } from "./shared";

type Filter = "all" | "unread";

function applyFilter(items: MockNotification[], f: Filter) {
  if (f === "unread") return items.filter((n) => !n.read);
  return items;
}

function FeedHeader({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
}) {
  const { markAllRead } = useNotificationsPrototype();
  return (
    <div className="flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-semibold">Notifications</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded border bg-transparent px-1 py-0.5 text-xs text-muted-foreground"
        >
          <option value="all">All</option>
          <option value="unread">Unread</option>
        </select>
      </div>
      <button
        onClick={markAllRead}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Mark all as read
      </button>
    </div>
  );
}

function FeedCell({ n, onOpen }: { n: MockNotification; onOpen: () => void }) {
  const { markRead } = useNotificationsPrototype();
  const navigate = useNavigate();
  return (
    <div
      role="button"
      onClick={() => {
        markRead(n.id);
        onOpen();
        navigate(n.href);
      }}
      className="group relative flex cursor-pointer gap-3 border-b px-4 py-3 hover:bg-muted/50"
    >
      <span
        className={cn(
          "absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full",
          n.read ? "bg-transparent" : "bg-blue-500"
        )}
      />
      <Initials name={n.actor} />
      <div className="min-w-0 flex-1 text-sm">
        <p>
          <strong>{n.actor}</strong> {n.summary}
        </p>
        {n.snippet && (
          <p className="mt-1 line-clamp-2 border-l-2 pl-2 text-muted-foreground">
            {n.snippet}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {n.courseTitle} · {timeAgo(n.minutesAgo)}
        </p>
      </div>
    </div>
  );
}

function Feed({
  onOpen,
  maxHeight,
}: {
  onOpen: () => void;
  maxHeight?: string;
}) {
  const { items } = useNotificationsPrototype();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = applyFilter(items, filter);
  return (
    <>
      <FeedHeader filter={filter} setFilter={setFilter} />
      <div className={cn("overflow-y-auto", maxHeight)}>
        {shown.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          shown.map((n) => <FeedCell key={n.id} n={n} onOpen={onOpen} />)
        )}
      </div>
      <div className="px-4 py-2 text-center text-[11px] text-muted-foreground/70">
        Powered by Knock
      </div>
    </>
  );
}

/** Sidebar header slot: bell + popover. */
export function BellA() {
  const { unreadCount } = useNotificationsPrototype();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500 ring-2 ring-sidebar" />
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <Feed onOpen={() => setOpen(false)} maxHeight="max-h-[420px]" />
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t px-4 py-2 text-center text-xs font-medium hover:bg-muted/50"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

/** Inbox page: Knock's NotificationFeed, full width. */
export function InboxA() {
  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Feed onOpen={() => {}} />
      </div>
    </div>
  );
}
