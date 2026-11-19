import { describe, it, expect } from "vitest";
import * as schema from "~/db/schema";
import { addQuiz, setUpCourse } from "./fixtures";

function setUpQuiz() {
  const course = setUpCourse();
  const fixture = addQuiz(course.db, course.lessons.first.id);
  const submit = (answers: Record<number, number>) =>
    course.viewer.submitQuiz({
      userId: course.base.user.id,
      quizId: fixture.quiz.id,
      answers,
    });
  return { course, ...fixture, submit };
}

describe("submitting a quiz", () => {
  it("grades every question right as a pass with an A", () => {
    const { q1, q2, options, submit } = setUpQuiz();
    const result = submit({ [q1.id]: options.b.id, [q2.id]: options.yes.id });
    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 1 + 1,
      totalQuestions: 2,
    });
    expect(result.questionResults).toEqual([
      {
        questionId: q1.id,
        correct: true,
        selectedOptionId: options.b.id,
        correctOptionId: options.b.id,
      },
      {
        questionId: q2.id,
        correct: true,
        selectedOptionId: options.yes.id,
        correctOptionId: options.yes.id,
      },
    ]);
  });

  it("shows the correct option for a wrong answer, and nothing for a skipped one", () => {
    const { q1, q2, options, submit } = setUpQuiz();
    const result = submit({ [q1.id]: options.a.id });
    expect(result).toMatchObject({
      score: 0,
      passed: false,
      grade: "F",
      totalCorrect: 0,
    });
    expect(result.questionResults).toEqual([
      {
        questionId: q1.id,
        correct: false,
        selectedOptionId: options.a.id,
        correctOptionId: options.b.id,
      },
      {
        questionId: q2.id,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
    ]);
  });

  it("fails a half-right attempt, since passing needs more than 70%", () => {
    const { q1, options, submit } = setUpQuiz();
    const result = submit({ [q1.id]: options.b.id });
    expect(result).toMatchObject({ score: 0.5, passed: false, grade: "F" });
  });

  it("records the attempt and each answered question", () => {
    const { course, quiz, q1, options, submit } = setUpQuiz();
    const result = submit({ [q1.id]: options.b.id });

    const attempts = course.db.select().from(schema.quizAttempts).all();
    expect(attempts).toEqual([
      expect.objectContaining({
        id: result.attemptId,
        userId: course.base.user.id,
        quizId: quiz.id,
        score: 0.5,
        passed: false,
      }),
    ]);
    const answers = course.db.select().from(schema.quizAnswers).all();
    expect(answers).toEqual([
      expect.objectContaining({
        attemptId: result.attemptId,
        questionId: q1.id,
        selectedOptionId: options.b.id,
      }),
    ]);
  });

  it("records an attempt with no answers", () => {
    const { course, submit } = setUpQuiz();
    submit({});
    expect(course.db.select().from(schema.quizAttempts).all()).toHaveLength(1);
    expect(course.db.select().from(schema.quizAnswers).all()).toHaveLength(0);
  });

  it("scores a quiz with no questions as zero", () => {
    const course = setUpCourse();
    const empty = course.db
      .insert(schema.quizzes)
      .values({
        lessonId: course.lessons.second.id,
        title: "Empty",
        passingScore: 0.7,
      })
      .returning()
      .get();
    const result = course.viewer.submitQuiz({
      userId: course.base.user.id,
      quizId: empty.id,
      answers: {},
    });
    expect(result).toMatchObject({ score: 0, totalQuestions: 0, grade: "F" });
  });
});

describe("a question with no correct option", () => {
  it("is never right, answered or skipped", () => {
    const { course, quiz, q1, options, submit } = setUpQuiz();
    const open = course.db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: "No answer",
        questionType: schema.QuestionType.MultipleChoice,
        position: 3,
      })
      .returning()
      .get();
    const skipped = submit({ [q1.id]: options.b.id });
    expect(skipped.questionResults[2]).toEqual({
      questionId: open.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    });

    const anything = course.db
      .insert(schema.quizOptions)
      .values({ questionId: open.id, optionText: "Maybe", isCorrect: false })
      .returning()
      .get();
    const answered = submit({ [open.id]: anything.id });
    expect(answered.questionResults[2]).toMatchObject({
      correct: false,
      correctOptionId: null,
    });
  });
});

describe("grades", () => {
  // Ten questions, all multiple choice, A is always right.
  function setUpTen() {
    const course = setUpCourse();
    const quiz = course.db
      .insert(schema.quizzes)
      .values({
        lessonId: course.lessons.second.id,
        title: "Ten",
        passingScore: 0.7,
      })
      .returning()
      .get();
    const questions = Array.from({ length: 10 }, (_, i) => {
      const q = course.db
        .insert(schema.quizQuestions)
        .values({
          quizId: quiz.id,
          questionText: `Q${i}`,
          questionType: schema.QuestionType.MultipleChoice,
          position: i,
        })
        .returning()
        .get();
      const right = course.db
        .insert(schema.quizOptions)
        .values({ questionId: q.id, optionText: "A", isCorrect: true })
        .returning()
        .get();
      return { id: q.id, right: right.id };
    });
    return (correctCount: number) =>
      course.viewer.submitQuiz({
        userId: course.base.user.id,
        quizId: quiz.id,
        answers: Object.fromEntries(
          questions.slice(0, correctCount).map((q) => [q.id, q.right])
        ),
      });
  }

  it.each([
    [10, "A", true],
    [9, "A", true],
    [8, "B", true],
    [7, "C", false],
    [6, "D", false],
    [5, "F", false],
  ])("%i of 10 right is a %s", (correctCount, grade, passed) => {
    const submit = setUpTen();
    expect(submit(correctCount)).toMatchObject({ grade, passed });
  });
});

describe("scoping a quiz to the lesson", () => {
  it("finds the lesson's quiz and refuses another lesson's", () => {
    const { course, quiz } = setUpQuiz();
    expect(course.viewer.isQuizOnLesson(quiz.id, course.lessons.first.id)).toBe(
      true
    );
    expect(
      course.viewer.isQuizOnLesson(quiz.id, course.lessons.second.id)
    ).toBe(false);
    expect(course.viewer.isQuizOnLesson(9999, course.lessons.first.id)).toBe(
      false
    );
  });
});

describe("reading answers from the form", () => {
  it("takes question-{id} fields and ignores the rest", () => {
    const { course } = setUpQuiz();
    const form = new FormData();
    form.set("intent", "submit-quiz");
    form.set("quizId", "4");
    form.set("question-12", "40");
    form.set("question-13", "41");
    form.set("question-x", "42");
    form.set("question-14", "nope");
    expect(course.viewer.quizAnswersFromForm(form)).toEqual({ 12: 40, 13: 41 });
  });
});
