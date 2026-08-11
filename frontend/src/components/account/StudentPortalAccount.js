import React, { useCallback, useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import { RiAddLine, RiKey2Line, RiShieldUserLine, RiUserSettingsLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import CredentialModal from "./CredentialModal";
import "./StudentPortalAccount.css";

export default function StudentPortalAccount({ patient, role }) {
  const canManage = ["AD", "RC"].includes(role);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const [credential, setCredential] = useState(null);
  const [values, setValues] = useState({ email: "", first_name: "", last_name: "", temporary_password: "" });

  const load = useCallback(async () => {
    if (!canManage || !patient?.id) return;
    setLoading(true);
    try { setAccount(await clinicalApi.getPatientPortalAccount(patient.id)); }
    catch (requestError) { setError(apiError(requestError, "Portal account status could not be loaded.").message); }
    finally { setLoading(false); }
  }, [canManage, patient?.id]);

  useEffect(() => {
    setValues({
      email: patient?.email || "",
      first_name: patient?.first_name || "",
      last_name: patient?.last_name || "",
      temporary_password: "",
    });
    setAccount(null);
    setError("");
    load();
  }, [load, patient]);

  if (!canManage) return null;

  const createAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFields({});
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ""));
      const response = await clinicalApi.createPatientPortalAccount(patient.id, payload);
      setAccount(response.account);
      setShow(false);
      setCredential({ username: response.account.username, temporary_password: response.temporary_password });
    } catch (requestError) {
      const parsed = apiError(requestError, "The student portal account could not be created.");
      setFields(parsed.fields);
      setError(parsed.message);
    } finally { setSaving(false); }
  };

  const resetPassword = async () => {
    if (!window.confirm(`Issue a new temporary password for ${account.username}?`)) return;
    setSaving(true);
    try {
      const response = await clinicalApi.resetPatientTemporaryPassword(patient.id);
      setAccount(response.account);
      setShow(false);
      setCredential({ username: response.account.username, temporary_password: response.temporary_password });
    } catch (requestError) { setError(apiError(requestError, "The temporary password could not be issued.").message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async () => {
    const next = !account.is_active;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${account.username}?`)) return;
    setSaving(true);
    try { setAccount(await clinicalApi.updatePatientPortalStatus(patient.id, next)); }
    catch (requestError) { setError(apiError(requestError, "The account status could not be changed.").message); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="student-account-bar">
        <div><RiShieldUserLine /><span><strong>Student portal account</strong><small>{loading ? "Checking account status" : account?.linked ? `${account.username} | ${account.is_active ? "Active" : "Inactive"}` : "No portal account is linked"}</small></span></div>
        <Button size="sm" variant={account?.linked ? "outline-primary" : "primary"} onClick={() => setShow(true)} disabled={loading}>{account?.linked ? <RiUserSettingsLine /> : <RiAddLine />}{account?.linked ? "Manage account" : "Create student account"}</Button>
      </div>
      {error && !show && <Alert variant="danger" className="student-account-error">{error}</Alert>}

      <Modal show={show} onHide={() => !saving && setShow(false)} centered><Form onSubmit={createAccount}><Modal.Header closeButton><Modal.Title>{account?.linked ? "Student portal account" : "Create student portal account"}</Modal.Title></Modal.Header><Modal.Body>{error && <Alert variant="danger">{error}</Alert>}{account?.linked ? <dl className="student-account-detail"><div><dt>Linked patient</dt><dd>{patient.first_name} {patient.last_name}</dd></div><div><dt>Matriculation number</dt><dd>{account.username}</dd></div><div><dt>Email</dt><dd>{account.email || "Not recorded"}</dd></div><div><dt>Status</dt><dd>{account.is_active ? "Active" : "Inactive"}</dd></div><div><dt>Password state</dt><dd>{account.must_change_password ? "Temporary password active" : "Permanent password set"}</dd></div><div><dt>Last login</dt><dd>{account.last_login ? new Date(account.last_login).toLocaleString() : "Never"}</dd></div></dl> : <><p className="student-account-copy">This creates a patient-role account linked only to this clinic record. The student must change the temporary password after first login.</p><Form.Group className="mb-3" controlId="student-matric-number"><Form.Label>Matriculation number (login username)</Form.Label><Form.Control value={patient.matric_number || ""} readOnly /><Form.Text>Use this exact matriculation number to sign in.</Form.Text>{fields.matric_number && <div className="invalid-feedback d-block">{fields.matric_number}</div>}</Form.Group><PortalField label="Email address" name="email" type="email" values={values} setValues={setValues} error={fields.email} /><div className="student-name-grid"><PortalField label="First name" name="first_name" values={values} setValues={setValues} error={fields.first_name} /><PortalField label="Last name" name="last_name" values={values} setValues={setValues} error={fields.last_name} /></div><PortalField label="Temporary password (optional)" name="temporary_password" type="password" values={values} setValues={setValues} error={fields.temporary_password} required={false} help="Leave blank to generate a secure temporary password." /></>}</Modal.Body><Modal.Footer>{account?.linked ? <><Button variant="outline-secondary" onClick={toggleStatus} disabled={saving}>{account.is_active ? "Deactivate" : "Activate"}</Button><Button variant="outline-primary" onClick={resetPassword} disabled={saving}><RiKey2Line /> Issue temporary password</Button></> : <><Button variant="outline-secondary" onClick={() => setShow(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? <Spinner size="sm" /> : <RiAddLine />}{saving ? "Creating" : "Create linked account"}</Button></>}</Modal.Footer></Form></Modal>
      <CredentialModal credential={credential} onClose={() => setCredential(null)} />
    </>
  );
}

function PortalField({ label, name, type = "text", values, setValues, error, required = true, help }) {
  return <Form.Group className="mb-3" controlId={`student-${name}`}><Form.Label>{label}</Form.Label><Form.Control type={type} value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} isInvalid={Boolean(error)} required={required} autoComplete={type === "password" ? "new-password" : undefined} />{help && <Form.Text>{help}</Form.Text>}<Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback></Form.Group>;
}
