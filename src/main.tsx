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
