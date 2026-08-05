import React, { useCallback, useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Pagination from "react-bootstrap/Pagination";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { RiAdminLine, RiRefreshLine, RiSearchLine, RiUserSettingsLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import "./AdminWorkspace.css";

const roles = [
  ["AD", "Administrator"], ["DC", "Doctor"], ["NS", "Nurse"],
  ["RC", "Receptionist"], ["CO", "Coordinator"], ["US", "Unassigned"],
];

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

  const changeRole = async (member, nextRole) => {
    if (nextRole === member.role || !window.confirm(`Change ${member.username}'s role?`)) return;
    try {
      const updated = await clinicalApi.updateStaffRole(member.id, nextRole);
      setStaff((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (requestError) {
      setError(apiError(requestError, "The role could not be changed.").message);
    }
  };

  const changeStatus = async (member) => {
    const next = !member.is_active;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${member.username}?`)) return;
    try {
      const updated = await clinicalApi.updateStaffStatus(member.id, next);
      setStaff((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (requestError) {
      setError(apiError(requestError, "The account status could not be changed.").message);
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / 15));

  return (
    <main className="admin-workspace">
      <header className="admin-workspace-header"><div><span>Administration</span><h1>Staff management</h1><p>{count} approved staff profiles</p></div><Button className="icon-command" variant="outline-primary" onClick={load} title="Refresh staff" aria-label="Refresh staff"><RiRefreshLine /></Button></header>
      <div className="admin-filter-bar">
        <div className="admin-search"><RiSearchLine /><Form.Control value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, username or email" aria-label="Search staff" /></div>
        <Form.Select value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} aria-label="Filter staff by role"><option value="">All roles</option>{roles.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Form.Select>
        <Form.Select value={active} onChange={(event) => { setActive(event.target.value); setPage(1); }} aria-label="Filter staff by status"><option value="">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></Form.Select>
      </div>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {loading ? <div className="admin-state"><Spinner animation="border" /><span>Loading staff accounts...</span></div> : staff.length === 0 ? <div className="admin-state"><RiUserSettingsLine /><strong>No staff accounts match these filters.</strong></div> : (
        <div className="admin-table-wrap"><Table responsive hover className="admin-table"><thead><tr><th>Staff member</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Details</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td><strong>{member.first_name} {member.last_name}</strong></td><td>{member.username}</td><td>{member.email || "-"}</td><td><Form.Select size="sm" value={member.role} onChange={(event) => changeRole(member, event.target.value)} aria-label={`Role for ${member.username}`}>{roles.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</Form.Select></td><td><Form.Check type="switch" id={`status-${member.id}`} checked={member.is_active} onChange={() => changeStatus(member)} label={member.is_active ? "Active" : "Inactive"} /></td><td><Button variant="link" className="icon-command" onClick={() => setSelected(member)} aria-label={`View ${member.username}`} title="View staff details"><RiAdminLine /></Button></td></tr>)}</tbody></Table></div>
      )}
      <AdminPagination page={page} totalPages={totalPages} setPage={setPage} />
      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} centered><Modal.Header closeButton><Modal.Title>Staff account</Modal.Title></Modal.Header><Modal.Body>{selected && <dl className="admin-detail-list"><div><dt>Name</dt><dd>{selected.first_name} {selected.last_name}</dd></div><div><dt>Username</dt><dd>{selected.username}</dd></div><div><dt>Email</dt><dd>{selected.email || "Not recorded"}</dd></div><div><dt>Role</dt><dd>{selected.role_display}</dd></div><div><dt>Status</dt><dd>{selected.is_active ? "Active" : "Inactive"}</dd></div></dl>}</Modal.Body></Modal>
    </main>
  );
}

export function AdminPagination({ page, totalPages, setPage }) {
  if (totalPages <= 1) return null;
  return <Pagination className="admin-pagination"><Pagination.Prev disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} /><Pagination.Item active>{page} of {totalPages}</Pagination.Item><Pagination.Next disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} /></Pagination>;
}
