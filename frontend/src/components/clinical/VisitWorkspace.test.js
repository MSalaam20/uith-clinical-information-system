import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VisitWorkspace from "./VisitWorkspace";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    createVisit: jest.fn(),
    updateVisit: jest.fn(),
    deleteDiagnosis: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const store = configureStore({
  reducer: {
    auth: (state = { profile: { id: 4, role: "DC" } }) => state,
  },
});

const data = {
  visits: { items: [], count: 0 },
  appointments: { items: [], count: 0 },
};

beforeEach(() => jest.clearAllMocks());

test("doctor creates a patient visit through the workspace", async () => {
  clinicalApi.createVisit.mockResolvedValue({ id: 22 });
  const refresh = jest.fn().mockResolvedValue();
  render(<Provider store={store}><VisitWorkspace patient={{ id: 5 }} data={data} role="DC" refresh={refresh} /></Provider>);
  fireEvent.click(screen.getByRole("button", { name: /new visit/i }));
  fireEvent.change(screen.getByLabelText("Chief complaint"), { target: { value: "Persistent headache" } });
  fireEvent.change(screen.getByLabelText("Initial clinical summary"), { target: { value: "Review required" } });
  fireEvent.click(screen.getByRole("button", { name: /save visit/i }));
  await waitFor(() => expect(clinicalApi.createVisit).toHaveBeenCalledWith(expect.objectContaining({
    patient: 5,
    visit_type: "outpatient",
    chief_complaint: "Persistent headache",
    clinical_summary: "Review required",
    status: "open",
  })));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
});
