import { describe, it, expect } from "vitest";
import { isApprovalSubmodule } from "../staff/StaffDirectoryTab";
import { hasPermission } from "../../lib/navigation";

describe("Leave Approvals Permission Logic", () => {
  describe("isApprovalSubmodule helper", () => {
    it("returns true for HR & Payroll leaves", () => {
      expect(isApprovalSubmodule("HR & Payroll", "leaves")).toBe(true);
    });

    it("returns true for Finance expense", () => {
      expect(isApprovalSubmodule("Finance", "expense")).toBe(true);
    });

    it("returns false for non-approval submodules", () => {
      expect(isApprovalSubmodule("HR & Payroll", "payroll")).toBe(false);
      expect(isApprovalSubmodule("HR & Payroll", "attendance")).toBe(false);
      expect(isApprovalSubmodule("Fee Management", "challans")).toBe(false);
      expect(isApprovalSubmodule("Students", "active")).toBe(false);
      expect(isApprovalSubmodule("Academics", "classes")).toBe(false);
    });
  });

  describe("hasPermission for leaves approvals", () => {
    it("allows Super Admin to approve leaves regardless of permissions", () => {
      const superAdminUser = { role: "SUPER_ADMIN" };
      expect(hasPermission(superAdminUser, "HR & Payroll", "leaves", "approvals")).toBe(true);
      expect(hasPermission(superAdminUser, "HR & Payroll", "leaves", "approve")).toBe(true);
    });

    it("allows user with permissions.all = true to approve leaves", () => {
      const allPermUser = { role: "Staff", permissions: { all: true } };
      expect(hasPermission(allPermUser, "HR & Payroll", "leaves", "approvals")).toBe(true);
    });

    it("allows staff with explicit leaves approvals permission", () => {
      const staffUser = {
        role: "Staff",
        permissions: {
          actions: {
            "HR & Payroll": {
              leaves: {
                read: true,
                create: false,
                update: false,
                delete: false,
                approvals: true,
                approve: true,
              },
            },
          },
        },
      };

      expect(hasPermission(staffUser, "HR & Payroll", "leaves", "approvals")).toBe(true);
      expect(hasPermission(staffUser, "HR & Payroll", "leaves", "approve")).toBe(true);
      expect(hasPermission(staffUser, "HR & Payroll", "leaves", "create")).toBe(false);
    });

    it("denies staff without leaves approvals permission even if they have update", () => {
      const regularEditor = {
        role: "Staff",
        permissions: {
          actions: {
            "HR & Payroll": {
              leaves: {
                read: true,
                create: true,
                update: true,
                delete: false,
                approvals: false,
                approve: false,
              },
            },
          },
        },
      };

      expect(hasPermission(regularEditor, "HR & Payroll", "leaves", "approvals")).toBe(false);
      expect(hasPermission(regularEditor, "HR & Payroll", "leaves", "approve")).toBe(false);
      expect(hasPermission(regularEditor, "HR & Payroll", "leaves", "update")).toBe(true);
    });

    it("denies access if permissions or user is missing", () => {
      expect(hasPermission(null, "HR & Payroll", "leaves", "approvals")).toBe(false);
      expect(hasPermission({}, "HR & Payroll", "leaves", "approvals")).toBe(false);
    });
  });
});
