import React, { useEffect, useState } from "react";
import Spinner from "react-bootstrap/Spinner";
import { APPOINTMENTS, PATIENTS, RECORDS } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";

export default function Setup() {
  const [summary, setSummary] = useState({ patients: 0, records: 0, appointments: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true); setError("");
        const [patients, records, appointments] = await Promise.all([apiFetch(`${PATIENTS}?page=1&page_size=1`), apiFetch(`${RECORDS}?page=1&page_size=1`), apiFetch(`${APPOINTMENTS}?page=1&page_size=1`)]);
        setSummary({ patients: patients.count || 0, records: records.count || 0, appointments: Array.isArray(appointments) ? appointments.length : appointments.count || 0 });
      } catch { setError("The clinic setup summary could not be loaded."); }
      finally { setLoading(false); }
    };
    loadSummary();
  }, []);
  return <main className="setup-workspace"><header className="page-heading"><div><span className="eyebrow">System overview</span><h1>Clinic setup</h1><p>Live operational totals and configured platform context.</p></div></header>{loading && <div className="state-panel"><Spinner animation="border" /><h2>Loading clinic summary</h2></div>}{error && <div className="admin-error" role="alert">{error}</div>}{!loading && !error && <><section className="setup-summary-grid" aria-label="Clinic totals"><article><span>Active patient directory</span><strong>{summary.patients}</strong></article><article><span>Legacy structured records</span><strong>{summary.records}</strong></article><article><span>Appointments</span><strong>{summary.appointments}</strong></article></section><section className="setup-environment"><h2>Configured environment</h2><dl><div><dt>API framework</dt><dd>Django REST Framework</dd></div><div><dt>Clinical client</dt><dd>React portal</dd></div><div><dt>Data store</dt><dd>MariaDB/MySQL</dd></div></dl></section></>}</main>;
}
