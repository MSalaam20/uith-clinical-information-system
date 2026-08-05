import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StaffManagement from "./StaffManagement";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    listStaff: jest.fn(),
    updateStaffRole: jest.fn(),
    updateStaffStatus: jest.fn(),
    createStaff: jest.fn(),
    resetStaffTemporaryPassword: jest.fn(),
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

test("administrator can create staff and receives one-time credentials", async () => {
  clinicalApi.listStaff.mockResolvedValue({ items: [], count: 0 });
  clinicalApi.createStaff.mockResolvedValue({
    account: { id: 7, username: "new-doctor", role: "DC" },
    temporary_password: "GeneratedPass123!",
  });
  render(<StaffManagement />);
  fireEvent.click(await screen.findByRole("button", { name: /create staff account/i }));
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "New" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Doctor" } });
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "new-doctor" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "new@clinic.test" } });
  fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));
  await waitFor(() => expect(clinicalApi.createStaff).toHaveBeenCalled());
  expect(await screen.findByText("GeneratedPass123!")).toBeInTheDocument();
  expect(screen.getByText(/will not be displayed again/i)).toBeInTheDocument();
});
