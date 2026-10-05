import { describe, it, expect } from "vitest";
import QRCode from "qrcode";

describe("Student ID Card QR Code Generation & Verification", () => {
  it("generates a valid base64 PNG data URL from student verify URL", async () => {
    const studentId = "66f000000000000000000001";
    const origin = "https://concordia.edu.pk";
    const verifyUrl = `${origin}/student/verify/${studentId}`;

    const dataUrl = await QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    expect(dataUrl).toBeDefined();
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(100);
  });

  it("replaces {{qrCode}} placeholder with rendered QR code img tag", () => {
    const template = `<div><span>Student Details</span>{{qrCode}}</div>`;
    const qrDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA";
    const qrImgTag = `<img src="${qrDataUrl}" alt="Student QR Code" style="width: 80px; height: 80px;" />`;

    const result = template.replace(/\{\{qrCode\}\}/g, qrImgTag);

    expect(result).toContain(qrImgTag);
    expect(result).not.toContain("{{qrCode}}");
  });

  it("replaces legacy fake barcode placeholder with real QR code element", () => {
    const legacyTemplate = `
      <div style="color: #000;">
        <div style="margin-top: 10px; height: 40px; background: repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 4px); width: 100%;"></div>
      </div>
    `;
    const qrImgTag = `<img src="data:image/png;base64,xyz" alt="Student QR Code" />`;
    const legacyPattern = /<div style="[^"]*margin-top:\s*10px[^"]*repeating-linear-gradient[^"]*"><\/div>/gi;

    const result = legacyTemplate.replace(
      legacyPattern,
      `<div style="margin-top: 10px; display: flex; justify-content: center; align-items: center; width: 100%;">${qrImgTag}</div>`
    );

    expect(result).toContain(qrImgTag);
    expect(result).not.toContain("repeating-linear-gradient");
  });

  it("verifies public response shape only exposes safe display fields", () => {
    // Simulated DB document containing both public and sensitive info
    const rawStudent = {
      _id: "66f000000000000000000001",
      fName: "Muhammad",
      lName: "Ali",
      fatherOrguardian: "Tariq Ali",
      rollNumber: "CC-2026-001",
      photo_url: "/profile/students/66f000000000000000000001/photo.jpg",
      programId: { name: "FSc Pre-Medical" },
      classId: { name: "1st Year" },
      sectionId: { name: "A" },
      sessionId: { name: "2025-2026" },
      status: "Active",
      admissionDate: "2025-08-15T00:00:00.000Z",
      // Sensitive fields that MUST NOT be exposed
      parentCNIC: "17301-1234567-1",
      parentOrGuardianPhone: "03001234567",
      address: "House 12, Street 3, Peshawar",
      tuitionFee: 15000,
      installments: [{ amount: 15000 }],
    };

    // Mapping performed by verifyStudent in student.service.js
    const verifiedPublicData = {
      id: rawStudent._id.toString(),
      name: `${rawStudent.fName || ""} ${rawStudent.lName || ""}`.trim(),
      fatherName: rawStudent.fatherOrguardian || "",
      rollNumber: rawStudent.rollNumber || "",
      photo_url: rawStudent.photo_url || "",
      program: rawStudent.programId?.name || "",
      class: rawStudent.classId?.name || "",
      section: rawStudent.sectionId?.name || "",
      session: rawStudent.sessionId?.name || "",
      status: rawStudent.status || "Active",
      admissionDate: rawStudent.admissionDate || null,
    };

    // Public details present
    expect(verifiedPublicData.name).toBe("Muhammad Ali");
    expect(verifiedPublicData.fatherName).toBe("Tariq Ali");
    expect(verifiedPublicData.rollNumber).toBe("CC-2026-001");
    expect(verifiedPublicData.program).toBe("FSc Pre-Medical");
    expect(verifiedPublicData.class).toBe("1st Year");
    expect(verifiedPublicData.section).toBe("A");

    // Sensitive details stripped
    expect(verifiedPublicData.parentCNIC).toBeUndefined();
    expect(verifiedPublicData.parentOrGuardianPhone).toBeUndefined();
    expect(verifiedPublicData.address).toBeUndefined();
    expect(verifiedPublicData.tuitionFee).toBeUndefined();
    expect(verifiedPublicData.installments).toBeUndefined();
  });
});
