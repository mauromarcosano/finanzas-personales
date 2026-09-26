import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Calendar, Clock, CheckCircle2, Trash2, Zap, Pencil } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { API_BASE } from '../config';

const API_URL = `${API_BASE}/api`;

const TarjetasBandeja = ({ cuotasPendientes, fetchCuotas, setIsCreating, currentDate, suscripciones = [], fetchSuscripciones }) => {
  const [config, setConfig] = useState({ fecha_cierre: '', fecha_vencimiento: '' });
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // { id, tipo: 'cuota' | 'suscripcion', descripcion, monto }

  useEffect(() => {
    fetchConfig();
    if (fetchSuscripciones) fetchSuscripciones();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/tarjeta_config`);
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updated = {
      fecha_cierre: formData.get('fecha_cierre'),
      fecha_vencimiento: formData.get('fecha_vencimiento')
    };
    try {
      const res = await fetch(`${API_URL}/tarjeta_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        setConfig(await res.json());
        setIsConfiguring(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSuscripcion = async (id) => {
    if (!window.confirm('¿Eliminar esta suscripción recurrente?')) return;
    try {
      const res = await fetch(`${API_URL}/suscripciones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (fetchSuscripciones) fetchSuscripciones();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteCuota = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta compra de tarjeta y todas sus cuotas?')) return;
    try {
      const res = await fetch(`${API_URL}/cuotas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEditingItem(null);
        fetchCuotas();
      }
    } catch (e) { console.error(e); }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      descripcion: formData.get('descripcion'),
      monto: parseFloat(formData.get('monto'))
    };

    try {
      const endpoint = editingItem.tipo === 'cuota' ? `${API_URL}/cuotas/${editingItem.id}` : `${API_URL}/suscripciones/${editingItem.id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setEditingItem(null);
        if (editingItem.tipo === 'cuota') fetchCuotas();
        else if (fetchSuscripciones) fetchSuscripciones();
      }
    } catch(err) { console.error(err); }
  };

  const handleLiquidarMes = async () => {
    if (!window.confirm('¿Estás seguro que querés liquidar todo el resumen actual? Se moverán a Gastos y se generarán las próximas cuotas.')) return;
    setIsLiquidating(true);
    try {
      const cuotasIds = cuotasActivas.map(c => c.cuota_id);
      const res = await fetch(`${API_URL}/cuotas/liquidar_mes`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuotasIds })
      });
      if (res.ok) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#8b5cf6', '#3b82f6']
        });
        toast.success('¡Resumen liquidado con éxito! Las fechas de cierre se adelantaron al mes que viene.');
        fetchCuotas(); 
        fetchConfig();
      } else {
        toast.error('Error liquidando resumen');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error de conexión');
    } finally {
      setIsLiquidating(false);
    }
  };

  const selectedYear = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const selectedMonth = currentDate ? currentDate.getMonth() : new Date().getMonth();

  const parseLocalDate = (dateVal) => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    
    const dateStr = String(dateVal);
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      const parts = dateStr.split(/[-T :]/);
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    
    return new Date(dateStr);
  };

  const getCuotaYearMonth = (fechaCompraStr, numeroCuota, cuotaInicial = 1) => {
    const fc = parseLocalDate(fechaCompraStr);
    const offset = numeroCuota - (cuotaInicial || 1);
    const targetDate = new Date(fc.getFullYear(), fc.getMonth() + offset, 15);
    return { year: targetDate.getFullYear(), month: targetDate.getMonth() };
  };

  // Para cada compra, mostramos SOLAMENTE la cuota pendiente correspondiente a este mes (o la cuota pendiente activa más baja si no hay coincidencia futura)
  const cuotasPorCompra = {};
  const today = new Date();
  const isCurrentCalendarMonth = (selectedYear === today.getFullYear() && selectedMonth === today.getMonth());

  // 1. Coincidencia exacta de mes y año para cada cuota pendiente
  cuotasPendientes.forEach(c => {
    if (c.estado !== 'Pendiente') return;
    const { year, month } = getCuotaYearMonth(c.fecha_compra, c.numero_cuota, c.cuota_inicial || 1);
    if (year === selectedYear && month === selectedMonth) {
      cuotasPorCompra[c.compra_id] = c;
    }
  });

  // 2. Si estamos en el mes actual y alguna compra que tiene cuotas pendientes NO tuvo coincidencia en el paso 1, le asignamos su cuota pendiente más baja
  if (isCurrentCalendarMonth) {
    cuotasPendientes.forEach(c => {
      if (c.estado !== 'Pendiente') return;
      if (!cuotasPorCompra[c.compra_id]) {
        const pendingForThisCompra = cuotasPendientes.filter(x => x.compra_id === c.compra_id && x.estado === 'Pendiente');
        if (pendingForThisCompra.length > 0) {
          const lowestPending = pendingForThisCompra.reduce((min, cur) => cur.numero_cuota < min.numero_cuota ? cur : min, pendingForThisCompra[0]);
          cuotasPorCompra[c.compra_id] = lowestPending;
        }
      }
    });
  }

  const cuotasActivas = Object.values(cuotasPorCompra);
  
  const totalCuotas = cuotasActivas.reduce((acc, c) => acc + parseFloat(c.monto), 0);
  const totalSuscripciones = suscripciones.reduce((acc, s) => acc + parseFloat(s.monto), 0);
  const totalResumen = totalCuotas + totalSuscripciones;

  // Cálculo de días exacto
  let daysToCierre = 0;
  let isClosed = false;
  let isAlreadyPaid = false;
  
  if (config.fecha_cierre) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const [y, m, d] = config.fecha_cierre.split('-');
    const cierreDate = new Date(y, m - 1, d);
    
    // Verificamos si el mes seleccionado ya quedó atrás respecto al cierre
    if (selectedYear < cierreDate.getFullYear() || (selectedYear === cierreDate.getFullYear() && selectedMonth < cierreDate.getMonth())) {
      isAlreadyPaid = true;
    }

    daysToCierre = Math.floor((cierreDate - today) / (1000 * 60 * 60 * 24));
    if (daysToCierre < 0) isClosed = true;
  }

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CreditCard color="#8b5cf6" /> Centro de Control: Tarjeta
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Administrá tus cuotas, suscripciones fijas y el pago del resumen.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="secondary" onClick={() => setIsConfiguring(true)}>
            <Calendar size={16} /> Configurar Fechas
          </button>
          <button className="primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsCreating(true)}>
            <Plus size={16} /> Nueva Compra / Suscripción
          </button>
        </div>
      </div>

      <div className="bento-grid">
        {/* WIDGET ESTADO DEL RESUMEN */}
        <div className="glass-card" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(30, 41, 59, 0.8) 100%)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
          {isCurrentCalendarMonth ? (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={14} color={isClosed ? "#ef4444" : "#f97316"} /> 
                Cierre: {config.fecha_cierre ? new Date(config.fecha_cierre + 'T00:00:00').toLocaleDateString('es-AR') : 'No configurado'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: isClosed ? '#ef4444' : 'inherit' }}>
                {isClosed ? '⚠️ ¡El resumen ya cerró!' : (daysToCierre === 0 ? '¡Cierra HOY!' : `Faltan ${daysToCierre} días para el cierre`)}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} color="#8b5cf6" /> 
                Proyección del Período
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
                Resumen de Tarjeta del Mes
              </div>
            </div>
          )}
          
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Total Proyectado Resumen</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>
              ${totalResumen.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {isCurrentCalendarMonth && !isAlreadyPaid && (
            <button 
              className="primary" 
              style={{ padding: '1rem 2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#22c55e' }}
              onClick={handleLiquidarMes}
              disabled={isLiquidating}
            >
              {isLiquidating ? <CheckCircle2 size={20} className="spinner" /> : <Zap size={20} />}
              {isLiquidating ? 'Liquidando...' : '¡Pagar Resumen Ahora!'}
            </button>
          )}

          {(isAlreadyPaid || (!isCurrentCalendarMonth && selectedMonth < today.getMonth())) && (
            <div style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} /> Resumen Pagado
            </div>
          )}
        </div>

        {/* LISTA DE CUOTAS */}
        <div className="glass-card list-section">
          <div className="card-title" style={{ marginBottom: '1rem' }}><CreditCard size={16} color="#3b82f6" /> Compras del Mes (Cuotas / 1 Pago)</div>
          {cuotasActivas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No tenés consumos en cuotas para este mes.</div>
          ) : (
            <div className="expense-list">
              <AnimatePresence>
              {cuotasActivas.map(c => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="expense-item" 
                  key={c.cuota_id}
                >
                  <div className="expense-info">
                    <div className="expense-desc" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{c.descripcion}</span>
                      {c.cuotas_totales > 1 && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '1rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                          Cuota {c.numero_cuota}/{c.cuotas_totales}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Comprado el {new Date(c.fecha_compra).toLocaleDateString('es-AR')} | {c.categoria.replace(/_/g, ' ')}
                      {c.cuotas_totales > 1 && (
                        <span style={{ marginLeft: '0.5rem', color: '#c084fc' }}>
                          • Total compra: ${parseFloat(c.monto_total).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="expense-amount" style={{ textAlign: 'right' }}>
                      <span style={{ color: '#3b82f6', fontWeight: 700 }}>
                        ${parseFloat(c.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                      </span>
                      {c.cuotas_totales > 1 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>/ cuota</span>}
                    </div>
                    <button className="icon-btn edit" onClick={() => setEditingItem({ id: c.cuota_id, tipo: 'cuota', descripcion: c.descripcion, monto: c.monto })} title="Editar Compra">
                      <Pencil size={18} />
                    </button>
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* LISTA DE SUSCRIPCIONES */}
        <div className="glass-card list-section">
          <div className="card-title" style={{ marginBottom: '1rem' }}><CheckCircle2 size={16} color="#ec4899" /> Suscripciones Fijas (Recurrentes)</div>
          {suscripciones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No hay suscripciones configuradas.</div>
          ) : (
            <div className="expense-list">
              {suscripciones.map(s => (
                <div className="expense-item" key={s.id}>
                  <div className="expense-info">
                    <div className="expense-desc">{s.descripcion}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {s.categoria.replace(/_/g, ' ')}
                    </div>
                  </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div className="expense-amount">
                        {(s.moneda === 'USD' || s.monto_usd > 0) && (
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '0.3rem', border: '1px solid rgba(56, 189, 248, 0.3)', marginRight: '0.5rem', fontWeight: 600 }}>
                            US$ {parseFloat(s.monto_usd || 0).toFixed(2)}
                          </span>
                        )}
                        <span style={{ color: '#ec4899' }}>${parseFloat(s.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })} /mes</span>
                      </div>
                    <button className="icon-btn edit" onClick={() => setEditingItem({ id: s.id, tipo: 'suscripcion', descripcion: s.descripcion, monto: s.monto })} title="Editar o Eliminar Suscripción">
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isConfiguring && (
        <div className="modal-overlay" onClick={() => setIsConfiguring(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar color="#8b5cf6" /> Fechas del Resumen
            </h2>
            <form onSubmit={handleSaveConfig}>
              <div className="form-group">
                <label>Fecha de Cierre</label>
                <input type="date" name="fecha_cierre" defaultValue={config.fecha_cierre} required />
              </div>
              <div className="form-group">
                <label>Fecha de Vencimiento (Pago)</label>
                <input type="date" name="fecha_vencimiento" defaultValue={config.fecha_vencimiento} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setIsConfiguring(false)}>Cancelar</button>
                <button type="submit" className="primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Pencil color="#8b5cf6" /> Editar {editingItem.tipo === 'cuota' ? 'Compra' : 'Suscripción'}
            </h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Descripción</label>
                <input type="text" name="descripcion" defaultValue={editingItem.descripcion} required />
              </div>
              <div className="form-group">
                <label>Monto</label>
                <input type="number" step="0.01" name="monto" defaultValue={editingItem.monto} required />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  type="button" 
                  className="secondary" 
                  style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                  onClick={() => {
                    if (editingItem.tipo === 'cuota') {
                      handleDeleteCuota(editingItem.id);
                    } else {
                      handleDeleteSuscripcion(editingItem.id);
                      setEditingItem(null);
                    }
                  }}
                >
                  <Trash2 size={16} /> Eliminar {editingItem.tipo === 'cuota' ? 'Compra' : 'Suscripción'}
                </button>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="secondary" onClick={() => setEditingItem(null)}>Cancelar</button>
                  <button type="submit" className="primary">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default TarjetasBandeja;
