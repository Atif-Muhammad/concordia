require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/error');
const activityLogger = require('./src/middlewares/activityLogger');
const { getProfileBaseDir, resolveProfileImageFile } = require('./src/utils/profileStorage');

// Routes
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const configurationRoutes = require('./src/routes/configuration.routes');
const frontOfficeRoutes = require('./src/routes/frontOffice.routes');
const studentRoutes = require('./src/routes/student.routes');
const staffRoutes = require('./src/routes/staff.routes');
const departmentRoutes = require('./src/routes/department.routes');
const teacherRoutes = require('./src/routes/teacher.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const academicsRoutes = require('./src/routes/academics.routes');
const feeRoutes = require('./src/routes/fee.routes');
const examinationRoutes = require('./src/routes/examination.routes');
const hrRoutes = require('./src/routes/hr.routes');
const hostelRoutes = require('./src/routes/hostel.routes');
const financeRoutes = require('./src/routes/finance.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const walletRoutes = require('./src/routes/wallet.routes');

const app = express();

// Database Connection
connectDB();

// Middlewares
app.use(cors({
  origin: function (origin, callback) {
    // allow all origins in development or credentials matching
    callback(null, true);
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(activityLogger);

// Static profile and uploads directories
const profileDir = getProfileBaseDir();
app.use('/profile', express.static(profileDir));
app.use('/api/profile', express.static(profileDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Profile image fallback resolver route (handles cross-lookup e.g. ObjectId vs staffId/rollNumber or missing extension)
app.get([
  '/profile/:type/:id',
  '/api/profile/:type/:id',
  '/profile/:type/:id/:filename',
  '/api/profile/:type/:id/:filename'
], async (req, res, next) => {
  const { type, id } = req.params;
  if (!['students', 'staff'].includes(type)) return next();
  try {
    const file = await resolveProfileImageFile(type, id);
    if (file && fs.existsSync(file)) {
      return res.sendFile(file);
    }
  } catch (e) {
    console.error('[ProfileStorage Fallback] Error resolving profile file:', e.message);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Concordia ERP Backend', timestamp: new Date() });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/configuration', configurationRoutes);
app.use('/api/front-office', frontOfficeRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/hr', staffRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/department', departmentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/fee-management', feeRoutes);
app.use('/api/fee', feeRoutes);
app.use('/api/exams', examinationRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/wallets', walletRoutes);

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  console.log(`Concordia ERP Backend running on port ${PORT}`);
});
