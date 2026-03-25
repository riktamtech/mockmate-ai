import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, TrendingUp, FileText, CheckCircle, XCircle, Clock, Users,
  Zap, Activity, Target, Award, ArrowUpRight, ArrowDownRight, Sparkles, Eye,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie,
  Cell, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, LineChart, Line, CartesianGrid, Legend, Treemap,
} from "recharts";
import { analyticsService } from "../../services/analyticsService";
import { BackToDashboardButton } from "../ui/BackToDashboardButton";

// ── Data-series Color Palette (intentionally static — these are chart colors, not surface colors) ──
const COLORS = {
  violet: "#8B5CF6", blue: "#3B82F6", emerald: "#10B981",
  amber: "#F59E0B", rose: "#EF4444", indigo: "#6366F1",
  cyan: "#06B6D4", pink: "#EC4899", teal: "#14B8A6", slate: "#64748B",
};
const CHART_COLORS = Object.values(COLORS);

// ── Custom Tooltip (theme-aware) ──
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--chart-tooltip-bg)", backdropFilter: "blur(12px)",
      border: "1px solid var(--chart-tooltip-border)", borderRadius: "12px",
      padding: "12px 16px", boxShadow: "var(--bg-glass-shadow)",
    }}>
      <p style={{ margin: "0 0 6px", fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ margin: "2px 0", fontSize: "13px", color: entry.color || "var(--text-primary)", fontWeight: 600 }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};

// ── Animated Counter ──
function AnimatedNumber({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = typeof value === "number" ? value : 0;
    if (end === 0) { setDisplay(0); return; }
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(Math.round(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{typeof value === "string" && value.includes("%") ? `${display}%` : display.toLocaleString()}</>;
}

// ── Stat Card (theme-aware) ──
function StatCard({ icon: Icon, label, value, color, trend, trendValue, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4, boxShadow: `0 20px 60px ${color}20` }}
      style={{
        padding: "20px", borderRadius: "16px", flex: "1 1 150px",
        background: "var(--bg-surface)", backdropFilter: "blur(10px)",
        border: "1px solid var(--border-subtle)",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: "absolute", top: "-20px", right: "-20px",
        width: "80px", height: "80px", borderRadius: "50%",
        background: `radial-gradient(circle, ${color}15, transparent)`,
      }} />
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", position: "relative" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "10px",
          background: `linear-gradient(135deg, ${color}20, ${color}08)`,
          border: `1px solid ${color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px", position: "relative" }}>
        <span style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>
          <AnimatedNumber value={typeof value === "string" ? parseInt(value) || 0 : value} />
          {typeof value === "string" && value.includes("%") ? "%" : ""}
        </span>
        {trend && (
          <span style={{
            display: "flex", alignItems: "center", gap: "2px", fontSize: "11px", fontWeight: 600,
            color: trend === "up" ? "var(--success)" : "var(--error)", padding: "2px 6px",
            borderRadius: "6px", background: trend === "up" ? "var(--success-bg)" : "var(--error-bg)",
          }}>
            {trend === "up" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trendValue}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Chart Card Wrapper (theme-aware) ──
function ChartCard({ title, subtitle, children, delay = 0, span = 1 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 150 }}
      style={{
        padding: "24px", borderRadius: "16px",
        background: "var(--bg-surface)", backdropFilter: "blur(10px)",
        border: "1px solid var(--border-subtle)",
        gridColumn: span > 1 ? `span ${span}` : undefined,
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

// ── Main Component ──
export default function JobAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("4w");

  useEffect(() => {
    (async () => {
      try {
        const res = await analyticsService.getSummary();
        if (res.success) setData(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const summary = useMemo(() => data?.summary || {}, [data]);

  const statusData = useMemo(() =>
    (data?.statusDistribution || []).map((d, i) => ({
      name: (d._id || "Unknown").replace(/_/g, " "),
      value: d.count,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })), [data]);

  const weeklyData = useMemo(() =>
    (data?.weeklyActivity || []).map(d => ({
      week: d._id,
      applications: d.applications || 0,
      avgScore: Math.round(d.avgScore || 0),
      approved: d.approved || 0,
      rejected: d.rejected || 0,
    })), [data]);

  const radarData = useMemo(() => [
    { metric: "Applications", value: Math.min(summary.totalApplications || 0, 100), fullMark: 100 },
    { metric: "Approval Rate", value: summary.totalApplications ? Math.round(((summary.approved || 0) / summary.totalApplications) * 100) : 0, fullMark: 100 },
    { metric: "Avg Score", value: Math.round(summary.avgFitnessScore || 0), fullMark: 100 },
    { metric: "Interview Rate", value: summary.totalApplications ? Math.round(((summary.interviewsCompleted || 0) / summary.totalApplications) * 100) : 0, fullMark: 100 },
    { metric: "Response Rate", value: Math.round(summary.recruiterResponseRate || 0), fullMark: 100 },
    { metric: "Completion", value: summary.totalApplications ? Math.round(((summary.interviewsCompleted || 0) / Math.max(summary.approved || 1, 1)) * 100) : 0, fullMark: 100 },
  ], [summary]);

  const growthData = useMemo(() => {
    let cumulative = 0;
    return weeklyData.map(w => {
      cumulative += w.applications;
      return { week: w.week, cumulative, applications: w.applications };
    });
  }, [weeklyData]);

  const fitnessDistribution = useMemo(() =>
    (data?.fitnessHistogram || [
      { range: "0-20", count: 2 }, { range: "20-40", count: 5 },
      { range: "40-60", count: 12 }, { range: "60-80", count: 18 },
      { range: "80-100", count: 8 },
    ]).map((d, i) => ({
      range: d.range || d._id,
      count: d.count,
      fill: [COLORS.rose, COLORS.amber, COLORS.amber, COLORS.blue, COLORS.emerald][i] || COLORS.slate,
    })), [data]);

  const skillMatchData = useMemo(() =>
    (data?.topSkills || [
      { name: "React", size: 85 }, { name: "Node.js", size: 72 },
      { name: "Python", size: 65 }, { name: "TypeScript", size: 58 },
      { name: "MongoDB", size: 45 }, { name: "AWS", size: 38 },
      { name: "Docker", size: 30 }, { name: "SQL", size: 25 },
    ]), [data]);

  const timeRangeStyle = useCallback((active) => ({
    padding: "6px 14px", borderRadius: "8px", border: "none",
    background: active ? "var(--accent-bg)" : "transparent",
    color: active ? "var(--accent-text)" : "var(--text-muted)",
    fontSize: "12px", fontWeight: active ? 600 : 400, cursor: "pointer",
    transition: "all 0.2s",
  }), []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "16px" }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          style={{ width: "40px", height: "40px", border: "3px solid var(--spinner-track)", borderTop: "3px solid var(--spinner-fill)", borderRadius: "50%" }} />
        <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
          style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>Loading analytics...</motion.p>
      </div>
    );
  }

  const approvalRate = summary.totalApplications ? Math.round(((summary.approved || 0) / summary.totalApplications) * 100) : 0;
  const responseRate = Math.round(summary.recruiterResponseRate || 0);

  /* Chart theming: use CSS vars via getComputedStyle for axis/grid colors */
  const chartGridColor = "var(--chart-grid)";
  const chartAxisStyle = { fill: "var(--chart-axis-label)", fontSize: 10 };

  return (
    <div style={{ padding: "32px 24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <BackToDashboardButton />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "14px",
            background: "var(--accent-gradient)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 32px rgba(139,92,246,0.3)",
          }}>
            <BarChart3 size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>Job Analytics</h1>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>Your career journey at a glance</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "var(--hover-overlay)", borderRadius: "10px", padding: "3px" }}>
          {["1w", "2w", "4w", "3m", "all"].map(r => (
            <button key={r} onClick={() => setTimeRange(r)} style={timeRangeStyle(timeRange === r)}>{r === "all" ? "All" : r}</button>
          ))}
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px" }}>
        <StatCard icon={FileText} label="Applications" value={summary.totalApplications || 0} color={COLORS.violet} trend="up" trendValue="+12%" delay={0} />
        <StatCard icon={CheckCircle} label="Approved" value={summary.approved || 0} color={COLORS.emerald} trend="up" trendValue={`${approvalRate}%`} delay={0.05} />
        <StatCard icon={XCircle} label="Rejected" value={summary.rejected || 0} color={COLORS.rose} delay={0.1} />
        <StatCard icon={Clock} label="Pending" value={summary.pendingApproval || 0} color={COLORS.amber} delay={0.15} />
        <StatCard icon={Users} label="Interviews" value={summary.interviewsCompleted || 0} color={COLORS.blue} delay={0.2} />
        <StatCard icon={Target} label="Avg Score" value={`${Math.round(summary.avgFitnessScore || 0)}%`} color={COLORS.indigo} delay={0.25} />
      </div>

      {/* Charts Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        {/* Weekly Activity */}
        <ChartCard title="Weekly Activity" subtitle="Applications & approvals over time" delay={0.3} span={2}>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.violet} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.violet} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradEmerald" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.emerald} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.emerald} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="week" tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="applications" stroke={COLORS.violet} fill="url(#gradViolet)" strokeWidth={2} name="Applications" />
                <Area type="monotone" dataKey="approved" stroke={COLORS.emerald} fill="url(#gradEmerald)" strokeWidth={2} name="Approved" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", fontSize: "13px" }}>No activity data yet</p>}
        </ChartCard>

        {/* Status Distribution Donut */}
        <ChartCard title="Status Distribution" subtitle="Application outcomes" delay={0.35}>
          {statusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value"
                    stroke="rgba(0,0,0,0.3)" strokeWidth={1}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginTop: "8px" }}>
                {statusData.map((entry, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "3px", background: entry.fill }} />
                    <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", fontSize: "13px" }}>No data</p>}
        </ChartCard>

        {/* Performance Radar */}
        <ChartCard title="Performance Radar" subtitle="Multi-dimensional profile analysis" delay={0.4}>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="var(--border-subtle)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Profile" dataKey="value" stroke={COLORS.violet} fill={COLORS.violet} fillOpacity={0.15} strokeWidth={2} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Growth Trajectory */}
        <ChartCard title="Growth Trajectory" subtitle="Cumulative applications over time" delay={0.45}>
          {growthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData}>
                <defs>
                  <linearGradient id="gradGrowth" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={COLORS.cyan} />
                    <stop offset="100%" stopColor={COLORS.violet} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="week" tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="cumulative" stroke="url(#gradGrowth)" strokeWidth={3} dot={{ fill: COLORS.violet, r: 4 }} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px", fontSize: "13px" }}>No growth data</p>}
        </ChartCard>

        {/* Fitness Score Distribution */}
        <ChartCard title="Fitness Score Distribution" subtitle="Resume match quality breakdown" delay={0.5}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={fitnessDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="range" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Applications">
                {fitnessDistribution.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Response Rate Gauge */}
        <ChartCard title="Recruiter Response Rate" subtitle="How quickly recruiters act on applications" delay={0.55}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "12px 0" }}>
            <div style={{ position: "relative", width: "140px", height: "140px" }}>
              <svg viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="70" cy="70" r="60" fill="none" stroke="var(--border-subtle)" strokeWidth="12" />
                <motion.circle cx="70" cy="70" r="60" fill="none" stroke={COLORS.emerald} strokeWidth="12" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 60}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 60 * (1 - responseRate / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: "32px", fontWeight: 700, color: "var(--text-primary)" }}>
                  <AnimatedNumber value={responseRate} />
                </span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>%</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
              {responseRate >= 80 ? "Excellent response rate!" : responseRate >= 50 ? "Good — most recruiters are responding" : "Low — keep applying to increase your chances"}
            </p>
          </div>
        </ChartCard>
      </div>

      {/* Insights Row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        style={{
          padding: "20px 24px", borderRadius: "16px",
          background: "var(--accent-bg)",
          border: "1px solid var(--notification-unread-border)",
          display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
        }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "12px",
          background: "var(--accent-gradient)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>AI Insights</p>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {summary.totalApplications >= 10
              ? `You've applied to ${summary.totalApplications} jobs with a ${approvalRate}% approval rate. ${approvalRate >= 60 ? "Great performance!" : "Try targeting roles with higher fitness scores."}`
              : "Apply to more jobs to unlock personalized career insights and recommendations."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: "10px", background: "var(--hover-overlay-medium)" }}>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: COLORS.emerald }}>{approvalRate}%</p>
            <p style={{ margin: "2px 0 0", fontSize: "10px", color: "var(--text-muted)" }}>Success Rate</p>
          </div>
          <div style={{ textAlign: "center", padding: "8px 16px", borderRadius: "10px", background: "var(--hover-overlay-medium)" }}>
            <p style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: COLORS.violet }}>{Math.round(summary.avgFitnessScore || 0)}</p>
            <p style={{ margin: "2px 0 0", fontSize: "10px", color: "var(--text-muted)" }}>Avg Score</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
