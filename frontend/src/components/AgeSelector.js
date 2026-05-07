import React, { useRef, useState } from "react";
import "./AgeSelector.css";

/**
 * AgeSelector – an interactive horizontal bar showing the age range.
 *
 * The user clicks anywhere on the bar to select an age.
 * After a guess is made (`selectedAge` prop is set), the bar shows:
 *  - The selected (guessed) age in the user-guess color
 *  - The correct age in green
 *  - A colored span between them based on the distance
 */
function distanceColor(distance) {
  if (distance <= 2) return "#22c55e";
  if (distance <= 5) return "#84cc16";
  if (distance <= 10) return "#f97316";
  return "#ef4444";
}

export default function AgeSelector({
  minAge,
  maxAge,
  selectedAge,
  correctAge,
  disabled,
  onSelect,
}) {
  const barRef = useRef(null);
  const [hoverAge, setHoverAge] = useState(null);

  const range = maxAge - minAge;

  function ageToPercent(age) {
    return ((age - minAge) / range) * 100;
  }

  function xToAge(clientX) {
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(minAge + ratio * range);
  }

  function handleClick(e) {
    if (disabled || !barRef.current) return;
    const age = xToAge(e.clientX);
    onSelect(age);
  }

  function handleMouseMove(e) {
    if (disabled || !barRef.current) return;
    setHoverAge(xToAge(e.clientX));
  }

  function handleMouseLeave() {
    setHoverAge(null);
  }

  // Positions for markers (percentages)
  const selectedPct = selectedAge != null ? ageToPercent(selectedAge) : null;
  const correctPct = correctAge != null ? ageToPercent(correctAge) : null;
  const hoverPct = hoverAge != null ? ageToPercent(hoverAge) : null;

  const isRevealed = selectedAge != null && correctAge != null;
  const distance = isRevealed ? Math.abs(selectedAge - correctAge) : null;
  const color = isRevealed ? distanceColor(distance) : null;

  // Span between guess and correct answer
  let spanLeft = null;
  let spanWidth = null;
  if (isRevealed && distance > 0) {
    const lo = Math.min(selectedPct, correctPct);
    const hi = Math.max(selectedPct, correctPct);
    spanLeft = lo;
    spanWidth = hi - lo;
  }

  // Tick marks – show every ~10 years
  const tickInterval = range <= 30 ? 5 : range <= 60 ? 10 : 20;
  const ticks = [];
  for (
    let age = Math.ceil(minAge / tickInterval) * tickInterval;
    age <= maxAge;
    age += tickInterval
  ) {
    ticks.push(age);
  }

  return (
    <div className="age-selector">
      <div className="age-selector-label">
        {disabled
          ? "Result shown above – click the image to continue"
          : "Click to guess the age"}
      </div>

      <div
        ref={barRef}
        className={`age-bar${disabled ? " age-bar-disabled" : ""}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role={disabled ? undefined : "slider"}
        aria-label="Age selector"
        aria-valuemin={minAge}
        aria-valuemax={maxAge}
        aria-valuenow={selectedAge ?? undefined}
      >
        {/* Base track */}
        <div className="age-bar-track" />

        {/* Distance span (shown after reveal) */}
        {spanLeft != null && (
          <div
            className="age-span"
            style={{
              left: `${spanLeft}%`,
              width: `${spanWidth}%`,
              background: color + "55",
              borderTop: `3px solid ${color}`,
            }}
          />
        )}

        {/* Hover indicator */}
        {!disabled && hoverPct != null && (
          <div
            className="age-marker age-marker-hover"
            style={{ left: `${hoverPct}%` }}
          >
            <div className="age-marker-line" style={{ background: "#94a3b8" }} />
            <div className="age-marker-label age-marker-label-top" style={{ color: "#64748b" }}>
              {hoverAge}
            </div>
          </div>
        )}

        {/* Selected (guess) marker */}
        {selectedPct != null && (
          <div className="age-marker" style={{ left: `${selectedPct}%` }}>
            <div className="age-marker-line" style={{ background: color }} />
            <div
              className="age-marker-label age-marker-label-top"
              style={{ color, fontWeight: 700 }}
            >
              {selectedAge}
            </div>
          </div>
        )}

        {/* Correct age marker */}
        {correctPct != null && (
          <div className="age-marker" style={{ left: `${correctPct}%` }}>
            <div className="age-marker-line" style={{ background: "#22c55e" }} />
            <div
              className="age-marker-label age-marker-label-bottom"
              style={{ color: "#22c55e", fontWeight: 700 }}
            >
              {correctAge}
              <span className="marker-caption"> ✓</span>
            </div>
          </div>
        )}

        {/* Tick marks */}
        {ticks.map((age) => (
          <div
            key={age}
            className="age-tick"
            style={{ left: `${ageToPercent(age)}%` }}
          >
            <div className="age-tick-mark" />
            <div className="age-tick-label">{age}</div>
          </div>
        ))}
      </div>

      <div className="age-range-labels">
        <span>{minAge}</span>
        <span>{maxAge}</span>
      </div>
    </div>
  );
}
