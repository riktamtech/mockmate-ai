import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export const BackToDashboardButton = ({ className = "" }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/mockmate/candidate/dashboard")}
      className={`flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors text-sm ${className}`}
    >
      <ArrowLeft size={16} /> Back to Dashboard
    </button>
  );
};
