import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffManagement from "./StaffManagement";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    listStaff: jest.fn(),
    updateStaffRole: jest.fn(),
    updateStaffStatus: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

test("administrator staff page renders approved account fields", async () => {
  clinicalApi.listStaff.mockResolvedValue({ items: [{ id: 1, username: "demo-doctor", first_name: "Demo", last_name: "Doctor", email: "demo@example.invalid", role: "DC", role_display: "doctor", is_active: true }], count: 1 });
  render(<StaffManagement />);
  expect(await screen.findByText("demo-doctor")).toBeInTheDocument();
  expect(screen.getByText("demo@example.invalid")).toBeInTheDocument();
  expect(screen.getByLabelText("Role for demo-doctor")).toHaveValue("DC");
});

test("administrator can confirm a staff role change", async () => {
  const member = { id: 1, username: "demo-doctor", first_name: "Demo", last_name: "Doctor", email: "", role: "DC", role_display: "doctor", is_active: true };
  clinicalApi.listStaff.mockResolvedValue({ items: [member], count: 1 });
  clinicalApi.updateStaffRole.mockResolvedValue({ ...member, role: "NS", role_display: "nurse" });
  jest.spyOn(window, "confirm").mockReturnValue(true);
  render(<StaffManagement />);
  const select = await screen.findByLabelText("Role for demo-doctor");
  fireEvent.change(select, { target: { value: "NS" } });
  await waitFor(() => expect(clinicalApi.updateStaffRole).toHaveBeenCalledWith(1, "NS"));
  await waitFor(() => expect(select).toHaveValue("NS"));
  window.confirm.mockRestore();
});
