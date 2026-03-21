const { useEffect, useMemo, useRef, useState } = React;

// -------------------------
// Small helpers
// -------------------------
const SLOTS = ["09:00-09:15", "11:00-11:15", "14:00-14:15", "16:00-16:15", "18:00-18:15"];
const API_BASE = "http://localhost:3001";

function statusKey(status) {
  if (status === "On Time") return "onTime";
  if (status === "Late") return "late";
  return "absent";
}

function formatNow() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function safeText(v) {
  return v == null ? "—" : String(v);
}

// -------------------------
// UI Components
// -------------------------
function StatusPill({ status }) {
  const key = statusKey(status);
  const cls =
    key === "onTime" ? "pill pill--onTime" : key === "late" ? "pill pill--late" : "pill pill--absent";

  return (
    <span className={cls} title="Click any record to view details">
      <span className="dot" />
      {status}
    </span>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="toastWrap" role="status" aria-live="polite">
      <div className="toast">
        <div>
          <div className="tTitle">{toast.title}</div>
          <p className="tSub">{toast.subtitle}</p>
        </div>
        <button className="iconBtn" onClick={onClose} aria-label="Close message" title="Close">
          Close
        </button>
      </div>
    </div>
  );
}

function Modal({ record, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!record) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  const slotText = record.slot ? record.slot : "Outside all slots";

  return (
    <div
      className="modalOverlay"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Student details"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="modal">
        <div className="modalHead">
          <div>
            <h3>Student Attendance Details</h3>
            <div className="sub">
              Click outside, press <b>Esc</b>, or use the close button.
            </div>
          </div>
          <button className="iconBtn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modalBody">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16 }}>{safeText(record.name)}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>ID: {safeText(record.userId)}</div>
            </div>
            <StatusPill status={record.status} />
          </div>

          <div className="modalGrid" style={{ marginTop: 12 }}>
            <div className="field">
              <div className="k">Time</div>
              <div className="v">{safeText(record.localTime)}</div>
            </div>
            <div className="field">
              <div className="k">Slot</div>
              <div className="v">{slotText}</div>
            </div>
            <div className="field">
              <div className="k">Status</div>
              <div className="v">{safeText(record.status)}</div>
            </div>
            <div className="field">
              <div className="k">Present</div>
              <div className="v">{record.present ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordCard({ record, onClick }) {
  return (
    <div className="recordCard" onClick={() => onClick(record)} role="button" tabIndex={0}>
      <div className="recordTop">
        <div>
          <div className="recordName">{safeText(record.name)}</div>
          <div className="recordId">ID: {safeText(record.userId)}</div>
        </div>
        <StatusPill status={record.status} />
      </div>
      <div className="kv">
        <div className="k">Time</div>
        <div>{safeText(record.localTime)}</div>
        <div className="k">Slot</div>
        <div>{record.slot ? record.slot : "—"}</div>
      </div>
    </div>
  );
}

// -------------------------
// App
// -------------------------
function App() {
  const [userId, setUserId] = useState("u-001");
  const [name, setName] = useState("Student");
  const [now, setNow] = useState(formatNow());

  const [filter, setFilter] = useState("All");
  const [attendance, setAttendance] = useState([]);
  const [dayKey, setDayKey] = useState("");

  const [latestResult, setLatestResult] = useState(null);
  const [marking, setMarking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(formatNow()), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Initial load: fetch attendance when page loads.
    refreshAttendance({ showToast: false });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await res.json() : await res.text();
    return { res, body };
  }

  async function refreshAttendance({ showToast = true } = {}) {
    setRefreshing(true);
    // Requirement: clear selected student / close modal on refresh
    setSelected(null);
    try {
      // Requirement: fetch() GET http://localhost:3001/attendance
      console.log("[Attendance] Refresh: GET /attendance");
      let { res, body } = await fetchJson(`${API_BASE}/attendance`);

      // Backward-compatible fallback if your backend still uses /attendance/today
      if (res.status === 404) {
        console.log("[Attendance] /attendance not found. Falling back to /attendance/today");
        ({ res, body } = await fetchJson(`${API_BASE}/attendance/today`));
      }

      console.log("[Attendance] Refresh response:", res.status, body);

      if (!res.ok) {
        throw new Error(`Refresh failed (${res.status})`);
      }

      // Support both shapes:
      // - { day, records: [...] }
      // - { records: [...] }
      // - [...]
      const records = Array.isArray(body) ? body : Array.isArray(body?.records) ? body.records : [];
      const day = body?.day || "";

      setAttendance(records);
      setDayKey(day);

      if (showToast) {
        setToast({
          title: "Log refreshed",
          subtitle: `Loaded ${records.length} record(s)${day ? ` • ${day}` : ""}`
        });
      }
    } catch (e) {
      console.error("[Attendance] Refresh error:", e);
      setToast({
        title: "Refresh failed",
        subtitle: e?.message || String(e)
      });
    } finally {
      setRefreshing(false);
    }
  }

  async function markAttendance() {
    setMarking(true);
    try {
      const payload = {
        userId: userId.trim() || "u-001",
        name: name.trim() || "Student"
      };

      console.log("[Attendance] Mark: POST /attendance", payload);
      const { res, body } = await fetchJson(`${API_BASE}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("[Attendance] Mark response:", res.status, body);

      if (!res.ok) {
        throw new Error(`Mark failed (${res.status})`);
      }
      const data = body;

      setLatestResult(data);
      await refreshAttendance({ showToast: false });

      const status = data?.status || "Absent";
      const slotText = data?.slot ? `Slot: ${data.slot}` : "Outside all slots";

      setToast({
        title: `Attendance Marked: ${status}`,
        subtitle: `${payload.name} (${payload.userId}) • ${data?.time || now} • ${slotText}`
      });
    } catch (e) {
      console.error("[Attendance] Mark error:", e);
      setToast({
        title: "Failed to mark attendance",
        subtitle: e?.message || String(e)
      });
    } finally {
      setMarking(false);
    }
  }

  const filtered = useMemo(() => {
    const list = attendance.slice().reverse(); // newest first
    if (filter === "All") return list;
    return list.filter((r) => r.status === filter);
  }, [attendance, filter]);

  const countText = `${filtered.length} / ${attendance.length}`;
  const last = latestResult?.record;
  const busy = marking || refreshing;

  return (
    <div className="container">
      <div className="card header">
        <div className="title">
          <h1>Smart Biometric Attendance</h1>
          <p className="subtitle">
            Time-slot based marking. First <b>5 min</b> = <b>On Time</b>, remaining = <b>Late</b>, otherwise{" "}
            <b>Absent</b>. Click any record to see details.
          </p>
        </div>
        <div className="clock">
          <div className="pill" style={{ color: "rgba(226,232,240,.95)" }}>
            <span className="dot" style={{ background: "var(--brand)" }} />
            Live time: <span className="now">{now}</span>
          </div>
          <div className="hint">Today: {dayKey || "—"}</div>
        </div>
      </div>

      <div className="topGrid" style={{ marginTop: 16 }}>
        <div className="card cardPad">
          <div className="formGrid">
            <div>
              <label>User ID</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="e.g., u-001" />
            </div>
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chand" />
            </div>
          </div>

          <div className="actionsRow">
            <button className="btn" onClick={markAttendance} disabled={busy}>
              {marking ? "Marking..." : "Mark Attendance"}
            </button>

            <button
              className="btn btnSecondary"
              onClick={() => {
                // Extra safety: close any open modal immediately on click
                setSelected(null);
                refreshAttendance();
              }}
              disabled={busy}
            >
              {refreshing ? "Refreshing..." : "Refresh Log"}
            </button>

            <div style={{ minWidth: 220, flex: 1 }} />

            <div style={{ minWidth: 220 }}>
              <label>Filter</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option>All</option>
                <option>On Time</option>
                <option>Late</option>
                <option>Absent</option>
              </select>
            </div>
          </div>

          <div className="slots">
            {SLOTS.map((s) => (
              <span key={s} className="slotChip">
                {s}
              </span>
            ))}
          </div>

          <div className="statusBanner" style={{ marginTop: 14 }}>
            <div className="meta">
              <div className="big">
                Latest Status:{" "}
                <span style={{ marginLeft: 8 }}>{last ? <StatusPill status={last.status} /> : "—"}</span>
              </div>
              <div className="small">
                {last
                  ? `${safeText(last.name)} (${safeText(last.userId)}) • ${safeText(last.localTime)}`
                  : "Mark attendance to see the latest result here."}
              </div>
            </div>
            {last ? (
              <button className="iconBtn" onClick={() => setSelected(last)}>
                View Details
              </button>
            ) : (
              <span className="pill" title="Waiting for a mark">
                <span className="dot" style={{ background: "rgba(148,163,184,.7)" }} /> Ready
              </span>
            )}
          </div>
        </div>

        <div className="card cardPad">
          <div className="listHeader">
            <div>
              <h2>Today’s Attendance Log</h2>
              <div className="count">
                Showing <b>{countText}</b> (filter: <b>{filter}</b>)
              </div>
            </div>
            <div className="pill" title="Status colors">
              <span className="dot" style={{ background: "var(--onTime)" }} /> On Time
              <span style={{ width: 8 }} />
              <span className="dot" style={{ background: "var(--late)" }} /> Late
              <span style={{ width: 8 }} />
              <span className="dot" style={{ background: "var(--absent)" }} /> Absent
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">No records yet for this filter. Mark attendance to create one.</div>
          ) : (
            <div className="recordsGrid">
              {filtered.map((r) => (
                <RecordCard key={r.id} record={r} onClick={(rec) => setSelected(rec)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
      <Modal record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);


