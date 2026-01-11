import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { FeedbackView } from './FeedbackView';
import { LogOut } from 'lucide-react';

export const ReportView = () => {
  const navigate = useNavigate();
  const { feedbackData, setFeedbackData, setUser } = useAppStore();

  const handleGoToDashboard = () => {
    setFeedbackData(null);
    navigate('/mockmate/candidate/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setFeedbackData(null);
    navigate('/mockmate/login');
  };

  if (!feedbackData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4 relative">
        <button 
          onClick={handleLogout} 
          className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <LogOut size={18} />
          Logout
        </button>
        <h2 className="text-xl font-semibold text-slate-800">No report data available</h2>
        <button
          onClick={handleGoToDashboard}
          className="text-blue-600 hover:text-blue-700 underline"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button 
        onClick={handleLogout} 
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md z-10"
      >
        <LogOut size={18} />
        Logout
      </button>
      <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />
    </div>
  );
};
