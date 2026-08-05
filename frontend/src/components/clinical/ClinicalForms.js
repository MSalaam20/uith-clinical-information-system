import React, { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { RiAddLine, RiCloseLine, RiSearchLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";

const localDateTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const FormError = ({ error }) => (
  error ? <div className="clinical-form-error" role="alert">{error}</div> : null
);

export function VitalSignForm({ visit, onSaved, onCancel }) {
  const [form, setForm] = useState({ visit: visit.id, measured_at: localDateTime() });
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);

  const bmi = useMemo(() => {
    const height = Number(form.height_cm) / 100;
    const weight = Number(form.weight_kg);
    return height > 0 && weight > 0 ? (weight / (height * height)).toFixed(1) : "";
  }, [form.height_cm, form.weight_kg]);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setFields({});
    if (form.systolic_bp && form.diastolic_bp && Number(form.systolic_bp) <= Number(form.diastolic_bp)) {
      setFields({ systolic_bp: "Systolic pressure must exceed diastolic pressure." });
      return;
    }
    setSaving(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== "")
      );
      await clinicalApi.createVitalSign(payload);
      onSaved();
    } catch (requestError) {
      const parsed = apiError(requestError, "Vital signs could not be saved.");
      setError(parsed.message);
      setFields(parsed.fields);
    } finally {
      setSaving(false);
    }
  };

  const numericFields = [
    ["temperature_c", "Temperature (C)", 25, 45, "0.1"],
    ["systolic_bp", "Systolic BP", 50, 260, "1"],
    ["diastolic_bp", "Diastolic BP", 30, 160, "1"],
    ["pulse_bpm", "Pulse (bpm)", 20, 260, "1"],
    ["respiratory_rate", "Respiratory rate", 5, 80, "1"],
    ["oxygen_saturation", "Oxygen saturation (%)", 50, 100, "1"],
    ["weight_kg", "Weight (kg)", 1, 500, "0.01"],
    ["height_cm", "Height (cm)", 20, 260, "0.1"],
  ];

  return (
    <Form onSubmit={submit} className="clinical-entry-form" aria-label="Record vital signs">
      <FormError error={error} />
      <div className="clinical-form-grid">
        <Form.Group controlId="vital-measured-at">
          <Form.Label>Measured date and time</Form.Label>
          <Form.Control type="datetime-local" name="measured_at" value={form.measured_at} onChange={change} required />
          <Form.Control.Feedback type="invalid">{fields.measured_at}</Form.Control.Feedback>
        </Form.Group>
        {numericFields.map(([name, label, min, max, step]) => (
          <Form.Group key={name} controlId={`vital-${name}`}>
            <Form.Label>{label}</Form.Label>
            <Form.Control
              type="number"
              name={name}
              value={form[name] || ""}
              onChange={change}
              min={min}
              max={max}
              step={step}
              isInvalid={Boolean(fields[name])}
            />
            <Form.Control.Feedback type="invalid">{fields[name]}</Form.Control.Feedback>
          </Form.Group>
        ))}
        <div className="calculated-value"><span>Calculated BMI</span><strong>{bmi || "Not available"}</strong></div>
      </div>
      <FormActions saving={saving} onCancel={onCancel} label="Save vital signs" />
    </Form>
  );
}

export function ClinicalNoteForm({ visit, note: existingNote, onSaved, onCancel }) {
  const [form, setForm] = useState({
    visit: visit.id,
    note_type: existingNote?.note_type || "progress",
    note: existingNote?.note || "",
    patient_visible: existingNote?.patient_visible || false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (existingNote) await clinicalApi.updateClinicalNote(existingNote.id, form);
      else await clinicalApi.createClinicalNote(form);
      onSaved();
    } catch (requestError) {
      setError(apiError(requestError, "The clinical note could not be saved.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit} className="clinical-entry-form" aria-label={existingNote ? "Edit clinical note" : "Add clinical note"}>
      <FormError error={error} />
      <Form.Group className="mb-3" controlId="clinical-note-type">
        <Form.Label>Note type</Form.Label>
        <Form.Select value={form.note_type} onChange={(event) => setForm({ ...form, note_type: event.target.value })}>
          <option value="doctor">Doctor note</option>
          <option value="nursing">Nursing note</option>
          <option value="progress">Progress note</option>
          <option value="observation">Observation</option>
          <option value="discharge">Discharge summary</option>
        </Form.Select>
      </Form.Group>
      <Form.Group className="mb-3" controlId="clinical-note-text">
        <Form.Label>Clinical note</Form.Label>
        <Form.Control as="textarea" rows={5} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} maxLength={5000} required />
      </Form.Group>
      <Form.Check
        type="switch"
        id="patient-visible-note"
        label="Visible in the student patient portal"
        checked={form.patient_visible}
        onChange={(event) => setForm({ ...form, patient_visible: event.target.checked })}
      />
      <FormActions saving={saving} onCancel={onCancel} label={existingNote ? "Update note" : "Save note"} />
    </Form>
  );
}

export function DiagnosisForm({ visit, diagnosis: existingDiagnosis, onSaved, onCancel }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(existingDiagnosis?.icd || null);
  const [form, setForm] = useState({
    diagnosis_type: existingDiagnosis?.diagnosis_type || "confirmed",
    description: existingDiagnosis?.description || "",
  });
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const response = await clinicalApi.listIcdCodes(query.trim());
        if (active) setResults(response.items);
      } catch (requestError) {
        if (active) setError(apiError(requestError, "ICD-11 search failed.").message);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const choose = (code) => {
    setSelected(code);
    setForm({ ...form, description: form.description || code.title });
    setResults([]);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) {
      setError("Select an ICD-11 code before saving the diagnosis.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        visit: visit.id,
        icd_code: selected.id,
        diagnosis_type: form.diagnosis_type,
        description: form.description,
      };
      if (existingDiagnosis) await clinicalApi.updateDiagnosis(existingDiagnosis.id, payload);
      else await clinicalApi.createDiagnosis(payload);
      onSaved();
    } catch (requestError) {
      setError(apiError(requestError, "The diagnosis could not be saved.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit} className="clinical-entry-form" aria-label={existingDiagnosis ? "Edit diagnosis" : "Add diagnosis"}>
      <FormError error={error} />
      <div className="icd-search-box">
        <Form.Label htmlFor="diagnosis-code-search">ICD-11 code or diagnosis</Form.Label>
        <div className="input-with-icon"><RiSearchLine /><Form.Control id="diagnosis-code-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the curated ICD-11 subset" /></div>
        {searching && <div className="search-status"><Spinner size="sm" /> Searching...</div>}
        {!searching && query && results.length === 0 && !selected && <div className="search-status">No matching ICD-11 term.</div>}
        {results.length > 0 && (
          <div className="terminology-results" role="listbox">
            {results.map((code) => (
              <button type="button" key={code.id} onClick={() => choose(code)}>
                <strong>{code.code}</strong><span>{code.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && <div className="selected-terminology"><strong>{selected.code}</strong><span>{selected.title}</span><button type="button" aria-label="Clear ICD-11 selection" onClick={() => setSelected(null)}><RiCloseLine /></button></div>}
      <Form.Group className="mb-3" controlId="diagnosis-type">
        <Form.Label>Diagnosis type</Form.Label>
        <Form.Select value={form.diagnosis_type} onChange={(event) => setForm({ ...form, diagnosis_type: event.target.value })}>
          <option value="confirmed">Confirmed</option>
          <option value="provisional">Provisional</option>
          <option value="differential">Differential</option>
        </Form.Select>
      </Form.Group>
      <Form.Group controlId="diagnosis-description">
        <Form.Label>Description</Form.Label>
        <Form.Control as="textarea" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={500} required />
      </Form.Group>
      <FormActions saving={saving} onCancel={onCancel} label={existingDiagnosis ? "Update diagnosis" : "Save diagnosis"} />
    </Form>
  );
}

function FormActions({ saving, onCancel, label }) {
  return (
    <div className="clinical-form-actions">
      <Button type="button" variant="outline-secondary" onClick={onCancel}><RiCloseLine /> Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : <RiAddLine />} {label}</Button>
    </div>
  );
}
