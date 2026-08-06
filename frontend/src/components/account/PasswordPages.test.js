import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import authReducer from "../../slices/AuthSlice";
import { ChangePasswordPage, ForgotPasswordPage } from "./PasswordPages";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({
  clinicalApi: { changePassword: jest.fn(), requestPasswordReset: jest.fn() },
  apiError: (error, fallback) => ({ message: fallback, fields: {} }),
}));

const renderWithStore = (component) => render(<Provider store={configureStore({ reducer: { auth: authReducer } })}><MemoryRouter>{component}</MemoryRouter></Provider>);

test("change password validates matching confirmation before API submission", () => {
  renderWithStore(<ChangePasswordPage />);
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "CurrentPass123!" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewPass123!" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "DifferentPass123!" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(screen.getByText(/confirmation does not match/i)).toBeInTheDocument();
  expect(clinicalApi.changePassword).not.toHaveBeenCalled();
});

test("change password shows the simplified memorable-password rule", () => {
  renderWithStore(<ChangePasswordPage temporary />);
  expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
  expect(screen.getByText(/memorable phrase/i)).toBeInTheDocument();
});

test("forgot password form submits a generic recovery request", async () => {
  clinicalApi.requestPasswordReset.mockResolvedValue({});
  renderWithStore(<ForgotPasswordPage />);
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "user@clinic.test" } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
  expect(await screen.findByText(/If an active account matches/i)).toBeInTheDocument();
});
