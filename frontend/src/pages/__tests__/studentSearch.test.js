import { describe, it, expect, vi, afterEach } from 'vitest';
import axios from 'axios';
import {
  normalizeSearchText,
  formatNormalizedFullName,
  tokenizeSearchText,
  matchesSearchTokens,
} from '@/lib/studentSearch';
import { getStudents, getPassedOutStudents } from '../../../config/apis';

describe('Student Full-Name & Multi-Field Search Utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeSearchText & formatNormalizedFullName', () => {
    it('collapses trailing and internal double spaces in first/last names', () => {
      expect(formatNormalizedFullName('MUHAMMAD ', 'JUNAID ')).toBe('MUHAMMAD JUNAID');
      expect(formatNormalizedFullName('Angel ', '')).toBe('Angel');
      expect(formatNormalizedFullName('SUNEHA ', 'AMANAT  MASIH ')).toBe('SUNEHA AMANAT MASIH');
      expect(normalizeSearchText('  Muhammad   Junaid  ')).toBe('muhammad junaid');
      expect(tokenizeSearchText('  Dua   Parveez ')).toEqual(['dua', 'parveez']);
    });
  });

  describe('matchesSearchTokens', () => {
    const record = {
      studentName: formatNormalizedFullName('MUHAMMAD ', 'JUNAID '),
      fatherName: 'KHALIQ NOOR ',
      rollNumber: 'PSH-HSSC-26-007',
      challanNo: 'CH-2026-007',
    };

    const fields = [
      record.studentName,
      record.fatherName,
      record.rollNumber,
      record.challanNo,
    ];

    it('matches first name, last name, full name, father name, roll number, and challan number', () => {
      expect(matchesSearchTokens('', fields)).toBe(true);
      expect(matchesSearchTokens('Muhammad', fields)).toBe(true);
      expect(matchesSearchTokens('Junaid', fields)).toBe(true);
      expect(matchesSearchTokens('Muhammad Junaid', fields)).toBe(true);
      expect(matchesSearchTokens('  muhammad   junaid ', fields)).toBe(true);
      expect(matchesSearchTokens('Khaliq Noor', fields)).toBe(true);
      expect(matchesSearchTokens('PSH-HSSC-26-007', fields)).toBe(true);
      expect(matchesSearchTokens('CH-2026-007', fields)).toBe(true);
    });

    it('matches multi-word queries even if token order is swapped or skips middle parts within a field', () => {
      expect(matchesSearchTokens('Junaid Muhammad', fields)).toBe(true);
      expect(
        matchesSearchTokens('Suneha Masih', [
          formatNormalizedFullName('SUNEHA ', 'AMANAT MASIH'),
        ])
      ).toBe(true);
    });

    it('does not falsely match unrelated students or challans', () => {
      expect(matchesSearchTokens('Muhammad Usman', fields)).toBe(false);
      expect(matchesSearchTokens('CH-2026-999', fields)).toBe(false);
      expect(matchesSearchTokens('Someone', [])).toBe(false);
    });
  });

  describe('API search query URL encoding', () => {
    it('properly URL-encodes multi-word and special-character search queries in getStudents and getPassedOutStudents', async () => {
      const getSpy = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { students: [], total: 0 },
      });

      await getStudents({ searchQuery: 'Muhammad Junaid & Ali' });
      expect(getSpy).toHaveBeenCalledTimes(1);
      const url1 = getSpy.mock.calls[0][0];
      expect(url1).toContain('searchQuery=Muhammad+Junaid+%26+Ali');

      await getStudents(null, null, null, 'Muhammad Junaid & Ali');
      expect(getSpy).toHaveBeenCalledTimes(2);
      const url2 = getSpy.mock.calls[1][0];
      expect(url2).toContain('searchQuery=Muhammad%20Junaid%20%26%20Ali');

      await getPassedOutStudents(null, null, null, 'Dua & Parveez');
      expect(getSpy).toHaveBeenCalledTimes(3);
      const url3 = getSpy.mock.calls[2][0];
      expect(url3).toContain('searchQuery=Dua%20%26%20Parveez');
    });
  });
});
