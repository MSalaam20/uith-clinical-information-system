import React, { useEffect, useMemo, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import {
  RiAddLine,
  RiCheckLine,
  RiEdit2Line,
  RiFileTextLine,
  RiHeartPulseLine,
  RiMedicineBottleLine,
  RiStethoscopeLine,
} from "react-icons/ri";
import { useSelector } from "react-redux";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { ClinicalNoteForm, DiagnosisForm, VitalSignForm } from "./ClinicalForms";
import PrescriptionForm from "./PrescriptionForm";

const toLocalInput = (value = new Date()) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const statusVariant = (status) => ({
  open: "success",
  completed: "primary",
  cancelled: "secondary",
}[status] || "secondary");

export default function VisitWorkspace({ patient, data, role, refresh }) {
  const profile = useSelector((state) => state.auth.profile);
  const canManageVisit = ["AD", "DC"].includes(role);
  const canRecordVitals = ["AD", "DC", "NS"].includes(role);
  const canWriteNotes = ["AD", "DC", "NS"].includes(role);
  const canDiagnose = ["AD", "DC"].includes(role);
  const canPrescribe = ["AD", "DC"].includes(role);
  const visits = data.visits.items;
  const [selectedId, setSelectedId] = useState(null);
  const [visitForm, setVisitForm] = useState(null);
  const [entryForm, setEntryForm] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [editingDiagnosis, setEditingDiagnosis] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!visits.length) {
      setSelectedId(null);
      return;
    }
    if (!visits.some((visit) => visit.id === selectedId)) setSelectedId(visits[0].id);
  }, [visits, selectedId]);

  const selected = useMemo(
    () => visits.find((visit) => visit.id === selectedId) || null,
    [visits, selectedId]
  );

  const startCreate = () => {
    setVisitForm({
      patient: patient.id,
      visit_date: toLocalInput(),
      visit_type: "outpatient",
      appointment: "",
      chief_complaint: "",
      clinical_summary: "",
      status: "open",
    });
    setError("");
    setFields({});
  };

  const startEdit = () => {
    setVisitForm({
      id: selected.id,
      patient: patient.id,
      visit_date: toLocalInput(selected.visit_date),
      visit_type: selected.visit_type,
      appointment: selected.appointment || "",
      chief_complaint: selected.chief_complaint,
      clinical_summary: selected.clinical_summary,
      status: selected.status,
    });
    setError("");
    setFields({});
  };

  const saveVisit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setFields({});
    const payload = {
      ...visitForm,
      appointment: visitForm.appointment || null,
      visit_date: new Date(visitForm.visit_date).toISOString(),
    };
    delete payload.id;
    try {
      const saved = visitForm.id
        ? await clinicalApi.updateVisit(visitForm.id, payload)
        : await clinicalApi.createVisit(payload);
      setVisitForm(null);
      await refresh();
      setSelectedId(saved.id);
    } catch (requestError) {
      const parsed = apiError(requestError, "The visit could not be saved.");
      setError(parsed.message);
      setFields(parsed.fields);
    } finally {
      setSaving(false);
    }
  };

  const completeVisit = async () => {
    setSaving(true);
    setError("");
    try {
      await clinicalApi.updateVisit(selected.id, { status: "completed" });
      await refresh();
    } catch (requestError) {
      setError(apiError(requestError, "The visit could not be completed.").message);
    } finally {
      setSaving(false);
    }
  };

  const savedEntry = async () => {
    setEntryForm(null);
    setEditingNote(null);
    setEditingDiagnosis(null);
    await refresh();
  };

  const openEntry = (type, entry = null) => {
    setEditingNote(type === "note" ? entry : null);
    setEditingDiagnosis(type === "diagnosis" ? entry : null);
    setEntryForm(type);
  };

  return (
    <div className="visit-workspace">
      <aside className="visit-list" aria-label="Patient visits">
        <div className="section-toolbar">
          <div><span className="section-label">Encounters</span><strong>{visits.length} visits</strong></div>
          {canManageVisit && <Button size="sm" onClick={startCreate}><RiAddLine /> New visit</Button>}
        </div>
        {visits.length === 0 ? (
          <div className="clinical-empty-state"><RiFileTextLine /><strong>No visits recorded</strong><span>Create the first clinic encounter for this patient.</span></div>
        ) : visits.map((visit) => (
          <button type="button" key={visit.id} className={`visit-list-item ${visit.id === selectedId ? "active" : ""}`} onClick={() => setSelectedId(visit.id)}>
            <span>{new Date(visit.visit_date).toLocaleDateString()}</span>
            <strong>{visit.chief_complaint}</strong>
            <small>{visit.visit_type} | {visit.status}</small>
          </button>
        ))}
      </aside>

      <section className="visit-detail" aria-live="polite">
        {!selected ? (
          <div className="clinical-empty-state"><RiFileTextLine /><strong>Select a visit</strong><span>Visit details and clinical actions will appear here.</span></div>
        ) : (
          <>
            <header className="visit-detail-header">
              <div>
                <div className="visit-title-line"><h2>{selected.chief_complaint}</h2><Badge bg={statusVariant(selected.status)}>{selected.status}</Badge></div>
                <p>{new Date(selected.visit_date).toLocaleString()} | {selected.visit_type} | {selected.created_by_name || "Clinic staff"}</p>
              </div>
              {canManageVisit && selected.status === "open" && (
                <div className="visit-header-actions">
                  <Button variant="outline-primary" size="sm" onClick={startEdit}><RiEdit2Line /> Edit</Button>
                  <Button size="sm" onClick={completeVisit} disabled={saving}><RiCheckLine /> Complete visit</Button>
                </div>
              )}
            </header>
            {error && <div className="clinical-form-error" role="alert">{error}</div>}
            <div className="visit-summary"><span>Clinical summary</span><p>{selected.clinical_summary || "No clinical summary has been recorded."}</p></div>

            {selected.status === "open" && (
              <div className="clinical-action-bar" aria-label="Visit actions">
                {canRecordVitals && <Button variant="outline-primary" onClick={() => openEntry("vitals")}><RiHeartPulseLine /> Record vitals</Button>}
                {canWriteNotes && <Button variant="outline-primary" onClick={() => openEntry("note")}><RiFileTextLine /> Add note</Button>}
                {canDiagnose && <Button variant="outline-primary" onClick={() => openEntry("diagnosis")}><RiStethoscopeLine /> Add diagnosis</Button>}
                {canPrescribe && <Button variant="outline-primary" onClick={() => openEntry("prescription")}><RiMedicineBottleLine /> Prescribe</Button>}
              </div>
            )}

            <VisitClinicalSummary
              visit={selected}
              profile={profile}
              canWriteNotes={canWriteNotes}
              canDiagnose={canDiagnose}
              onEditNote={(note) => openEntry("note", note)}
              onEditDiagnosis={(diagnosis) => openEntry("diagnosis", diagnosis)}
            />
          </>
        )}
      </section>

      <Modal show={Boolean(visitForm)} onHide={() => setVisitForm(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{visitForm?.id ? "Edit clinic visit" : "Create clinic visit"}</Modal.Title></Modal.Header>
        <Modal.Body>
          {visitForm && (
            <Form onSubmit={saveVisit} className="clinical-entry-form">
              {error && <div className="clinical-form-error" role="alert">{error}</div>}
              <div className="clinical-form-grid">
                <Form.Group controlId="visit-date"><Form.Label>Visit date and time</Form.Label><Form.Control type="datetime-local" value={visitForm.visit_date} onChange={(event) => setVisitForm({ ...visitForm, visit_date: event.target.value })} isInvalid={Boolean(fields.visit_date)} required /><Form.Control.Feedback type="invalid">{fields.visit_date}</Form.Control.Feedback></Form.Group>
                <Form.Group controlId="visit-type"><Form.Label>Visit type</Form.Label><Form.Select value={visitForm.visit_type} onChange={(event) => setVisitForm({ ...visitForm, visit_type: event.target.value })}><option value="outpatient">Outpatient</option><option value="follow-up">Follow-up</option><option value="emergency">Emergency</option><option value="screening">Screening</option></Form.Select></Form.Group>
                <Form.Group className="clinical-grid-wide" controlId="visit-appointment"><Form.Label>Related appointment</Form.Label><Form.Select value={visitForm.appointment} onChange={(event) => setVisitForm({ ...visitForm, appointment: event.target.value })}><option value="">No linked appointment</option>{data.appointments.items.map((appointment) => <option key={appointment.id} value={appointment.id}>{new Date(appointment.scheduled_for).toLocaleString()} | {appointment.reason}</option>)}</Form.Select></Form.Group>
                <Form.Group className="clinical-grid-wide" controlId="visit-chief-complaint"><Form.Label>Chief complaint</Form.Label><Form.Control value={visitForm.chief_complaint} onChange={(event) => setVisitForm({ ...visitForm, chief_complaint: event.target.value })} isInvalid={Boolean(fields.chief_complaint)} maxLength={500} required /><Form.Control.Feedback type="invalid">{fields.chief_complaint}</Form.Control.Feedback></Form.Group>
                <Form.Group className="clinical-grid-wide" controlId="visit-summary"><Form.Label>Initial clinical summary</Form.Label><Form.Control as="textarea" rows={4} value={visitForm.clinical_summary} onChange={(event) => setVisitForm({ ...visitForm, clinical_summary: event.target.value })} /></Form.Group>
              </div>
              <div className="clinical-form-actions"><Button type="button" variant="outline-secondary" onClick={() => setVisitForm(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Save visit</Button></div>
            </Form>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={Boolean(entryForm)} onHide={() => setEntryForm(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{entryForm === "vitals" ? "Record vital signs" : entryForm === "note" ? editingNote ? "Edit clinical note" : "Add clinical note" : entryForm === "diagnosis" ? editingDiagnosis ? "Correct diagnosis" : "Add diagnosis" : "Create prescription"}</Modal.Title></Modal.Header>
        <Modal.Body>
          {selected && entryForm === "vitals" && <VitalSignForm visit={selected} onSaved={savedEntry} onCancel={() => setEntryForm(null)} />}
          {selected && entryForm === "note" && <ClinicalNoteForm visit={selected} note={editingNote} onSaved={savedEntry} onCancel={() => setEntryForm(null)} />}
          {selected && entryForm === "diagnosis" && <DiagnosisForm visit={selected} diagnosis={editingDiagnosis} onSaved={savedEntry} onCancel={() => setEntryForm(null)} />}
          {selected && entryForm === "prescription" && <PrescriptionForm patient={patient} visit={selected} onSaved={savedEntry} onCancel={() => setEntryForm(null)} />}
        </Modal.Body>
      </Modal>
    </div>
  );
}

function VisitClinicalSummary({ visit, profile, canWriteNotes, canDiagnose, onEditNote, onEditDiagnosis }) {
  return (
    <div className="visit-clinical-sections">
      <section><h3>Vital signs</h3>{visit.vital_signs.length ? <Table responsive size="sm" className="clinical-table"><thead><tr><th>Measured</th><th>Temp</th><th>BP</th><th>Pulse</th><th>SpO2</th><th>BMI</th></tr></thead><tbody>{visit.vital_signs.map((vital) => <tr key={vital.id}><td>{new Date(vital.measured_at).toLocaleString()}</td><td>{vital.temperature_c || "-"}</td><td>{vital.systolic_bp && vital.diastolic_bp ? `${vital.systolic_bp}/${vital.diastolic_bp}` : "-"}</td><td>{vital.pulse_bpm || "-"}</td><td>{vital.oxygen_saturation ? `${vital.oxygen_saturation}%` : "-"}</td><td>{vital.bmi || "-"}</td></tr>)}</tbody></Table> : <p className="clinical-inline-empty">No vital signs for this visit.</p>}</section>
      <section><h3>Diagnoses</h3>{visit.diagnoses.length ? <ul className="clinical-history-list">{visit.diagnoses.map((diagnosis) => <li key={diagnosis.id}><div className="clinical-entry-heading"><strong>{diagnosis.code_snapshot || "Clinical"} | {diagnosis.description}</strong>{canDiagnose && visit.status === "open" && <span className="clinical-entry-actions"><Button variant="link" className="icon-command" aria-label={`Edit diagnosis ${diagnosis.description}`} title="Correct diagnosis" onClick={() => onEditDiagnosis(diagnosis)}><RiEdit2Line /></Button></span>}</div><span>{diagnosis.diagnosis_type} | {diagnosis.diagnosed_by_name || "Clinic clinician"}</span></li>)}</ul> : <p className="clinical-inline-empty">No diagnosis recorded.</p>}</section>
      <section><h3>Clinical notes</h3>{visit.clinical_notes.length ? <ul className="clinical-history-list">{visit.clinical_notes.map((note) => <li key={note.id}><div className="clinical-entry-heading"><strong>{note.note_type}</strong>{canWriteNotes && visit.status === "open" && (profile?.role === "AD" || note.author === profile?.id) && <Button variant="link" className="icon-command" aria-label={`Edit ${note.note_type} note`} title="Edit clinical note" onClick={() => onEditNote(note)}><RiEdit2Line /></Button>}</div><p>{note.note}</p><span>{note.author_name || "Clinic clinician"} | {new Date(note.created_at).toLocaleString()}</span></li>)}</ul> : <p className="clinical-inline-empty">No clinical notes available.</p>}</section>
      <section><h3>Prescriptions</h3>{visit.prescriptions.length ? visit.prescriptions.map((prescription) => <div className="prescription-summary" key={prescription.id}><div><strong>{new Date(prescription.prescribed_at).toLocaleDateString()}</strong><span>{prescription.status} | {prescription.prescribed_by_name || "Prescriber"}</span></div><ul>{prescription.items.map((item) => <li key={item.id}>{item.medication_detail?.name || "Medication"}: {item.dose}, {item.route}, {item.frequency} for {item.duration}</li>)}</ul></div>) : <p className="clinical-inline-empty">No prescriptions for this visit.</p>}</section>
    </div>
  );
}
