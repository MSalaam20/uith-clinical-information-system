import React, { useCallback, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Pagination from "react-bootstrap/Pagination";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { RiAddLine, RiAdminLine, RiKey2Line, RiRefreshLine, RiSearchLine, RiUserSettingsLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import CredentialModal from "../account/CredentialModal";
import "./AdminWorkspace.css";

const roles = [["AD", "Administrator"], ["DC", "Doctor"], ["NS", "Nurse"], ["RC", "Receptionist"], ["CO", "Coordinator"], ["US", "Unassigned"]];
const provisionableRoles = [["DC", "Doctor"], ["NS", "Nurse"], ["RC", "Receptionist"], ["CO", "Coordinator"]];
const emptyCreate = { username: "", email: "", first_name: "", last_name: "", phone_number: "", role: "DC", temporary_password: "" };

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createValues, setCreateValues] = useState(emptyCreate);
  const [createFields, setCreateFields] = useState({});
  const [creating, setCreating] = useState(false);
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await clinicalApi.listStaff({ page, search: appliedSearch, role, is_active: active, ordering: "username" });
      setStaff(response.items);
      setCount(response.count);
    } catch (requestError) {
      setError(apiError(requestError, "Staff accounts could not be loaded.").message);
    } finally {
      setLoading(false);
    }
  }, [active, appliedSearch, page, role]);

  useEffect(() => { load(); }, [load]);

  const updateMember = (updated) => {
    setStaff((current) => current.map((member) => member.id === updated.id ? updated : member));
    if (selected?.id === updated.id) setSelected(updated);
  };

  const changeRole = async (member, nextRole) => {
    if (nextRole === member.role || !window.confirm(`Change ${member.username}'s role?`)) return;
    try { updateMember(await clinicalApi.updateStaffRole(member.id, nextRole)); }
    catch (requestError) { setError(apiError(requestError, "The role could not be changed.").message); }
  };

  const changeStatus = async (member) => {
    const next = !member.is_active;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${member.username}?`)) return;
    try { updateMember(await clinicalApi.updateStaffStatus(member.id, next)); }
    catch (requestError) { setError(apiError(requestError, "The account status could not be changed.").message); }
  };

  const createStaff = async (event) => {
    event.preventDefault();
    setCreating(true);
    setCreateFields({});
    setError("");
    try {
      const payload = Object.fromEntries(Object.entries(createValues).filter(([, value]) => value !== ""));
      const response = await clinicalApi.createStaff(payload);
      setShowCreate(false);
      setCreateValues(emptyCreate);
      setCredential({ username: response.account.username, temporary_password: response.temporary_password });
      await load();
    } catch (requestError) {
      const parsed = apiError(requestError, "The staff account could not be created.");
      setCreateFields(parsed.fields);
      setError(parsed.message);
    } finally { setCreating(false); }
  };

  const resetTemporaryPassword = async (member) => {
    if (!window.confirm(`Issue a new temporary password for ${member.username}? Existing sessions will be invalidated.`)) return;
    try {
      const response = await clinicalApi.resetStaffTemporaryPassword(member.id);
      updateMember(response.account);
      setSelected(null);
      setCredential({ username: response.account.username, temporary_password: response.temporary_password });
    } catch (requestError) { setError(apiError(requestError, "A temporary password could not be issued.").message); }
  };

  const totalPages = Math.max(1, Math.ceil(count / 15));

  return (
    <main className="admin-workspace">
      <header className="admin-workspace-header"><div><span>Administration</span><h1>Staff management</h1><p>{count} approved staff profiles</p></div><div className="admin-header-actions"><Button onClick={() => { setError(""); setShowCreate(true); }}><RiAddLine /> Create staff account</Button><Button className="icon-command" variant="outline-primary" onClick={load} title="Refresh staff" aria-label="Refresh staff"><RiRefreshLine /></Button></div></header>
      <div className="admin-filter-bar"><div className="admin-search"><RiSearchLine /><Form.Control value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username or email" aria-label="Search staff" /></div><Form.Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} aria-label="Filter staff by role"><option value="">All roles</option>{roles.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Form.Select><Form.Select value={active} onChange={(event) => { setActive(event.target.value); setPage(1); }} aria-label="Filter staff by status"><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></Form.Select></div>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {loading ? <div className="admin-state"><Spinner animation="border" /><span>Loading staff accounts...</span></div> : staff.length === 0 ? <div className="admin-state"><RiUserSettingsLine /><strong>No staff accounts match these filters.</strong></div> : <div className="admin-table-wrap"><Table responsive hover className="admin-table"><thead><tr><th>Staff member</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Details</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td><strong>{member.first_name} {member.last_name}</strong></td><td>{member.username}</td><td>{member.email || "-"}</td><td><Form.Select size="sm" value={member.role} onChange={(event) => changeRole(member, event.target.value)} aria-label={`Role for ${member.username}`}>{roles.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Form.Select></td><td><Form.Check type="switch" id={`status-${member.id}`} checked={member.is_active} onChange={() => changeStatus(member)} label={member.is_active ? "Active" : "Inactive"} /></td><td><Button variant="link" className="icon-command" onClick={() => setSelected(member)} aria-label={`View ${member.username}`} title="View staff details"><RiAdminLine /></Button></td></tr>)}</tbody></Table></div>}
      <AdminPagination page={page} totalPages={totalPages} setPage={setPage} />

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} centered><Modal.Header closeButton><Modal.Title>Staff account</Modal.Title></Modal.Header><Modal.Body>{selected && <dl className="admin-detail-list"><div><dt>Name</dt><dd>{selected.first_name} {selected.last_name}</dd></div><div><dt>Username</dt><dd>{selected.username}</dd></div><div><dt>Email</dt><dd>{selected.email || "Not recorded"}</dd></div><div><dt>Phone</dt><dd>{selected.phone_number || "Not recorded"}</dd></div><div><dt>Department</dt><dd>{selected.department || "Not assigned"}</dd></div><div><dt>Role</dt><dd>{selected.role_display}</dd></div><div><dt>Status</dt><dd>{selected.is_active ? "Active" : "Inactive"}</dd></div><div><dt>Password state</dt><dd>{selected.must_change_password ? "Temporary password active" : "Permanent password set"}</dd></div></dl>}</Modal.Body><Modal.Footer><Button variant="outline-primary" onClick={() => resetTemporaryPassword(selected)}><RiKey2Line /> Issue temporary password</Button></Modal.Footer></Modal>

      <Modal show={showCreate} onHide={() => !creating && setShowCreate(false)} centered size="lg"><Form onSubmit={createStaff}><Modal.Header closeButton><Modal.Title>Create staff account</Modal.Title></Modal.Header><Modal.Body><p className="form-intro">Create an operational clinic account. Administrator access is available only through the protected bootstrap command.</p><div className="staff-create-grid"><CreateField label="First name" name="first_name" values={createValues} setValues={setCreateValues} error={createFields.first_name} /><CreateField label="Last name" name="last_name" values={createValues} setValues={setCreateValues} error={createFields.last_name} /><CreateField label="Username" name="username" values={createValues} setValues={setCreateValues} error={createFields.username} /><CreateField label="Email address" name="email" type="email" values={createValues} setValues={setCreateValues} error={createFields.email} /><CreateField label="Phone number" name="phone_number" values={createValues} setValues={setCreateValues} error={createFields.phone_number} required={false} /><Form.Group controlId="staff-role"><Form.Label>Clinic role</Form.Label><Form.Select value={createValues.role} onChange={(event) => setCreateValues({ ...createValues, role: event.target.value })}>{provisionableRoles.map(([code, label]) => <option value={code} key={code}>{label}</option>)}</Form.Select></Form.Group><Form.Group className="staff-create-wide" controlId="staff-temporary-password"><Form.Label>Temporary password <span>(optional)</span></Form.Label><Form.Control type="password" value={createValues.temporary_password} onChange={(event) => setCreateValues({ ...createValues, temporary_password: event.target.value })} isInvalid={Boolean(createFields.temporary_password)} autoComplete="new-password" /><Form.Text>Leave blank to generate a cryptographically secure password.</Form.Text><Form.Control.Feedback type="invalid">{createFields.temporary_password}</Form.Control.Feedback></Form.Group></div></Modal.Body><Modal.Footer><Button variant="outline-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button><Button type="submit" disabled={creating}>{creating ? <Spinner size="sm" /> : <RiAddLine />}{creating ? "Creating account" : "Create account"}</Button></Modal.Footer></Form></Modal>
      <CredentialModal credential={credential} onClose={() => setCredential(null)} />
    </main>
  );
}

function CreateField({ label, name, type = "text", values, setValues, error, required = true }) {
  return <Form.Group controlId={`staff-${name}`}><Form.Label>{label}</Form.Label><Form.Control type={type} value={values[name]} onChange={(event) => setValues({ ...values, [name]: event.target.value })} isInvalid={Boolean(error)} required={required} /><Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback></Form.Group>;
}

export function AdminPagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null;
  return <Pagination className="admin-pagination"><Pagination.Prev disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} /><Pagination.Item active>{page} of {totalPages}</Pagination.Item><Pagination.Next disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} /></Pagination>;
}
