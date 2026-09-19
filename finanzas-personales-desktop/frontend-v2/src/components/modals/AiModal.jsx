import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, X, RefreshCw, Lightbulb, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

const AiModal = ({ 
  isOpen, 
  onClose, 
  monthName, 
  totalMes, 
  totalTarjeta, 
  mayorGasto, 
  chartData, 
  gastos 
}) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/opinion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: monthName,
          totalMes,
          totalTarjeta,
          mayorGasto,
          categorias: chartData.map(c => ({ name: c.name, value: c.value, pct: parseFloat(c.pct.toFixed(1)) })),
          topGastos: gastos
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || errJson?.details || 'Error al comunicarse con el servidor del backend.');
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      console.error('Error fetching AI analysis:', err);
      setError(err.message || 'Hubo un problema al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }, [monthName, totalMes, totalTarjeta, mayorGasto, chartData, gastos]);

  useEffect(() => {
    if (isOpen && !analysis && !loading && !error) {
      fetchAnalysis();
    }
  }, [isOpen, analysis, loading, error, fetchAnalysis]);

  if (!isOpen) return null;

  const getStatusBadge = (diag) => {
    switch (diag) {
      case 'excelente':
        return {
          label: 'Finanzas Saludables',
          icon: <CheckCircle size={16} color="#10b981" />,
          bg: 'rgba(16, 185, 129, 0.15)',
          color: '#10b981',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        };
      case 'atencion':
        return {
          label: 'Alerta de Gastos',
          icon: <AlertTriangle size={16} color="#ef4444" />,
          bg: 'rgba(239, 68, 68, 0.15)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        };
      default:
        return {
          label: 'Equilibrio Moderado',
          icon: <TrendingUp size={16} color="#f59e0b" />,
          bg: 'rgba(245, 158, 11, 0.15)',
          color: '#f59e0b',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        };
    }
  };

  const badge = analysis ? getStatusBadge(analysis.diagnostico) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card modal-content ai-modal-card" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '90%', position: 'relative', overflow: 'hidden' }}
      >
        {/* Top Decorative Sparkle Blur */}
        <div className="ai-modal-glow"></div>

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="ai-icon-container">
              <Sparkles size={22} color="#ec4899" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Opinión de la IA <span className="ai-beta-tag">Gemini ✨</span>
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Análisis financiero personalizado de {monthName}
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="ai-loading-container">
            <div className="ai-spinner">
              <Sparkles size={32} color="#ec4899" className="spin" />
            </div>
            <div className="ai-loading-text">
              <h4>Analizando tus movimientos...</h4>
              <p>Mirando en qué se te fue la plata este mes y generando consejos personalizados.</p>
            </div>
          </div>
        ) : error ? (
          <div className="ai-error-container">
            <AlertTriangle size={36} color="#ef4444" style={{ marginBottom: '0.75rem' }} />
            <p>{error}</p>
            <button className="primary" onClick={fetchAnalysis} style={{ marginTop: '1rem' }}>
              <RefreshCw size={14} style={{ marginRight: '0.5rem' }} /> Reintentar
            </button>
          </div>
        ) : analysis ? (
          <div className="ai-analysis-content">
            {/* Status & Title Banner */}
            <div className="ai-summary-header">
              {badge && (
                <div className="ai-status-badge" style={{ backgroundColor: badge.bg, color: badge.color, border: badge.border }}>
                  {badge.icon}
                  <span>{badge.label}</span>
                </div>
              )}
              <h3 className="ai-analysis-title">{analysis.titulo}</h3>
            </div>

            {/* AI Narrative Opinion */}
            <div className="ai-narrative-box">
              <p>{analysis.opinion}</p>
            </div>

            {/* Key Highlights */}
            {analysis.destacados && analysis.destacados.length > 0 && (
              <div className="ai-highlights-section">
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Puntos Destacados
                </h4>
                <div className="ai-highlights-list">
                  {analysis.destacados.map((item, idx) => (
                    <div className="ai-highlight-item" key={idx}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Tip Box */}
            {analysis.tip && (
              <div className="ai-tip-card">
                <div className="ai-tip-icon">
                  <Lightbulb size={20} color="#eab308" />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#eab308', letterSpacing: '0.05em' }}>
                    Tip Financiero Inteligente
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', marginTop: '0.2rem', fontWeight: 500 }}>
                    "{analysis.tip}"
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <button 
            className="secondary" 
            onClick={fetchAnalysis} 
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Analizando...' : 'Volver a analizar'}
          </button>

          <button 
            className="primary" 
            onClick={onClose}
            style={{ fontSize: '0.8rem', padding: '0.5rem 1.25rem' }}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiModal;
