import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { apiFetch } from "../../api/apiFetch";

jest.mock("../../api/apiFetch", () => ({ apiFetch: jest.fn() }));

const summary = {
  patients: 10,
  patients_registered_today: 1,
  appointments_today: 2,
  pending_appointments: 3,
  records: 6,
  visits: 5,
  open_visits: 2,
  vital_signs_today: 1,
  diagnoses_today: 1,
  total_staff: 8,
  recent_visits: [],
  recent_appointments: [],
  recent_audit_activity: [{ id: 1, action: "patient_updated", resource_type: "Patient", success: true, timestamp: "2026-08-05T10:00:00Z" }],
};

const renderDashboard = (profile) => {
  const store = configureStore({ reducer: { auth: (state = { profile }) => state } });
  apiFetch.mockResolvedValue(summary);
  return render(<Provider store={store}><MemoryRouter><Dashboard /></MemoryRouter></Provider>);
};

beforeEach(() => jest.clearAllMocks());

test("administrator dashboard renders live staff and recent audit activity", async () => {
  renderDashboard({ role: "AD", role_display: "Administrator", first_name: "Admin", last_name: "User" });
  expect(await screen.findByText("Staff profiles")).toBeInTheDocument();
  expect(await screen.findByText("patient_updated")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /audit log/i })).toBeInTheDocument();
});

test("student dashboard contains only personal quick links", async () => {
  renderDashboard({ role: "PT", role_display: "Student patient", first_name: "Student", last_name: "User" });
  expect(await screen.findByText("My patient profile")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /my health record/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^staff$/i })).not.toBeInTheDocument();
  expect(screen.queryByText("Recent audit activity")).not.toBeInTheDocument();
});
