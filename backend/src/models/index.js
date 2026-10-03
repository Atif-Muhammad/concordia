const User = require('./User');
const InstituteSettings = require('./InstituteSettings');
const Template = require('./Template');
const AcademicSession = require('./AcademicSession');
const Department = require('./Department');
const Program = require('./Program');
const Class = require('./Class');
const Section = require('./Section');
const Subject = require('./Subject');
const SubjectClassMapping = require('./SubjectClassMapping');
const TeacherMapping = require('./TeacherMapping');
const Timetable = require('./Timetable');
const Student = require('./Student');
const Staff = require('./Staff');
const StaffIdSettings = require('./StaffIdSettings');
const Attendance = require('./Attendance');
const Leave = require('./Leave');
const { Holiday, AttendanceSkip } = require('./Holiday');
const {
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  FrontOfficeContact
} = require('./FrontOffice');
const {
  FeeHead,
  FeeStructure,
  FeeChallan,
  ExtraChallan,
  StudentCreditLedger,
  FeePaymentReceipt,
  FeeSettings
} = require('./Fee');
const { Exam, ExamMarks, ExamResult } = require('./Exam');
const {
  PayrollTemplate,
  Payroll,
  AdvanceSalary,
  PayrollSettings
} = require('./HR');
const {
  HostelRoom,
  HostelAllocation,
  HostelRegistration,
  HostelExpense,
  HostelInventory,
  HostelChallan,
  HostelCreditLedger
} = require('./Hostel');
const {
  FinanceIncome,
  FinanceExpense,
  FinanceClosing,
  FinanceCategory
} = require('./Finance');
const {
  InventoryItem,
  InventoryExpense
} = require('./Inventory');
const {
  Wallet,
  WalletTransaction
} = require('./Wallet');
const ActivityLog = require('./ActivityLog');

module.exports = {
  ActivityLog,
  User,
  InstituteSettings,
  Template,
  AcademicSession,
  Department,
  Program,
  Class,
  Section,
  Subject,
  SubjectClassMapping,
  TeacherMapping,
  Timetable,
  Student,
  Staff,
  StaffIdSettings,
  Attendance,
  Leave,
  Holiday,
  AttendanceSkip,
  FrontOfficeInquiry,
  FrontOfficeVisitor,
  FrontOfficeComplaint,
  FrontOfficeContact,
  FeeHead,
  FeeStructure,
  FeeChallan,
  ExtraChallan,
  StudentCreditLedger,
  FeePaymentReceipt,
  FeeSettings,
  Exam,
  ExamMarks,
  ExamResult,
  PayrollTemplate,
  Payroll,
  AdvanceSalary,
  PayrollSettings,
  HostelRoom,
  HostelAllocation,
  HostelRegistration,
  HostelExpense,
  HostelInventory,
  HostelChallan,
  HostelCreditLedger,
  FinanceIncome,
  FinanceExpense,
  FinanceClosing,
  FinanceCategory,
  InventoryItem,
  InventoryExpense,
  Wallet,
  WalletTransaction,
};
