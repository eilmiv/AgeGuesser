import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

/** Custom tooltip for the history chart. */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: "0.82rem",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
      }}
    >
      <p style={{ marginBottom: 2, color: "#64748b" }}>Run {label}</p>
      <p style={{ fontWeight: 700, color: "#4f46e5" }}>
        Avg distance: {payload[0].value.toFixed(1)} yrs
      </p>
    </div>
  );
}

/**
 * HistoryChart renders the learning-progress line chart for a configuration.
 * Props:
 *   history – array of { date, avgDistance }
 */
export default function HistoryChart({ history }) {
  const data = history.map((h, i) => ({
    run: i + 1,
    avgDistance: h.avgDistance,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="run"
          tick={{ fontSize: 11, fill: "#64748b" }}
          label={{ value: "Run", position: "insideBottomRight", offset: -4, fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#64748b" }}
          domain={[0, "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#22c55e" strokeDasharray="4 2" opacity={0.5} />
        <Line
          type="monotone"
          dataKey="avgDistance"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ r: 3, fill: "#4f46e5" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
