const jwt = require('jsonwebtoken');
const { ActivityLog, Staff, User } = require('../models');

// Helper to sanitize request body
const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  
  const sanitized = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'accesstoken', 'refreshtoken', 'authorization', 'cvv', 'pin'];
  
  for (const [key, val] of Object.entries(data)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '***';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

// Route categorization mapper
const resolveModuleInfo = (path, method, body = {}, user = null) => {
  const cleanPath = path.split('?')[0].toLowerCase();
  let module = 'General';
  let subModule = 'General';
  let action = method;
  let description = `${method} ${path}`;

  // Method to human action
  const methodMap = {
    POST: 'Create',
    PUT: 'Update',
    PATCH: 'Update',
    DELETE: 'Delete',
    GET: 'Read'
  };
  const actionPrefix = methodMap[method] || method;

  // 1. Authentication
  if (cleanPath.startsWith('/api/auth')) {
    module = 'Authentication';
    if (cleanPath.includes('/login')) {
      subModule = 'Login';
      action = 'LOGIN';
      description = `User logged into system (${body?.email || 'credentials'})`;
    } else if (cleanPath.includes('/logout')) {
      subModule = 'Logout';
      action = 'LOGOUT';
      description = `User logged out`;
    } else if (cleanPath.includes('/refresh')) {
      subModule = 'Session';
      action = 'REFRESH_TOKEN';
      description = `Refreshed auth session`;
    } else {
      subModule = 'Profile';
      action = 'PROFILE_CHECK';
      description = `Checked user identity`;
    }
    return { module, subModule, action, description };
  }

  // 2. Front Office
  if (cleanPath.startsWith('/api/front-office')) {
    module = 'Front Office';
    if (cleanPath.includes('/inquir')) {
      subModule = 'Inquiry';
      description = `${actionPrefix} Inquiry: ${body?.name || body?.studentName || ''}`.trim();
    } else if (cleanPath.includes('/visitor')) {
      subModule = 'Visitor Book';
      description = `${actionPrefix} Visitor Pass: ${body?.visitorName || body?.name || ''}`.trim();
    } else if (cleanPath.includes('/complaint')) {
      subModule = 'Complaints';
      description = `${actionPrefix} Complaint: ${body?.title || body?.complaintBy || ''}`.trim();
    } else if (cleanPath.includes('/contact')) {
      subModule = 'Contacts';
      description = `${actionPrefix} Contact Directory Record`;
    }
    action = `${actionPrefix.toUpperCase()}_${subModule.toUpperCase().replace(/\s+/g, '_')}`;
    return { module, subModule, action, description };
  }

  // 3. Students
  if (cleanPath.startsWith('/api/student')) {
    module = 'Students';
    subModule = 'Admissions & Directory';
    if (method === 'POST') {
      action = 'STUDENT_ADMISSION';
      description = `Admitted new student: ${body?.name || ''} ${body?.rollNumber ? `(Roll: ${body.rollNumber})` : ''}`.trim();
    } else if (method === 'DELETE') {
      action = 'DELETE_STUDENT';
      description = `Deleted student profile`;
    } else if (cleanPath.includes('/status') || body?.status) {
      action = 'UPDATE_STUDENT_STATUS';
      description = `Changed student status to ${body?.status || 'updated'}`;
    } else {
      action = 'UPDATE_STUDENT';
      description = `Updated student information ${body?.name ? `(${body.name})` : ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 4. Staff & HR
  if (cleanPath.startsWith('/api/hr')) {
    if (cleanPath.includes('/staff-id')) {
      module = 'Staff';
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_STAFF_ID_SETTINGS`;
      description = `${actionPrefix} Staff ID auto-generation settings`;
    } else if (cleanPath.includes('/staff')) {
      module = 'Staff';
      subModule = 'Staff Directory';
      if (method === 'POST') {
        action = 'CREATE_STAFF';
        description = `Created staff record: ${body?.name || ''} ${body?.staffId ? `(${body.staffId})` : ''}`.trim();
      } else if (method === 'DELETE') {
        action = 'DELETE_STAFF';
        description = `Deleted staff record`;
      } else if (cleanPath.includes('/salary-revision')) {
        action = 'REVISE_SALARY';
        description = `Revised staff salary ${body?.amountChanged ? `by ${body.amountChanged}` : ''}`.trim();
      } else {
        action = 'UPDATE_STAFF';
        description = `Updated staff profile ${body?.name ? `(${body.name})` : ''}`.trim();
      }
    } else if (cleanPath.includes('/leave')) {
      module = 'HR & Payroll';
      subModule = 'Leaves';
      action = `${actionPrefix.toUpperCase()}_LEAVE`;
      description = `${actionPrefix} Staff Leave Application`;
    } else if (cleanPath.includes('/payroll')) {
      module = 'HR & Payroll';
      subModule = 'Payroll';
      if (cleanPath.includes('/generate')) {
        action = 'GENERATE_PAYROLL';
        description = `Generated monthly payroll sheet for ${body?.month || 'selected month'}`;
      } else if (cleanPath.includes('/pay') || cleanPath.includes('/process')) {
        action = 'PAY_SALARY';
        description = `Disbursed staff salary`;
      } else {
        action = `${actionPrefix.toUpperCase()}_PAYROLL`;
        description = `${actionPrefix} Payroll Record`;
      }
    } else if (cleanPath.includes('/advance')) {
      module = 'HR & Payroll';
      subModule = 'Advance Salary';
      action = `${actionPrefix.toUpperCase()}_ADVANCE_SALARY`;
      description = `${actionPrefix} Advance Salary Voucher ${body?.amount ? `(PKR ${body.amount})` : ''}`.trim();
    } else if (cleanPath.includes('/holiday')) {
      module = 'HR & Payroll';
      subModule = 'Holidays';
      action = `${actionPrefix.toUpperCase()}_HOLIDAY`;
      description = `${actionPrefix} Calendar Holiday: ${body?.title || ''}`.trim();
    } else if (cleanPath.includes('/department')) {
      module = 'HR & Payroll';
      subModule = 'Departments';
      action = `${actionPrefix.toUpperCase()}_DEPARTMENT`;
      description = `${actionPrefix} Department: ${body?.name || ''}`.trim();
    } else {
      module = 'HR & Payroll';
      subModule = 'General HR';
      action = `${actionPrefix.toUpperCase()}_HR`;
      description = `${actionPrefix} HR record`;
    }
    return { module, subModule, action, description };
  }

  // 5. Department separate route
  if (cleanPath.startsWith('/api/department')) {
    module = 'HR & Payroll';
    subModule = 'Departments';
    action = `${actionPrefix.toUpperCase()}_DEPARTMENT`;
    description = `${actionPrefix} Department: ${body?.name || ''}`.trim();
    return { module, subModule, action, description };
  }

  // 6. Attendance
  if (cleanPath.startsWith('/api/attendance')) {
    module = 'Attendance';
    if (cleanPath.includes('/leave')) {
      subModule = 'Leave';
      action = `${actionPrefix.toUpperCase()}_ATTENDANCE_LEAVE`;
      description = `${actionPrefix} Student Leave`;
    } else if (cleanPath.includes('/skip')) {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_ATTENDANCE_SKIP`;
      description = `${actionPrefix} Attendance Skip rule`;
    } else {
      subModule = 'Record Attendance';
      action = 'MARK_ATTENDANCE';
      description = `Marked student attendance for ${body?.date || 'class'}`;
    }
    return { module, subModule, action, description };
  }

  // 7. Academics
  if (cleanPath.startsWith('/api/academics')) {
    module = 'Academics';
    if (cleanPath.includes('/session')) {
      subModule = 'Sessions';
      description = `${actionPrefix} Academic Session: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/program')) {
      subModule = 'Programs';
      description = `${actionPrefix} Academic Program: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/class')) {
      subModule = 'Classes';
      description = `${actionPrefix} Class: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/section')) {
      subModule = 'Sections';
      description = `${actionPrefix} Section: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/subject')) {
      subModule = 'Subjects';
      description = `${actionPrefix} Subject: ${body?.name || ''} ${body?.code ? `(${body.code})` : ''}`.trim();
    } else if (cleanPath.includes('/scm')) {
      subModule = 'Subject Classes';
      description = `${actionPrefix} Subject-Class Curriculum Assignment`;
    } else if (cleanPath.includes('/tcm') || cleanPath.includes('/tsm')) {
      subModule = 'Teacher Classes';
      description = `${actionPrefix} Teacher Class/Subject Allocation`;
    } else if (cleanPath.includes('/timetable')) {
      subModule = 'Timetable';
      description = `${actionPrefix} Class Timetable Schedule`;
    } else {
      subModule = 'General Academics';
      description = `${actionPrefix} Academic Setup`;
    }
    action = `${actionPrefix.toUpperCase()}_${subModule.toUpperCase().replace(/\s+/g, '_')}`;
    return { module, subModule, action, description };
  }

  // 8. Fee Management
  if (cleanPath.startsWith('/api/fee-management') || cleanPath.startsWith('/api/fee')) {
    module = 'Fee Management';
    if (cleanPath.includes('/extra-challan')) {
      subModule = 'Extra Challans';
      action = `${actionPrefix.toUpperCase()}_EXTRA_CHALLAN`;
      description = `${actionPrefix} Extra / Ad-hoc Challan`;
    } else if (cleanPath.includes('/challan')) {
      subModule = 'Challans';
      if (cleanPath.includes('/generate')) {
        action = 'GENERATE_CHALLANS';
        description = `Generated monthly fee challans`;
      } else if (cleanPath.includes('/pay') || cleanPath.includes('/transaction')) {
        action = 'COLLECT_FEE';
        description = `Collected fee payment ${body?.amount ? `PKR ${body.amount}` : ''} ${body?.challanNo ? `for Challan #${body.challanNo}` : ''}`.trim();
      } else {
        action = `${actionPrefix.toUpperCase()}_CHALLAN`;
        description = `${actionPrefix} Fee Challan`;
      }
    } else if (cleanPath.includes('/feehead') || cleanPath.includes('/fee-head')) {
      subModule = 'Fee Heads';
      action = `${actionPrefix.toUpperCase()}_FEE_HEAD`;
      description = `${actionPrefix} Fee Head: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/structure')) {
      subModule = 'Fee Structures';
      action = `${actionPrefix.toUpperCase()}_FEE_STRUCTURE`;
      description = `${actionPrefix} Fee Package Structure: ${body?.name || ''}`.trim();
    } else if (cleanPath.includes('/settings')) {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_FEE_SETTINGS`;
      description = `${actionPrefix} Fee Policy Settings`;
    } else {
      subModule = 'Challans';
      action = `${actionPrefix.toUpperCase()}_FEE`;
      description = `${actionPrefix} Fee Record`;
    }
    return { module, subModule, action, description };
  }

  // 9. Examination
  if (cleanPath.startsWith('/api/exams')) {
    module = 'Examination';
    if (cleanPath.includes('/marks')) {
      subModule = 'Marks Entry';
      action = 'SAVE_MARKS';
      description = `Submitted exam subject marks`;
    } else if (cleanPath.includes('/result')) {
      subModule = 'Results';
      action = 'PUBLISH_RESULTS';
      description = `Computed / Published Examination Results`;
    } else {
      subModule = 'Exams';
      action = `${actionPrefix.toUpperCase()}_EXAM`;
      description = `${actionPrefix} Exam Term: ${body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 10. Boarding / Hostel
  if (cleanPath.startsWith('/api/hostel')) {
    module = 'Boarding';
    if (cleanPath.includes('/registration')) {
      subModule = 'Registration';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_REGISTRATION`;
      description = `${actionPrefix} Hostel Student Admission`;
    } else if (cleanPath.includes('/room')) {
      subModule = 'Rooms';
      action = `${actionPrefix.toUpperCase()}_ROOM`;
      description = `${actionPrefix} Hostel Room / Bed: ${body?.roomNumber || ''}`.trim();
    } else if (cleanPath.includes('/fee') || cleanPath.includes('/challan')) {
      subModule = 'Fees';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_FEE`;
      description = `${actionPrefix} Boarding / Mess Fee Challan`;
    } else if (cleanPath.includes('/expense')) {
      subModule = 'Expenses';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_EXPENSE`;
      description = `${actionPrefix} Hostel Mess / Utility Expense: ${body?.title || ''}`.trim();
    } else if (cleanPath.includes('/inventory')) {
      subModule = 'Inventory';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_INVENTORY`;
      description = `${actionPrefix} Hostel Furniture / Appliance Stock`;
    } else {
      subModule = 'Settings';
      action = `${actionPrefix.toUpperCase()}_HOSTEL_SETTINGS`;
      description = `${actionPrefix} Hostel Rules / Settings`;
    }
    return { module, subModule, action, description };
  }

  // 11. Finance
  if (cleanPath.startsWith('/api/finance')) {
    module = 'Finance';
    if (cleanPath.includes('/income')) {
      subModule = 'Income';
      action = `${actionPrefix.toUpperCase()}_INCOME`;
      description = `Recorded Income Voucher ${body?.amount ? `PKR ${body.amount}` : ''} (${body?.title || 'General'})`.trim();
    } else if (cleanPath.includes('/expense')) {
      subModule = 'Expense';
      action = `${actionPrefix.toUpperCase()}_EXPENSE`;
      description = `Recorded Expense Voucher ${body?.amount ? `PKR ${body.amount}` : ''} (${body?.title || 'General'})`.trim();
    } else if (cleanPath.includes('/closing')) {
      subModule = 'Closing';
      action = 'DAILY_CLOSING';
      description = `Submitted financial drawer closing ${body?.closingDate ? `for ${body.closingDate}` : ''}`.trim();
    } else {
      subModule = 'Dashboard';
      action = 'VIEW_FINANCE';
      description = `Finance Overview`;
    }
    return { module, subModule, action, description };
  }

  // 12. Inventory
  if (cleanPath.startsWith('/api/inventory')) {
    module = 'Inventory';
    if (cleanPath.includes('/expense')) {
      subModule = 'Expenses';
      action = `${actionPrefix.toUpperCase()}_INVENTORY_EXPENSE`;
      description = `${actionPrefix} Inventory Purchase Order`;
    } else {
      subModule = 'Inventory';
      action = `${actionPrefix.toUpperCase()}_INVENTORY_ITEM`;
      description = `${actionPrefix} Campus Inventory Item: ${body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 13. Wallets
  if (cleanPath.startsWith('/api/wallets')) {
    module = 'Wallets / Accounts';
    subModule = 'Wallets';
    if (cleanPath.includes('/transfer')) {
      action = 'WALLET_TRANSFER';
      description = `Contra Transfer: PKR ${body?.amount || 0} between accounts`;
    } else if (cleanPath.includes('/deposit')) {
      action = 'DIRECT_DEPOSIT';
      description = `Direct Deposit: PKR ${body?.amount || 0} to account`;
    } else {
      action = `${actionPrefix.toUpperCase()}_WALLET`;
      description = `${actionPrefix} Financial Account / Wallet: ${body?.accountName || body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 14. Configuration
  if (cleanPath.startsWith('/api/configuration')) {
    module = 'Configuration';
    if (cleanPath.includes('/institute')) {
      subModule = 'Institute';
      action = 'UPDATE_INSTITUTE_SETTINGS';
      description = `Updated Institute Branding and Profile Information`;
    } else if (cleanPath.includes('template')) {
      subModule = 'Templates';
      action = `${actionPrefix.toUpperCase()}_TEMPLATE`;
      description = `${actionPrefix} Document Print Template: ${body?.type || ''}`.trim();
    } else {
      subModule = 'General Config';
      action = `${actionPrefix.toUpperCase()}_CONFIGURATION`;
      description = `${actionPrefix} System Configuration`;
    }
    return { module, subModule, action, description };
  }

  // 15. Admin users
  if (cleanPath.startsWith('/api/admin')) {
    module = 'Configuration';
    if (cleanPath.includes('/teacher/attendance')) {
      module = 'Attendance';
      subModule = 'Teacher Attendance';
      action = 'MARK_TEACHER_ATTENDANCE';
      description = `Marked Teacher Attendance for ${body?.date || 'selected date'}`;
    } else {
      subModule = 'Admins';
      action = `${actionPrefix.toUpperCase()}_ADMIN_ACCOUNT`;
      description = `${actionPrefix} Administrator / Staff Access Permissions: ${body?.email || body?.name || ''}`.trim();
    }
    return { module, subModule, action, description };
  }

  // 16. Teacher Portal
  if (cleanPath.startsWith('/api/teacher')) {
    module = 'Teacher Portal';
    subModule = 'Teacher Actions';
    action = `${actionPrefix.toUpperCase()}_TEACHER_PORTAL`;
    description = `Teacher Portal Activity: ${cleanPath}`;
    return { module, subModule, action, description };
  }

  // 17. Complaints
  if (cleanPath.startsWith('/api/complaints')) {
    module = 'Complaints';
    subModule = 'Complaints';
    action = `${actionPrefix.toUpperCase()}_COMPLAINT`;
    description = `${actionPrefix} Campus Complaint`;
    return { module, subModule, action, description };
  }

  // 18. Dashboard
  if (cleanPath.startsWith('/api/dashboard')) {
    module = 'Dashboard';
    subModule = 'Dashboard';
    action = 'VIEW_DASHBOARD';
    description = `Viewed Dashboard Overview`;
    return { module, subModule, action, description };
  }

  // Fallback for any unknown /api/* endpoint
  const segments = cleanPath.replace('/api/', '').split('/').filter(Boolean);
  const modName = segments[0] ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : 'System';
  const subModName = segments[1] ? segments[1].charAt(0).toUpperCase() + segments[1].slice(1) : 'General';
  return {
    module: modName,
    subModule: subModName,
    action: `${actionPrefix.toUpperCase()}_${subModName.toUpperCase()}`,
    description: `${actionPrefix} in ${modName} - ${subModName}`
  };
};

/**
 * Activity logger middleware
 */
const activityLogger = (req, res, next) => {
  const url = req.originalUrl || req.url;

  // Ignore static assets, health checks, and log querying endpoints
  if (
    !url.startsWith('/api/') ||
    url.startsWith('/api/health') ||
    url.startsWith('/api/configuration/activity-logs') ||
    url.startsWith('/profile') ||
    url.startsWith('/uploads') ||
    url.includes('/favicon.ico')
  ) {
    return next();
  }

  // Extract auth token immediately if present
  let authUser = req.user || null;
  if (!authUser) {
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        authUser = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtsecretkey_concordia_2026');
      } catch (e) {
        // invalid token
      }
    }
  }

  // Intercept response to capture response body (especially error messages / success user)
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responseData = null;

  res.json = (data) => {
    responseData = data;
    return originalJson(data);
  };

  res.send = (data) => {
    if (!responseData) {
      try {
        responseData = typeof data === 'string' && data.startsWith('{') ? JSON.parse(data) : data;
      } catch (e) {
        responseData = data;
      }
    }
    return originalSend(data);
  };

  // When request completes
  res.on('finish', () => {
    // Determine if we should record this request
    const method = req.method.toUpperCase();
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isFailed = res.statusCode >= 400;
    const isAuth = url.startsWith('/api/auth/login') || url.startsWith('/api/auth/logout');

    // Skip normal GET reading of polling/lists if not failed
    if (!isMutating && !isFailed && !isAuth) {
      return;
    }

    setImmediate(async () => {
      try {
        // Resolve user: prioritize response user on login, then req.user, then decoded authUser
        let user = authUser || req.user || null;
        let staffId = '';
        let userName = user?.name || 'Anonymous';
        let userEmail = user?.email || '';
        let userRole = user?.role || 'STAFF';

        // Check if login request succeeded, responseData contains { user: {...} }
        if (url.startsWith('/api/auth/login')) {
          if (res.statusCode < 400 && responseData?.user) {
            user = responseData.user;
            userName = user.name || userName;
            userEmail = user.email || userEmail;
            userRole = user.role || userRole;
            staffId = user.staffId || '';
          } else {
            // Failed login: record attempted identifier
            userEmail = req.body?.email || '';
            userName = req.body?.email ? `Attempted: ${req.body.email}` : 'Anonymous';
          }
        }

        // If user is authenticated, retrieve staffId if not present
        if (user && user.id && !staffId) {
          try {
            const dbUser = await User.findById(user.id).select('name email role isStaff refId');
            if (dbUser) {
              userName = dbUser.name;
              userEmail = dbUser.email;
              userRole = dbUser.role;
              if (dbUser.refId) {
                const staffDoc = await Staff.findById(dbUser.refId).select('staffId');
                if (staffDoc) staffId = staffDoc.staffId;
              }
            }
          } catch (e) {
            // Ignore DB lookup error in logger
          }
        }

        // Resolve module info & description
        const { module, subModule, action, description } = resolveModuleInfo(url, method, req.body, user);

        // Determine status & failure reason
        const status = isFailed ? 'FAILED' : 'SUCCESS';
        let failureReason = '';

        if (isFailed) {
          if (res.locals?.errorMessage) {
            failureReason = res.locals.errorMessage;
          } else if (typeof responseData === 'object' && responseData !== null) {
            failureReason = responseData.message || responseData.error || (Array.isArray(responseData.errors) ? responseData.errors.join(', ') : null) || JSON.stringify(responseData);
          } else if (typeof responseData === 'string') {
            failureReason = responseData.slice(0, 300);
          } else {
            failureReason = `HTTP Error ${res.statusCode}`;
          }
        }

        // IP Address
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
        const userAgent = req.headers['user-agent'] || '';

        // Save activity log
        await ActivityLog.create({
          userId: user?.id || user?._id || null,
          staffId: staffId || '',
          userName: userName || 'System User',
          userEmail: userEmail || '',
          userRole: userRole || 'STAFF',
          module,
          subModule,
          action,
          description: isFailed ? `FAILED: ${description}` : description,
          method,
          endpoint: url,
          status,
          statusCode: res.statusCode,
          failureReason: failureReason || '',
          ipAddress,
          userAgent,
          params: sanitizeData({ query: req.query, params: req.params }),
          body: sanitizeData(req.body),
          timestamp: new Date()
        });
      } catch (logErr) {
        console.error('[ActivityLogger] Error logging activity:', logErr.message);
      }
    });
  });

  next();
};

module.exports = activityLogger;
