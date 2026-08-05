import React from "react";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import {
  RiCalendarCheckLine,
  RiDashboard3Line,
  RiFileList3Line,
  RiHeartPulseLine,
} from "react-icons/ri";
import "./DashboardWorkspace.css";

const dashboardCards = [
  {
    icon: <RiHeartPulseLine />,
    title: "Patient Workflow",
    text: "Use the Patients module to register student patients, update biodata, and manage clinic records.",
  },
  {
    icon: <RiCalendarCheckLine />,
    title: "Appointments",
    text: "Review scheduled clinic appointments from the live backend calendar.",
  },
  {
    icon: <RiFileList3Line />,
    title: "Clinical Records",
    text: "Open a patient profile to review visits, vitals, diagnoses, and treatment summaries.",
  },
];

const Dashboard = () => {
  return (
    <main className="clinic-dashboard-workspace">
      <Container fluid="lg">
        <section className="dashboard-welcome-panel">
          <div className="dashboard-title-icon">
            <RiDashboard3Line />
          </div>
          <div>
            <p className="dashboard-kicker">Authenticated Clinic Workspace</p>
            <h1>Clinic Dashboard</h1>
            <p>
              Select a protected module from the navigation bar to manage UITH
              School Complex Clinic operations.
            </p>
          </div>
        </section>

        <Row className="g-4">
          {dashboardCards.map((card) => (
            <Col md={4} key={card.title}>
              <Card className="dashboard-module-card h-100">
                <Card.Body>
                  <div className="dashboard-module-icon">{card.icon}</div>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </main>
  );
};

export default Dashboard;
