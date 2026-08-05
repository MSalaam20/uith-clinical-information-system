import React, { useEffect, useState } from "react";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import {
  RiArrowRightLine,
  RiCalendarCheckLine,
  RiDatabase2Line,
  RiFileCopyLine,
  RiFileShield2Line,
  RiHeartPulseLine,
  RiLockPasswordLine,
  RiNurseLine,
  RiShieldCheckLine,
  RiStethoscopeLine,
  RiUserHeartLine,
} from "react-icons/ri";
import heroImage from "../../assets/clinic-ehr-hero.webp";
import { clinicalApi } from "../../api/clinicalApi";
import "./LandingPage.css";

const openLoginPortal = (portalType) => window.dispatchEvent(
  new CustomEvent("uith:open-login", { detail: { portalType } })
);

const capabilities = [
  [RiUserHeartLine, "Patient continuity", "Linked demographics, appointments, encounters, vitals, notes, diagnoses, prescriptions, and legacy records."],
  [RiHeartPulseLine, "Clinical documentation", "Role-specific workflows for reception, nursing observations, medical review, and student-facing summaries."],
  [RiStethoscopeLine, "Structured diagnosis", "A clearly labelled curated ICD-11 demonstration subset supports consistent diagnostic coding."],
  [RiFileShield2Line, "Accountable access", "Portal separation, role permissions, append-only audit entries, and traceable account administration."],
];

const workflow = [
  ["01", "Register", "Reception records a verified student patient profile."],
  ["02", "Schedule", "Appointments organize the clinic queue and attendance."],
  ["03", "Document", "Authorized clinicians record visits, vitals, diagnoses, notes, and treatment."],
  ["04", "Review", "Students see only their linked, patient-visible health information."],
];

export default function LandingPage() {
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    clinicalApi.getDemoAccess()
      .then((data) => active && setDemoAccounts(data.accounts || []))
      .catch(() => active && setDemoAccounts([]));
    return () => { active = false; };
  }, []);

  const copy = async (value, key) => {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  };

  return (
    <main className="landing-page">
      <section className="landing-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <Container className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="prototype-label">Academic clinical informatics prototype</span>
            <h1>UITH School Complex Clinic</h1>
            <p className="hero-lead">An integrated electronic health record and clinic management system for coordinated student care.</p>
            <div className="hero-buttons">
              <Button className="gold-button" onClick={() => openLoginPortal("staff")}><RiLockPasswordLine /> Clinical Staff Portal</Button>
              <Button variant="outline-light" onClick={() => openLoginPortal("student")}><RiUserHeartLine /> Student Patient Portal</Button>
            </div>
            <div className="hero-trust"><span><RiShieldCheckLine /> Role-aware access</span><span><RiDatabase2Line /> Structured clinical records</span><span><RiCalendarCheckLine /> Appointment workflow</span></div>
          </div>
        </Container>
      </section>

      <section className="landing-intro" id="about">
        <Container><div className="intro-grid"><div><span className="eyebrow">Purpose-built clinic workflow</span><h2>One record, from front desk to clinical review</h2></div><p>The system preserves the clinic’s existing Django REST and React workflows while making daily tasks easier to scan, safer to administer, and clearer to demonstrate. All visible patient examples are synthetic.</p></div></Container>
      </section>

      <section className="capability-band" id="capabilities">
        <Container>
          <div className="section-title"><span className="eyebrow">Clinical capabilities</span><h2>Focused tools for a working school clinic</h2><p>Operational screens favor legibility, traceability, and repeated use over decorative complexity.</p></div>
          <div className="capability-grid">{capabilities.map(([Icon, title, text]) => <article key={title}><Icon /><h3>{title}</h3><p>{text}</p></article>)}</div>
        </Container>
      </section>

      <section className="workflow-band">
        <Container><div className="section-title"><span className="eyebrow">Care workflow</span><h2>A traceable path through each clinic interaction</h2></div><ol className="workflow-list">{workflow.map(([number, title, text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></Container>
      </section>

      <section className="access-band" id="security">
        <Container><div className="access-layout"><div className="access-copy"><span className="eyebrow">Secure portal separation</span><h2>Enter through the portal designed for your role</h2><p>Staff accounts are provisioned by clinic administrators. Student accounts are created from verified patient records by administrators or reception staff.</p><div className="security-points"><span><RiShieldCheckLine /> JWT-authenticated sessions</span><span><RiFileShield2Line /> Append-only security audit</span><span><RiLockPasswordLine /> First-login password change</span></div></div><div className="portal-choices"><button onClick={() => openLoginPortal("staff")}><RiNurseLine /><span><strong>Clinical Staff Portal</strong><small>Administrator, doctor, nurse, receptionist, coordinator</small></span><RiArrowRightLine /></button><button onClick={() => openLoginPortal("student")}><RiUserHeartLine /><span><strong>Student Patient Portal</strong><small>Access to the linked personal health record</small></span><RiArrowRightLine /></button></div></div></Container>
      </section>

      {demoAccounts.length > 0 && <section className="demo-access-band" aria-label="Defence demo access"><Container><Accordion><Accordion.Item eventKey="0"><Accordion.Header>Defence Demo Access: synthetic test accounts</Accordion.Header><Accordion.Body><p>These credentials are enabled for development or academic defence only. They must be removed or changed before a real deployment.</p><div className="demo-account-grid">{demoAccounts.map((account) => <article key={account.username}><span>{account.role}</span><strong>{account.portal === "student" ? "Student Patient Portal" : "Clinical Staff Portal"}</strong><div><code>{account.username}</code><button onClick={() => copy(account.username, `${account.username}-username`)} aria-label={`Copy ${account.role} username`} title="Copy username"><RiFileCopyLine /></button></div><div><code>{account.password}</code><button onClick={() => copy(account.password, `${account.username}-password`)} aria-label={`Copy ${account.role} password`} title="Copy password"><RiFileCopyLine /></button></div>{copied.startsWith(account.username) && <small role="status">Copied</small>}</article>)}</div></Accordion.Body></Accordion.Item></Accordion></Container></section>}

      <footer className="landing-footer"><Container><div><strong>UITH School Complex Clinic EHR</strong><span>Academic defence prototype, 2025/2026 session</span></div><p>Designed and developed by Bello Abdulmumeen Adeboye using Django REST Framework, MariaDB/MySQL, and React.</p></Container></footer>
    </main>
  );
}
