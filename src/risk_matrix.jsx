import { useState, useRef, useEffect, useCallback } from "react";

// ── IndexedDB helpers ──────────────────────────────────────────────────────────
const DB_NAME = "risk_matrix_db";
const DB_VERSION = 1;
const STORE = "entries";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function dbPut(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = e => reject(e.target.error);
  });
}

// ── Constants ──────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  high: {
    label: "High Risk",
    color: "#ff3b3b",
    bg: "rgba(255,59,59,0.10)",
    border: "rgba(255,59,59,0.35)",
    glow: "0 0 18px rgba(255,59,59,0.25)",
    dot: "#ff3b3b",
    order: 0,
  },
  medium: {
    label: "Medium Risk",
    color: "#ff9f1c",
    bg: "rgba(255,159,28,0.10)",
    border: "rgba(255,159,28,0.35)",
    glow: "0 0 18px rgba(255,159,28,0.18)",
    dot: "#ff9f1c",
    order: 1,
  },
  low: {
    label: "Low Risk",
    color: "#3bc9db",
    bg: "rgba(59,201,219,0.10)",
    border: "rgba(59,201,219,0.35)",
    glow: "0 0 18px rgba(59,201,219,0.18)",
    dot: "#3bc9db",
    order: 2,
  },
  mitigated: {
    label: "Mitigated",
    color: "#69db7c",
    bg: "rgba(105,219,124,0.10)",
    border: "rgba(105,219,124,0.35)",
    glow: "0 0 18px rgba(105,219,124,0.15)",
    dot: "#69db7c",
    order: 3,
  },
};

const FIELDS = [
  { key: "risk",    label: "Risk Description", placeholder: "Describe the risk…",           multiline: true },
  { key: "control", label: "Control Measure",  placeholder: "What control is in place?"                    },
  { key: "owner",   label: "Risk Owner",        placeholder: "Responsible person / team"                    },
  { key: "notes",   label: "Additional Notes",  placeholder: "Any other context or notes…", multiline: true },
];

const SEED = [
  { id: "seed-1", risk: "Unauthorized data access via API endpoints", control: "OAuth 2.0 + rate limiting",         owner: "Security Team", notes: "Review quarterly",           priority: "high",      ts: Date.now() - 5000 },
  { id: "seed-2", risk: "Third-party vendor SLA breach",              control: "Contractual penalties & monitoring", owner: "Procurement",   notes: "Escalate if 2 breaches/mo", priority: "medium",    ts: Date.now() - 3000 },
  { id: "seed-3", risk: "Manual data entry errors in reports",        control: "Validation rules + dual approval",   owner: "Finance Ops",   notes: "",                          priority: "low",       ts: Date.now() - 1000 },
  { id: "seed-4", risk: "Legacy server OS vulnerabilities",           control: "Patched & isolated network segment", owner: "IT Infra",      notes: "Migration scheduled Q4",    priority: "mitigated", ts: Date.now()        },
];

// ── App ────────────────────────────────────────────────────────────────────────
export default function RiskMatrix() {
  const [entries, setEntries]       = useState([]);
  const [dbReady, setDbReady]       = useState(false);
  const [form, setForm]             = useState({ risk: "", control: "", owner: "", notes: "", priority: "high" });
  const [filter, setFilter]         = useState("all");
  const [added, setAdded]           = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // "saving" | "saved" | null
  const formRef = useRef(null);

  // Load from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        let stored = await dbGetAll();
        if (stored.length === 0) {
          for (const e of SEED) await dbPut(e);
          stored = SEED;
        }
        setEntries(stored);
      } catch (err) {
        console.error("IndexedDB load error:", err);
        setEntries(SEED);
      } finally {
        setDbReady(true);
      }
    })();
  }, []);

  const flashSave = useCallback(() => {
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 400);
    setTimeout(() => setSaveStatus(null), 2000);
  }, []);

  const handleAdd = useCallback(async () => {
    if (!form.risk.trim()) return;
    const entry = {
      ...form,
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
    };
    setEntries(prev => [...prev, entry]);
    setAdded(entry.id);
    setForm({ risk: "", control: "", owner: "", notes: "", priority: "high" });
    setTimeout(() => setAdded(null), 1800);
    try {
      await dbPut(entry);
      flashSave();
    } catch (err) {
      console.error("IndexedDB write error:", err);
    }
  }, [form, flashSave]);

  const handleDelete = useCallback(async (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await dbDelete(id);
      flashSave();
    } catch (err) {
      console.error("IndexedDB delete error:", err);
    }
  }, [flashSave]);

  const sorted = [...entries]
    .filter(e => filter === "all" || e.priority === filter)
    .sort((a, b) =>
      PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order ||
      b.ts - a.ts
    );

  const counts = Object.fromEntries(
    Object.keys(PRIORITY_CONFIG).map(k => [k, entries.filter(e => e.priority === k).length])
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0e14",
      fontFamily: "'DM Mono', 'Fira Mono', 'Courier New', monospace",
      color: "#e8e8f0",
      padding: "0 0 60px",
    }}>
      {/* ── Header ── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "32px 40px 24px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.25em", color: "#555", textTransform: "uppercase", marginBottom: 6 }}>Enterprise</div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "#fff" }}>
              Risk &amp; Control Matrix
            </h1>
          </div>

          {/* Save status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginLeft: 8,
            fontSize: 11,
            color: saveStatus === "saved" ? "#69db7c" : saveStatus === "saving" ? "#ff9f1c" : "#2a2b35",
            transition: "color 0.3s",
          }}>
            {saveStatus === "saving" && <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite" }}>⟳</span>}
            {saveStatus === "saved"  && "✓ Saved to IndexedDB"}
            {!saveStatus && dbReady  && "● Synced"}
            {!dbReady               && <span style={{ color: "#444" }}>Loading…</span>}
          </div>

          {/* Counts */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
              <div key={k} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "6px 14px", borderRadius: 6,
                background: v.bg, border: `1px solid ${v.border}`, fontSize: 12,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: v.dot, display: "inline-block" }} />
                <span style={{ color: v.color, fontWeight: 600 }}>{counts[k]}</span>
                <span style={{ color: "#666", fontSize: 11 }}>{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 40px 0" }}>

        {/* Loading */}
        {!dbReady && (
          <div style={{ textAlign: "center", color: "#444", fontSize: 13, padding: "60px 0", letterSpacing: "0.1em" }}>
            Loading saved entries…
          </div>
        )}

        {/* ── Add Form ── */}
        {dbReady && (
          <div ref={formRef} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 14, padding: "28px 28px 24px", marginBottom: 36,
          }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", marginBottom: 20 }}>
              ＋ New Entry
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
              {FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.multiline ? "1 / -1" : undefined }}>
                  <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {f.label}
                  </label>
                  {f.multiline ? (
                    <textarea
                      rows={2}
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={inputStyle}
                    />
                  ) : (
                    <input
                      type="text"
                      value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Priority:</span>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => setForm(p => ({ ...p, priority: k }))}
                  style={{
                    padding: "7px 16px", borderRadius: 7,
                    border: `1.5px solid ${form.priority === k ? v.color : "rgba(255,255,255,0.1)"}`,
                    background: form.priority === k ? v.bg : "transparent",
                    color: form.priority === k ? v.color : "#555",
                    fontSize: 12, fontWeight: form.priority === k ? 700 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                    fontFamily: "inherit",
                    boxShadow: form.priority === k ? v.glow : "none",
                  }}
                >
                  {v.label}
                </button>
              ))}
              <button
                onClick={handleAdd}
                style={{
                  marginLeft: "auto", padding: "9px 28px", borderRadius: 8, border: "none",
                  background: form.risk.trim()
                    ? "linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)"
                    : "rgba(255,255,255,0.07)",
                  color: form.risk.trim() ? "#fff" : "#444",
                  fontWeight: 700, fontSize: 13,
                  cursor: form.risk.trim() ? "pointer" : "not-allowed",
                  letterSpacing: "0.05em", fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                Add to Matrix
              </button>
            </div>
          </div>
        )}

        {/* ── Filter Bar ── */}
        {dbReady && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.15em", textTransform: "uppercase", marginRight: 4 }}>Show:</span>
            {["all", ...Object.keys(PRIORITY_CONFIG)].map(k => {
              const v = k === "all" ? null : PRIORITY_CONFIG[k];
              const active = filter === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  style={{
                    padding: "5px 14px", borderRadius: 6,
                    border: `1px solid ${active ? (v ? v.color : "#fff") : "rgba(255,255,255,0.1)"}`,
                    background: active ? (v ? v.bg : "rgba(255,255,255,0.07)") : "transparent",
                    color: active ? (v ? v.color : "#ccc") : "#555",
                    fontSize: 11, fontWeight: active ? 700 : 400,
                    cursor: "pointer", fontFamily: "inherit",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}
                >
                  {k === "all" ? `All (${entries.length})` : `${v.label} (${counts[k]})`}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Entries ── */}
        {dbReady && (
          sorted.length === 0 ? (
            <div style={{ textAlign: "center", color: "#333", fontSize: 14, padding: "60px 0" }}>
              No entries yet — add one above.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sorted.map(e => {
                const v = PRIORITY_CONFIG[e.priority];
                const isNew = added === e.id;
                return (
                  <div
                    key={e.id}
                    style={{
                      display: "grid", gridTemplateColumns: "4px 1fr auto", gap: 0,
                      borderRadius: 11,
                      border: `1px solid ${isNew ? v.color : v.border}`,
                      background: v.bg,
                      boxShadow: isNew ? v.glow : "none",
                      overflow: "hidden",
                      transition: "box-shadow 0.4s, border-color 0.4s",
                    }}
                  >
                    <div style={{ background: v.color }} />

                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: "0.2em",
                          textTransform: "uppercase", color: v.color,
                          background: `rgba(${hexToRgb(v.dot)},0.15)`,
                          padding: "3px 9px", borderRadius: 4,
                        }}>
                          {v.label}
                        </span>
                        {e.owner && <span style={{ fontSize: 11, color: "#555" }}>◈ {e.owner}</span>}
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "#333" }}>
                          {new Date(e.ts).toLocaleDateString()} · {new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div style={{ marginBottom: e.control || e.notes ? 10 : 0 }}>
                        <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Risk: </span>
                        <span style={{ fontSize: 14, color: "#e8e8f0", lineHeight: 1.5 }}>{e.risk}</span>
                      </div>

                      {e.control && (
                        <div style={{ marginBottom: e.notes ? 8 : 0 }}>
                          <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Control: </span>
                          <span style={{ fontSize: 13, color: "#aaa" }}>{e.control}</span>
                        </div>
                      )}

                      {e.notes && (
                        <div>
                          <span style={{ fontSize: 11, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>Notes: </span>
                          <span style={{ fontSize: 12, color: "#777", fontStyle: "italic" }}>{e.notes}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start" }}>
                      <button
                        onClick={() => handleDelete(e.id)}
                        style={{
                          background: "none", border: "none", color: "#333",
                          cursor: "pointer", fontSize: 16, lineHeight: 1,
                          padding: "2px 4px", borderRadius: 4,
                          fontFamily: "inherit", transition: "color 0.15s",
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.color = "#ff3b3b"}
                        onMouseLeave={ev => ev.currentTarget.style.color = "#333"}
                        title="Remove entry"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus, input:focus { border-color: rgba(167,139,250,0.5) !important; }
      `}</style>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 7,
  padding: "9px 12px",
  color: "#e8e8f0",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

function hexToRgb(hex) {
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",");
}
