import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Users, FileText, Activity, Zap, Coins, BarChart3 } from "lucide-react";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
);

export const StatsCard = ({
  icon: Icon,
  label,
  value,
  bgColor,
  textColor,
  tooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className={`p-3 ${bgColor} ${textColor} rounded-xl`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      </div>

      <div
        className={`absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap z-50 transition-all duration-300 ease-out pointer-events-none transform ${
          showTooltip
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-2 scale-95"
        }`}
      >
        {tooltip}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900/90"></div>
      </div>
    </div>
  );
};

const DashboardStats = ({ stats, userGrowth }) => {
  if (!stats) {
    return (
      <div className="space-y-6">
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4"
            >
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-80 flex flex-col"
            >
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="flex-1 w-full relative">
                <Skeleton className="absolute inset-0 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pieData = Object.entries(stats.interviewsByStatus || {}).map(
    ([name, value]) => ({
      name: name.replace("_", " "),
      value,
    }),
  );

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatsCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          bgColor="bg-blue-100"
          textColor="text-blue-600"
          tooltip="Total number of registered candidates on the platform, excluding test accounts."
        />

        <StatsCard
          icon={FileText}
          label="Total Interviews"
          value={stats.totalInterviews}
          bgColor="bg-purple-100"
          textColor="text-purple-600"
          tooltip="Total number of mock interviews taken by all users"
        />

        <StatsCard
          icon={Activity}
          label="Active Users"
          value={stats.activeUsersCount}
          bgColor="bg-emerald-100"
          textColor="text-emerald-600"
          tooltip="Number of unique users who have participated in at least one interview"
        />

        <StatsCard
          icon={BarChart3}
          label="Completion Rate"
          value={`${
            stats.totalInterviews
              ? Math.round(
                  ((stats.interviewsByStatus?.COMPLETED || 0) /
                    stats.totalInterviews) *
                    100,
                )
              : 0
          }%`}
          bgColor="bg-orange-100"
          textColor="text-orange-600"
          tooltip="Percentage of started interviews that were successfully completed"
        />

        <StatsCard
          icon={Zap}
          label="Total Tokens"
          value={stats.tokenStats?.totalTokens?.toLocaleString() || "0"}
          bgColor="bg-yellow-100"
          textColor="text-yellow-600"
          tooltip={
            <div>
              <p>
                Input tokens:{" "}
                {stats.tokenStats?.totalInputTokens?.toLocaleString() || 0}
              </p>
              <p>
                Output tokens:{" "}
                {stats.tokenStats?.totalOutputTokens?.toLocaleString() || 0}
              </p>
            </div>
          }
        />

        <StatsCard
          icon={Coins}
          label="Est. Cost"
          value={`$${(stats.tokenStats?.totalCost || 0).toFixed(4)}`}
          bgColor="bg-green-100"
          textColor="text-green-600"
          tooltip="Total estimated cost based on token usage"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">
            Interview Status Distribution
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold mb-1 text-slate-800">
            New User Registrations
          </h3>
          <p className="text-xs text-slate-400 mb-4">Last 7 days</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={userGrowth}
                margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
              >
                <defs>
                  <linearGradient
                    id="growthGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop
                      offset="95%"
                      stopColor="#8b5cf6"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.9)",
                    border: "none",
                    borderRadius: "10px",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                    padding: "10px 14px",
                  }}
                  itemStyle={{ color: "#e2e8f0", fontSize: 13 }}
                  labelStyle={{
                    color: "#94a3b8",
                    fontSize: 11,
                    marginBottom: 4,
                  }}
                  formatter={(value) => [
                    `${value} new user${value !== 1 ? "s" : ""}`,
                    "Registrations",
                  ]}
                  cursor={{
                    stroke: "#8b5cf6",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#growthGradient)"
                  dot={{
                    r: 4,
                    fill: "#8b5cf6",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                  activeDot={{
                    r: 6,
                    fill: "#7c3aed",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
