import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { DataStoreProvider } from './store/dataStore.tsx'

// BASE_URL is injected by Vite from `base` in vite.config.ts.
// BrowserRouter expects no trailing slash, so strip it (keep '/' as-is).
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataStoreProvider>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </DataStoreProvider>
  </StrictMode>,
)
