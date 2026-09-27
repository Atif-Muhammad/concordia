const { User } = require('../models');

/**
 * Middleware to enforce granular RBAC action-level permissions on backend endpoints.
 * 
 * @param {string} moduleLabel - E.g. 'Front Office', 'Students', 'Staff', etc.
 * @param {string} subModuleId - E.g. 'inquiry', 'active', 'challans', etc. Defaults to '_root'.
 * @param {string} action - 'read' | 'create' | 'update' | 'delete' | 'payFee' | 'approvals'
 */
const checkPermission = (moduleLabel, subModuleId = '_root', action = 'read') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const role = req.user.role;
      if (role === 'SUPER_ADMIN' || role === 'Super Admin') {
        return next();
      }

      // Fetch user from DB to check current permissions
      const user = await User.findById(req.user.id).select('permissions role');
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (user.role === 'SUPER_ADMIN' || user.role === 'Super Admin' || user.permissions?.all === true) {
        return next();
      }

      const actions = user.permissions?.actions || user.permissions?.crud;
      if (actions && typeof actions === 'object') {
        const matchedModuleKey = Object.keys(actions).find(
          (k) => k.toLowerCase() === moduleLabel?.toLowerCase()
        );
        const moduleActions = matchedModuleKey ? actions[matchedModuleKey] : (actions[moduleLabel] || actions[moduleLabel?.toLowerCase()]);

        if (moduleActions && typeof moduleActions === 'object') {
          const key = subModuleId || '_root';
          const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');

          const matchedSubKey = Object.keys(moduleActions).find((k) => {
            const normK = k.toLowerCase().replace(/[-_\s]/g, '');
            return (
              k.toLowerCase() === key.toLowerCase() ||
              normK === normalizedKey ||
              normK === normalizedKey.replace(/book$/, '') ||
              normalizedKey === normK.replace(/book$/, '') ||
              normK.replace(/s$/, '') === normalizedKey.replace(/s$/, '')
            );
          });
          const subActions = matchedSubKey
            ? moduleActions[matchedSubKey]
            : (moduleActions[key] || moduleActions['_root'] || moduleActions[moduleLabel] || Object.values(moduleActions)[0]);

          if (subActions && typeof subActions === 'object') {
            const act = action.toLowerCase();
            if (subActions[action] === true || subActions[act] === true) {
              return next();
            }
            if (['pay', 'payfee'].includes(act) && (subActions.payFee === true || subActions.pay === true)) {
              return next();
            }
            if (['approve', 'approval', 'approvals'].includes(act) && (subActions.approvals === true || subActions.approve === true)) {
              return next();
            }
            if (['close', 'closing'].includes(act) && (subActions.closing === true || subActions.close === true)) {
              return next();
            }
          }
        }
      }

      // If user has module/submodule access and this is a read action, allow
      if (action.toLowerCase() === 'read') {
        const modules = user.permissions?.modules || [];
        if (modules.includes(moduleLabel)) {
          return next();
        }
      }

      return res.status(403).json({
        message: `Forbidden: You do not have '${action}' permission for ${moduleLabel} (${subModuleId})`
      });
    } catch (err) {
      next(err);
    }
  };
};

module.exports = { checkPermission };
