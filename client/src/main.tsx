import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './sentry.ts'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// A normal app visitor never needs this, and a cast-to-table visitor never
// needs the full tabbed app — split so neither pays for the other. This
// isn't a component module so React Fast Refresh doesn't apply here.
// oxlint-disable-next-line react/only-export-components
const PresentationView = lazy(() => import('./pages/PresentationView.tsx').then((m) => ({ default: m.PresentationView })))

// "Cast to Table" opens a second tab at ?present=<worldId> — a read-only,
// big-screen view of the live encounter with no normal app chrome around
// it. Checked here, before AuthProvider/App even mount, since the
// presentation view needs neither.
const presentWorldId = new URLSearchParams(window.location.search).get('present')

// Only registered in production builds — a service worker caching Vite's
// dev-server responses would fight its HMR and serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {presentWorldId ? (
        <Suspense fallback={null}>
          <PresentationView worldId={presentWorldId} />
        </Suspense>
      ) : (
        <AuthProvider>
          <App />
        </AuthProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
)
