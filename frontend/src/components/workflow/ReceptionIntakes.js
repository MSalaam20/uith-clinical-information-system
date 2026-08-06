import React, { useEffect, useState } from "react";
import { apiError, clinicalApi } from "../../api/clinicalApi";
import { IntakeCard, WorkflowHeader, WorkflowState } from "./WorkflowPrimitives";
import "./Workflow.css";

export default function ReceptionIntakes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setItems((await clinicalApi.listIntakes()).items); }
    catch (requestError) { setError(apiError(requestError, "Today's intakes could not be loaded.").message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  return <main className="workflow-workspace"><WorkflowHeader eyebrow="Reception portal" title="Today's clinic intakes" description="Monitor the handoff to nursing and the resulting appointment status." onRefresh={load} refreshing={loading} /><WorkflowState loading={loading} error={error} empty={!items.length}><div className="intake-card-grid">{items.map((intake) => <IntakeCard key={intake.id} intake={intake} />)}</div></WorkflowState></main>;
}
