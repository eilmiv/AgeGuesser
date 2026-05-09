import React, { useState, useEffect } from "react";
import ConfigList from "./components/ConfigList";
import ConfigForm from "./components/ConfigForm";
import RunView from "./components/RunView";
import SummaryView from "./components/SummaryView";
import AdminView from "./components/AdminView";
import { loadConfigs, upsertConfig, deleteConfig, appendRunHistory } from "./utils/storage";
import "./App.css";

/**
 * Top-level view names:
 *   "list"    – show all configurations
 *   "form"    – create / edit a configuration
 *   "run"     – actively running a configuration
 *   "summary" – show the summary after a completed run
 *   "admin"   – curate custom datasets
 */
export default function App() {
  const [view, setView] = useState("list");
  const [configs, setConfigs] = useState([]);
  const [editingConfig, setEditingConfig] = useState(null);
  const [activeConfig, setActiveConfig] = useState(null);
  const [runResults, setRunResults] = useState([]);

  // Load configs from localStorage on mount
  useEffect(() => {
    setConfigs(loadConfigs());
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  function handleNewConfig() {
    setEditingConfig(null);
    setView("form");
  }

  function handleEditConfig(config) {
    setEditingConfig(config);
    setView("form");
  }

  function handleSaveConfig(config) {
    upsertConfig(config);
    setConfigs(loadConfigs());
    setView("list");
  }

  function handleDeleteConfig(id) {
    deleteConfig(id);
    setConfigs(loadConfigs());
  }

  function handleRunConfig(config) {
    setActiveConfig(config);
    setRunResults([]);
    setView("run");
  }

  function handleRunComplete(results) {
    if (results.length > 0) {
      const avgDistance =
        results.reduce((sum, r) => sum + r.distance, 0) / results.length;
      appendRunHistory(activeConfig.id, parseFloat(avgDistance.toFixed(2)));
      setConfigs(loadConfigs());
    }
    setRunResults(results);
    setView("summary");
  }

  function handleBackToList() {
    setView("list");
    setActiveConfig(null);
    setRunResults([]);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title" onClick={handleBackToList} title="Back to configurations">
          🧑 AgeGuesser
        </h1>
        {view !== "admin" && (
          <button className="btn btn-ghost" onClick={() => setView("admin")}>
            Admin
          </button>
        )}
        {view !== "list" && view !== "form" && (
          <button className="btn btn-ghost" onClick={handleBackToList}>
            ← Back
          </button>
        )}
      </header>

      <main className="app-main">
        {view === "list" && (
          <ConfigList
            configs={configs}
            onNew={handleNewConfig}
            onEdit={handleEditConfig}
            onDelete={handleDeleteConfig}
            onRun={handleRunConfig}
          />
        )}

        {view === "form" && (
          <ConfigForm
            initial={editingConfig}
            onSave={handleSaveConfig}
            onCancel={() => setView("list")}
          />
        )}

        {view === "run" && activeConfig && (
          <RunView
            config={activeConfig}
            onComplete={handleRunComplete}
          />
        )}

        {view === "summary" && (
          <SummaryView
            results={runResults}
            config={activeConfig}
            onDone={handleBackToList}
            onRunAgain={() => handleRunConfig(activeConfig)}
          />
        )}

        {view === "admin" && (
          <AdminView onBack={handleBackToList} />
        )}
      </main>
    </div>
  );
}
