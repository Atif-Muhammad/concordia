import { describe, it, expect } from "vitest";
import { resolveFileUrl } from "@/lib/utils";

describe("Profile Image and URL Resolution", () => {
  it("resolves undefined, null, or empty string to empty string", () => {
    expect(resolveFileUrl("")).toBe("");
    expect(resolveFileUrl(null)).toBe("");
    expect(resolveFileUrl(undefined)).toBe("");
  });

  it("leaves external and blob/data URLs untouched", () => {
    expect(resolveFileUrl("http://localhost:3003/profile/students/123/image.png"))
      .toBe("http://localhost:3003/profile/students/123/image.png");
    expect(resolveFileUrl("https://example.com/photo.jpg"))
      .toBe("https://example.com/photo.jpg");
    expect(resolveFileUrl("blob:http://localhost:5173/uuid-1234"))
      .toBe("blob:http://localhost:5173/uuid-1234");
    expect(resolveFileUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="))
      .toBe("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==");
  });

  it("ensures relative profile URLs have a leading slash", () => {
    expect(resolveFileUrl("/profile/students/66f000000000000000000001/image.png"))
      .toBe("/profile/students/66f000000000000000000001/image.png");
    expect(resolveFileUrl("profile/students/66f000000000000000000001/image.png"))
      .toBe("/profile/students/66f000000000000000000001/image.png");
    expect(resolveFileUrl("/profile/staff/T-0001/image.jpeg"))
      .toBe("/profile/staff/T-0001/image.jpeg");
    expect(resolveFileUrl("profile/staff/T-0001/image.jpeg"))
      .toBe("/profile/staff/T-0001/image.jpeg");
  });
});
