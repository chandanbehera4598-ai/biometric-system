import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
// In ES modules, __dirname is not defined; recreate it from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

/**
 * In-memory store (resets when server restarts).
 * Bonus requirement: keep attendance records in an array.
 */
const attendanceRecords = [];

/**
 * Attendance slots (24h format). Each slot is exactly 15 minutes.
 * First 5 minutes => "On Time", remaining => "Late", outside => "Absent".
 */
const SLOTS = [
  { label: "09:00-09:15", start: "09:00", end: "09:15" },
  { label: "11:00-11:15", start: "11:00", end: "11:15" },
  { label: "14:00-14:15", start: "14:00", end: "14:15" },
  { label: "16:00-16:15", start: "16:00", end: "16:15" },
  { label: "18:00-18:15", start: "18:00", end: "18:15" }
];

function toMinutesSinceMidnight(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function nowMinutesSinceMidnight(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function formatLocalTime(date = new Date()) {
  // Human-friendly local time (e.g., 09:03:12 AM)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatLocalDateKey(date = new Date()) {
  // Local day key, used to group "today"
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Core logic:
 * - If within a slot: return Present + (On Time or Late)
 * - If not within any slot: Absent
 */
function computeAttendanceStatus(date = new Date()) {
  const nowMin = nowMinutesSinceMidnight(date);

  for (const slot of SLOTS) {
    const startMin = toMinutesSinceMidnight(slot.start);
    const endMin = toMinutesSinceMidnight(slot.end);

    // Within the slot window (start inclusive, end exclusive).
    if (nowMin >= startMin && nowMin < endMin) {
      const minutesFromStart = nowMin - startMin;
      const status = minutesFromStart < 5 ? "On Time" : "Late";

      return {
        status, // On Time / Late
        present: true,
        slot: slot.label
      };
    }
  }

  // Outside all slots
  return {
    status: "Absent",
    present: false,
    slot: null
  };
}

/**
 * POST /attendance
 * Body (optional): { userId: string, name: string }
 * Returns: { status: "On Time"|"Late"|"Absent", present: boolean, time: string, slot: string|null }
 */
app.post("/attendance", (req, res) => {
  const date = new Date();
  const { userId = "u-001", name = "Student" } = req.body || {};

  const result = computeAttendanceStatus(date);
  const record = {
    id: `${formatLocalDateKey(date)}-${attendanceRecords.length + 1}`,
    userId,
    name,
    status: result.status,
    present: result.present,
    slot: result.slot,
    timestampIso: date.toISOString(),
    localTime: formatLocalTime(date),
    dayKey: formatLocalDateKey(date)
  };

  attendanceRecords.push(record);

  res.json({
    ...result,
    time: record.localTime,
    record
  });
});

/**
 * GET /attendance/today
 * Returns today's attendance records (based on local date).
 */
app.get("/attendance/today", (req, res) => {
  const todayKey = formatLocalDateKey(new Date());
  const today = attendanceRecords.filter((r) => r.dayKey === todayKey);
  res.json({ day: todayKey, count: today.length, records: today });
});

app.listen(PORT, () => {
  // Keeping this log simple and useful.
  console.log(`Attendance app running at http://localhost:${PORT}`);
});



