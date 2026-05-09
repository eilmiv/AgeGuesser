import React, { useEffect, useMemo, useState } from "react";
import "./AdminView.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const LAST_METADATA_KEY = "ageguesser_admin_last_metadata";

const DEFAULT_METADATA = {
  gender: "0",
  race: "0",
  ageMode: "years",
  age: "",
  dob: "",
  pictureDate: "",
  yearsOldAtUpload: "",
};

function readLastMetadata() {
  try {
    const raw = localStorage.getItem(LAST_METADATA_KEY);
    if (!raw) return DEFAULT_METADATA;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_METADATA, ...parsed };
  } catch {
    return DEFAULT_METADATA;
  }
}

function persistLastMetadata(metadata) {
  localStorage.setItem(LAST_METADATA_KEY, JSON.stringify(metadata));
}

export default function AdminView({ onBack }) {
  const [status, setStatus] = useState({ loading: true, loggedIn: false, username: null });
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState("");
  const [previewImages, setPreviewImages] = useState([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState(() => ({ ...readLastMetadata(), dataset: "" }));
  const [selectedFile, setSelectedFile] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(form.dataset.trim() && selectedFile);
  }, [form.dataset, selectedFile]);

  async function refreshStatus() {
    const res = await fetch(`${API_BASE}/api/admin/status`, { credentials: "include" });
    const payload = await res.json();
    setStatus({
      loading: false,
      loggedIn: payload.logged_in,
      username: payload.username,
    });
  }

  async function loadDatasets() {
    const res = await fetch(`${API_BASE}/api/admin/datasets`, {
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error("Could not load datasets");
    }
    const payload = await res.json();
    setDatasets(payload.datasets || []);
    const defaultDataset = (payload.datasets && payload.datasets[0] && payload.datasets[0].name) || "";
    setSelectedDataset((prev) => prev || defaultDataset);
    setForm((prev) => ({ ...prev, dataset: prev.dataset || defaultDataset }));
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshStatus();
      } catch {
        setStatus({ loading: false, loggedIn: false, username: null });
      }
    })();
  }, []);

  useEffect(() => {
    if (!status.loggedIn) return;
    loadDatasets().catch(() => {});
  }, [status.loggedIn]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setAuthError(payload.error || "Login failed");
      return;
    }
    setCredentials({ username: "", password: "" });
    await refreshStatus();
  }

  async function handleLogout() {
    await fetch(`${API_BASE}/api/admin/logout`, {
      method: "POST",
      credentials: "include",
    });
    setStatus({ loading: false, loggedIn: false, username: null });
    setDatasets([]);
    setPreviewImages([]);
  }

  async function handlePreview(datasetName) {
    setSelectedDataset(datasetName);
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/datasets/${datasetName}/preview?limit=24`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Preview unavailable");
      const payload = await res.json();
      setPreviewImages(payload.images || []);
    } catch {
      setPreviewImages([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
          setSubmitMessage("Clipboard image selected");
        }
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError("");
    setSubmitMessage("");

    const payload = new FormData();
    payload.append("image", selectedFile);
    payload.append("age_mode", form.ageMode);
    payload.append("gender", form.gender);
    payload.append("race", form.race);
    if (form.ageMode === "years") {
      payload.append("age", form.age);
    } else if (form.ageMode === "dob_taken") {
      payload.append("dob", form.dob);
      payload.append("picture_date", form.pictureDate);
    } else {
      payload.append("dob", form.dob);
      payload.append("years_old_at_upload", form.yearsOldAtUpload);
    }

    const datasetName = form.dataset.trim();
    const res = await fetch(`${API_BASE}/api/admin/datasets/${datasetName}/add-image`, {
      method: "POST",
      credentials: "include",
      body: payload,
    });
    if (!res.ok) {
      const response = await res.json().catch(() => ({}));
      setSubmitError(response.error || "Upload failed");
      return;
    }

    const metadataToRemember = {
      gender: form.gender,
      race: form.race,
      ageMode: form.ageMode,
      age: form.age,
      dob: form.dob,
      pictureDate: form.pictureDate,
      yearsOldAtUpload: form.yearsOldAtUpload,
    };
    persistLastMetadata(metadataToRemember);
    setSelectedFile(null);
    setSubmitMessage("Image added");
    await loadDatasets();
    await handlePreview(datasetName);
  }

  if (status.loading) {
    return (
      <div className="admin-view card">
        <p>Loading admin status…</p>
      </div>
    );
  }

  if (!status.loggedIn) {
    return (
      <div className="admin-view card">
        <h2>Admin login</h2>
        <form className="admin-login-form" onSubmit={handleLogin}>
          <label>
            Username
            <input
              value={credentials.username}
              onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>
          {authError && <p className="admin-error">{authError}</p>}
          <div className="admin-actions">
            <button type="button" className="btn btn-outline" onClick={onBack}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Log in
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-view">
      <div className="card admin-topbar">
        <strong>Logged in as {status.username}</strong>
        <div className="admin-actions">
          <button className="btn btn-outline" onClick={onBack}>Back</button>
          <button className="btn btn-danger" onClick={handleLogout}>Log out</button>
        </div>
      </div>

      <div className="card admin-section">
        <h3>Datasets</h3>
        <ul className="dataset-list">
          {datasets.map((dataset) => (
            <li key={dataset.name}>
              <button className="btn btn-outline btn-sm" onClick={() => handlePreview(dataset.name)}>
                Preview
              </button>
              <span>
                <strong>{dataset.name}</strong> ({dataset.count} images)
                {dataset.is_default ? " · default" : ""}
              </span>
            </li>
          ))}
          {datasets.length === 0 && <li>No datasets found</li>}
        </ul>
      </div>

      <div className="card admin-section" onPaste={handlePaste}>
        <h3>Add image</h3>
        <form className="admin-add-form" onSubmit={handleSubmit}>
          <label>
            Dataset name
            <input
              value={form.dataset}
              onChange={(e) => setForm((prev) => ({ ...prev, dataset: e.target.value }))}
              placeholder="e.g. my_custom_set"
              list="admin-dataset-names"
            />
            <datalist id="admin-dataset-names">
              {datasets.map((d) => (
                <option key={d.name} value={d.name} />
              ))}
            </datalist>
          </label>

          <label>
            Image file
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />
          </label>
          <p className="admin-hint">Tip: you can also paste an image from the clipboard in this panel.</p>

          <div className="admin-row">
            <label>
              Gender
              <select
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
              >
                <option value="0">Male</option>
                <option value="1">Female</option>
              </select>
            </label>
            <label>
              Race
              <select
                value={form.race}
                onChange={(e) => setForm((prev) => ({ ...prev, race: e.target.value }))}
              >
                <option value="0">White</option>
                <option value="1">Black</option>
                <option value="2">Asian</option>
                <option value="3">Indian</option>
                <option value="4">Other</option>
              </select>
            </label>
          </div>

          <fieldset>
            <legend>Age input mode</legend>
            <label>
              <input
                type="radio"
                name="age-mode"
                checked={form.ageMode === "years"}
                onChange={() => setForm((prev) => ({ ...prev, ageMode: "years" }))}
              />
              Age in years
            </label>
            <label>
              <input
                type="radio"
                name="age-mode"
                checked={form.ageMode === "dob_taken"}
                onChange={() => setForm((prev) => ({ ...prev, ageMode: "dob_taken" }))}
              />
              Date of birth + picture date
            </label>
            <label>
              <input
                type="radio"
                name="age-mode"
                checked={form.ageMode === "dob_uploaded_years"}
                onChange={() => setForm((prev) => ({ ...prev, ageMode: "dob_uploaded_years" }))}
              />
              Date of birth + years old at upload
            </label>
          </fieldset>

          {form.ageMode === "years" && (
            <label>
              Age
              <input
                type="number"
                min="0"
                max="116"
                value={form.age}
                onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
              />
            </label>
          )}
          {form.ageMode === "dob_taken" && (
            <div className="admin-row">
              <label>
                Date of birth
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                />
              </label>
              <label>
                Picture date
                <input
                  type="date"
                  value={form.pictureDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, pictureDate: e.target.value }))}
                />
              </label>
            </div>
          )}
          {form.ageMode === "dob_uploaded_years" && (
            <div className="admin-row">
              <label>
                Date of birth
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                />
              </label>
              <label>
                Years old at upload
                <input
                  type="number"
                  min="0"
                  max="116"
                  value={form.yearsOldAtUpload}
                  onChange={(e) => setForm((prev) => ({ ...prev, yearsOldAtUpload: e.target.value }))}
                />
              </label>
            </div>
          )}

          {submitError && <p className="admin-error">{submitError}</p>}
          {submitMessage && <p className="admin-success">{submitMessage}</p>}
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            Add image
          </button>
        </form>
      </div>

      <div className="card admin-section">
        <h3>Preview {selectedDataset ? `(${selectedDataset})` : ""}</h3>
        {previewLoading && <p>Loading preview…</p>}
        {!previewLoading && (
          <div className="admin-preview-grid">
            {previewImages.map((image) => (
              <figure key={image.filename}>
                <img src={`${API_BASE}${image.url}`} alt={image.filename} />
                <figcaption>
                  {image.filename}
                  <br />
                  age {image.age}, g {image.gender}, r {image.race}
                </figcaption>
              </figure>
            ))}
            {previewImages.length === 0 && <p>No preview images available.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
