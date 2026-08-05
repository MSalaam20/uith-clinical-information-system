import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AuditLogViewer from "./AuditLogViewer";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    listAuditLogs: jest.fn(),
    listStaff: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  clinicalApi.listStaff.mockResolvedValue({ items: [] });
});

test("audit viewer renders immutable request evidence and strips nested secrets", async () => {
  clinicalApi.listAuditLogs.mockResolvedValue({
    count: 1,
    items: [{
      id: 1,
      timestamp: "2026-08-05T10:00:00Z",
      username: "admin.user",
      action: "patient_updated",
      resource_type: "Patient",
      resource_id: "4",
      description: "Patient demographics updated.",
      request_method: "PATCH",
      request_path: "/api/patients/4/",
      ip_address: "127.0.0.1",
      success: true,
      metadata: {
        safe_detail: "Visible detail",
        nested: { refresh_token: "HiddenValue", count: 2 },
      },
    }],
  });

  render(<AuditLogViewer />);
  expect(await screen.findByText("patient_updated")).toBeInTheDocument();
  expect(screen.getByText(/PATCH \/api\/patients\/4\//)).toBeInTheDocument();
  fireEvent.click(screen.getByText("patient_updated").closest("tr"));
  expect(await screen.findByText(/Visible detail/)).toBeInTheDocument();
  expect(screen.queryByText(/HiddenValue/)).not.toBeInTheDocument();
  await waitFor(() => expect(clinicalApi.listStaff).toHaveBeenCalled());
});
