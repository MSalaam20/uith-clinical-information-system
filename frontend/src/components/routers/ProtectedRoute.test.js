import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

const renderRoute = ({ authenticated, role, allowedRoles }) => render(
  <MemoryRouter initialEntries={["/protected"]}>
    <Routes>
      <Route path="/" element={<span>Landing</span>} />
      <Route path="/dashboard" element={<span>Dashboard</span>} />
      <Route
        path="/protected"
        element={
          <ProtectedRoute
            isAuthenticated={authenticated}
            role={role}
            allowedRoles={allowedRoles}
          >
            <span>Protected content</span>
          </ProtectedRoute>
        }
      />
    </Routes>
  </MemoryRouter>
);

test("redirects an unauthenticated visitor", () => {
  renderRoute({ authenticated: false });
  expect(screen.getByText("Landing")).toBeInTheDocument();
});

test("redirects an authenticated user with the wrong role", () => {
  renderRoute({ authenticated: true, role: "PT", allowedRoles: ["DC"] });
  expect(screen.getByText("Dashboard")).toBeInTheDocument();
});

test("renders content for an allowed role", () => {
  renderRoute({ authenticated: true, role: "DC", allowedRoles: ["DC"] });
  expect(screen.getByText("Protected content")).toBeInTheDocument();
});
