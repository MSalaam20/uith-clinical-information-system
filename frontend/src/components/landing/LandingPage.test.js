import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

test("renders the clinic workflow and four synthetic product previews", async () => {
  clinicalApi.getDemoAccess.mockResolvedValue({ accounts: [] });
  await act(async () => { render(<MemoryRouter><LandingPage /></MemoryRouter>); });
  expect(screen.getByRole("heading", { name: "How Care Moves Through the Clinic" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Receptionist Intake" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Nurse Queue" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Doctor Consultation" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Student Journey" })).toBeInTheDocument();
});

test("renders the project developer, supervisor and academic affiliation", async () => {
  clinicalApi.getDemoAccess.mockResolvedValue({ accounts: [] });
  await act(async () => { render(<MemoryRouter><LandingPage /></MemoryRouter>); });
  expect(screen.getAllByText("Adebayo").length).toBeGreaterThan(0);
  expect(screen.getByText("Mrs. Y. S. Jeremiah")).toBeInTheDocument();
  expect(screen.getAllByText("Ladoke Akintola University of Technology").length).toBeGreaterThan(0);
  expect(screen.getByText(/Faculty of Computing and Informatics/)).toBeInTheDocument();
  expect(screen.getAllByText(/Department of Computer Science/).length).toBeGreaterThan(0);
  expect(screen.getByText(/not an officially deployed UITH or LAUTECH/i)).toBeInTheDocument();
});

test("care workflow exposes keyboard-focusable stages and updates its detail", async () => {
  clinicalApi.getDemoAccess.mockResolvedValue({ accounts: [] });
  await act(async () => { render(<MemoryRouter><LandingPage /></MemoryRouter>); });
  const doctorStage = screen.getByRole("button", { name: /Doctor Stage 4/i });
  fireEvent.focus(doctorStage);
  expect(doctorStage).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Diagnosis and care")).toBeInTheDocument();
});
