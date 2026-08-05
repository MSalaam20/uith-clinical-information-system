import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { render, screen, waitFor } from "@testing-library/react";
import PatientWorkspace from "./PatientWorkspace";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    getPatientWorkspace: jest.fn(),
    listSchemas: jest.fn(() => Promise.resolve({ items: [] })),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const emptyData = Object.fromEntries(["visits", "vitals", "notes", "diagnoses", "prescriptions", "appointments", "records"].map((key) => [key, { items: [], count: 0 }]));

beforeEach(() => {
  clinicalApi.listSchemas.mockResolvedValue({ items: [] });
});

const renderWorkspace = (patientForm) => {
  const store = configureStore({
    reducer: {
      patientForm: (state = patientForm) => state,
      auth: (state = { profile: { role: "DC" } }) => state,
    },
  });
  return render(<Provider store={store}><PatientWorkspace /></Provider>);
};

test("patient workspace loads the selected patient clinical history", async () => {
  clinicalApi.getPatientWorkspace.mockResolvedValue(emptyData);
  renderWorkspace({ patient: { id: 5, first_name: "Amina", middle_name: "", last_name: "Student", uuid: "demo-uuid", gender: "F", date_of_birth: "2001-01-01", is_active: true }, loadStatus: "succeeded", loadError: null });
  expect(screen.getByRole("heading", { name: /Amina Student/i })).toBeInTheDocument();
  await waitFor(() => expect(clinicalApi.getPatientWorkspace).toHaveBeenCalledWith(5));
  await waitFor(() => expect(screen.getByRole("button", { name: /refresh patient history/i })).not.toBeDisabled());
  expect(screen.getByRole("tab", { name: /visits/i })).toBeInTheDocument();
});

test("patient workspace renders a clear unavailable state", () => {
  renderWorkspace({ patient: null, loadStatus: "failed", loadError: "Patient not found." });
  expect(screen.getByRole("heading", { name: /patient unavailable/i })).toBeInTheDocument();
  expect(screen.getByText("Patient not found.")).toBeInTheDocument();
});
