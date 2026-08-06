import React from "react";
import Badge from "react-bootstrap/Badge";
import { RiRefreshLine } from "react-icons/ri";

export const STATUS_LABELS = {
  RECEPTION_INTAKE: "Information received",
  SENT_TO_NURSE: "Sent to nurse",
  NURSE_REVIEW: "Nurse reviewing",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  WAITING_FOR_DOCTOR: "Waiting for doctor",
  DOCTOR_CONFIRMED: "Doctor confirmed",
  IN_CONSULTATION: "In consultation",
  ATTENDED: "Attended",
  COMPLETED: "Completed",
  FOLLOW_UP_REQUIRED: "Follow-up required",
  CANCELLED: "Cancelled",
  ARCHIVED: "Archived",
};

const STATUS_VARIANTS = {
  RECEPTION_INTAKE: "secondary",
  SENT_TO_NURSE: "info",
  NURSE_REVIEW: "warning",
  APPOINTMENT_SCHEDULED: "primary",
  WAITING_FOR_DOCTOR: "primary",
  DOCTOR_CONFIRMED: "success",
  IN_CONSULTATION: "warning",
  ATTENDED: "success",
  COMPLETED: "success",
  FOLLOW_UP_REQUIRED: "warning",
  CANCELLED: "danger",
  ARCHIVED: "secondary",
};

export const formatDateTime = (value) => value
  ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
  : "Not available";

export function StatusBadge({ status }) {
  return <Badge bg={STATUS_VARIANTS[status] || "secondary"}>{STATUS_LABELS[status] || status}</Badge>;
}

export function WorkflowHeader({ eyebrow, title, description, onRefresh, refreshing, children }) {
  return (
    <header className="workflow-page-header">
      <div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      <div className="workflow-header-actions">
        {onRefresh && <button type="button" className="workflow-icon-button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh workflow" title="Refresh workflow"><RiRefreshLine /></button>}
        {children}
      </div>
    </header>
  );
}

export function IntakeCard({ intake, children }) {
  const patient = intake.patient_detail || {};
  return (
    <article className="intake-card">
      <div className="intake-card-heading">
        <div><strong>{patient.first_name} {patient.last_name}</strong><span>{patient.matric_number || "Student patient"}</span></div>
        <StatusBadge status={intake.status} />
      </div>
      <dl className="intake-card-details">
        <div><dt>Reason</dt><dd>{intake.reason_for_visit}</dd></div>
        <div><dt>Reported complaint</dt><dd>{intake.presenting_complaint}</dd></div>
        <div><dt>Priority</dt><dd>{intake.priority}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDateTime(intake.updated_at)}</dd></div>
        {intake.assigned_doctor_name && <div><dt>Assigned doctor</dt><dd>{intake.assigned_doctor_name}</dd></div>}
      </dl>
      {children && <div className="intake-card-actions">{children}</div>}
    </article>
  );
}

export function WorkflowState({ loading, error, empty, children }) {
  if (loading) return <div className="workflow-state">Loading current workflow...</div>;
  if (error) return <div className="workflow-state error" role="alert">{error}</div>;
  if (empty) return <div className="workflow-state">No workflow items need attention.</div>;
  return children;
}
