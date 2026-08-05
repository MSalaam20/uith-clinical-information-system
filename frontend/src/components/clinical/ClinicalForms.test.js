import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClinicalNoteForm, DiagnosisForm, VitalSignForm } from "./ClinicalForms";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    createVitalSign: jest.fn(),
    createClinicalNote: jest.fn(),
    updateClinicalNote: jest.fn(),
    createDiagnosis: jest.fn(),
    updateDiagnosis: jest.fn(),
    listIcdCodes: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const visit = { id: 12 };

beforeEach(() => jest.clearAllMocks());

test("vital-sign form rejects inverted blood pressure before the API call", () => {
  render(<VitalSignForm visit={visit} onSaved={jest.fn()} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Systolic BP"), { target: { value: "70" } });
  fireEvent.change(screen.getByLabelText("Diastolic BP"), { target: { value: "90" } });
  fireEvent.click(screen.getByRole("button", { name: /save vital signs/i }));
  expect(screen.getByText(/systolic pressure must exceed/i)).toBeInTheDocument();
  expect(clinicalApi.createVitalSign).not.toHaveBeenCalled();
});

test("clinical-note form submits patient visibility", async () => {
  clinicalApi.createClinicalNote.mockResolvedValue({ id: 1 });
  const onSaved = jest.fn();
  render(<ClinicalNoteForm visit={visit} onSaved={onSaved} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Clinical note"), { target: { value: "Patient instructions" } });
  fireEvent.click(screen.getByLabelText(/visible in the student/i));
  fireEvent.click(screen.getByRole("button", { name: /save note/i }));
  await waitFor(() => expect(clinicalApi.createClinicalNote).toHaveBeenCalledWith(expect.objectContaining({ visit: 12, patient_visible: true })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
});

test("clinical-note form updates an existing author-owned note", async () => {
  clinicalApi.updateClinicalNote.mockResolvedValue({ id: 9 });
  const onSaved = jest.fn();
  const note = { id: 9, note_type: "nursing", note: "Initial observation", patient_visible: false };
  render(<ClinicalNoteForm visit={visit} note={note} onSaved={onSaved} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Clinical note"), { target: { value: "Updated observation" } });
  fireEvent.click(screen.getByRole("button", { name: /update note/i }));
  await waitFor(() => expect(clinicalApi.updateClinicalNote).toHaveBeenCalledWith(9, expect.objectContaining({ note: "Updated observation", visit: 12 })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(clinicalApi.createClinicalNote).not.toHaveBeenCalled();
});

test("diagnosis form searches, selects and submits an ICD-11 code", async () => {
  jest.useFakeTimers();
  clinicalApi.listIcdCodes.mockResolvedValue({ items: [{ id: 4, code: "BA00", title: "Essential hypertension" }] });
  clinicalApi.createDiagnosis.mockResolvedValue({ id: 8 });
  const onSaved = jest.fn();
  render(<DiagnosisForm visit={visit} onSaved={onSaved} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("ICD-11 code or diagnosis"), { target: { value: "hyper" } });
  await act(async () => { jest.advanceTimersByTime(350); });
  await waitFor(() => expect(clinicalApi.listIcdCodes).toHaveBeenCalledWith("hyper"));
  fireEvent.click(await screen.findByRole("button", { name: /BA00.*Essential hypertension/i }));
  fireEvent.click(screen.getByRole("button", { name: /save diagnosis/i }));
  await waitFor(() => expect(clinicalApi.createDiagnosis).toHaveBeenCalledWith(expect.objectContaining({ visit: 12, icd_code: 4, diagnosis_type: "confirmed" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  jest.useRealTimers();
});

test("diagnosis form corrects an existing ICD-linked diagnosis", async () => {
  clinicalApi.updateDiagnosis.mockResolvedValue({ id: 8 });
  const existing = {
    id: 8,
    diagnosis_type: "provisional",
    description: "Possible hypertension",
    icd: { id: 4, code: "BA00", title: "Essential hypertension" },
  };
  const onSaved = jest.fn();
  render(<DiagnosisForm visit={visit} diagnosis={existing} onSaved={onSaved} onCancel={jest.fn()} />);
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Confirmed hypertension" } });
  fireEvent.click(screen.getByRole("button", { name: /update diagnosis/i }));
  await waitFor(() => expect(clinicalApi.updateDiagnosis).toHaveBeenCalledWith(8, expect.objectContaining({ icd_code: 4, description: "Confirmed hypertension" })));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(clinicalApi.createDiagnosis).not.toHaveBeenCalled();
});
