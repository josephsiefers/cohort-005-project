import { db } from "~/db";
import type { Db } from "./lib/db";
import { loadLessonPage, type LessonPageRequest } from "./lib/page";
import { markLessonComplete } from "./lib/progress";
import { isQuizOnLesson, quizAnswersFromForm } from "./lib/quiz";
import { scoreQuiz, type QuizSubmission } from "./lib/scoring";
import { isCommentOnLesson } from "./lib/thread";

export type {
  FullLessonPage,
  LessonPage,
  LessonPageRequest,
  LockedLessonPage,
} from "./lib/page";
export type { LessonQuiz } from "./lib/quiz";
export type { QuizResult, QuizSubmission } from "./lib/scoring";

/**
 * The lesson page's data, bound to a database. The app uses `lessonViewer`;
 * tests build their own against a test database. Permission decisions come
 * in from the caller: this module never decides who may see what.
 */
export function createLessonViewer(database: Db) {
  return {
    /** Everything the page shows. Null when the lesson does not exist. */
    loadPage(request: LessonPageRequest) {
      return loadLessonPage(database, request);
    },

    markComplete(userId: number, lessonId: number, now: Date) {
      markLessonComplete(database, { userId, lessonId }, now);
    },

    isCommentOnLesson(commentId: number, lessonId: number) {
      return isCommentOnLesson(database, commentId, lessonId);
    },

    isQuizOnLesson(quizId: number, lessonId: number) {
      return isQuizOnLesson(database, quizId, lessonId);
    },

    /** Grades the submission and records the attempt. */
    submitQuiz(submission: QuizSubmission) {
      return scoreQuiz(database, submission);
    },

    quizAnswersFromForm,
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonViewer = /* @__PURE__ */ createLessonViewer(db);
