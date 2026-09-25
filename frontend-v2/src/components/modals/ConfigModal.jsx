import { useState, useMemo, useRef, useEffect } from 'react';
import { API_BASE } from '../../config';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Search, 
  FolderTree, 
  Lightbulb, 
  CheckCircle2,
  Tag
} from 'lucide-react';

export default function ConfigModal({ isOpen, onClose, categorias, setCategorias }) {
  if (!isOpen) return null;

  const [localCats, setLocalCats] = useState(() => JSON.parse(JSON.stringify(categorias || [])));
  const [selectedCatId, setSelectedCatId] = useState(() => (categorias && categorias.length > 0 ? categorias[0].id : null));
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Edición de Categoría
  const [isEditingCat, setIsEditingCat] = useState(false);
  const [catDraftLabel, setCatDraftLabel] = useState('');

  // Creación de Categoría (Sidebar)
  const [isCreatingCat, setIsCreatingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Confirmación de eliminación de Categoría
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Creación de Subcategoría
  const [newSubcatName, setNewSubcatName] = useState('');

  // Edición de Subcategoría
  const [editingSubId, setEditingSubId] = useState(null);
  const [subDraftLabel, setSubDraftLabel] = useState('');

  const editCatInputRef = useRef(null);
  const newCatInputRef = useRef(null);
  const newSubcatInputRef = useRef(null);
  const editSubcatInputRef = useRef(null);

  // Focus en inputs cuando se activan
  useEffect(() => {
    if (isEditingCat && editCatInputRef.current) editCatInputRef.current.focus();
  }, [isEditingCat]);

  useEffect(() => {
    if (isCreatingCat && newCatInputRef.current) newCatInputRef.current.focus();
  }, [isCreatingCat]);

  useEffect(() => {
    if (editingSubId && editSubcatInputRef.current) editSubcatInputRef.current.focus();
  }, [editingSubId]);

  // Si selectedCatId no es válido o se eliminó, seleccionar la primera disponible
  useEffect(() => {
    if (localCats.length > 0 && (!selectedCatId || !localCats.some(c => c.id === selectedCatId))) {
      setSelectedCatId(localCats[0].id);
    }
  }, [localCats, selectedCatId]);

  // Función inteligente para asignar emoji por categoría
  const getCategoryEmoji = (cat) => {
    if (!cat) return '🏷️';
    const text = `${cat.id} ${cat.label}`.toLowerCase();
    if (text.includes('super') || text.includes('alimen') || text.includes('comida') || text.includes('panad')) return '🛒';
    if (text.includes('kios') || text.includes('despen') || text.includes('antoj') || text.includes('snack')) return '🍫';
    if (text.includes('vivien') || text.includes('servici') || text.includes('hogar') || text.includes('casa') || text.includes('luz')) return '🏠';
    if (text.includes('transp') || text.includes('auto') || text.includes('nafta') || text.includes('uber') || text.includes('moto')) return '🚗';
    if (text.includes('ocio') || text.includes('salida') || text.includes('amigo') || text.includes('boliche') || text.includes('juntad')) return '🍕';
    if (text.includes('desarr') || text.includes('trabaj') || text.includes('estudio') || text.includes('oficina') || text.includes('gimnasio') || text.includes('ropa')) return '💼';
    if (text.includes('ahorr') || text.includes('inver') || text.includes('dolar') || text.includes('cripto')) return '📈';
    if (text.includes('mascot') || text.includes('perro') || text.includes('gato') || text.includes('veterin')) return '🐾';
    if (text.includes('salud') || text.includes('farma') || text.includes('medic') || text.includes('doctor')) return '💊';
    if (text.includes('educa') || text.includes('curso') || text.includes('libro')) return '📚';
    if (text.includes('viaj') || text.includes('vuelo') || text.includes('turism') || text.includes('hotel')) return '✈️';
    if (text.includes('impuest') || text.includes('banc') || text.includes('tasa') || text.includes('afip')) return '🏛️';
    return '🏷️';
  };

  // Guardar en backend
  const saveConfig = async (newConfig) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/categorias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categorias: newConfig })
      });
      if (res.ok) {
        setCategorias(newConfig);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert('Error al guardar la configuración');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión con el servidor');
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de la lista izquierda
  const filteredCats = useMemo(() => {
    if (!searchTerm.trim()) return localCats;
    const q = searchTerm.toLowerCase();
    return localCats.filter(cat => {
      const matchCat = cat.label.toLowerCase().includes(q);
      const matchSub = cat.subcategorias.some(s => s.label.toLowerCase().includes(q));
      return matchCat || matchSub;
    });
  }, [localCats, searchTerm]);

  // Categoría seleccionada actualmente
  const selectedCat = useMemo(() => {
    return localCats.find(c => c.id === selectedCatId) || null;
  }, [localCats, selectedCatId]);

  // Crear categoría principal
  const handleAddCat = () => {
    const clean = newCatName.trim();
    if (!clean) return;
    const id = clean
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');

    if (localCats.some(c => c.id.toLowerCase() === id.toLowerCase())) {
      alert('Ya existe una categoría similar');
      return;
    }

    const newCat = { id, label: clean, subcategorias: [] };
    const newConfig = [...localCats, newCat];
    setLocalCats(newConfig);
    setSelectedCatId(id);
    setNewCatName('');
    setIsCreatingCat(false);
    saveConfig(newConfig);
  };

  // Renombrar categoría
  const handleStartEditCat = () => {
    if (!selectedCat) return;
    setCatDraftLabel(selectedCat.label);
    setIsEditingCat(true);
  };

  const handleSaveEditCat = () => {
    const clean = catDraftLabel.trim();
    if (!clean || !selectedCat) {
      setIsEditingCat(false);
      return;
    }
    const newConfig = localCats.map(c => c.id === selectedCat.id ? { ...c, label: clean } : c);
    setLocalCats(newConfig);
    setIsEditingCat(false);
    saveConfig(newConfig);
  };

  // Eliminar categoría
  const handleDeleteCat = () => {
    if (!selectedCat) return;
    const filtered = localCats.filter(c => c.id !== selectedCat.id);
    setLocalCats(filtered);
    setIsConfirmingDelete(false);
    if (filtered.length > 0) {
      setSelectedCatId(filtered[0].id);
    } else {
      setSelectedCatId(null);
    }
    saveConfig(filtered);
  };

  // Agregar subcategoría
  const handleAddSubcat = () => {
    const clean = newSubcatName.trim();
    if (!clean || !selectedCat) return;
    const id = clean
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_');

    const newConfig = localCats.map(c => {
      if (c.id === selectedCat.id) {
        return {
          ...c,
          subcategorias: [...c.subcategorias, { id, label: clean }]
        };
      }
      return c;
    });

    setLocalCats(newConfig);
    setNewSubcatName('');
    saveConfig(newConfig);
  };

  // Renombrar subcategoría
  const handleStartEditSubcat = (sub) => {
    setEditingSubId(sub.id);
    setSubDraftLabel(sub.label);
  };

  const handleSaveEditSubcat = (subId) => {
    const clean = subDraftLabel.trim();
    if (!clean || !selectedCat) {
      setEditingSubId(null);
      return;
    }
    const newConfig = localCats.map(c => {
      if (c.id === selectedCat.id) {
        return {
          ...c,
          subcategorias: c.subcategorias.map(s => s.id === subId ? { ...s, label: clean } : s)
        };
      }
      return c;
    });
    setLocalCats(newConfig);
    setEditingSubId(null);
    saveConfig(newConfig);
  };

  // Eliminar subcategoría
  const handleDeleteSubcat = (subId) => {
    if (!selectedCat) return;
    const newConfig = localCats.map(c => {
      if (c.id === selectedCat.id) {
        return {
          ...c,
          subcategorias: c.subcategorias.filter(s => s.id !== subId)
        };
      }
      return c;
    });
    setLocalCats(newConfig);
    saveConfig(newConfig);
  };

  const totalCategorias = localCats.length;
  const totalSubcategorias = localCats.reduce((acc, c) => acc + (c.subcategorias?.length || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="glass-card modal-content config-modal-card-2col" 
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="config-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="config-icon-badge">
              <FolderTree size={20} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Configuración de Categorías
                </h2>
                {saving && (
                  <span style={{ fontSize: '0.75rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span className="spin" style={{ display: 'inline-block' }}>⚙️</span> Guardando...
                  </span>
                )}
                {saveSuccess && (
                  <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={13} color="#34d399" /> Guardado
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {totalCategorias} categorías • {totalSubcategorias} subcategorías activas
              </div>
            </div>
          </div>

          <button 
            className="cat-tool-btn" 
            onClick={onClose} 
            title="Cerrar ventana"
            style={{ padding: '0.45rem' }}
          >
            <X size={18} color="var(--text-muted)" />
          </button>
        </div>

        {/* Master-Detail 2-Column Body */}
        <div className="config-master-detail-body">
          {/* --- Columna Izquierda: Lista de Categorías --- */}
          <div className="config-sidebar">
            <div className="config-sidebar-search">
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input 
                type="text"
                placeholder="Buscar categoría..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="config-sidebar-list">
              {filteredCats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Sin coincidencias
                </div>
              ) : (
                filteredCats.map(cat => {
                  const isActive = selectedCatId === cat.id;
                  const emoji = getCategoryEmoji(cat);
                  return (
                    <div 
                      key={cat.id}
                      className={`config-cat-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCatId(cat.id);
                        setIsEditingCat(false);
                        setIsConfirmingDelete(false);
                      }}
                    >
                      <div className="config-cat-item-left">
                        <span className="config-cat-item-emoji">{emoji}</span>
                        <span className="config-cat-item-label" title={cat.label}>{cat.label}</span>
                      </div>
                      <span className="config-cat-item-count">
                        {cat.subcategorias?.length || 0}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="config-sidebar-footer">
              {isCreatingCat ? (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input 
                    ref={newCatInputRef}
                    className="form-input"
                    placeholder="Nueva categoría..."
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddCat();
                      if (e.key === 'Escape') setIsCreatingCat(false);
                    }}
                    style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                  />
                  <button 
                    className="cat-tool-btn success"
                    onClick={handleAddCat}
                    title="Crear"
                    style={{ padding: '0.4rem' }}
                  >
                    <Check size={15} />
                  </button>
                  <button 
                    className="cat-tool-btn"
                    onClick={() => { setIsCreatingCat(false); setNewCatName(''); }}
                    title="Cancelar"
                    style={{ padding: '0.4rem' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <button 
                  className="config-new-cat-btn"
                  onClick={() => setIsCreatingCat(true)}
                >
                  <Plus size={14} />
                  <span>Nueva Categoría</span>
                </button>
              )}
            </div>
          </div>

          {/* --- Columna Derecha: Detalle de la Categoría Seleccionada --- */}
          <div className="config-detail">
            {selectedCat ? (
              <>
                {/* Header de Detalle */}
                <div className="config-detail-header">
                  <div className="config-detail-title-group">
                    <div className="config-detail-emoji">
                      {getCategoryEmoji(selectedCat)}
                    </div>

                    {isEditingCat ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                        <input 
                          ref={editCatInputRef}
                          className="form-input"
                          value={catDraftLabel}
                          onChange={e => setCatDraftLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEditCat();
                            if (e.key === 'Escape') setIsEditingCat(false);
                          }}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '1rem', width: '220px', fontWeight: 600 }}
                        />
                        <button className="cat-tool-btn success" onClick={handleSaveEditCat} title="Guardar">
                          <Check size={16} />
                        </button>
                        <button className="cat-tool-btn" onClick={() => setIsEditingCat(false)} title="Cancelar">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                        <h3 className="config-detail-title" title={selectedCat.label}>
                          {selectedCat.label}
                        </h3>
                        <button 
                          className="cat-tool-btn" 
                          onClick={handleStartEditCat} 
                          title="Renombrar categoría"
                          style={{ padding: '0.3rem' }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="config-detail-actions">
                    {isConfirmingDelete ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#fca5a5' }}>¿Eliminar?</span>
                        <button 
                          onClick={handleDeleteCat}
                          style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '0.3rem', fontSize: '0.7rem', padding: '0.2rem 0.45rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Sí
                        </button>
                        <button 
                          onClick={() => setIsConfirmingDelete(false)}
                          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#e2e8f0', borderRadius: '0.3rem', fontSize: '0.7rem', padding: '0.2rem 0.45rem', cursor: 'pointer' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="cat-tool-btn danger" 
                        onClick={() => setIsConfirmingDelete(true)}
                        title="Eliminar esta categoría"
                        style={{ padding: '0.4rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subcategorías Chips y Scroll */}
                <div className="config-detail-subcats-area">
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Tag size={13} />
                    <span>Subcategorías ({selectedCat.subcategorias?.length || 0})</span>
                  </div>

                  {selectedCat.subcategorias?.length === 0 ? (
                    <div style={{ padding: '1.5rem 1rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px dashed rgba(148, 163, 184, 0.15)', borderRadius: '0.65rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Esta categoría no tiene subcategorías específicas (se usa como categoría directa).
                    </div>
                  ) : (
                    <div className="config-subcats-chips">
                      {selectedCat.subcategorias.map(sub => {
                        const isEditingThisSub = editingSubId === sub.id;

                        if (isEditingThisSub) {
                          return (
                            <div key={sub.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--primary)', padding: '0.2rem 0.4rem', borderRadius: '0.5rem' }}>
                              <input 
                                ref={editSubcatInputRef}
                                value={subDraftLabel}
                                onChange={e => setSubDraftLabel(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveEditSubcat(sub.id);
                                  if (e.key === 'Escape') setEditingSubId(null);
                                }}
                                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.8rem', outline: 'none', width: '120px' }}
                              />
                              <button className="cat-tool-btn success" style={{ padding: '0.15rem' }} onClick={() => handleSaveEditSubcat(sub.id)}>
                                <Check size={13} />
                              </button>
                              <button className="cat-tool-btn" style={{ padding: '0.15rem' }} onClick={() => setEditingSubId(null)}>
                                <X size={13} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div key={sub.id} className="config-subcat-chip">
                            <span>{sub.label}</span>
                            <button 
                              className="config-subcat-chip-btn edit" 
                              onClick={() => handleStartEditSubcat(sub)}
                              title="Renombrar subcategoría"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button 
                              className="config-subcat-chip-btn" 
                              onClick={() => handleDeleteSubcat(sub.id)}
                              title="Eliminar subcategoría"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Barra Inferior: Agregar Subcategoría */}
                <div className="config-add-subcat-bar">
                  <input 
                    ref={newSubcatInputRef}
                    className="config-add-subcat-input"
                    placeholder={`Agregar subcategoría a "${selectedCat.label}"...`}
                    value={newSubcatName}
                    onChange={e => setNewSubcatName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubcat();
                    }}
                  />
                  <button 
                    className="config-add-subcat-btn"
                    onClick={handleAddSubcat}
                    disabled={!newSubcatName.trim() || saving}
                  >
                    <Plus size={15} />
                    <span>Agregar</span>
                  </button>
                </div>

                <div className="config-sync-note">
                  <Lightbulb size={13} color="#c084fc" />
                  <span>Sincronizado automáticamente con el bot de Telegram y los formularios de carga.</span>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <Tag size={32} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Seleccioná una categoría para ver y editar sus subcategorías.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
