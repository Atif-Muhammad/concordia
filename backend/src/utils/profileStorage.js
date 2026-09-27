const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

/**
 * Returns the base profile storage directory.
 * In production or on Linux/Unix systems, defaults to /var/concordia/profile.
 * In local/dev (or Windows), falls back to backend/uploads/profile.
 * Can be overridden anytime via PROFILE_STORAGE_DIR in environment variables.
 */
function getProfileBaseDir() {
  if (process.env.PROFILE_STORAGE_DIR) {
    const customDir = process.env.PROFILE_STORAGE_DIR;
    try {
      if (!fs.existsSync(customDir)) {
        fs.mkdirSync(customDir, { recursive: true });
      }
      return customDir;
    } catch (e) {
      console.warn(`[ProfileStorage] Unable to create PROFILE_STORAGE_DIR '${customDir}':`, e.message);
    }
  }

  // In production or on Linux/Unix systems
  if (process.env.NODE_ENV === 'production' || process.platform !== 'win32') {
    const prodDir = '/var/concordia/profile';
    try {
      if (!fs.existsSync(prodDir)) {
        fs.mkdirSync(prodDir, { recursive: true });
      }
      return prodDir;
    } catch (e) {
      console.warn(`[ProfileStorage] Cannot write to '${prodDir}' (${e.message}). Falling back to local uploads/profile.`);
    }
  }

  // Local development fallback
  const localDir = path.join(__dirname, '../../uploads/profile');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

/**
 * Normalizes file extension from originalname or mimetype
 */
function getImageExtension(file) {
  let ext = path.extname(file?.originalname || '').toLowerCase();
  if (!ext && file?.mimetype) {
    if (file.mimetype === 'image/png') ext = '.png';
    else if (file.mimetype === 'image/jpeg') ext = '.jpeg';
    else if (file.mimetype === 'image/jpg') ext = '.jpg';
    else if (file.mimetype === 'image/webp') ext = '.webp';
    else if (file.mimetype === 'image/gif') ext = '.gif';
    else ext = '.png';
  }
  if (!ext) ext = '.png';
  return ext;
}

/**
 * Saves a profile image for a student or staff member.
 * Output path on production:
 *   students: /var/concordia/profile/students/[studentId]/image.png/jpeg/...
 *   staff:    /var/concordia/profile/staff/[staffid]/image.png/jpeg/...
 *
 * @param {'students'|'staff'} type
 * @param {string} id - studentId or staffId
 * @param {object} file - multer file object
 * @returns {Promise<string>} public relative URL e.g. /profile/students/[studentId]/image.png
 */
async function saveProfileImage(type, id, file) {
  if (!type || !id || !file) return null;

  const baseDir = getProfileBaseDir();
  const cleanId = String(id).trim();
  const targetDir = path.join(baseDir, type, cleanId);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Clean up any existing image.* in this directory to ensure at most one image exists
  try {
    const existing = fs.readdirSync(targetDir);
    for (const f of existing) {
      if (f.startsWith('image.')) {
        try {
          fs.unlinkSync(path.join(targetDir, f));
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error(`[ProfileStorage] Error clearing existing image in ${targetDir}:`, e.message);
  }

  const ext = getImageExtension(file);
  const targetFileName = `image${ext}`;
  const targetFilePath = path.join(targetDir, targetFileName);

  if (file.path) {
    try {
      fs.copyFileSync(file.path, targetFilePath);
      fs.unlinkSync(file.path);
    } catch (err) {
      fs.renameSync(file.path, targetFilePath);
    }
  } else if (file.buffer) {
    fs.writeFileSync(targetFilePath, file.buffer);
  }

  return `/profile/${type}/${cleanId}/${targetFileName}`;
}

/**
 * Deletes the profile image folder for a student or staff member.
 */
async function deleteProfileImage(type, id) {
  if (!type || !id) return;
  const baseDir = getProfileBaseDir();
  const cleanId = String(id).trim();
  const targetDir = path.join(baseDir, type, cleanId);

  try {
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn(`[ProfileStorage] Failed to delete directory ${targetDir}:`, e.message);
  }
}

/**
 * Resolves the actual profile image file on disk if it exists.
 * Supports cross-lookup (e.g. staff MongoDB _id <-> staffId).
 */
async function resolveProfileImageFile(type, id) {
  if (!type || !id) return null;
  const baseDir = getProfileBaseDir();
  const cleanId = String(id).trim();

  // 1. Direct check: baseDir/type/cleanId/image.*
  const targetDir = path.join(baseDir, type, cleanId);
  if (fs.existsSync(targetDir)) {
    const files = fs.readdirSync(targetDir);
    const img = files.find(f => f.startsWith('image.'));
    if (img) return path.join(targetDir, img);
  }

  // 2. Cross-lookup for staff: cleanId might be staffId or _id
  if (type === 'staff') {
    try {
      const Staff = mongoose.models.Staff || require('../models').Staff;
      let staff = null;
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        staff = await Staff.findById(cleanId).select('staffId').lean();
      }
      if (!staff) {
        staff = await Staff.findOne({ staffId: cleanId }).select('_id').lean();
      }
      const alternateId = staff?.staffId || staff?._id?.toString();
      if (alternateId && alternateId !== cleanId) {
        const altDir = path.join(baseDir, 'staff', alternateId);
        if (fs.existsSync(altDir)) {
          const files = fs.readdirSync(altDir);
          const img = files.find(f => f.startsWith('image.'));
          if (img) return path.join(altDir, img);
        }
      }
    } catch (_) {}
  }

  // 3. Cross-lookup for students: cleanId might be rollNumber or _id
  if (type === 'students') {
    try {
      const Student = mongoose.models.Student || require('../models').Student;
      let student = null;
      if (mongoose.Types.ObjectId.isValid(cleanId)) {
        student = await Student.findById(cleanId).select('rollNumber').lean();
      }
      if (!student) {
        student = await Student.findOne({ rollNumber: cleanId }).select('_id').lean();
      }
      const alternateId = student?.rollNumber || student?._id?.toString();
      if (alternateId && alternateId !== cleanId) {
        const altDir = path.join(baseDir, 'students', alternateId);
        if (fs.existsSync(altDir)) {
          const files = fs.readdirSync(altDir);
          const img = files.find(f => f.startsWith('image.'));
          if (img) return path.join(altDir, img);
        }
      }
    } catch (_) {}
  }

  return null;
}

module.exports = {
  getProfileBaseDir,
  saveProfileImage,
  deleteProfileImage,
  resolveProfileImageFile,
};
