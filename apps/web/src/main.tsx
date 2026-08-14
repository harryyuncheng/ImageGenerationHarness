import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { installPointerHoverTracking } from './pointer-hover.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

installPointerHoverTracking();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { refetchInterval: 3_000 } } })}
    >
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
