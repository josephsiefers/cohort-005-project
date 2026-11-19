import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  limit: number;
  tooLong: boolean;
  unchanged: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string | null
): NoteDraft {
  // The action trims before it checks the limit and saves, so judge the same
  // text it will store.
  const text = draft.trim();
  const tooLong = text.length > MAX_NOTE_LENGTH;
  const unchanged = text === (savedBody ?? "");
  return {
    length: text.length,
    limit: MAX_NOTE_LENGTH,
    tooLong,
    unchanged,
    canSave: !tooLong && text.length > 0 && !unchanged,
  };
}
