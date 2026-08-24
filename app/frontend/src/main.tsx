import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { SystemSettingsProvider } from './shared/context/SystemSettingsContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemSettingsProvider>
      <App />
    </SystemSettingsProvider>
  </StrictMode>,
);
