import React from "react";
import "./SummaryView.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

function distanceColor(distance) {
  if (distance <= 2) return "#22c55e";
  if (distance <= 5) return "#84cc16";
  if (distance <= 10) return "#f97316";
  return "#ef4444";
}

function distanceLabel(distance) {
  if (distance <= 2) return "Excellent 🎯";
  if (distance <= 5) return "Good 👍";
  if (distance <= 10) return "Close 😐";
  return "Far off 😬";
}

export default function SummaryView({ results, config, onDone, onRunAgain }) {
  if (!results || results.length === 0) {
    return (
      <div className="summary-view">
        <div className="card">
          <p>No results to display.</p>
          <button className="btn btn-primary" onClick={onDone}>
            Back
          </button>
        </div>
      </div>
    );
  }

  const avgDistance = results.reduce((s, r) => s + r.distance, 0) / results.length;
  const best = Math.min(...results.map((r) => r.distance));
  const worst = Math.max(...results.map((r) => r.distance));
  const perfect = results.filter((r) => r.distance === 0).length;

  return (
    <div className="summary-view">
      {/* Stats card */}
      <div className="summary-stats card">
        <h2>Run Complete!</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{avgDistance.toFixed(1)}</span>
            <span className="stat-label">Avg distance (yrs)</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{best}</span>
            <span className="stat-label">Best guess</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{worst}</span>
            <span className="stat-label">Worst guess</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{perfect}</span>
            <span className="stat-label">Perfect guesses</span>
          </div>
        </div>
        <div className="summary-actions">
          <button className="btn btn-outline" onClick={onDone}>
            ← Back to Configurations
          </button>
          {config && (
            <button className="btn btn-primary" onClick={onRunAgain}>
              ▶ Run Again
            </button>
          )}
        </div>
      </div>

      {/* Image grid */}
      <h3 className="results-heading">Your Guesses</h3>
      <div className="results-grid">
        {results.map((result, idx) => {
          const { image, guess, distance } = result;
          const color = distanceColor(distance);
          return (
            <div key={idx} className="result-card card" style={{ borderTop: `4px solid ${color}` }}>
              <div className="result-image-wrapper">
                <img
                  className="result-image"
                  src={`${API_BASE}/api/image/${image.dataset}/${image.filename}`}
                  alt={`Face ${idx + 1}`}
                  loading="lazy"
                  draggable={false}
                />
              </div>
              <div className="result-info">
                <div className="result-row">
                  <span className="result-key">Actual:</span>
                  <span className="result-val" style={{ color: "#22c55e", fontWeight: 700 }}>
                    {image.age} yrs
                  </span>
                </div>
                <div className="result-row">
                  <span className="result-key">Guess:</span>
                  <span className="result-val" style={{ color, fontWeight: 700 }}>
                    {guess} yrs
                  </span>
                </div>
                <div className="result-badge" style={{ background: color }}>
                  {distanceLabel(distance)}
                  {distance > 0 && (
                    <span className="result-badge-detail">
                      {" "}off by {distance} yr{distance !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
