import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Clock } from 'lucide-react';

const ReminderModal = ({ isOpen, onClose }) => {
  const [hora, setHora] = useState('21:30');
  const [activo, setActivo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/recordatorio')
        .then(r => r.json())
        .then(data => {
          if (data.hora) setHora(data.hora);
          if (data.activo !== undefined) setActivo(data.activo);
        })
        .catch(err => console.error('Error cargando config recordatorio:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/recordatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hora, activo })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: '¡Ajustes guardados correctamente! ⏰' });
        setTimeout(() => onClose(), 1500);
      } else {
        throw new Error('Error al guardar');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'No se pudo guardar la configuración.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="ai-icon-container" style={{ background: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
              <Bell size={22} color="#8b5cf6" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Recordatorio Diario</h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Notificaciones automáticas por Telegram</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', margin: '1rem 0' }}>
            {/* Activar / Desactivar Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.5)', padding: '0.85rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Estado del Recordatorio</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activo ? '🟢 Recibirás aviso diario por Telegram' : '🔴 Recordatorios desactivados'}
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={activo} 
                onChange={e => setActivo(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#8b5cf6', cursor: 'pointer' }}
              />
            </div>

            {/* Selección de Hora */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="#8b5cf6" /> Hora del Recordatorio Nocturno
              </label>
              <select 
                value={hora} 
                onChange={e => setHora(e.target.value)}
                disabled={!activo}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  opacity: activo ? 1 : 0.5
                }}
              >
                <option value="20:00">20:00 hs (8:00 PM)</option>
                <option value="20:30">20:30 hs (8:30 PM)</option>
                <option value="21:00">21:00 hs (9:00 PM)</option>
                <option value="21:30">21:30 hs (9:30 PM) - Recomendado</option>
                <option value="22:00">22:00 hs (10:00 PM)</option>
                <option value="22:30">22:30 hs (10:30 PM)</option>
                <option value="23:00">23:00 hs (11:00 PM)</option>
              </select>
            </div>

            {/* Feedback Message */}
            {message && (
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: 500,
                textAlign: 'center',
                backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                {message.text}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" className="secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>Cancelar</button>
            <button type="submit" className="primary" disabled={loading} style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Check size={14} /> Guardar Ajustes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReminderModal;
