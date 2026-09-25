import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Check, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../config';
import { STORAGE_TOKEN_KEY } from '../apiInterceptor';

export function getIsAuthenticated() {
  return !!localStorage.getItem(STORAGE_TOKEN_KEY);
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  window.location.reload();
}

export function hasConfiguredPin() {
  return true; // Simplificado, ya que validamos con el backend.
}

const AuthLockScreen = ({ onAuthenticated }) => {
  const [pinExists, setPinExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/status`);
        const data = await res.json();
        setPinExists(data.isSetup);
      } catch (err) {
        console.error('Error verificando estado de auth:', err);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
        setSuccess('¡Acceso concedido! Entrando...');
        setTimeout(() => {
          onAuthenticated();
        }, 500);
      } else {
        setError(data.error || 'PIN o contraseña incorrecta. Intentá de nuevo.');
        setPinInput('');
      }
    } catch (err) {
      setError('Error de red. Intenta nuevamente.');
    }
  };

  const handleSetupPin = async (e) => {
    e.preventDefault();
    setError(null);
    
    if (pinInput.length < 4) {
      setError('El PIN o clave debe tener al menos 4 caracteres.');
      return;
    }
    if (pinInput !== confirmPin) {
      setError('Los PINs no coinciden. Verificalos.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
        setSuccess('¡PIN de seguridad creado con éxito!');
        setTimeout(() => {
          onAuthenticated();
        }, 600);
      } else {
        setError(data.error || 'Error al configurar el PIN.');
      }
    } catch (err) {
      setError('Error de red. Intenta nuevamente.');
    }
  };

  if (loading) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'radial-gradient(circle at 50% 30%, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
      backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
    }}>
      <div style={{
        maxWidth: '420px', width: '100%', background: 'rgba(30, 41, 59, 0.65)', borderRadius: '1.25rem',
        border: '1px solid rgba(139, 92, 246, 0.3)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.15)',
        padding: '2rem', textAlign: 'center'
      }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '1rem',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25))',
          border: '1px solid rgba(139, 92, 246, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem auto', boxShadow: '0 8px 20px rgba(139, 92, 246, 0.2)'
        }}>
          <Lock size={32} color="#a78bfa" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#f8fafc' }}>
          {pinExists ? 'Acceso Protegido' : 'Crear PIN de Seguridad'}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0', lineHeight: 1.4 }}>
          {pinExists 
            ? 'Ingresá tu PIN para acceder a tus finanzas personales.' 
            : 'Configurá una clave de acceso rápido para proteger tu información en todos tus dispositivos.'}
        </p>

        {pinExists ? (
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="Ingresá tu PIN o clave..."
                autoFocus
                style={{
                  width: '100%', padding: '0.85rem 2.75rem 0.85rem 1rem', borderRadius: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', color: '#fff',
                  fontSize: '1.1rem', textAlign: 'center', letterSpacing: showPin ? 'normal' : '0.25em',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
              <button
                type="button" onClick={() => setShowPin(!showPin)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>}
            {success && <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.85rem' }}>{success}</div>}

            <button type="submit" className="primary" style={{ padding: '0.85rem', borderRadius: '0.75rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)' }}>
              <KeyRound size={18} /> Desbloquear
            </button>
          </form>
        ) : (
          <form onSubmit={handleSetupPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="Creá tu PIN o clave (min. 4 caract.)"
                autoFocus
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.95rem', textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={confirmPin}
                onChange={e => setConfirmPin(e.target.value)}
                placeholder="Repetí tu PIN para confirmar"
                style={{
                  width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)', color: '#fff', fontSize: '0.95rem', textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            {error && <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>}
            {success && <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.85rem' }}>{success}</div>}

            <button type="submit" className="primary" style={{ padding: '0.85rem', borderRadius: '0.75rem', fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
              <ShieldCheck size={18} /> Guardar PIN y Acceder
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthLockScreen;
