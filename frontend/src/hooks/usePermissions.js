import { useQuery } from "@tanstack/react-query";
import { userWho, refreshTokens } from "../../config/apis";
import { hasPermission } from "@/lib/navigation.jsx";

/**
 * Custom hook to check granular RBAC permissions for the logged in user.
 * 
 * @param {string} moduleLabel - E.g. "Front Office", "Students", "Staff", "Fee Management", etc.
 * @param {string} subModuleId - E.g. "inquiry", "active", "challans", etc. Defaults to "_root".
 */
export const usePermissions = (moduleLabel, subModuleId = "_root") => {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      try {
        return await userWho();
      } catch (error) {
        if (error.response?.status === 401) {
          try {
            await refreshTokens();
            return await userWho();
          } catch {
            return null;
          }
        }
        return null;
      }
    },
    staleTime: 60000,
    retry: false,
  });

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "Super Admin" || currentUser?.permissions?.all === true;

  const canRead = hasPermission(currentUser, moduleLabel, subModuleId, "read");
  const canCreate = hasPermission(currentUser, moduleLabel, subModuleId, "create");
  const canUpdate = hasPermission(currentUser, moduleLabel, subModuleId, "update");
  const canDelete = hasPermission(currentUser, moduleLabel, subModuleId, "delete");
  const canPayFee = hasPermission(currentUser, moduleLabel, subModuleId, "payFee") || hasPermission(currentUser, moduleLabel, subModuleId, "pay");
  const canApprove = hasPermission(currentUser, moduleLabel, subModuleId, "approvals") || hasPermission(currentUser, moduleLabel, subModuleId, "approve");
  const canClose = hasPermission(currentUser, moduleLabel, subModuleId, "closing") || hasPermission(currentUser, moduleLabel, subModuleId, "close");

  return {
    currentUser,
    isLoading,
    isSuperAdmin,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    canPayFee,
    canApprove,
    canClose,
    canClosing: canClose,
    hasAction: (action) => hasPermission(currentUser, moduleLabel, subModuleId, action),
  };
};

export default usePermissions;
