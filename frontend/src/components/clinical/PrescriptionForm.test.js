import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PrescriptionForm from "./PrescriptionForm";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    listMedications: jest.fn(),
    createMedication: jest.fn(),
    updateMedication: jest.fn(),
    createPrescription: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const patient = { id: 2, first_name: "Amina", last_name: "Student" };
const visit = { id: 7, visit_date: "2026-08-05T09:00:00Z" };

beforeEach(() => {
  jest.clearAllMocks();
  clinicalApi.listMedications.mockResolvedValue({ items: [{ id: 3, name: "Paracetamol", generic_name: "Acetaminophen", strength: "500 mg", form: "tablet" }] });
});

test("prescription form adds an item and submits the complete prescription", async () => {
  clinicalApi.createPrescription.mockResolvedValue({ id: 10 });
  const onSaved = jest.fn();
  render(<PrescriptionForm patient={patient} visit={visit} onSaved={onSaved} onCancel={jest.fn()} />);
  await screen.findByRole("option", { name: /Paracetamol/i });
  fireEvent.change(screen.getByLabelText("Medication"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "500 mg" } });
  fireEvent.change(screen.getByLabelText("Frequency"), { target: { value: "Twice daily" } });
  fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "5 days" } });
  fireEvent.click(screen.getByRole("button", { name: /add item/i }));
  expect(screen.getByRole("button", { name: /remove prescription item/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /save prescription/i }));
  await waitFor(() => expect(clinicalApi.createPrescription).toHaveBeenCalledWith(expect.objectContaining({
    patient: 2,
    visit: 7,
    items: [expect.objectContaining({ medication: "3", dose: "500 mg" })],
  })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("prescription form prevents submission without an item", async () => {
  render(<PrescriptionForm patient={patient} visit={visit} onSaved={jest.fn()} onCancel={jest.fn()} />);
  await screen.findByRole("option", { name: /Paracetamol/i });
  expect(screen.getByRole("button", { name: /save prescription/i })).toBeDisabled();
  expect(clinicalApi.createPrescription).not.toHaveBeenCalled();
});

test("authorized prescriber can update a selected medication presentation", async () => {
  clinicalApi.updateMedication.mockResolvedValue({ id: 3, name: "Paracetamol", generic_name: "Acetaminophen", strength: "650 mg", form: "tablet" });
  render(<PrescriptionForm patient={patient} visit={visit} onSaved={jest.fn()} onCancel={jest.fn()} />);
  await screen.findByRole("option", { name: /Paracetamol/i });
  fireEvent.change(screen.getByLabelText("Medication"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: /edit selected/i }));
  fireEvent.change(screen.getByLabelText("Strength"), { target: { value: "650 mg" } });
  fireEvent.click(screen.getByRole("button", { name: /update medication/i }));
  await waitFor(() => expect(clinicalApi.updateMedication).toHaveBeenCalledWith(3, expect.objectContaining({ strength: "650 mg" })));
  await waitFor(() => expect(screen.queryByText("Edit medication presentation")).not.toBeInTheDocument());
});
