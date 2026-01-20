import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { FeedbackView } from './FeedbackView';
import { SideDrawer } from './SideDrawer';
import { MenuButton } from './MenuButton';

export const ReportView = () => {
  const navigate = useNavigate();
  const { feedbackData, setFeedbackData, setUser } = useAppStore();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const handleGoToDashboard = () => {
    setFeedbackData(null);
    navigate('/mockmate/candidate/dashboard');
  };

  if (!feedbackData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4 relative">
        <div className="absolute top-6 right-6 z-10">
            <MenuButton onClick={() => setIsDrawerOpen(true)} />
        </div>
        <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        
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
      <div className="absolute top-6 right-6 z-10">
        <MenuButton onClick={() => setIsDrawerOpen(true)} />
      </div>
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      
      <FeedbackView data={feedbackData} onHome={handleGoToDashboard} />
    </div>
  );
};
