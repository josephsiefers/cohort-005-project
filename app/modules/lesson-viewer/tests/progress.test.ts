import { describe, it, expect } from "vitest";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { NOW, loadFull, setUpCourse, type Course } from "./fixtures";

function progressRows(course: Course) {
  return course.db.select().from(schema.lessonProgress).all();
}

function watch(course: Course, positionSeconds: number, createdAt: string) {
  course.db
    .insert(schema.videoWatchEvents)
    .values({
      userId: course.base.user.id,
      lessonId: course.lessons.first.id,
      eventType: "progress",
      positionSeconds,
      createdAt,
    })
    .run();
}

describe("marking a lesson complete", () => {
  it("completes a lesson the Student never opened", () => {
    const course = setUpCourse();
    course.viewer.markComplete(
      course.base.user.id,
      course.lessons.second.id,
      NOW
    );
    expect(progressRows(course)).toEqual([
      expect.objectContaining({
        userId: course.base.user.id,
        lessonId: course.lessons.second.id,
        status: LessonProgressStatus.Completed,
        completedAt: NOW.toISOString(),
      }),
    ]);
  });

  it("completes a started lesson without adding a second row", async () => {
    const course = setUpCourse();
    await loadFull(course);
    course.viewer.markComplete(
      course.base.user.id,
      course.lessons.first.id,
      NOW
    );
    const rows = progressRows(course);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: LessonProgressStatus.Completed,
      completedAt: NOW.toISOString(),
    });
  });

  it("stays complete when the Student opens the lesson again", async () => {
    const course = setUpCourse();
    course.viewer.markComplete(
      course.base.user.id,
      course.lessons.first.id,
      NOW
    );
    const page = await loadFull(course);
    expect(page.lessonStatus).toBe(LessonProgressStatus.Completed);
    expect(progressRows(course)).toHaveLength(1);
  });

  it("opening a started lesson again keeps one row", async () => {
    const course = setUpCourse();
    await loadFull(course);
    await loadFull(course);
    expect(progressRows(course)).toHaveLength(1);
  });
});

describe("the progress map", () => {
  it("holds every lesson the Student has started in this course only", async () => {
    const course = setUpCourse();
    const { db, base, lessons } = course;
    course.viewer.markComplete(base.user.id, lessons.third.id, NOW);

    const otherCourse = db
      .insert(schema.courses)
      .values({
        title: "Other",
        slug: "other",
        description: "",
        salesCopy: markdown(""),
        status: schema.CourseStatus.Published,
        instructorId: base.instructor.id,
        categoryId: base.category.id,
      })
      .returning()
      .get();
    const otherModule = db
      .insert(schema.modules)
      .values({ courseId: otherCourse.id, title: "M", position: 1 })
      .returning()
      .get();
    const elsewhere = db
      .insert(schema.lessons)
      .values({ moduleId: otherModule.id, title: "Elsewhere", position: 1 })
      .returning()
      .get();
    course.viewer.markComplete(base.user.id, elsewhere.id, NOW);

    const page = await loadFull(course);
    expect(page.lessonProgressMap).toEqual({
      [lessons.first.id]: LessonProgressStatus.InProgress,
      [lessons.third.id]: LessonProgressStatus.Completed,
    });
  });
});

describe("the video watch state", () => {
  it("starts at zero with no watch events", async () => {
    const course = setUpCourse();
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(0);
    expect(page.watchProgress).toBe(0);
  });

  it("resumes from the latest position and reports the furthest reached", async () => {
    const course = setUpCourse();
    watch(course, 300, "2026-11-19T10:00:00.000Z");
    watch(course, 120, "2026-11-19T11:00:00.000Z");
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(120);
    // 300s of a 10-minute video.
    expect(page.watchProgress).toBe(50);
  });

  it("caps progress at 100%", async () => {
    const course = setUpCourse();
    watch(course, 900, "2026-11-19T10:00:00.000Z");
    expect((await loadFull(course)).watchProgress).toBe(100);
  });

  it("reports no progress for a video with no duration", async () => {
    const course = setUpCourse();
    course.db.update(schema.lessons).set({ durationMinutes: null }).run();
    watch(course, 60, "2026-11-19T10:00:00.000Z");
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(60);
    expect(page.watchProgress).toBe(0);
  });

  it("starts at zero for a video with no duration and no watch events", async () => {
    const course = setUpCourse();
    course.db.update(schema.lessons).set({ durationMinutes: null }).run();
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(0);
    expect(page.watchProgress).toBe(0);
  });

  it("ignores watch events for a lesson with no video", async () => {
    const course = setUpCourse();
    course.db.update(schema.lessons).set({ videoUrl: null }).run();
    watch(course, 300, "2026-11-19T10:00:00.000Z");
    const page = await loadFull(course);
    expect(page.lastWatchPosition).toBe(0);
    expect(page.watchProgress).toBe(0);
  });
});
