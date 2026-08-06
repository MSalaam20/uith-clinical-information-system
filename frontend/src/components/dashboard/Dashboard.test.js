import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { apiFetch } from "../../api/apiFetch";

jest.mock("../../api/apiFetch", () => ({ apiFetch: jest.fn() }));

const summary = {
  patients: 10, patients_registered_today: 1, appointments_today: 2,
  records: 6, visits: 5, total_staff: 8, new_intakes: 3,
  waiting_for_nurse: 2, under_review: 1, appointments_scheduled: 2,
  waiting_for_doctor: 1, doctor_confirmed: 1, in_consultation: 1,
  completed_today: 4, follow_ups: 1, unassigned_cases: 1,
  recent_intakes: [], recent_appointments: [],
  recent_audit_activity: [{ id: 1, action: "patient_updated", resource_type: "Patient", success: true, timestamp: "2026-08-05T10:00:00Z" }],
};

const renderDashboard = (role, firstName = "Test") => {
  const store = configureStore({ reducer: { auth: (state = { profile: { role, first_name: firstName, last_name: "User" } }) => state } });
  apiFetch.mockResolvedValue(summary);
  return render(<Provider store={store}><MemoryRouter><Dashboard /></MemoryRouter></Provider>);
};

beforeEach(() => jest.clearAllMocks());

test.each([
  ["AD", /Doctor-in-Charge.*dashboard/i, /Oversee staff, clinic queues/i, "Clinic Overview"],
  ["DC", /Doctor dashboard/i, /complete clinical consultations/i, "My Queue"],
  ["NS", /Nurse dashboard/i, /schedule students with available doctors/i, "Intake Queue"],
  ["RC", /Receptionist dashboard/i, /send clinic intakes to the nursing queue/i, "New Intake"],
  ["PT", /My clinic dashboard/i, /Track your current clinic visit/i, "My Care Journey"],
])("%s dashboard explains role work and exposes its primary action", async (role, heading, responsibility, link) => {
  renderDashboard(role);
  expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  expect(screen.getByText(responsibility)).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: link })).toBeInTheDocument();
});

test("only Doctor-in-Charge sees system audit activity", async () => {
  const { unmount } = renderDashboard("AD");
  expect(await screen.findByText("patient_updated")).toBeInTheDocument();
  unmount();
  renderDashboard("DC");
  await screen.findByRole("heading", { name: /Doctor dashboard/i });
  expect(screen.queryByText("Recent audit activity")).not.toBeInTheDocument();
});
