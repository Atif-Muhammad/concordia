import { describe, expect, it } from "vitest";
import {
  formatCnic,
  validateCnic,
  validateEmail,
  validateImageFile,
  validatePkPhone,
} from "@/lib/inputValidation";

describe("input validation utilities", () => {
  it("formats CNIC digits while typing", () => {
    expect(formatCnic("1234")).toBe("1234");
    expect(formatCnic("12345678")).toBe("12345-678");
    expect(formatCnic("1234567890123")).toBe("12345-6789012-3");
    expect(formatCnic("12345-6789012-399")).toBe("12345-6789012-3");
  });

  it("validates CNIC/Form-B values", () => {
    expect(validateCnic("12345-6789012-3")).toBe("");
    expect(validateCnic("1234567890123")).toBe("");
    expect(validateCnic("12345")).toContain("CNIC");
  });

  it("validates email values", () => {
    expect(validateEmail("admin@example.com")).toBe("");
    expect(validateEmail("not-an-email")).toContain("valid email");
  });

  it("validates Pakistan mobile and landline phone values", () => {
    expect(validatePkPhone("0300-1234567")).toBe("");
    expect(validatePkPhone("+923001234567")).toBe("");
    expect(validatePkPhone("091-5619915")).toBe("");
    expect(validatePkPhone("123")).toContain("Pakistan number");
  });

  it("validates image upload type and size", () => {
    expect(validateImageFile(new File(["x"], "photo.png", { type: "image/png" }))).toBe("");
    expect(validateImageFile(new File(["x"], "photo.jpg", { type: "image/jpeg" }))).toBe("");
    expect(validateImageFile(new File(["x"], "photo.gif", { type: "image/gif" }))).toContain("PNG");

    const largeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "photo.jpeg", { type: "image/jpeg" });
    expect(validateImageFile(largeFile)).toContain("10 MB");
  });
});
