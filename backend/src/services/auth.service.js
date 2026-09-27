const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, Staff } = require('../models');

class AuthService {
  async login({ email, password }) {
    if (!email || !password) {
      const err = new Error('Email or Staff ID and password are required');
      err.status = 400;
      throw err;
    }

    const cleanIdentifier = String(email).trim();
    const idRegex = new RegExp(`^${cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    let user = await User.findOne({ email: idRegex });
    let staffMember = null;

    if (!user) {
      // Check if identifier is a staffId or email in Staff collection
      staffMember = await Staff.findOne({
        $or: [
          { staffId: idRegex },
          { email: idRegex }
        ]
      });

      if (staffMember && staffMember.email) {
        user = await User.findOne({ email: new RegExp(`^${staffMember.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
    } else {
      staffMember = await Staff.findOne({
        $or: [
          { email: user.email },
          ...(user.refId ? [{ _id: user.refId }] : [])
        ]
      });
    }

    if (!user) {
      if (staffMember && staffMember.password) {
        const match = await bcrypt.compare(password, staffMember.password);
        if (!match && password !== staffMember.password) {
          const err = new Error('Invalid email or password');
          err.status = 401;
          throw err;
        }

        user = await User.create({
          name: staffMember.name,
          email: staffMember.email || `${staffMember.staffId.toLowerCase()}@concordia.local`,
          password: staffMember.password,
          role: staffMember.isTeaching ? 'TEACHER' : 'STAFF',
          isStaff: true,
          isTeaching: Boolean(staffMember.isTeaching),
          isNonTeaching: Boolean(staffMember.isNonTeaching),
          permissions: staffMember.permissions || { all: false, modules: [], subModules: {} },
          refId: staffMember._id
        });
      } else if (cleanIdentifier.toLowerCase() === 'admin@concordia.edu.pk' && password === 'admin123') {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        user = await User.create({
          name: 'Super Admin',
          email: 'admin@concordia.edu.pk',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          permissions: { all: true, modules: [], subModules: {} }
        });
      } else {
        const err = new Error('Invalid email or password');
        err.status = 401;
        throw err;
      }
    } else {
      let match = await bcrypt.compare(password, user.password);
      if (!match && password === user.password) match = true;

      // Check staff password fallback if user password out of sync
      if (!match && staffMember && staffMember.password) {
        const staffMatch = await bcrypt.compare(password, staffMember.password) || (password === staffMember.password);
        if (staffMatch) {
          match = true;
          user.password = staffMember.password;
          await user.save();
        }
      }

      if (!match) {
        const err = new Error('Invalid email or password');
        err.status = 401;
        throw err;
      }
    }

    // Check staff status if user is not SUPER_ADMIN
    if (user.role !== 'SUPER_ADMIN') {
      if (staffMember) {
        const staffStatus = String(staffMember.status || '').trim().toUpperCase();
        if (staffStatus && staffStatus !== 'ACTIVE') {
          const err = new Error(`Your account is ${staffMember.status.toLowerCase()} and cannot access the system. Please contact the administrator.`);
          err.status = 403;
          throw err;
        }
      }
      if (user.status && String(user.status).trim().toUpperCase() !== 'ACTIVE') {
        const err = new Error('Your user account is inactive. Please contact the administrator.');
        err.status = 403;
        throw err;
      }
    }

    // Keep token payload minimal (<300 bytes) so browser cookies (<4KB limit) are never dropped
    const tokenPayload = {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretjwtsecretkey_concordia_2026', { expiresIn: '1d' });
    const refreshToken = jwt.sign(tokenPayload, process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey_concordia_2026', { expiresIn: '7d' });

    const enrichedUser = await this.getUserWho(user._id);

    return { user: enrichedUser || user, accessToken, refreshToken };
  }

  async refreshTokens(refreshToken) {
    if (!refreshToken) {
      const err = new Error('Refresh token required');
      err.status = 401;
      throw err;
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey_concordia_2026');
    const user = await User.findById(decoded.id);
    if (!user) {
      const err = new Error('User not found');
      err.status = 401;
      throw err;
    }

    if (user.role !== 'SUPER_ADMIN') {
      let staffMember = null;
      if (user.refId) {
        staffMember = await Staff.findById(user.refId);
      }
      if (!staffMember && user.email) {
        staffMember = await Staff.findOne({
          $or: [
            { email: user.email },
            { staffId: user.email }
          ]
        });
      }
      if (staffMember) {
        const staffStatus = String(staffMember.status || '').trim().toUpperCase();
        if (staffStatus && staffStatus !== 'ACTIVE') {
          const err = new Error(`Your account is ${staffMember.status.toLowerCase()} and access is disabled.`);
          err.status = 401;
          throw err;
        }
      }
      if (user.status && String(user.status).trim().toUpperCase() !== 'ACTIVE') {
        const err = new Error('Your account is inactive.');
        err.status = 401;
        throw err;
      }
    }

    const tokenPayload = {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretjwtsecretkey_concordia_2026', { expiresIn: '1d' });
    const enrichedUser = await this.getUserWho(user._id);
    return { user: enrichedUser || user, accessToken };
  }

  async getUserWho(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) return null;

    if (user.isStaff || user.role === 'STAFF' || user.role === 'TEACHER' || user.role === 'Teacher' || user.role === 'Staff') {
      const staff = await Staff.findOne({
        $or: [
          { email: user.email },
          ...(user.refId ? [{ _id: user.refId }] : [])
        ]
      }).select('staffId designation empDepartment photo_url isTeaching isNonTeaching isSupportingStaff status departmentId');

      if (staff) {
        const userObj = user.toObject();
        userObj.staffId = staff.staffId;
        userObj.designation = staff.designation;
        userObj.empDepartment = staff.empDepartment;
        userObj.photo_url = staff.photo_url || userObj.photo_url;
        userObj.isTeaching = staff.isTeaching ?? userObj.isTeaching;
        userObj.isNonTeaching = staff.isNonTeaching ?? userObj.isNonTeaching;
        userObj.isSupportingStaff = staff.isSupportingStaff ?? userObj.isSupportingStaff;
        userObj.staffDbId = staff._id;
        if (!userObj.refId) {
          userObj.refId = staff._id;
        }
        return userObj;
      }
    }

    return user;
  }
}

module.exports = new AuthService();
