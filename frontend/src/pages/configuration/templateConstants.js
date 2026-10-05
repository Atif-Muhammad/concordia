export const salarySlipTemplate = `
<div style="display: flex; gap: 20px; font-family: Arial, sans-serif; font-size: 12px; min-width: 900px;">
  <!-- Employee Copy -->
  <div style="flex: 1; border: 1px solid #ccc; padding: 10px;">
     <div style="text-align: center; margin-bottom: 5px;">
        <h2 style="margin: 0; font-size: 18px; color: #333;">Concordia College Peshawar</h2>
        <p style="margin: 0; font-size: 11px; color: #555;">60-C, Near NCS School, University Town Peshawar<br>091-5619915 | 0332-8581222</p>
     </div>
     <div style="background-color: #ed7d31; color: white; text-align: center; padding: 5px; font-weight: bold; margin-bottom: 10px; border: 1px solid #d66d28;">
        Salary Slip FMO {{month}}
     </div>
     
     <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9; width: 30%;">Employee Name</td><td style="border: 1px solid #ccc; padding: 4px;">{{name}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Employee Id</td><td style="border: 1px solid #ccc; padding: 4px;">{{id}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Designation</td><td style="border: 1px solid #ccc; padding: 4px;">{{designation}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Department</td><td style="border: 1px solid #ccc; padding: 4px;">{{department}}</td></tr>
     </table>

     <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc; margin-bottom: 10px; font-size: 11px;">
        <thead>
            <tr style="background-color: #fce4d6;">
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Allowances</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Amount</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Deductions</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Travelling</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{travelAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">EOBI</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{eobi}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">House Rent</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{houseRentAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Income Tax</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{incomeTax}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Medical</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{medicalAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Security</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{securityDeduction}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Insurance</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{insuranceAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Advance Salary</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{advanceDeduction}}</td></tr>
             <tr><td style="border: 1px solid #ccc; padding: 3px;">Other</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{otherAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Absentee</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{absentDeduction}}</td></tr>
             <tr><td style="border: 1px solid #ccc; padding: 3px;">Extra</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{extraAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Leave</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{leaveDeduction}}</td></tr>
              <tr><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;">Late Arrival</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{lateArrivalDeduction}}</td></tr>
              <tr><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;">Other</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{otherDeduction}}</td></tr>
        </tbody>
     </table>

     <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
        <tr><td style="border: 1px solid #ccc; padding: 4px; width: 60%;">Basic Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right; font-weight: bold;">{{basicSalary}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Advance Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{advanceDeduction}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Total Allowances</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{totalAllowances}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Total Deductions</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{totalDeductions}}</td></tr>
        <tr style="background-color: #f7f7f7;"><td style="border: 1px solid #ccc; padding: 4px; font-weight: bold;">Total Paid Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right; font-weight: bold;">{{netSalary}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Salary Paid Date</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{paymentDate}}</td></tr>
     </table>

     <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 2px solid #ed7d31; padding-top: 5px;">
        <span style="font-size: 10px;">Accounts Officer Signature</span>
        <span style="font-size: 10px;">Employee Signature</span>
     </div>
     <div style="background-color: #ed7d31; color: white; text-align: center; padding: 2px; font-size: 10px; margin-top: 5px;">Employee Copy</div>
  </div>

  <!-- Institute Copy -->
  <div style="flex: 1; border: 1px solid #ccc; padding: 10px;">
     <div style="text-align: center; margin-bottom: 5px;">
        <h2 style="margin: 0; font-size: 18px; color: #333;">Concordia College Peshawar</h2>
        <p style="margin: 0; font-size: 11px; color: #555;">60-C, Near NCS School, University Town Peshawar<br>091-5619915 | 0332-8581222</p>
     </div>
     <div style="background-color: #ed7d31; color: white; text-align: center; padding: 5px; font-weight: bold; margin-bottom: 10px; border: 1px solid #d66d28;">
        Salary Slip FMO {{month}}
     </div>
     
     <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9; width: 30%;">Employee Name</td><td style="border: 1px solid #ccc; padding: 4px;">{{name}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Employee Id</td><td style="border: 1px solid #ccc; padding: 4px;">{{id}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Designation</td><td style="border: 1px solid #ccc; padding: 4px;">{{designation}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px; background-color: #f9f9f9;">Department</td><td style="border: 1px solid #ccc; padding: 4px;">{{department}}</td></tr>
     </table>

     <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc; margin-bottom: 10px; font-size: 11px;">
        <thead>
            <tr style="background-color: #fce4d6;">
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Allowances</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Amount</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Deductions</th>
                <th style="border: 1px solid #ccc; padding: 4px; width: 25%;">Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Travelling</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{travelAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">EOBI</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{eobi}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">House Rent</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{houseRentAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Income Tax</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{incomeTax}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Medical</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{medicalAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Security</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{securityDeduction}}</td></tr>
            <tr><td style="border: 1px solid #ccc; padding: 3px;">Insurance</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{insuranceAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Advance Salary</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{advanceDeduction}}</td></tr>
             <tr><td style="border: 1px solid #ccc; padding: 3px;">Other</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{otherAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Absentee</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{absentDeduction}}</td></tr>
             <tr><td style="border: 1px solid #ccc; padding: 3px;">Extra</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{extraAllowance}}</td><td style="border: 1px solid #ccc; padding: 3px;">Leave</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{leaveDeduction}}</td></tr>
              <tr><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;">Late Arrival</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{lateArrivalDeduction}}</td></tr>
              <tr><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;"></td><td style="border: 1px solid #ccc; padding: 3px;">Other</td><td style="border: 1px solid #ccc; padding: 3px; text-align: right;">{{otherDeduction}}</td></tr>
        </tbody>
     </table>

     <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
        <tr><td style="border: 1px solid #ccc; padding: 4px; width: 60%;">Basic Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right; font-weight: bold;">{{basicSalary}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Advance Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{advanceDeduction}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Total Allowances</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{totalAllowances}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Total Deductions</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{totalDeductions}}</td></tr>
        <tr style="background-color: #f7f7f7;"><td style="border: 1px solid #ccc; padding: 4px; font-weight: bold;">Total Paid Salary</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right; font-weight: bold;">{{netSalary}}</td></tr>
        <tr><td style="border: 1px solid #ccc; padding: 4px;">Salary Paid Date</td><td style="border: 1px solid #ccc; padding: 4px; text-align: right;">{{paymentDate}}</td></tr>
     </table>

     <div style="display: flex; justify-content: space-between; margin-top: 40px; border-top: 2px solid #ed7d31; padding-top: 5px;">
        <span style="font-size: 10px;">Accounts Officer Signature</span>
        <span style="font-size: 10px;">Employee Signature</span>
     </div>
     <div style="background-color: #ed7d31; color: white; text-align: center; padding: 2px; font-size: 10px; margin-top: 5px;">Institute Copy</div>
  </div>
</div>
`;

export const payrollSheetTemplate = `
<div style="font-family: Arial, sans-serif; font-size: 12px; width: 100%;">
  <div style="width: 100%; display: flex; align-items: center; justify-content: center;">
    <img style="width: 10%;" src="https://beams.hayatfoundation.org.pk/backend/template-requirements/logo.png" />
    <div style="text-align: center; margin-bottom: 5px;">
      <h2 style="margin: 0; font-size: 18px; color: #333;">Concordia College Peshawar</h2>
      <p style="margin: 0; font-size: 11px; color: #555;">60-C, Near NCS School, University Town Peshawar<br>091-5619915 | 0332-8581222</p>
    </div>
  </div>
  <div style="background-color: #ed7d31; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 16px; margin-bottom: 15px; border: 1px solid #d66d28;">
    Employees Salary / Payroll Sheet
  </div>

  <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border: 1px solid #ccc; padding: 8px; background-color: #f9f9f9;">
    <div><strong>Month:</strong> {{month}}</div>
    <div><strong>Session:</strong> 2024-2025</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead>
      <tr style="background-color: #fce4d6;">
        <th style="border: 1px solid #ccc; padding: 8px; text-align: center; width: 5%;">Sr.</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: left; width: 18%;">Employee Name</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: left; width: 12%;">Designation</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Basic Salary</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Incremented Salary</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Allowances</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Deductions</th>
        <th style="border: 1px solid #ccc; padding: 8px; text-align: right;">Total Payable</th>
      </tr>
    </thead>
    <tbody>
      {{rows}}
    </tbody>
    <tfoot>
      <tr style="background-color: #fce4d6; font-weight: bold;">
        <td colspan="3" style="border: 1px solid #ccc; padding: 8px; text-align: center;">Total</td>
        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">{{totalBasicSalary}}</td>
        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">{{totalCurrentSalary}}</td>
        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">{{totalAllowances}}</td>
        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">{{totalDeductions}}</td>
        <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">{{totalNetSalary}}</td>
      </tr>
    </tfoot>
  </table>
</div>
`;

export const reportCardDesignTemplate = `
<div style="width: 210mm; padding: 10mm; font-family: 'Times New Roman', serif; border: 3px solid #336699; position: relative; margin: 0 auto; box-sizing: border-box;">
  <!-- Corner Decorations -->
  <div style="position: absolute; top: 5px; left: 5px; width: 20px; height: 20px; border-top: 3px solid #336699; border-left: 3px solid #336699;"></div>
  <div style="position: absolute; top: 5px; right: 5px; width: 20px; height: 20px; border-top: 3px solid #336699; border-right: 3px solid #336699;"></div>
  <div style="position: absolute; bottom: 5px; left: 5px; width: 20px; height: 20px; border-bottom: 3px solid #336699; border-left: 3px solid #336699;"></div>
  <div style="position: absolute; bottom: 5px; right: 5px; width: 20px; height: 20px; border-bottom: 3px solid #336699; border-right: 3px solid #336699;"></div>

  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
    <div style="width: 100px;">
       <img src="{{logoUrl}}" alt="Logo" style="width: 80px; height: auto;">
    </div>
    <div style="text-align: center; flex: 1;">
       <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #000; font-family: serif;">Concordia College Peshawar</h1>
       <p style="margin: 5px 0 0 0; font-size: 14px;">60-C A University Road, University Town, Peshawar</p>
       <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold;">091-5619915 | 0332-8581222</p>
    </div>
    <div style="width: 100px; display: flex; justify-content: flex-end;">
       <div style="width: 90px; height: 110px; border: 2px solid #ccc; border-radius: 10px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          {{studentPhotoOrPlaceholder}}
       </div>
    </div>
  </div>

  <!-- Title Bar -->
  <div style="background-color: #BDD7EE; padding: 8px; text-align: center; margin-bottom: 25px; border-top: 2px solid #336699; border-bottom: 2px solid #336699;">
     <h2 style="margin: 0; font-size: 18px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 1px;">RESULT CARD ({{examType}})</h2>
  </div>

  <!-- Student Info -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px 40px; margin-bottom: 25px; font-size: 15px;">
     <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Student Name:</span>
       <span style="flex: 1; padding-left: 10px;">{{studentName}}</span>
     </div>
     <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Father Name:</span>
       <span style="flex: 1; padding-left: 10px;">{{fatherName}}</span>
     </div>
      <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Class/Section:</span>
       <span style="flex: 1; padding-left: 10px;">{{class}} / {{section}}</span>
     </div>
     <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Session:</span>
       <span style="flex: 1; padding-left: 10px;">{{session}}</span>
     </div>
      <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Adm No:</span>
       <span style="flex: 1; padding-left: 10px;">{{admNo}}</span>
     </div>
     <div style="display: flex; align-items: flex-end; border-bottom: 2px solid #000;">
       <span style="font-weight: bold; width: 130px;">Reg No:</span>
       <span style="flex: 1; padding-left: 10px;">{{regNo}}</span>
     </div>
  </div>

  <!-- Marks Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px; border: 2px solid #000;">
    <thead>
      <tr style="background-color: #BDD7EE; border-bottom: 2px solid #000; text-align: center;">
        <th style="border: 1px solid #000; padding: 8px; width: 60px;">S.NO</th>
        <th style="border: 1px solid #000; padding: 8px; text-align: left;">SUBJECTS</th>
        <th style="border: 1px solid #000; padding: 8px; width: 80px;">TOTAL</th>
        <th style="border: 1px solid #000; padding: 8px; width: 100px;">OBTAINED</th>
        <th style="border: 1px solid #000; padding: 8px; width: 100px;">PERCENTAGE</th>
        <th style="border: 1px solid #000; padding: 8px; width: 60px;">Grade</th>
      </tr>
    </thead>
    <tbody>
      {{marksRows}}
      
      <!-- Total Row -->
      <tr style="background-color: #BDD7EE; font-weight: bold; border-top: 2px solid #000;">
         <td colspan="2" style="border: 1px solid #000; padding: 8px; text-align: center; text-transform: uppercase;">TOTAL</td>
         <td style="border: 1px solid #000; padding: 8px; text-align: center;">{{totalMarks}}</td>
         <td style="border: 1px solid #000; padding: 8px; text-align: center;">{{obtainedMarks}}</td>
         <td style="border: 1px solid #000; padding: 8px; text-align: center;">{{percentage}}%</td>
         <td style="border: 1px solid #000; padding: 8px; text-align: center;">{{grade}}</td>
      </tr>
    </tbody>
  </table>

  <!-- Remarks Panel -->
  <div style="border: 2px solid #336699; margin-bottom: 50px;">
    <div style="display: flex; border-bottom: 1px solid #336699; background-color: #BDD7EE;">
       <div style="flex: 1; border-right: 1px solid #336699; padding: 8px; text-align: center; font-weight: bold;">
          Grade: {{grade}}
       </div>
       <div style="flex: 2; padding: 8px; text-align: center; font-weight: bold;">
          Remarks: {{remarks}}
       </div>
    </div>
    <div style="display: flex; padding: 12px; align-items: flex-start; min-height: 40px;">
       <span style="font-weight: bold; margin-right: 10px; white-space: nowrap;">Teacher Remarks:</span>
       <span style="font-style: italic; font-family: cursive;">{{teacherRemarks}}</span>
    </div>
  </div>

  <!-- Footer -->
  <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 20px;">
     <div style="text-align: center;">
        <div style="border-bottom: 2px solid #000; width: 180px; margin-bottom: 8px;"></div>
        <span style="font-weight: bold;">Exam Controller Signature</span>
     </div>
     
     <div style="text-align: center;">
        <!-- Badge Icon Gold -->
        <div style="width: 80px; height: 80px; background: radial-gradient(circle, #fdb931 0%, #d4af37 100%); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid #fff;">
           <span style="font-size: 20px; text-shadow: 1px 1px 2px #000;">{{position}}</span>
           <span style="font-size: 10px; text-transform: uppercase;">Position</span>
        </div>
     </div>

     <div style="text-align: center;">
        <div style="border-bottom: 2px solid #000; width: 180px; margin-bottom: 8px;"></div>
        <span style="font-weight: bold;">Principal's Signature</span>
     </div>
  </div>
</div>
`;

export const challanDesignTemplate = `
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
  \${['Bank Copy', 'Institute Copy', 'Student Copy'].map(copyName => \`
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
    <div class="info-grid">
    <div>
      <div class="info-row"><span class="label">Student Name:</span> {{studentName}}</div>
      <div class="info-row"><span class="label">Father Name:</span> {{fatherName}}</div>
      <div class="info-row"><span class="label">Roll Number:</span> {{rollNo}}</div>
      <div class="info-row"><span class="label">Class:</span> {{className}}</div>
    </div>
    <div>
      <div class="info-row"><span class="label">Registration No:</span> {{regNo}}</div>
      <div class="info-row"><span class="label">Track/Group:</span> {{group}}</div>
      <div class="info-row"><span class="label">Session:</span> {{session}}</div>
      <div class="info-row"><span class="label">Section:</span> {{sectionName}}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="subject-col">Subject</th>
        <th>Total Marks</th>
        <th>Obtained Marks</th>
        <th>Percentage</th>
        <th>Grade</th>
      </tr>
    </thead>
    <tbody>
      {{marksRows}}
    </tbody>
    <tfoot>
      <tr style="font-weight: bold; background: #f0f0f0;">
        <td class="subject-col">Grand Total</td>
        <td>{{totalMarks}}</td>
        <td>{{obtainedMarks}}</td>
        <td>{{percentage}}%</td>
        <td>{{grade}}</td>
      </tr>
    </tfoot>
  </table>

  <div class="summary">
    <div class="summary-item">
      <span class="big-text">{{percentage}}%</span>
      Percentage
    </div>
    <div class="summary-item">
      <span class="big-text" style="color: {{gradeColor}}">{{grade}}</span>
      Grade
    </div>
    <div class="summary-item">
      <span class="big-text">{{gpa}}</span>
      GPA
    </div>
    <div class="summary-item">
      <span class="big-text">{{position}}</span>
      Position
    </div>
  </div>

  <div class="footer">
    <div class="signature">Controller of Exams</div>
    <div class="signature">Principal</div>
  </div>
</body>
</html>
  \`).join('')}
</div>
</body>
</html>
`;

export const teacherIdCardDesignTemplate = `
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
`;

export const studentIdCardDesignTemplate = `
<!DOCTYPE html>
<html>

<head>
  <meta charset="UTF-8" />
  <link
    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800&family=UnifrakturMaguntia&display=swap"
    rel="stylesheet">
</head>

<body style="margin:0; padding:0; background:#eee;">
  <div style="display:flex; gap:24px; font-family:'Cinzel', serif;">

    <!-- ================= FRONT ================= -->
    <div style="
  width:322px;
  height:530px;
  background:url('https://beams.hayatfoundation.org.pk/id_card_bg.jpg') center/cover no-repeat;
  position:relative;
  padding:14px 16px 88px;
  box-sizing:border-box;
">

      <!-- Header -->
      <div style="display:flex; justify-content:space-between;">
        <img src="https://beams.hayatfoundation.org.pk/logo_full.png" style="height:40px">
        <img src="https://beams.hayatfoundation.org.pk/beaconhouse_logo.png" style="height:32px">
      </div>

      <!-- Title -->
      <div style="text-align:center; margin-top:8px;">
        <div style="font-size:18px; font-weight:700; line-height:1.2;">
          CONCORDIA COLLEGE<br>PESHAWAR CAMPUS
        </div>

        <div style="display:flex; justify-content:center; align-items:center; gap:4px; font-size:12px; margin-top:3px;">
          A Project of
          <span style="font-family:'UnifrakturMaguntia'; font-size:14px;">Beaconhouse</span>
        </div>
      </div>

      <!-- Photo -->
      <div style="display:flex; justify-content:center; margin-top:22px;">
        <div style="
      width:145px;
      height:145px;
      border-radius:50%;
      border:4px solid #f59c1a;
      overflow:hidden;
      background:#fff;
    ">
          <img src="{{studentPhoto}}" style="width:100%; height:100%; object-fit:cover;">
        </div>
      </div>

      <!-- Student Info -->
      <div style="text-align:center; margin-top:16px;">
        <div style="font-size:20px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase;">
          {{name}}
        </div>

        <div style="width:80%; margin:6px auto; border-bottom:1.5px solid #000;"></div>

        <div style="font-size:13px; font-weight:600; text-transform:uppercase;">
          Admission No: {{admissionNo}}
        </div>

        <div style="font-size:13px; font-weight:600; margin-top:4px;">
          {{classGroup}}
        </div>
      </div>

      <!-- Footer -->
      <div
        style="position:absolute; bottom: 0; left:0; display: flex; flex-direction: column; justify-content: space-between; width:100%;">
        <div style="display: flex; justify-content: space-between;">
          <div style="padding:6px 14px; font-size:11px; font-weight:600;">
            <span style="text-decoration:underline;">Issued</span><br>
            {{issueDate}}
          </div>
          <div style="padding:6px 14px; font-size:11px; font-weight:600;">
            <span style="text-decoration:underline;">Expiry</span><br>
            {{expiryDate}}
          </div>
        </div>

        <div style="
      background:#f59c1a;
      text-align:center;
      padding:7px 0;
      font-size:16px;
      font-weight:700;
      letter-spacing:1px;
    ">
          STUDENT
        </div>
      </div>
    </div>

    <!-- ================= BACK ================= -->
    <div style="
  width:322px;
  height:530px;
  background:url('https://beams.hayatfoundation.org.pk/id_card_bg.jpg') center/cover no-repeat;
  position:relative;
  padding:16px 18px 90px;
  box-sizing:border-box;
">

      <!-- Header -->
      <div style="display:flex; justify-content:space-between;">
        <img src="https://beams.hayatfoundation.org.pk/logo_full.png" style="height:38px">
        <img src="https://beams.hayatfoundation.org.pk/beaconhouse_logo.png" style="height:32px">
      </div>

      <div style="
    margin-top:16px;
    font-size:14px;
    font-weight:700;
    color:#f59c1a;
    border-bottom:1.5px solid #f59c1a;
    display:inline-block;
  ">
        PERSONAL INFORMATION
      </div>

      <!-- Info -->
      <div style="margin-top:12px; font-size:12px; font-weight:600; line-height:1.7;">
        <div><b>Father Name:</b> {{fatherName}}</div>
        <div><b>Contact:</b> {{phone}}</div>
        <div><b>Date of Birth:</b> {{dob}}</div>
        <div><b>Address:</b> {{address}}</div>
      </div>

      <div style="border-bottom:1.5px solid #000; margin:16px 0;"></div>

      <!-- Disclaimer -->
      <div style="font-size:10.8px; font-weight:600; line-height:1.5;">
        This card is the Property of Concordia College Peshawar.<br>
        Non-transferable & valid for Concordia College Peshawar Campus ONLY.<br><br>

        If Found Please return to:<br>
        Concordia College Peshawar<br>
        Address: 60-C University Road, University Town,<br>
        Peshawar, KPK, Pakistan<br><br>

        Tel: 091-5619915<br>
        WhatsApp: 0332-8581222
      </div>

      <!-- QR Code -->
      <div style="position:absolute; bottom:10px; left:0; width:100%; display:flex; justify-content:center; align-items:center;">
        {{qrCode}}
      </div>

    </div>

  </div>
</body>

</html>
`;
