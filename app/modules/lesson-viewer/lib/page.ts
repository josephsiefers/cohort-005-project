import { eq } from "drizzle-orm";
import { lessons, users } from "~/db/schema";
import { isBookmarked } from "~/lib/bookmarks.server";
import { renderMarkdown } from "~/lib/markdown.server";
import { getNote } from "~/lib/notes.server";
import type { Decision } from "~/modules/permissions/course-permissions.server";
import type { Db } from "./db";
import {
  getCourseOutline,
  getLessonInModule,
  neighbours,
  type OutlineLesson,
} from "./outline";
import {
  getLessonStatus,
  getProgressMap,
  getWatchState,
  markLessonInProgress,
} from "./progress";
import { getBestAttempt, getLessonQuiz } from "./quiz";
import { getLessonThread, renderThread } from "./thread";

export type LessonPageRequest = {
  course: { id: number; instructorId: number };
  lessonId: number;
  currentUserId: number | null;
  enrolled: boolean;
  view: Decision;
  canTake: boolean;
  canModerate: boolean;
};

type Lesson = typeof lessons.$inferSelect;

/**
 * Progress is recorded only for people who can take the course, so a
 * Student under a Country Lock gets none. Opening the lesson starts it.
 */
function learnerProgress(db: Db, request: LessonPageRequest, lesson: Lesson) {
  const { currentUserId, canTake, course } = request;
  if (!currentUserId || !canTake) {
    return {
      lessonStatus: null,
      lessonProgressMap: {},
      lastWatchPosition: 0,
      watchProgress: 0,
    };
  }
  const key = { userId: currentUserId, lessonId: lesson.id };
  markLessonInProgress(db, key);
  return {
    lessonStatus: getLessonStatus(db, key),
    lessonProgressMap: getProgressMap(db, currentUserId, course.id),
    ...(lesson.videoUrl
      ? getWatchState(db, key, lesson.durationMinutes)
      : { lastWatchPosition: 0, watchProgress: 0 }),
  };
}

function personal(db: Db, userId: number | null, lessonId: number) {
  if (!userId) return { bookmarked: false, note: null };
  const note = getNote(db, userId, lessonId);
  return {
    bookmarked: isBookmarked(db, userId, lessonId),
    note: note ? { body: note.body, updatedAt: note.updatedAt } : null,
  };
}

// Everything here is behind the can-view-content bar: comments, Bookmarks
// and Notes are confidential to the course.
async function fullLesson(
  db: Db,
  request: LessonPageRequest,
  { lesson, outline }: { lesson: Lesson; outline: OutlineLesson[] }
) {
  const { currentUserId, course } = request;
  const quiz = getLessonQuiz(db, lesson.id);
  const instructor = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, course.instructorId))
    .get();
  const thread = getLessonThread(db, lesson.id, course.instructorId);

  return {
    lesson,
    contentHtml: lesson.content ? await renderMarkdown(lesson.content) : null,
    ...learnerProgress(db, request, lesson),
    currentUserId,
    ...neighbours(outline, lesson.id),
    quiz,
    bestAttempt:
      quiz && currentUserId ? getBestAttempt(db, currentUserId, quiz.id) : null,
    comments: await renderThread(thread),
    canModerate: request.canModerate,
    instructorName: instructor?.name ?? "your instructor",
    ...personal(db, currentUserId, lesson.id),
  };
}

/**
 * Someone who can't view the content gets the lesson's title, its module and
 * the course outline — never the body, video or quiz — plus the reason, so
 * the page can show the right call to action. Null when the lesson is gone.
 */
export async function loadLessonPage(db: Db, request: LessonPageRequest) {
  const outline = getCourseOutline(db, request.course.id);
  const found = getLessonInModule(db, request.lessonId);
  if (!outline || !found) return null;

  const shared = {
    course: outline.course,
    curriculum: outline.curriculum,
    module: found.mod,
    enrolled: request.enrolled,
  };

  if (!request.view.allowed) {
    return {
      view: "locked" as const,
      ...shared,
      lesson: { id: found.lesson.id, title: found.lesson.title },
      lockedReason: request.view.reason,
    };
  }

  const full = await fullLesson(db, request, {
    lesson: found.lesson,
    outline: outline.lessons,
  });
  return { view: "full" as const, ...shared, ...full };
}

export type LessonPage = NonNullable<
  Awaited<ReturnType<typeof loadLessonPage>>
>;
export type FullLessonPage = Extract<LessonPage, { view: "full" }>;
export type LockedLessonPage = Extract<LessonPage, { view: "locked" }>;
