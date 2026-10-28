import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import '@fontsource-variable/manrope';
import App from './App.jsx';
import './index.css';
// Событие beforeinstallprompt приходит один раз и может случиться до того, как смонтируется
// React. Регистрируем перехват на старте, даже если пользователь открыл не главную страницу.
import './lib/install.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>
);
