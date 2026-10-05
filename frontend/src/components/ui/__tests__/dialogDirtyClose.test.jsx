import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Pure helper function mirroring DialogContent's hasPartiallyFilledData logic
function hasFilledFormFields(fields = []) {
  return fields.some((field) => {
    if (field.readOnly || field.disabled || field.type === "hidden") return false;
    if (field.type === "checkbox" || field.type === "radio") {
      return Boolean(field.checked && !field.defaultChecked);
    }
    if (typeof field.value === "string") {
      return field.value.trim().length > 0;
    }
    return Boolean(field.value);
  });
}

describe("DialogContent unsaved changes UI validation", () => {
  it("ensures dialog.jsx contains all necessary unsaved changes warning components and handlers", () => {
    const dialogFilePath = path.resolve(__dirname, "../dialog.jsx");
    const content = fs.readFileSync(dialogFilePath, "utf-8");

    // Must import AlertDialog components and AlertTriangle
    expect(content).toContain("AlertDialog");
    expect(content).toContain("AlertDialogContent");
    expect(content).toContain("AlertDialogTitle");
    expect(content).toContain("AlertDialogDescription");
    expect(content).toContain("AlertDialogCancel");
    expect(content).toContain("AlertDialogAction");
    expect(content).toContain("AlertTriangle");

    // Must handle pointer down outside, interact outside, escape key, input, change, and X button
    expect(content).toContain("onPointerDownOutside");
    expect(content).toContain("onInteractOutside");
    expect(content).toContain("onEscapeKeyDown");
    expect(content).toContain("hasPartiallyFilledData");
    expect(content).toContain("Unsaved Changes");
    expect(
      content
    ).toContain(
      "You have unsaved changes in this form. If you close now, all the filled data will be lost."
    );
    expect(content).toContain("Confirm Close");
    expect(content).toContain("Cancel");
  });

  it("returns false when form fields are empty or untouched", () => {
    const fields = [
      { name: "fName", value: "" },
      { name: "lName", value: "   " },
      { name: "description", value: "" },
      { name: "gender", value: "" },
    ];
    expect(hasFilledFormFields(fields)).toBe(false);
  });

  it("detects partially filled text input", () => {
    const fields = [
      { name: "fName", value: "Hamza" },
      { name: "lName", value: "" },
    ];
    expect(hasFilledFormFields(fields)).toBe(true);
  });

  it("detects partially filled textarea", () => {
    const fields = [
      { name: "fName", value: "" },
      { name: "reason", value: "Medical leave for 3 days" },
    ];
    expect(hasFilledFormFields(fields)).toBe(true);
  });

  it("detects modified select dropdown value", () => {
    const fields = [
      { name: "departmentId", value: "dept_66f001" },
    ];
    expect(hasFilledFormFields(fields)).toBe(true);
  });

  it("ignores read-only, disabled, and hidden inputs", () => {
    const fields = [
      { name: "_id", value: "66f0001", type: "hidden" },
      { name: "code", value: "AUTO-001", readOnly: true },
      { name: "institute", value: "Concordia", disabled: true },
    ];
    expect(hasFilledFormFields(fields)).toBe(false);
  });

  it("detects toggled checkbox or radio input", () => {
    const fields = [
      { name: "isTeaching", type: "checkbox", checked: true, defaultChecked: false },
    ];
    expect(hasFilledFormFields(fields)).toBe(true);
  });
});
