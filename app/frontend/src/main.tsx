import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { AuthProvider } from './shared/AuthContext';
import { SystemSettingsProvider } from './context/SystemSettingsContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SystemSettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SystemSettingsProvider>
  </React.StrictMode>,
);
