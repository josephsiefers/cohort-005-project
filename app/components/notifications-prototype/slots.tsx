// PROTOTYPE — throwaway. "Where do Notifications surface and how do they
// look?" (wayfinder #15): three variants across the sidebar, a /notifications
// inbox page and the existing queues, switchable via `?variant=A|B|C`.
//
// Each slot renders only for the variant that uses it, so the real sidebar
// stays untouched apart from these mount points.

import { PrototypeSwitcher } from "~/components/prototype-switcher";
import { VARIANTS, useNotificationsPrototype } from "./store";
import { BellA, InboxA } from "./variant-a";
import { InboxB, NavItemB, QueueBadgeB } from "./variant-b";
import { BellC, DrawerC, InboxC } from "./variant-c";

export function SidebarHeaderSlot() {
  const { variant, role } = useNotificationsPrototype();
  return role && variant === "A" ? <BellA /> : null;
}

export function SidebarNavTopSlot() {
  const { variant, role } = useNotificationsPrototype();
  return role && variant === "B" ? <NavItemB /> : null;
}

export function SidebarNavBadgeSlot({ to }: { to: string }) {
  const { variant, role } = useNotificationsPrototype();
  return role && variant === "B" ? <QueueBadgeB to={to} /> : null;
}

export function SidebarFooterSlot() {
  const { variant, role } = useNotificationsPrototype();
  return role && variant === "C" ? <BellC /> : null;
}

export function NotificationsInbox() {
  const { variant, role } = useNotificationsPrototype();
  if (!role) {
    return (
      <p className="p-8 text-muted-foreground">
        Select a user from the DevUI panel.
      </p>
    );
  }
  if (variant === "B") return <InboxB />;
  if (variant === "C") return <InboxC />;
  return <InboxA />;
}

/** Mounted once in the app layout: C's drawer plus the switcher bar. */
export function NotificationsPrototypeOverlay() {
  const s = useNotificationsPrototype();
  return (
    <>
      {s.role && s.variant === "C" && <DrawerC />}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={s.variant}
        onChange={s.setVariant}
      >
        <button
          onClick={s.simulateArrival}
          disabled={!s.role}
          className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs hover:bg-white/25 disabled:opacity-40"
        >
          Simulate arrival
        </button>
        <span className="font-mono text-[11px] text-white/60">
          {s.role ?? "no user"} · {s.items.length} total · {s.unreadCount}{" "}
          unread · {s.unseenCount} unseen
        </span>
      </PrototypeSwitcher>
    </>
  );
}
