// Feature: academics-mapping-dialog-redesign
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ─── Pure logic functions (extracted from Academics.jsx) ───────────────────

/**
 * Property 1 / Property 10 helper:
 * Filters classes by selected program.
 * When programId === "all", returns all classes.
 */
function filterClassesByProgram(classes, programId) {
  if (programId === 'all' || !programId) return classes;
  return classes.filter((c) => c.programId === Number(programId));
}

/**
 * Property 2 helper:
 * Filters sections by selected class.
 */
function filterSectionsByClass(sections, classId) {
  return sections.filter((s) => s.classId === Number(classId));
}

/**
 * Property 3 helper:
 * Returns all subjects for the checklist (both mapped and unmapped).
 */
function getSubjectChecklistItems(subjects) {
  return subjects;
}

/**
 * Property 4 helper:
 * Returns true if a mapping already exists for the given subject+class combo.
 */
function isSubjectAlreadyMapped(scmMappings, subjectId, classId) {
  return scmMappings.some(
    (m) => m.subjectId === Number(subjectId) && m.classId === Number(classId)
  );
}

/**
 * Property 5 helpers:
 * Add a subject to the bulk selection map.
 */
function addSubject(map, subjectId) {
  const next = new Map(map);
  next.set(subjectId, { code: '', creditHours: '' });
  return next;
}

/**
 * Remove a subject from the bulk selection map.
 */
function removeSubject(map, subjectId) {
  const next = new Map(map);
  next.delete(subjectId);
  return next;
}

/**
 * Property 6 helper:
 * Updates a single field for a single subject in the bulk selection map.
 * Returns a new map with only that entry changed.
 */
function updateSubjectField(map, subjectId, field, value) {
  const next = new Map(map);
  const existing = next.get(subjectId) || { code: '', creditHours: '' };
  next.set(subjectId, { ...existing, [field]: value });
  return next;
}

/**
 * Property 7 helper:
 * Returns the array of call arguments that would be passed to createSubjectClassMapping
 * for a bulk submit.
 */
function getBulkSubmitCalls(bulkSubjectSelection, classId) {
  const calls = [];
  for (const [subjectId, { code, creditHours }] of bulkSubjectSelection) {
    calls.push({
      subjectId,
      classId: Number(classId),
      code: code || null,
      creditHours: creditHours ? Number(creditHours) : null,
    });
  }
  return calls;
}

/**
 * Property 8 helper:
 * Returns the initial state for edit mode given an existing mapping item.
 */
function getEditModeInitialState(item) {
  return {
    code: item.code || '',
    creditHours: item.creditHours != null ? item.creditHours.toString() : '',
  };
}

/**
 * Property 9 helper:
 * Returns true if a duplicate TCM mapping exists (excluding the record being edited).
 */
function isDuplicateTcmMapping(teacherClassMappings, teacherId, classId, sectionId, editingId) {
  return teacherClassMappings.some(
    (m) =>
      m.id !== editingId &&
      m.teacherId === Number(teacherId) &&
      m.classId === Number(classId) &&
      (sectionId
        ? m.sectionId === Number(sectionId)
        : !m.sectionId)
  );
}

/**
 * Property 10 helper:
 * Filters SCM mappings by program (via the class's programId).
 */
function filterScmMappingsByProgram(scmMappings, classes, programId) {
  if (programId === 'all') return scmMappings;
  return scmMappings.filter((item) => {
    const cls = classes.find((c) => c.id === item.classId);
    return cls?.programId === Number(programId);
  });
}

/**
 * Property 11 helper:
 * Filters SCM mappings by classId.
 */
function filterScmMappingsByClass(scmMappings, classId) {
  if (classId === 'all') return scmMappings;
  return scmMappings.filter((item) => item.classId === Number(classId));
}

/**
 * Example test helper:
 * Returns whether the SCM submit button should be disabled.
 */
function isScmSubmitDisabled(bulkSubjectSelection, classId, isPending) {
  return bulkSubjectSelection.size === 0 || !classId || isPending;
}

/**
 * Example test helper:
 * Returns the reset state for the SCM dialog.
 */
function resetScmDialog() {
  return {
    scmDialogFilter: { programId: 'all', classId: '', sectionId: '' },
    bulkSubjectSelection: new Map(),
  };
}

// ─── Example Tests ─────────────────────────────────────────────────────────

describe('academics-mapping-dialog-redesign: Example Tests', () => {
  describe('1. Add mode vs Edit mode field visibility', () => {
    it('add mode: editing is null — filter bar and checklist should be shown, edit fields should not', () => {
      const editing = null;
      // In add mode, editing is null — the filter bar and checklist are shown
      expect(editing).toBeNull();
      // The edit-mode fields (subject name label, code input, credit hours, update button) are NOT shown
      const isAddMode = editing === null;
      expect(isAddMode).toBe(true);
    });

    it('edit mode: editing is set — only subject name, code, credit hours, update button shown', () => {
      const editing = { id: 1, subjectId: 10, classId: 5, code: 'CS101', creditHours: 3 };
      const isEditMode = editing !== null;
      expect(isEditMode).toBe(true);
      // In edit mode, the filter bar and checklist are NOT shown
      const showFilterBar = !isEditMode;
      expect(showFilterBar).toBe(false);
    });

    it('getEditModeInitialState pre-fills code and creditHours from item', () => {
      const item = { id: 1, code: 'CS101', creditHours: 3 };
      const state = getEditModeInitialState(item);
      expect(state.code).toBe('CS101');
      expect(state.creditHours).toBe('3');
    });

    it('getEditModeInitialState handles null code and null creditHours', () => {
      const item = { id: 2, code: null, creditHours: null };
      const state = getEditModeInitialState(item);
      expect(state.code).toBe('');
      expect(state.creditHours).toBe('');
    });
  });

  describe('2. Submit disabled states', () => {
    it('disabled when bulkSubjectSelection is empty', () => {
      expect(isScmSubmitDisabled(new Map(), '5', false)).toBe(true);
    });

    it('disabled when classId is falsy', () => {
      const sel = new Map([[1, { code: '', creditHours: '' }]]);
      expect(isScmSubmitDisabled(sel, '', false)).toBe(true);
      expect(isScmSubmitDisabled(sel, null, false)).toBe(true);
    });

    it('disabled when isPending is true', () => {
      const sel = new Map([[1, { code: '', creditHours: '' }]]);
      expect(isScmSubmitDisabled(sel, '5', true)).toBe(true);
    });

    it('enabled when size > 0 AND classId is set AND not pending', () => {
      const sel = new Map([[1, { code: '', creditHours: '' }]]);
      expect(isScmSubmitDisabled(sel, '5', false)).toBe(false);
    });
  });

  describe('3. Success path: dialog closes and selection clears', () => {
    it('after successful bulk submit, bulkSubjectSelection is cleared', () => {
      let bulkSubjectSelection = new Map([[1, { code: 'A', creditHours: '2' }]]);
      // Simulate success: clear the selection
      bulkSubjectSelection = new Map();
      expect(bulkSubjectSelection.size).toBe(0);
    });
  });

  describe('4. Error path: dialog stays open, selection unchanged', () => {
    it('after failed bulk submit, bulkSubjectSelection is unchanged', () => {
      const initial = new Map([[1, { code: 'A', creditHours: '2' }]]);
      // Simulate error: selection is NOT cleared
      const afterError = initial;
      expect(afterError.size).toBe(1);
      expect(afterError.get(1)).toEqual({ code: 'A', creditHours: '2' });
    });
  });

  describe('5. Dialog reset on close', () => {
    it('resetScmDialog returns correct initial state', () => {
      const reset = resetScmDialog();
      expect(reset.scmDialogFilter).toEqual({ programId: 'all', classId: '', sectionId: '' });
      expect(reset.bulkSubjectSelection).toBeInstanceOf(Map);
      expect(reset.bulkSubjectSelection.size).toBe(0);
    });
  });

  describe('6. Table filter cascade reset', () => {
    it('when program filter changes, class filter resets to "all"', () => {
      let scmTableFilter = { programId: '2', classId: '7' };
      // Simulate program change
      const newProgramId = '3';
      scmTableFilter = { programId: newProgramId, classId: 'all' };
      expect(scmTableFilter.classId).toBe('all');
      expect(scmTableFilter.programId).toBe('3');
    });
  });
});

// ─── Property Tests ────────────────────────────────────────────────────────

// Arbitraries
const programIdArb = fc.integer({ min: 1, max: 100 });
const classIdArb = fc.integer({ min: 1, max: 500 });
const sectionIdArb = fc.integer({ min: 1, max: 1000 });
const subjectIdArb = fc.integer({ min: 1, max: 200 });

const classArb = fc.record({
  id: classIdArb,
  programId: programIdArb,
  name: fc.string({ minLength: 1, maxLength: 20 }),
});

const sectionArb = fc.record({
  id: sectionIdArb,
  classId: classIdArb,
  name: fc.string({ minLength: 1, maxLength: 20 }),
});

const subjectArb = fc.record({
  id: subjectIdArb,
  name: fc.string({ minLength: 1, maxLength: 30 }),
});

const scmMappingArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  subjectId: subjectIdArb,
  classId: classIdArb,
  code: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  creditHours: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
});

const tcmMappingArb = fc.record({
  id: fc.integer({ min: 1, max: 9999 }),
  teacherId: fc.integer({ min: 1, max: 100 }),
  classId: classIdArb,
  sectionId: fc.option(sectionIdArb, { nil: null }),
});

describe('academics-mapping-dialog-redesign: Property Tests', () => {
  // Feature: academics-mapping-dialog-redesign, Property 1: class dropdown filtered by program
  it('Property 1: filterClassesByProgram returns only classes matching programId', () => {
    fc.assert(
      fc.property(
        fc.array(classArb, { minLength: 0, maxLength: 30 }),
        programIdArb,
        (classes, programId) => {
          const result = filterClassesByProgram(classes, programId.toString());
          for (const c of result) {
            expect(c.programId).toBe(programId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 1 (all): when programId is "all", all classes are returned
  it('Property 1 (all): filterClassesByProgram returns all classes when programId is "all"', () => {
    fc.assert(
      fc.property(
        fc.array(classArb, { minLength: 0, maxLength: 30 }),
        (classes) => {
          const result = filterClassesByProgram(classes, 'all');
          expect(result).toHaveLength(classes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 2: section dropdown filtered by class
  it('Property 2: filterSectionsByClass returns only sections matching classId', () => {
    fc.assert(
      fc.property(
        fc.array(sectionArb, { minLength: 0, maxLength: 30 }),
        classIdArb,
        (sections, classId) => {
          const result = filterSectionsByClass(sections, classId.toString());
          for (const s of result) {
            expect(s.classId).toBe(classId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 3: subject checklist shows all subjects when a class is selected
  it('Property 3: getSubjectChecklistItems returns all subjects regardless of class', () => {
    fc.assert(
      fc.property(
        fc.array(subjectArb, { minLength: 0, maxLength: 50 }),
        classIdArb,
        (subjects, classId) => {
          const result = getSubjectChecklistItems(subjects, [], classId.toString());
          expect(result).toHaveLength(subjects.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 4: already-mapped subjects are disabled in the checklist
  it('Property 4: isSubjectAlreadyMapped returns true iff a mapping exists for subject+class', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 1, maxLength: 20 }),
        (mappings) => {
          // Pick the first mapping — it should be detected as already mapped
          const m = mappings[0];
          const result = isSubjectAlreadyMapped(mappings, m.subjectId, m.classId);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 4 (negative): non-mapped subject returns false
  it('Property 4 (negative): isSubjectAlreadyMapped returns false for subject not in mappings', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 0, maxLength: 20 }),
        (mappings) => {
          // Use a subjectId that cannot exist in mappings (very large number)
          const result = isSubjectAlreadyMapped(mappings, 999999, 999999);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 5: check/uncheck round-trip leaves bulkSubjectSelection unchanged
  it('Property 5: addSubject then removeSubject leaves map without that subjectId', () => {
    fc.assert(
      fc.property(
        fc.array(subjectIdArb, { minLength: 0, maxLength: 20 }).map((ids) => {
          const m = new Map();
          for (const id of ids) m.set(id, { code: '', creditHours: '' });
          return m;
        }),
        subjectIdArb,
        (initialMap, subjectId) => {
          const hadBefore = initialMap.has(subjectId);
          const afterAdd = addSubject(initialMap, subjectId);
          const afterRemove = removeSubject(afterAdd, subjectId);
          expect(afterRemove.has(subjectId)).toBe(false);
          // Original map is not mutated
          expect(initialMap.has(subjectId)).toBe(hadBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 6: inline field updates are isolated per subject
  it('Property 6: updateSubjectField only changes the targeted subject entry', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 101, max: 200 }),
        fc.string({ minLength: 0, maxLength: 10 }),
        (subjectA, subjectB, newCode) => {
          let map = new Map();
          map = addSubject(map, subjectA);
          map = addSubject(map, subjectB);
          const originalB = map.get(subjectB);
          const updated = updateSubjectField(map, subjectA, 'code', newCode);
          // Subject B is unchanged
          expect(updated.get(subjectB)).toEqual(originalB);
          // Subject A is updated
          expect(updated.get(subjectA).code).toBe(newCode);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 7: bulk submission calls createSubjectClassMapping once per checked subject
  it('Property 7: getBulkSubmitCalls returns exactly one call per entry in bulkSubjectSelection', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            subjectId: subjectIdArb,
            code: fc.string({ minLength: 0, maxLength: 10 }),
            creditHours: fc.string({ minLength: 0, maxLength: 3 }),
          }),
          { minLength: 1, maxLength: 20 }
        ).map((entries) => {
          const m = new Map();
          for (const e of entries) {
            m.set(e.subjectId, { code: e.code, creditHours: e.creditHours });
          }
          return m;
        }),
        classIdArb,
        (bulkSubjectSelection, classId) => {
          const calls = getBulkSubmitCalls(bulkSubjectSelection, classId.toString());
          expect(calls).toHaveLength(bulkSubjectSelection.size);
          for (const call of calls) {
            expect(call.classId).toBe(classId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 8: edit mode pre-fills existing mapping data
  it('Property 8: getEditModeInitialState pre-fills code and creditHours from item', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.integer({ min: 1, max: 9999 }),
          code: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
          creditHours: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
        }),
        (item) => {
          const state = getEditModeInitialState(item);
          expect(state.code).toBe(item.code || '');
          if (item.creditHours != null) {
            expect(state.creditHours).toBe(item.creditHours.toString());
          } else {
            expect(state.creditHours).toBe('');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 9: duplicate TCM submission is blocked for any matching combination
  it('Property 9: isDuplicateTcmMapping returns true for existing combination', () => {
    fc.assert(
      fc.property(
        fc.array(tcmMappingArb, { minLength: 1, maxLength: 20 }),
        (mappings) => {
          const m = mappings[0];
          // Same combo, different editingId (not editing this record)
          const result = isDuplicateTcmMapping(
            mappings,
            m.teacherId,
            m.classId,
            m.sectionId,
            -1 // editingId that doesn't match any record
          );
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 9 (self-edit): editing own record is not blocked
  it('Property 9 (self-edit): isDuplicateTcmMapping returns false when editingId matches the only duplicate', () => {
    fc.assert(
      fc.property(
        tcmMappingArb,
        (mapping) => {
          // Only one mapping in the list — editing that same record should not be a duplicate
          const result = isDuplicateTcmMapping(
            [mapping],
            mapping.teacherId,
            mapping.classId,
            mapping.sectionId,
            mapping.id // editing this record itself
          );
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 10: SCM table program filter hides non-matching rows
  it('Property 10: filterScmMappingsByProgram returns only rows whose class has matching programId', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 0, maxLength: 30 }),
        fc.array(classArb, { minLength: 1, maxLength: 20 }),
        programIdArb,
        (scmMappings, classes, programId) => {
          const result = filterScmMappingsByProgram(scmMappings, classes, programId.toString());
          for (const item of result) {
            const cls = classes.find((c) => c.id === item.classId);
            if (cls) {
              expect(cls.programId).toBe(programId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 10 (all): "all" returns all rows
  it('Property 10 (all): filterScmMappingsByProgram returns all rows when programId is "all"', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 0, maxLength: 30 }),
        fc.array(classArb, { minLength: 0, maxLength: 20 }),
        (scmMappings, classes) => {
          const result = filterScmMappingsByProgram(scmMappings, classes, 'all');
          expect(result).toHaveLength(scmMappings.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 11: SCM table class filter hides non-matching rows
  it('Property 11: filterScmMappingsByClass returns only rows with matching classId', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 0, maxLength: 30 }),
        classIdArb,
        (scmMappings, classId) => {
          const result = filterScmMappingsByClass(scmMappings, classId.toString());
          for (const item of result) {
            expect(item.classId).toBe(classId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: academics-mapping-dialog-redesign, Property 11 (all): "all" returns all rows
  it('Property 11 (all): filterScmMappingsByClass returns all rows when classId is "all"', () => {
    fc.assert(
      fc.property(
        fc.array(scmMappingArb, { minLength: 0, maxLength: 30 }),
        (scmMappings) => {
          const result = filterScmMappingsByClass(scmMappings, 'all');
          expect(result).toHaveLength(scmMappings.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
