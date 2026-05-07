import React, { useState } from "react";
import { createDefaultConfig, generateId } from "../utils/storage";
import "./ConfigForm.css";

const GENDER_OPTIONS = [
  { value: 0, label: "Male" },
  { value: 1, label: "Female" },
];

const RACE_OPTIONS = [
  { value: 0, label: "White" },
  { value: 1, label: "Black" },
  { value: 2, label: "Asian" },
  { value: 3, label: "Indian" },
  { value: 4, label: "Other" },
];

const RESOLUTION_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const DATASET_OPTIONS = [
  { value: "cropped", label: "Cropped faces" },
  { value: "wild", label: "In-the-wild faces" },
];

export default function ConfigForm({ initial, onSave, onCancel }) {
  const defaults = createDefaultConfig();
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          // Backward compatibility: old configs may not have resolutions
          resolutions: initial.resolutions ?? defaults.resolutions,
        }
      : defaults
  );
  const [errors, setErrors] = useState({});

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.minAge < 0 || form.minAge > 116) errs.minAge = "0–116";
    if (form.maxAge < 0 || form.maxAge > 116) errs.maxAge = "0–116";
    if (form.minAge >= form.maxAge) errs.maxAge = "Max age must be greater than min age";
    if (form.facesPerRun < 1 || form.facesPerRun > 100) errs.facesPerRun = "1–100";
    if (form.genders.length === 0) errs.genders = "Select at least one gender";
    if (form.races.length === 0) errs.races = "Select at least one race";
    if (form.resolutions.length === 0) errs.resolutions = "Select at least one resolution";
    if (form.datasets.length === 0) errs.datasets = "Select at least one dataset";
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onSave({
      ...form,
      id: form.id || generateId(),
      history: form.history || [],
    });
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function toggleMulti(field, value) {
    const current = form[field];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setField(field, next);
  }

  return (
    <div className="config-form card">
      <h2>{initial ? "Edit Configuration" : "New Configuration"}</h2>
      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Young adults"
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        {/* Faces per run */}
        <div className="form-group">
          <label>Faces per run</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.facesPerRun}
            onChange={(e) => setField("facesPerRun", parseInt(e.target.value, 10) || 1)}
          />
          {errors.facesPerRun && <span className="field-error">{errors.facesPerRun}</span>}
        </div>

        {/* Age range */}
        <div className="form-group">
          <label>Age range</label>
          <div className="range-inputs">
            <input
              type="number"
              min={0}
              max={116}
              value={form.minAge}
              onChange={(e) => setField("minAge", parseInt(e.target.value, 10) || 0)}
              placeholder="Min"
            />
            <span>–</span>
            <input
              type="number"
              min={0}
              max={116}
              value={form.maxAge}
              onChange={(e) => setField("maxAge", parseInt(e.target.value, 10) || 0)}
              placeholder="Max"
            />
          </div>
          {(errors.minAge || errors.maxAge) && (
            <span className="field-error">{errors.minAge || errors.maxAge}</span>
          )}
        </div>

        {/* Genders */}
        <div className="form-group">
          <label>Genders</label>
          <div className="checkbox-group">
            {GENDER_OPTIONS.map(({ value, label }) => (
              <label key={value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.genders.includes(value)}
                  onChange={() => toggleMulti("genders", value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.genders && <span className="field-error">{errors.genders}</span>}
        </div>

        {/* Races */}
        <div className="form-group">
          <label>Races</label>
          <div className="checkbox-group">
            {RACE_OPTIONS.map(({ value, label }) => (
              <label key={value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.races.includes(value)}
                  onChange={() => toggleMulti("races", value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.races && <span className="field-error">{errors.races}</span>}
        </div>

        {/* Resolutions */}
        <div className="form-group">
          <label>Resolutions</label>
          <div className="checkbox-group">
            {RESOLUTION_OPTIONS.map(({ value, label }) => (
              <label key={value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.resolutions.includes(value)}
                  onChange={() => toggleMulti("resolutions", value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.resolutions && <span className="field-error">{errors.resolutions}</span>}
        </div>

        {/* Datasets */}
        <div className="form-group">
          <label>Datasets</label>
          <div className="checkbox-group">
            {DATASET_OPTIONS.map(({ value, label }) => (
              <label key={value} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.datasets.includes(value)}
                  onChange={() => toggleMulti("datasets", value)}
                />
                {label}
              </label>
            ))}
          </div>
          {errors.datasets && <span className="field-error">{errors.datasets}</span>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
