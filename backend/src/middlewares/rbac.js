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

        if (moduleActions && typeof moduleActions === 'object' && Object.keys(moduleActions).length > 0) {
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
            : (moduleActions[key] || moduleActions['_root'] || moduleActions[moduleLabel]);

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
            // If explicit subActions are configured and action is false/unauthorized, deny
            return res.status(403).json({
              message: `Forbidden: You do not have '${action}' permission for ${moduleLabel} (${subModuleId})`
            });
          }

          // Granular permissions are configured for this module, but this submodule is not granted
          return res.status(403).json({
            message: `Forbidden: You do not have '${action}' permission for ${moduleLabel} (${subModuleId})`
          });
        }
      }

      // Check subModules map if granular actions are not configured
      const subModulesConfig = user.permissions?.subModules;
      if (subModulesConfig && typeof subModulesConfig === 'object') {
        const matchedSubKey = Object.keys(subModulesConfig).find(
          (k) => k.toLowerCase() === moduleLabel?.toLowerCase()
        );
        const configuredSubs = matchedSubKey ? subModulesConfig[matchedSubKey] : subModulesConfig[moduleLabel];
        if (Array.isArray(configuredSubs)) {
          if (configuredSubs.includes(subModuleId) && action.toLowerCase() === 'read') {
            return next();
          }
          return res.status(403).json({
            message: `Forbidden: You do not have '${action}' permission for ${moduleLabel} (${subModuleId})`
          });
        }
      }

      // If user has module access and this is a read action (and no granular restrictions configured), allow
      if (action.toLowerCase() === 'read') {
        const modules = user.permissions?.modules || [];
        if (modules.some((m) => m.toLowerCase() === moduleLabel.toLowerCase())) {
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
