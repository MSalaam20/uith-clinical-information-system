import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiCalendarCheckLine,
  RiCheckboxCircleLine,
  RiCircleLine,
  RiFileList3Line,
  RiNurseLine,
  RiRefreshLine,
  RiStethoscopeLine,
  RiTimeLine,
  RiUserReceived2Line,
} from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { formatDateTime, StatusBadge, WorkflowHeader, WorkflowState } from "./WorkflowPrimitives";
import "./Workflow.css";

const STEPS = [
  ["RECEPTION_INTAKE", "Information Received", "The front desk recorded your clinic information.", RiUserReceived2Line],
  ["SENT_TO_NURSE", "Sent to Nurse", "Your request entered the nursing queue.", RiNurseLine],
  ["NURSE_REVIEW", "Nurse Reviewing", "A nurse is reviewing the information you supplied.", RiFileList3Line],
  ["APPOINTMENT_SCHEDULED", "Appointment Scheduled", "A date, time and doctor were selected.", RiCalendarCheckLine],
  ["WAITING_FOR_DOCTOR", "Waiting for Doctor", "Your case is visible in the assigned doctor queue.", RiTimeLine],
  ["DOCTOR_CONFIRMED", "Doctor Confirmed", "The doctor accepted the appointment.", RiCheckboxCircleLine],
  ["IN_CONSULTATION", "Consultation in Progress", "Your clinical consultation has started.", RiStethoscopeLine],
  ["ATTENDED", "Attended", "The doctor has attended to this clinic request.", RiCheckboxCircleLine],
  ["COMPLETED", "Completed", "Approved information is now available in your record.", RiCheckboxCircleLine],
];

const statusIndex = (status) => {
  if (status === "FOLLOW_UP_REQUIRED") return STEPS.length - 1;
  return STEPS.findIndex(([code]) => code === status);
};

export default function CareJourney() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const response = await clinicalApi.listIntakes();
      setItems(response.items);
      setSelectedId((current) => current || response.items[0]?.id || null);
      setLastUpdated(new Date());
    } catch (requestError) { setError(apiError(requestError, "Your care journey could not be loaded.").message); }
    finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || items[0], [items, selectedId]);
  const history = selected?.history || [];
  const historyCodes = new Set(history.map((item) => item.to_status));
  const currentIndex = statusIndex(selected?.status);
  return (
    <main className="workflow-workspace care-journey-workspace">
      <WorkflowHeader eyebrow="Student patient portal" title="My care journey" description="Track each clinic handoff and view only approved care information." onRefresh={() => load()} refreshing={loading} />
      <div className="journey-refresh-line"><RiRefreshLine /><span>Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : "Waiting for update"}</span><small>Status refreshes automatically every 30 seconds.</small></div>
      <WorkflowState loading={loading} error={error} empty={!items.length}>
        {items.length > 1 && <div className="journey-selector" role="tablist" aria-label="Clinic visit journeys">{items.map((item) => <button type="button" role="tab" aria-selected={item.id === selected?.id} className={item.id === selected?.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>{new Date(item.created_at).toLocaleDateString()}<StatusBadge status={item.status} /></button>)}</div>}
        {selected && <div className="journey-layout">
          <ol className="care-timeline" aria-label="Student care journey">
            {STEPS.map(([code, label, explanation, Icon], index) => {
              const complete = historyCodes.has(code) || currentIndex > index;
              const current = currentIndex === index;
              const entry = history.find((item) => item.to_status === code);
              return <li key={code} className={complete ? "complete" : current ? "current" : "pending"} aria-current={current ? "step" : undefined}><span className="timeline-icon">{complete ? <RiCheckboxCircleLine /> : current ? <Icon /> : <RiCircleLine />}</span><div><strong>{label}</strong><p>{explanation}</p><time>{entry ? formatDateTime(entry.created_at) : current ? formatDateTime(selected.updated_at) : "Pending"}</time></div><span className="timeline-state">{complete ? "Complete" : current ? "Current" : "Pending"}</span></li>;
            })}
          </ol>
          <aside className="journey-summary" aria-label="Current care details">
            <div><span>Current status</span><StatusBadge status={selected.status} /><p>{selected.status_message}</p></div>
            <dl><div><dt>Reason for visit</dt><dd>{selected.reason_for_visit}</dd></div><div><dt>Appointment</dt><dd>{selected.appointment_detail ? formatDateTime(selected.appointment_detail.scheduled_for) : "Not scheduled yet"}</dd></div><div><dt>Doctor</dt><dd>{selected.assigned_doctor_name || "Not assigned yet"}</dd></div><div><dt>Approved summary</dt><dd>{selected.approved_summary || "Available after the consultation is completed."}</dd></div><div><dt>Follow-up</dt><dd>{selected.follow_up_instructions || "No follow-up instruction published."}</dd></div></dl>
            <section><h2>Approved prescription</h2>{selected.approved_prescriptions?.length ? selected.approved_prescriptions.map((prescription) => <div className="journey-prescription" key={prescription.id}>{prescription.items.map((item, index) => <p key={`${item.medication}-${index}`}><strong>{item.medication}</strong><span>{item.dose} | {item.frequency} | {item.duration}</span><small>{item.instructions}</small></p>)}</div>) : <p className="journey-empty">No approved prescription is available for this visit.</p>}</section>
          </aside>
        </div>}
      </WorkflowState>
    </main>
  );
}
