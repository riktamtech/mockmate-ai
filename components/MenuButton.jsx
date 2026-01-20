import React from 'react';
import { Menu } from 'lucide-react';

export const MenuButton = ({ onClick, className = '' }) => (
  <button 
    onClick={onClick}
    className={`p-2.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 shadow-sm transition-all active:scale-95 ${className}`}
    aria-label="Open Menu"
  >
    <Menu size={20} />
  </button>
);
