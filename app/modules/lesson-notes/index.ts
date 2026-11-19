import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the lesson note form shows about the text a Student is typing: how
 * long it is against the limit, and whether Save would do anything.
 * Save stays off for an empty note, because the action rejects one, and
 * for a note that matches what is already saved.
 */
export function noteDraft(draft: string, savedBody: string | null): NoteDraft {
  return describeDraft(draft, savedBody);
}
