import { useState, useRef, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   IndexedDB helpers
───────────────────────────────────────────────────────────── */
const DB_NAME = "rcm_db_v2";
const STORE    = "entries";

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains(STORE))
        e.target.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
const tx = async (mode, fn) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const req = fn(s);
    req.onsuccess = () => res(req.result);
    req.onerror   = e => rej(e.target.error);
  });
};
const dbGetAll = ()      => tx("readonly",  s => s.getAll());
const dbPut    = entry   => tx("readwrite", s => s.put(entry));
const dbDelete = id      => tx("readwrite", s => s.delete(id));

/* ─────────────────────────────────────────────────────────────
   Config
───────────────────────────────────────────────────────────── */
const P = {
  veryhigh: { label: "Very High", color: "#ff3030", rgb: "255,48,48",   order: 0 },
  high:     { label: "High",      color: "#ff8000", rgb: "255,128,0",   order: 1 },
  medium:   { label: "Medium",    color: "#ffd000", rgb: "255,208,0",   order: 2 },
  low:      { label: "Low",       color: "#34c759", rgb: "52,199,89",   order: 3 },
};

const FIELDS = [
  { key: "risk",    label: "Risk",    placeholder: "Describe the risk",        span: 2, rows: 2 },
  { key: "control", label: "Control", placeholder: "Control measure in place", span: 1 },
  { key: "owner",   label: "Owner",   placeholder: "Risk owner / team",        span: 1 },
  { key: "notes",   label: "Notes",   placeholder: "Additional context",       span: 2, rows: 2 },
];

const SEED = [
  { id:"s1", risk:"Unauthorized API data access",      control:"OAuth 2.0 + rate limiting",        owner:"Security",   notes:"Review quarterly",          priority:"veryhigh", ts: Date.now()-6000 },
  { id:"s2", risk:"Third-party vendor SLA breach",     control:"Contractual penalties & alerts",   owner:"Procurement",notes:"Escalate after 2 breaches",  priority:"high",     ts: Date.now()-4000 },
  { id:"s3", risk:"Manual data entry errors",          control:"Validation + dual approval",       owner:"Finance Ops",notes:"",                           priority:"medium",   ts: Date.now()-2000 },
  { id:"s4", risk:"Legacy server OS vulnerabilities",  control:"Patched & isolated network",       owner:"IT Infra",   notes:"Migration Q4",               priority:"low",     ts: Date.now()-1000 },
];

/* ─────────────────────────────────────────────────────────────
   Priority Dropdown
───────────────────────────────────────────────────────────── */
function PriorityDropdown({ value, onChange, compact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = P[value];

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: compact ? 5 : 7,
          padding: compact ? "3px 8px 3px 6px" : "5px 10px 5px 8px",
          borderRadius: 5,
          background: `rgba(${cfg.rgb},0.10)`,
          border: `1px solid rgba(${cfg.rgb},0.30)`,
          color: cfg.color,
          fontSize: compact ? 10 : 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}
      >
        <span style={{
          width: compact ? 5 : 6, height: compact ? 5 : 6,
          borderRadius: "50%", background: cfg.color, flexShrink: 0,
        }} />
        {cfg.label}
        <span style={{ fontSize: 8, opacity: 0.5, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
          background: "#111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          minWidth: 140,
        }}>
          {Object.entries(P).map(([k, v]) => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "9px 14px",
                background: k === value ? `rgba(${v.rgb},0.10)` : "transparent",
                border: "none",
                borderLeft: k === value ? `2px solid ${v.color}` : "2px solid transparent",
                color: k === value ? v.color : "#555",
                fontSize: 11, fontWeight: k === value ? 600 : 400,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.1s",
                textAlign: "left",
              }}
              onMouseEnter={e => { if (k !== value) e.currentTarget.style.color = "#888"; }}
              onMouseLeave={e => { if (k !== value) e.currentTarget.style.color = "#555"; }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: v.color, flexShrink: 0 }} />
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main App
───────────────────────────────────────────────────────────── */
export default function RiskMatrix() {
  const [entries, setEntries]       = useState([]);
  const [dbReady, setDbReady]       = useState(false);
  const [form, setForm]             = useState({ risk:"", control:"", owner:"", notes:"", priority:"veryhigh" });
  const [filter, setFilter]         = useState("all");
  const [added, setAdded]           = useState(null);
  const [syncLabel, setSyncLabel]   = useState(null); // "saving"|"saved"

  /* Load */
  useEffect(() => {
    (async () => {
      try {
        let rows = await dbGetAll();
        if (!rows.length) { for (const e of SEED) await dbPut(e); rows = SEED; }
        setEntries(rows);
      } catch { setEntries(SEED); }
      finally  { setDbReady(true); }
    })();
  }, []);

  const flashSync = useCallback(() => {
    setSyncLabel("saving");
    setTimeout(() => setSyncLabel("saved"), 350);
    setTimeout(() => setSyncLabel(null), 2000);
  }, []);

  /* Add */
  const handleAdd = useCallback(async () => {
    if (!form.risk.trim()) return;
    const entry = { ...form, id:`e-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, ts:Date.now() };
    setEntries(p => [...p, entry]);
    setAdded(entry.id);
    setForm({ risk:"", control:"", owner:"", notes:"", priority:"veryhigh" });
    setTimeout(() => setAdded(null), 2000);
    await dbPut(entry).then(flashSync).catch(console.error);
  }, [form, flashSync]);

  /* Change priority inline */
  const handlePriorityChange = useCallback(async (id, newPriority) => {
    setEntries(p => p.map(e => e.id === id ? { ...e, priority: newPriority } : e));
    const updated = (await dbGetAll()).find(e => e.id === id);
    if (updated) await dbPut({ ...updated, priority: newPriority }).then(flashSync).catch(console.error);
  }, [flashSync]);

  /* Delete */
  const handleDelete = useCallback(async (id) => {
    setEntries(p => p.filter(e => e.id !== id));
    await dbDelete(id).then(flashSync).catch(console.error);
  }, [flashSync]);

  const sorted = [...entries]
    .filter(e => filter === "all" || e.priority === filter)
    .sort((a,b) => P[a.priority].order - P[b.priority].order || b.ts - a.ts);

  const counts = Object.fromEntries(Object.keys(P).map(k => [k, entries.filter(e=>e.priority===k).length]));

  /* ── Render ── */
  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      fontFamily: "'Geist Mono','DM Mono','Fira Mono','Courier New',monospace",
      color: "#d0d0d0",
      paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e1e1e; border-radius: 2px; }
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .entry-card { animation: fadeSlideIn 0.3s ease both; }
        textarea, input {
          transition: border-color 0.2s !important;
        }
        textarea:focus, input:focus {
          border-color: rgba(255,255,255,0.18) !important;
          outline: none;
        }
        .del-btn { opacity: 0; transition: opacity 0.15s; }
        .entry-card:hover .del-btn { opacity: 1; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid #141414",
        padding: "0 32px",
        display: "flex", alignItems: "center", height: 56, gap: 24,
      }}>
        {/* Logo mark */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            border: "1.5px solid #2a2a2a",
            display: "grid", gridTemplateColumns:"1fr 1fr", gap:2, padding:3,
          }}>
            {["#ff3030","#ff8000","#ffd000","#34c759"].map(c => (
              <div key={c} style={{ borderRadius:1, background:c, opacity:0.9 }} />
            ))}
          </div>
          <span style={{ fontSize:13, fontWeight:500, color:"#fff", letterSpacing:"-0.01em" }}>
            Risk Matrix
          </span>
        </div>

        {/* Counts */}
        <div style={{ display:"flex", gap:6, marginLeft:8 }}>
          {Object.entries(P).map(([k,v]) => (
            <button
              key={k}
              onClick={() => setFilter(f => f===k ? "all" : k)}
              style={{
                display:"flex", alignItems:"center", gap:5,
                padding:"3px 10px", borderRadius:20,
                background: filter===k ? `rgba(${v.rgb},0.12)` : "transparent",
                border: `1px solid ${filter===k ? `rgba(${v.rgb},0.35)` : "#1a1a1a"}`,
                color: filter===k ? v.color : "#3a3a3a",
                fontSize:11, cursor:"pointer", fontFamily:"inherit",
                letterSpacing:"0.05em", transition:"all 0.15s",
              }}
            >
              <span style={{ width:4, height:4, borderRadius:"50%", background:v.color }} />
              {v.label} <span style={{ opacity:0.6 }}>{counts[k]}</span>
            </button>
          ))}
          <button
            onClick={() => setFilter("all")}
            style={{
              padding:"3px 10px", borderRadius:20,
              background: filter==="all" ? "rgba(255,255,255,0.06)" : "transparent",
              border: `1px solid ${filter==="all" ? "rgba(255,255,255,0.15)" : "#1a1a1a"}`,
              color: filter==="all" ? "#888" : "#2e2e2e",
              fontSize:11, cursor:"pointer", fontFamily:"inherit",
              letterSpacing:"0.05em", transition:"all 0.15s",
            }}
          >
            All <span style={{ opacity:0.6 }}>{entries.length}</span>
          </button>
        </div>

        {/* Sync */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, fontSize:10, letterSpacing:"0.08em" }}>
          {syncLabel === "saving" && (
            <span style={{ color:"#ff9500", display:"flex", alignItems:"center", gap:4 }}>
              <span style={{ display:"inline-block", animation:"spin 0.6s linear infinite" }}>◌</span>
              SAVING
            </span>
          )}
          {syncLabel === "saved" && <span style={{ color:"#34c759" }}>✓ SAVED</span>}
          {!syncLabel && dbReady && <span style={{ color:"#222" }}>● SYNCED</span>}
          {!dbReady && <span style={{ color:"#333" }}>LOADING…</span>}
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"32px 24px 0" }}>

        {/* ── Add Form ── */}
        {dbReady && (
          <div style={{
            background: "#0c0c0c",
            border: "1px solid #161616",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 28,
          }}>
            <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#2e2e2e", textTransform:"uppercase", marginBottom:18 }}>
              New Entry
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 16px" }}>
              {FIELDS.map(f => (
                <div key={f.key} style={{ gridColumn: f.span===2 ? "1/-1" : undefined }}>
                  <label style={{ display:"block", fontSize:9, color:"#2e2e2e", marginBottom:5, letterSpacing:"0.18em", textTransform:"uppercase" }}>
                    {f.label}
                  </label>
                  {f.rows ? (
                    <textarea
                      rows={f.rows}
                      value={form[f.key]}
                      onChange={e => setForm(p=>({...p,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      style={inputSt}
                    />
                  ) : (
                    <input
                      type="text"
                      value={form[f.key]}
                      onChange={e => setForm(p=>({...p,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      style={inputSt}
                    />
                  )}
                </div>
              ))}
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:18, flexWrap:"wrap" }}>
              <span style={{ fontSize:9, color:"#2a2a2a", letterSpacing:"0.18em", textTransform:"uppercase" }}>Priority</span>
              <PriorityDropdown value={form.priority} onChange={v => setForm(p=>({...p,priority:v}))} />
              <div style={{ flex:1 }} />
              <button
                onClick={handleAdd}
                disabled={!form.risk.trim()}
                style={{
                  padding:"8px 24px", borderRadius:7,
                  background: form.risk.trim() ? "#fff" : "#111",
                  color: form.risk.trim() ? "#000" : "#2a2a2a",
                  border: "none",
                  fontWeight:600, fontSize:12,
                  cursor: form.risk.trim() ? "pointer" : "not-allowed",
                  letterSpacing:"0.04em", fontFamily:"inherit",
                  transition:"all 0.15s",
                }}
              >
                Add Entry
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {!dbReady && (
          <div style={{ textAlign:"center", color:"#1e1e1e", fontSize:11, padding:"60px 0", letterSpacing:"0.15em" }}>
            LOADING
          </div>
        )}

        {/* ── Entry List ── */}
        {dbReady && sorted.length === 0 && (
          <div style={{ textAlign:"center", color:"#1e1e1e", fontSize:11, padding:"80px 0", letterSpacing:"0.15em" }}>
            NO ENTRIES
          </div>
        )}

        {dbReady && sorted.length > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {sorted.map((e, i) => {
              const v = P[e.priority];
              const isNew = added === e.id;
              return (
                <div
                  key={e.id}
                  className="entry-card"
                  style={{
                    animationDelay: `${i * 30}ms`,
                    display:"grid",
                    gridTemplateColumns:"2px 1fr",
                    borderRadius:10,
                    overflow:"hidden",
                    border: `1px solid ${isNew ? `rgba(${v.rgb},0.4)` : "#111"}`,
                    background: isNew ? `rgba(${v.rgb},0.04)` : "#0a0a0a",
                    boxShadow: isNew ? `0 0 20px rgba(${v.rgb},0.12)` : "none",
                    transition:"border-color 0.5s, box-shadow 0.5s, background 0.5s",
                  }}
                >
                  {/* Color strip */}
                  <div style={{ background:`rgba(${v.rgb},0.7)` }} />

                  {/* Body */}
                  <div style={{ padding:"14px 16px 14px 18px" }}>
                    {/* Row 1: priority dropdown + owner + date + delete */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, flexWrap:"wrap" }}>
                      <PriorityDropdown
                        value={e.priority}
                        onChange={nv => handlePriorityChange(e.id, nv)}
                        compact
                      />
                      {e.owner && (
                        <span style={{ fontSize:10, color:"#2e2e2e", letterSpacing:"0.08em" }}>
                          {e.owner}
                        </span>
                      )}
                      <div style={{ flex:1 }} />
                      <span style={{ fontSize:9, color:"#1e1e1e", letterSpacing:"0.06em" }}>
                        {new Date(e.ts).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"})}
                        &nbsp;·&nbsp;
                        {new Date(e.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                      </span>
                      <button
                        className="del-btn"
                        onClick={() => handleDelete(e.id)}
                        style={{
                          background:"none", border:"none",
                          color:"#2a2a2a", cursor:"pointer",
                          fontSize:14, lineHeight:1,
                          padding:"0 2px", fontFamily:"inherit",
                          transition:"color 0.15s",
                        }}
                        onMouseEnter={ev => ev.currentTarget.style.color="#ff4040"}
                        onMouseLeave={ev => ev.currentTarget.style.color="#2a2a2a"}
                        title="Delete"
                      >×</button>
                    </div>

                    {/* Risk */}
                    <div style={{ marginBottom: (e.control||e.notes) ? 10 : 0 }}>
                      <span style={{ fontSize:9, color:"#222", letterSpacing:"0.15em", textTransform:"uppercase", marginRight:8 }}>Risk</span>
                      <span style={{ fontSize:13, color:"#c8c8c8", lineHeight:1.6, fontWeight:400 }}>{e.risk}</span>
                    </div>

                    {/* Control + Notes */}
                    {(e.control || e.notes) && (
                      <div style={{ display:"grid", gridTemplateColumns: e.control&&e.notes ? "1fr 1fr" : "1fr", gap:"6px 24px", paddingTop:8, borderTop:"1px solid #111" }}>
                        {e.control && (
                          <div>
                            <div style={{ fontSize:9, color:"#222", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:3 }}>Control</div>
                            <div style={{ fontSize:12, color:"#555", lineHeight:1.5 }}>{e.control}</div>
                          </div>
                        )}
                        {e.notes && (
                          <div>
                            <div style={{ fontSize:9, color:"#222", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:3 }}>Notes</div>
                            <div style={{ fontSize:12, color:"#444", lineHeight:1.5, fontStyle:"italic" }}>{e.notes}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Shared input style
───────────────────────────────────────────────────────────── */
const inputSt = {
  width:"100%",
  background:"#080808",
  border:"1px solid #161616",
  borderRadius:6,
  padding:"8px 11px",
  color:"#aaa",
  fontSize:12,
  fontFamily:"inherit",
  outline:"none",
  resize:"vertical",
  boxSizing:"border-box",
  caretColor:"#fff",
};
