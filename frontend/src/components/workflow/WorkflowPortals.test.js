import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { clinicalApi } from "../../api/clinicalApi";
import CareJourney from "./CareJourney";
import ClinicOverview from "./ClinicOverview";
import DoctorQueue from "./DoctorQueue";
import NurseQueue from "./NurseQueue";
import ReceptionIntake from "./ReceptionIntake";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    listPatients: jest.fn(), createIntake: jest.fn(), submitIntake: jest.fn(),
    listIntakes: jest.fn(), listAvailableDoctors: jest.fn(),
    beginIntakeReview: jest.fn(), scheduleIntake: jest.fn(), rescheduleIntake: jest.fn(),
    confirmIntake: jest.fn(), startConsultation: jest.fn(), completeIntake: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: error?.response?.data?.detail || fallback, fields: error?.response?.data || {} }),
}));

const patient = { id: 2, first_name: "Amina", last_name: "Yusuf", matric_number: "DEMO/001" };
const baseIntake = {
  id: 7, patient: 2, patient_detail: patient, reason_for_visit: "Headache",
  presenting_complaint: "Headache since morning", priority: "routine",
  status: "SENT_TO_NURSE", updated_at: "2026-08-05T09:10:00Z", history: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  clinicalApi.listPatients.mockResolvedValue({ items: [patient] });
  clinicalApi.listIntakes.mockResolvedValue({ items: [] });
  clinicalApi.listAvailableDoctors.mockResolvedValue([{ id: 4, name: "Dr. I. Musa" }]);
});

test("reception creates and submits an intake without clinical controls", async () => {
  clinicalApi.createIntake.mockResolvedValue({ id: 7 });
  clinicalApi.submitIntake.mockResolvedValue({ ...baseIntake, patient_detail: patient });
  render(<MemoryRouter><ReceptionIntake /></MemoryRouter>);
  await screen.findByRole("option", { name: /Amina Yusuf/i });
  fireEvent.change(screen.getByLabelText("Student patient"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Reason for visit"), { target: { value: "Headache" } });
  fireEvent.change(screen.getByLabelText("Presenting Complaint as Reported by Student"), { target: { value: "Headache since morning" } });
  fireEvent.click(screen.getByRole("button", { name: /Create and Send to Nurse/i }));
  expect(await screen.findByText("Intake sent to nursing")).toBeInTheDocument();
  expect(clinicalApi.submitIntake).toHaveBeenCalledWith(7);
  expect(screen.queryByText(/diagnosis|prescription/i)).not.toBeInTheDocument();
});

test("nurse can begin review but sees no diagnosis or prescription controls", async () => {
  clinicalApi.listIntakes.mockResolvedValue({ items: [baseIntake] });
  clinicalApi.beginIntakeReview.mockResolvedValue({ ...baseIntake, status: "NURSE_REVIEW" });
  render(<MemoryRouter><NurseQueue /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Begin Review/i }));
  await waitFor(() => expect(clinicalApi.beginIntakeReview).toHaveBeenCalledWith(7));
  expect(screen.queryByText(/diagnose|prescribe/i)).not.toBeInTheDocument();
});

test("nurse schedules an intake with an available doctor", async () => {
  clinicalApi.listIntakes.mockResolvedValue({ items: [{ ...baseIntake, status: "NURSE_REVIEW" }] });
  clinicalApi.scheduleIntake.mockResolvedValue({});
  render(<MemoryRouter><NurseQueue /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Schedule Appointment/i }));
  fireEvent.change(screen.getByLabelText("Available doctor"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: /Save Appointment/i }));
  await waitFor(() => expect(clinicalApi.scheduleIntake).toHaveBeenCalledWith(7, expect.objectContaining({ assigned_doctor: "4" })));
});

test("doctor queue exposes assigned consultation actions without administrator controls", async () => {
  clinicalApi.listIntakes.mockResolvedValue({ items: [{ ...baseIntake, status: "WAITING_FOR_DOCTOR", assigned_doctor_name: "Dr. I. Musa" }] });
  clinicalApi.confirmIntake.mockResolvedValue({});
  render(<MemoryRouter><DoctorQueue /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Confirm Appointment/i }));
  await waitFor(() => expect(clinicalApi.confirmIntake).toHaveBeenCalledWith(7));
  expect(screen.queryByText(/Staff Management|Audit Logs|Archive/i)).not.toBeInTheDocument();
});

test("student journey renders all nine stages and approved completion details", async () => {
  const history = ["RECEPTION_INTAKE", "SENT_TO_NURSE", "NURSE_REVIEW", "APPOINTMENT_SCHEDULED", "WAITING_FOR_DOCTOR", "DOCTOR_CONFIRMED", "IN_CONSULTATION", "ATTENDED", "COMPLETED"].map((status, index) => ({ id: index, to_status: status, created_at: `2026-08-05T${String(9 + index).padStart(2, "0")}:00:00Z` }));
  clinicalApi.listIntakes.mockResolvedValue({ items: [{ ...baseIntake, status: "COMPLETED", status_message: "This clinic visit has been completed.", history, assigned_doctor_name: "Dr. I. Musa", approved_summary: "Reviewed and treated.", approved_prescriptions: [{ id: 1, items: [{ medication: "Paracetamol", dose: "500 mg", frequency: "Twice daily", duration: "3 days", instructions: "After meals" }] }] }] });
  render(<MemoryRouter><CareJourney /></MemoryRouter>);
  expect(await screen.findByText("This clinic visit has been completed.")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Student care journey" }).children).toHaveLength(9);
  expect(screen.getByText("Reviewed and treated.")).toBeInTheDocument();
  expect(screen.getByText("Paracetamol")).toBeInTheDocument();
});

test("Doctor-in-Charge overview provides controlled oversight actions", async () => {
  clinicalApi.listIntakes.mockResolvedValue({ items: [{ ...baseIntake, assigned_doctor: null }] });
  render(<MemoryRouter><ClinicOverview /></MemoryRouter>);
  expect(await screen.findByRole("button", { name: /Reassign/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Correct State/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Archive/i })).toBeInTheDocument();
});
