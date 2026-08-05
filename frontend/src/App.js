import React, { useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ICD from "./components/icd/ICD";
import Header from "./components/header/Header";
import LandingPage from "./components/landing/LandingPage";
import Dashboard from "./components/dashboard/Dashboard";
import PatientMainPage from "./components/patients/PatientMainPage";
import TodaySchedule from "./components/appointmens/TodaySchedule";
import Setup from "./components/setup/Setup";
import ProtectedRoute from "./components/routers/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import Container from "react-bootstrap/Container";
import { AUTH_EXPIRED_EVENT } from "./api/authSession";
import { authSessionExpired } from "./slices/AuthSlice";

const App = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    const handleExpiredSession = () => {
      dispatch(authSessionExpired());
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    };
  }, [dispatch]);

  return (
    <Container fluid className="app-shell p-0 m-0">
      <ToastContainer position="top-right" theme="light" />
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patients"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <PatientMainPage expand="lg" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/icd"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <ICD expand="lg" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/icd-11"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <ICD expand="lg" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/today-schedule"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <TodaySchedule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <Setup />
              </ProtectedRoute>
            }
          />
        </Routes>
        <footer className="app-footer">
          <strong>
            University of Ilorin Teaching Hospital (UITH) School Complex Clinic
            EHR System
          </strong>
          <span>
            Designed & Developed for Thesis Defense by Bello Abdulmumeen
            Adeboye | Powered by Django & React
          </span>
        </footer>
      </BrowserRouter>
    </Container>
  );
};

export default App;
