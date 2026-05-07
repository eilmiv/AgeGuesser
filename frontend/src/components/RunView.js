import React, { useState, useEffect, useCallback } from "react";
import AgeSelector from "./AgeSelector";
import "./RunView.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

/** Color scale based on how far off the guess was. */
function distanceColor(distance) {
  if (distance <= 2) return "#22c55e"; // green
  if (distance <= 5) return "#84cc16"; // lime
  if (distance <= 10) return "#f97316"; // orange
  return "#ef4444"; // red
}

/** Human-readable quality label. */
function distanceLabel(distance) {
  if (distance <= 2) return "Excellent! 🎯";
  if (distance <= 5) return "Good 👍";
  if (distance <= 10) return "Close 😐";
  return "Far off 😬";
}

export default function RunView({ config, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);

  // Phase: "guessing" | "revealed"
  const [phase, setPhase] = useState("guessing");
  const [guessedAge, setGuessedAge] = useState(null);

  const totalFaces = config.facesPerRun;

  const fetchNextImage = useCallback(async () => {
    setLoadingImage(true);
    setLoadError(null);
    setPhase("guessing");
    setGuessedAge(null);
    setCurrentImage(null);

    const params = new URLSearchParams({
      min_age: config.minAge,
      max_age: config.maxAge,
      genders: config.genders.join(","),
      races: config.races.join(","),
      resolutions: (config.resolutions ?? ["low", "medium", "high"]).join(","),
      datasets: config.datasets.join(","),
    });

    try {
      const res = await fetch(`${API_BASE}/api/random?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCurrentImage(data);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoadingImage(false);
    }
  }, [config]);

  // Load first image on mount
  useEffect(() => {
    fetchNextImage();
  }, [fetchNextImage]);

  function handleGuess(age) {
    if (phase !== "guessing") return;
    setGuessedAge(age);
    setPhase("revealed");
  }

  function handleNextImage() {
    if (phase !== "revealed") return;

    const distance = Math.abs(guessedAge - currentImage.age);
    const newResults = [
      ...results,
      {
        image: currentImage,
        guess: guessedAge,
        distance,
      },
    ];
    setResults(newResults);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= totalFaces) {
      onComplete(newResults);
    } else {
      setCurrentIndex(nextIndex);
      fetchNextImage();
    }
  }

  // Progress info
  const progress = `${currentIndex + 1} / ${totalFaces}`;
  const progressPct = ((currentIndex) / totalFaces) * 100;

  if (loadError) {
    return (
      <div className="run-view">
        <div className="run-error card">
          <h3>⚠️ Could not load image</h3>
          <p>{loadError}</p>
          <p className="run-error-hint">
            Make sure the backend is running and the dataset has been downloaded:
            <br />
            <code>python manage.py download</code>
          </p>
          <button className="btn btn-primary" onClick={fetchNextImage}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const distance = phase === "revealed" ? Math.abs(guessedAge - currentImage.age) : null;
  const color = distance !== null ? distanceColor(distance) : null;

  return (
    <div className="run-view">
      {/* Progress bar */}
      <div className="run-progress">
        <div className="run-progress-label">
          <span>Face {progress}</span>
          {results.length > 0 && (
            <span className="avg-distance">
              Avg distance:{" "}
              {(results.reduce((s, r) => s + r.distance, 0) / results.length).toFixed(1)} yrs
            </span>
          )}
        </div>
        <div className="run-progress-bar">
          <div className="run-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Main content */}
      <div className="run-main">
        {/* Image area */}
        <div
          className={`run-image-wrapper${phase === "revealed" ? " clickable" : ""}`}
          onClick={phase === "revealed" ? handleNextImage : undefined}
          title={phase === "revealed" ? "Click to continue" : undefined}
        >
          {loadingImage ? (
            <div className="run-image-placeholder">Loading…</div>
          ) : (
            currentImage && (
              <>
                <img
                  className="run-image"
                  src={`${API_BASE}/api/image/${currentImage.dataset}/${currentImage.filename}`}
                  alt="Guess the age"
                  draggable={false}
                />
                {phase === "revealed" && (
                  <div className="run-image-overlay" style={{ borderColor: color }}>
                    <div className="overlay-result" style={{ background: color }}>
                      <span className="overlay-label">{distanceLabel(distance)}</span>
                      <span className="overlay-detail">
                        You said <strong>{guessedAge}</strong>, actual age:{" "}
                        <strong>{currentImage.age}</strong>
                        {distance > 0 && (
                          <> (off by {distance} yr{distance !== 1 ? "s" : ""})</>
                        )}
                      </span>
                      <span className="overlay-hint">Click image to continue →</span>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>

        {/* Age selector */}
        {!loadingImage && currentImage && (
          <AgeSelector
            minAge={config.minAge}
            maxAge={config.maxAge}
            selectedAge={phase === "revealed" ? guessedAge : null}
            correctAge={phase === "revealed" ? currentImage.age : null}
            disabled={phase === "revealed"}
            onSelect={handleGuess}
          />
        )}
      </div>
    </div>
  );
}
