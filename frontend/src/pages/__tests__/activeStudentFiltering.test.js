import { describe, it, expect, vi, afterEach } from 'vitest';
import axios from 'axios';
import {
  isStudentActive,
  getChallanStudentStatus,
  getStudentStatusCode,
  formatStudentStatusLabel,
  getStudentStatusTextTone,
  isChallanStudentActive,
  getStudentStatusCounts,
} from '@/lib/studentStatus';
import { normalizeChallan } from '@/pages/fee-management/feeFinancialUtils';
import {
  isHostelRegistrationActiveForBilling,
  validateChallanEligibility,
} from '@/pages/boarding/hostelFinancialUtils';
import { searchStudents, searchStudent } from '../../../config/apis';

describe('Canonical Active-Student Frontend Helpers & API Guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('studentStatus helpers', () => {
    it('classifies ACTIVE non-passedOut students as active and rejects inactive/passedOut', () => {
      expect(isStudentActive({ status: 'ACTIVE', passedOut: false })).toBe(true);
      expect(isStudentActive({ status: 'active' })).toBe(true);
      expect(isStudentActive({ status: 'ACTIVE', passedOut: true })).toBe(false);
      expect(isStudentActive({ status: 'EXPELLED', passedOut: true })).toBe(false);
      expect(isStudentActive({ status: 'STRUCK_OFF' })).toBe(false);
      expect(isStudentActive({ status: 'GRADUATED' })).toBe(false);
      expect(isStudentActive(null)).toBe(false);
    });

    it('detects inactive student on challan via studentStatus, student, or studentPassedOut', () => {
      expect(isChallanStudentActive({ status: 'PENDING', studentStatus: 'ACTIVE' })).toBe(true);
      expect(isChallanStudentActive({ status: 'PENDING', studentStatus: 'EXPELLED' })).toBe(false);
      expect(isChallanStudentActive({ status: 'PENDING', student: { status: 'STRUCK_OFF' } })).toBe(false);
      expect(isChallanStudentActive({ status: 'PENDING', student: { status: 'ACTIVE', passedOut: true } })).toBe(false);
      expect(isChallanStudentActive({ status: 'PENDING', studentPassedOut: true })).toBe(false);
      expect(getChallanStudentStatus({ student: { status: 'struck_off' } })).toBe('STRUCK_OFF');
    });

    it('extracts dashboard student status counts from nested stats.students or direct students stats', () => {
      const fromDashboardStats = getStudentStatusCounts({
        activeStudents: 163,
        students: {
          active: 163,
          expelledStudents: 2,
          struckOffStudents: 3,
          passedOutStudents: 5,
          byStatus: { active: 163, expelled: 2, struckOff: 3, passedOut: 5 },
        },
      });
      expect(fromDashboardStats).toEqual({ active: 163, expelled: 2, struckOff: 3, passedOut: 5 });

      const fromExecStudents = getStudentStatusCounts({
        activeStudents: 40,
        expelledStudents: 4,
        struckOffStudents: 1,
        passedOutStudents: 9,
      });
      expect(fromExecStudents).toEqual({ active: 40, expelled: 4, struckOff: 1, passedOut: 9 });
      expect(getStudentStatusCounts(null)).toEqual({ active: 0, expelled: 0, struckOff: 0, passedOut: 0 });
    });
  });

  describe('normalizeChallan preserves student status metadata', () => {
    it('propagates studentStatus and studentPassedOut even when studentId is flattened to string', () => {
      const normalized = normalizeChallan({
        _id: 'ch1',
        challanNumber: 'CH-1001',
        status: 'PENDING',
        amount: 5000,
        studentId: {
          _id: 'stu1',
          fName: 'Ali',
          lName: 'Khan',
          status: 'STRUCK_OFF',
          passedOut: true,
        },
      });

      expect(typeof normalized.studentId).toBe('string');
      expect(normalized.studentStatus).toBe('STRUCK_OFF');
      expect(normalized.studentPassedOut).toBe(true);
      expect(isChallanStudentActive(normalized)).toBe(false);
    });
  });

  describe('hostel billing active-student eligibility', () => {
    const targetYm = { year: 2026, month: 11 };

    it('allows active internal boarders and external boarders', () => {
      const activeInternal = {
        id: 'reg1',
        status: 'active',
        registrationType: 'internal',
        studentId: 'stu1',
        student: { status: 'ACTIVE', passedOut: false },
        registrationDate: '2026-11-01',
      };
      const externalBoarder = {
        id: 'reg2',
        status: 'active',
        registrationType: 'external',
        studentId: null,
        externalName: 'Guest Boarder',
        registrationDate: '2026-11-01',
      };

      expect(isHostelRegistrationActiveForBilling(activeInternal)).toBe(true);
      expect(validateChallanEligibility(activeInternal, targetYm, []).eligible).toBe(true);

      expect(isHostelRegistrationActiveForBilling(externalBoarder)).toBe(true);
      expect(validateChallanEligibility(externalBoarder, targetYm, []).eligible).toBe(true);
    });

    it('blocks terminated registrations and expelled/passed-out internal boarders', () => {
      const terminatedReg = {
        id: 'reg3',
        status: 'terminated',
        registrationType: 'external',
        registrationDate: '2026-11-01',
      };
      const expelledInternal = {
        id: 'reg4',
        status: 'active',
        registrationType: 'internal',
        studentId: { _id: 'stu2', status: 'EXPELLED', passedOut: true },
        registrationDate: '2026-11-01',
      };

      const res1 = validateChallanEligibility(terminatedReg, targetYm, []);
      expect(res1.eligible).toBe(false);
      expect(res1.code).toBe('INACTIVE_REGISTRATION');

      const res2 = validateChallanEligibility(expelledInternal, targetYm, []);
      expect(res2.eligible).toBe(false);
      expect(res2.code).toBe('INACTIVE_STUDENT');
      expect(isHostelRegistrationActiveForBilling(expelledInternal)).toBe(false);
    });
  });

  describe('student search APIs default to ACTIVE and allow opt-out', () => {
    it('searchStudents sends status=ACTIVE by default and respects status=all override', async () => {
      const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: { students: [] } });

      await searchStudents('Ali');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain('status=ACTIVE');

      await searchStudents('Ali', { status: 'all' });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0]).toContain('status=all');
    });

    it('searchStudent sends status=ACTIVE by default and respects status=all override', async () => {
      const spy = vi.spyOn(axios, 'get').mockResolvedValue({ data: [] });

      await searchStudent('PSH-001');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toContain('status=ACTIVE');

      await searchStudent('PSH-001', { status: 'all' });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0]).toContain('status=all');

      await searchStudent('Muhammad Junaid', { status: 'all' });
      expect(spy).toHaveBeenCalledTimes(3);
      expect(spy.mock.calls[2][0]).toContain('searchFor=Muhammad+Junaid');
      expect(spy.mock.calls[2][0]).toContain('status=all');
    });
  });

  describe('student status normalization, labels, and tones', () => {
    it('normalizes challan and student status codes including spaced tokens and passedOut', () => {
      expect(getChallanStudentStatus({ studentStatus: 'Struck Off' })).toBe('STRUCK_OFF');
      expect(getChallanStudentStatus({ studentStatus: 'ACTIVE', studentPassedOut: true })).toBe('GRADUATED');
      expect(getChallanStudentStatus({ student: { status: 'EXPELLED' } })).toBe('EXPELLED');

      expect(getStudentStatusCode({ status: 'ACTIVE', passedOut: false })).toBe('ACTIVE');
      expect(getStudentStatusCode({ status: 'ACTIVE', passedOut: true })).toBe('GRADUATED');
      expect(getStudentStatusCode({ status: 'Struck Off' })).toBe('STRUCK_OFF');
      expect(getStudentStatusCode({ status: 'EXPELLED' })).toBe('EXPELLED');
      expect(getStudentStatusCode({})).toBe('ACTIVE');
      expect(getStudentStatusCode(null)).toBe('');
    });

    it('formats human-readable labels and semantic tones for all student statuses', () => {
      expect(formatStudentStatusLabel('ACTIVE')).toBe('Active');
      expect(formatStudentStatusLabel('EXPELLED')).toBe('Expelled');
      expect(formatStudentStatusLabel('STRUCK_OFF')).toBe('Struck Off');
      expect(formatStudentStatusLabel('Struck Off')).toBe('Struck Off');
      expect(formatStudentStatusLabel('GRADUATED')).toBe('Graduated');
      expect(formatStudentStatusLabel('PASSED_OUT')).toBe('Passed Out');
      expect(formatStudentStatusLabel('SUSPENDED')).toBe('Suspended');

      expect(getStudentStatusTextTone('EXPELLED').printColor).toBe('#dc2626');
      expect(getStudentStatusTextTone('STRUCK_OFF').textClass).toContain('text-amber-600');
      expect(getStudentStatusTextTone('GRADUATED').printColor).toBe('#2563eb');
      expect(getStudentStatusTextTone('PASSED_OUT').textClass).toContain('text-blue-600');
      expect(getStudentStatusTextTone('ACTIVE').textClass).toBe('text-muted-foreground');
    });
  });
});
