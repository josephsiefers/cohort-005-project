// PROTOTYPE — throwaway. Mocked Notifications for "Where do Notifications
// surface and how do they look?" (wayfinder #15). No Knock, no DB writes.
//
// The four v1 events (decided in #14):
//   reply          → author of the Comment being replied to (any role)
//   question       → that course's Instructor
//   first-rating   → that course's Instructor
//   refund-request → every Platform Admin
//
// Targets point at real seeded routes (run `npm run db:seed`).

import { UserRole } from "~/db/schema";

export type NotificationKind =
  "reply" | "question" | "first-rating" | "refund-request";

export interface MockNotification {
  id: string;
  kind: NotificationKind;
  actor: string;
  /** Short line, actor name excluded. */
  summary: string;
  /** Quoted content, e.g. the Reply or Question text. */
  snippet?: string;
  courseTitle: string;
  href: string;
  minutesAgo: number;
  read: boolean;
  seen: boolean;
}

export const kindLabel: Record<NotificationKind, string> = {
  reply: "Replies",
  question: "Questions",
  "first-rating": "First ratings",
  "refund-request": "Refund Requests",
};

const TS = "Introduction to TypeScript";
const TW = "Design Systems with Tailwind";
const NODE = "Building REST APIs with Node.js";

type Seed = Omit<MockNotification, "id" | "read" | "seen"> & {
  read?: boolean;
};

const studentFeed: Seed[] = [
  {
    kind: "reply",
    actor: "Sarah Chen",
    summary: "replied to your Comment on “Installing TypeScript”",
    snippet:
      "That usually means TypeScript is installed locally. Try `npx tsc` instead.",
    courseTitle: TS,
    href: "/courses/introduction-to-typescript/lessons/3",
    minutesAgo: 4,
  },
  {
    kind: "reply",
    actor: "James Park",
    summary: "replied to your Comment on “Generics”",
    snippet: "Same here — adding `extends object` fixed it for me.",
    courseTitle: TS,
    href: "/courses/introduction-to-typescript/lessons/8",
    minutesAgo: 95,
  },
  {
    kind: "reply",
    actor: "Sarah Chen",
    summary: "replied to your Comment on “Strict mode”",
    snippet: "Strict mode turns on noImplicitAny, so yes, it does.",
    courseTitle: TS,
    href: "/courses/introduction-to-typescript/lessons/4",
    minutesAgo: 60 * 26,
    read: true,
  },
];

const instructorFeed: Seed[] = [
  {
    kind: "question",
    actor: "Emma Wilson",
    summary: "asked a Question on “Generics”",
    snippet:
      "Why does this fail to infer? I expected `T` to come from the argument.",
    courseTitle: TS,
    href: "/instructor/questions",
    minutesAgo: 2,
  },
  {
    kind: "first-rating",
    actor: "Olivia Martinez",
    summary: "gave your course its first rating: ★★★★☆",
    courseTitle: TW,
    href: "/instructor/3",
    minutesAgo: 40,
  },
  {
    kind: "question",
    actor: "Liam Thompson",
    summary: "asked a Question on “Interfaces vs types”",
    snippet: "Is there a reason to prefer `interface` over `type` here?",
    courseTitle: TS,
    href: "/instructor/questions",
    minutesAgo: 180,
  },
  {
    kind: "reply",
    actor: "Emma Wilson",
    summary: "replied to your Comment on “Installing TypeScript”",
    snippet: "`npx` did it. Thank you!",
    courseTitle: TS,
    href: "/courses/introduction-to-typescript/lessons/3",
    minutesAgo: 60 * 30,
    read: true,
  },
];

const adminFeed: Seed[] = [
  {
    kind: "refund-request",
    actor: "James Park",
    summary: "requested a refund for $49.00",
    snippet: "The course wasn't what I expected from the description.",
    courseTitle: NODE,
    href: "/admin/refunds",
    minutesAgo: 12,
  },
  {
    kind: "refund-request",
    actor: "Sophia Davis",
    summary: "requested a refund for $39.00",
    courseTitle: TW,
    href: "/admin/refunds",
    minutesAgo: 60 * 5,
  },
  {
    kind: "refund-request",
    actor: "Liam Thompson",
    summary: "requested a refund for $49.00",
    courseTitle: TS,
    href: "/admin/refunds",
    minutesAgo: 60 * 50,
    read: true,
  },
];

/** What "Simulate arrival" pushes, in order, per role. */
const incoming: Record<UserRole, Seed[]> = {
  [UserRole.Student]: [
    {
      kind: "reply",
      actor: "Marcus Johnson",
      summary: "replied to your Comment on “What is a REST API?”",
      snippet: "Good question — REST is a style, not a protocol.",
      courseTitle: NODE,
      href: "/courses/building-rest-apis-with-nodejs/lessons/20",
      minutesAgo: 0,
    },
  ],
  [UserRole.Instructor]: [
    {
      kind: "question",
      actor: "Sophia Davis",
      summary: "asked a Question on “What a Design System Is For”",
      snippet: "How do tokens differ from Tailwind theme values?",
      courseTitle: TW,
      href: "/instructor/questions",
      minutesAgo: 0,
    },
    {
      kind: "first-rating",
      actor: "James Park",
      summary: "gave your course its first rating: ★★★★★",
      courseTitle: TS,
      href: "/instructor/1",
      minutesAgo: 0,
    },
  ],
  [UserRole.Admin]: [
    {
      kind: "refund-request",
      actor: "Olivia Martinez",
      summary: "requested a refund for $49.00",
      snippet: "Bought the wrong course by mistake.",
      courseTitle: NODE,
      href: "/admin/refunds",
      minutesAgo: 0,
    },
  ],
};

const feeds: Record<UserRole, Seed[]> = {
  [UserRole.Student]: studentFeed,
  [UserRole.Instructor]: instructorFeed,
  [UserRole.Admin]: adminFeed,
};

let counter = 0;
function hydrate(seed: Seed): MockNotification {
  counter += 1;
  return {
    ...seed,
    id: `n${counter}`,
    read: seed.read ?? false,
    seen: seed.read ?? false,
  };
}

export function initialFeed(role: UserRole): MockNotification[] {
  return feeds[role].map(hydrate);
}

export function nextIncoming(
  role: UserRole,
  index: number
): MockNotification | null {
  const pool = incoming[role];
  if (pool.length === 0) return null;
  return hydrate(pool[index % pool.length]);
}

export function timeAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function dayBucket(minutes: number): "Today" | "Yesterday" | "Earlier" {
  if (minutes < 60 * 24) return "Today";
  if (minutes < 60 * 48) return "Yesterday";
  return "Earlier";
}
