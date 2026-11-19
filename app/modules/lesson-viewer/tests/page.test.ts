import { describe, it, expect } from "vitest";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { saveNote } from "~/lib/notes.server";
import { toggleBookmark } from "~/lib/bookmarks.server";
import { NOW, addQuiz, loadFull, pageRequest, setUpCourse } from "./fixtures";

describe("loading the lesson page", () => {
  it("returns null for a lesson that does not exist", async () => {
    const course = setUpCourse();
    const page = await course.viewer.loadPage(
      pageRequest(course, { lessonId: 9999 })
    );
    expect(page).toBeNull();
  });

  it("returns null for a course that does not exist", async () => {
    const course = setUpCourse();
    const page = await course.viewer.loadPage(
      pageRequest(course, { course: { id: 9999, instructorId: 1 } })
    );
    expect(page).toBeNull();
  });

  it("lists the curriculum in module and lesson position order", async () => {
    const course = setUpCourse();
    const page = await loadFull(course);
    expect(page.curriculum).toEqual([
      {
        id: course.modules.basics.id,
        title: "Basics",
        lessons: [
          { id: course.lessons.first.id, title: "First" },
          { id: course.lessons.second.id, title: "Second" },
        ],
      },
      {
        id: course.modules.advanced.id,
        title: "Advanced",
        lessons: [{ id: course.lessons.third.id, title: "Third" }],
      },
    ]);
    expect(page.module).toEqual({
      id: course.modules.basics.id,
      title: "Basics",
    });
    expect(page.course).toEqual({
      id: course.base.course.id,
      title: "Test Course",
      slug: "test-course",
    });
  });

  it("links the previous and next lesson across modules", async () => {
    const course = setUpCourse();
    const first = await loadFull(course);
    expect(first.prevLesson).toBeNull();
    expect(first.nextLesson?.id).toBe(course.lessons.second.id);

    const second = await loadFull(course, {
      lessonId: course.lessons.second.id,
    });
    expect(second.prevLesson?.id).toBe(course.lessons.first.id);
    expect(second.nextLesson).toEqual({
      id: course.lessons.third.id,
      title: "Third",
      moduleId: course.modules.advanced.id,
      moduleTitle: "Advanced",
    });

    const third = await loadFull(course, { lessonId: course.lessons.third.id });
    expect(third.nextLesson).toBeNull();
  });

  it("renders the lesson's Markdown, and gives null when there is none", async () => {
    const course = setUpCourse();
    expect((await loadFull(course)).contentHtml).toContain("<h1");
    const second = await loadFull(course, {
      lessonId: course.lessons.second.id,
    });
    expect(second.contentHtml).toBeNull();
  });

  it("shows a locked page without the lesson's content", async () => {
    const course = setUpCourse();
    const page = await course.viewer.loadPage(
      pageRequest(course, {
        view: { allowed: false, reason: { kind: "signed-out" } },
        currentUserId: null,
        enrolled: false,
      })
    );
    expect(page).toEqual({
      view: "locked",
      course: expect.objectContaining({ id: course.base.course.id }),
      curriculum: expect.any(Array),
      module: { id: course.modules.basics.id, title: "Basics" },
      lesson: { id: course.lessons.first.id, title: "First" },
      enrolled: false,
      lockedReason: { kind: "signed-out" },
    });
  });

  it("names the instructor, so the discussion can say who answers", async () => {
    const course = setUpCourse();
    expect((await loadFull(course)).instructorName).toBe("Test Instructor");
    const missing = await loadFull(course, {
      course: { id: course.base.course.id, instructorId: 9999 },
    });
    expect(missing.instructorName).toBe("your instructor");
  });

  it("passes the moderation decision through", async () => {
    const course = setUpCourse();
    expect((await loadFull(course)).canModerate).toBe(false);
    expect((await loadFull(course, { canModerate: true })).canModerate).toBe(
      true
    );
  });
});

describe("the Student's own Bookmark and Note", () => {
  it("are empty for a signed-out visitor", async () => {
    const course = setUpCourse();
    const page = await loadFull(course, { currentUserId: null });
    expect(page.bookmarked).toBe(false);
    expect(page.note).toBeNull();
    expect(page.currentUserId).toBeNull();
  });

  it("show the Student's saved Note and Bookmark", async () => {
    const course = setUpCourse();
    const { db, base, lessons } = course;
    saveNote(db, base.user.id, lessons.first.id, "Remember this", NOW);
    toggleBookmark(db, base.user.id, lessons.first.id, NOW);

    const page = await loadFull(course);
    expect(page.bookmarked).toBe(true);
    expect(page.note).toEqual({
      body: "Remember this",
      updatedAt: NOW.toISOString(),
    });
  });
});

describe("the quiz on the page", () => {
  it("is null when the lesson has no quiz", async () => {
    const course = setUpCourse();
    const page = await loadFull(course);
    expect(page.quiz).toBeNull();
    expect(page.bestAttempt).toBeNull();
  });

  it("orders questions and never sends which option is correct", async () => {
    const course = setUpCourse();
    const { quiz, q1, q2, options } = addQuiz(
      course.db,
      course.lessons.first.id
    );
    const page = await loadFull(course);
    expect(page.quiz).toEqual({
      id: quiz.id,
      title: "Check",
      passingScore: 0.7,
      questions: [
        {
          id: q1.id,
          questionText: "Pick B",
          questionType: schema.QuestionType.MultipleChoice,
          position: 1,
          options: [
            { id: options.a.id, optionText: "A" },
            { id: options.b.id, optionText: "B" },
          ],
        },
        expect.objectContaining({ id: q2.id, position: 2 }),
      ],
    });
  });

  it("shows the Student's best attempt", async () => {
    const course = setUpCourse();
    const { quiz, q1, q2, options } = addQuiz(
      course.db,
      course.lessons.first.id
    );
    const userId = course.base.user.id;
    course.viewer.submitQuiz({
      userId,
      quizId: quiz.id,
      answers: { [q1.id]: options.a.id },
    });
    course.viewer.submitQuiz({
      userId,
      quizId: quiz.id,
      answers: { [q1.id]: options.b.id, [q2.id]: options.yes.id },
    });
    course.viewer.submitQuiz({ userId, quizId: quiz.id, answers: {} });

    expect((await loadFull(course)).bestAttempt).toEqual({
      score: 1,
      passed: true,
    });
    const visitor = await loadFull(course, { currentUserId: null });
    expect(visitor.bestAttempt).toBeNull();
  });
});

describe("progress on the page", () => {
  it("starts the lesson when a Student who can take it opens it", async () => {
    const course = setUpCourse();
    const page = await loadFull(course);
    expect(page.lessonStatus).toBe(LessonProgressStatus.InProgress);
    expect(page.lessonProgressMap).toEqual({
      [course.lessons.first.id]: LessonProgressStatus.InProgress,
    });
  });

  it("records nothing for someone who can view but not take", async () => {
    const course = setUpCourse();
    const page = await loadFull(course, { canTake: false });
    expect(page.lessonStatus).toBeNull();
    expect(page.lessonProgressMap).toEqual({});
    const rows = course.db.select().from(schema.lessonProgress).all();
    expect(rows).toHaveLength(0);
  });

  it("records nothing for a signed-out visitor", async () => {
    const course = setUpCourse();
    const page = await loadFull(course, { currentUserId: null });
    expect(page.lessonStatus).toBeNull();
  });
});
