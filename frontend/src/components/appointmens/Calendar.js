import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { useSelector } from "react-redux";
import { APPOINTMENTS, PATIENTS } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import "./Calendar.css";

const emptyForm = { patient: "", scheduled_for: "", reason: "", notes: "" };

export default function Calendar() {
  const role = useSelector((state) => state.auth.profile?.role);
  const canManage = ["AD", "NS", "RC"].includes(role);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [visibleRange, setVisibleRange] = useState({ start: "", end: "" });
  const [initialDate, setInitialDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let mounted = true;
    const initialize = async () => {
      try {
        const [appointmentData, patientData] = await Promise.all([
          apiFetch(`${APPOINTMENTS}?page_size=100`),
          canManage ? apiFetch(`${PATIENTS}?page_size=100`) : Promise.resolve({ results: [] }),
        ]);
        if (!mounted) return;
        const results = Array.isArray(appointmentData)
          ? appointmentData
          : appointmentData.results || [];
        setAppointments(results);
        setPatients(patientData.results || []);

        const dated = results
          .map((appointment) => new Date(appointment.scheduled_for))
          .filter((date) => !Number.isNaN(date.getTime()))
          .sort((left, right) => left - right);
        const now = new Date();
        const focusDate = dated.find((date) => date >= now) || dated[dated.length - 1] || now;
        setInitialDate(focusDate.toISOString().slice(0, 10));
      } catch {
        if (mounted) setError("Appointments could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    initialize();
    return () => {
      mounted = false;
    };
  }, [canManage]);

  useEffect(() => {
    if (!visibleRange.start || !visibleRange.end) return;
    let mounted = true;
    const query = new URLSearchParams(visibleRange);
    apiFetch(`${APPOINTMENTS}?page_size=100&${query.toString()}`)
      .then((data) => {
        if (mounted) setAppointments(Array.isArray(data) ? data : data.results || []);
      })
      .catch(() => mounted && setError("This calendar range could not be loaded."));
    return () => {
      mounted = false;
    };
  }, [visibleRange]);

  const events = useMemo(
    () => appointments.map((appointment) => ({
      id: appointment.id,
      title: `${appointment.patient_matric_number || "Patient"} - ${appointment.reason}`,
      start: appointment.scheduled_for,
      backgroundColor:
        appointment.status === "completed" ? "#2f855a"
          : appointment.status === "missed" ? "#c53030"
            : appointment.status === "cancelled" ? "#718096" : "#0e7490",
      borderColor: "transparent",
    })),
    [appointments]
  );

  const createAppointment = async (event) => {
    event.preventDefault();
    try {
      const created = await apiFetch(APPOINTMENTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setAppointments((current) => [...current, created]);
      setForm(emptyForm);
      setShowForm(false);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.scheduled_for?.[0] || "Appointment could not be created.");
    }
  };

  if (loading || !initialDate) return <p className="calendar-loading">Loading clinic appointments...</p>;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span>{appointments.length === 0 ? "No appointments in this period." : ""}</span>
        {canManage && <Button onClick={() => setShowForm(true)}>Create appointment</Button>}
      </div>
      {error && <p className="text-danger" role="alert">{error}</p>}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialDate={initialDate}
        datesSet={(dateInfo) => setVisibleRange({ start: dateInfo.startStr, end: dateInfo.endStr })}
        initialView="dayGridMonth"
        height="auto"
        events={events}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,dayGridWeek",
        }}
      />

      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Modal.Header closeButton><Modal.Title>Create appointment</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={createAppointment}>
            <Form.Group className="mb-3">
              <Form.Label>Patient</Form.Label>
              <Form.Select
                value={form.patient}
                onChange={(event) => setForm({ ...form, patient: event.target.value })}
                required
              >
                <option value="">Select patient</option>
                {patients.map((patient) => (
                  <option value={patient.id} key={patient.id}>
                    {patient.matric_number || patient.uuid} - {patient.first_name} {patient.last_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Date and time</Form.Label>
              <Form.Control
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Reason</Form.Label>
              <Form.Control
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                maxLength={255}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Notes</Form.Label>
              <Form.Control
                as="textarea"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Form.Group>
            <Button type="submit">Save appointment</Button>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}
