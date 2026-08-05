import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Calendar from "./Calendar";
import { apiFetch } from "../../api/apiFetch";

jest.mock("@fullcalendar/react", () => (props) => (
  <div data-testid="calendar">
    {props.events.map((event) => <button key={event.id} onClick={() => props.eventClick({ event: { id: event.id } })}>{event.title}</button>)}
  </div>
));
jest.mock("../../api/apiFetch", () => ({ apiFetch: jest.fn() }));
jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: { updateAppointment: jest.fn(), updateAppointmentStatus: jest.fn(), cancelAppointment: jest.fn() },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

test("appointment calendar maps backend appointments to visible events", async () => {
  apiFetch.mockImplementation((endpoint) => Promise.resolve(endpoint.startsWith("appointments/") ? { results: [{ id: 4, patient: 2, patient_name: "Amina Student", patient_matric_number: "TEST/1", scheduled_for: "2026-08-12T10:00:00Z", reason: "Review", status: "scheduled", notes: "", booked_by_name: "Reception" }] } : { results: [] }));
  const store = configureStore({ reducer: { auth: (state = { profile: { role: "RC" } }) => state } });
  render(<Provider store={store}><Calendar /></Provider>);
  const event = await screen.findByRole("button", { name: /Amina Student.*Review/i });
  fireEvent.click(event);
  await waitFor(() => expect(screen.getByText("Appointment details")).toBeInTheDocument());
  expect(screen.getByText("Reception")).toBeInTheDocument();
});
