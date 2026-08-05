import React, { useCallback, useEffect, useRef, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Nav from "react-bootstrap/Nav";
import Spinner from "react-bootstrap/Spinner";
import Tab from "react-bootstrap/Tab";
import Table from "react-bootstrap/Table";
import {
  RiCalendarCheckLine,
  RiFileList3Line,
  RiHeartPulseLine,
  RiHistoryLine,
  RiMedicineBottleLine,
  RiRefreshLine,
  RiStethoscopeLine,
  RiUserHeartLine,
} from "react-icons/ri";
import { useSelector } from "react-redux";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import calculateAge from "../../utils";
import VisitWorkspace from "./VisitWorkspace";
import LegacyRecordPanel from "./LegacyRecordPanel";
import "./ClinicalWorkspace.css";

const emptyWorkspace = {
  visits: { items: [], count: 0 },
  vitals: { items: [], count: 0 },
  notes: { items: [], count: 0 },
  diagnoses: { items: [], count: 0 },
  prescriptions: { items: [], count: 0 },
  appointments: { items: [], count: 0 },
  records: { items: [], count: 0 },
};

export default function PatientWorkspace() {
  const patient = useSelector((state) => state.patientForm.patient);
  const loadStatus = useSelector((state) => state.patientForm.loadStatus);
  const patientError = useSelector((state) => state.patientForm.loadError);
  const role = useSelector((state) => state.auth.profile?.role);
  const [data, setData] = useState(emptyWorkspace);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    if (!patient?.id) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const workspace = await clinicalApi.getPatientWorkspace(patient.id);
      if (sequence === requestSequence.current) setData(workspace);
    } catch (requestError) {
      if (sequence === requestSequence.current) {
        setError(apiError(requestError, "The patient clinical history could not be loaded.").message);
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [patient?.id]);

  useEffect(() => {
    setData(emptyWorkspace);
    setError("");
    refresh();
    return () => {
      requestSequence.current += 1;
    };
  }, [refresh]);

  if (loadStatus === "loading") {
    return <WorkspaceState icon={<Spinner animation="border" />} title="Loading patient" message="Retrieving the selected patient profile." />;
  }
  if (loadStatus === "failed") {
    return <WorkspaceState icon={<RiUserHeartLine />} title="Patient unavailable" message={patientError || "The patient was not found or is not available to this account."} />;
  }
  if (!patient) {
    return <WorkspaceState icon={<RiUserHeartLine />} title={role === "PT" ? "Loading your health record" : "Select a patient"} message={role === "PT" ? "Your linked patient profile will appear here." : "Search the patient directory and open a profile to begin."} />;
  }

  return (
    <main className="patient-clinical-workspace">
      <PatientHeader patient={patient} loading={loading} refresh={refresh} />
      {error && <div className="workspace-error" role="alert"><span>{error}</span><Button size="sm" variant="outline-danger" onClick={refresh}><RiRefreshLine /> Retry</Button></div>}
      <Tab.Container defaultActiveKey="overview">
        <Nav variant="tabs" className="patient-workspace-tabs" aria-label="Patient record sections">
          <Nav.Item><Nav.Link eventKey="overview"><RiUserHeartLine /> Overview</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="visits"><RiHistoryLine /> Visits <Count value={data.visits.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="vitals"><RiHeartPulseLine /> Vital signs <Count value={data.vitals.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="diagnoses"><RiStethoscopeLine /> Diagnoses <Count value={data.diagnoses.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="notes"><RiFileList3Line /> Notes <Count value={data.notes.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="prescriptions"><RiMedicineBottleLine /> Prescriptions <Count value={data.prescriptions.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="appointments"><RiCalendarCheckLine /> Appointments <Count value={data.appointments.count} /></Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="legacy"><RiFileList3Line /> Legacy records <Count value={data.records.count} /></Nav.Link></Nav.Item>
        </Nav>
        <Tab.Content className="patient-workspace-content">
          <Tab.Pane eventKey="overview"><Overview patient={patient} data={data} /></Tab.Pane>
          <Tab.Pane eventKey="visits"><VisitWorkspace patient={patient} data={data} role={role} refresh={refresh} /></Tab.Pane>
          <Tab.Pane eventKey="vitals"><VitalHistory items={data.vitals.items} /></Tab.Pane>
          <Tab.Pane eventKey="diagnoses"><DiagnosisHistory items={data.diagnoses.items} /></Tab.Pane>
          <Tab.Pane eventKey="notes"><NoteHistory items={data.notes.items} /></Tab.Pane>
          <Tab.Pane eventKey="prescriptions"><PrescriptionHistory items={data.prescriptions.items} /></Tab.Pane>
          <Tab.Pane eventKey="appointments"><AppointmentHistory items={data.appointments.items} /></Tab.Pane>
          <Tab.Pane eventKey="legacy"><LegacyRecordPanel patient={patient} items={data.records.items} role={role} onSaved={refresh} /></Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </main>
  );
}

function PatientHeader({ patient, loading, refresh }) {
  return (
    <header className="patient-workspace-header">
      <div className="patient-avatar">
        {patient.photo ? <img src={patient.photo} alt={`${patient.first_name} ${patient.last_name}`} /> : <span>{patient.first_name?.[0]}{patient.last_name?.[0]}</span>}
      </div>
      <div className="patient-heading">
        <div className="patient-heading-line"><h1>{patient.first_name} {patient.middle_name} {patient.last_name}</h1><Badge bg={patient.is_active ? "success" : "secondary"}>{patient.is_active ? "Active" : "Archived"}</Badge></div>
        <p>{patient.matric_number || patient.uuid} | {patient.gender === "M" ? "Male" : patient.gender === "F" ? "Female" : "Other"} | {calculateAge(patient.date_of_birth)} years</p>
      </div>
      <div className="patient-header-contact"><span>Date of birth<strong>{new Date(patient.date_of_birth).toLocaleDateString()}</strong></span><span>Phone<strong>{patient.phone_number || "Not recorded"}</strong></span></div>
      <Button className="icon-command" variant="outline-primary" onClick={refresh} disabled={loading} aria-label="Refresh patient history" title="Refresh patient history">{loading ? <Spinner size="sm" /> : <RiRefreshLine />}</Button>
    </header>
  );
}

function Overview({ patient, data }) {
  const facts = [
    ["Student/hospital number", patient.matric_number || "Not recorded"],
    ["Department", patient.department || "Not recorded"],
    ["Email", patient.email || "Not recorded"],
    ["Address", patient.address || "Not recorded"],
    ["Next of kin", patient.next_of_kin || "Not recorded"],
    ["Emergency contact", patient.emergency_contact || "Not recorded"],
  ];
  return (
    <div className="patient-overview">
      <section><div className="section-heading"><span>Patient details</span><h2>Demographic overview</h2></div><dl>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section><div className="section-heading"><span>Clinical record</span><h2>History at a glance</h2></div><div className="history-metrics"><Metric label="Visits" value={data.visits.count} /><Metric label="Vital records" value={data.vitals.count} /><Metric label="Diagnoses" value={data.diagnoses.count} /><Metric label="Prescriptions" value={data.prescriptions.count} /><Metric label="Appointments" value={data.appointments.count} /><Metric label="Legacy records" value={data.records.count} /></div></section>
    </div>
  );
}

const Metric = ({ label, value }) => <div><strong>{value}</strong><span>{label}</span></div>;
const Count = ({ value }) => <span className="tab-count">{value}</span>;

function VitalHistory({ items }) {
  if (!items.length) return <Empty label="No vital-sign records are available." />;
  return <HistoryTable headings={["Measured", "Temperature", "Blood pressure", "Pulse", "Respiration", "SpO2", "Weight", "BMI"]} rows={items.map((item) => [new Date(item.measured_at).toLocaleString(), value(item.temperature_c, " C"), item.systolic_bp && item.diastolic_bp ? `${item.systolic_bp}/${item.diastolic_bp}` : "-", value(item.pulse_bpm, " bpm"), value(item.respiratory_rate, "/min"), value(item.oxygen_saturation, "%"), value(item.weight_kg, " kg"), item.bmi || "-"])} />;
}

function DiagnosisHistory({ items }) {
  if (!items.length) return <Empty label="No diagnoses are available." />;
  return <HistoryTable headings={["Date", "ICD-11", "Diagnosis", "Type", "Clinician"]} rows={items.map((item) => [new Date(item.created_at).toLocaleString(), item.code_snapshot || "-", item.description, item.diagnosis_type, item.diagnosed_by_name || "Clinic clinician"])} />;
}

function NoteHistory({ items }) {
  if (!items.length) return <Empty label="No clinical notes are available to this account." />;
  return <ul className="clinical-history-list standalone">{items.map((item) => <li key={item.id}><div><strong>{item.note_type}</strong>{item.patient_visible && <Badge bg="info">Patient visible</Badge>}</div><p>{item.note}</p><span>{item.author_name || "Clinic clinician"} | {new Date(item.created_at).toLocaleString()}</span></li>)}</ul>;
}

function PrescriptionHistory({ items }) {
  if (!items.length) return <Empty label="No prescriptions are available." />;
  return <div className="prescription-history">{items.map((prescription) => <section key={prescription.id}><header><div><strong>{new Date(prescription.prescribed_at).toLocaleDateString()}</strong><span>{prescription.prescribed_by_name || "Prescriber"}</span></div><Badge bg={prescription.status === "active" ? "success" : "secondary"}>{prescription.status}</Badge></header><Table responsive size="sm" className="clinical-table"><thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>{prescription.items.map((item) => <tr key={item.id}><td>{item.medication_detail?.name || "Medication"}</td><td>{item.dose}</td><td>{item.route}</td><td>{item.frequency}</td><td>{item.duration}</td><td>{item.instructions || "-"}</td></tr>)}</tbody></Table>{prescription.notes && <p>{prescription.notes}</p>}</section>)}</div>;
}

function AppointmentHistory({ items }) {
  if (!items.length) return <Empty label="No appointments are available." />;
  return <HistoryTable headings={["Date and time", "Reason", "Status", "Booked by", "Attended by", "Notes"]} rows={items.map((item) => [new Date(item.scheduled_for).toLocaleString(), item.reason, item.status, item.booked_by_name || "-", item.attended_by_name || "-", item.notes || "-"])} />;
}

function HistoryTable({ headings, rows }) {
  return <div className="clinical-table-wrap"><Table responsive hover className="clinical-table"><thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></Table></div>;
}

const value = (input, suffix) => input !== null && input !== undefined ? `${input}${suffix}` : "-";
const Empty = ({ label }) => <div className="clinical-empty-state"><RiHistoryLine /><strong>Nothing recorded yet</strong><span>{label}</span></div>;
const WorkspaceState = ({ icon, title, message }) => <main className="workspace-state">{icon}<h1>{title}</h1><p>{message}</p></main>;
