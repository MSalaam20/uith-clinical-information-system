import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { Link } from "react-router-dom";
import { RiCheckDoubleLine, RiFileList3Line, RiPlayCircleLine, RiStethoscopeLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { IntakeCard, WorkflowHeader, WorkflowState } from "./WorkflowPrimitives";
import "./Workflow.css";

export default function DoctorQueue() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [completion, setCompletion] = useState({ summary: "", follow_up_instructions: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setItems((await clinicalApi.listIntakes()).items); }
    catch (requestError) { setError(apiError(requestError, "Your doctor queue could not be loaded.").message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const perform = async (request, fallback) => {
    setSaving(true); setError("");
    try { await request(); await load(); }
    catch (requestError) { setError(apiError(requestError, fallback).message); }
    finally { setSaving(false); }
  };
  const complete = async (event, intake) => {
    event.preventDefault();
    await perform(() => clinicalApi.completeIntake(intake.id, completion), "The consultation could not be completed.");
    setSelected(null); setCompletion({ summary: "", follow_up_instructions: "" });
  };
  return <main className="workflow-workspace doctor-workspace"><WorkflowHeader eyebrow="Doctor portal" title="My consultation queue" description="Confirm assigned students, begin consultation, document care, and complete the case." onRefresh={load} refreshing={loading} /><WorkflowState loading={loading} error={error} empty={!items.length}><div className="intake-card-grid">{items.map((intake) => <IntakeCard key={intake.id} intake={intake}>
    {intake.status === "WAITING_FOR_DOCTOR" && <Button onClick={() => perform(() => clinicalApi.confirmIntake(intake.id), "The appointment could not be confirmed.")} disabled={saving}><RiCheckDoubleLine /> Confirm Appointment</Button>}
    {intake.status === "DOCTOR_CONFIRMED" && <Button onClick={() => perform(() => clinicalApi.startConsultation(intake.id), "The consultation could not be started.")} disabled={saving}><RiPlayCircleLine /> Start Consultation</Button>}
    {["IN_CONSULTATION", "ATTENDED"].includes(intake.status) && <><Button as={Link} to={`/patients/${intake.patient}`} variant="outline-primary"><RiStethoscopeLine /> Open Clinical Workspace</Button><Button onClick={() => setSelected(selected === intake.id ? null : intake.id)}><RiFileList3Line /> Complete Consultation</Button></>}
    {selected === intake.id && <Form className="inline-completion-form" onSubmit={(event) => complete(event, intake)}><Form.Group controlId={`summary-${intake.id}`}><Form.Label>Approved visit summary</Form.Label><Form.Control as="textarea" rows={3} value={completion.summary} onChange={(event) => setCompletion({ ...completion, summary: event.target.value })} required /></Form.Group><Form.Group controlId={`followup-${intake.id}`}><Form.Label>Follow-up instructions</Form.Label><Form.Control as="textarea" rows={2} value={completion.follow_up_instructions} onChange={(event) => setCompletion({ ...completion, follow_up_instructions: event.target.value })} /></Form.Group><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Mark Consultation Complete</Button></Form>}
  </IntakeCard>)}</div></WorkflowState>{error && !loading && <div className="workflow-state error" role="alert">{error}</div>}</main>;
}
