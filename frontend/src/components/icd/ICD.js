import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import { RiSearchLine, RiStethoscopeLine } from "react-icons/ri";
import { apiFetch } from "../../api/apiFetch";
import { ICD11 } from "../../api/apiConfig";
import "./ICD.css";

export default function ICD() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) { setResults([]); return; }
    try {
      setLoading(true); setError("");
      const data = await apiFetch(`${ICD11}search/?q=${encodeURIComponent(query)}`);
      setResults(data.results || []);
    } catch { setError("ICD-11 search is temporarily unavailable."); setResults([]); }
    finally { setLoading(false); }
  };
  return <main className="icd-workspace"><header className="page-heading"><div><span className="eyebrow">Clinical terminology</span><h1>ICD-11 diagnostic search</h1><p>Find structured terms and codes for clinical documentation.</p></div></header><div className="icd-heading"><span><RiStethoscopeLine /></span><div><strong>Diagnosis terminology lookup</strong><p>Search by a diagnosis term or known code.</p></div></div><p className="icd-disclosure">Curated ICD-11 demonstration subset. This prototype does not claim full WHO catalogue synchronization.</p><Form className="icd-search-form" onSubmit={handleSearch}><Form.Control value={query} placeholder="Search malaria, hypertension, diabetes, headache" onChange={(event) => setQuery(event.target.value)} aria-label="Search diagnosis terms and codes" /><Button type="submit" disabled={loading}>{loading ? <Spinner size="sm" /> : <RiSearchLine />}{loading ? "Searching" : "Search"}</Button></Form>{error && <p className="text-danger" role="alert">{error}</p>}<div className="icd-results">{results.map((result) => <div className="icd-result-item" key={result.code}><code>{result.code}</code><div><strong>{result.title}</strong><span>{result.chapter}</span></div></div>)}{!loading && query && results.length === 0 && <p className="icd-empty-state">No matching diagnosis was found for "{query}".</p>}</div></main>;
}
