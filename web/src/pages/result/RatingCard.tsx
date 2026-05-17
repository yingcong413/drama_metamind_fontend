import { useState } from "react";

export function RatingCard() {
  const [rating, setRating] = useState(4);
  return (
    <div className="card" style={{ padding: 20 }}>
      <h4
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-tertiary)",
        }}
      >
        评分与反馈
      </h4>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            style={{
              padding: 0,
              color: n <= rating ? "var(--accent)" : "var(--text-tertiary)",
              fontSize: 18,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <div className="dim" style={{ fontSize: 12 }}>反馈将用于改进下次生成。</div>
    </div>
  );
}
