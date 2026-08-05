import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute = ({ children, isAuthenticated, role, allowedRoles, mustChangePassword }) => {
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (mustChangePassword && location.pathname !== "/change-temporary-password") {
    return <Navigate to="/change-temporary-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
