import { API_BASE } from './config';

export const STORAGE_TOKEN_KEY = 'finanzas_jwt_token';

const originalFetch = window.fetch;

window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.startsWith(API_BASE)) {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (token) {
      config = config || {};
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      };
    }
  }
  
  const response = await originalFetch(resource, config);
  
  if (response.status === 401) {
    // Si la API devuelve 401, el token es inválido o expiró
    if (!resource.includes('/api/auth/')) {
      const hadToken = !!localStorage.getItem(STORAGE_TOKEN_KEY);
      if (hadToken) {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        window.location.reload();
      }
    }
  }
  
  return response;
};
