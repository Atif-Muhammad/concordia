const store = new Map();
const storageMock = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
Object.defineProperty(globalThis, "localStorage", {
  value: storageMock,
  writable: true,
  configurable: true,
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  isTeachingOnly,
  isDualRole,
  isNonTeachingOnly,
  getEffectiveNavModules,
  hasModuleAccess,
  getViewMode,
  TEACHER_NAV_MODULES,
} from "../../lib/navigation.jsx";

describe("Teacher View & Leave Application Navigation Logic", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  const teachingOnlyUser = {
    id: "user-teacher-1",
    name: "Teacher One",
    role: "Teacher",
    isTeaching: true,
    isNonTeaching: false,
    permissions: {},
  };

  const dualRoleUser = {
    id: "user-dual-1",
    name: "Dual Staff",
    role: "Dual",
    isTeaching: true,
    isNonTeaching: true,
    permissions: {},
  };

  const superAdminUser = {
    id: "user-admin-1",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    permissions: { all: true },
  };

  const nonTeachingUser = {
    id: "user-staff-1",
    name: "Staff Non-Teaching",
    role: "Staff",
    isTeaching: false,
    isNonTeaching: true,
    permissions: {},
  };

  it("identifies teaching-only staff vs dual-role and super admin correctly", () => {
    expect(isTeachingOnly(teachingOnlyUser)).toBe(true);
    expect(isTeachingOnly(dualRoleUser)).toBe(false);
    expect(isTeachingOnly(superAdminUser)).toBe(false);
    expect(isTeachingOnly(nonTeachingUser)).toBe(false);
    expect(isDualRole(dualRoleUser)).toBe(true);
    expect(isDualRole(teachingOnlyUser)).toBe(false);
    expect(isDualRole(nonTeachingUser)).toBe(false);
    expect(isNonTeachingOnly(nonTeachingUser)).toBe(true);
    expect(isNonTeachingOnly(teachingOnlyUser)).toBe(false);
    expect(isNonTeachingOnly(dualRoleUser)).toBe(false);
    expect(isNonTeachingOnly(superAdminUser)).toBe(false);
  });

  it("returns 'teacher' view mode for teaching-only staff regardless of localStorage", () => {
    localStorage.setItem("concordia_viewMode", "staff");
    expect(getViewMode(teachingOnlyUser)).toBe("teacher");
  });

  it("includes 'Leave Applications' in TEACHER_NAV_MODULES", () => {
    const leaveModule = TEACHER_NAV_MODULES.find((m) => m.label === "Leave Applications");
    expect(leaveModule).toBeDefined();
    expect(leaveModule.path).toBe("/teacher/leaves");
    expect(leaveModule.componentKey).toBe("TeacherLeaves");
  });

  it("getEffectiveNavModules returns TEACHER_NAV_MODULES for teaching-only user", () => {
    const modules = getEffectiveNavModules(teachingOnlyUser);
    expect(modules).toEqual(TEACHER_NAV_MODULES);
    expect(modules.some((m) => m.label === "Leave Applications")).toBe(true);
  });

  it("grants access to 'Leave Applications' and teacher portal modules for teaching-only staff", () => {
    expect(hasModuleAccess(teachingOnlyUser, "Leave Applications")).toBe(true);
    expect(hasModuleAccess(teachingOnlyUser, "Teacher Dashboard")).toBe(true);
    expect(hasModuleAccess(teachingOnlyUser, "My Classes")).toBe(true);
    expect(hasModuleAccess(teachingOnlyUser, "Attendance")).toBe(true);
    expect(hasModuleAccess(teachingOnlyUser, "Examination")).toBe(true);
    expect(hasModuleAccess(teachingOnlyUser, "Complaints")).toBe(true);
  });

  it("allows dual-role staff to switch between views and access Leave Applications in teacher view", () => {
    localStorage.setItem("concordia_viewMode", "teacher");
    const teacherModules = getEffectiveNavModules(dualRoleUser);
    expect(teacherModules.some((m) => m.label === "Leave Applications")).toBe(true);

    localStorage.setItem("concordia_viewMode", "staff");
    const staffModules = getEffectiveNavModules(dualRoleUser);
    expect(staffModules.some((m) => m.label === "Teacher Dashboard")).toBe(false);
  });

  it("provides 'Leave Application' at '/leave-application' in nav modules for non-teaching staff", () => {
    const modules = getEffectiveNavModules(nonTeachingUser);
    const leaveModule = modules.find((m) => m.label === "Leave Application");
    expect(leaveModule).toBeDefined();
    expect(leaveModule.path).toBe("/leave-application");
    expect(leaveModule.componentKey).toBe("TeacherLeaves");
  });

  it("does not include '/leave-application' for dual-role staff in staff mode", () => {
    localStorage.setItem("concordia_viewMode", "staff");
    const staffModules = getEffectiveNavModules(dualRoleUser);
    expect(staffModules.some((m) => m.path === "/leave-application")).toBe(false);
  });

  it("grants access to 'Leave Application' for non-teaching staff", () => {
    expect(hasModuleAccess(nonTeachingUser, "Leave Application")).toBe(true);
    expect(hasModuleAccess(nonTeachingUser, "Leave Applications")).toBe(true);
  });

  it("hides 'Leave Application' from sidebar nav modules for super admin", () => {
    const modules = getEffectiveNavModules(superAdminUser);
    expect(modules.some((m) => m.label === "Leave Application" || m.path === "/leave-application")).toBe(false);
  });
});

