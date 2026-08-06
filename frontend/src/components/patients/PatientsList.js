import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchPatients, setCurrentPage } from "../../slices/PatientsSlice.js";
import { closeForm, openCreateForm, openEditForm } from "../../slices/patientFormSlice.js";
import { loadPatient } from "../../slices/patientForm/loadPatient.js";
import PatientForm from "./PatientForm.js";
import { RiAddLine, RiEdit2Line, RiSearchLine, RiUserHeartLine } from "react-icons/ri";
import "./Patients.css";
import PaginationComponent from "../pagination/PaginationComponent.js";

const PatientsList = () => {
  const currentPage = useSelector((state) => state.patients.currentPage);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const patients = useSelector((state) => state.patients.patients);
  const totalPages = useSelector((state) => state.patients.totalPages);
  const showForm = useSelector((state) => state.patientForm.showForm);
  const formMode = useSelector((state) => state.patientForm.formMode);
  const selectedPatientId = useSelector((state) => state.patientForm.patient?.id);
  const status = useSelector((state) => state.patients.status);
  const error = useSelector((state) => state.patients.error);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const role = useSelector((state) => state.auth.profile?.role);
  const canManagePatients = ["AD", "RC"].includes(role);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      dispatch(setCurrentPage(1));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [dispatch, search]);

  useEffect(() => {
    dispatch(fetchPatients({
      page: currentPage,
      filters: appliedSearch ? { search: appliedSearch } : {},
    }));
  }, [dispatch, currentPage, appliedSearch]);

  const selectPatient = (patient) => navigate(`/patients/${patient.id}`);

  const editPatient = async (patient) => {
    await dispatch(loadPatient(patient.id)).unwrap();
    dispatch(openEditForm());
  };

  return (
    <aside className="patient-directory">
      <header><div><span>Patient directory</span><strong>{patients.length} on this page</strong></div>{canManagePatients && <Button className="icon-command" aria-label="Register patient" title="Register patient" onClick={() => dispatch(openCreateForm())}><RiAddLine /></Button>}</header>
      <div className="patient-search"><RiSearchLine /><Form.Control value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, matric number or phone" aria-label="Search patients" /></div>
      <div className="patient-directory-results" aria-live="polite">
        {status === "loading" && <div className="directory-state">Loading patients...</div>}
        {status === "failed" && <div className="directory-state error">{error || "Patients could not be loaded."}</div>}
        {status === "succeeded" && patients.length === 0 && <div className="directory-state"><RiUserHeartLine /> No matching patients</div>}
        {patients.map((patient) => (
          <div key={patient.id} className={`patient-directory-row ${patient.id === selectedPatientId ? "selected" : ""}`}>
            <button type="button" onClick={() => selectPatient(patient)}><strong>{patient.first_name} {patient.middle_name} {patient.last_name}</strong><span>{patient.matric_number || patient.uuid}</span><small>{new Date(patient.date_of_birth).toLocaleDateString()} · {patient.gender}</small></button>
            {canManagePatients && <Button variant="link" className="icon-command" aria-label={`Edit ${patient.first_name} ${patient.last_name}`} title="Edit patient" onClick={() => editPatient(patient)}><RiEdit2Line /></Button>}
          </div>
        ))}
      </div>
      <div className="patient-directory-pagination"><PaginationComponent currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} /></div>
      <Modal show={showForm} onHide={() => dispatch(closeForm())} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>{formMode === "edit" ? "Edit patient profile" : "Register patient"}</Modal.Title></Modal.Header>
        <Modal.Body><PatientForm /></Modal.Body>
      </Modal>
    </aside>
  );
};

export default PatientsList;
