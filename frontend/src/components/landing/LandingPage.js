import React, { useEffect, useState } from "react";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import {
  RiArrowRightLine,
  RiCalendarCheckLine,
  RiCheckDoubleLine,
  RiDatabase2Line,
  RiFileCopyLine,
  RiFileList3Line,
  RiFileShield2Line,
  RiHeartPulseLine,
  RiHistoryLine,
  RiLockPasswordLine,
  RiNurseLine,
  RiShieldCheckLine,
  RiStethoscopeLine,
  RiTeamLine,
  RiUserAddLine,
  RiUserHeartLine,
} from "react-icons/ri";
import heroImage from "../../assets/clinic-ehr-hero.webp";
import { clinicalApi } from "../../api/clinicalApi";
import "./LandingPage.css";

const openLoginPortal = (portalType) => window.dispatchEvent(
  new CustomEvent("uith:open-login", { detail: { portalType } })
);

const careFlow = [
  { key: "student", label: "Student", Icon: RiUserHeartLine, summary: "Arrives, shares information and tracks progress.", actions: ["Clinic arrival", "Portal access", "Status tracking"] },
  { key: "reception", label: "Receptionist", Icon: RiUserAddLine, summary: "Finds or registers the student and opens an intake.", actions: ["Student lookup", "Reason recorded", "Sent to nurse"] },
  { key: "nurse", label: "Nurse", Icon: RiNurseLine, summary: "Reviews priority, assigns a doctor and schedules care.", actions: ["Intake review", "Doctor assignment", "Appointment set"] },
  { key: "doctor", label: "Doctor", Icon: RiStethoscopeLine, summary: "Confirms, documents and completes the consultation.", actions: ["Clinical review", "Diagnosis and care", "Visit completion"] },
  { key: "complete", label: "Completed Care", Icon: RiCheckDoubleLine, summary: "Approved outcomes remain available for continuity.", actions: ["Summary visible", "Prescription ready", "Follow-up tracked"] },
];

const capabilities = [
  [RiUserHeartLine, "One patient identity", "Repeat visits remain linked to one student record."],
  [RiHeartPulseLine, "Structured care", "Vitals, notes, diagnoses and prescriptions stay visit-based."],
  [RiCalendarCheckLine, "Coordinated queues", "Intake, assignment and appointment states move together."],
  [RiShieldCheckLine, "Role boundaries", "Each portal exposes only its permitted work."],
  [RiHistoryLine, "Traceable history", "Workflow changes and security events retain an audit trail."],
  [RiDatabase2Line, "Durable records", "MariaDB-backed clinical history is archived, not casually deleted."],
];

const previews = [
  { role: "Receptionist", title: "Receptionist Intake", Icon: RiUserAddLine, accent: "reception", rows: [["Student lookup", "Amina Yusuf"], ["Reason for visit", "Recurring headache"], ["Priority", "Routine"]], action: "Submit to nurse" },
  { role: "Nurse", title: "Nurse Queue", Icon: RiNurseLine, accent: "nurse", rows: [["New intakes", "04"], ["Assigned doctor", "Dr. I. Musa"], ["Appointment", "10:30 AM"]], action: "Place in doctor queue" },
  { role: "Doctor", title: "Doctor Consultation", Icon: RiStethoscopeLine, accent: "doctor", rows: [["Complaint", "Recurring headache"], ["Visit state", "In consultation"], ["Clinical entries", "Vitals, note, diagnosis"]], action: "Complete consultation" },
  { role: "Student", title: "Student Journey", Icon: RiUserHeartLine, accent: "student", rows: [["Sent to nurse", "Completed"], ["Appointment", "Scheduled"], ["Consultation", "Current"]], action: "View approved summary" },
];

export default function LandingPage() {
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [copied, setCopied] = useState("");
  const [activeFlow, setActiveFlow] = useState(0);

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

      <section className="landing-proof" aria-label="Platform trust indicators">
        <Container><div><strong>6</strong><span>distinct clinic roles</span></div><div><strong>12</strong><span>traceable workflow states</span></div><div><strong>1</strong><span>continuous student record</span></div><div><RiShieldCheckLine /><span>audited clinical access</span></div></Container>
      </section>

      <section className="portal-access" id="portals">
        <Container>
          <div className="section-heading"><span className="eyebrow">Portal access</span><h2>Workspaces shaped around responsibility</h2><p>Staff coordinate care. Students follow only their own journey.</p></div>
          <div className="portal-access-grid">
            <button type="button" onClick={() => openLoginPortal("staff")}><span className="portal-icon"><RiTeamLine /></span><span><small>Clinic operations</small><strong>Clinical Staff Portal</strong><em>Doctor-in-Charge, doctor, nurse and reception workflows</em></span><RiArrowRightLine /></button>
            <button type="button" onClick={() => openLoginPortal("student")}><span className="portal-icon"><RiUserHeartLine /></span><span><small>Private access</small><strong>Student Patient Portal</strong><em>Appointments, care progress and approved health records</em></span><RiArrowRightLine /></button>
          </div>
        </Container>
      </section>

      <section className="care-flow-band" id="workflow">
        <Container>
          <div className="section-heading"><span className="eyebrow">Connected clinic workflow</span><h2>How Care Moves Through the Clinic</h2><p>Choose a stage to see its handoff.</p></div>
          <div className="care-flow" role="group" aria-label="Clinic care workflow">
            {careFlow.map(({ key, label, Icon }, index) => <React.Fragment key={key}><button type="button" className={activeFlow === index ? "active" : ""} aria-pressed={activeFlow === index} onClick={() => setActiveFlow(index)} onFocus={() => setActiveFlow(index)}><span><Icon /></span><strong>{label}</strong><small>Stage {index + 1}</small></button>{index < careFlow.length - 1 && <RiArrowRightLine className="flow-connector" aria-hidden="true" />}</React.Fragment>)}
          </div>
          <div className="flow-detail" aria-live="polite"><div><span>0{activeFlow + 1}</span><h3>{careFlow[activeFlow].label}</h3><p>{careFlow[activeFlow].summary}</p></div><ul>{careFlow[activeFlow].actions.map((action) => <li key={action}><RiCheckDoubleLine /> {action}</li>)}</ul></div>
        </Container>
      </section>

      <section className="product-preview-band" id="previews">
        <Container>
          <div className="section-heading"><span className="eyebrow">Inside the system</span><h2>Four portals, one coordinated record</h2><p>Synthetic interface previews show each role at work.</p></div>
          <div className="preview-grid">{previews.map(({ role, title, Icon, accent, rows, action }) => <article className={`product-preview ${accent}`} key={title}><header><span className="browser-dots" aria-hidden="true"><i /><i /><i /></span><small>{role} workspace</small></header><div className="preview-title"><span><Icon /></span><div><small>UITH Clinic</small><h3>{title}</h3></div></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="preview-action"><RiCheckDoubleLine /> {action}</div></article>)}</div>
        </Container>
      </section>

      <section className="capability-band" id="capabilities">
        <Container>
          <div className="section-heading"><span className="eyebrow">Clinical foundation</span><h2>Built for continuity, clarity and control</h2></div>
          <div className="capability-bento">{capabilities.map(([Icon, title, text], index) => <article className={index === 0 || index === 5 ? "wide" : ""} key={title}><Icon /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div>
        </Container>
      </section>

      <section className="security-band" id="security">
        <Container><div className="security-mark"><RiFileShield2Line /><span>Security by role</span></div><div><span className="eyebrow">Protected by design</span><h2>Clinical access is specific, authenticated and accountable.</h2></div><ul><li><RiLockPasswordLine /><span><strong>Separated portals</strong>Staff and student entry points stay distinct.</span></li><li><RiShieldCheckLine /><span><strong>Backend-enforced permissions</strong>Hidden controls are backed by API rules.</span></li><li><RiHistoryLine /><span><strong>Audited changes</strong>Important workflow and account actions are traceable.</span></li></ul></Container>
      </section>

      <section className="journey-band">
        <Container><div className="journey-copy"><span className="eyebrow">Student view</span><h2>A clear answer to "what happens next?"</h2><p>Every milestone includes a label, explanation and time so progress never depends on colour alone.</p><button type="button" onClick={() => openLoginPortal("student")}>Open Student Patient Portal <RiArrowRightLine /></button></div><ol className="journey-track"><li className="complete"><RiCheckDoubleLine /><span><strong>Information received</strong><small>09:04</small></span></li><li className="complete"><RiNurseLine /><span><strong>Sent to nurse</strong><small>09:08</small></span></li><li className="complete"><RiCalendarCheckLine /><span><strong>Appointment scheduled</strong><small>10:30</small></span></li><li className="current"><RiStethoscopeLine /><span><strong>Consultation in progress</strong><small>Current stage</small></span></li><li><RiFileList3Line /><span><strong>Completed</strong><small>Summary follows</small></span></li></ol></Container>
      </section>

      <section className="project-identity" id="about">
        <Container>
          <div className="project-identity-heading"><span className="eyebrow">Project identity</span><h2>A focused clinical informatics system for a school clinic.</h2><p>Django REST Framework, React and MariaDB support a practical academic implementation of secure, role-driven student care.</p></div>
          <dl className="academic-details">
            <div><dt>Designed and developed by</dt><dd>Adebayo</dd></div>
            <div><dt>Project supervisor</dt><dd>Mrs. Y. S. Jeremiah</dd></div>
            <div className="academic-affiliation"><dt>Academic affiliation</dt><dd>Ladoke Akintola University of Technology</dd><span>Faculty of Computing and Informatics | Department of Computer Science</span></div>
          </dl>
        </Container>
      </section>

      {demoAccounts.length > 0 && <section className="demo-access-band" aria-label="Defence demo access"><Container><Accordion><Accordion.Item eventKey="0"><Accordion.Header>Defence Demo Access: synthetic test accounts</Accordion.Header><Accordion.Body><p>These credentials are enabled for development or academic defence only. They must be removed or changed before a real deployment.</p><div className="demo-account-grid">{demoAccounts.map((account) => <article key={account.username}><span>{account.role}</span><strong>{account.portal === "student" ? "Student Patient Portal" : "Clinical Staff Portal"}</strong><div><code>{account.username}</code><button onClick={() => copy(account.username, `${account.username}-username`)} aria-label={`Copy ${account.role} username`} title="Copy username"><RiFileCopyLine /></button></div><div><code>{account.password}</code><button onClick={() => copy(account.password, `${account.username}-password`)} aria-label={`Copy ${account.role} password`} title="Copy password"><RiFileCopyLine /></button></div>{copied.startsWith(account.username) && <small role="status">Copied</small>}</article>)}</div></Accordion.Body></Accordion.Item></Accordion></Container></section>}

      <footer className="landing-footer"><Container><div><strong>UITH School Complex Clinic EHR</strong><span>Academic defence prototype, 2025/2026 session</span></div><nav aria-label="Landing page sections"><a href="#portals">Portals</a><a href="#workflow">Workflow</a><a href="#previews">Previews</a><a href="#security">Security</a></nav><p>Designed and developed by Adebayo, Department of Computer Science, Ladoke Akintola University of Technology.</p><p className="academic-disclaimer">Academic clinical information-system prototype using synthetic demonstration data. This is not an officially deployed UITH or LAUTECH production healthcare system.</p></Container></footer>
    </main>
  );
}
