import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ClinicalNoteForm, DiagnosisForm, VitalSignForm } from "./ClinicalForms";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    createVitalSign: jest.fn(),
    createClinicalNote: jest.fn(),
    createDiagnosis: jest.fn(),
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
