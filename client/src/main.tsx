import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext.tsx'
import { PresentationView } from './pages/PresentationView.tsx'

// "Cast to Table" opens a second tab at ?present=<worldId> — a read-only,
// big-screen view of the live encounter with no normal app chrome around
// it. Checked here, before AuthProvider/App even mount, since the
// presentation view needs neither.
const presentWorldId = new URLSearchParams(window.location.search).get('present')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {presentWorldId ? (
      <PresentationView worldId={presentWorldId} />
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </StrictMode>,
)
