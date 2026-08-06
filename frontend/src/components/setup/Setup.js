import React, { useEffect, useState } from "react";
import Spinner from "react-bootstrap/Spinner";
import { RiArchiveLine, RiDatabase2Line, RiShieldCheckLine } from "react-icons/ri";
import { DASHBOARD_SUMMARY } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";

export default function Setup() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        setError("");
        setSummary(await apiFetch(DASHBOARD_SUMMARY));
      } catch {
        setError("The clinic setup summary could not be loaded.");
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  return <main className="setup-workspace">
    <header className="page-heading"><div><span className="eyebrow">System overview</span><h1>Clinic setup</h1><p>Live operational totals and configured platform context.</p></div></header>
    {loading && <div className="state-panel"><Spinner animation="border" /><h2>Loading clinic summary</h2></div>}
    {error && <div className="admin-error" role="alert">{error}</div>}
    {summary && !loading && !error && <>
      <section className="setup-summary-grid" aria-label="Clinic totals"><article><span>Active patient directory</span><strong>{summary.patients}</strong></article><article><span>Legacy structured records</span><strong>{summary.records}</strong></article><article><span>Appointments</span><strong>{summary.appointments}</strong></article></section>
      <section className="setup-environment"><h2>Configured environment</h2><dl><div><dt>API framework</dt><dd>Django REST Framework</dd></div><div><dt>Clinical client</dt><dd>React portal</dd></div><div><dt>Data store</dt><dd>MariaDB/MySQL</dd></div></dl></section>
      {summary.demo_data?.enabled && <section className="demo-data-panel" aria-labelledby="demo-data-title"><header><RiDatabase2Line /><div><span className="eyebrow">Development and defence</span><h2 id="demo-data-title">Demo data status</h2></div></header><div className="demo-data-counts"><div><strong>{summary.demo_data.profiles}</strong><span>demo profiles</span></div><div><strong>{summary.demo_data.patients}</strong><span>demo patients</span></div><div><strong>{summary.demo_data.intakes}</strong><span>demo workflows</span></div></div><dl><div><dt><RiShieldCheckLine /> Idempotent seed</dt><dd><code>{summary.demo_data.seed_command}</code></dd></div><div><dt><RiArchiveLine /> Non-destructive archive</dt><dd><code>{summary.demo_data.archive_command}</code></dd></div></dl><p>Purge is disabled without an explicit environment flag and confirmation phrase. Ordinary clinical history remains protected.</p></section>}
    </>}
  </main>;
}
