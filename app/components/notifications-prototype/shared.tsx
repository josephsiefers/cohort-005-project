// PROTOTYPE — throwaway. Bits shared by the three variants.

import { MessageSquare, HelpCircle, Star, Receipt } from "lucide-react";
import { cn } from "~/lib/utils";
import type { NotificationKind } from "./mock-data";

export function Initials({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);
  return (
    <div
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
    >
      {initials}
    </div>
  );
}

export function KindIcon({
  kind,
  className,
}: {
  kind: NotificationKind;
  className?: string;
}) {
  const Icon = {
    reply: MessageSquare,
    question: HelpCircle,
    "first-rating": Star,
    "refund-request": Receipt,
  }[kind];
  return <Icon className={cn("size-4", className)} />;
}

export const kindTone: Record<NotificationKind, string> = {
  reply: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  question:
    "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "first-rating":
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  "refund-request":
    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export function CountPill({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
