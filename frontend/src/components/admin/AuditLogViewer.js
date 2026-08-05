import React, { useCallback, useEffect, useState } from "react";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import Spinner from "react-bootstrap/Spinner";
import Table from "react-bootstrap/Table";
import { RiFileSearchLine, RiRefreshLine, RiSearchLine } from "react-icons/ri";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { AdminPagination } from "./StaffManagement";
import "./AdminWorkspace.css";

const sensitiveKeys = ["password", "token", "access", "refresh", "secret", "authorization"];
const isSensitiveKey = (key) => sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive));
const safeMetadata = (value) => {
  if (Array.isArray(value)) return value.map(safeMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isSensitiveKey(key)).map(([key, item]) => [key, safeMetadata(item)]));
};

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", user: "", action: "", resource_type: "", success: "", date_after: "", date_before: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await clinicalApi.listAuditLogs({ page, ordering: "-timestamp", ...filters });
      setLogs(response.items);
      setCount(response.count);
    } catch (requestError) {
      setError(apiError(requestError, "Audit logs could not be loaded.").message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { clinicalApi.listStaff({ page_size: 100, ordering: "username" }).then((response) => setStaff(response.items)).catch(() => setStaff([])); }, []);
  const change = (event) => { setFilters({ ...filters, [event.target.name]: event.target.value }); setPage(1); };
  const totalPages = Math.max(1, Math.ceil(count / 15));

  return (
    <main className="admin-workspace audit-workspace">
      <header className="admin-workspace-header"><div><span>Security oversight</span><h1>Audit log</h1><p>{count} immutable audit entries</p></div><Button className="icon-command" variant="outline-primary" onClick={load} title="Refresh audit log" aria-label="Refresh audit log"><RiRefreshLine /></Button></header>
      <div className="audit-filter-grid">
        <div className="admin-search"><RiSearchLine /><Form.Control name="search" value={filters.search} onChange={change} placeholder="Search user, action or description" aria-label="Search audit logs" /></div>
        <Form.Select name="user" value={filters.user} onChange={change} aria-label="Filter audit logs by user"><option value="">All users</option>{staff.map((member) => <option value={member.id} key={member.id}>{member.username}</option>)}</Form.Select>
        <Form.Control name="action" value={filters.action} onChange={change} placeholder="Action" aria-label="Filter by action" />
        <Form.Control name="resource_type" value={filters.resource_type} onChange={change} placeholder="Resource type" aria-label="Filter by resource type" />
        <Form.Select name="success" value={filters.success} onChange={change} aria-label="Filter by result"><option value="">All results</option><option value="true">Successful</option><option value="false">Failed</option></Form.Select>
        <Form.Control type="date" name="date_after" value={filters.date_after} onChange={change} aria-label="Audit start date" />
        <Form.Control type="date" name="date_before" value={filters.date_before} onChange={change} aria-label="Audit end date" />
      </div>
      {error && <div className="admin-error" role="alert">{error}</div>}
      {loading ? <div className="admin-state"><Spinner animation="border" /><span>Loading audit events...</span></div> : logs.length === 0 ? <div className="admin-state"><RiFileSearchLine /><strong>No audit events match these filters.</strong></div> : (
        <div className="admin-table-wrap"><Table responsive hover className="admin-table audit-table"><thead><tr><th>Date/time</th><th>User</th><th>Action</th><th>Resource</th><th>Description</th><th>Method/path</th><th>IP address</th><th>Result</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} onClick={() => setSelected(log)} tabIndex="0"><td>{new Date(log.timestamp).toLocaleString()}</td><td>{log.username || "System"}</td><td>{log.action}</td><td>{log.resource_type}{log.resource_id ? ` #${log.resource_id}` : ""}</td><td>{log.description || "-"}</td><td>{log.request_method || "-"} {log.request_path}</td><td>{log.ip_address || "-"}</td><td><Badge bg={log.success ? "success" : "danger"}>{log.success ? "Success" : "Failed"}</Badge></td></tr>)}</tbody></Table></div>
      )}
      <AdminPagination page={page} totalPages={totalPages} setPage={setPage} />
      <Modal show={Boolean(selected)} onHide={() => setSelected(null)} size="lg" centered><Modal.Header closeButton><Modal.Title>Audit event details</Modal.Title></Modal.Header><Modal.Body>{selected && <><dl className="admin-detail-list"><div><dt>Timestamp</dt><dd>{new Date(selected.timestamp).toLocaleString()}</dd></div><div><dt>User</dt><dd>{selected.username || "System"}</dd></div><div><dt>Action</dt><dd>{selected.action}</dd></div><div><dt>Resource</dt><dd>{selected.resource_type} {selected.resource_id}</dd></div><div><dt>Request</dt><dd>{selected.request_method} {selected.request_path}</dd></div><div><dt>Result</dt><dd>{selected.success ? "Success" : "Failed"}</dd></div></dl><h2 className="metadata-title">Safe metadata</h2><pre className="audit-metadata">{JSON.stringify(safeMetadata(selected.metadata || {}), null, 2)}</pre></>}</Modal.Body></Modal>
    </main>
  );
}
