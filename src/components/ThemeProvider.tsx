import React, { useEffect } from 'react';
import { useUIStore } from '../stores/useUIStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, setTheme } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all existing theme classes
    root.classList.remove('light', 'dark', 'black');
    root.removeAttribute('data-theme');
    
    // Apply the selected theme
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);

    // Add CSS custom properties for the black theme
    if (theme === 'black') {
      document.documentElement.style.setProperty('--bg-primary', '#181818');
      document.documentElement.style.setProperty('--bg-secondary', '#242424');
      document.documentElement.style.setProperty('--bg-tertiary', '#2a2a2a');
      document.documentElement.style.setProperty('--text-primary', '#ffffff');
      document.documentElement.style.setProperty('--text-secondary', '#e5e5e5');
      document.documentElement.style.setProperty('--text-muted', '#a3a3a3');
      document.documentElement.style.setProperty('--border-primary', '#404040');
      document.documentElement.style.setProperty('--border-secondary', '#505050');
      document.documentElement.style.setProperty('--accent-primary', '#3b82f6');
      document.documentElement.style.setProperty('--accent-secondary', '#1d4ed8');
    } else {
      // Remove black theme CSS variables
      document.documentElement.style.removeProperty('--bg-primary');
      document.documentElement.style.removeProperty('--bg-secondary');
      document.documentElement.style.removeProperty('--bg-tertiary');
      document.documentElement.style.removeProperty('--text-primary');
      document.documentElement.style.removeProperty('--text-secondary');
      document.documentElement.style.removeProperty('--text-muted');
      document.documentElement.style.removeProperty('--border-primary');
      document.documentElement.style.removeProperty('--border-secondary');
      document.documentElement.style.removeProperty('--accent-primary');
      document.documentElement.style.removeProperty('--accent-secondary');
    }
  }, [theme]);

  return <>{children}</>;
}; 