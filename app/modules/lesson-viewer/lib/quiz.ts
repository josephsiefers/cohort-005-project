import { and, desc, eq, inArray } from "drizzle-orm";
import { quizAttempts, quizOptions, quizQuestions, quizzes } from "~/db/schema";
import { z } from "zod";
import type { Db } from "./db";

/** The lesson's quiz, without `isCorrect`, so answers never reach the browser. */
export function getLessonQuiz(db: Db, lessonId: number) {
  const quiz = db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      passingScore: quizzes.passingScore,
    })
    .from(quizzes)
    .where(eq(quizzes.lessonId, lessonId))
    .get();
  if (!quiz) return null;

  const questions = db
    .select({
      id: quizQuestions.id,
      questionText: quizQuestions.questionText,
      questionType: quizQuestions.questionType,
      position: quizQuestions.position,
    })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quiz.id))
    .orderBy(quizQuestions.position)
    .all();

  const options = db
    .select({
      id: quizOptions.id,
      questionId: quizOptions.questionId,
      optionText: quizOptions.optionText,
    })
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        questions.map((q) => q.id)
      )
    )
    .all();

  return {
    ...quiz,
    questions: questions.map((q) => ({
      ...q,
      options: options
        .filter((o) => o.questionId === q.id)
        .map((o) => ({ id: o.id, optionText: o.optionText })),
    })),
  };
}

export type LessonQuiz = NonNullable<ReturnType<typeof getLessonQuiz>>;

export function getBestAttempt(db: Db, userId: number, quizId: number) {
  const best = db
    .select({ score: quizAttempts.score, passed: quizAttempts.passed })
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
  return best ?? null;
}

/** Scoped to the lesson so a quiz elsewhere can't be reached through it. */
export function isQuizOnLesson(db: Db, quizId: number, lessonId: number) {
  const found = db
    .select({ id: quizzes.id })
    .from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.lessonId, lessonId)))
    .get();
  return found !== undefined;
}

export function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

const formId = z.coerce.number().int().positive();

/** Form fields named `question-{questionId}`, each holding an option id. */
export function quizAnswersFromForm(formData: FormData) {
  const answers: Record<number, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("question-")) continue;
    const questionId = formId.safeParse(key.slice("question-".length));
    const optionId = formId.safeParse(value);
    if (questionId.success && optionId.success) {
      answers[questionId.data] = optionId.data;
    }
  }
  return answers;
}
