import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.tsx';
import './index.css';
import './black-theme.css';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Debug: Check if environment variable is loaded
console.log('🔍 Environment variables check:');
console.log('VITE_GOOGLE_CLIENT_ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
console.log('NODE_ENV:', import.meta.env.NODE_ENV);
console.log('MODE:', import.meta.env.MODE);
console.log('All env vars:', import.meta.env);

if (!clientId) {
  console.error('❌ VITE_GOOGLE_CLIENT_ID is not set!');
  console.error('Please create a .env file with: VITE_GOOGLE_CLIENT_ID=your_client_id_here');
  console.error('Or set the environment variable in your system.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#fef2f2',
        color: '#dc2626',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <h1>🚨 Configuration Error</h1>
        <p><strong>VITE_GOOGLE_CLIENT_ID</strong> environment variable is not set.</p>
        <div style={{ 
          backgroundColor: '#f3f4f6', 
          padding: '15px', 
          borderRadius: '8px', 
          margin: '20px 0',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <p>Please create a <code>.env</code> file in your project root with:</p>
          <code>VITE_GOOGLE_CLIENT_ID=your_google_client_id_here</code>
        </div>
        <p>Get your Client ID from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>Google Cloud Console</a></p>
        <p>See <code>GOOGLE_CALENDAR_SETUP.md</code> for detailed instructions.</p>
      </div>
    )}
  </StrictMode>
);
