import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import PatientWorkspace from "../clinical/PatientWorkspace";
import PatientsList from "./PatientsList.js";
import { fetchPatients } from "../../slices/PatientsSlice";
import { loadPatient } from "../../slices/patientForm/loadPatient";
import "./Patients.css";

const PatientMainPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { patientId } = useParams();
  const role = useSelector((state) => state.auth.profile?.role);
  const patients = useSelector((state) => state.patients.patients);
  const patientsStatus = useSelector((state) => state.patients.status);
  const selectedPatient = useSelector((state) => state.patientForm.patient);
  const isStudent = role === "PT";

  useEffect(() => {
    if (patientId && String(selectedPatient?.id) !== String(patientId)) {
      dispatch(loadPatient(patientId));
    }
  }, [dispatch, patientId, selectedPatient?.id]);

  useEffect(() => {
    if (isStudent && patientsStatus === "idle") {
      dispatch(fetchPatients({ page: 1, filters: {} }));
    }
  }, [dispatch, isStudent, patientsStatus]);

  useEffect(() => {
    if (isStudent && !patientId && patients.length === 1) {
      navigate(`/patients/${patients[0].id}`, { replace: true });
    }
  }, [isStudent, navigate, patientId, patients]);

  return (
    <div className={`patient-page-layout ${isStudent ? "student-view" : ""}`}>
      {!isStudent && <PatientsList />}
      <PatientWorkspace />
    </div>
  );
};

export default PatientMainPage;
