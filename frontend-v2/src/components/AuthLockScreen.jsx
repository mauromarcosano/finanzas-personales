import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, Check, ShieldCheck, Eye, EyeOff, LogOut } from 'lucide-react';

const STORAGE_PIN_KEY = 'finanzas_user_pin';
const STORAGE_SESSION_KEY = 'finanzas_session_active';

export function getIsAuthenticated() {
  const pinExists = !!localStorage.getItem(STORAGE_PIN_KEY);
  const sessionActive = localStorage.getItem(STORAGE_SESSION_KEY) === 'true';
  // Si no hay PIN configurado aún, se permite acceso o se pide configurar
  if (!pinExists) return true;
  return sessionActive;
}

export function logoutUser() {
  localStorage.removeItem(STORAGE_SESSION_KEY);
}

export function hasConfiguredPin() {
  return !!localStorage.getItem(STORAGE_PIN_KEY);
}

export function setMasterPin(newPin) {
  if (newPin && newPin.trim().length >= 4) {
    localStorage.setItem(STORAGE_PIN_KEY, btoa(newPin.trim()));
    localStorage.setItem(STORAGE_SESSION_KEY, 'true');
    return true;
  }
  return false;
}

export function clearMasterPin() {
  localStorage.removeItem(STORAGE_PIN_KEY);
  localStorage.removeItem(STORAGE_SESSION_KEY);
}

const AuthLockScreen = ({ onAuthenticated }) => {
  const [pinExists, setPinExists] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    const exists = hasConfiguredPin();
    setPinExists(exists);
  }, []);

  const handleUnlock = (e) => {
    e.preventDefault();
    setError(null);
    const savedPinHash = localStorage.getItem(STORAGE_PIN_KEY);
    const enteredHash = btoa(pinInput.trim());

    if (enteredHash === savedPinHash) {
      if (rememberMe) {
        localStorage.setItem(STORAGE_SESSION_KEY, 'true');
      }
      setSuccess('¡Acceso concedido! Entrando...');
      setTimeout(() => {
        onAuthenticated();
      }, 500);
    } else {
      setError('PIN o contraseña incorrecta. Intentá de nuevo.');
      setPinInput('');
    }
  };

  const handleSetupPin = (e) => {
    e.preventDefault();
    setError(null);
    if (pinInput.length < 4) {
      setError('El PIN o clave debe tener al menos 4 caracteres o números.');
      return;
    }
    if (pinInput !== confirmPin) {
      setError('Los PINs no coinciden. Verificalos.');
      return;
    }

    setMasterPin(pinInput);
    setSuccess('¡PIN de seguridad creado con éxito!');
    setTimeout(() => {
      onAuthenticated();
    }, 600);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'radial-gradient(circle at 50% 30%, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        maxWidth: '420px',
        width: '100%',
        background: 'rgba(30, 41, 59, 0.65)',
        borderRadius: '1.25rem',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.15)',
        padding: '2rem',
        textAlign: 'center'
      }}>
        {/* Icon Header */}
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '1rem',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(99, 102, 241, 0.25))',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
          boxShadow: '0 8px 20px rgba(139, 92, 246, 0.2)'
        }}>
          <Lock size={32} color="#a78bfa" />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: '#f8fafc' }}>
          {pinExists ? 'Acceso Protegido' : 'Crear PIN de Seguridad'}
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 1.5rem 0', lineHeight: 1.4 }}>
          {pinExists 
            ? 'Ingresá tu PIN para acceder a tus finanzas personales.' 
            : 'Configurá una clave de acceso rápido para proteger tu información.'}
        </p>

        {pinExists ? (
          /* Formulario de Desbloqueo */
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="Ingresá tu PIN o clave..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.85rem 2.75rem 0.85rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  letterSpacing: showPin ? 'normal' : '0.25em',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                style={{ accentColor: '#8b5cf6', width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Mantener sesión iniciada en este dispositivo
            </label>

            {error && (
              <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.85rem' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              className="primary"
              style={{
                padding: '0.85rem',
                borderRadius: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
              }}
            >
              <KeyRound size={18} /> Desbloquear
            </button>
          </form>
        ) : (
          /* Formulario de Configuración de PIN por Primera Vez */
          <form onSubmit={handleSetupPin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPin ? 'text' : 'password'}
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="Creá tu PIN o clave (min. 4 caract.)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box'
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
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '0.65rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.85rem' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              className="primary"
              style={{
                padding: '0.85rem',
                borderRadius: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                marginTop: '0.5rem'
              }}
            >
              <ShieldCheck size={18} /> Guardar PIN y Acceder
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AuthLockScreen;
