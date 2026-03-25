import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Building2, ChevronRight, History } from "lucide-react";
import { eventsService } from "../../services/eventsService";
import { BackToDashboardButton } from "../ui/BackToDashboardButton";

/* Data-series colors for event status — intentionally static (semantic, not surface) */
const STATUS_COLORS = {
  APPROVED: "#10B981",
  INTERVIEW_SCHEDULED: "#3B82F6",
  INTERVIEW_IN_PROGRESS: "#F59E0B",
  PENDING_APPROVAL: "#EAB308",
  INTERVIEW_COMPLETED: "#8B5CF6",
  REJECTED: "#EF4444",
  WITHDRAWN: "#6B7280",
};

function EventCard({ event }) {
  const color = STATUS_COLORS[event.status] || "#6B7280";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "var(--shadow-card-hover)" }}
      style={{
        padding: "16px", borderRadius: "14px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        display: "flex", gap: "14px", cursor: "pointer",
      }}
    >
      <div style={{ width: "4px", borderRadius: "2px", background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{event.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted)" }}>
            <Building2 size={12} />{event.orgName}
          </span>
          {event.scheduledAt && (
            <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color }}>
              <Clock size={12} />
              {new Date(event.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
        <span style={{ display: "inline-block", marginTop: "8px", padding: "3px 10px", borderRadius: "8px", background: `${color}15`, color, fontSize: "11px", fontWeight: 500 }}>
          {event.status.replace(/_/g, " ")}
        </span>
      </div>
      <ChevronRight size={16} style={{ color: "var(--text-muted)", alignSelf: "center" }} />
    </motion.div>
  );
}

export default function EventsPage() {
  const [tab, setTab] = useState("upcoming");
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEvents(); }, [tab]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      if (tab === "upcoming") {
        const res = await eventsService.getUpcoming();
        if (res.success) setUpcoming(res.data || []);
      } else {
        const res = await eventsService.getPast();
        if (res.success) setPast(res.data || []);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const events = tab === "upcoming" ? upcoming : past;

  const tabStyle = (active) => ({
    padding: "8px 20px", borderRadius: "10px", border: "none",
    background: active ? "var(--accent-bg)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    fontSize: "13px", fontWeight: active ? 600 : 400, cursor: "pointer",
  });

  return (
    <div style={{ padding: "32px 24px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <BackToDashboardButton />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <Calendar size={22} style={{ color: "var(--accent)" }} />
        <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "var(--text-primary)" }}>Events</h1>
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "var(--hover-overlay)", borderRadius: "12px", padding: "4px" }}>
        <button onClick={() => setTab("upcoming")} style={tabStyle(tab === "upcoming")}>Upcoming</button>
        <button onClick={() => setTab("past")} style={tabStyle(tab === "past")}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><History size={14} />Past</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ width: "24px", height: "24px", border: "2px solid var(--spinner-track)", borderTop: "2px solid var(--spinner-fill)", borderRadius: "50%" }} />
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
          <Calendar size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
          <p style={{ margin: 0, fontSize: "14px" }}>No {tab} events</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {events.map((event) => <EventCard key={event.id} event={event} />)}
        </div>
      )}
    </div>
  );
}
