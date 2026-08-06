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
  RiNurseLine,
  RiStethoscopeLine,
  RiTeamLine,
  RiTimeLine,
  RiUserAddLine,
  RiUserHeartLine,
} from "react-icons/ri";
import { DASHBOARD_SUMMARY } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import { roleConfig } from "../../config/roleCapabilities";
import "./DashboardWorkspace.css";

const metricIcons = {
  patients: <RiUserHeartLine />,
  intakes: <RiUserAddLine />,
  nurse: <RiNurseLine />,
  doctor: <RiStethoscopeLine />,
  appointments: <RiCalendarCheckLine />,
  clinical: <RiHeartPulseLine />,
  complete: <RiHistoryLine />,
  warning: <RiTimeLine />,
  followup: <RiFileList3Line />,
  staff: <RiTeamLine />,
};

export default function Dashboard() {
  const profile = useSelector((state) => state.auth.profile);
  const configuration = roleConfig(profile?.role);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch(DASHBOARD_SUMMARY)
      .then((data) => active && setSummary(data))
      .catch(() => active && setError("Dashboard values could not be loaded."));
    return () => { active = false; };
  }, []);

  const modules = useMemo(() => summary
    ? configuration.metrics.map(([label, key, icon]) => ({
      label, value: summary[key] ?? 0, icon: metricIcons[icon] || <RiDashboard3Line />,
    }))
    : [], [configuration.metrics, summary]);
  const quickLinks = configuration.navigation
    .filter(([route]) => !["/dashboard", "/account"].includes(route))
    .slice(0, 5);
  const recentTitle = profile?.role === "PT" ? "My current clinic requests" : "Current workflow queue";

  return (
    <main className={`clinic-dashboard-workspace role-${profile?.role?.toLowerCase() || "unknown"}`}>
      <header className="dashboard-welcome-panel"><div className="dashboard-title-icon"><RiDashboard3Line /></div><div><p className="dashboard-kicker">{configuration.displayName}</p><h1>{profile?.role === "PT" ? "My clinic dashboard" : `${configuration.displayName} dashboard`}</h1><p>{configuration.responsibility}</p></div></header>
      {!summary && !error && <div className="dashboard-loading"><Spinner animation="border" /><span>Loading work that needs attention...</span></div>}
      {error && <div className="dashboard-error" role="alert">{error}</div>}
      {summary && <>
        <section className="dashboard-metrics" aria-label={`${configuration.displayName} work summary`}>{modules.map((module) => <article key={module.label}><div className="dashboard-module-icon">{module.icon}</div><div><span>{module.label}</span><strong>{module.value}</strong><small>Current authorized view</small></div></article>)}</section>
        <section className="dashboard-work-grid">
          <div><div className="dashboard-section-heading"><span>Needs attention</span><h2>{recentTitle}</h2></div>{summary.recent_intakes?.length ? <ul className="dashboard-activity-list">{summary.recent_intakes.map((intake) => <li key={intake.id}><RiHistoryLine /><div><strong>{intake.patient_name}</strong><span>{intake.reason_for_visit} | {intake.status_label}</span></div><time>{new Date(intake.updated_at).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No current workflow items for this role.</p>}</div>
          <div><div className="dashboard-section-heading"><span>Schedule</span><h2>{profile?.role === "PT" ? "My appointments" : "Authorized appointments"}</h2></div>{summary.recent_appointments?.length ? <ul className="dashboard-activity-list">{summary.recent_appointments.map((appointment) => <li key={appointment.id}><RiCalendarCheckLine /><div><strong>{appointment.patient_name}</strong><span>{appointment.reason} | {appointment.status}</span></div><time>{new Date(appointment.scheduled_for).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No appointments available.</p>}</div>
          {profile?.role === "AD" && <div><div className="dashboard-section-heading"><span>Security oversight</span><h2>Recent audit activity</h2></div>{summary.recent_audit_activity?.length ? <ul className="dashboard-activity-list">{summary.recent_audit_activity.map((entry) => <li key={entry.id}><RiAdminLine /><div><strong>{entry.action}</strong><span>{entry.resource_type} | {entry.success ? "Success" : "Failed"}</span></div><time>{new Date(entry.timestamp).toLocaleString()}</time></li>)}</ul> : <p className="dashboard-empty">No recent audit activity.</p>}</div>}
        </section>
        <nav className="dashboard-quick-links" aria-label="Role-specific primary actions">{quickLinks.map(([to, label]) => <Button as={Link} variant="outline-primary" to={to} key={to}><RiFileList3Line /> {label}</Button>)}</nav>
      </>}
    </main>
  );
}
