import { and, eq, inArray } from "drizzle-orm";
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
} from "~/db/schema";
import type { Db } from "./db";
import { calculateGrade } from "./quiz";

export type QuizSubmission = {
  userId: number;
  quizId: number;
  answers: Record<number, number>;
};

function correctOptionByQuestion(db: Db, quizId: number) {
  const questions = db
    .select({ id: quizQuestions.id })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();

  const correctOptions = db
    .select({ id: quizOptions.id, questionId: quizOptions.questionId })
    .from(quizOptions)
    .where(
      and(
        inArray(
          quizOptions.questionId,
          questions.map((q) => q.id)
        ),
        eq(quizOptions.isCorrect, true)
      )
    )
    .orderBy(quizOptions.id)
    .all();

  return questions.map((q) => ({
    questionId: q.id,
    correctOptionId:
      correctOptions.find((o) => o.questionId === q.id)?.id ?? null,
  }));
}

/** Grades the answers and records the attempt with its answers, together. */
export function scoreQuiz(db: Db, { userId, quizId, answers }: QuizSubmission) {
  const questionResults = correctOptionByQuestion(db, quizId).map((q) => {
    const selected = answers[q.questionId] ?? null;
    return {
      questionId: q.questionId,
      correct: selected !== null && selected === q.correctOptionId,
      selectedOptionId: selected,
      correctOptionId: selected === null ? null : q.correctOptionId,
    };
  });

  const total = questionResults.length;
  const correct = questionResults.filter((r) => r.correct).length;
  const score = total > 0 ? correct / total : 0;
  const passed = score > 0.7;

  const attemptId = db.transaction((tx) => {
    const attempt = tx
      .insert(quizAttempts)
      .values({ userId, quizId, score, passed })
      .returning({ id: quizAttempts.id })
      .get();
    const answered = questionResults.flatMap(
      ({ questionId, selectedOptionId }) =>
        selectedOptionId === null
          ? []
          : [{ attemptId: attempt.id, questionId, selectedOptionId }]
    );
    if (answered.length > 0) tx.insert(quizAnswers).values(answered).run();
    return attempt.id;
  });

  return {
    attemptId,
    score,
    passed,
    grade: calculateGrade(score),
    totalCorrect: correct,
    totalQuestions: total,
    questionResults,
  };
}

export type QuizResult = ReturnType<typeof scoreQuiz>;
