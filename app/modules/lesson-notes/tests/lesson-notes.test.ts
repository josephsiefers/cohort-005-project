import { describe, it, expect } from "vitest";
import { noteDraft } from "../index";

const LIMIT = 2000;

describe("noteDraft", () => {
  it("counts the characters against the note limit", () => {
    const draft = noteDraft("hello", null);
    expect(draft.length).toBe(5);
    expect(draft.limit).toBe(LIMIT);
    expect(draft.tooLong).toBe(false);
  });

  it("lets a Student save new text", () => {
    expect(noteDraft("first thought", null).canSave).toBe(true);
    expect(noteDraft("edited", "original").canSave).toBe(true);
  });

  it("does not save an empty or whitespace-only note", () => {
    expect(noteDraft("", null).canSave).toBe(false);
    expect(noteDraft("   \n ", null).canSave).toBe(false);
  });

  it("does not save a note that matches the saved one", () => {
    const draft = noteDraft("same", "same");
    expect(draft.unchanged).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("treats no saved note as an empty one", () => {
    expect(noteDraft("", null).unchanged).toBe(true);
    expect(noteDraft("x", null).unchanged).toBe(false);
  });

  it("allows a note exactly at the limit and refuses one over it", () => {
    const atLimit = noteDraft("a".repeat(LIMIT), null);
    expect(atLimit.tooLong).toBe(false);
    expect(atLimit.canSave).toBe(true);

    const over = noteDraft("a".repeat(LIMIT + 1), null);
    expect(over.tooLong).toBe(true);
    expect(over.canSave).toBe(false);
  });
});
