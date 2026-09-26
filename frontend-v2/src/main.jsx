import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import './apiInterceptor.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster theme="dark" position="bottom-center" richColors />
  </StrictMode>,
)
