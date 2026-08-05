import React, { useEffect, useMemo, useState } from "react";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  RiAdminLine,
  RiCalendarCheckLine,
  RiDashboard3Line,
  RiFileList3Line,
  RiHeartPulseLine,
  RiHistoryLine,
  RiSearchLine,
  RiUserHeartLine,
} from "react-icons/ri";
import { DASHBOARD_SUMMARY } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import "./DashboardWorkspace.css";

export default function Dashboard() {
  const profile = useSelector((state) => state.auth.profile);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch(DASHBOARD_SUMMARY).then((data) => active && setSummary(data)).catch(() => active && setError("Dashboard values could not be loaded."));
    return () => { active = false; };
  }, []);

  const modules = useMemo(() => summary ? roleModules(profile?.role, summary) : [], [profile?.role, summary]);
  const quickLinks = profile?.role === "AD"
    ? [["/patients", "Patients"], ["/staff", "Staff"], ["/audit-logs", "Audit log"], ["/today-schedule", "Appointments"]]
    : profile?.role === "PT"
      ? [["/patients", "My health record"], ["/today-schedule", "My appointments"]]
      : [["/patients", "Patient search"], ["/today-schedule", "Appointments"], ["/icd-11", "ICD-11 search"]];

  return (
    <main className="clinic-dashboard-workspace">
      <header className="dashboard-welcome-panel"><div className="dashboard-title-icon"><RiDashboard3Line /></div><div><p className="dashboard-kicker">{profile?.role_display || "Clinic user"}</p><h1>{profile?.role === "PT" ? "My health dashboard" : `${profile?.role_display || "Clinic"} dashboard`}</h1><p>{profile?.first_name} {profile?.last_name}</p></div></header>
      {!summary && !error && <div className="dashboard-loading"><Spinner animation="border" /><span>Loading current clinic activity...</span></div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}
      {summary && <>
        <section className="dashboard-metrics" aria-label="Current clinic summary">{modules.map((module) => <article key={module.label}><div className="dashboard-module-icon">{module.icon}</div><div><span>{module.label}</span><strong>{module.value}</strong><small>{module.detail}</small></div></article>)}</section>
        <section className="dashboard-work-grid">
          <div><div className="dashboard-section-heading"><span>Recent activity</span><h2>{profile?.role === "PT" ? "My recent visits" : "Recent clinic visits"}</h2></div>{summary.recent_visits?.length ? <ul className="dashboard-activity-list">{summary.recent_visits.map((visit) => <li key={visit.id}><RiHistoryLine /><div><strong>{visit.patient_name}</strong><span>{visit.chief_complaint}</span></div><time>{new Date(visit.visit_date).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No recent visits.</p>}</div>
          <div><div className="dashboard-section-heading"><span>Schedule</span><h2>Recent appointments</h2></div>{summary.recent_appointments?.length ? <ul className="dashboard-activity-list">{summary.recent_appointments.map((appointment) => <li key={appointment.id}><RiCalendarCheckLine /><div><strong>{appointment.patient_name}</strong><span>{appointment.reason} · {appointment.status}</span></div><time>{new Date(appointment.scheduled_for).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No appointments available.</p>}</div>
          {profile?.role === "AD" && <div><div className="dashboard-section-heading"><span>Security oversight</span><h2>Recent audit activity</h2></div>{summary.recent_audit_activity?.length ? <ul className="dashboard-activity-list">{summary.recent_audit_activity.map((entry) => <li key={entry.id}><RiAdminLine /><div><strong>{entry.action}</strong><span>{entry.resource_type} | {entry.success ? "Success" : "Failed"}</span></div><time>{new Date(entry.timestamp).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No recent audit activity.</p>}</div>}
        </section>
        <nav className="dashboard-quick-links" aria-label="Dashboard quick actions">{quickLinks.map(([to, label]) => <Button as={Link} variant="outline-primary" to={to} key={to}>{label === "Patient search" ? <RiSearchLine /> : label === "Staff" ? <RiAdminLine /> : <RiFileList3Line />} {label}</Button>)}</nav>
      </>}
    </main>
  );
}

function roleModules(role, summary) {
  const commonAppointments = { icon: <RiCalendarCheckLine />, label: "Appointments today", value: summary.appointments_today, detail: `${summary.pending_appointments} scheduled` };
  if (role === "AD") return [
    { icon: <RiUserHeartLine />, label: "Active patients", value: summary.patients, detail: `${summary.patients_registered_today} registered today` },
    { icon: <RiAdminLine />, label: "Staff profiles", value: summary.total_staff || 0, detail: "Approved clinical roles" },
    commonAppointments,
    { icon: <RiHistoryLine />, label: "Open visits", value: summary.open_visits, detail: `${summary.visits} total visits` },
  ];
  if (role === "DC") return [commonAppointments, { icon: <RiHistoryLine />, label: "Open visits", value: summary.open_visits, detail: `${summary.visits} recent and completed` }, { icon: <RiFileList3Line />, label: "Diagnoses today", value: summary.diagnoses_today, detail: "Structured diagnoses" }];
  if (role === "NS") return [commonAppointments, { icon: <RiHeartPulseLine />, label: "Vital records today", value: summary.vital_signs_today, detail: `${summary.visits} patient visits` }, { icon: <RiUserHeartLine />, label: "Active patients", value: summary.patients, detail: "Available patient profiles" }];
  if (role === "RC") return [{ icon: <RiUserHeartLine />, label: "Active patients", value: summary.patients, detail: `${summary.patients_registered_today} registered today` }, commonAppointments, { icon: <RiCalendarCheckLine />, label: "Pending appointments", value: summary.pending_appointments, detail: "Awaiting attendance" }];
  if (role === "CO") return [{ icon: <RiUserHeartLine />, label: "Active patients", value: summary.patients, detail: "Available patient profiles" }, commonAppointments, { icon: <RiHistoryLine />, label: "Open visits", value: summary.open_visits, detail: `${summary.visits} total visits` }];
  if (role === "PT") return [{ icon: <RiUserHeartLine />, label: "My patient profile", value: summary.patients, detail: "Linked health record" }, commonAppointments, { icon: <RiHistoryLine />, label: "My visits", value: summary.visits, detail: `${summary.records} legacy records` }];
  return [];
}
