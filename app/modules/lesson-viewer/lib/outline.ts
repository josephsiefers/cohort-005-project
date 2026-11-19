import { eq, inArray } from "drizzle-orm";
import { courses, lessons, modules } from "~/db/schema";
import type { Db } from "./db";

export type OutlineLesson = {
  id: number;
  title: string;
  moduleId: number;
  moduleTitle: string;
};

/**
 * The course's modules and lessons in order: `curriculum` for the sidebar,
 * `lessons` flattened for previous and next.
 */
export function getCourseOutline(db: Db, courseId: number) {
  const course = db
    .select({ id: courses.id, title: courses.title, slug: courses.slug })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get();
  if (!course) return null;

  const courseModules = db
    .select({ id: modules.id, title: modules.title })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();

  const moduleIds = courseModules.map((m) => m.id);
  const courseLessons = db
    .select({
      id: lessons.id,
      title: lessons.title,
      moduleId: lessons.moduleId,
    })
    .from(lessons)
    .where(inArray(lessons.moduleId, moduleIds))
    .orderBy(lessons.position)
    .all();

  const curriculum = courseModules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    lessons: courseLessons
      .filter((l) => l.moduleId === mod.id)
      .map((l) => ({ id: l.id, title: l.title })),
  }));

  const flat: OutlineLesson[] = curriculum.flatMap((mod) =>
    mod.lessons.map((l) => ({
      id: l.id,
      title: l.title,
      moduleId: mod.id,
      moduleTitle: mod.title,
    }))
  );

  return { course, curriculum, lessons: flat };
}

export function neighbours(flat: OutlineLesson[], lessonId: number) {
  const index = flat.findIndex((l) => l.id === lessonId);
  return {
    prevLesson: index > 0 ? flat[index - 1] : null,
    nextLesson: index < flat.length - 1 ? flat[index + 1] : null,
  };
}

export function getLessonInModule(db: Db, lessonId: number) {
  const lesson = db
    .select()
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .get();
  if (!lesson) return null;
  const mod = db
    .select({ id: modules.id, title: modules.title })
    .from(modules)
    .where(eq(modules.id, lesson.moduleId))
    .get();
  return mod ? { lesson, mod } : null;
}
