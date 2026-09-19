import React, { useState } from 'react';
import { FileText, Upload, Sparkles, CheckCircle2, AlertCircle, X, Check, RefreshCw, ChevronRight } from 'lucide-react';

const API_URL = 'http://localhost:3000/api/ai';

const ScanResumenModal = ({ isOpen, onClose, onImportSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('faltantes'); // 'faltantes' | 'registrados'
  const [itemsToImport, setItemsToImport] = useState({}); // { [itemId]: boolean }

  if (!isOpen) return null;

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Formato de archivo no soportado. Por favor adjuntá un PDF o una foto/captura (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setError('El archivo es demasiado grande (máximo 15 MB).');
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleScan = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileBase64 = reader.result;

        const res = await fetch(`${API_URL}/scan-resumen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileBase64,
            mimeType: selectedFile.type
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const msg = errData?.details || errData?.error || `Error del servidor (${res.status})`;
          throw new Error(msg);
        }

        const data = await res.json();
        setScanResult(data);

        // Por defecto, marcamos todos los ítems NO registrados para importar
        const initialChecked = {};
        (data.items || []).forEach(item => {
          if (!item.ya_registrado) {
            initialChecked[item.id] = true;
          }
        });
        setItemsToImport(initialChecked);
      } catch (err) {
        console.error('Error al escanear:', err);
        setError(err.message || 'Error al procesar el documento con la IA.');
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = (err) => {
      console.error('Error leyendo archivo:', err);
      setError('No se pudo leer el archivo local.');
      setLoading(false);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleToggleItem = (itemId) => {
    setItemsToImport(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleItemChange = (itemId, field, value) => {
    setScanResult(prev => {
      if (!prev) return prev;
      const updatedItems = prev.items.map(item => {
        if (item.id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleExecuteImport = async () => {
    if (!scanResult) return;
    const selectedList = scanResult.items.filter(item => itemsToImport[item.id]);

    if (selectedList.length === 0) {
      alert('Por favor seleccioná al menos 1 consumo para importar.');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`${API_URL}/import-scanned-gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          items: selectedList,
          periodo: scanResult.periodo
        })
      });

      if (res.ok) {
        const resultData = await res.json();
        alert(`🎉 ${resultData.message}`);
        if (onImportSuccess) onImportSuccess();
        onClose();
      } else {
        const errJson = await res.json();
        alert(`Error importando: ${errJson.error || 'Intentalo nuevamente'}`);
      }
    } catch (err) {
      console.error('Error al importar:', err);
      alert('Error de conexión al importar los gastos.');
    } finally {
      setImporting(false);
    }
  };

  const faltantes = scanResult ? scanResult.items.filter(i => !i.ya_registrado) : [];
  const registrados = scanResult ? scanResult.items.filter(i => i.ya_registrado) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: scanResult ? '860px' : '560px', transition: 'all 0.3s ease' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="ai-icon-container" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <FileText size={22} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                Escáner Inteligente de Resúmenes <Sparkles size={16} color="#8b5cf6" />
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Procesá tu resumen en PDF o Captura y concilía los consumos</div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <X size={20} color="var(--text-muted)" />
          </button>
        </div>

        {/* State 1: Select File */}
        {!scanResult && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div 
              style={{
                border: '2px dashed rgba(139, 92, 246, 0.4)',
                borderRadius: '1rem',
                padding: '2.5rem 1.5rem',
                textAlign: 'center',
                background: 'rgba(15, 23, 42, 0.6)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}
              onClick={() => document.getElementById('resumen_file_input').click()}
            >
              <input 
                type="file" 
                id="resumen_file_input" 
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp" 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
              />

              <div style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
                <Upload size={32} color="#8b5cf6" />
              </div>

              {selectedFile ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#8b5cf6' }}>📄 {selectedFile.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type.replace('application/', '').replace('image/', '').toUpperCase()}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Arrastrá o seleccioná tu Resumen / Factura</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    Soporta PDFs descargados del homebanking, fotos o capturas de pantalla
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', color: '#ef4444', fontSize: '0.85rem' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
              <button 
                type="button" 
                className="primary" 
                disabled={!selectedFile}
                onClick={handleScan}
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)', opacity: selectedFile ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Sparkles size={16} /> Escanear y Conciliar con IA
              </button>
            </div>
          </div>
        )}

        {/* State 2: Loading Loader */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div className="ai-spinner spin" style={{ padding: '1rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <RefreshCw size={36} color="#10b981" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>Procesando documento con IA...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                Estamos analizando los consumos del resumen, identificando compras en dólares (USD), suscripciones y comparando con tu base de datos.
              </p>
              <div style={{ marginTop: '1rem', fontSize: '0.78rem', color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)', padding: '0.4rem 0.8rem', borderRadius: '0.5rem', display: 'inline-block', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                ⏱️ Tiempo estimado: 15 a 30 segundos. Si ocurre un error, te avisaremos al instante.
              </div>
            </div>
          </div>
        )}

        {/* State 3: Results & Deduplication Table */}
        {scanResult && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Banner resumen */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(30, 41, 59, 0.7) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem 1.25rem', borderRadius: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{scanResult.banco_tarjeta || 'Resumen de Tarjeta'} • {scanResult.periodo}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginTop: '0.1rem' }}>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10b981' }}>
                    ${(scanResult.total_resumen_ars || scanResult.total_resumen || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS
                  </div>
                  {scanResult.total_resumen_usd > 0 && (
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.15rem 0.6rem', borderRadius: '0.4rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      💵 US$ {parseFloat(scanResult.total_resumen_usd).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ya Registrados</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{registrados.length}</div>
                </div>

                <div style={{ padding: '0.4rem 0.8rem', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '0.5rem', border: '1px solid rgba(139, 92, 246, 0.3)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Faltantes Detectados</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc' }}>{faltantes.length}</div>
                </div>
              </div>
            </div>

            {/* Tabs Selector */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button 
                onClick={() => setSelectedTab('faltantes')}
                style={{ 
                  background: selectedTab === 'faltantes' ? '#8b5cf6' : 'transparent', 
                  color: selectedTab === 'faltantes' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                ✨ Faltantes por Cargar ({faltantes.length})
              </button>
              
              <button 
                onClick={() => setSelectedTab('registrados')}
                style={{ 
                  background: selectedTab === 'registrados' ? '#10b981' : 'transparent', 
                  color: selectedTab === 'registrados' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                ✅ Ya Registrados en App ({registrados.length})
              </button>
            </div>

            {/* List of Faltantes */}
            {selectedTab === 'faltantes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {faltantes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    🎉 ¡Excelente! No se detectaron gastos faltantes. Todos los ítems del resumen ya están en tu app.
                  </div>
                ) : (
                  faltantes.map(item => {
                    const isChecked = !!itemsToImport[item.id];
                    const isUsd = item.moneda === 'USD' || item.monto_usd > 0;
                    return (
                      <div 
                        key={item.id}
                        style={{
                          background: isChecked ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.4)',
                          border: isChecked ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-color)',
                          borderRadius: '0.75rem',
                          padding: '0.85rem 1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => handleToggleItem(item.id)}
                              style={{ width: '18px', height: '18px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                            />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem' }}>
                              {item.fecha || scanResult.periodo || 'Sin fecha'}
                            </div>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                              (Original: {item.descripcion_resumen})
                            </span>
                            {item.es_suscripcion && (
                              <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600 }}>
                                🔄 Suscripción
                              </span>
                            )}
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isUsd && (
                              <span style={{ fontSize: '0.85rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                US$ {parseFloat(item.monto_usd || 0).toFixed(2)}
                              </span>
                            )}
                            <span style={{ color: '#c084fc' }}>
                              ${parseFloat(item.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                            </span>
                            {item.cuotas > 1 && (
                              <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600 }}>
                                (Cuota {item.cuota_actual}/{item.cuotas})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Editable Form Inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr', gap: '0.5rem' }}>
                          <input 
                            type="text"
                            value={item.descripcion}
                            onChange={e => handleItemChange(item.id, 'descripcion', e.target.value)}
                            placeholder="Nombre limpio del gasto"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                          />

                          <select 
                            value={item.destino || (item.es_suscripcion ? 'suscripcion' : 'tarjeta')}
                            onChange={e => handleItemChange(item.id, 'destino', e.target.value)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: 'rgba(30, 41, 59, 0.9)', color: '#fff' }}
                          >
                            <option value="tarjeta">💳 Tarjeta (Cuotas)</option>
                            <option value="suscripcion">🔄 Suscripción Fija</option>
                            <option value="debito">💵 Débito / Efectivo</option>
                          </select>

                          <select 
                            value={item.categoria}
                            onChange={e => handleItemChange(item.id, 'categoria', e.target.value)}
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            <option value="Supermercado_y_Alimentacion">Supermercado y Alimentación</option>
                            <option value="Kiosco_y_Despensa">Kiosco y Despensa</option>
                            <option value="Vivienda_y_Servicios">Vivienda y Servicios</option>
                            <option value="Transporte">Transporte</option>
                            <option value="Ocio_y_Relaciones">Ocio y Relaciones</option>
                            <option value="Desarrollo_y_Trabajo">Desarrollo y Trabajo</option>
                            <option value="Otros">Otros</option>
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* List of Registrados */}
            {selectedTab === 'registrados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto' }}>
                {registrados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No se encontraron coincidencias previas.
                  </div>
                ) : (
                  registrados.map(item => (
                    <div 
                      key={item.id}
                      style={{
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '0.6rem',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981' }}>
                          <CheckCircle2 size={16} /> {item.descripcion_resumen}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          Coincide con tu gasto: <b>{item.coincidencia_con || item.descripcion}</b>
                        </div>
                      </div>

                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {item.monto_usd > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>US$ {parseFloat(item.monto_usd).toFixed(2)}</span>
                        )}
                        <span>${parseFloat(item.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="secondary" onClick={() => setScanResult(null)}>
                ↩ Cargar otro archivo
              </button>

              <button 
                type="button" 
                className="primary"
                disabled={importing || Object.values(itemsToImport).filter(Boolean).length === 0}
                onClick={handleExecuteImport}
                style={{ background: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem' }}
              >
                {importing ? <RefreshCw size={18} className="spin" /> : <CheckCircle2 size={18} />}
                {importing ? 'Importando...' : `Importar (${Object.values(itemsToImport).filter(Boolean).length}) Gastos Faltantes`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanResumenModal;
