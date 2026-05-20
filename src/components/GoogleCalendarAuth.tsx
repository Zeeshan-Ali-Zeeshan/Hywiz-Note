import React, { useState, useEffect } from 'react';
import { Plus, Loader2, LogOut } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { useCalendarStore } from '../stores/useCalendarStore';
import { googleCalendarService } from '../lib/googleCalendar';

interface GoogleCalendarAuthProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const GoogleCalendarAuth: React.FC<GoogleCalendarAuthProps> = ({
  onSuccess,
  onError,
  className = ''
}) => {
  const {
    isGoogleCalendarConnected,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    reconnectGoogleCalendar,
    error
  } = useCalendarStore();

  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const configured = googleCalendarService.isConfigured();
      setIsConfigured(configured);
    } catch (error) {
      setIsConfigured(false);
    }
  }, []);

  useEffect(() => {
    if (error) {
      setAuthError(error);
      onError?.(error);
    }
  }, [error, onError]);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setIsLoading(true);
        setAuthError(null);

        // Store access token
        localStorage.setItem('google_access_token', tokenResponse.access_token);

        // Store expiration time (current time + expires_in seconds)
        const expiryTime = Date.now() + (tokenResponse.expires_in * 1000);
        localStorage.setItem('google_token_expiry', expiryTime.toString());

        // Set persistent connection flag
        localStorage.setItem('google_calendar_connected', 'true');

        await connectGoogleCalendar();
        onSuccess?.();
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to connect to Google Calendar';
        setAuthError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      const errorMessage = 'Google login failed. Please try again.';
      setAuthError(errorMessage);
      onError?.(errorMessage);
      setIsLoading(false);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
    flow: 'implicit'
  });


  const handleReconnect = async () => {
    try {
      setIsLoading(true);
      setAuthError(null);
      await reconnectGoogleCalendar();
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to reconnect to Google Calendar';
      setAuthError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    setIsLoading(true);
    setAuthError(null);
    login();
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      localStorage.removeItem('google_access_token');
      localStorage.removeItem('google_token_expiry');
      localStorage.setItem('google_calendar_connected', 'false');
    } catch (error) {
      console.error('Failed to disconnect from Google Calendar:', error);
    }
  };

  if (isGoogleCalendarConnected) {
    return (
      <div className={`group flex items-center justify-between p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            <img src="/src/pages/google-icon.png" className="w-4 h-4 opacity-80" alt="Google" />
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 black:text-gray-300 truncate max-w-[140px]">
            Google Calendar
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="
          p-1.5 
          text-gray-400 
          rounded-md 
          transition-colors duration-200 
          opacity-0 group-hover:opacity-100
          "
          title="Disconnect Google Calendar"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const isAuthError = authError && (
    authError.includes('authentication expired') ||
    authError.includes('re-authenticate') ||
    authError.includes('Authentication failed') ||
    authError.includes('not initialized')
  );

  return (
    <div className={className}>
      <button
        onClick={isAuthError ? handleReconnect : handleConnect}
        disabled={isLoading || (!isAuthError && !isConfigured)}
        className="w-full flex items-center justify-between p-2 rounded-lg 
             hover:bg-black/5 dark:hover:bg-white/5 
             transition-all duration-200 
             group border border-transparent 
             hover:border-gray-200 dark:hover:border-gray-700 black:hover:border-[#3a3a3a]"
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <img
                src="/src/pages/google-icon.png"
                className="w-4 h-4 opacity-90"
                alt="Google"
              />
            )}
          </div>

          <span
            className={`
                 text-sm font-medium
                 text-gray-600 dark:text-gray-400 black:text-gray-400
                 group-hover:text-white
                 transition-colors duration-200`}
          >
            {isAuthError ? 'Reconnect Google' : 'Google'}
          </span>
        </div>

        <div className="p-1 text-gray-400 group-hover:text-blue-500 transition-colors duration-200">
          <Plus className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
};

export default GoogleCalendarAuth; 