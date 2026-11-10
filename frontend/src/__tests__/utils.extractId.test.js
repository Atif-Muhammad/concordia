import { describe, it, expect } from "vitest";
import { extractId } from "../lib/utils.jsx";

describe("extractId utility tests", () => {
  it("returns empty string for null, undefined, and empty string", () => {
    expect(extractId(null)).toBe("");
    expect(extractId(undefined)).toBe("");
    expect(extractId("")).toBe("");
  });

  it("filters out '[object Object]', 'undefined', and 'null' strings", () => {
    expect(extractId("[object Object]")).toBe("");
    expect(extractId("undefined")).toBe("");
    expect(extractId("null")).toBe("");
  });

  it("extracts id from objects with _id or id", () => {
    expect(extractId({ _id: "60c72b2f9b1d8b2badbee123" })).toBe("60c72b2f9b1d8b2badbee123");
    expect(extractId({ id: "60c72b2f9b1d8b2badbee456" })).toBe("60c72b2f9b1d8b2badbee456");
  });

  it("handles nested object in _id", () => {
    expect(extractId({ _id: { _id: "60c72b2f9b1d8b2badbee789" } })).toBe("60c72b2f9b1d8b2badbee789");
  });

  it("returns empty string if object stringifies to [object Object]", () => {
    expect(extractId({ otherKey: "val" })).toBe("");
  });

  it("returns trimmed string for valid string IDs", () => {
    expect(extractId(" 60c72b2f9b1d8b2badbee123 ")).toBe("60c72b2f9b1d8b2badbee123");
  });
});
