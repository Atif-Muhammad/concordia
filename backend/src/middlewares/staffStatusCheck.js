const jwt = require('jsonwebtoken');
const { User, Staff } = require('../models');

const clearAuthCookies = (res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  };
  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
};

/**
 * Global middleware to verify staff status is ACTIVE.
 * If status is other than 'ACTIVE' (e.g. TERMINATED or RETIRED):
 * - Blocks access to the system
 * - Clears authentication cookies immediately (instant logout)
 * - Returns 401 Unauthorized
 *
 * Exemption: Ignored for SUPER_ADMIN only.
 */
const staffStatusCheck = async (req, res, next) => {
  try {
    const url = req.originalUrl || req.url || '';
    // Allow health check and explicit logout to proceed
    if (url.includes('/health') || url.includes('/auth/logout')) {
      return next();
    }

    // Extract token from cookies or authorization header
    const token = req.cookies?.accessToken || req.headers.authorization?.split(' ')[1] || req.cookies?.refreshToken;
    if (!token) {
      return next();
    }

    let decoded = null;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtsecretkey_concordia_2026');
    } catch (err) {
      if (req.cookies?.refreshToken) {
        try {
          decoded = jwt.verify(req.cookies.refreshToken, process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey_concordia_2026');
        } catch (e) {
          return next();
        }
      } else {
        return next();
      }
    }

    if (!decoded || !decoded.id) {
      return next();
    }

    // Fast bypass if token role is SUPER_ADMIN
    const tokenRole = String(decoded.role || '').toUpperCase();
    if (tokenRole === 'SUPER_ADMIN') {
      return next();
    }

    // Look up user in database
    const user = await User.findById(decoded.id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        message: 'User account not found. You have been logged out.',
        isLoggedOut: true
      });
    }

    // Ignore this check for super_admin only
    const userRole = String(user.role || '').toUpperCase();
    if (userRole === 'SUPER_ADMIN') {
      return next();
    }

    // Check user account status
    const userStatus = String(user.status || '').trim().toUpperCase();
    if (userStatus && userStatus !== 'ACTIVE') {
      clearAuthCookies(res);
      return res.status(401).json({
        message: 'Your user account is inactive. You have been logged out.',
        status: user.status,
        isLoggedOut: true
      });
    }

    // Find linked Staff record by refId or email/staffId
    let staff = null;
    if (user.refId) {
      staff = await Staff.findById(user.refId);
    }
    if (!staff && user.email) {
      staff = await Staff.findOne({
        $or: [
          { email: new RegExp(`^${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { staffId: new RegExp(`^${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        ]
      });
    }

    // If staff record exists, verify its status is ACTIVE
    if (staff) {
      const staffStatus = String(staff.status || '').trim().toUpperCase();
      if (staffStatus && staffStatus !== 'ACTIVE') {
        clearAuthCookies(res);
        return res.status(401).json({
          message: `Your staff account is ${staff.status.toLowerCase()} and access is disabled. You have been logged out.`,
          status: staff.status,
          isLoggedOut: true
        });
      }
    }

    return next();
  } catch (error) {
    console.error('[staffStatusCheck] Error verifying staff status:', error);
    return next();
  }
};

module.exports = staffStatusCheck;
