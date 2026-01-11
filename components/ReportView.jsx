import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { FeedbackView } from './FeedbackView';

export const ReportView = () => {
  const navigate = useNavigate();
  const { feedbackData, setFeedbackData } = useAppStore();

  const handleGoToDashboard = () => {
    setFeedbackData(null);
    navigate('/mockmate/candidate/dashboard');
  };

  if (!feedbackData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
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

  return <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />;
};
