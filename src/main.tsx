// Intercept and gracefully ignore third-party SDK sandbox-induced unhandled exceptions
if (typeof window !== "undefined") {
  // 1. legacy window.onerror (highly effective for suppressing console bubble exceptions)
  const prevOnError = window.onerror;
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || "");
    const src = String(source || "");
    const errStr = error ? String(error.stack || error.message || error) : "";
    if (
      msg.toLowerCase().includes("paypal") ||
      msg.toLowerCase().includes("paypal_js_sdk") ||
      src.toLowerCase().includes("paypal") ||
      msg.toLowerCase().includes("script error") ||
      msg.toLowerCase().includes("illegal constructor") ||
      errStr.toLowerCase().includes("paypal") ||
      errStr.toLowerCase().includes("paypal_js_sdk") ||
      errStr.toLowerCase().includes("illegal constructor") ||
      src.toLowerCase().includes("accounts.google.com")
    ) {
      console.warn("[Handled Third-Party / SDK Error via window.onerror]:", msg, "at", src);
      return true; // return true to completely suppress the error
    }
    if (prevOnError) {
      return prevOnError.apply(this, arguments as any);
    }
    return false;
  };

  // 2. Capture error events
  window.addEventListener("error", (event) => {
    const msg = event.message || "";
    const url = event.filename || "";
    const error = event.error;
    const errStr = error ? String(error.stack || error.message || error) : "";
    if (
      msg.toLowerCase().includes("paypal") ||
      msg.toLowerCase().includes("paypal_js_sdk") ||
      url.toLowerCase().includes("paypal") ||
      msg.toLowerCase().includes("script error") ||
      msg.toLowerCase().includes("illegal constructor") ||
      errStr.toLowerCase().includes("paypal") ||
      errStr.toLowerCase().includes("paypal_js_sdk") ||
      errStr.toLowerCase().includes("illegal constructor") ||
      url.toLowerCase().includes("accounts.google.com")
    ) {
      console.warn("[Handled Third-Party / SDK Error via addEventListener]:", msg, "at", url);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // 3. Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const reasonStr = reason ? String(reason.stack || reason.message || reason) : "";
    if (
      reasonStr.toLowerCase().includes("paypal") ||
      reasonStr.toLowerCase().includes("paypal_js_sdk") ||
      reasonStr.toLowerCase().includes("script error") ||
      reasonStr.toLowerCase().includes("illegal constructor")
    ) {
      console.warn("[Handled Third-Party / SDK Promise Rejection via addEventListener]:", reasonStr);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && window.self === window.top) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('ServiceWorker registered successfully with scope: ', registration.scope);
        })
        .catch((err) => {
          console.warn('ServiceWorker registration not supported or denied: ', err);
        });
    } catch (e) {
      console.warn('ServiceWorker registration failed synchronously: ', e);
    }
  });
}
