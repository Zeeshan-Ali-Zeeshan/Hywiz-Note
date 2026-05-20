import React from 'react';
import { Sidebar } from './Sidebar';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900 black:bg-black overflow-hidden font-['Segoe UI','Helvetica Neue',Arial,sans-serif] max-w-[1920px] mx-auto w-full transition-colors duration-200">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
        <main className="flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 