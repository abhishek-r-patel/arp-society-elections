import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SITE_TITLE } from './constants';
import './styles.css';

document.title = SITE_TITLE; // keeps the browser tab title in sync with SITE_TITLE without editing index.html

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
