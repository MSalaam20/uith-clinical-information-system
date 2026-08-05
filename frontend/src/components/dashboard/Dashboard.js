import React, { useEffect, useState } from "react";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import { useSelector } from "react-redux";
import {
  RiCalendarCheckLine,
  RiDashboard3Line,
  RiFileList3Line,
  RiHeartPulseLine,
} from "react-icons/ri";
import { DASHBOARD_SUMMARY } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";
import "./DashboardWorkspace.css";

const Dashboard = () => {
  const profile = useSelector((state) => state.auth.profile);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    apiFetch(DASHBOARD_SUMMARY)
      .then((data) => mounted && setSummary(data))
      .catch(() => mounted && setError("Dashboard values could not be loaded."));
    return () => {
      mounted = false;
    };
  }, []);

  const cards = summary
    ? [
        {
          icon: <RiHeartPulseLine />,
          title: profile?.role === "PT" ? "My patient profile" : "Active patients",
          value: summary.patients,
          text: `${summary.patients_registered_today} registered today`,
        },
        {
          icon: <RiCalendarCheckLine />,
          title: "Appointments today",
          value: summary.appointments_today,
          text: `${summary.pending_appointments} pending appointments`,
        },
        {
          icon: <RiFileList3Line />,
          title: "Clinical activity",
          value: summary.visits,
          text: `${summary.records} legacy dynamic records`,
        },
      ]
    : [];

  return (
    <main className="clinic-dashboard-workspace">
      <Container fluid="lg">
        <section className="dashboard-welcome-panel">
          <div className="dashboard-title-icon"><RiDashboard3Line /></div>
          <div>
            <p className="dashboard-kicker">Authenticated Clinic Workspace</p>
            <h1>{profile?.role === "PT" ? "My Health Dashboard" : "Clinic Dashboard"}</h1>
            <p>Signed in as {profile?.role_display || "clinic user"}.</p>
          </div>
        </section>

        {!summary && !error && <p>Loading current clinic values...</p>}
        {error && <p className="text-danger" role="alert">{error}</p>}
        <Row className="g-4">
          {cards.map((card) => (
            <Col md={4} key={card.title}>
              <Card className="dashboard-module-card h-100">
                <Card.Body>
                  <div className="dashboard-module-icon">{card.icon}</div>
                  <h2>{card.title}</h2>
                  <div className="fs-2 fw-bold">{card.value}</div>
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
