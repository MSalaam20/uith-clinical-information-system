import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { RiCalendarCheckLine, RiNurseLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { IntakeCard, WorkflowHeader, WorkflowState } from "./WorkflowPrimitives";
import "./Workflow.css";

const localInput = (value) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function NurseQueue() {
  const [items, setItems] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [schedule, setSchedule] = useState({ assigned_doctor: "", scheduled_for: localInput(), scheduling_note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [intakes, available] = await Promise.all([clinicalApi.listIntakes(), clinicalApi.listAvailableDoctors()]);
      setItems(intakes.items); setDoctors(available);
    } catch (requestError) { setError(apiError(requestError, "The nursing queue could not be loaded.").message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const beginReview = async (intake) => {
    setSaving(true); setError("");
    try { const updated = await clinicalApi.beginIntakeReview(intake.id); setSelected(updated.id); await load(); }
    catch (requestError) { setError(apiError(requestError, "Review could not be started.").message); }
    finally { setSaving(false); }
  };

  const saveSchedule = async (event, intake) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...schedule, scheduled_for: new Date(schedule.scheduled_for).toISOString() };
      if (intake.status === "NURSE_REVIEW") await clinicalApi.scheduleIntake(intake.id, payload);
      else await clinicalApi.rescheduleIntake(intake.id, payload);
      setSelected(null); setSchedule({ assigned_doctor: "", scheduled_for: localInput(), scheduling_note: "" }); await load();
    } catch (requestError) {
      const parsed = apiError(requestError, "The appointment could not be scheduled.");
      setError(parsed.fields.scheduled_for || parsed.message);
    } finally { setSaving(false); }
  };

  return (
    <main className="workflow-workspace nurse-workspace">
      <WorkflowHeader eyebrow="Nursing portal" title="Intake and scheduling queue" description="Review reception submissions, select an available doctor, and schedule the student." onRefresh={load} refreshing={loading} />
      <WorkflowState loading={loading} error={error} empty={!items.length}>
        <div className="intake-card-grid">{items.map((intake) => <IntakeCard key={intake.id} intake={intake}>
          {intake.status === "SENT_TO_NURSE" && <Button onClick={() => beginReview(intake)} disabled={saving}><RiNurseLine /> Begin Review</Button>}
          {["NURSE_REVIEW", "WAITING_FOR_DOCTOR", "DOCTOR_CONFIRMED"].includes(intake.status) && <Button variant="outline-primary" onClick={() => { setSelected(selected === intake.id ? null : intake.id); setSchedule({ assigned_doctor: intake.assigned_doctor || "", scheduled_for: localInput(intake.appointment_detail?.scheduled_for), scheduling_note: "" }); }}><RiCalendarCheckLine /> {intake.status === "NURSE_REVIEW" ? "Schedule Appointment" : "Reschedule"}</Button>}
          {selected === intake.id && <Form className="inline-schedule-form" onSubmit={(event) => saveSchedule(event, intake)}>
            <Form.Group controlId={`doctor-${intake.id}`}><Form.Label>Available doctor</Form.Label><Form.Select value={schedule.assigned_doctor} onChange={(event) => setSchedule({ ...schedule, assigned_doctor: event.target.value })} required><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</Form.Select></Form.Group>
            <Form.Group controlId={`date-${intake.id}`}><Form.Label>Date and time</Form.Label><Form.Control type="datetime-local" value={schedule.scheduled_for} min={localInput()} onChange={(event) => setSchedule({ ...schedule, scheduled_for: event.target.value })} required /></Form.Group>
            <Form.Group controlId={`note-${intake.id}`}><Form.Label>{intake.status === "NURSE_REVIEW" ? "Scheduling note" : "Rescheduling reason"}</Form.Label><Form.Control value={schedule.scheduling_note} onChange={(event) => setSchedule({ ...schedule, scheduling_note: event.target.value })} required={intake.status !== "NURSE_REVIEW"} /></Form.Group>
            <Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Save Appointment</Button>
          </Form>}
        </IntakeCard>)}</div>
      </WorkflowState>
      {error && !loading && <div className="workflow-state error" role="alert">{error}</div>}
    </main>
  );
}
