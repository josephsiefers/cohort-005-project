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
  const tooLong = draft.length > MAX_NOTE_LENGTH;
  const empty = draft.trim().length === 0;
  const unchanged = draft === (savedBody ?? "");
  return {
    length: draft.length,
    limit: MAX_NOTE_LENGTH,
    tooLong,
    unchanged,
    canSave: !tooLong && !empty && !unchanged,
  };
}
