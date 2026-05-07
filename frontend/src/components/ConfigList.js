import React, { useState } from "react";
import HistoryChart from "./HistoryChart";
import useImageCount from "../utils/useImageCount";
import "./ConfigList.css";

const GENDER_LABELS = { 0: "Male", 1: "Female" };
const RACE_LABELS = { 0: "White", 1: "Black", 2: "Asian", 3: "Indian", 4: "Other" };
const RESOLUTION_LABELS = { low: "Low", medium: "Medium", high: "High" };

export default function ConfigList({ configs, onNew, onEdit, onDelete, onRun }) {
  const [expandedId, setExpandedId] = useState(null);

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleDelete(e, id) {
    e.stopPropagation();
    if (window.confirm("Delete this configuration?")) {
      onDelete(id);
    }
  }

  return (
    <div className="config-list">
      <div className="config-list-header">
        <h2>Configurations</h2>
        <button className="btn btn-primary" onClick={onNew}>
          + New Configuration
        </button>
      </div>

      {configs.length === 0 && (
        <div className="empty-state card">
          <p>No configurations yet. Create one to start practicing!</p>
        </div>
      )}

      {configs.map((config) => (
        <div key={config.id} className="config-card card">
          <div
            className="config-card-header"
            onClick={() => toggleExpand(config.id)}
          >
            <div className="config-card-title">
              <span className="config-name">{config.name}</span>
              <span className="config-meta">
                Ages {config.minAge}–{config.maxAge} · {config.facesPerRun} faces
              </span>
            </div>
            <div className="config-card-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); onRun(config); }}
                title="Start a run"
              >
                ▶ Run
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={(e) => { e.stopPropagation(); onEdit(config); }}
                title="Edit configuration"
              >
                ✎ Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => handleDelete(e, config.id)}
                title="Delete configuration"
              >
                🗑
              </button>
              <span className="expand-arrow">
                {expandedId === config.id ? "▲" : "▼"}
              </span>
            </div>
          </div>

          {expandedId === config.id && (
            <ConfigCardBody config={config} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Expanded body of a single config card, including image count. */
function ConfigCardBody({ config }) {
  const { count, loading, error } = useImageCount(config, { debounceMs: 150 });

  const resolutions = config.resolutions ?? ["low", "medium", "high"];

  return (
    <div className="config-card-body">
      <div className="config-details">
        <div className="detail-row">
          <span className="detail-label">Genders:</span>
          <span>{config.genders.map((g) => GENDER_LABELS[g]).join(", ")}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Races:</span>
          <span>{config.races.map((r) => RACE_LABELS[r]).join(", ")}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Resolutions:</span>
          <span>{resolutions.map((r) => RESOLUTION_LABELS[r] ?? r).join(", ")}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Datasets:</span>
          <span>{config.datasets.join(", ")}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Images:</span>
          <span className="image-count">
            {loading && <span className="count-loading">Loading…</span>}
            {!loading && error && <span className="count-error">unavailable</span>}
            {!loading && !error && (
              <span className={count === 0 ? "count-zero" : "count-value"}>
                {count} available
              </span>
            )}
          </span>
        </div>
      </div>

      {config.history && config.history.length > 0 ? (
        <div className="config-history">
          <h4>Learning Progress</h4>
          <HistoryChart history={config.history} />
        </div>
      ) : (
        <p className="no-history">No runs yet – start your first run above!</p>
      )}
    </div>
  );
}
