import { describe, it, expect } from "vitest";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { loadFull, setUpCourse, type Course } from "./fixtures";

type Post = {
  userId?: number;
  parentId?: number;
  body?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  lessonId?: number;
};

function post(course: Course, values: Post) {
  return course.db
    .insert(schema.comments)
    .values({
      lessonId: course.lessons.first.id,
      userId: course.base.user.id,
      ...values,
      body: markdown(values.body ?? "A question"),
    })
    .returning()
    .get();
}

describe("the discussion thread", () => {
  it("nests replies under questions, oldest first, rendered to HTML", async () => {
    const course = setUpCourse();
    const later = post(course, {
      body: "Second **question**",
      createdAt: "2026-11-19T11:00:00Z",
    });
    const earlier = post(course, {
      body: "First",
      createdAt: "2026-11-19T10:00:00Z",
    });
    const reply = post(course, {
      userId: course.base.instructor.id,
      parentId: earlier.id,
      body: "An answer",
      createdAt: "2026-11-19T12:00:00Z",
      editedAt: "2026-11-19T12:30:00Z",
    });

    const { comments } = await loadFull(course);
    expect(comments.map((c) => c.id)).toEqual([earlier.id, later.id]);
    expect(comments[1].bodyHtml).toContain("<strong>question</strong>");
    expect(comments[0].replies).toEqual([
      expect.objectContaining({
        id: reply.id,
        body: "An answer",
        editedAt: "2026-11-19T12:30:00Z",
        deleted: false,
        replies: [],
        author: {
          id: course.base.instructor.id,
          name: "Test Instructor",
          avatarUrl: null,
          isInstructor: true,
          isPlatformAdmin: false,
        },
      }),
    ]);
    expect(comments[0].author.isInstructor).toBe(false);
  });

  it("marks a Platform Admin's post", async () => {
    const course = setUpCourse();
    const admin = course.db
      .insert(schema.users)
      .values({ name: "Admin", email: "a@example.com", role: UserRole.Admin })
      .returning()
      .get();
    post(course, { userId: admin.id, createdAt: "2026-11-19T10:00:00Z" });
    const { comments } = await loadFull(course);
    expect(comments[0].author.isPlatformAdmin).toBe(true);
  });

  it("keeps a deleted question with replies, blanked, and drops deleted replies", async () => {
    const course = setUpCourse();
    const question = post(course, {
      body: "Secret",
      createdAt: "2026-11-19T10:00:00Z",
      editedAt: "2026-11-19T10:05:00Z",
      deletedAt: "2026-11-19T10:10:00Z",
    });
    post(course, {
      parentId: question.id,
      body: "Kept",
      createdAt: "2026-11-19T11:00:00Z",
    });
    post(course, {
      parentId: question.id,
      body: "Gone",
      createdAt: "2026-11-19T12:00:00Z",
      deletedAt: "2026-11-19T12:10:00Z",
    });

    const { comments } = await loadFull(course);
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      deleted: true,
      body: "",
      bodyHtml: "",
      editedAt: null,
    });
    expect(comments[0].replies.map((r) => r.body)).toEqual(["Kept"]);
  });

  it("drops a deleted question with no replies", async () => {
    const course = setUpCourse();
    post(course, {
      createdAt: "2026-11-19T10:00:00Z",
      deletedAt: "2026-11-19T10:10:00Z",
    });
    expect((await loadFull(course)).comments).toEqual([]);
  });

  it("nests one level only, dropping a reply to a reply", async () => {
    const course = setUpCourse();
    const question = post(course, { createdAt: "2026-11-19T10:00:00Z" });
    const reply = post(course, {
      parentId: question.id,
      createdAt: "2026-11-19T11:00:00Z",
    });
    post(course, { parentId: reply.id, createdAt: "2026-11-19T12:00:00Z" });

    const { comments } = await loadFull(course);
    expect(comments).toHaveLength(1);
    expect(comments[0].replies.map((r) => r.id)).toEqual([reply.id]);
  });

  it("shows only this lesson's comments", async () => {
    const course = setUpCourse();
    post(course, {
      lessonId: course.lessons.second.id,
      createdAt: "2026-11-19T10:00:00Z",
    });
    expect((await loadFull(course)).comments).toEqual([]);
  });
});

describe("scoping a comment to the lesson", () => {
  it("finds a comment on this lesson and refuses one on another", () => {
    const course = setUpCourse();
    const here = post(course, { createdAt: "2026-11-19T10:00:00Z" });
    const there = post(course, {
      lessonId: course.lessons.second.id,
      createdAt: "2026-11-19T10:00:00Z",
    });
    const lessonId = course.lessons.first.id;
    expect(course.viewer.isCommentOnLesson(here.id, lessonId)).toBe(true);
    expect(course.viewer.isCommentOnLesson(there.id, lessonId)).toBe(false);
    expect(course.viewer.isCommentOnLesson(9999, lessonId)).toBe(false);
  });
});
