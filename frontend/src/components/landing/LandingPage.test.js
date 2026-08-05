import React from "react";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage";
import { clinicalApi } from "../../api/clinicalApi";

jest.mock("../../api/clinicalApi", () => ({ clinicalApi: { getDemoAccess: jest.fn() } }));

test("does not render hidden demo credentials", async () => {
  clinicalApi.getDemoAccess.mockRejectedValue({ response: { status: 404 } });
  await act(async () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
  });
  expect(clinicalApi.getDemoAccess).toHaveBeenCalled();
  expect(screen.queryByText(/Defence Demo Access/i)).not.toBeInTheDocument();
  expect(screen.queryByText("HiddenCredentialValue!")).not.toBeInTheDocument();
});

test("renders demo credentials returned by the enabled backend flag", async () => {
  clinicalApi.getDemoAccess.mockResolvedValue({ accounts: [{ role: "Doctor", portal: "staff", username: "dr.demo", password: "DemoPass123!" }] });
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(await screen.findByText(/Defence Demo Access/i)).toBeInTheDocument();
  expect(screen.getByText("dr.demo")).toBeInTheDocument();
});
