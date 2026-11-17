import type { ReactNode } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/saved";
import { db } from "~/db";
import { requireUserId } from "~/lib/access.server";
import { listBookmarks, listNotes } from "~/lib/bookmarks-and-notes.server";
import { Card, CardContent } from "~/components/ui/card";
import { Bookmark, NotebookPen } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved — Cadence" },
    { name: "description", content: "Your bookmarks and notes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);

  // Only the signed-in Student's own rows, newest first.
  return {
    bookmarks: listBookmarks(db, userId),
    notes: listNotes(db, userId),
  };
}

export default function Saved({ loaderData }: Route.ComponentProps) {
  const { bookmarks, notes } = loaderData;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">
          The lessons you flagged, and what you wrote about them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SavedList
          title="Bookmarks"
          icon={<Bookmark className="size-4 text-muted-foreground" />}
          emptyText="No bookmarks yet."
          rows={bookmarks}
        />
        <SavedList
          title="Notes"
          icon={<NotebookPen className="size-4 text-muted-foreground" />}
          emptyText="No notes yet."
          rows={notes}
          renderDetail={(note) => (
            <>
              <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              <p
                suppressHydrationWarning
                className="text-xs text-muted-foreground"
              >
                Edited {formatRelativeTime(note.updatedAt)}
              </p>
            </>
          )}
        />
      </div>
    </div>
  );
}

type LessonRow = {
  id: number;
  lessonId: number;
  lessonTitle: string;
  moduleTitle: string;
  courseTitle: string;
  courseSlug: string;
};

// One column of the Saved page: each row links to its Lesson and names its
// Course, with optional detail underneath.
function SavedList<Row extends LessonRow>({
  title,
  icon,
  emptyText,
  rows,
  renderDetail,
}: {
  title: string;
  icon: ReactNode;
  emptyText: string;
  rows: Row[];
  renderDetail?: (row: Row) => ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-1 py-3">
                <Link
                  to={`/courses/${row.courseSlug}/lessons/${row.lessonId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {row.lessonTitle}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.courseTitle} · {row.moduleTitle}
                </p>
                {renderDetail?.(row)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
