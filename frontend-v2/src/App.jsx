import { useState, useEffect, useMemo } from 'react';
import { Wallet, ChevronLeft, ChevronRight, Sparkles, Bell, Calendar, FileText, Settings, Lock } from 'lucide-react';
import { toast } from 'sonner';
import './index.css';

import Dashboard from './components/Dashboard';
import TarjetasBandeja from './components/TarjetasBandeja';
import CreateModal from './components/modals/CreateModal';
import EditModal from './components/modals/EditModal';
import AiModal from './components/modals/AiModal';
import ReminderModal from './components/modals/ReminderModal';
import ScanResumenModal from './components/modals/ScanResumenModal';
import ConfigModal from './components/modals/ConfigModal';
import AuthLockScreen, { getIsAuthenticated, logoutUser } from './components/AuthLockScreen';

import { API_BASE } from './config';

const API_URL = `${API_BASE}/api/gastos`;

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getIsAuthenticated());
  const [gastos, setGastos] = useState([]);
  const [editingGasto, setEditingGasto] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [subCategoryFilter, setSubCategoryFilter] = useState('Todas');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('Todos');
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [cuotasPendientes, setCuotasPendientes] = useState([]);
  const [suscripciones, setSuscripciones] = useState([]);
  const [categoriasConfig, setCategoriasConfig] = useState([]);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const fetchCuotas = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cuotas`);
      if (res.ok) {
        const data = await res.json();
        setCuotasPendientes(data);
      }
    } catch (error) {
      console.error('Error fetching cuotas:', error);
    }
  };

  const fetchSuscripciones = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/suscripciones`);
      if (res.ok) {
        setSuscripciones(await res.json());
      }
    } catch (error) {
      console.error('Error fetching suscripciones:', error);
    }
  };

  const fetchGastos = async () => {
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const res = await fetch(`${API_URL}?month=${month}&year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setGastos(data);
      }
    } catch (error) {
      console.error('Error fetching gastos:', error);
    }
  };

  const fetchCategoriasConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categorias`);
      if (res.ok) {
        setCategoriasConfig(await res.json());
      }
    } catch (error) {
      console.error('Error fetching categorias:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchGastos();
    fetchCuotas();
    fetchSuscripciones();
    fetchCategoriasConfig();
    
    const interval = setInterval(() => {
      fetchGastos();
      fetchCuotas();
      fetchSuscripciones();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentDate, isAuthenticated]);

  const displayGastos = useMemo(() => {
    return gastos;
  }, [gastos]);

  const { totalMes, totalTarjeta, chartData, mayorGasto, uniqueCategories, uniqueSubCategories } = useMemo(() => {
    const categoryTotals = {};
    let total = 0;
    let totalTC = 0;
    let maxGasto = null;
    const cats = new Set();
    const subCats = new Set();
    
    displayGastos.forEach(g => {
      const cat = g.categoria || 'Otros';
      const subcat = g.subcategoria || 'Otros';
      const monto = parseFloat(g.monto) || 0;
      
      if (!maxGasto || monto > parseFloat(maxGasto.monto)) {
        maxGasto = g;
      }
      
      total += monto;
      if (g.metodo_pago === 'Tarjeta_Credito') {
        totalTC += monto;
      }

      categoryTotals[cat] = (categoryTotals[cat] || 0) + monto;
      cats.add(cat);
      if (categoryFilter === 'Todas' || cat === categoryFilter) {
        subCats.add(subcat);
      }
    });

    const chartTotal = total || 1;
    let currentOffset = 0;
    const colors = ['#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#ec4899', '#eab308', '#22c55e', '#ef4444', '#10b981', '#6366f1'];
    
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => {
        const cleanName = name.replace(/_/g, ' ');
        return { name: cleanName, value, color: colors[index % colors.length], filterKey: name };
      });

    const slices = sortedCategories.map(slice => {
      const pct = (slice.value / chartTotal) * 100;
      const offset = currentOffset;
      currentOffset -= pct;
      return { ...slice, pct, offset };
    });

    return { 
      totalMes: total, 
      totalTarjeta: totalTC,
      chartData: slices, 
      mayorGasto: maxGasto,
      uniqueCategories: Array.from(cats).sort(),
      uniqueSubCategories: Array.from(subCats).sort()
    };
  }, [displayGastos, categoryFilter]);

  const handleSaveCreate = async (e, isSuscripcion) => {
    e.preventDefault();
    if (isSuscripcion) {
      fetchCuotas(); // Al volver refrescamos las tarjetas y suscripciones 
      // pero en este caso las suscripciones las maneja TarjetasBandeja. Mejor solo cerrar.
      setIsCreating(false);
      return;
    }
    
    try {
      const formData = new FormData(e.target);
      const newGasto = {
        descripcion: formData.get('descripcion'),
        monto: parseFloat(formData.get('monto')),
        categoria: formData.get('categoria'),
        subcategoria: formData.get('subcategoria') || 'Otros',
        metodo_pago: formData.get('metodo_pago') || 'Debito_Efectivo',
        cuotas: parseInt(formData.get('cuotas')) || 1,
        cuota_actual: parseInt(formData.get('cuota_actual')) || 1,
        monto_tipo: formData.get('monto_tipo') || 'por_cuota',
        fecha: formData.get('fecha') || undefined
      };

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGasto)
      });
      
      if (res.ok) {
        const result = await res.json();
        if (result.cuotas) {
           fetchCuotas();
           setCurrentTab('tarjetas');
        } else {
           setGastos(prev => [result, ...prev]);
        }
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating:', error);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.target);
      const updatedGasto = {
        descripcion: formData.get('descripcion'),
        monto: parseFloat(formData.get('monto')),
        categoria: formData.get('categoria'),
        subcategoria: formData.get('subcategoria') || 'Otros',
        metodo_pago: formData.get('metodo_pago') || 'Debito_Efectivo',
        fecha: formData.get('fecha') || undefined
      };

      const res = await fetch(`${API_URL}/${editingGasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedGasto)
      });
      
      if (res.ok) {
        const result = await res.json();
        setGastos(prev => prev.map(g => g.id === result.id ? result : g));
        setEditingGasto(null);
      }
    } catch (error) {
      console.error('Error updating:', error);
    }
  };

  const liquidarCuota = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/cuotas/${id}/pagar`, { method: 'POST' });
      if (res.ok) {
        fetchCuotas();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (error) {
      console.error('Error liquidando cuota:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de que querés borrar este gasto?')) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGastos(prev => prev.filter(g => g.id !== id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const prevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  
  const monthName = currentDate.toLocaleDateString('es-AR', { month: 'long' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const filteredGastos = useMemo(() => {
    return displayGastos.filter(g => {
      const matchCat = categoryFilter === 'Todas' || (g.categoria || '') === categoryFilter;
      const matchSubCat = subCategoryFilter === 'Todas' || (g.subcategoria || '') === subCategoryFilter;
      const matchPayment = paymentMethodFilter === 'Todos' || (g.metodo_pago || 'Debito_Efectivo') === paymentMethodFilter;
      return matchCat && matchSubCat && matchPayment;
    });
  }, [displayGastos, categoryFilter, subCategoryFilter, paymentMethodFilter]);

  return (
    <div className="dashboard-container">
      <header className="app-header">
        <div className="app-header-title">
          <h1><Wallet size={32} color="var(--primary)" /> Mis Finanzas</h1>
          <div className="subtitle">Estado Financiero en Tiempo Real</div>
        </div>
        
        <div className="app-header-actions">
          <button 
            className="ai-magic-btn"
            onClick={() => setIsAiModalOpen(true)}
            title="Pedir una opinión inteligente a la IA sobre tus gastos"
          >
            <Sparkles size={16} className="sparkle-icon" />
            <span>Análisis IA</span>
          </button>

          <button 
            className="icon-btn"
            onClick={() => setIsScanModalOpen(true)}
            title="Escanear resumen de tarjeta o factura en PDF/Imagen con IA"
            style={{ 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(13, 148, 136, 0.2))', 
              border: '1px solid rgba(16, 185, 129, 0.4)', 
              borderRadius: '0.75rem', 
              padding: '0.5rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              color: '#34d399',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
              transition: 'all 0.2s ease'
            }}
          >
            <FileText size={16} color="#34d399" />
            <span>Escanear Resumen</span>
          </button>

          <button
            className="icon-btn"
            onClick={() => setIsReminderModalOpen(true)}
            title="Configurar recordatorio diario de gastos por Telegram"
            style={{ 
              background: 'rgba(30, 41, 59, 0.6)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '0.75rem', 
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-main)',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
          >
            <Bell size={16} color="#8b5cf6" />
            <span>Recordatorio</span>
          </button>

          <button
            className="icon-btn"
            onClick={() => setIsConfigModalOpen(true)}
            title="Configurar Categorías"
            style={{ 
              background: 'rgba(30, 41, 59, 0.6)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '0.75rem', 
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            <Settings size={18} color="#94a3b8" />
          </button>

          {getIsAuthenticated() && (
            <button
              className="icon-btn"
              onClick={() => {
                logoutUser();
                setIsAuthenticated(false);
              }}
              title="Bloquear pantalla / Cerrar sesión"
              style={{ 
                background: 'rgba(239, 68, 68, 0.12)', 
                border: '1px solid rgba(239, 68, 68, 0.3)', 
                borderRadius: '0.75rem', 
                padding: '0.5rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Lock size={18} color="#ef4444" />
            </button>
          )}

          <div className="tabs tabs-mobile-wrapper" style={{ display: 'flex', gap: '0.25rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
            <button 
              style={{ background: currentTab === 'dashboard' ? 'var(--primary)' : 'transparent', color: currentTab === 'dashboard' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
              onClick={() => setCurrentTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              style={{ background: currentTab === 'tarjetas' ? 'var(--primary)' : 'transparent', color: currentTab === 'tarjetas' ? '#fff' : 'var(--text-muted)', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
              onClick={() => {
                setCurrentTab('tarjetas');
                fetchCuotas();
              }}
            >
              Tarjetas
            </button>
          </div>

          <div className="date-navigator" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(30, 41, 59, 0.7)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.85rem',
            padding: '0.35rem 0.6rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(10px)'
          }}>
            <button 
              className="icon-btn" 
              onClick={prevMonth}
              title="Mes anterior"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                padding: '0.3rem',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={18} />
            </button>

            <div style={{ 
              fontWeight: 700, 
              fontSize: '0.95rem', 
              minWidth: '135px', 
              textAlign: 'center',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem'
            }}>
              <Calendar size={15} color="#8b5cf6" />
              <span>{capitalizedMonth}</span>
              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{currentDate.getFullYear()}</span>
            </div>

            <button 
              className="icon-btn" 
              onClick={nextMonth}
              title="Mes siguiente"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.5rem',
                padding: '0.3rem',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </header>

      {currentTab === 'tarjetas' && (
        <TarjetasBandeja 
          cuotasPendientes={cuotasPendientes}
          fetchCuotas={fetchCuotas}
          liquidarCuota={liquidarCuota}
          setIsCreating={setIsCreating}
          currentDate={currentDate}
          suscripciones={suscripciones}
          fetchSuscripciones={fetchSuscripciones}
        />
      )}

      {currentTab === 'dashboard' && (
        <Dashboard 
          totalMes={totalMes}
          totalTarjeta={totalTarjeta}
          mayorGasto={mayorGasto}
          chartData={chartData}
          uniqueCategories={uniqueCategories}
          uniqueSubCategories={uniqueSubCategories}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          subCategoryFilter={subCategoryFilter}
          setSubCategoryFilter={setSubCategoryFilter}
          paymentMethodFilter={paymentMethodFilter}
          setPaymentMethodFilter={setPaymentMethodFilter}
          filteredGastos={filteredGastos}
          setIsCreating={setIsCreating}
          setEditingGasto={setEditingGasto}
          handleDelete={handleDelete}
        />
      )}

      {isCreating && (
        <CreateModal 
          currentTab={currentTab} 
          setIsCreating={setIsCreating} 
          handleSaveCreate={handleSaveCreate} 
          categoriasConfig={categoriasConfig}
        />
      )}

      {editingGasto && (
        <EditModal 
          editingGasto={editingGasto} 
          setEditingGasto={setEditingGasto} 
          handleSaveEdit={handleSaveEdit}
          handleDelete={handleDelete}
          categoriasConfig={categoriasConfig}
        />
      )}

      <AiModal 
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        monthName={`${capitalizedMonth} ${currentDate.getFullYear()}`}
        totalMes={totalMes}
        totalTarjeta={totalTarjeta}
        mayorGasto={mayorGasto}
        chartData={chartData}
        gastos={gastos}
      />

      <ReminderModal 
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
      />

      <ScanResumenModal 
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onImportSuccess={() => {
          fetchGastos();
          fetchCuotas();
        }}
      />

      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        categorias={categoriasConfig}
        setCategorias={setCategoriasConfig}
      />

      {!isAuthenticated && (
        <AuthLockScreen onAuthenticated={() => setIsAuthenticated(true)} />
      )}
    </div>
  );
}

export default App;
