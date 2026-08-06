import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { Link } from "react-router-dom";
import { RiAddLine, RiSearchLine, RiSendPlaneLine, RiUserAddLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { WorkflowHeader } from "./WorkflowPrimitives";
import "./Workflow.css";

const emptyForm = { patient: "", reason_for_visit: "", presenting_complaint: "", priority: "routine" };

export default function ReceptionIntake() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const loadPatients = async (query = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await clinicalApi.listPatients({ search: query });
      setPatients(response.items);
    } catch (requestError) {
      setError(apiError(requestError, "Student search could not be loaded.").message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPatients(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const intake = await clinicalApi.createIntake(form);
      const submitted = await clinicalApi.submitIntake(intake.id);
      setSuccess(submitted);
      setForm(emptyForm);
    } catch (requestError) {
      const parsed = apiError(requestError, "The intake could not be sent to nursing.");
      setError(Object.values(parsed.fields)[0] || parsed.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="workflow-workspace reception-workspace">
      <WorkflowHeader eyebrow="Reception portal" title="Create clinic intake" description="Find or register the student, record their own description of the problem, and send it to nursing." />
      <div className="reception-layout">
        <section className="workflow-panel student-lookup-panel">
          <div className="workflow-panel-heading"><div><span>Step 1</span><h2>Find existing student</h2></div><Button as={Link} to="/patients" variant="outline-primary"><RiUserAddLine /> Register New Student</Button></div>
          <Form onSubmit={(event) => { event.preventDefault(); loadPatients(search.trim()); }} className="workflow-search"><Form.Control value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or matriculation number" aria-label="Search student directory" /><Button type="submit" aria-label="Search students" title="Search students"><RiSearchLine /></Button></Form>
          <Form.Group controlId="intake-patient"><Form.Label>Student patient</Form.Label><Form.Select value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} required disabled={loading}><option value="">{loading ? "Loading students..." : "Select student"}</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.matric_number || patient.uuid} | {patient.first_name} {patient.last_name}</option>)}</Form.Select></Form.Group>
        </section>
        <section className="workflow-panel intake-entry-panel">
          <div className="workflow-panel-heading"><div><span>Step 2</span><h2>Reported reason for visit</h2></div></div>
          <Form onSubmit={submit}>
            <Form.Group controlId="intake-reason"><Form.Label>Reason for visit</Form.Label><Form.Control value={form.reason_for_visit} onChange={(event) => setForm({ ...form, reason_for_visit: event.target.value })} maxLength={255} required /></Form.Group>
            <Form.Group controlId="intake-complaint"><Form.Label>Presenting Complaint as Reported by Student</Form.Label><Form.Control as="textarea" rows={5} value={form.presenting_complaint} onChange={(event) => setForm({ ...form, presenting_complaint: event.target.value })} maxLength={2000} required /></Form.Group>
            <Form.Group controlId="intake-priority"><Form.Label>Arrival priority</Form.Label><Form.Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option value="routine">Routine</option><option value="priority">Priority</option><option value="urgent">Urgent</option></Form.Select></Form.Group>
            {error && <div className="workflow-state error" role="alert">{error}</div>}
            <Button type="submit" disabled={saving || !form.patient}>{saving ? <Spinner size="sm" /> : <RiSendPlaneLine />} {saving ? "Sending intake" : "Create and Send to Nurse"}</Button>
          </Form>
        </section>
      </div>
      {success && <section className="workflow-success" role="status"><RiAddLine /><div><strong>Intake sent to nursing</strong><span>{success.patient_detail?.first_name} {success.patient_detail?.last_name} can now track “Sent to nurse” in the student portal.</span></div><Button as={Link} to="/reception/intakes" variant="outline-success">View Today's Intakes</Button></section>}
    </main>
  );
}
