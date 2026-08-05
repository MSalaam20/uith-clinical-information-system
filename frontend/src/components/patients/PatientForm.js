import React, { useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Form from "react-bootstrap/Form";
import Row from "react-bootstrap/Row";
import Spinner from "react-bootstrap/Spinner";
import { RiArchiveLine, RiSaveLine } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { createPatient } from "../../slices/patientForm/createPatient";
import { archivePatient } from "../../slices/patientForm/deletePatient";
import { updatePatient } from "../../slices/patientForm/updatePatient";
import { closeForm } from "../../slices/patientFormSlice";
import { fetchPatients } from "../../slices/PatientsSlice";
import "./PatientForm.css";

const blankPatient = {
  matric_number: "",
  department: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "F",
  address: "",
  phone_number: "",
  email: "",
  next_of_kin: "",
  emergency_contact: "",
};

export default function PatientForm() {
  const dispatch = useDispatch();
  const fileInput = useRef(null);
  const loadedPatient = useSelector((state) => state.patientForm.patient);
  const formMode = useSelector((state) => state.patientForm.formMode);
  const status = useSelector((state) => state.patientForm.status);
  const currentPage = useSelector((state) => state.patients.currentPage);
  const role = useSelector((state) => state.auth.profile?.role);
  const [form, setForm] = useState(blankPatient);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const canArchive = role === "AD";
  const editing = formMode === "edit" && Boolean(loadedPatient?.id);

  useEffect(() => {
    setForm(editing ? { ...blankPatient, ...loadedPatient } : blankPatient);
    setPreview(editing ? loadedPatient.photo || "" : "");
    setError("");
  }, [editing, loadedPatient]);

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const changePhoto = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editing) {
        await dispatch(updatePatient({ ...form, fileInput, fieldName: "photo" })).unwrap();
      } else {
        const patient = { ...form };
        if (fileInput.current?.files[0]) patient.photo = fileInput.current.files[0];
        await dispatch(createPatient(patient)).unwrap();
      }
      await dispatch(fetchPatients({ page: editing ? currentPage : 1, filters: {} }));
      dispatch(closeForm());
    } catch (requestError) {
      setError(typeof requestError === "string" ? requestError : "The patient profile could not be saved.");
    }
  };

  const archive = async () => {
    if (!editing || !canArchive) return;
    const reason = window.prompt("Enter the reason for archiving this patient:");
    if (!reason?.trim() || !window.confirm("Archive this patient profile?")) return;
    setError("");
    try {
      await dispatch(archivePatient({ patientId: loadedPatient.id, reason: reason.trim() })).unwrap();
      await dispatch(fetchPatients({ page: currentPage, filters: {} }));
      dispatch(closeForm());
    } catch (requestError) {
      setError(typeof requestError === "string" ? requestError : "The patient could not be archived.");
    }
  };

  const field = (name, label, options = {}) => (
    <Form.Group as={Col} md={options.wide ? 12 : 6} className="mb-3" controlId={`patient-${name}`}>
      <Form.Label>{label}</Form.Label>
      <Form.Control
        type={options.type || "text"}
        name={name}
        value={form[name] || ""}
        onChange={change}
        required={options.required}
        max={options.max}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
      />
    </Form.Group>
  );

  return (
    <Form onSubmit={submit} className="patient-form-shell">
      {error && <div className="patient-form-error" role="alert">{error}</div>}
      <Row>
        <Form.Group as={Col} md={12} className="mb-3">
          <Form.Label>Patient photograph</Form.Label>
          <div className="patient-photo-input">
            {preview && <img src={preview} alt="Patient preview" />}
            <Form.Control type="file" name="photo" accept="image/jpeg,image/png,image/webp" ref={fileInput} onChange={changePhoto} />
          </div>
        </Form.Group>
        {field("matric_number", "Student or hospital number", { maxLength: 20 })}
        {field("department", "Department", { maxLength: 150 })}
        {field("first_name", "First name", { required: true, maxLength: 100 })}
        {field("middle_name", "Middle name", { maxLength: 100 })}
        {field("last_name", "Last name", { required: true, maxLength: 100 })}
        <Form.Group as={Col} md={6} className="mb-3" controlId="patient-gender">
          <Form.Label>Gender</Form.Label>
          <Form.Select name="gender" value={form.gender} onChange={change}>
            <option value="F">Female</option><option value="M">Male</option><option value="O">Other</option>
          </Form.Select>
        </Form.Group>
        {field("date_of_birth", "Date of birth", { type: "date", required: true, max: new Date().toISOString().slice(0, 10) })}
        {field("phone_number", "Phone number", { type: "tel", maxLength: 11, placeholder: "08012345678" })}
        {field("email", "Email", { type: "email" })}
        {field("next_of_kin", "Next of kin", { maxLength: 200 })}
        {field("emergency_contact", "Emergency contact", { type: "tel", maxLength: 11, placeholder: "08012345678" })}
        {field("address", "Address", { wide: true, maxLength: 200 })}
      </Row>
      <div className="patient-form-actions">
        {canArchive && editing && <Button type="button" variant="outline-warning" onClick={archive} disabled={status === "loading"}><RiArchiveLine /> Archive</Button>}
        <Button type="submit" disabled={status === "loading"}>{status === "loading" ? <Spinner size="sm" /> : <RiSaveLine />} {editing ? "Save changes" : "Register patient"}</Button>
      </div>
    </Form>
  );
}
