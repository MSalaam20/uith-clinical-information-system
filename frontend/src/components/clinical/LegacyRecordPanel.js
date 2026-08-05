import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import validator from "@rjsf/validator-ajv8";
import JsonSchemaForm from "@rjsf/core";
import { RiAddLine, RiFileList3Line } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";

export default function LegacyRecordPanel({ patient, items, role, onSaved }) {
  const canCreate = ["AD", "DC"].includes(role);
  const [schemas, setSchemas] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [schema, setSchema] = useState(null);
  const [formData, setFormData] = useState({});
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canCreate) return;
    clinicalApi.listSchemas().then((response) => setSchemas(response.items)).catch(() => setError("Custom record schemas could not be loaded."));
  }, [canCreate]);

  const selectSchema = async (schemaId) => {
    if (!schemaId) { setSchema(null); setTemplates([]); return; }
    setLoading(true);
    setError("");
    try {
      const [detail, templateList] = await Promise.all([
        clinicalApi.getSchema(schemaId),
        clinicalApi.listTemplates(schemaId),
      ]);
      setSchema(detail);
      setTemplates(templateList.items);
      setFormData({});
    } catch (requestError) {
      setError(apiError(requestError, "The custom record schema could not be loaded.").message);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = async (templateId) => {
    if (!templateId) { setFormData({}); return; }
    try {
      const template = await clinicalApi.getTemplate(templateId);
      setFormData(template.findings || {});
    } catch (requestError) {
      setError(apiError(requestError, "The record template could not be loaded.").message);
    }
  };

  const submit = async ({ formData: values }) => {
    setSaving(true);
    setError("");
    try {
      await clinicalApi.createLegacyRecord({
        patient_id: patient.id,
        findings_schema: schema.id,
        findings: values,
      });
      setShow(false);
      setSchema(null);
      setFormData({});
      await onSaved();
    } catch (requestError) {
      setError(apiError(requestError, "The custom clinical record could not be saved.").message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-record-panel">
      {canCreate && <div className="section-toolbar"><div><span className="section-label">Schema-driven history</span><strong>{items.length} custom records</strong></div><Button size="sm" onClick={() => setShow(true)}><RiAddLine /> Add custom record</Button></div>}
      {!items.length ? <div className="clinical-empty-state"><RiFileList3Line /><strong>No custom records</strong><span>No legacy or schema-driven record is available.</span></div> : <div className="legacy-records">{items.map((record) => <details key={record.id}><summary><span>{record.findings_schema_name || "Custom clinical record"}</span><time>{new Date(record.created_at).toLocaleString()}</time></summary><pre>{JSON.stringify(record.findings, null, 2)}</pre></details>)}</div>}
      <Modal show={show} onHide={() => setShow(false)} size="lg" centered><Modal.Header closeButton><Modal.Title>Add custom clinical record</Modal.Title></Modal.Header><Modal.Body>
        {error && <div className="clinical-form-error" role="alert">{error}</div>}
        <div className="clinical-form-grid mb-3"><Form.Group controlId="legacy-schema"><Form.Label>Record schema</Form.Label><Form.Select onChange={(event) => selectSchema(event.target.value)} defaultValue=""><option value="">Select schema</option>{schemas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Form.Select></Form.Group><Form.Group controlId="legacy-template"><Form.Label>Template</Form.Label><Form.Select onChange={(event) => selectTemplate(event.target.value)} defaultValue="" disabled={!schema}><option value="">Blank record</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.template_name}</option>)}</Form.Select></Form.Group></div>
        {loading && <div className="admin-state"><Spinner animation="border" /><span>Loading schema...</span></div>}
        {schema && <JsonSchemaForm schema={schema.schema} uiSchema={schema.ui_schema || {}} validator={validator} formData={formData} onChange={(event) => setFormData(event.formData)} onSubmit={submit} disabled={saving}><div className="clinical-form-actions"><Button type="button" variant="outline-secondary" onClick={() => setShow(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Spinner size="sm" />} Save custom record</Button></div></JsonSchemaForm>}
      </Modal.Body></Modal>
    </div>
  );
}
