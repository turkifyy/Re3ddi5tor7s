
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// PRODUCTION MODE: StrictMode removed to prevent double API calls which cost money/quota.
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
