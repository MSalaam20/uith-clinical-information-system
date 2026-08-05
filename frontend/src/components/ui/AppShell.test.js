import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";

const renderShell = (role) => {
  const store = configureStore({
    reducer: {
      auth: (state = {
        profile: {
          role,
          role_display: role === "PT" ? "Student patient" : "Administrator",
          first_name: "Test",
          last_name: "User",
          email: "test@example.invalid",
        },
      }) => state,
    },
  });
  return render(<Provider store={store}><MemoryRouter><AppShell><span>Workspace content</span></AppShell></MemoryRouter></Provider>);
};

test("student navigation exposes only personal record workflows", () => {
  renderShell("PT");
  expect(screen.getByRole("link", { name: /my health record/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /my appointments/i })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /student patients/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /staff management/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /audit log/i })).not.toBeInTheDocument();
});

test("administrator navigation includes protected management workspaces", () => {
  renderShell("AD");
  expect(screen.getByRole("link", { name: /staff management/i })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /audit log/i })).toBeInTheDocument();
});
