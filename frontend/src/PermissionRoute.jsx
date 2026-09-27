import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { refreshTokens, userWho } from "../config/apis";
import { hasModuleAccess } from "@/lib/navigation.jsx";

export default function PermissionRoute({ children, moduleName }) {
  const navigate = useNavigate();
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
            navigate("/login");
            throw error;
          }
        }
        throw error;
      }
    },
    retry: false,
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  const canAccess = hasModuleAccess(currentUser, moduleName);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
