import { and, desc, eq, max } from "drizzle-orm";
import {
  lessonProgress,
  lessons,
  LessonProgressStatus,
  modules,
  videoWatchEvents,
} from "~/db/schema";
import type { Db } from "./db";

type ProgressKey = { userId: number; lessonId: number };

function getLessonProgress(db: Db, { userId, lessonId }: ProgressKey) {
  return db
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .get();
}

export function getLessonStatus(db: Db, key: ProgressKey) {
  return getLessonProgress(db, key)?.status ?? null;
}

/** Each lesson in the course the Student has started, by lesson id. */
export function getProgressMap(db: Db, userId: number, courseId: number) {
  const rows = db
    .select({
      lessonId: lessonProgress.lessonId,
      status: lessonProgress.status,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(eq(lessonProgress.userId, userId), eq(modules.courseId, courseId))
    )
    .all();

  const map: Record<number, string> = {};
  for (const row of rows) map[row.lessonId] = row.status;
  return map;
}

export function markLessonComplete(db: Db, key: ProgressKey, now: Date) {
  const completed = {
    status: LessonProgressStatus.Completed,
    completedAt: now.toISOString(),
  };
  const existing = getLessonProgress(db, key);
  if (existing) {
    db.update(lessonProgress)
      .set(completed)
      .where(eq(lessonProgress.id, existing.id))
      .run();
    return;
  }
  db.insert(lessonProgress)
    .values({ ...key, ...completed })
    .run();
}

/** Opening a lesson starts it, but never undoes a completed one. */
export function markLessonInProgress(db: Db, key: ProgressKey) {
  const existing = getLessonProgress(db, key);
  if (existing?.status === LessonProgressStatus.Completed) return;
  if (existing) {
    db.update(lessonProgress)
      .set({ status: LessonProgressStatus.InProgress })
      .where(eq(lessonProgress.id, existing.id))
      .run();
    return;
  }
  db.insert(lessonProgress)
    .values({ ...key, status: LessonProgressStatus.InProgress })
    .run();
}

/**
 * Where to resume the video, and how far through it the Student has got as
 * a percentage of the lesson's duration.
 */
export function getWatchState(
  db: Db,
  key: ProgressKey,
  durationMinutes: number | null
) {
  const watched = and(
    eq(videoWatchEvents.userId, key.userId),
    eq(videoWatchEvents.lessonId, key.lessonId)
  );
  const last = db
    .select({ position: videoWatchEvents.positionSeconds })
    .from(videoWatchEvents)
    .where(watched)
    .orderBy(desc(videoWatchEvents.createdAt))
    .limit(1)
    .get();

  const durationSeconds = (durationMinutes ?? 0) * 60;
  if (durationSeconds <= 0) {
    return { lastWatchPosition: last?.position ?? 0, watchProgress: 0 };
  }

  const furthest = db
    .select({ position: max(videoWatchEvents.positionSeconds) })
    .from(videoWatchEvents)
    .where(watched)
    .get();
  const percent = Math.round(
    ((furthest?.position ?? 0) / durationSeconds) * 100
  );

  return {
    lastWatchPosition: last?.position ?? 0,
    watchProgress: Math.min(percent, 100),
  };
}
