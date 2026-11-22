import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './state/store';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './state/auth';
import { installGlobalHandlers } from './state/telemetry';
import { installGlobalInstallHandlers } from './state/install';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import './styles/peakx.css';

installGlobalHandlers();
installGlobalInstallHandlers();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </AppProvider>
  </React.StrictMode>,
);
