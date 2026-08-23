import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SystemSettingsProvider } from './context/SystemSettingsContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemSettingsProvider>
      <App />
    </SystemSettingsProvider>
  </StrictMode>,
);

