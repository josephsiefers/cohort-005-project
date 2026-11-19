import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { createLessonViewer, type LessonPageRequest } from "../index.server";

export const NOW = new Date(2026, 10, 19, 12, 0, 0);

/** A course with two modules: Basics (lessons 1, 2) and Advanced (lesson 3). */
export function setUpCourse() {
  const db = createTestDb();
  const base = seedBaseData(db);

  const addModule = (title: string, position: number) =>
    db
      .insert(schema.modules)
      .values({ courseId: base.course.id, title, position })
      .returning()
      .get();
  // Inserted out of order so the tests see position, not insertion, order.
  const advanced = addModule("Advanced", 2);
  const basics = addModule("Basics", 1);

  const addLesson = (
    lesson: Omit<typeof schema.lessons.$inferInsert, "moduleId">,
    moduleId: number
  ) =>
    db
      .insert(schema.lessons)
      .values({ ...lesson, moduleId })
      .returning()
      .get();
  const second = addLesson({ title: "Second", position: 2 }, basics.id);
  const first = addLesson(
    {
      title: "First",
      position: 1,
      content: markdown("# Hello"),
      videoUrl: "https://youtu.be/abc",
      durationMinutes: 10,
    },
    basics.id
  );
  const third = addLesson({ title: "Third", position: 1 }, advanced.id);

  return {
    db,
    base,
    viewer: createLessonViewer(db),
    modules: { basics, advanced },
    lessons: { first, second, third },
  };
}

export type Course = ReturnType<typeof setUpCourse>;

export function pageRequest(
  course: Course,
  overrides: Partial<LessonPageRequest> = {}
): LessonPageRequest {
  return {
    course: {
      id: course.base.course.id,
      instructorId: course.base.instructor.id,
    },
    lessonId: course.lessons.first.id,
    currentUserId: course.base.user.id,
    enrolled: true,
    view: { allowed: true },
    canTake: true,
    canModerate: false,
    ...overrides,
  };
}

export async function loadFull(course: Course, overrides = {}) {
  const page = await course.viewer.loadPage(pageRequest(course, overrides));
  if (page?.view !== "full") throw new Error("expected a full page");
  return page;
}

/** Two questions: multiple choice (B correct), true/false (True correct). */
export function addQuiz(db: TestDb, lessonId: number) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const question = (
    questionText: string,
    position: number,
    type: schema.QuestionType
  ) =>
    db
      .insert(schema.quizQuestions)
      .values({ quizId: quiz.id, questionText, questionType: type, position })
      .returning()
      .get();
  const option = (questionId: number, optionText: string, isCorrect: boolean) =>
    db
      .insert(schema.quizOptions)
      .values({ questionId, optionText, isCorrect })
      .returning()
      .get();

  const q2 = question("Is it true?", 2, schema.QuestionType.TrueFalse);
  const q1 = question("Pick B", 1, schema.QuestionType.MultipleChoice);
  const a = option(q1.id, "A", false);
  const b = option(q1.id, "B", true);
  const yes = option(q2.id, "True", true);
  const no = option(q2.id, "False", false);
  return { quiz, q1, q2, options: { a, b, yes, no } };
}
