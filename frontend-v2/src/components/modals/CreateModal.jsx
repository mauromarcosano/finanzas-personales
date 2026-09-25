import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { API_BASE } from '../../config';

const CreateModal = ({ currentTab, setIsCreating, handleSaveCreate, categoriasConfig }) => {
  const [isSuscripcion, setIsSuscripcion] = useState(false);
  const [montoValue, setMontoValue] = useState(0);
  const [cuotasValue, setCuotasValue] = useState(1);
  const [montoTipo, setMontoTipo] = useState('por_cuota');
  const [selectedCat, setSelectedCat] = useState(categoriasConfig?.[0]?.id || 'Otros');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSuscripcion && currentTab === 'tarjetas') {
      const formData = new FormData(e.target);
      const data = {
        descripcion: formData.get('descripcion'),
        monto: parseFloat(formData.get('monto')),
        categoria: formData.get('categoria'),
        subcategoria: formData.get('subcategoria')
      };
      
      try {
        const res = await fetch(`${API_BASE}/api/suscripciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          setIsCreating(false);
        }
      } catch(e) { console.error(e); }
    }
    
    // Si no es suscripción, mandamos todo al App.js normal.
    handleSaveCreate(e, isSuscripcion);
  };

  return (
    <div className="modal-overlay" onClick={() => setIsCreating(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} color="var(--primary)" /> Nuevo Registro {currentTab === 'tarjetas' && '(Tarjeta)'}
        </h2>
        
        {currentTab === 'tarjetas' && (
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
              <input type="radio" name="tipo_gasto" checked={!isSuscripcion} onChange={() => setIsSuscripcion(false)} />
              Compra Única / Cuotas
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
              <input type="radio" name="tipo_gasto" checked={isSuscripcion} onChange={() => setIsSuscripcion(true)} />
              Suscripción Fija (Mes a Mes)
            </label>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Descripción</label>
              <input type="text" name="descripcion" required placeholder={isSuscripcion ? "Ej: Spotify, Netflix, Seguro" : "Ej: Supermercado"} />
            </div>
            <div className="form-group">
              <label>Monto ($)</label>
              <input 
                type="number" 
                step="0.01" 
                name="monto" 
                required 
                placeholder={isSuscripcion ? "Ej: 5000 (mensual)" : "Ej: 47000"} 
                onChange={e => setMontoValue(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          
          {currentTab === 'tarjetas' && !isSuscripcion && (
            <>
              <div className="form-grid-3">
                <div className="form-group">
                  <label>Método de Pago</label>
                  <select name="metodo_pago" defaultValue="Tarjeta_Credito" id="create_metodo_pago">
                    <option value="Tarjeta_Credito">💳 Tarjeta de Crédito</option>
                    <option value="Debito_Efectivo">Débito / Efectivo</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Total de Cuotas</label>
                  <input 
                    type="number" 
                    name="cuotas" 
                    defaultValue="1" 
                    min="1" 
                    max="24" 
                    onChange={e => setCuotasValue(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="form-group">
                  <label>¿Por cuál cuota vas?</label>
                  <input type="number" name="cuota_actual" defaultValue="1" min="1" max="24" />
                </div>
              </div>

              {cuotasValue > 1 && (
                <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.85rem', borderRadius: '0.6rem', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#c084fc' }}>
                    El monto ingresado ($ {montoValue.toLocaleString('es-AR')}) corresponde a:
                  </label>
                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="monto_tipo" value="por_cuota" checked={montoTipo === 'por_cuota'} onChange={() => setMontoTipo('por_cuota')} />
                      El precio de CADA cuota
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="radio" name="monto_tipo" value="total" checked={montoTipo === 'total'} onChange={() => setMontoTipo('total')} />
                      El precio TOTAL de la compra
                    </label>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.6rem' }}>
                    {montoTipo === 'por_cuota' ? (
                      <span>💡 Cálculo: {cuotasValue} cuotas de ${montoValue.toLocaleString('es-AR')} = <b>Monto total ${(montoValue * cuotasValue).toLocaleString('es-AR')}</b></span>
                    ) : (
                      <span>💡 Cálculo: Monto total ${montoValue.toLocaleString('es-AR')} = <b>{cuotasValue} cuotas de ${(montoValue / (cuotasValue || 1)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}</b></span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="form-grid-3">
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" name="fecha" defaultValue={new Date().toLocaleDateString('en-CA')} required />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <select name="categoria" required value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
                {categoriasConfig.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Subcategoría</label>
              <select name="subcategoria" required defaultValue="Otros">
                {(() => {
                  const catData = categoriasConfig.find(c => c.id === selectedCat);
                  if (!catData || !catData.subcategorias.length) {
                    return <option value="Otros">Otros</option>;
                  }
                  return (
                    <optgroup label={catData.label}>
                      {catData.subcategorias.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.label}</option>
                      ))}
                    </optgroup>
                  );
                })()}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
            <button type="submit" className="primary">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;
