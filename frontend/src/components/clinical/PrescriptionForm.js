import React, { useCallback, useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { RiAddLine, RiCloseLine, RiDeleteBinLine, RiEdit2Line, RiMedicineBottleLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";

const emptyItem = {
  medication: "",
  dose: "",
  route: "oral",
  frequency: "",
  duration: "",
  instructions: "",
};

const emptyMedication = { name: "", generic_name: "", strength: "", form: "" };

export default function PrescriptionForm({ patient, visit, onSaved, onCancel }) {
  const [medications, setMedications] = useState([]);
  const [search, setSearch] = useState("");
  const [item, setItem] = useState(emptyItem);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [newMedication, setNewMedication] = useState(emptyMedication);
  const [editingMedicationId, setEditingMedicationId] = useState(null);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [loadingMedications, setLoadingMedications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});

  const loadMedications = useCallback(async (term = "") => {
    setLoadingMedications(true);
    try {
      const response = await clinicalApi.listMedications(term);
      setMedications(response.items);
    } catch (requestError) {
      setError(apiError(requestError, "Medication catalogue could not be loaded.").message);
    } finally {
      setLoadingMedications(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => loadMedications(search.trim()),
      search.trim() ? 300 : 0
    );
    return () => window.clearTimeout(timer);
  }, [loadMedications, search]);

  const medicationById = useMemo(
    () => Object.fromEntries(medications.map((medication) => [String(medication.id), medication])),
    [medications]
  );

  const addItem = () => {
    const nextFields = {};
    ["medication", "dose", "route", "frequency", "duration"].forEach((name) => {
      if (!String(item[name] || "").trim()) nextFields[name] = "Required";
    });
    if (Object.keys(nextFields).length) {
      setFields(nextFields);
      return;
    }
    setItems([...items, { ...item, clientId: `${Date.now()}-${items.length}` }]);
    setItem(emptyItem);
    setFields({});
    setError("");
  };

  const saveMedication = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const saved = editingMedicationId
        ? await clinicalApi.updateMedication(editingMedicationId, newMedication)
        : await clinicalApi.createMedication(newMedication);
      setMedications((current) => {
        const withoutSaved = current.filter((medication) => medication.id !== saved.id);
        return [...withoutSaved, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      setItem({ ...item, medication: String(saved.id) });
      setNewMedication(emptyMedication);
      setEditingMedicationId(null);
      setShowMedicationForm(false);
    } catch (requestError) {
      const parsed = apiError(requestError, "Medication could not be created.");
      setError(parsed.fields.non_field_errors || parsed.message);
    }
  };

  const startNewMedication = () => {
    setEditingMedicationId(null);
    setNewMedication(emptyMedication);
    setShowMedicationForm(true);
  };

  const startMedicationEdit = () => {
    const selectedMedication = medicationById[String(item.medication)];
    if (!selectedMedication) {
      setError("Select a medication presentation before editing it.");
      return;
    }
    setEditingMedicationId(selectedMedication.id);
    setNewMedication({
      name: selectedMedication.name || "",
      generic_name: selectedMedication.generic_name || "",
      strength: selectedMedication.strength || "",
      form: selectedMedication.form || "",
    });
    setShowMedicationForm(true);
    setError("");
  };

  const closeMedicationForm = () => {
    setShowMedicationForm(false);
    setEditingMedicationId(null);
    setNewMedication(emptyMedication);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!items.length) {
      setError("Add at least one complete prescription item.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await clinicalApi.createPrescription({
        patient: patient.id,
        visit: visit.id,
        prescribed_at: new Date().toISOString(),
        status: "active",
        notes,
        items: items.map(({ clientId, ...prescriptionItem }) => prescriptionItem),
      });
      onSaved();
    } catch (requestError) {
      const parsed = apiError(requestError, "The prescription could not be saved.");
      setError(parsed.fields.items || parsed.message);
      setFields(parsed.fields);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form onSubmit={submit} className="clinical-entry-form prescription-form" aria-label="Create prescription">
      {error && <div className="clinical-form-error" role="alert">{error}</div>}
      <div className="prescription-context">
        <RiMedicineBottleLine />
        <div><strong>{patient.first_name} {patient.last_name}</strong><span>Visit on {new Date(visit.visit_date).toLocaleString()}</span></div>
      </div>

      <div className="medication-search-row">
        <Form.Group controlId="medication-catalogue-search">
          <Form.Label>Search medication catalogue</Form.Label>
          <Form.Control value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Brand, generic name, strength or form" />
        </Form.Group>
        <div className="medication-catalogue-actions">
          <Button type="button" variant="outline-primary" onClick={startNewMedication}><RiAddLine /> New medication</Button>
          <Button type="button" variant="outline-secondary" onClick={startMedicationEdit} disabled={!item.medication}><RiEdit2Line /> Edit selected</Button>
        </div>
      </div>

      {showMedicationForm && (
        <fieldset className="inline-medication-form">
          <legend>{editingMedicationId ? "Edit medication presentation" : "Add medication presentation"}</legend>
          <div className="clinical-form-grid">
            {[
              ["name", "Name", true],
              ["generic_name", "Generic name", false],
              ["strength", "Strength", false],
              ["form", "Dosage form", false],
            ].map(([name, label, required]) => (
              <Form.Group key={name} controlId={`new-medication-${name}`}>
                <Form.Label>{label}</Form.Label>
                <Form.Control value={newMedication[name]} onChange={(event) => setNewMedication({ ...newMedication, [name]: event.target.value })} required={required} />
              </Form.Group>
            ))}
          </div>
          <div className="clinical-form-actions">
            <Button type="button" variant="outline-secondary" onClick={closeMedicationForm}>Cancel</Button>
            <Button type="button" onClick={saveMedication}>{editingMedicationId ? "Update medication" : "Save medication"}</Button>
          </div>
        </fieldset>
      )}

      <fieldset className="prescription-item-editor">
        <legend>Prescription item</legend>
        <div className="clinical-form-grid">
          <Form.Group className="clinical-grid-wide" controlId="prescription-medication">
            <Form.Label>Medication</Form.Label>
            <Form.Select value={item.medication} onChange={(event) => setItem({ ...item, medication: event.target.value })} isInvalid={Boolean(fields.medication)} disabled={loadingMedications}>
              <option value="">{loadingMedications ? "Loading medications..." : "Select medication"}</option>
              {medications.map((medication) => (
                <option key={medication.id} value={medication.id}>
                  {[medication.name, medication.generic_name, medication.strength, medication.form].filter(Boolean).join(" - ")}
                </option>
              ))}
            </Form.Select>
            <Form.Control.Feedback type="invalid">{fields.medication}</Form.Control.Feedback>
          </Form.Group>
          {[
            ["dose", "Dose"],
            ["frequency", "Frequency"],
            ["duration", "Duration"],
          ].map(([name, label]) => (
            <Form.Group key={name} controlId={`prescription-${name}`}>
              <Form.Label>{label}</Form.Label>
              <Form.Control value={item[name]} onChange={(event) => setItem({ ...item, [name]: event.target.value })} isInvalid={Boolean(fields[name])} />
              <Form.Control.Feedback type="invalid">{fields[name]}</Form.Control.Feedback>
            </Form.Group>
          ))}
          <Form.Group controlId="prescription-route">
            <Form.Label>Route</Form.Label>
            <Form.Select value={item.route} onChange={(event) => setItem({ ...item, route: event.target.value })}>
              <option value="oral">Oral</option>
              <option value="topical">Topical</option>
              <option value="intravenous">Intravenous</option>
              <option value="intramuscular">Intramuscular</option>
              <option value="inhaled">Inhaled</option>
              <option value="other">Other</option>
            </Form.Select>
          </Form.Group>
          <Form.Group className="clinical-grid-wide" controlId="prescription-instructions">
            <Form.Label>Instructions</Form.Label>
            <Form.Control value={item.instructions} onChange={(event) => setItem({ ...item, instructions: event.target.value })} />
          </Form.Group>
        </div>
        <Button type="button" variant="outline-primary" onClick={addItem}><RiAddLine /> Add item</Button>
      </fieldset>

      {items.length > 0 && (
        <div className="clinical-table-wrap">
          <Table responsive hover className="clinical-table">
            <thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>{items.map((entry) => (
              <tr key={entry.clientId}>
                <td>{medicationById[String(entry.medication)]?.name || "Selected medication"}</td>
                <td>{entry.dose}</td><td>{entry.route}</td><td>{entry.frequency}</td><td>{entry.duration}</td>
                <td><Button type="button" variant="link" className="icon-command danger" aria-label="Remove prescription item" onClick={() => setItems(items.filter((candidate) => candidate.clientId !== entry.clientId))}><RiDeleteBinLine /></Button></td>
              </tr>
            ))}</tbody>
          </Table>
        </div>
      )}

      <Form.Group controlId="prescription-notes">
        <Form.Label>Prescription notes</Form.Label>
        <Form.Control as="textarea" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Form.Group>
      <div className="clinical-form-actions">
        <Button type="button" variant="outline-secondary" onClick={onCancel}><RiCloseLine /> Cancel</Button>
        <Button type="submit" disabled={saving || !items.length}>{saving ? <Spinner size="sm" /> : <RiMedicineBottleLine />} Save prescription</Button>
      </div>
    </Form>
  );
}
