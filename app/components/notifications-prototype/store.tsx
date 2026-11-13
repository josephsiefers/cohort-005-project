// PROTOTYPE — throwaway. In-memory Notification state standing in for Knock's
// feed (what `useKnockFeed` / `useNotifications` would give us). Resets on
// reload and on DevUI user switch.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { UserRole } from "~/db/schema";
import { initialFeed, nextIncoming, type MockNotification } from "./mock-data";

export const VARIANTS = [
  { key: "A", name: "Knock ready-made popover" },
  { key: "B", name: "Nav item + inbox (headless)" },
  { key: "C", name: "Drawer + live toasts (headless)" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

const STORAGE_KEY = "notifications-prototype-variant";

interface Store {
  variant: VariantKey;
  setVariant: (v: VariantKey) => void;
  role: UserRole | null;
  items: MockNotification[];
  unreadCount: number;
  unseenCount: number;
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  markAllSeen: () => void;
  archive: (id: string) => void;
  simulateArrival: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function useNotificationsPrototype() {
  const store = useContext(Ctx);
  if (!store) throw new Error("NotificationsPrototypeProvider missing");
  return store;
}

function isVariant(v: string | null): v is VariantKey {
  return VARIANTS.some((x) => x.key === v);
}

export function NotificationsPrototypeProvider({
  role,
  children,
}: {
  role: UserRole | null;
  children: React.ReactNode;
}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const param = searchParams.get("variant");
  const [stored, setStored] = useState<VariantKey>("A");

  // Sidebar NavLinks drop the search param, so remember the last variant.
  useEffect(() => {
    if (isVariant(param)) {
      localStorage.setItem(STORAGE_KEY, param);
      setStored(param);
    } else {
      const s = localStorage.getItem(STORAGE_KEY);
      if (isVariant(s)) setStored(s);
    }
  }, [param]);

  const variant: VariantKey = isVariant(param) ? param : stored;

  const setVariant = useCallback(
    (v: VariantKey) => {
      const next = new URLSearchParams(searchParams);
      next.set("variant", v);
      navigate({ search: next.toString() }, { replace: true });
    },
    [navigate, searchParams]
  );

  const [items, setItems] = useState<MockNotification[]>(() =>
    role ? initialFeed(role) : []
  );
  const [arrivals, setArrivals] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setItems(role ? initialFeed(role) : []);
    setArrivals(0);
  }, [role]);

  const update = (id: string, patch: Partial<MockNotification>) =>
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const simulateArrival = () => {
    if (!role) return;
    const n = nextIncoming(role, arrivals);
    if (!n) return;
    setArrivals((a) => a + 1);
    setItems((xs) => [n, ...xs]);
    if (variant === "C") {
      toast(`${n.actor} ${n.summary}`, {
        description: n.courseTitle,
        action: {
          label: "View",
          onClick: () => {
            update(n.id, { read: true, seen: true });
            navigate(n.href);
          },
        },
      });
    }
  };

  const store: Store = {
    variant,
    setVariant,
    role,
    items,
    unreadCount: items.filter((n) => !n.read).length,
    unseenCount: items.filter((n) => !n.seen).length,
    markRead: (id) => update(id, { read: true, seen: true }),
    markUnread: (id) => update(id, { read: false }),
    markAllRead: () =>
      setItems((xs) => xs.map((n) => ({ ...n, read: true, seen: true }))),
    markAllSeen: () => setItems((xs) => xs.map((n) => ({ ...n, seen: true }))),
    archive: (id) => setItems((xs) => xs.filter((n) => n.id !== id)),
    simulateArrival,
    drawerOpen,
    setDrawerOpen,
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
