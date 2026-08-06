import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { RiArchiveLine, RiExchangeLine, RiShieldCheckLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { IntakeCard, WorkflowHeader, WorkflowState } from "./WorkflowPrimitives";
import "./Workflow.css";

export default function ClinicOverview() {
  const [items, setItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [operation, setOperation] = useState(null);
  const [values, setValues] = useState({ assigned_doctor: "", target_status: "NURSE_REVIEW", reason: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try {
      const [intakes, available] = await Promise.all([clinicalApi.listIntakes(), clinicalApi.listAvailableDoctors()]);
      setItems(intakes.items); setDoctors(available);
    } catch (requestError) { setError(apiError(requestError, "Clinic workflow oversight could not be loaded.").message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (id, type, intake) => {
    setOperation({ id, type });
    setValues({ assigned_doctor: intake.assigned_doctor || "", target_status: "NURSE_REVIEW", reason: "" });
  };
  const submit = async (event, intake) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      if (operation.type === "reassign") await clinicalApi.reassignIntake(intake.id, { assigned_doctor: values.assigned_doctor, reason: values.reason });
      if (operation.type === "correct") await clinicalApi.correctIntake(intake.id, { target_status: values.target_status, reason: values.reason });
      if (operation.type === "archive") await clinicalApi.archiveIntake(intake.id, values.reason);
      setOperation(null); await load();
    } catch (requestError) { setError(apiError(requestError, "The oversight action could not be completed.").message); }
    finally { setSaving(false); }
  };
  const active = items.filter((item) => !["COMPLETED", "FOLLOW_UP_REQUIRED", "CANCELLED", "ARCHIVED"].includes(item.status));
  return <main className="workflow-workspace overview-workspace"><WorkflowHeader eyebrow="Doctor-in-Charge portal" title="Clinic workflow overview" description="Oversee active handoffs, assignments, corrections and archived cases." onRefresh={load} refreshing={loading} /><section className="overview-metrics" aria-label="Workflow totals"><div><span>All workflows</span><strong>{items.length}</strong></div><div><span>Active cases</span><strong>{active.length}</strong></div><div><span>Unassigned</span><strong>{active.filter((item) => !item.assigned_doctor).length}</strong></div><div><span>In consultation</span><strong>{items.filter((item) => item.status === "IN_CONSULTATION").length}</strong></div></section><WorkflowState loading={loading} error={error} empty={!items.length}><div className="intake-card-grid">{items.map((intake) => <IntakeCard key={intake.id} intake={intake}><Button variant="outline-primary" onClick={() => open(intake.id, "reassign", intake)}><RiExchangeLine /> Reassign</Button><Button variant="outline-secondary" onClick={() => open(intake.id, "correct", intake)}><RiShieldCheckLine /> Correct State</Button>{intake.status !== "ARCHIVED" && <Button variant="outline-danger" onClick={() => open(intake.id, "archive", intake)}><RiArchiveLine /> Archive</Button>}{operation?.id === intake.id && <Form className="inline-oversight-form" onSubmit={(event) => submit(event, intake)}>{operation.type === "reassign" && <Form.Group controlId={`reassign-${intake.id}`}><Form.Label>New doctor</Form.Label><Form.Select value={values.assigned_doctor} onChange={(event) => setValues({ ...values, assigned_doctor: event.target.value })} required><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</Form.Select></Form.Group>}{operation.type === "correct" && <Form.Group controlId={`correct-${intake.id}`}><Form.Label>Corrected workflow state</Form.Label><Form.Select value={values.target_status} onChange={(event) => setValues({ ...values, target_status: event.target.value })}><option value="NURSE_REVIEW">Nurse review</option><option value="WAITING_FOR_DOCTOR">Waiting for doctor</option><option value="DOCTOR_CONFIRMED">Doctor confirmed</option></Form.Select></Form.Group>}<Form.Group controlId={`reason-${intake.id}`}><Form.Label>{operation.type === "archive" ? "Archive reason" : "Reason for change"}</Form.Label><Form.Control as="textarea" rows={2} value={values.reason} onChange={(event) => setValues({ ...values, reason: event.target.value })} required /></Form.Group><div><Button type="button" variant="outline-secondary" onClick={() => setOperation(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Confirm</Button></div></Form>}</IntakeCard>)}</div></WorkflowState>{error && !loading && <div className="workflow-state error" role="alert">{error}</div>}</main>;
}
