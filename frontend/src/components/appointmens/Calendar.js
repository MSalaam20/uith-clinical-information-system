import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { RiAddLine, RiCalendarCheckLine, RiCloseCircleLine, RiEdit2Line } from "react-icons/ri";
import { useSelector } from "react-redux";
import { APPOINTMENTS, PATIENTS } from "../../api/apiConfig";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { apiFetch } from "../../api/apiFetch";
import "./Calendar.css";

const emptyForm = { patient: "", assigned_doctor: "", scheduled_for: "", reason: "", notes: "", status: "scheduled" };

const localInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export default function Calendar() {
  const role = useSelector((state) => state.auth.profile?.role);
  const canCreate = ["AD", "NS", "RC"].includes(role);
  const canSchedule = ["AD", "NS"].includes(role);
  const canUpdateStatus = ["AD", "DC", "NS"].includes(role);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [visibleRange, setVisibleRange] = useState({ start: "", end: "" });
  const [initialDate, setInitialDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);

  const loadRange = useCallback(async (range = {}) => {
    const query = new URLSearchParams({ page_size: 100 });
    if (range.start) query.set("start", range.start);
    if (range.end) query.set("end", range.end);
    const appointmentData = await apiFetch(`${APPOINTMENTS}?${query.toString()}`);
    const results = Array.isArray(appointmentData) ? appointmentData : appointmentData.results || [];
    setAppointments(results);
    return results;
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const [results, patientData, doctorData] = await Promise.all([
          loadRange({ start: "", end: "" }),
          canCreate ? apiFetch(`${PATIENTS}?page_size=100`) : Promise.resolve({ results: [] }),
          canSchedule ? clinicalApi.listAvailableDoctors() : Promise.resolve([]),
        ]);
        if (!active) return;
        setPatients(patientData.results || []);
        setDoctors(doctorData);
        const dates = results.map((appointment) => new Date(appointment.scheduled_for)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a - b);
        const now = new Date();
        const focus = dates.find((date) => date >= now) || dates[dates.length - 1] || now;
        setInitialDate(focus.toISOString().slice(0, 10));
      } catch (requestError) {
        if (active) setError(apiError(requestError, "Appointments could not be loaded.").message);
      } finally {
        if (active) setLoading(false);
      }
    };
    initialize();
    return () => { active = false; };
  }, [canCreate, canSchedule, loadRange]);

  useEffect(() => {
    if (!visibleRange.start || !visibleRange.end) return;
    loadRange(visibleRange).catch((requestError) => setError(apiError(requestError, "This calendar range could not be loaded.").message));
  }, [loadRange, visibleRange]);

  const events = useMemo(() => appointments.map((appointment) => ({
    id: String(appointment.id),
    title: `${appointment.patient_name || appointment.patient_matric_number || "Patient"} · ${appointment.reason}`,
    start: appointment.scheduled_for,
    backgroundColor: appointment.status === "completed" ? "#23734f" : appointment.status === "missed" ? "#b42318" : appointment.status === "cancelled" ? "#66736d" : "#176b56",
    borderColor: "transparent",
  })), [appointments]);

  const startCreate = () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    setForm({ ...emptyForm, scheduled_for: localInput(soon) });
    setError("");
  };

  const startEdit = () => {
    setForm({
      id: selected.id,
      patient: selected.patient,
      assigned_doctor: selected.assigned_doctor || "",
      scheduled_for: localInput(selected.scheduled_for),
      reason: selected.reason,
      notes: selected.notes || "",
      status: selected.status,
    });
    setSelected(null);
    setError("");
  };

  const saveAppointment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, scheduled_for: new Date(form.scheduled_for).toISOString() };
      delete payload.id;
      if (!payload.assigned_doctor) delete payload.assigned_doctor;
      if (form.id) await clinicalApi.updateAppointment(form.id, payload);
      else await clinicalApi.createAppointment(payload);
      setForm(null);
      await loadRange(visibleRange);
    } catch (requestError) {
      const parsed = apiError(requestError, "Appointment could not be saved.");
      setError(parsed.fields.assigned_doctor || parsed.fields.scheduled_for || parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    setSaving(true);
    setError("");
    try {
      const updated = await clinicalApi.updateAppointmentStatus(selected.id, status);
      setSelected(updated);
      await loadRange(visibleRange);
    } catch (requestError) {
      setError(apiError(requestError, "Appointment status could not be changed.").message);
    } finally {
      setSaving(false);
    }
  };

  const cancelAppointment = async () => {
    if (!window.confirm("Cancel this appointment?")) return;
    setSaving(true);
    try {
      await clinicalApi.cancelAppointment(selected.id);
      setSelected(null);
      await loadRange(visibleRange);
    } catch (requestError) {
      setError(apiError(requestError, "Appointment could not be cancelled.").message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !initialDate) return <div className="calendar-loading"><Spinner size="sm" /> Loading clinic appointments...</div>;

  return (
    <>
      <div className="calendar-toolbar"><span>{appointments.length ? `${appointments.length} appointments in view` : "No appointments in this period"}</span>{canCreate && <Button onClick={startCreate}><RiAddLine /> {role === "RC" ? "Request appointment" : "Create appointment"}</Button>}</div>
      {error && <div className="calendar-error" role="alert">{error}</div>}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialDate={initialDate}
        datesSet={(info) => setVisibleRange({ start: info.startStr, end: info.endStr })}
        initialView="dayGridMonth"
        height="auto"
        events={events}
        eventClick={(info) => setSelected(appointments.find((appointment) => String(appointment.id) === info.event.id))}
        headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,dayGridWeek" }}
      />

      <Modal show={Boolean(form)} onHide={() => setForm(null)} centered>
        <Modal.Header closeButton><Modal.Title>{form?.id ? "Edit appointment" : role === "RC" ? "Request appointment" : "Create appointment"}</Modal.Title></Modal.Header>
        <Modal.Body>{form && <Form onSubmit={saveAppointment}>
          {error && <div className="calendar-error" role="alert">{error}</div>}
          <Form.Group className="mb-3"><Form.Label>Patient</Form.Label><Form.Select value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} required disabled={Boolean(form.id)}><option value="">Select patient</option>{patients.map((patient) => <option value={patient.id} key={patient.id}>{patient.matric_number || patient.uuid} · {patient.first_name} {patient.last_name}</option>)}</Form.Select></Form.Group>
          {canSchedule && <Form.Group className="mb-3"><Form.Label>Assigned doctor</Form.Label><Form.Select value={form.assigned_doctor} onChange={(event) => setForm({ ...form, assigned_doctor: event.target.value })} required><option value="">Select an available doctor</option>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.name}</option>)}</Form.Select></Form.Group>}
          <Form.Group className="mb-3"><Form.Label>Date and time</Form.Label><Form.Control type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} min={form.id ? undefined : localInput(new Date())} required /></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Reason</Form.Label><Form.Control value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} maxLength={255} required /></Form.Group>
          <Form.Group className="mb-3"><Form.Label>Notes</Form.Label><Form.Control as="textarea" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Form.Group>
          <div className="calendar-form-actions"><Button type="button" variant="outline-secondary" onClick={() => setForm(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Save appointment</Button></div>
        </Form>}</Modal.Body>
      </Modal>

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} centered>
        <Modal.Header closeButton><Modal.Title>Appointment details</Modal.Title></Modal.Header>
        <Modal.Body>{selected && <div className="appointment-detail">
          <div className="appointment-detail-title"><RiCalendarCheckLine /><div><strong>{selected.patient_name || selected.patient_matric_number}</strong><span>{new Date(selected.scheduled_for).toLocaleString()}</span></div><Badge bg={selected.status === "scheduled" ? "primary" : "secondary"}>{selected.status}</Badge></div>
          <dl><div><dt>Reason</dt><dd>{selected.reason}</dd></div><div><dt>Booked by</dt><dd>{selected.booked_by_name || "Clinic staff"}</dd></div><div><dt>Attended by</dt><dd>{selected.attended_by_name || "Not assigned"}</dd></div><div><dt>Notes</dt><dd>{selected.notes || "No notes"}</dd></div></dl>
          {selected.intake && <p className="calendar-workflow-note">This appointment is controlled from its intake workflow queue.</p>}
          {canUpdateStatus && !selected.intake && <Form.Group><Form.Label>Status</Form.Label><Form.Select value={selected.status} onChange={(event) => changeStatus(event.target.value)} disabled={saving}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="missed">Missed</option><option value="cancelled">Cancelled</option></Form.Select></Form.Group>}
          {canSchedule && !selected.intake && <div className="calendar-form-actions"><Button variant="outline-primary" onClick={startEdit}><RiEdit2Line /> Edit</Button>{selected.status !== "cancelled" && <Button variant="outline-danger" onClick={cancelAppointment}><RiCloseCircleLine /> Cancel appointment</Button>}</div>}
        </div>}</Modal.Body>
      </Modal>
    </>
  );
}
