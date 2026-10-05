import { describe, it, expect, vi } from "vitest";
import axios from "axios";
import * as apis from "../../../config/apis";
import fs from "fs";
import path from "path";

describe("TeacherProfile API architecture & logic", () => {
  it("exports getCurrentUser and getTeacherProfile from apis.js", () => {
    expect(typeof apis.getCurrentUser).toBe("function");
    expect(typeof apis.getTeacherProfile).toBe("function");
  });

  it("ensures TeacherProfile.jsx contains no hardcoded base_url and no direct axios calls", () => {
    const filePath = path.resolve(__dirname, "../teacher/TeacherProfile.jsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must not have hardcoded localhost base_url
    expect(content).not.toContain("localhost:3003");
    expect(content).not.toContain("const base_url");

    // Must not import axios directly
    expect(content).not.toMatch(/import\s+axios\s+from/);
    expect(content).not.toContain("axios.get");

    // Must import APIs from config/apis
    expect(content).toContain("getCurrentUser");
    expect(content).toContain("getTeacherProfile");
  });

  it("resolves staff profile by staffId via axios call", async () => {
    const mockStaff = { _id: "66f000000000000000000001", name: "Sir Tariq", email: "tariq@concordia.edu" };
    vi.spyOn(axios, "get").mockResolvedValueOnce({ data: mockStaff });

    const result = await apis.getTeacherProfile("66f000000000000000000001", "tariq@concordia.edu");
    expect(result).toEqual(mockStaff);
  });
});
