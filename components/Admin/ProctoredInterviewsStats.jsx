import React from "react";
import { Shield, CheckCircle, PlayCircle, Target, TrendingUp } from "lucide-react";
import { StatsCard } from "./DashboardStats";

const ProctoredInterviewsStats = ({ proctoredStats }) => {
  if (!proctoredStats) return null;

  return (
    <>
      <h1 className="text-2xl font-bold text-slate-900 pt-8">
        Proctored Interviews Statistics & Overview
      </h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatsCard
          icon={Shield}
          label="Total Proctored"
          value={proctoredStats.totalProctored}
          bgColor="bg-amber-50"
          textColor="text-amber-600"
          tooltip="Total proctored interviews created"
        />
        <StatsCard
          icon={CheckCircle}
          label="Completed"
          value={proctoredStats.byStatus?.COMPLETED || 0}
          bgColor="bg-emerald-50"
          textColor="text-emerald-600"
          tooltip="Interviews completed"
        />
        <StatsCard
          icon={PlayCircle}
          label="In Progress"
          value={proctoredStats.byStatus?.IN_PROGRESS || 0}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          tooltip="Interviews currently in progress"
        />
        <StatsCard
          icon={Target}
          label="Completion Rate"
          value={`${proctoredStats.completionRate}%`}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
          tooltip="Percentage of scheduled interviews that completed"
        />
        <StatsCard
          icon={TrendingUp}
          label="Top Scorers"
          value={`${proctoredStats.totalProctored > 0 && proctoredStats.byStatus?.COMPLETED ? Math.round(((proctoredStats.topScorersAbove75 || 0) / proctoredStats.byStatus.COMPLETED) * 100) : 0}%`}
          bgColor="bg-purple-50"
          textColor="text-purple-600"
          tooltip="Percentage of completed interviews with performance score above 75%"
        />
      </div>
    </>
  );
};

export default ProctoredInterviewsStats;
