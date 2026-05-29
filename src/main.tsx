import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './authConfig';
import './index.css';
import App from './App.tsx';

const startApp = async () => {
  let msalInstance: PublicClientApplication;
  try {
    msalInstance = new PublicClientApplication(msalConfig);
    await msalInstance.initialize();
    await msalInstance.handleRedirectPromise();
  } catch (e) {
    console.error("MSAL initialization failed, falling back to dummy client config", e);
    // Create dummy client to ensure MsalProvider does not crash in Offline Mode
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: "00000000-0000-0000-0000-000000000000",
        authority: "https://login.microsoftonline.com/common",
        redirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "sessionStorage"
      }
    });
    try {
      await msalInstance.initialize();
      await msalInstance.handleRedirectPromise();
    } catch (err) {
      console.error("Critical fallback MSAL initialization failed", err);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App msalInstance={msalInstance} />
    </StrictMode>,
  );
};

startApp();
