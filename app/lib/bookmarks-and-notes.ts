import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

// A Note body is plain text, trimmed, and refused (not truncated) over the cap.
// An empty body is allowed: saving one clears the Note.
export const noteBodySchema = z
  .string()
  .trim()
  .max(MAX_NOTE_LENGTH, {
    message: `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters.`,
  });
