import React, { lazy, Suspense, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Button from "react-bootstrap/Button";
import { ToastContainer } from "react-toastify";
import { RiErrorWarningLine, RiHome4Line, RiShieldKeyholeLine } from "react-icons/ri";
import Header from "./components/header/Header";
import ProtectedRoute from "./components/routers/ProtectedRoute";
import AppShell from "./components/ui/AppShell";
import StatePanel from "./components/ui/StatePanel";
import { ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage } from "./components/account/PasswordPages";
import { AUTH_EXPIRED_EVENT } from "./api/authSession";
import { authSessionExpired } from "./slices/AuthSlice";
import { rolesForRoute } from "./config/roleCapabilities";
import "./styles/operational.css";

const LandingPage = lazy(() => import("./components/landing/LandingPage"));
const Dashboard = lazy(() => import("./components/dashboard/Dashboard"));
const PatientMainPage = lazy(() => import("./components/patients/PatientMainPage"));
const TodaySchedule = lazy(() => import("./components/appointmens/TodaySchedule"));
const ICD = lazy(() => import("./components/icd/ICD"));
const Setup = lazy(() => import("./components/setup/Setup"));
const StaffManagement = lazy(() => import("./components/admin/StaffManagement"));
const AuditLogViewer = lazy(() => import("./components/admin/AuditLogViewer"));
const ReceptionIntake = lazy(() => import("./components/workflow/ReceptionIntake"));
const ReceptionIntakes = lazy(() => import("./components/workflow/ReceptionIntakes"));
const NurseQueue = lazy(() => import("./components/workflow/NurseQueue"));
const DoctorQueue = lazy(() => import("./components/workflow/DoctorQueue"));
const CareJourney = lazy(() => import("./components/workflow/CareJourney"));
const ClinicOverview = lazy(() => import("./components/workflow/ClinicOverview"));

const App = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const profile = useSelector((state) => state.auth.profile);

  useEffect(() => {
    const handleExpiredSession = () => dispatch(authSessionExpired());
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, [dispatch]);

  const protectedPage = (page, allowedRoles = null, shell = true) => (
    <ProtectedRoute
      isAuthenticated={isAuthenticated}
      role={profile?.role}
      allowedRoles={allowedRoles}
      mustChangePassword={profile?.must_change_password}
    >
      {shell ? <AppShell>{page}</AppShell> : page}
    </ProtectedRoute>
  );

  return (
    <BrowserRouter>
      <div className="app-shell">
        <ToastContainer position="top-right" theme="light" />
        <Header />
        <Suspense fallback={<main className="standalone-state"><StatePanel title="Loading workspace" message="Preparing the clinic interface." /></main>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LandingPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:uid/:token" element={<ResetPasswordPage />} />
            <Route path="/change-temporary-password" element={protectedPage(<ChangePasswordPage temporary />, null, false)} />
            <Route path="/change-password" element={protectedPage(<ChangePasswordPage />)} />
            <Route path="/dashboard" element={protectedPage(<Dashboard />, rolesForRoute("/dashboard"))} />
            <Route path="/clinic-overview" element={protectedPage(<ClinicOverview />, rolesForRoute("/clinic-overview"))} />
            <Route path="/intakes" element={protectedPage(<ClinicOverview />, rolesForRoute("/intakes"))} />
            <Route path="/doctor-queue" element={protectedPage(<DoctorQueue />, rolesForRoute("/doctor-queue"))} />
            <Route path="/nurse-queue" element={protectedPage(<NurseQueue />, rolesForRoute("/nurse-queue"))} />
            <Route path="/reception/intake" element={protectedPage(<ReceptionIntake />, rolesForRoute("/reception/intake"))} />
            <Route path="/reception/intakes" element={protectedPage(<ReceptionIntakes />, rolesForRoute("/reception/intakes"))} />
            <Route path="/my-care" element={protectedPage(<CareJourney />, rolesForRoute("/my-care"))} />
            <Route path="/patients" element={protectedPage(<PatientMainPage />, rolesForRoute("/patients"))} />
            <Route path="/patients/:patientId" element={protectedPage(<PatientMainPage />, rolesForRoute("/patients"))} />
            <Route path="/my-health-record" element={protectedPage(<PatientMainPage />, rolesForRoute("/my-health-record"))} />
            <Route path="/icd" element={protectedPage(<ICD />, rolesForRoute("/icd"))} />
            <Route path="/icd-11" element={protectedPage(<ICD />, rolesForRoute("/icd-11"))} />
            <Route path="/today-schedule" element={protectedPage(<TodaySchedule />, rolesForRoute("/today-schedule"))} />
            <Route path="/appointments" element={protectedPage(<TodaySchedule />, rolesForRoute("/appointments"))} />
            <Route path="/my-appointments" element={protectedPage(<TodaySchedule />, rolesForRoute("/my-appointments"))} />
            <Route path="/setup" element={protectedPage(<Setup />, rolesForRoute("/setup"))} />
            <Route path="/staff" element={protectedPage(<StaffManagement />, rolesForRoute("/staff"))} />
            <Route path="/audit-logs" element={protectedPage(<AuditLogViewer />, rolesForRoute("/audit-logs"))} />
            <Route path="/account" element={protectedPage(<ChangePasswordPage />, rolesForRoute("/account"))} />
            <Route path="/unauthorized" element={protectedPage(<StatePanel icon={<RiShieldKeyholeLine />} title="Access not available" message="Your clinic role does not include this workspace."><Button as={Link} to="/dashboard"><RiHome4Line /> Return to dashboard</Button></StatePanel>)} />
            <Route path="*" element={<main className="standalone-state"><StatePanel icon={<RiErrorWarningLine />} title="Page not found" message="The address does not match an available clinic page."><Button as={Link} to={isAuthenticated ? "/dashboard" : "/"}><RiHome4Line /> Go home</Button></StatePanel></main>} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
};

export default App;
