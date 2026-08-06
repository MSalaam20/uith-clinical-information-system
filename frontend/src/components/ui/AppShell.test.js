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
        profile: { role, first_name: "Test", last_name: "User", email: "test@example.invalid" },
      }) => state,
    },
  });
  return render(<Provider store={store}><MemoryRouter><AppShell><span>Workspace content</span></AppShell></MemoryRouter></Provider>);
};

test.each([
  ["AD", "Clinic Overview", ["Staff Management", "Audit Logs", "System Overview"], []],
  ["DC", "My Queue", ["Patients", "ICD-11"], ["Staff Management", "Audit Logs"]],
  ["NS", "Intake Queue", ["Appointments"], ["Patients", "ICD-11", "Staff Management", "Audit Logs"]],
  ["RC", "New Intake", ["Student Directory", "Today's Intakes"], ["ICD-11", "Staff Management", "Audit Logs"]],
  ["PT", "My Care Journey", ["My Appointments", "My Health Record"], ["Patients", "Staff Management", "Audit Logs"]],
])("%s receives a distinct navigation set", (role, primary, included, excluded) => {
  renderShell(role);
  expect(screen.getByRole("link", { name: primary })).toBeInTheDocument();
  included.forEach((label) => expect(screen.getByRole("link", { name: label })).toBeInTheDocument());
  excluded.forEach((label) => expect(screen.queryByRole("link", { name: label })).not.toBeInTheDocument());
});
