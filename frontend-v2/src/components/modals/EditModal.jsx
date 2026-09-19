import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

const EditModal = ({ editingGasto, setEditingGasto, handleSaveEdit, handleDelete, categoriasConfig }) => {
  const [selectedCat, setSelectedCat] = React.useState(editingGasto.categoria || (categoriasConfig?.[0]?.id) || 'Otros');
  const onDeleteClick = () => {
    if (window.confirm('¿Estás seguro de que querés borrar este gasto?')) {
      handleDelete(editingGasto.id);
      setEditingGasto(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setEditingGasto(null)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Pencil color="#8b5cf6" /> Editar Gasto
        </h2>
        <form onSubmit={handleSaveEdit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label>Descripción</label>
              <input type="text" name="descripcion" defaultValue={editingGasto.descripcion} required />
            </div>
            <div className="form-group">
              <label>Monto</label>
              <input type="number" name="monto" defaultValue={editingGasto.monto} required min="0" step="0.01" />
            </div>
          </div>
          
          <div className="form-grid-2">
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
              <select name="subcategoria" required defaultValue={editingGasto.subcategoria || 'Otros'}>
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

          <div className="form-grid-2">
            <div className="form-group">
              <label>Método de Pago</label>
              <select name="metodo_pago" required defaultValue={editingGasto.metodo_pago || 'Debito_Efectivo'}>
                <option value="Debito_Efectivo">💵 Débito / Efectivo</option>
                <option value="Tarjeta_Credito">💳 Tarjeta de Crédito</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fecha</label>
              <input type="date" name="fecha" required defaultValue={editingGasto.fecha ? new Date(editingGasto.fecha).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA')} />
            </div>
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              type="button" 
              className="secondary" 
              onClick={onDeleteClick}
              style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <Trash2 size={16} /> Borrar Gasto
            </button>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="secondary" onClick={() => setEditingGasto(null)}>Cancelar</button>
              <button type="submit" className="primary">Guardar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
