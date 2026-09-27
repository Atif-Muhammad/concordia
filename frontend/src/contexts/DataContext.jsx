import { createContext, useContext, useState, useEffect } from "react";
import {
  getFeeChallanTemplates,
  createFeeChallanTemplate,
  updateFeeChallanTemplate,
  deleteFeeChallanTemplate,
  getIDCardTemplates,
  createIDCardTemplate,
  updateIDCardTemplate,
  deleteIDCardTemplate,
  getTeacherIDCardTemplates,
  createTeacherIDCardTemplate,
  updateTeacherIDCardTemplate,
  deleteTeacherIDCardTemplate,
  getInstituteSettings
} from "../../config/apis";


// Types

// Teacher-Subject mapping and Timetable interfaces moved below Teacher interface

// Initial Data
const initialStudents = [{
  id: "1",
  name: "Ahmed Ali",
  fatherName: "Ali Khan",
  rollNumber: "HSSC-001",
  program: "HSSC",
  class: "XI",
  section: "A",
  phone: "0300-1234567",
  admissionDate: "2024-01-15",
  status: "active",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed"
}, {
  id: "2",
  name: "Sara Khan",
  fatherName: "Khan Sahib",
  rollNumber: "HSSC-002",
  program: "HSSC",
  class: "XII",
  section: "A",
  phone: "0301-2345678",
  admissionDate: "2023-01-10",
  status: "active",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara"
}, {
  id: "3",
  name: "Hassan Raza",
  fatherName: "Raza Ahmed",
  rollNumber: "DIP-001",
  program: "Diploma",
  class: "Semester 2",
  section: "A",
  phone: "0302-3456789",
  admissionDate: "2024-02-20",
  status: "active",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hassan"
}, {
  id: "4",
  name: "Fatima Noor",
  fatherName: "Noor Muhammad",
  rollNumber: "BS-001",
  program: "BS",
  class: "Semester 3",
  section: "A",
  phone: "0303-4567890",
  admissionDate: "2023-09-01",
  status: "active",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Fatima"
}, {
  id: "5",
  name: "Usman Shah",
  fatherName: "Shah Jahan",
  rollNumber: "HSSC-003",
  program: "HSSC",
  class: "XI",
  section: "B",
  phone: "0304-5678901",
  admissionDate: "2024-01-15",
  status: "active",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Usman"
}];
const initialFees = [{
  id: "1",
  studentId: "1",
  challanNumber: "CH-001",
  amount: 15000,
  dueDate: "2025-01-31",
  paidDate: "2025-01-20",
  status: "paid",
  fineAmount: 0,
  discount: 0,
  paidAmount: 15000
}, {
  id: "2",
  studentId: "2",
  challanNumber: "CH-002",
  amount: 15000,
  dueDate: "2025-01-31",
  status: "pending",
  fineAmount: 0,
  discount: 0,
  paidAmount: 0
}, {
  id: "3",
  studentId: "3",
  challanNumber: "CH-003",
  amount: 12000,
  dueDate: "2025-01-25",
  status: "overdue",
  fineAmount: 500,
  discount: 0,
  paidAmount: 0
}, {
  id: "4",
  studentId: "4",
  challanNumber: "CH-004",
  amount: 18000,
  dueDate: "2025-01-31",
  paidDate: "2025-01-18",
  status: "paid",
  fineAmount: 0,
  discount: 500,
  paidAmount: 17500
}, {
  id: "5",
  studentId: "5",
  challanNumber: "CH-005",
  amount: 15000,
  dueDate: "2025-01-31",
  status: "pending",
  fineAmount: 0,
  discount: 0,
  paidAmount: 0
}];
const initialAttendance = [{
  id: "1",
  studentId: "1",
  date: "2025-01-27",
  status: "present",
  class: "XI-A"
}, {
  id: "2",
  studentId: "2",
  date: "2025-01-27",
  status: "present",
  class: "XII-A"
}, {
  id: "3",
  studentId: "3",
  date: "2025-01-27",
  status: "absent",
  class: "Diploma Sem 2"
}, {
  id: "4",
  studentId: "4",
  date: "2025-01-27",
  status: "present",
  class: "BS Sem 3"
}, {
  id: "5",
  studentId: "5",
  date: "2025-01-27",
  status: "on-leave",
  class: "XI-B"
}];
const initialExams = [{
  id: "1",
  examName: "Mid Term 2025",
  program: "HSSC",
  session: "Spring 2025",
  startDate: "2025-03-01",
  endDate: "2025-03-15",
  type: "Midterm",
  description: "First midterm examination"
}, {
  id: "2",
  examName: "Final Term 2025",
  program: "HSSC",
  session: "Spring 2025",
  startDate: "2025-06-01",
  endDate: "2025-06-15",
  type: "Final",
  description: "Final examination"
}];
const initialMarks = [{
  id: "1",
  examId: "1",
  studentId: "1",
  subject: "Physics",
  totalMarks: 100,
  obtainedMarks: 85,
  teacherRemarks: "Good performance"
}, {
  id: "2",
  examId: "1",
  studentId: "1",
  subject: "Chemistry",
  totalMarks: 100,
  obtainedMarks: 78,
  teacherRemarks: "Needs improvement"
}, {
  id: "3",
  examId: "1",
  studentId: "2",
  subject: "Biology",
  totalMarks: 100,
  obtainedMarks: 92,
  teacherRemarks: "Excellent"
}];
const initialResults = [{
  id: "1",
  studentId: "1",
  examId: "1",
  totalMarks: 500,
  obtainedMarks: 405,
  percentage: 81,
  gpa: 3.7,
  grade: "A",
  position: 2,
  remarks: "Good overall performance"
}, {
  id: "2",
  studentId: "2",
  examId: "1",
  totalMarks: 500,
  obtainedMarks: 450,
  percentage: 90,
  gpa: 4.0,
  grade: "A+",
  position: 1,
  remarks: "Outstanding performance"
}];
const initialPrograms = [{
  id: "1",
  programName: "HSSC",
  duration: "2 years",
  description: "Higher Secondary School Certificate"
}, {
  id: "2",
  programName: "Diploma",
  duration: "2 years",
  description: "Diploma in Associate Engineering"
}, {
  id: "3",
  programName: "BS",
  duration: "4 years",
  description: "Bachelor of Science"
}];
const initialClasses = [{
  id: "1",
  className: "XI",
  programId: "1",
  sectionCount: 2
}, {
  id: "2",
  className: "XII",
  programId: "1",
  sectionCount: 2
}, {
  id: "3",
  className: "Semester 1",
  programId: "2",
  sectionCount: 1
}, {
  id: "4",
  className: "Semester 2",
  programId: "2",
  sectionCount: 1
}, {
  id: "5",
  className: "Semester 3",
  programId: "3",
  sectionCount: 1
}];
const initialSections = [{
  id: "1",
  sectionName: "A",
  classId: "1",
  capacity: 30
}, {
  id: "2",
  sectionName: "B",
  classId: "1",
  capacity: 30
}, {
  id: "3",
  sectionName: "A",
  classId: "2",
  capacity: 30
}, {
  id: "4",
  sectionName: "B",
  classId: "2",
  capacity: 30
}];
const initialSubjects = [{
  id: "1",
  subjectName: "Physics",
  subjectCode: "PHY-101",
  classId: "1"
}, {
  id: "2",
  subjectName: "Chemistry",
  subjectCode: "CHEM-101",
  classId: "1"
}, {
  id: "3",
  subjectName: "Mathematics",
  subjectCode: "MATH-101",
  classId: "1"
}];
const initialTeacherMapping = [];
const initialTeacherClassMapping = [{
  id: "1",
  teacherId: "1",
  teacherName: "Dr. Ali Khan",
  program: "HSSC",
  className: "XI",
  section: "A",
  role: "Class Teacher",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=DrAli"
}, {
  id: "2",
  teacherId: "2",
  teacherName: "Ms. Sara Ahmed",
  program: "HSSC",
  className: "XII",
  section: "A",
  role: "Class Teacher",
  photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=MsSara"
}];
const initialTimetable = [];
const initialAssignments = [{
  id: "1",
  title: "Newton's Laws Assignment",
  subjectId: "1",
  classId: "1",
  dueDate: "2025-02-15",
  description: "Solve problems on Newton's three laws"
}];
const initialConfig = {};
const initialBranches = [];
const initialRoles = [];
const initialAdmins = [{
  id: "1",
  name: "Ali Raza",
  email: "ali@concordia.edu.pk",
  password: "admin123",
  roleId: "1",
  accessRights: ["Dashboard", "Students", "Academics", "Attendance", "Examination", "Finance", "Fee Management", "HR & Payroll", "Front Office", "Boarding", "Inventory", "Configuration"]
}];
const initialInquiries = [{
  id: "1",
  studentName: "Zainab Ali",
  fatherName: "Ali Raza",
  fatherCnic: "12345-1234567-1",
  contactNumber: "0305-1111111",
  email: "zainab.ali@email.com",
  address: "123 Model Town, Lahore",
  programInterest: "HSSC Pre-Medical",
  previousInstitute: "Beaconhouse School",
  remarks: "Interested in FSc Pre-Medical",
  status: "new",
  date: "2025-01-26"
}, {
  id: "2",
  studentName: "Abdullah Khan",
  fatherName: "Khan Bahadur",
  fatherCnic: "54321-7654321-2",
  contactNumber: "0306-2222222",
  email: "abdullah.khan@email.com",
  address: "456 DHA Phase 5, Lahore",
  programInterest: "BS Computer Science",
  previousInstitute: "Aitchison College",
  remarks: "Approved for BS Computer Science",
  status: "approved",
  date: "2025-01-25"
}];
const initialVisitors = [{
  id: "1",
  visitorName: "Ahmed Ali",
  phoneNumber: "0300-1111111",
  purpose: "Inquiry about admission",
  visitDate: "2025-01-27",
  inTime: "10:00",
  outTime: "10:30",
  remarks: "Interested in BS program"
}, {
  id: "2",
  visitorName: "Sara Ahmed",
  phoneNumber: "0321-2222222",
  purpose: "Meeting with Principal",
  visitDate: "2025-01-27",
  inTime: "11:00",
  outTime: "12:00",
  remarks: "Regarding student performance"
}];
const initialComplaints = [{
  id: "1",
  complainantType: "Parent",
  complainantName: "Muhammad Usman",
  contactNumber: "0300-3333333",
  complaintNature: "Facility Issue",
  details: "AC not working in classroom 202",
  assignedTo: "Principal",
  status: "pending",
  date: "2025-01-26"
}, {
  id: "2",
  complainantType: "Student",
  complainantName: "Ayesha Malik",
  contactNumber: "0321-4444444",
  complaintNature: "Academic Issue",
  details: "Need extra classes for Mathematics",
  assignedTo: "HOD Science",
  status: "in-progress",
  date: "2025-01-25"
}];
const initialContacts = [{
  id: "1",
  contactName: "Rescue 1122",
  category: "Emergency",
  phoneNumber: "1122",
  email: "rescue@1122.gov.pk",
  description: "Emergency rescue services"
}, {
  id: "2",
  contactName: "Police Emergency",
  category: "Emergency",
  phoneNumber: "15",
  email: "police@punjab.gov.pk",
  description: "Police emergency hotline"
}, {
  id: "3",
  contactName: "IT Support - Hassan Tech",
  category: "Technical",
  phoneNumber: "0300-5555555",
  email: "support@hassantech.com",
  description: "Computer and network maintenance"
}, {
  id: "4",
  contactName: "ABC Plumbing Services",
  category: "Maintenance",
  phoneNumber: "0321-6666666",
  email: "abc.plumbing@email.com",
  description: "Water and sewage maintenance"
}];
const initialTeachers = [{
  id: "1",
  name: "Dr. Muhammad Asif",
  fatherName: "Asif Ali",
  cnic: "35202-1234567-1",
  contactNumber: "0321-1111111",
  email: "asif@concordia.edu.pk",
  designation: "Professor",
  department: "Physics",
  dateOfJoining: "2020-01-15",
  salary: 80000,
  status: "active",
  subjects: ["Physics", "Applied Physics"]
}, {
  id: "2",
  name: "Ms. Ayesha Fatima",
  fatherName: "Fatima Khan",
  cnic: "35202-2234567-2",
  contactNumber: "0322-2222222",
  email: "ayesha@concordia.edu.pk",
  designation: "Lecturer",
  department: "Chemistry",
  dateOfJoining: "2021-08-20",
  salary: 55000,
  status: "active",
  subjects: ["Chemistry", "Organic Chemistry"]
}, {
  id: "3",
  name: "Mr. Imran Sheikh",
  fatherName: "Sheikh Ahmed",
  cnic: "35202-3234567-3",
  contactNumber: "0323-3333333",
  email: "imran@concordia.edu.pk",
  designation: "Assistant Professor",
  department: "Mathematics",
  dateOfJoining: "2022-03-10",
  salary: 60000,
  status: "active",
  subjects: ["Mathematics", "Statistics"]
}, {
  id: "4",
  name: "Dr. Sana Malik",
  fatherName: "Malik Sahib",
  cnic: "35202-4234567-4",
  contactNumber: "0324-4444444",
  email: "sana@concordia.edu.pk",
  designation: "Associate Professor",
  department: "Biology",
  dateOfJoining: "2019-09-01",
  salary: 75000,
  status: "active",
  subjects: ["Biology", "Zoology", "Botany"]
}, {
  id: "5",
  name: "Mr. Usman Tariq",
  fatherName: "Tariq Mehmood",
  cnic: "35202-5234567-5",
  contactNumber: "0325-5555555",
  email: "usman@concordia.edu.pk",
  designation: "Lecturer",
  department: "Computer Science",
  dateOfJoining: "2023-01-10",
  salary: 50000,
  status: "active",
  subjects: ["Computer Science", "Programming"]
}];
const initialStaff = [{
  id: "1",
  name: "Dr. Muhammad Asif",
  designation: "Professor",
  department: "Physics",
  phone: "0321-1111111",
  salary: 80000,
  joinDate: "2020-01-15"
}, {
  id: "2",
  name: "Ms. Ayesha Fatima",
  designation: "Lecturer",
  department: "Chemistry",
  phone: "0322-2222222",
  salary: 55000,
  joinDate: "2021-08-20"
}, {
  id: "3",
  name: "Mr. Imran Sheikh",
  designation: "Assistant Professor",
  department: "Computer Lab",
  phone: "0323-3333333",
  salary: 60000,
  joinDate: "2022-03-10"
}];
const initialEmployees = [{
  id: "1",
  name: "Mr. Ali Raza",
  fatherName: "Raza Ahmed",
  cnic: "35202-6234567-6",
  contactNumber: "0326-6666666",
  email: "ali.raza@concordia.edu.pk",
  designation: "Admin Officer",
  department: "Administration",
  dateOfJoining: "2018-05-20",
  salary: 45000,
  status: "active"
}, {
  id: "2",
  name: "Ms. Fatima Noor",
  fatherName: "Noor Muhammad",
  cnic: "35202-7234567-7",
  contactNumber: "0327-7777777",
  email: "fatima@concordia.edu.pk",
  designation: "Accountant",
  department: "Finance",
  dateOfJoining: "2019-11-15",
  salary: 50000,
  status: "active"
}, {
  id: "3",
  name: "Mr. Hassan Ali",
  fatherName: "Ali Khan",
  cnic: "35202-8234567-8",
  contactNumber: "0328-8888888",
  email: "hassan@concordia.edu.pk",
  designation: "Security Officer",
  department: "Security",
  dateOfJoining: "2020-07-01",
  salary: 30000,
  status: "active"
}];
const initialPayrolls = [{
  id: "1",
  employeeId: "1",
  month: "January 2025",
  basicSalary: 45000,
  bonus: 5000,
  deductions: 2000,
  advanceSalary: 0,
  netSalary: 48000,
  status: "paid"
}, {
  id: "2",
  employeeId: "2",
  month: "January 2025",
  basicSalary: 50000,
  bonus: 0,
  deductions: 1500,
  advanceSalary: 5000,
  netSalary: 43500,
  status: "paid"
}, {
  id: "3",
  employeeId: "3",
  month: "January 2025",
  basicSalary: 30000,
  bonus: 2000,
  deductions: 1000,
  advanceSalary: 0,
  netSalary: 31000,
  status: "unpaid"
}];
const initialAdvanceSalaries = [{
  id: "1",
  employeeId: "2",
  month: "January 2025",
  amount: 5000,
  remarks: "Emergency advance",
  adjusted: true
}];
const initialEmployeeAttendance = [{
  id: "1",
  employeeId: "1",
  date: "2025-01-27",
  status: "present"
}, {
  id: "2",
  employeeId: "2",
  date: "2025-01-27",
  status: "present"
}, {
  id: "3",
  employeeId: "3",
  date: "2025-01-27",
  status: "absent",
  remarks: "Sick"
}];
const initialLeaveRequests = [{
  id: "1",
  employeeId: "1",
  leaveType: "casual",
  startDate: "2025-02-01",
  endDate: "2025-02-02",
  reason: "Personal work",
  status: "pending"
}, {
  id: "2",
  employeeId: "2",
  leaveType: "sick",
  startDate: "2025-01-28",
  endDate: "2025-01-29",
  reason: "Flu",
  status: "approved",
  approvedBy: "Principal"
}];
const initialDepartments = [{
  id: "1",
  departmentName: "Physics",
  headOfDepartment: "Dr. Muhammad Asif",
  description: "Science department"
}, {
  id: "2",
  departmentName: "Chemistry",
  headOfDepartment: "Ms. Ayesha Fatima",
  description: "Science department"
}, {
  id: "3",
  departmentName: "Administration",
  headOfDepartment: "Mr. Ali Raza",
  description: "Admin department"
}];
const initialHostelRegistrations = [{
  id: "1",
  studentId: "3",
  studentName: "Hassan Raza",
  classProgram: "Diploma Sem 2",
  hostelName: "Boys Hostel A",
  registrationDate: "2024-02-20",
  status: "active"
}, {
  id: "2",
  studentId: "4",
  studentName: "Fatima Noor",
  classProgram: "BS Sem 3",
  hostelName: "Girls Hostel A",
  registrationDate: "2023-09-01",
  status: "active"
}];
const initialRooms = [{
  id: "1",
  roomNumber: "101",
  roomType: "double",
  capacity: 2,
  allocatedTo: ["Hassan Raza"],
  allocationDate: "2024-02-20",
  status: "occupied"
}, {
  id: "2",
  roomNumber: "102",
  roomType: "double",
  capacity: 2,
  allocatedTo: ["Fatima Noor"],
  allocationDate: "2023-09-01",
  status: "occupied"
}, {
  id: "3",
  roomNumber: "103",
  roomType: "single",
  capacity: 1,
  allocatedTo: [],
  allocationDate: "",
  status: "vacant"
}];
const initialMessAllocations = [{
  id: "1",
  studentId: "3",
  messPlan: "standard",
  mealStatus: "active",
  monthlyCost: 5000
}, {
  id: "2",
  studentId: "4",
  messPlan: "premium",
  mealStatus: "active",
  monthlyCost: 7000
}];
const initialHostelExpenses = [{
  id: "1",
  expenseTitle: "Electricity Bill",
  amount: 15000,
  date: "2025-01-20",
  remarks: "Monthly bill"
}, {
  id: "2",
  expenseTitle: "Water Bill",
  amount: 5000,
  date: "2025-01-20",
  remarks: "Monthly bill"
}];
const initialInventoryItems = [{
  id: "1",
  itemName: "Bed",
  category: "furniture",
  quantity: 50,
  condition: "good",
  allocatedToRoom: "101"
}, {
  id: "2",
  itemName: "Study Table",
  category: "furniture",
  quantity: 50,
  condition: "good"
}, {
  id: "3",
  itemName: "Ceiling Fan",
  category: "appliance",
  quantity: 30,
  condition: "new"
}];
const initialFinanceIncome = [{
  id: "1",
  date: "2025-01-15",
  category: "Tuition Fee",
  description: "January fee collection",
  amount: 500000
}, {
  id: "2",
  date: "2025-01-20",
  category: "Donation",
  description: "Alumni donation",
  amount: 100000
}];
const initialFinanceExpenses = [{
  id: "1",
  date: "2025-01-18",
  category: "Salary",
  description: "Staff salaries for January",
  amount: 300000
}, {
  id: "2",
  date: "2025-01-22",
  category: "Utility Bills",
  description: "Electricity and water",
  amount: 50000
}, {
  id: "3",
  date: "2025-01-25",
  category: "Maintenance",
  description: "Building repairs",
  amount: 30000
}];
const initialFinanceClosings = [{
  id: "1",
  type: "monthly",
  date: "2024-12-31",
  totalIncome: 1200000,
  totalExpense: 800000,
  netBalance: 400000
}];
const initialSchoolInventory = [{
  id: "1",
  itemName: "Microscope",
  category: "Lab Equipment",
  quantity: 15,
  unitPrice: 25000,
  totalValue: 375000,
  purchaseDate: "2024-01-15",
  supplier: "Scientific Supplies Ltd",
  condition: "Good",
  location: "Biology Lab",
  assignedTo: "Lab",
  assignedToName: "Biology Lab",
  assignedDate: "2024-01-20",
  maintenanceCost: 15000,
  lastMaintenanceDate: "2024-10-15",
  warrantyExpiry: "2026-01-15",
  description: "Compound microscopes for student use"
}, {
  id: "2",
  itemName: "Chemistry Glassware Set",
  category: "Lab Equipment",
  quantity: 20,
  unitPrice: 5000,
  totalValue: 100000,
  purchaseDate: "2024-02-10",
  supplier: "Lab Equipment Co",
  condition: "New",
  location: "Chemistry Lab",
  assignedTo: "Lab",
  assignedToName: "Chemistry Lab",
  assignedDate: "2024-02-15",
  warrantyExpiry: "2025-02-10",
  description: "Complete set of beakers, flasks, and test tubes"
}, {
  id: "3",
  itemName: "Desktop Computers",
  category: "Computer Equipment",
  quantity: 40,
  unitPrice: 45000,
  totalValue: 1800000,
  purchaseDate: "2023-08-20",
  supplier: "Tech Solutions",
  condition: "Good",
  location: "Computer Lab",
  assignedTo: "Lab",
  assignedToName: "Computer Lab",
  assignedDate: "2023-08-25",
  maintenanceCost: 45000,
  lastMaintenanceDate: "2024-08-20",
  warrantyExpiry: "2025-08-20",
  description: "Dell desktops with monitors"
}, {
  id: "4",
  itemName: "Laptops",
  category: "Computer Equipment",
  quantity: 10,
  unitPrice: 65000,
  totalValue: 650000,
  purchaseDate: "2024-03-05",
  supplier: "Tech Solutions",
  condition: "New",
  location: "IT Department",
  assignedTo: "Department",
  assignedToName: "IT Department",
  assignedDate: "2024-03-10",
  warrantyExpiry: "2027-03-05",
  description: "HP laptops for staff"
}, {
  id: "5",
  itemName: "Football",
  category: "Sports Equipment",
  quantity: 25,
  unitPrice: 1500,
  totalValue: 37500,
  purchaseDate: "2024-01-10",
  supplier: "Sports Mart",
  condition: "Good",
  location: "Sports Room",
  assignedTo: "Department",
  assignedToName: "Sports Department",
  assignedDate: "2024-01-15",
  maintenanceCost: 2500,
  lastMaintenanceDate: "2024-09-10",
  description: "Standard size footballs"
}, {
  id: "6",
  itemName: "Cricket Kit",
  category: "Sports Equipment",
  quantity: 10,
  unitPrice: 12000,
  totalValue: 120000,
  purchaseDate: "2023-12-15",
  supplier: "Sports Mart",
  condition: "Fair",
  location: "Sports Room",
  assignedTo: "Department",
  assignedToName: "Sports Department",
  assignedDate: "2023-12-20",
  maintenanceCost: 8000,
  lastMaintenanceDate: "2024-06-15",
  description: "Complete cricket sets with bats and balls"
}, {
  id: "7",
  itemName: "Physics Books",
  category: "Library Books",
  quantity: 100,
  unitPrice: 800,
  totalValue: 80000,
  purchaseDate: "2024-01-05",
  supplier: "Academic Publishers",
  condition: "New",
  location: "Library",
  assignedTo: "Class",
  assignedToName: "HSSC XI-A",
  assignedDate: "2024-01-10",
  description: "HSSC Physics textbooks"
}, {
  id: "8",
  itemName: "Mathematics Books",
  category: "Library Books",
  quantity: 120,
  unitPrice: 750,
  totalValue: 90000,
  purchaseDate: "2024-01-05",
  supplier: "Academic Publishers",
  condition: "New",
  location: "Library",
  assignedTo: "Class",
  assignedToName: "HSSC XII-A",
  assignedDate: "2024-01-10",
  description: "HSSC Mathematics textbooks"
}, {
  id: "9",
  itemName: "Office Chairs",
  category: "Furniture",
  quantity: 50,
  unitPrice: 8000,
  totalValue: 400000,
  purchaseDate: "2023-07-20",
  supplier: "Furniture Depot",
  condition: "Good",
  location: "Various Offices",
  assignedTo: "Department",
  assignedToName: "Administration",
  assignedDate: "2023-07-25",
  maintenanceCost: 12000,
  lastMaintenanceDate: "2024-07-20",
  warrantyExpiry: "2025-07-20",
  description: "Ergonomic office chairs"
}, {
  id: "10",
  itemName: "Student Desks",
  category: "Furniture",
  quantity: 200,
  unitPrice: 3500,
  totalValue: 700000,
  purchaseDate: "2023-06-15",
  supplier: "Furniture Depot",
  condition: "Good",
  location: "Classrooms",
  assignedTo: "Class",
  assignedToName: "Multiple Classes",
  assignedDate: "2023-06-20",
  maintenanceCost: 25000,
  lastMaintenanceDate: "2024-06-15",
  warrantyExpiry: "2025-06-15",
  description: "Double-seat student desks"
}, {
  id: "11",
  itemName: "Whiteboard Markers",
  category: "Office Supplies",
  quantity: 500,
  unitPrice: 50,
  totalValue: 25000,
  purchaseDate: "2024-01-20",
  supplier: "Stationary World",
  condition: "New",
  location: "Store Room",
  assignedTo: "Unassigned",
  description: "Assorted color markers"
}, {
  id: "12",
  itemName: "Projectors",
  category: "Teaching Aids",
  quantity: 8,
  unitPrice: 35000,
  totalValue: 280000,
  purchaseDate: "2023-09-10",
  supplier: "Tech Solutions",
  condition: "Good",
  location: "Various Classrooms",
  assignedTo: "Class",
  assignedToName: "Multiple Classes",
  assignedDate: "2023-09-15",
  maintenanceCost: 18000,
  lastMaintenanceDate: "2024-09-10",
  warrantyExpiry: "2025-09-10",
  description: "HD projectors for presentations"
}, {
  id: "13",
  itemName: "Smart Board",
  category: "Teaching Aids",
  quantity: 3,
  unitPrice: 85000,
  totalValue: 255000,
  purchaseDate: "2024-02-01",
  supplier: "Tech Solutions",
  condition: "New",
  location: "Conference Room",
  assignedTo: "Department",
  assignedToName: "Administration",
  assignedDate: "2024-02-05",
  warrantyExpiry: "2027-02-01",
  description: "Interactive smart boards"
}, {
  id: "14",
  itemName: "Table Tennis Table",
  category: "Sports Equipment",
  quantity: 2,
  unitPrice: 25000,
  totalValue: 50000,
  purchaseDate: "2023-11-20",
  supplier: "Sports Mart",
  condition: "Good",
  location: "Common Room",
  assignedTo: "Department",
  assignedToName: "Sports Department",
  assignedDate: "2023-11-25",
  maintenanceCost: 3000,
  lastMaintenanceDate: "2024-11-20",
  description: "Tournament standard tables"
}, {
  id: "15",
  itemName: "Photocopier Machine",
  category: "Office Supplies",
  quantity: 2,
  unitPrice: 120000,
  totalValue: 240000,
  purchaseDate: "2023-10-15",
  supplier: "Office Equipment Ltd",
  condition: "Good",
  location: "Admin Office",
  assignedTo: "Department",
  assignedToName: "Administration",
  assignedDate: "2023-10-20",
  maintenanceCost: 22000,
  lastMaintenanceDate: "2024-10-15",
  warrantyExpiry: "2025-10-15",
  description: "High-speed photocopiers"
}];
const initialInventoryExpenses = [{
  id: "1",
  inventoryItemId: "1",
  itemName: "Microscope",
  expenseType: "Maintenance",
  amount: 15000,
  date: "2024-10-15",
  description: "Annual maintenance and calibration",
  vendor: "Scientific Supplies Ltd"
}, {
  id: "2",
  inventoryItemId: "3",
  itemName: "Desktop Computers",
  expenseType: "Repair",
  amount: 25000,
  date: "2024-11-10",
  description: "Replaced faulty RAM and hard drives",
  vendor: "Tech Solutions"
}, {
  id: "3",
  inventoryItemId: "5",
  itemName: "Football",
  expenseType: "Replacement",
  amount: 2500,
  date: "2024-09-10",
  description: "Replaced damaged footballs",
  vendor: "Sports Mart"
}, {
  id: "4",
  inventoryItemId: "9",
  itemName: "Office Chairs",
  expenseType: "Maintenance",
  amount: 12000,
  date: "2024-07-20",
  description: "Upholstery repair and wheel replacement",
  vendor: "Furniture Depot"
}, {
  id: "5",
  inventoryItemId: "12",
  itemName: "Projectors",
  expenseType: "Upgrade",
  amount: 18000,
  date: "2024-09-10",
  description: "Replaced projector lamps and cleaned lenses",
  vendor: "Tech Solutions"
}];
const initialChallanTemplates = [{
  id: "1",
  name: "Standard Challan Template",
  isDefault: true,
  createdAt: "2025-01-01",
  createdBy: "admin",
  htmlContent: `
<!DOCTYPE html>
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
  body { font-family: 'Roboto', sans-serif; font-size: 10px; margin: 0; padding: 10px; -webkit-print-color-adjust: exact; }
  .challan-container { display: flex; justify-content: space-between; gap: 10px; width: 100%; box-sizing: border-box; }
  .challan-copy { flex: 1; border: 1px solid #999; padding: 0; max-width: 32.5%; box-sizing: border-box; display: flex; flex-direction: column; }
  
  /* Header */
  .header { display: flex; padding: 10px; align-items: center; justify-content: center; gap: 10px; border-bottom: 1px solid #ccc; }
  .logo { width: 40px; height: 40px; background-color: #f29200; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 4px; }
  .institute-info { text-align: center; }
  .institute-info h1 { margin: 0; font-size: 14px; font-weight: bold; color: #000; }
  .institute-info p { margin: 2px 0; font-size: 9px; color: #333; }

  /* Bank Info */
  .bank-info { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 5px; border-bottom: 1px solid #ccc; }
  .bank-logo { font-weight: bold; color: #0056b3; font-style: italic; font-size: 12px; }
  .account-info { text-align: center; font-size: 10px; }
  .account-info strong { display: block; }

  /* Student Details Grid */
  .details-grid { display: grid; grid-template-columns: 100px 1fr; border-bottom: 1px solid #ccc; }
  .grid-row { display: contents; }
  .grid-label { padding: 4px 8px; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; font-weight: bold; background-color: #f9f9f9; }
  .grid-value { padding: 4px 8px; border-bottom: 1px solid #ccc; }
  .grid-row:last-child .grid-label, .grid-row:last-child .grid-value { border-bottom: none; }

  /* Fee Table */
  .fee-table { width: 100%; border-collapse: collapse; margin-top: 0; flex-grow: 1; }
  .fee-table th { background-color: #ed7d31; color: black; padding: 4px 8px; text-align: left; border: 1px solid #ccc; font-weight: bold; font-size: 10px; }
  .fee-table th:last-child { text-align: right; }
  .fee-table td { padding: 4px 8px; border: 1px solid #ccc; font-size: 10px; }
  .fee-table td:last-child { text-align: right; }
  
  /* Fee Rows Height Fix to match look */
  .fee-table tbody tr td { height: 14px; } 

  /* Totals */
  .total-row td { background-color: #ed7d31; color: black; font-weight: bold; border-top: 2px solid #000; }
  .late-fee-row td { color: black; font-weight: bold; text-align: center; border: 1px solid #ccc; padding: 5px; }

  /* Instructions */
  .instructions { padding: 10px; font-size: 8px; border-top: 1px solid #ccc; }
  .instructions h3 { margin: 0 0 2px 0; font-size: 9px; font-weight: bold; }
  .instructions ol { margin: 0; padding-left: 15px; }
  .instructions li { margin-bottom: 1px; }

  /* Signatures */
  .signatures { display: flex; justify-content: space-between; padding: 20px 10px 5px 10px; margin-top: auto; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #000; width: 80px; margin-bottom: 2px; }
  .sig-label { font-size: 8px; }

  /* Footer Label */
  .footer-label { background-color: #ed7d31; color: black; text-align: center; padding: 4px; font-weight: bold; font-size: 10px; border-top: 1px solid #000; }
</style>
</head>
<body>
<div class="challan-container">
  <!-- Copy Loop -->
  ${['Bank Copy', 'Institute Copy', 'Student Copy'].map(copyName => `
  <div class="challan-copy">
    <!-- Header -->
    <div class="header">
      <div class="logo">LOGO</div>
      <div class="institute-info">
        <h1>Concordia College Peshawar</h1>
        <p>60-C, Near NCS School, University Town Peshawar</p>
        <p>091-5619915 | 0332-8581222</p>
      </div>
    </div>

    <!-- Bank -->
    <div class="bank-info">
      <div class="bank-logo">UBL</div>
      <div class="account-info">
        <strong>United Bank Limited</strong>
        <span>A/C No. 340346138</span>
      </div>
    </div>

    <!-- Student Details -->
    <div class="details-grid">
      <div class="grid-row"><div class="grid-label">Challan Number</div><div class="grid-value">{{challanNo}}</div></div>
      <div class="grid-row"><div class="grid-label">Issue Date</div><div class="grid-value">{{issueDate}}</div></div>
      <div class="grid-row"><div class="grid-label">Valid Date</div><div class="grid-value">{{dueDate}}</div></div>
      <div class="grid-row" style="border-top: 1px solid #ccc; padding-top: 5px; margin-top: 5px"><div class="grid-label">Student Name</div><div class="grid-value">{{studentName}}</div></div>
      <div class="grid-row"><div class="grid-label">Father Name</div><div class="grid-value">{{fatherName}}</div></div>
      <div class="grid-row"><div class="grid-label">Student Id</div><div class="grid-value">{{rollNo}}</div></div>
      <div class="grid-row"><div class="grid-label">Class / Section</div><div class="grid-value">{{class}} / {{section}}</div></div>
    </div>

    <!-- Fees -->
    <table class="fee-table">
      <thead>
        <tr>
          <th>Particulars</th>
          <th>Amount (PKR)</th>
        </tr>
      </thead>
      <tbody>
        {{feeHeadsRows}}
        
        <tr><td>Tuition Fee</td><td>{{Tuition Fee}}</td></tr>
        
        <tr>
          <td>Arrears</td>
          <td>{{arrears}}</td>
        </tr>
        <tr>
          <td>Discount</td>
          <td>{{discount}}</td>
        </tr>
        <tr class="total-row">
          <td>Total Payable within due date</td>
          <td>{{totalPayable}}</td>
        </tr>
        <tr class="late-fee-row">
          <td>Late Fee Fine after due date</td>
          <td>Rs. 150 Per Day</td>
        </tr>
      </tbody>
    </table>

    <!-- Instructions -->
    <div class="instructions">
      <h3>Instructions:</h3>
      <ol>
        <li>Dues once paid are non refundable non transferable.</li>
        <li>Rs. 100/- will be charged in case of Re-Issuance of Challan.</li>
        <li>Scholarship/Concession will be cancelled if a student dont maintain minimum 70% Attendance and 80% academic record.</li>
        <li>Fines will be calculated as per policy.</li>
        <li>Rs. 150/- per day late fee will be charged on the challan after due date.</li>
      </ol>
    </div>

    <!-- Footer -->
    <div class="signatures">
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Bank/Account Officer Signature</div>
      </div>
      <div class="sig-box">
        <div class="sig-line"></div>
        <div class="sig-label">Depositor Signature</div>
      </div>
    </div>
    <div class="footer-label">${copyName}</div>
  </div>
  `).join('')}
</div>
</body>
</html>
`
}];
const initialMarksheetTemplates = [{
  id: "1",
  name: "Standard Marksheet Template",
  isDefault: true,
  createdAt: "2025-01-01",
  createdBy: "admin",
  htmlContent: `
      <div style="max-width: 900px; margin: 0 auto; padding: 40px; font-family: Arial, sans-serif; border: 2px solid #F29200;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #F29200; margin: 0;">{{instituteName}}</h1>
          <p style="margin: 5px 0;">{{instituteAddress}}</p>
          <h2 style="color: #333; margin: 20px 0;">EXAMINATION MARKSHEET</h2>
        </div>
        <div style="background: #F29200; color: white; padding: 10px; text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0;">
          {{examName}} - {{session}}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 20px 0;">
          <div><strong>Student Name:</strong> {{studentName}}</div>
          <div><strong>Roll Number:</strong> {{rollNumber}}</div>
          <div><strong>Father Name:</strong> {{fatherName}}</div>
          <div><strong>Class:</strong> {{class}}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin: 30px 0;">
          <thead>
            <tr style="background: #F29200; color: white;">
              <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Subject</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Total Marks</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Obtained Marks</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Percentage</th>
              <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Grade</th>
            </tr>
          </thead>
          <tbody>
            {{#each subjects}}
            <tr>
              <td style="border: 1px solid #ddd; padding: 10px;">{{name}}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{totalMarks}}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{obtainedMarks}}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{percentage}}%</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{grade}}</td>
            </tr>
            {{/each}}
          </tbody>
          <tfoot>
            <tr style="background: #f5f5f5; font-weight: bold;">
              <td style="border: 1px solid #ddd; padding: 10px;">TOTAL</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{totalMarks}}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{obtainedMarks}}</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{percentage}}%</td>
              <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">{{grade}}</td>
            </tr>
          </tfoot>
        </table>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
          <div>
            <p><strong>GPA:</strong> {{gpa}}</p>
            <p><strong>Position:</strong> {{position}}</p>
            <p><strong>Result:</strong> {{result}}</p>
          </div>
          <div>
            <p><strong>Remarks:</strong> {{remarks}}</p>
          </div>
        </div>
        <div style="margin-top: 60px; display: flex; justify-content: space-between;">
          <div style="text-align: center;">
            <div style="border-top: 1px solid #000; padding-top: 5px; width: 200px;">Class Teacher</div>
          </div>
          <div style="text-align: center;">
            <div style="border-top: 1px solid #000; padding-top: 5px; width: 200px;">Principal</div>
          </div>
        </div>
      </div>
    `
}];
const initialIDCardTemplates = [{
  id: "1",
  name: "Standard ID Card Template",
  isDefault: true,
  createdAt: "2025-01-01",
  createdBy: "admin",
  htmlContent: `
      <div style="width: 350px; height: 550px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif; border: 2px solid #F29200; border-radius: 10px; background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);">
        <div style="text-align: center; margin-bottom: 15px; padding: 10px; background: #F29200; color: white; border-radius: 5px;">
          <h2 style="margin: 0; font-size: 18px;">{{instituteName}}</h2>
          <p style="margin: 5px 0; font-size: 11px;">Student Identity Card</p>
        </div>
        <div style="text-align: center; margin: 15px 0;">
          <div style="width: 120px; height: 140px; margin: 0 auto; border: 2px solid #F29200; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #666;">
            Photo
          </div>
        </div>
        <div style="margin: 15px 0; font-size: 13px; line-height: 1.8;">
          <div style="display: flex; margin: 8px 0;">
            <strong style="width: 100px;">Name:</strong>
            <span>{{studentName}}</span>
          </div>
          <div style="display: flex; margin: 8px 0;">
            <strong style="width: 100px;">Roll No:</strong>
            <span>{{rollNumber}}</span>
          </div>
          <div style="display: flex; margin: 8px 0;">
            <strong style="width: 100px;">Class:</strong>
            <span>{{class}}</span>
          </div>
          <div style="display: flex; margin: 8px 0;">
            <strong style="width: 100px;">Session:</strong>
            <span>{{session}}</span>
          </div>
          <div style="display: flex; margin: 8px 0;">
            <strong style="width: 100px;">Contact:</strong>
            <span>{{phone}}</span>
          </div>
        </div>
        <div style="margin-top: 20px; text-align: center; font-size: 11px; color: #666;">
          <p style="margin: 5px 0;">{{instituteAddress}}</p>
          <p style="margin: 5px 0;">{{institutePhone}}</p>
        </div>
      </div>
    `
}];
const initialTeacherIDCardTemplates = [{
  id: "1",
  name: "Standard Teacher ID Card",
  isDefault: true,
  createdAt: "2025-01-01",
  createdBy: "admin",
  htmlContent: `
<div class="id-card-container" style="font-family: 'Times New Roman', serif; display: flex; gap: 20px; padding: 20px;">
    <!-- Front Side -->
    <div style="width: 322px; height: 530px; background-image: url('https://placehold.co/322x530/orange/white?text=Background+Image'); background-size: cover; background-position: center; border: 1px solid #ccc; position: relative; overflow: hidden; color: #000; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; padding: 15px 15px 5px 15px; align-items: flex-start;">
             <div style="display: flex; align-items: center;">
                <img src="{{logoUrl}}" alt="Concordia" style="height: 40px; display: block;">
             </div>
             <div>
                <img src="https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/Beaconhouse_School_System_logo.svg/1200px-Beaconhouse_School_System_logo.svg.png" alt="Beaconhouse" style="height: 35px; display: block;">
             </div>
        </div>

        <div style="text-align: center; margin-top: 5px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; color: #000; line-height: 1.1; font-family: 'Times New Roman', serif; text-shadow: 0px 0px 1px rgba(0,0,0,0.1);">CONCORDIA COLLEGE<br>PESHAWAR CAMPUS</h1>
            <p style="margin: 5px 0 0; font-size: 16px; font-weight: bold; font-family: 'UnifrakturMaguntia', 'Gothic', serif; color: #000;">A Project of Beaconhouse</p>
        </div>

        <!-- Photo -->
         <div style="display: flex; justify-content: center; margin-top: 25px;">
            <div style="width: 150px; height: 150px; border-radius: 50%; border: 5px solid #F29200; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;">
                {{employeePhoto}} 
            </div>
         </div>

         <!-- Details -->
         <div style="text-align: center; margin-top: 20px;">
            <h2 style="margin: 0; font-size: 26px; font-weight: 900; color: #4a3b2b; text-transform: uppercase; font-family: Arial, sans-serif;">{{name}}</h2>
             <div style="border-bottom: 2px solid #000; width: 85%; margin: 8px auto;"></div>
            <p style="margin: 5px 0; font-size: 18px; font-weight: 900; color: #4a3b2b; text-transform: uppercase; letter-spacing: 0.5px; font-family: Arial, sans-serif;">{{designation}}</p>
            <p style="margin: 15px 0; font-size: 18px; font-weight: 900; color: #4a3b2b; font-family: Arial, sans-serif;">EMPLOYEE ID: {{employeeId}}</p>
         </div>

         <!-- Footer -->
         <div style="position: absolute; bottom: 0; width: 100%;">
            <div style="padding: 5px 15px; font-size: 14px; font-weight: bold; color: #4a3b2b; display: flex; flex-direction: column;">
                <span style="text-decoration: underline; font-weight: 900; font-size: 16px; font-family: Arial, sans-serif;">Issued</span>
                <span style="font-family: Arial, sans-serif;">{{issueDate}}</span>
            </div>
            <div style="background-color: #F29200; color: #4a3b2b; text-align: center; padding: 8px 0; font-weight: 900; font-size: 22px; letter-spacing: 1px; font-family: 'Times New Roman', serif; text-transform: uppercase; border-top: 1px solid #da8300;">
                EMPLOYEE
            </div>
         </div>
    </div>

    <!-- Back Side -->
    <div style="width: 322px; height: 530px; background-image: url('https://placehold.co/322x530/orange/white?text=Background+Image'); background-size: cover; background-position: center; border: 1px solid #ccc; position: relative; overflow: hidden; color: #000; padding: 20px; box-sizing: border-box; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; margin-bottom: 25px; align-items: flex-start;">
             <div style="display: flex; align-items: center;">
                <img src="{{logoUrl}}" alt="Concordia" style="height: 40px; display: block;">
             </div>
             <div>
                <img src="https://upload.wikimedia.org/wikipedia/en/thumb/3/3a/Beaconhouse_School_System_logo.svg/1200px-Beaconhouse_School_System_logo.svg.png" alt="Beaconhouse" style="height: 35px; display: block;">
             </div>
        </div>

        <h3 style="color: #F29200; font-size: 18px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #F29200; display: inline-block; padding-bottom: 2px; margin: 0 0 25px 0; font-family: 'Times New Roman', serif;">PERSONAL INFORMATION</h3>

        <div style="font-size: 13px; font-weight: 900; line-height: 1.6; color: #4a3b2b; font-family: Arial, sans-serif;">
            <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Father Name :</span>
                <span style="flex: 1;">{{fatherName}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Contact Number :</span>
                <span style="flex: 1;">{{phone}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">CNIC No:</span>
                <span style="flex: 1;">{{cnic}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Date of Birth :</span>
                <span style="flex: 1;">{{dob}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Email Address:</span>
                <span style="flex: 1; word-break: break-all;">{{email}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Blood Group:</span>
                <span style="flex: 1;">{{bloodGroup}}</span>
            </div>
             <div style="display: flex; margin-bottom: 5px;">
                <span style="width: 130px; color: #4a3b2b;">Address :</span>
                <span style="flex: 1; line-height: 1.2;">{{address}}</span>
            </div>
        </div>

        <div style="border-bottom: 2px solid #000; margin: 25px 0;"></div>

        <div style="text-align: center; font-size: 11px; font-weight: 900; color: #4a3b2b; line-height: 1.4; font-family: Arial, sans-serif;">
            <p style="margin: 0;">This card is the Property of Concordia College Peshawar.</p>
            <p style="margin: 0;">This Card is non-transferable and is valid for Concordia<br>College Peshawar Campus ONLY.</p>
            
            <p style="margin: 15px 0 5px 0;">If Found Please return to:</p>
            <p style="margin: 5px 0; font-size: 11px;">Concordia College Peshawar<br>Address: 60-C University Road, University Town,<br>Peshawar, KPK, Pakistan</p>
             <p style="margin: 10px 0;">Telephone: 091-5619915 &nbsp; WhatsApp: 0332-8581222</p>
        </div>

        <!-- Barcode Placeholder -->
        <div style="position: absolute; bottom: 20px; width: 100%; text-align: center; left: 0;">
             <div style="font-family: 'Code 39', sans-serif; font-size: 30px;">|| ||| || ||| || |||</div>
        </div>

    </div>
</div>
  `
}];
const initialFeeHeads = [{
  id: "1",
  name: "Tuition Fee",
  description: "Monthly tuition fee",
  amount: 10000,
  isDiscount: false
}, {
  id: "2",
  name: "Lab Fee",
  description: "Laboratory charges",
  amount: 2000,
  isDiscount: false
}, {
  id: "3",
  name: "Library Fee",
  description: "Library membership",
  amount: 1000,
  isDiscount: false
}, {
  id: "4",
  name: "Early Payment Discount",
  description: "5% discount for early payment",
  amount: 500,
  isDiscount: true
}];
const initialFeeStructures = [{
  id: "1",
  program: "HSSC",
  className: "XI",
  feeHeads: ["1", "2", "3"],
  totalAmount: 13000,
  installments: 10
}, {
  id: "2",
  program: "HSSC",
  className: "XII",
  feeHeads: ["1", "2", "3"],
  totalAmount: 13000,
  installments: 10
}, {
  id: "3",
  program: "BS",
  className: "Semester 1",
  feeHeads: ["1", "2", "3"],
  totalAmount: 18000,
  installments: 2
}];
const initialShortLeaves = [{
  id: "1",
  studentId: "1",
  studentName: "Ahmed Ali",
  class: "XI",
  section: "A",
  reason: "Doctor appointment",
  date: "2025-01-26",
  status: "approved",
  approvedBy: "Principal"
}, {
  id: "2",
  studentId: "3",
  studentName: "Hassan Raza",
  class: "Semester 2",
  section: "A",
  reason: "Family emergency",
  date: "2025-01-27",
  status: "pending"
}];
const DataContext = createContext(undefined);
export const DataProvider = ({
  children
}) => {
  const [students, setStudents] = useState(initialStudents);
  const [fees, setFees] = useState(initialFees);
  const [feeHeads, setFeeHeads] = useState(initialFeeHeads);
  const [feeStructures, setFeeStructures] = useState(initialFeeStructures);
  const [attendance, setAttendance] = useState(initialAttendance);
  const [shortLeaves, setShortLeaves] = useState(initialShortLeaves);
  const [exams, setExams] = useState(initialExams);
  const [marks, setMarks] = useState(initialMarks);
  const [results, setResults] = useState(initialResults);
  const [programs, setPrograms] = useState(initialPrograms);
  const [classes, setClasses] = useState(initialClasses);
  const [sections, setSections] = useState(initialSections);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [teacherMapping, setTeacherMapping] = useState(initialTeacherMapping);
  const [teacherClassMapping, setTeacherClassMapping] = useState(initialTeacherClassMapping);
  const [timetable, setTimetable] = useState(initialTimetable);
  const [assignments, setAssignments] = useState(initialAssignments);
  // config removed - now fetched directly via backend/react-query
  const [branches, setBranches] = useState(initialBranches);
  const [roles, setRoles] = useState(initialRoles);
  const [admins, setAdmins] = useState(initialAdmins);
  const [inquiries, setInquiries] = useState(initialInquiries);
  const [visitors, setVisitors] = useState(initialVisitors);
  const [complaints, setComplaints] = useState(initialComplaints);
  const [contacts, setContacts] = useState(initialContacts);
  const [staff, setStaff] = useState(initialStaff);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [employees, setEmployees] = useState(initialEmployees);
  const [payrolls, setPayrolls] = useState(initialPayrolls);
  const [advanceSalaries, setAdvanceSalaries] = useState(initialAdvanceSalaries);
  const [employeeAttendance, setEmployeeAttendance] = useState(initialEmployeeAttendance);
  const [leaveRequests, setLeaveRequests] = useState(initialLeaveRequests);
  const [departments, setDepartments] = useState(initialDepartments);
  const [hostelRegistrations, setHostelRegistrations] = useState(initialHostelRegistrations);
  const [rooms, setRooms] = useState(initialRooms);
  const [messAllocations, setMessAllocations] = useState(initialMessAllocations);
  const [hostelExpenses, setHostelExpenses] = useState(initialHostelExpenses);
  const [inventoryItems, setInventoryItems] = useState(initialInventoryItems);
  const [financeIncome, setFinanceIncome] = useState(initialFinanceIncome);
  const [financeExpenses, setFinanceExpenses] = useState(initialFinanceExpenses);
  const [financeClosings, setFinanceClosings] = useState(initialFinanceClosings);

  const [challanTemplates, setChallanTemplates] = useState(initialChallanTemplates);
  const [idCardTemplates, setIdCardTemplates] = useState(initialIDCardTemplates);
  const [teacherIdCardTemplates, setTeacherIdCardTemplates] = useState(initialTeacherIDCardTemplates);
  const addStudent = student => {
    const newStudent = {
      ...student,
      id: Date.now().toString()
    };
    setStudents([...students, newStudent]);
  };

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const idCardData = await getIDCardTemplates();
        setIdCardTemplates(idCardData);
        const challanData = await getFeeChallanTemplates();
        setChallanTemplates(challanData);
        const teacherIdCardData = await getTeacherIDCardTemplates();
        if (teacherIdCardData && teacherIdCardData.length > 0) {
          setTeacherIdCardTemplates(teacherIdCardData);
        }

        // Fetch Institute Settings
        const settings = await getInstituteSettings();
        if (settings) {
          // setConfig(settings); // Removed
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchTemplates();
  }, []);
  const updateStudent = (id, studentData) => {
    setStudents(students.map(s => s.id === id ? {
      ...s,
      ...studentData
    } : s));
  };
  const deleteStudent = id => {
    setStudents(students.filter(s => s.id !== id));
  };
  const addFee = fee => {
    const newFee = {
      ...fee,
      id: Date.now().toString()
    };
    setFees([...fees, newFee]);
  };
  const updateFee = (id, feeData) => {
    setFees(fees.map(f => f.id === id ? {
      ...f,
      ...feeData
    } : f));
  };
  const deleteFee = id => {
    setFees(fees.filter(f => f.id !== id));
  };
  const addFeeHead = feeHead => {
    const newFeeHead = {
      ...feeHead,
      id: Date.now().toString()
    };
    setFeeHeads([...feeHeads, newFeeHead]);
  };
  const updateFeeHead = (id, feeHeadData) => {
    setFeeHeads(feeHeads.map(f => f.id === id ? {
      ...f,
      ...feeHeadData
    } : f));
  };
  const deleteFeeHead = id => {
    setFeeHeads(feeHeads.filter(f => f.id !== id));
  };
  const addFeeStructure = feeStructure => {
    const newFeeStructure = {
      ...feeStructure,
      id: Date.now().toString()
    };
    setFeeStructures([...feeStructures, newFeeStructure]);
  };
  const updateFeeStructure = (id, feeStructureData) => {
    setFeeStructures(feeStructures.map(f => f.id === id ? {
      ...f,
      ...feeStructureData
    } : f));
  };
  const deleteFeeStructure = id => {
    setFeeStructures(feeStructures.filter(f => f.id !== id));
  };
  const addAttendance = att => {
    const newAtt = {
      ...att,
      id: Date.now().toString()
    };
    setAttendance([...attendance, newAtt]);
  };
  const updateAttendance = (id, attendanceData) => {
    setAttendance(attendance.map(a => a.id === id ? {
      ...a,
      ...attendanceData
    } : a));
  };
  const deleteAttendance = id => {
    setAttendance(attendance.filter(a => a.id !== id));
  };
  const addShortLeave = shortLeave => {
    const newShortLeave = {
      ...shortLeave,
      id: Date.now().toString()
    };
    setShortLeaves([...shortLeaves, newShortLeave]);
  };
  const updateShortLeave = (id, shortLeaveData) => {
    setShortLeaves(shortLeaves.map(s => s.id === id ? {
      ...s,
      ...shortLeaveData
    } : s));
  };
  const deleteShortLeave = id => {
    setShortLeaves(shortLeaves.filter(s => s.id !== id));
  };
  const addExam = exam => {
    const newExam = {
      ...exam,
      id: Date.now().toString()
    };
    setExams([...exams, newExam]);
  };
  const updateExam = (id, examData) => {
    setExams(exams.map(e => e.id === id ? {
      ...e,
      ...examData
    } : e));
  };
  const deleteExam = id => {
    setExams(exams.filter(e => e.id !== id));
  };
  const addMarks = marksData => {
    const newMarks = {
      ...marksData,
      id: Date.now().toString()
    };
    setMarks([...marks, newMarks]);
  };
  const updateMarks = (id, marksData) => {
    setMarks(marks.map(m => m.id === id ? {
      ...m,
      ...marksData
    } : m));
  };
  const deleteMarks = id => {
    setMarks(marks.filter(m => m.id !== id));
  };
  const addResult = result => {
    const newResult = {
      ...result,
      id: Date.now().toString()
    };
    setResults([...results, newResult]);
  };
  const updateResult = (id, resultData) => {
    setResults(results.map(r => r.id === id ? {
      ...r,
      ...resultData
    } : r));
  };
  const deleteResult = id => {
    setResults(results.filter(r => r.id !== id));
  };
  const addProgram = program => {
    const newProgram = {
      ...program,
      id: Date.now().toString()
    };
    setPrograms([...programs, newProgram]);
  };
  const updateProgram = (id, programData) => {
    setPrograms(programs.map(p => p.id === id ? {
      ...p,
      ...programData
    } : p));
  };
  const deleteProgram = id => {
    setPrograms(programs.filter(p => p.id !== id));
  };
  const addClass = cls => {
    const newClass = {
      ...cls,
      id: Date.now().toString()
    };
    setClasses([...classes, newClass]);
  };
  const updateClass = (id, clsData) => {
    setClasses(classes.map(c => c.id === id ? {
      ...c,
      ...clsData
    } : c));
  };
  const deleteClass = id => {
    setClasses(classes.filter(c => c.id !== id));
  };
  const addSection = section => {
    const newSection = {
      ...section,
      id: Date.now().toString()
    };
    setSections([...sections, newSection]);
  };
  const updateSection = (id, sectionData) => {
    setSections(sections.map(s => s.id === id ? {
      ...s,
      ...sectionData
    } : s));
  };
  const deleteSection = id => {
    setSections(sections.filter(s => s.id !== id));
  };
  const addSubject = subject => {
    const newSubject = {
      ...subject,
      id: Date.now().toString()
    };
    setSubjects([...subjects, newSubject]);
  };
  const updateSubject = (id, subjectData) => {
    setSubjects(subjects.map(s => s.id === id ? {
      ...s,
      ...subjectData
    } : s));
  };
  const deleteSubject = id => {
    setSubjects(subjects.filter(s => s.id !== id));
  };
  const addTeacherMapping = mapping => {
    const newMapping = {
      ...mapping,
      id: Date.now().toString()
    };
    setTeacherMapping([...teacherMapping, newMapping]);
  };
  const updateTeacherMapping = (id, mappingData) => {
    setTeacherMapping(teacherMapping.map(m => m.id === id ? {
      ...m,
      ...mappingData
    } : m));
  };
  const deleteTeacherMapping = id => {
    setTeacherMapping(teacherMapping.filter(m => m.id !== id));
  };
  const addTeacherClassMapping = mapping => {
    const newMapping = {
      ...mapping,
      id: Date.now().toString()
    };
    setTeacherClassMapping([...teacherClassMapping, newMapping]);
  };
  const updateTeacherClassMapping = (id, mappingData) => {
    setTeacherClassMapping(teacherClassMapping.map(m => m.id === id ? {
      ...m,
      ...mappingData
    } : m));
  };
  const deleteTeacherClassMapping = id => {
    setTeacherClassMapping(teacherClassMapping.filter(m => m.id !== id));
  };
  const addTimetable = timetableData => {
    const newTimetable = {
      ...timetableData,
      id: Date.now().toString()
    };
    setTimetable([...timetable, newTimetable]);
  };
  const updateTimetable = (id, timetableData) => {
    setTimetable(timetable.map(t => t.id === id ? {
      ...t,
      ...timetableData
    } : t));
  };
  const deleteTimetable = id => {
    setTimetable(timetable.filter(t => t.id !== id));
  };
  const addAssignment = assignment => {
    const newAssignment = {
      ...assignment,
      id: Date.now().toString()
    };
    setAssignments([...assignments, newAssignment]);
  };
  const updateAssignment = (id, assignmentData) => {
    setAssignments(assignments.map(a => a.id === id ? {
      ...a,
      ...assignmentData
    } : a));
  };
  const deleteAssignment = id => {
    setAssignments(assignments.filter(a => a.id !== id));
  };
  // updateConfig removed - components should use getInstituteSettings API or useQuery

  const addBranch = branch => {
    const newBranch = {
      ...branch,
      id: Date.now().toString()
    };
    setBranches([...branches, newBranch]);
  };
  const updateBranch = (id, branchData) => {
    setBranches(branches.map(b => b.id === id ? {
      ...b,
      ...branchData
    } : b));
  };
  const deleteBranch = id => {
    setBranches(branches.filter(b => b.id !== id));
  };
  const addRole = role => {
    const newRole = {
      ...role,
      id: Date.now().toString()
    };
    setRoles([...roles, newRole]);
  };
  const updateRole = (id, roleData) => {
    setRoles(roles.map(r => r.id === id ? {
      ...r,
      ...roleData
    } : r));
  };
  const deleteRole = id => {
    setRoles(roles.filter(r => r.id !== id));
  };
  const addAdmin = admin => {
    const newAdmin = {
      ...admin,
      id: Date.now().toString()
    };
    setAdmins([...admins, newAdmin]);
  };
  const updateAdmin = (id, adminData) => {
    setAdmins(admins.map(a => a.id === id ? {
      ...a,
      ...adminData
    } : a));
  };
  const deleteAdmin = id => {
    setAdmins(admins.filter(a => a.id !== id));
  };
  const addInquiry = inquiry => {
    const newInquiry = {
      ...inquiry,
      id: Date.now().toString()
    };
    setInquiries([...inquiries, newInquiry]);
  };
  const updateInquiry = (id, inquiryData) => {
    setInquiries(inquiries.map(i => i.id === id ? {
      ...i,
      ...inquiryData
    } : i));
  };
  const deleteInquiry = id => {
    setInquiries(inquiries.filter(i => i.id !== id));
  };
  const addVisitor = visitor => {
    const newVisitor = {
      ...visitor,
      id: Date.now().toString()
    };
    setVisitors([...visitors, newVisitor]);
  };
  const updateVisitor = (id, visitorData) => {
    setVisitors(visitors.map(v => v.id === id ? {
      ...v,
      ...visitorData
    } : v));
  };
  const deleteVisitor = id => {
    setVisitors(visitors.filter(v => v.id !== id));
  };
  const addComplaint = complaint => {
    const newComplaint = {
      ...complaint,
      id: Date.now().toString()
    };
    setComplaints([...complaints, newComplaint]);
  };
  const updateComplaint = (id, complaintData) => {
    setComplaints(complaints.map(c => c.id === id ? {
      ...c,
      ...complaintData
    } : c));
  };
  const deleteComplaint = id => {
    setComplaints(complaints.filter(c => c.id !== id));
  };
  const addContact = contact => {
    const newContact = {
      ...contact,
      id: Date.now().toString()
    };
    setContacts([...contacts, newContact]);
  };
  const updateContact = (id, contactData) => {
    setContacts(contacts.map(c => c.id === id ? {
      ...c,
      ...contactData
    } : c));
  };
  const deleteContact = id => {
    setContacts(contacts.filter(c => c.id !== id));
  };
  const addStaff = staffMember => {
    const newStaff = {
      ...staffMember,
      id: Date.now().toString()
    };
    setStaff([...staff, newStaff]);
  };
  const updateStaff = (id, staffData) => {
    setStaff(staff.map(s => s.id === id ? {
      ...s,
      ...staffData
    } : s));
  };
  const deleteStaff = id => {
    setStaff(staff.filter(s => s.id !== id));
  };

  // Teacher CRUD
  const addTeacher = teacher => setTeachers([...teachers, {
    ...teacher,
    id: Date.now().toString()
  }]);
  const updateTeacher = (id, data) => setTeachers(teachers.map(t => t.id === id ? {
    ...t,
    ...data
  } : t));
  const deleteTeacher = id => setTeachers(teachers.filter(t => t.id !== id));

  // Employee CRUD
  const addEmployee = employee => setEmployees([...employees, {
    ...employee,
    id: Date.now().toString()
  }]);
  const updateEmployee = (id, data) => setEmployees(employees.map(e => e.id === id ? {
    ...e,
    ...data
  } : e));
  const deleteEmployee = id => setEmployees(employees.filter(e => e.id !== id));

  // Payroll CRUD
  const addPayroll = payroll => setPayrolls([...payrolls, {
    ...payroll,
    id: Date.now().toString()
  }]);
  const updatePayroll = (id, data) => setPayrolls(payrolls.map(p => p.id === id ? {
    ...p,
    ...data
  } : p));
  const deletePayroll = id => setPayrolls(payrolls.filter(p => p.id !== id));

  // Advance Salary CRUD
  const addAdvanceSalary = salary => setAdvanceSalaries([...advanceSalaries, {
    ...salary,
    id: Date.now().toString()
  }]);
  const updateAdvanceSalary = (id, data) => setAdvanceSalaries(advanceSalaries.map(a => a.id === id ? {
    ...a,
    ...data
  } : a));
  const deleteAdvanceSalary = id => setAdvanceSalaries(advanceSalaries.filter(a => a.id !== id));

  // Employee Attendance CRUD
  const addEmployeeAttendance = attendance => setEmployeeAttendance([...employeeAttendance, {
    ...attendance,
    id: Date.now().toString()
  }]);
  const updateEmployeeAttendance = (id, data) => setEmployeeAttendance(employeeAttendance.map(a => a.id === id ? {
    ...a,
    ...data
  } : a));
  const deleteEmployeeAttendance = id => setEmployeeAttendance(employeeAttendance.filter(a => a.id !== id));

  // Leave Request CRUD
  const addLeaveRequest = request => setLeaveRequests([...leaveRequests, {
    ...request,
    id: Date.now().toString()
  }]);
  const updateLeaveRequest = (id, data) => setLeaveRequests(leaveRequests.map(r => r.id === id ? {
    ...r,
    ...data
  } : r));
  const deleteLeaveRequest = id => setLeaveRequests(leaveRequests.filter(r => r.id !== id));

  // Department CRUD
  const addDepartment = dept => setDepartments([...departments, {
    ...dept,
    id: Date.now().toString()
  }]);
  const updateDepartment = (id, data) => setDepartments(departments.map(d => d.id === id ? {
    ...d,
    ...data
  } : d));
  const deleteDepartment = id => setDepartments(departments.filter(d => d.id !== id));

  // Hostel Registration CRUD
  const addHostelRegistration = reg => setHostelRegistrations([...hostelRegistrations, {
    ...reg,
    id: Date.now().toString()
  }]);
  const updateHostelRegistration = (id, data) => setHostelRegistrations(hostelRegistrations.map(r => r.id === id ? {
    ...r,
    ...data
  } : r));
  const deleteHostelRegistration = id => setHostelRegistrations(hostelRegistrations.filter(r => r.id !== id));

  // Room CRUD
  const addRoom = room => setRooms([...rooms, {
    ...room,
    id: Date.now().toString()
  }]);
  const updateRoom = (id, data) => setRooms(rooms.map(r => r.id === id ? {
    ...r,
    ...data
  } : r));
  const deleteRoom = id => setRooms(rooms.filter(r => r.id !== id));

  // Mess Allocation CRUD
  const addMessAllocation = allocation => setMessAllocations([...messAllocations, {
    ...allocation,
    id: Date.now().toString()
  }]);
  const updateMessAllocation = (id, data) => setMessAllocations(messAllocations.map(m => m.id === id ? {
    ...m,
    ...data
  } : m));
  const deleteMessAllocation = id => setMessAllocations(messAllocations.filter(m => m.id !== id));

  // Hostel Expense CRUD
  const addHostelExpense = expense => setHostelExpenses([...hostelExpenses, {
    ...expense,
    id: Date.now().toString()
  }]);
  const updateHostelExpense = (id, data) => setHostelExpenses(hostelExpenses.map(e => e.id === id ? {
    ...e,
    ...data
  } : e));
  const deleteHostelExpense = id => setHostelExpenses(hostelExpenses.filter(e => e.id !== id));

  // Inventory Item CRUD
  const addInventoryItem = item => setInventoryItems([...inventoryItems, {
    ...item,
    id: Date.now().toString()
  }]);
  const updateInventoryItem = (id, data) => setInventoryItems(inventoryItems.map(i => i.id === id ? {
    ...i,
    ...data
  } : i));
  const deleteInventoryItem = id => setInventoryItems(inventoryItems.filter(i => i.id !== id));

  // Finance Income CRUD
  const addFinanceIncome = income => setFinanceIncome([...financeIncome, {
    ...income,
    id: Date.now().toString()
  }]);
  const updateFinanceIncome = (id, data) => setFinanceIncome(financeIncome.map(i => i.id === id ? {
    ...i,
    ...data
  } : i));
  const deleteFinanceIncome = id => setFinanceIncome(financeIncome.filter(i => i.id !== id));

  // Finance Expense CRUD
  const addFinanceExpense = expense => setFinanceExpenses([...financeExpenses, {
    ...expense,
    id: Date.now().toString()
  }]);
  const updateFinanceExpense = (id, data) => setFinanceExpenses(financeExpenses.map(e => e.id === id ? {
    ...e,
    ...data
  } : e));
  const deleteFinanceExpense = id => setFinanceExpenses(financeExpenses.filter(e => e.id !== id));

  // Finance Closing CRUD
  const addFinanceClosing = closing => setFinanceClosings([...financeClosings, {
    ...closing,
    id: Date.now().toString()
  }]);
  const updateFinanceClosing = (id, data) => setFinanceClosings(financeClosings.map(c => c.id === id ? {
    ...c,
    ...data
  } : c));
  const deleteFinanceClosing = id => setFinanceClosings(financeClosings.filter(c => c.id !== id));



  // Challan Template CRUD
  // Challan Template CRUD
  const addChallanTemplate = async (template) => {
    try {
      const newTemplate = await createFeeChallanTemplate(template);
      setChallanTemplates([newTemplate, ...challanTemplates]);
      return newTemplate;
    } catch (error) {
      console.error("Error adding challan template:", error);
      throw error;
    }
  };

  const updateChallanTemplate = async (id, data) => {
    try {
      const updatedTemplate = await updateFeeChallanTemplate(id, data);
      setChallanTemplates(challanTemplates.map(t => t.id === id ? updatedTemplate : t));
      return updatedTemplate;
    } catch (error) {
      console.error("Error updating challan template:", error);
      throw error;
    }
  };

  const deleteChallanTemplate = async (id) => {
    try {
      await deleteFeeChallanTemplate(id);
      setChallanTemplates(challanTemplates.filter(t => t.id !== id));
    } catch (error) {
      console.error("Error deleting challan template:", error);
      throw error;
    }
  };

  // ID Card Template CRUD
  const addIDCardTemplate = template => setIdCardTemplates([...idCardTemplates, {
    ...template,
    id: Date.now().toString()
  }]);
  const updateIDCardTemplate = (id, data) => setIdCardTemplates(idCardTemplates.map(t => t.id === id ? {
    ...t,
    ...data
  } : t));
  const deleteIDCardTemplate = id => setIdCardTemplates(idCardTemplates.filter(t => t.id !== id));

  // Teacher ID Card Template CRUD
  const addTeacherIDCardTemplate = template => setTeacherIdCardTemplates([...teacherIdCardTemplates, {
    ...template,
    id: Date.now().toString()
  }]);
  const updateTeacherIDCardTemplate = (id, data) => setTeacherIdCardTemplates(teacherIdCardTemplates.map(t => t.id === id ? {
    ...t,
    ...data
  } : t));
  const deleteTeacherIDCardTemplate = id => setTeacherIdCardTemplates(teacherIdCardTemplates.filter(t => t.id !== id));
  return <DataContext.Provider value={{
    students,
    fees,
    feeHeads,
    feeStructures,
    attendance,
    shortLeaves,
    exams,
    marks,
    results,
    programs,
    classes,
    sections,
    subjects,
    teacherMapping,
    teacherClassMapping,
    timetable,
    assignments,
    // config: config, // Removed
    branches,
    roles,
    admins,
    inquiries,
    visitors,
    complaints,
    contacts,
    staff,
    teachers,
    employees,
    payrolls,
    advanceSalaries,
    employeeAttendance,
    leaveRequests,
    departments,
    hostelRegistrations,
    rooms,
    messAllocations,
    hostelExpenses,
    inventoryItems,
    financeIncome,
    financeExpenses,
    financeClosings,

    challanTemplates,
    idCardTemplates,
    addStudent,
    updateStudent,
    deleteStudent,
    addFee,
    updateFee,
    deleteFee,
    addFeeHead,
    updateFeeHead,
    deleteFeeHead,
    addFeeStructure,
    updateFeeStructure,
    deleteFeeStructure,
    addAttendance,
    updateAttendance,
    deleteAttendance,
    addShortLeave,
    updateShortLeave,
    deleteShortLeave,
    addExam,
    updateExam,
    deleteExam,
    addMarks,
    updateMarks,
    deleteMarks,
    addResult,
    updateResult,
    deleteResult,
    addProgram,
    updateProgram,
    deleteProgram,
    addClass,
    updateClass,
    deleteClass,
    addSection,
    updateSection,
    deleteSection,
    addSubject,
    updateSubject,
    deleteSubject,
    addTeacherMapping,
    updateTeacherMapping,
    deleteTeacherMapping,
    addTeacherClassMapping,
    updateTeacherClassMapping,
    deleteTeacherClassMapping,
    addTimetable,
    updateTimetable,
    deleteTimetable,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    // updateConfig, // Removed
    addBranch,
    updateBranch,
    deleteBranch,
    addRole,
    updateRole,
    deleteRole,
    addAdmin,
    updateAdmin,
    deleteAdmin,
    addInquiry,
    updateInquiry,
    deleteInquiry,
    addVisitor,
    updateVisitor,
    deleteVisitor,
    addComplaint,
    updateComplaint,
    deleteComplaint,
    addContact,
    updateContact,
    deleteContact,
    addStaff,
    updateStaff,
    deleteStaff,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addPayroll,
    updatePayroll,
    deletePayroll,
    addAdvanceSalary,
    updateAdvanceSalary,
    deleteAdvanceSalary,
    addEmployeeAttendance,
    updateEmployeeAttendance,
    deleteEmployeeAttendance,
    addLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    addHostelRegistration,
    updateHostelRegistration,
    deleteHostelRegistration,
    addRoom,
    updateRoom,
    deleteRoom,
    addMessAllocation,
    updateMessAllocation,
    deleteMessAllocation,
    addHostelExpense,
    updateHostelExpense,
    deleteHostelExpense,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addFinanceIncome,
    updateFinanceIncome,
    deleteFinanceIncome,
    addFinanceExpense,
    updateFinanceExpense,
    deleteFinanceExpense,
    addFinanceClosing,
    updateFinanceClosing,
    deleteFinanceClosing,

    addChallanTemplate,
    updateChallanTemplate,
    deleteChallanTemplate,
    addIDCardTemplate,
    updateIDCardTemplate,
    deleteIDCardTemplate,
    teacherIdCardTemplates,
    addTeacherIDCardTemplate,
    updateTeacherIDCardTemplate,
    deleteTeacherIDCardTemplate
  }}>
    {children}
  </DataContext.Provider>;
};
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within DataProvider");
  }
  return context;
};