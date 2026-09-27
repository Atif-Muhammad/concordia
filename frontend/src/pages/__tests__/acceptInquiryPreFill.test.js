import { describe, it, expect } from "vitest";

// Pure helper function reflecting handleAcceptInquiry logic in InquiryTab
function extractStudentFormDataFromInquiry(inquiry, academicSessions = [], programs = []) {
  const nameParts = (inquiry.studentName || "").trim().split(/\s+/);
  const fName = nameParts[0] || inquiry.studentName || "";
  const lName = nameParts.slice(1).join(" ");

  const programId =
    (typeof inquiry.programInterest === "object" && inquiry.programInterest !== null
      ? (inquiry.programInterest._id || inquiry.programInterest.id)?.toString()
      : typeof inquiry.programInterest === "string"
      ? inquiry.programInterest
      : "") ||
    (typeof inquiry.program === "object" && inquiry.program !== null
      ? (inquiry.program._id || inquiry.program.id)?.toString()
      : typeof inquiry.program === "string"
      ? inquiry.program
      : "") ||
    "";

  const sessionId =
    (typeof inquiry.sessionId === "object" && inquiry.sessionId !== null
      ? (inquiry.sessionId._id || inquiry.sessionId.id)?.toString()
      : typeof inquiry.sessionId === "string"
      ? inquiry.sessionId
      : "") ||
    (typeof inquiry.session === "object" && inquiry.session !== null
      ? (inquiry.session._id || inquiry.session.id)?.toString()
      : typeof inquiry.session === "string"
      ? inquiry.session
      : "") ||
    "";

  const sessionName =
    (typeof inquiry.sessionId === "object" && inquiry.sessionId !== null
      ? inquiry.sessionId.name
      : "") ||
    (typeof inquiry.session === "object" && inquiry.session !== null
      ? inquiry.session.name
      : typeof inquiry.session === "string"
      ? inquiry.session
      : "") ||
    academicSessions?.find(
      (s) => String(s.id || s._id) === String(sessionId)
    )?.name ||
    "";

  let gender = inquiry.gender || "";
  if (gender) {
    const gLower = gender.trim().toLowerCase();
    if (gLower === "male") gender = "Male";
    else if (gLower === "female") gender = "Female";
    else if (gLower === "other") gender = "Other";
  }

  let dob = "";
  if (inquiry.dob) {
    try {
      dob = new Date(inquiry.dob).toISOString().split("T")[0];
    } catch {
      dob = String(inquiry.dob).split("T")[0];
    }
  }

  const classId =
    (typeof inquiry.classId === "object" && inquiry.classId !== null
      ? (inquiry.classId._id || inquiry.classId.id)?.toString()
      : typeof inquiry.classId === "string"
      ? inquiry.classId
      : "") ||
    (typeof inquiry.class === "object" && inquiry.class !== null
      ? (inquiry.class._id || inquiry.class.id)?.toString()
      : "") ||
    "";

  const sectionId =
    (typeof inquiry.sectionId === "object" && inquiry.sectionId !== null
      ? (inquiry.sectionId._id || inquiry.sectionId.id)?.toString()
      : typeof inquiry.sectionId === "string"
      ? inquiry.sectionId
      : "") ||
    (typeof inquiry.section === "object" && inquiry.section !== null
      ? (inquiry.section._id || inquiry.section.id)?.toString()
      : "") ||
    "";

  return {
    fName,
    lName,
    fatherOrguardian: inquiry.fatherName || inquiry.fatherOrguardian || "",
    rollNumber: "",
    parentOrGuardianEmail: inquiry.email || inquiry.parentOrGuardianEmail || "",
    parentOrGuardianPhone:
      inquiry.contactNumber || inquiry.parentOrGuardianPhone || inquiry.phone || "",
    parentCNIC: inquiry.fatherCnic || inquiry.parentCNIC || inquiry.parentCnic || "",
    studentCnic: inquiry.studentCnic || "",
    address: inquiry.address || "",
    programId,
    classId,
    sectionId,
    gender,
    dob,
    sessionId,
    session: sessionName,
    admissionDate: new Date().toISOString().split("T")[0],
    previousBoardName: inquiry.previousBoardName || inquiry.previousInstitute || "",
    previousBoardRollNumber: inquiry.previousBoardRollNumber || "",
    admissionFormNumber: inquiry.admissionFormNumber || inquiry.prospectusReceipt || "",
    documents: {
      fatherCnic: !!(inquiry.fatherCnic || inquiry.parentCNIC),
      address: !!inquiry.address,
      bForm: !!inquiry.studentCnic,
    },
  };
}

// Pure helper function for badge display in Accept Inquiry dialog header
function getProgramInterestedDisplay(inquiry, programs = []) {
  return (
    (typeof inquiry?.programInterest === "object" && inquiry?.programInterest?.name) ||
    inquiry?.program?.name ||
    programs?.find(
      (p) =>
        String(p.id || p._id) ===
        String(
          inquiry?.programInterest?._id ||
            inquiry?.programInterest?.id ||
            inquiry?.programInterest
        )
    )?.name ||
    "N/A"
  );
}

describe("Accept Inquiry - Pre-fill Student Form Logic", () => {
  const sampleAcademicSessions = [
    { id: "6501a1b2c3d4e5f6001", name: "2024-2026", isActive: true },
    { id: "6501a1b2c3d4e5f6002", name: "2023-2025", isActive: false },
  ];

  const samplePrograms = [
    {
      id: "6502a1b2c3d4e5f6010",
      name: "FSC Pre-Engineering",
      rollPrefix: "PE",
    },
    {
      id: "6502a1b2c3d4e5f6020",
      name: "ICS (Computer Science)",
      rollPrefix: "ICS",
    },
  ];

  it("correctly extracts programId and sessionId from populated objects without returning [object Object]", () => {
    const populatedInquiry = {
      id: "inq-123",
      studentName: "Muhammad Ali",
      studentCnic: "35201-1234567-1",
      fatherName: "Ali Hassan",
      fatherCnic: "35201-7654321-1",
      contactNumber: "0300-1234567",
      email: "ali@example.com",
      address: "House 123, Street 4, Lahore",
      gender: "male",
      programInterest: {
        _id: "6502a1b2c3d4e5f6020",
        id: "6502a1b2c3d4e5f6020",
        name: "ICS (Computer Science)",
        rollPrefix: "ICS",
      },
      sessionId: {
        _id: "6501a1b2c3d4e5f6001",
        id: "6501a1b2c3d4e5f6001",
        name: "2024-2026",
      },
      previousInstitute: "Government High School",
      prospectusReceipt: "REC-9988",
    };

    const formData = extractStudentFormDataFromInquiry(
      populatedInquiry,
      sampleAcademicSessions,
      samplePrograms
    );

    expect(formData.programId).toBe("6502a1b2c3d4e5f6020");
    expect(formData.programId).not.toBe("[object Object]");
    expect(formData.sessionId).toBe("6501a1b2c3d4e5f6001");
    expect(formData.sessionId).not.toBe("[object Object]");
    expect(formData.session).toBe("2024-2026");
    expect(formData.fName).toBe("Muhammad");
    expect(formData.lName).toBe("Ali");
    expect(formData.fatherOrguardian).toBe("Ali Hassan");
    expect(formData.parentCNIC).toBe("35201-7654321-1");
    expect(formData.studentCnic).toBe("35201-1234567-1");
    expect(formData.parentOrGuardianPhone).toBe("0300-1234567");
    expect(formData.parentOrGuardianEmail).toBe("ali@example.com");
    expect(formData.address).toBe("House 123, Street 4, Lahore");
    expect(formData.gender).toBe("Male");
    expect(formData.previousBoardName).toBe("Government High School");
    expect(formData.admissionFormNumber).toBe("REC-9988");
    expect(formData.documents.fatherCnic).toBe(true);
    expect(formData.documents.address).toBe(true);
    expect(formData.documents.bForm).toBe(true);
  });

  it("correctly extracts string ID when programInterest and sessionId are plain string IDs", () => {
    const stringIdInquiry = {
      id: "inq-456",
      studentName: "Fatima Noor",
      fatherName: "Noor Alam",
      contactNumber: "0311-9876543",
      gender: "Female",
      programInterest: "6502a1b2c3d4e5f6010",
      sessionId: "6501a1b2c3d4e5f6002",
    };

    const formData = extractStudentFormDataFromInquiry(
      stringIdInquiry,
      sampleAcademicSessions,
      samplePrograms
    );

    expect(formData.programId).toBe("6502a1b2c3d4e5f6010");
    expect(formData.sessionId).toBe("6501a1b2c3d4e5f6002");
    expect(formData.session).toBe("2023-2025");
    expect(formData.fName).toBe("Fatima");
    expect(formData.lName).toBe("Noor");
    expect(formData.gender).toBe("Female");
  });

  it("normalizes gender to PascalCase ('male' -> 'Male', 'other' -> 'Other')", () => {
    const inquiryMale = { studentName: "Test", gender: "male" };
    const inquiryOther = { studentName: "Test", gender: "other" };
    expect(extractStudentFormDataFromInquiry(inquiryMale).gender).toBe("Male");
    expect(extractStudentFormDataFromInquiry(inquiryOther).gender).toBe("Other");
  });

  it("renders program interested badge cleanly with name instead of N/A", () => {
    // When programInterest is populated object
    const populated = {
      programInterest: {
        _id: "6502a1b2c3d4e5f6020",
        name: "ICS (Computer Science)",
      },
    };
    expect(getProgramInterestedDisplay(populated, samplePrograms)).toBe(
      "ICS (Computer Science)"
    );

    // When programInterest is raw ID string matching samplePrograms
    const unpopulated = {
      programInterest: "6502a1b2c3d4e5f6010",
    };
    expect(getProgramInterestedDisplay(unpopulated, samplePrograms)).toBe(
      "FSC Pre-Engineering"
    );

    // When inquiry has no program
    const empty = {};
    expect(getProgramInterestedDisplay(empty, samplePrograms)).toBe("N/A");
  });
});
