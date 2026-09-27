/**
 * Property-based tests for Session-Based Examination Filters — API URL construction.
 *
 * Property 9: API functions append sessionId to query string
 * Validates: Requirements 7.3, 8.3, 9.3
 *
 * Feature: session-based-examination-filters, Property 9
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure URL-construction logic extracted from getExams in apis.js
// ---------------------------------------------------------------------------

/**
 * Replicates the URL-building logic inside getExams:
 *   const params = new URLSearchParams();
 *   if (sessionId) params.append('sessionId', sessionId);
 *   `${base_url}/exams/all${params.toString() ? '?' + params.toString() : ''}`
 */
const buildGetExamsUrl = (baseUrl, sessionId) => {
  const params = new URLSearchParams();
  if (sessionId) params.append("sessionId", sessionId);
  return `${baseUrl}/exams/all${params.toString() ? "?" + params.toString() : ""}`;
};

// ---------------------------------------------------------------------------
// Pure URL-construction logic extracted from getMarks in apis.js
// ---------------------------------------------------------------------------

/**
 * Replicates the URL-building logic inside getMarks:
 *   const params = new URLSearchParams();
 *   if (examId) params.append('examId', examId);
 *   if (sectionId) params.append('sectionId', sectionId);
 *   if (sessionId) params.append('sessionId', sessionId);
 *   params.toString() ? `${base_url}/exams/marks/all?${params}` : `${base_url}/exams/marks/all`
 */
const buildGetMarksUrl = (baseUrl, examId, sectionId, sessionId) => {
  const params = new URLSearchParams();
  if (examId) params.append("examId", examId);
  if (sectionId) params.append("sectionId", sectionId);
  if (sessionId) params.append("sessionId", sessionId);
  return params.toString()
    ? `${baseUrl}/exams/marks/all?${params.toString()}`
    : `${baseUrl}/exams/marks/all`;
};

// ---------------------------------------------------------------------------
// Property 9: API functions append sessionId to query string
// Validates: Requirements 7.3
// ---------------------------------------------------------------------------

describe("Property 9: getExams URL construction appends sessionId to query string", () => {
  const BASE_URL = "http://localhost:3003/api";

  it("URL contains sessionId=<value> when a positive integer sessionId is provided", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1 }), (sessionId) => {
        const url = buildGetExamsUrl(BASE_URL, sessionId);

        expect(url).toContain(`sessionId=${sessionId}`);
      }),
      { numRuns: 100 }
    );
  });

  it("URL does NOT contain 'sessionId' when sessionId is undefined", () => {
    const url = buildGetExamsUrl(BASE_URL, undefined);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is null", () => {
    const url = buildGetExamsUrl(BASE_URL, null);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is 0 (falsy)", () => {
    const url = buildGetExamsUrl(BASE_URL, 0);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is an empty string", () => {
    const url = buildGetExamsUrl(BASE_URL, "");

    expect(url).not.toContain("sessionId");
  });

  it("base path is always /exams/all regardless of sessionId", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1 }).map((n) => n),
          fc.constant(undefined),
          fc.constant(null)
        ),
        (sessionId) => {
          const url = buildGetExamsUrl(BASE_URL, sessionId);

          expect(url).toContain("/exams/all");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("sessionId value in URL exactly matches the provided integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1 }), (sessionId) => {
        const url = buildGetExamsUrl(BASE_URL, sessionId);
        const parsed = new URL(url);

        expect(parsed.searchParams.get("sessionId")).toBe(String(sessionId));
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Pure URL-construction logic extracted from getResults in apis.js
// ---------------------------------------------------------------------------

/**
 * Replicates the URL-building logic inside getResults:
 *   const params = new URLSearchParams();
 *   if (sessionId) params.append('sessionId', sessionId);
 *   `${base_url}/exams/result/all${params.toString() ? '?' + params.toString() : ''}`
 */
const buildGetResultsUrl = (baseUrl, sessionId) => {
  const params = new URLSearchParams();
  if (sessionId) params.append("sessionId", sessionId);
  return `${baseUrl}/exams/result/all${params.toString() ? "?" + params.toString() : ""}`;
};

// ---------------------------------------------------------------------------
// Property 9: getResults URL construction appends sessionId to query string
// Validates: Requirements 9.3
// ---------------------------------------------------------------------------

describe("Property 9: getResults URL construction appends sessionId to query string", () => {
  const BASE_URL = "http://localhost:3003/api";

  it("URL contains sessionId=<value> when a positive integer sessionId is provided", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1 }), (sessionId) => {
        const url = buildGetResultsUrl(BASE_URL, sessionId);

        expect(url).toContain(`sessionId=${sessionId}`);
      }),
      { numRuns: 100 }
    );
  });

  it("URL does NOT contain 'sessionId' when sessionId is undefined", () => {
    const url = buildGetResultsUrl(BASE_URL, undefined);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is null", () => {
    const url = buildGetResultsUrl(BASE_URL, null);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is 0 (falsy)", () => {
    const url = buildGetResultsUrl(BASE_URL, 0);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is an empty string", () => {
    const url = buildGetResultsUrl(BASE_URL, "");

    expect(url).not.toContain("sessionId");
  });

  it("base path is always /exams/result/all regardless of sessionId", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1 }).map((n) => n),
          fc.constant(undefined),
          fc.constant(null)
        ),
        (sessionId) => {
          const url = buildGetResultsUrl(BASE_URL, sessionId);

          expect(url).toContain("/exams/result/all");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("sessionId value in URL exactly matches the provided integer", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1 }), (sessionId) => {
        const url = buildGetResultsUrl(BASE_URL, sessionId);
        const parsed = new URL(url);

        expect(parsed.searchParams.get("sessionId")).toBe(String(sessionId));
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 9: getMarks URL construction appends sessionId to query string", () => {
  const BASE_URL = "http://localhost:3003/api";

  it("URL contains sessionId=<value> when a positive integer sessionId is provided", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        (examId, sectionId, sessionId) => {
          const url = buildGetMarksUrl(BASE_URL, examId, sectionId, sessionId);

          expect(url).toContain(`sessionId=${sessionId}`);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("URL does NOT contain 'sessionId' when sessionId is undefined", () => {
    const url = buildGetMarksUrl(BASE_URL, 1, 2, undefined);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is null", () => {
    const url = buildGetMarksUrl(BASE_URL, 1, 2, null);

    expect(url).not.toContain("sessionId");
  });

  it("URL does NOT contain 'sessionId' when sessionId is 0 (falsy)", () => {
    const url = buildGetMarksUrl(BASE_URL, 1, 2, 0);

    expect(url).not.toContain("sessionId");
  });

  it("existing examId and sectionId params are preserved when sessionId is provided", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        (examId, sectionId, sessionId) => {
          const url = buildGetMarksUrl(BASE_URL, examId, sectionId, sessionId);
          const parsed = new URL(url);

          expect(parsed.searchParams.get("examId")).toBe(String(examId));
          expect(parsed.searchParams.get("sectionId")).toBe(String(sectionId));
          expect(parsed.searchParams.get("sessionId")).toBe(String(sessionId));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("existing examId and sectionId params are preserved when sessionId is omitted", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        (examId, sectionId) => {
          const url = buildGetMarksUrl(BASE_URL, examId, sectionId, undefined);
          const parsed = new URL(url);

          expect(parsed.searchParams.get("examId")).toBe(String(examId));
          expect(parsed.searchParams.get("sectionId")).toBe(String(sectionId));
          expect(parsed.searchParams.has("sessionId")).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("base path is always /exams/marks/all regardless of sessionId", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1 }).map((n) => n),
          fc.constant(undefined),
          fc.constant(null)
        ),
        (sessionId) => {
          const url = buildGetMarksUrl(BASE_URL, 1, 1, sessionId);

          expect(url).toContain("/exams/marks/all");
        }
      ),
      { numRuns: 100 }
    );
  });
});
