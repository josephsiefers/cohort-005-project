import { and, asc, eq } from "drizzle-orm";
import { comments, users, UserRole } from "~/db/schema";
import type { RenderedComment } from "~/components/comment-thread";
import { renderComment } from "~/lib/comment-markdown.server";
import { markdown, type Markdown } from "~/lib/text";
import type { Db } from "./db";

type ThreadComment = Omit<RenderedComment, "body" | "bodyHtml" | "replies"> & {
  body: Markdown;
  replies: ThreadComment[];
};

function selectThreadRows(db: Db, lessonId: number) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();
}

type ThreadRow = ReturnType<typeof selectThreadRows>[number];

function toThreadComment(row: ThreadRow, instructorId: number): ThreadComment {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    body: deleted ? markdown("") : row.body,
    createdAt: row.createdAt,
    editedAt: deleted ? null : row.editedAt,
    deleted,
    author: {
      id: row.authorId,
      name: row.authorName,
      avatarUrl: row.authorAvatarUrl,
      isInstructor: row.authorId === instructorId,
      isPlatformAdmin: row.authorRole === UserRole.Admin,
    },
    replies: [],
  };
}

/** Questions with their replies nested one level, oldest first. */
export function getLessonThread(
  db: Db,
  lessonId: number,
  instructorId: number
): ThreadComment[] {
  const rows = selectThreadRows(db, lessonId);
  const topLevel: ThreadComment[] = [];
  const byId = new Map<number, ThreadComment>();

  for (const row of rows) {
    if (row.parentId !== null) continue;
    const comment = toThreadComment(row, instructorId);
    byId.set(comment.id, comment);
    topLevel.push(comment);
  }

  for (const row of rows) {
    if (row.parentId === null || row.deletedAt !== null) continue;
    byId.get(row.parentId)?.replies.push(toThreadComment(row, instructorId));
  }

  // A deleted question with no replies left has nothing worth showing.
  return topLevel.filter((c) => !c.deleted || c.replies.length > 0);
}

/**
 * Renders every comment body to sanitised HTML, preserving the reply nesting.
 * Comments are untrusted input, so this must be renderComment — never
 * renderMarkdown, which lets raw HTML through for trusted lesson content.
 */
export async function renderThread(
  nodes: ThreadComment[]
): Promise<RenderedComment[]> {
  return Promise.all(
    nodes.map(async (node) => ({
      ...node,
      bodyHtml: node.deleted ? "" : await renderComment(node.body),
      replies: await renderThread(node.replies),
    }))
  );
}

/** Scoped to the lesson so a comment elsewhere can't be reached through it. */
export function isCommentOnLesson(db: Db, commentId: number, lessonId: number) {
  const found = db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.lessonId, lessonId)))
    .get();
  return found !== undefined;
}
