import React from "react";
import Badge from "react-bootstrap/Badge";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import {
  RiArrowRightLine,
  RiDatabase2Line,
  RiHeartPulseLine,
  RiLockPasswordLine,
  RiNurseLine,
  RiShieldUserLine,
  RiStethoscopeLine,
  RiUserHeartLine,
} from "react-icons/ri";
import "../dashboard/Dashboard.css";

const openLoginPortal = (portalType = "staff") => {
  window.dispatchEvent(
    new CustomEvent("uith:open-login", { detail: { portalType } })
  );
};

const rolePortals = [
  {
    icon: <RiNurseLine />,
    portalType: "staff",
    title: "Clinical Staff Portal",
    text:
      "Doctors, Nurses & Receptionists - Access patient management, vitals entry, diagnoses, and ICD-11 coding.",
  },
  {
    icon: <RiUserHeartLine />,
    portalType: "student",
    title: "Student Patient Portal",
    text:
      "Unilorin Students - Access personal medical records, appointment schedules, and clinical visit summaries.",
  },
];

const features = [
  {
    icon: <RiShieldUserLine />,
    title: "Role-Based Access Control",
    text: "Doctor, nurse, receptionist, and student workflows stay safely separated.",
  },
  {
    icon: <RiHeartPulseLine />,
    title: "Real-Time Vitals",
    text: "Capture clinic observations and visit summaries with a clean clinical flow.",
  },
  {
    icon: <RiStethoscopeLine />,
    title: "ICD-11 Diagnostic Integration",
    text: "Support structured diagnosis lookup for modern clinical documentation.",
  },
];

const demoCredentials = [
  ["Doctor", "Dr. Jeremiah", "dr.jeremiah", "Doctor@123"],
  ["Nurse", "Nurse Fatima", "nurse.fatima", "Nurse@123"],
  ["Receptionist", "Mr. Ibrahim", "mr.ibrahim", "Reception@123"],
  ["Student", "Amina Sulaiman", "uith_2021_52HL034", "Student@123"],
];

const LandingPage = () => {
  return (
    <main className="clinical-landing">
      <Container>
        <section className="clinical-hero">
          <Badge className="defense-badge">
            Academic Defense Prototype - Student: Bello Abdulmumeen Adeboye
          </Badge>

          <Row className="align-items-center g-4">
            <Col lg={7}>
              <p className="hero-kicker">2025/2026 Session | Defense Edition v1.0</p>
              <h1>
                University of Ilorin Teaching Hospital (UITH) School Complex
                Clinic
              </h1>
              <p className="hero-subtitle">
                Integrated Electronic Health Record (EHR) & Clinical Management
                System
              </p>
              <div className="hero-actions">
                <button
                  className="primary-portal-button"
                  onClick={() => openLoginPortal("staff")}
                >
                  <RiLockPasswordLine />
                  Sign In to Staff Portal
                </button>
                <span className="hero-assurance">
                  Secured workflows for clinical staff and Unilorin student
                  patients.
                </span>
              </div>
            </Col>

            <Col lg={5}>
              <Card className="hero-status-card">
                <Card.Body>
                  <div className="status-icon">
                    <RiDatabase2Line />
                  </div>
                  <h2>Operational EHR Demo</h2>
                  <p>
                    Django REST API, MySQL database, seeded UITH clinic data,
                    JWT authentication, and React presentation UI.
                  </p>
                  <div className="status-grid">
                    <span>MySQL Ready</span>
                    <span>RBAC Enabled</span>
                    <span>Seeded Data</span>
                    <span>Clinical UI</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </section>

        <Row className="role-portal-grid g-4">
          {rolePortals.map((portal) => (
            <Col md={6} key={portal.title}>
              <Card
                className="portal-card h-100"
                onClick={() => openLoginPortal(portal.portalType)}
              >
                <Card.Body>
                  <div className="portal-icon">{portal.icon}</div>
                  <h2>{portal.title}</h2>
                  <p>{portal.text}</p>
                  <span className="portal-link">
                    Continue to access <RiArrowRightLine />
                  </span>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Row className="features-grid g-4">
          {features.map((feature) => (
            <Col md={4} key={feature.title}>
              <Card className="feature-card h-100">
                <Card.Body>
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="demo-credentials-card">
          <Card.Body>
            <div className="demo-card-header">
              <div>
                <span className="demo-eyebrow">1-Click Demo Credentials</span>
                <h2>Presentation-ready test accounts</h2>
              </div>
              <button
                className="secondary-portal-button"
                onClick={() => openLoginPortal("staff")}
              >
                Open Staff Login
              </button>
            </div>
            <Row className="g-3">
              {demoCredentials.map(([role, name, username, password]) => (
                <Col lg={3} md={6} key={username}>
                  <div className="credential-tile">
                    <span>{role}</span>
                    <strong>{name}</strong>
                    <code>{username}</code>
                    <small>{password}</small>
                  </div>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      </Container>
    </main>
  );
};

export default LandingPage;
