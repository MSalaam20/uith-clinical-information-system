import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import authReducer from "../../slices/AuthSlice";
import errorReducer from "../../slices/errorSlice";
import apiClient from "../../api/apiClient";
import LoginForm from "./LoginForm";

jest.mock("../../api/apiClient", () => ({ post: jest.fn(), get: jest.fn() }));

const renderLogin = (portalType) => {
  const store = configureStore({ reducer: { auth: authReducer, error: errorReducer } });
  render(<Provider store={store}><MemoryRouter><Routes><Route path="/" element={<LoginForm portalType={portalType} />} /><Route path="/dashboard" element={<span>Dashboard reached</span>} /><Route path="/change-temporary-password" element={<span>Temporary password change</span>} /></Routes></MemoryRouter></Provider>);
};

test.each([
  ["staff", "dr.jeremiah", "SyntheticTestPass123!", "DC"],
  ["student", "2021/52HL034", "SyntheticTestPass123!", "PT"],
])("demo %s account follows its portal login", async (portalType, username, password, role) => {
  apiClient.post.mockResolvedValueOnce({ data: { access: "access-token", refresh: "refresh-token" } });
  apiClient.get.mockResolvedValueOnce({ data: { role, role_display: role, must_change_password: false } });
  renderLogin(portalType);
  fireEvent.change(screen.getByLabelText(portalType === "staff" ? "Username or email" : "Matriculation number"), { target: { value: username } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  expect(await screen.findByText("Dashboard reached")).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledWith("auth/jwt/create/", expect.objectContaining({ username, portal_type: portalType }));
});

test("inactive account message is displayed from the login response", async () => {
  apiClient.post.mockRejectedValueOnce({ response: { data: { detail: "No active account found with the given credentials" } } });
  renderLogin("staff");
  fireEvent.change(screen.getByLabelText("Username or email"), { target: { value: "inactive.user" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SomePass123!" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in to/i }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/No active account found/i));
});
