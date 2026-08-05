import React, { useEffect, useState } from "react";
import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import { APPOINTMENTS, PATIENTS, RECORDS } from "../../api/apiConfig";
import { apiFetch } from "../../api/apiFetch";

const Setup = () => {
  const [summary, setSummary] = useState({ patients: 0, records: 0, appointments: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        setLoading(true);
        const [patientsData, recordsData, appointmentsData] = await Promise.all([
          apiFetch(`${PATIENTS}?page=1&page_size=1`),
          apiFetch(`${RECORDS}?page=1&page_size=1`),
          apiFetch(`${APPOINTMENTS}?page=1&page_size=1`),
        ]);

        setSummary({
          patients: patientsData.count || 0,
          records: recordsData.count || 0,
          appointments: Array.isArray(appointmentsData)
            ? appointmentsData.length
            : appointmentsData.count || 0,
        });
      } catch (error) {
        console.error("Failed to load setup summary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, []);

  return (
    <Container className="py-4">
      <Card className="border-0 shadow-sm">
        <Card.Body>
          <Card.Title>Clinic Setup</Card.Title>
          <Card.Text className="text-muted">
            {loading
              ? "Loading live backend summary..."
              : "Live backend summary for the thesis defense environment."}
          </Card.Text>
          <Row className="g-3">
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <strong>Patients</strong>
                  <div className="fs-2">{summary.patients}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <strong>Records</strong>
                  <div className="fs-2">{summary.records}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <strong>Appointments</strong>
                  <div className="fs-2">{summary.appointments}</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Setup;
