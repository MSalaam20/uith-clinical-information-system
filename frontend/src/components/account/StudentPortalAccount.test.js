import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudentPortalAccount from "./StudentPortalAccount";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: {
    getPatientPortalAccount: jest.fn(),
    createPatientPortalAccount: jest.fn(),
    resetPatientTemporaryPassword: jest.fn(),
    updatePatientPortalStatus: jest.fn(),
  },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const patient = { id: 4, matric_number: "TEST/004", first_name: "Test", last_name: "Student", email: "student@test.invalid" };

test("receptionist can create a linked student portal account", async () => {
  clinicalApi.getPatientPortalAccount.mockResolvedValue({ linked: false });
  clinicalApi.createPatientPortalAccount.mockResolvedValue({ account: { linked: true, username: "TEST/004" }, temporary_password: "StudentTemp123!" });
  render(<StudentPortalAccount patient={patient} role="RC" />);
  const openButton = await screen.findByRole("button", { name: /create student account/i });
  await waitFor(() => expect(openButton).toBeEnabled());
  fireEvent.click(openButton);
  expect(screen.getByLabelText("Matriculation number (login username)")).toHaveValue("TEST/004");
  expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /create linked account/i }));
  await waitFor(() => expect(clinicalApi.createPatientPortalAccount).toHaveBeenCalledWith(4, expect.objectContaining({ email: "student@test.invalid" })));
  expect(clinicalApi.createPatientPortalAccount.mock.calls[0][1]).not.toHaveProperty("username");
  expect(await screen.findByText("StudentTemp123!")).toBeInTheDocument();
});

test("doctor does not receive student account administration controls", () => {
  render(<StudentPortalAccount patient={patient} role="DC" />);
  expect(screen.queryByText("Student portal account")).not.toBeInTheDocument();
});
