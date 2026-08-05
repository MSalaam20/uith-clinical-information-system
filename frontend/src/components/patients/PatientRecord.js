import React from "react";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import { useSelector } from "react-redux";
import "./Patients.css";

const PatientRecord = () => {
  const record = useSelector((state) => state.recordForm.record);

  const CardTemplate = ({ title = null, src = null, children = null, className = null, classNameBody = null }) => (
    <Card className={className}>
      {title ? <Card.Header>{title}</Card.Header> : null}
      {src ? <Card.Img variant="top" src={src} /> : null}
      {children ? <Card.Body className={classNameBody}>{children}</Card.Body> : null}
    </Card>
  );

  const ListGroupTemplate = ({ level = 0, title = null, value = null }) => (
    <ListGroup.Item
      key={`${level}-${title}`}
      variant="flush"
      style={{ marginLeft: `${level * 20}px`, flex: "1 1 auto" }}
    >
      <b>{title.replace(/_/g, " ")}: </b>
      {value}
    </ListGroup.Item>
  );

  if (!record) {
    return CardTemplate({
      title: "Select a patient to view details.",
      className: "card-height",
      classNameBody: "d-flex align-items-center justify-content-center text-muted",
      children: "Select a patient to view details.",
    });
  }

  const { findings } = record;

  const renderFields = (fields, level = 0) => {
    if (typeof fields === "string") {
      if (fields.startsWith("data:image/")) {
        return CardTemplate({
          src: fields,
          className: "image-card",
        });
      }

      if (fields.trim() !== "") {
        return ListGroupTemplate({
          level,
          title: fields,
        });
      }
    }

    return Object.keys(fields).map((field) => {
      const value = fields[field];
      if (typeof value === "string" && value.trim() !== "") {
        if (value.startsWith("data:image/")) {
          return CardTemplate({
            title: "",
            src: value,
            className: "image-card",
          });
        }

        return ListGroupTemplate({
          level,
          title: field,
          value,
        });
      }

      if (typeof value === "number") {
        return ListGroupTemplate({
          level,
          title: field,
          value,
        });
      }

      if (Array.isArray(value) && value.length === 0) {
        return null;
      }

      if (typeof value === "object" && value !== null) {
        const childFields = renderFields(value, level + 1);
        if (childFields.filter((child) => child !== null).length > 0) {
          return ListGroupTemplate({
            level,
            title: field,
            value: childFields,
          });
        }
      }

      return null;
    });
  };

  const renderFindings = (findingsData) => {
    const sections = Object.keys(findingsData);
    return sections.map((section) => {
      const fields = findingsData[section];
      return (
        <Card key={section} className="card-content my-1">
          <Card.Header>{section.replace(/_/g, " ")}</Card.Header>
          <Card.Body>
            <ListGroup
              horizontal="lg"
              className="d-flex flex-wrap justify-content-center"
            >
              {renderFields(fields)}
            </ListGroup>
          </Card.Body>
        </Card>
      );
    });
  };

  return CardTemplate({
    title: record.findings_schema_name,
    className: "card-height",
    classNameBody: "card-content",
    children: renderFindings(findings),
  });
};

export default PatientRecord;
