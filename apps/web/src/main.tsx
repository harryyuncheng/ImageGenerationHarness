import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app/router.js';
import { installPointerHoverTracking } from './shared/pointer-hover.js';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

installPointerHoverTracking();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
