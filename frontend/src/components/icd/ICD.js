import React, { useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import { RiSearchLine, RiStethoscopeLine } from "react-icons/ri";
import { apiFetch } from "../../api/apiFetch";
import { ICD11 } from "../../api/apiConfig";
import "./ICD.css";

const ICD = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (event) => {
    event.preventDefault();

    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await apiFetch(`${ICD11}search/?q=${encodeURIComponent(query)}`);
      setResults(data.results || []);
    } catch {
      setError("ICD-11 search is temporarily unavailable.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="m-3 icd-search-card">
      <Card.Body>
        <div className="icd-heading">
          <span>
            <RiStethoscopeLine />
          </span>
          <div>
            <Card.Title>ICD-11 Diagnostic Search</Card.Title>
            <Card.Text>
              Search diagnosis terms and codes for structured clinical records.
            </Card.Text>
          </div>
        </div>

        <Form className="icd-search-form" onSubmit={handleSearch}>
          <Form.Control
            value={query}
            placeholder="Search malaria, hypertension, diabetes, headache..."
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" disabled={loading}>
            <RiSearchLine />
            {loading ? "Searching..." : "Search"}
          </Button>
        </Form>
        {error && <p className="text-danger" role="alert">{error}</p>}

        <div className="icd-results">
          {results.map((result) => (
            <div className="icd-result-item" key={result.code}>
              <code>{result.code}</code>
              <div>
                <strong>{result.title}</strong>
                <span>{result.chapter}</span>
              </div>
            </div>
          ))}

          {!loading && query && results.length === 0 && (
            <p className="icd-empty-state">
              No matching ICD-11 diagnosis found for "{query}".
            </p>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default ICD;
