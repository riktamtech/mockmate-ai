import React, { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const TIME_SLOTS = [
  "09:00","09:30","10:00","10:30","11:00","11:30",
  "12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30",
];

function getWeekDays(startDate) {
  const days = [];
  const start = new Date(startDate);
  start.setDate(start.getDate() - start.getDay() + 1);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function SchedulingPicker({ timeFrame, onSelect, onCancel }) {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - now.getDay() + 1);
    return mon;
  });
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const weekDays = getWeekDays(weekStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const navigateWeek = (dir) => {
    const ns = new Date(weekStart);
    ns.setDate(weekStart.getDate() + dir * 7);
    setWeekStart(ns);
    setSelectedDate(null);
    setSelectedTime(null);
  };

  const isSelectable = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    // Filter weekends and past days by default
    let isDefaultValid = d >= today && d.getDay() !== 0 && d.getDay() !== 6;
    
    // If a timeframe is provided, strictly enforce it
    if (timeFrame?.startDate && timeFrame?.endDate) {
      const start = new Date(timeFrame.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(timeFrame.endDate);
      end.setHours(0, 0, 0, 0);
      
      return isDefaultValid && d >= start && d <= end;
    }
    
    return isDefaultValid;
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      const [h, m] = selectedTime.split(":").map(Number);
      const dt = new Date(selectedDate);
      dt.setHours(h, m, 0, 0);
      onSelect?.(dt.toISOString());
    }
  };

  const btnStyle = (active) => ({
    padding: "8px",
    borderRadius: "8px",
    border: active ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
    background: active ? "var(--accent-bg)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    fontSize: "12px",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
        <Calendar size={16} style={{ color: "var(--accent)" }} /> Pick Your Interview Slot
      </h4>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigateWeek(-1)} disabled={weekStart <= today} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><ChevronLeft size={18} /></button>
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
          {weekDays[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} — {weekDays[6].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
        </span>
        <button onClick={() => navigateWeek(1)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px" }}><ChevronRight size={18} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
        {weekDays.map((day) => {
          const sel = isSelectable(day);
          const isSel = selectedDate?.toDateString() === day.toDateString();
          return (
            <button key={day.toISOString()} onClick={() => sel && (setSelectedDate(day), setSelectedTime(null))} style={{ ...btnStyle(isSel), display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", opacity: sel ? 1 : 0.3, cursor: sel ? "pointer" : "not-allowed" }}>
              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{day.toLocaleDateString("en-US",{weekday:"short"})}</span>
              <span style={{ fontSize: "14px", fontWeight: isSel ? 700 : 500, color: isSel ? "var(--accent-text)" : "var(--text-primary)" }}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p style={{ margin: "0 0 8px", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={12} /> Slots for {selectedDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px" }}>
            {TIME_SLOTS.filter(t => {
              if (timeFrame?.startDate && timeFrame?.endDate) {
                const [h, m] = t.split(":").map(Number);
                const dt = new Date(selectedDate);
                dt.setHours(h, m, 0, 0);
                const start = new Date(timeFrame.startDate);
                const end = new Date(timeFrame.endDate);
                return dt >= start && dt <= end;
              }
              return true;
            }).map((t) => <button key={t} onClick={() => setSelectedTime(t)} style={btnStyle(selectedTime === t)}>{t}</button>)}
          </div>
        </motion.div>
      )}
      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
        <button onClick={handleConfirm} disabled={!selectedDate||!selectedTime} style={{ flex: 2, padding: "12px", borderRadius: "10px", background: selectedDate&&selectedTime ? "var(--accent-gradient)" : "var(--hover-overlay-medium)", border: "none", color: selectedDate&&selectedTime ? "#fff" : "var(--text-muted)", cursor: selectedDate&&selectedTime ? "pointer" : "not-allowed", fontSize: "13px", fontWeight: 600 }}>Confirm Slot</button>
      </div>
    </div>
  );
}
