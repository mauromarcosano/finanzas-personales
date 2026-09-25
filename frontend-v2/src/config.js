export const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://finanzas-personales-ynr1.onrender.com');
