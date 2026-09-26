import React from 'react';
import { Wallet, CreditCard, TrendingUp, PieChart, Filter, AlertCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactCountUp from 'react-countup';
const CountUp = ReactCountUp.default || ReactCountUp;

const Dashboard = ({
  totalMes,
  totalTarjeta,
  mayorGasto,
  chartData,
  uniqueCategories,
  uniqueSubCategories,
  categoryFilter,
  setCategoryFilter,
  subCategoryFilter,
  setSubCategoryFilter,
  paymentMethodFilter,
  setPaymentMethodFilter,
  filteredGastos,
  setIsCreating,
  setEditingGasto,
  handleDelete
}) => {
  const [hoveredSlice, setHoveredSlice] = React.useState(null);
  return (
    <main className="bento-grid">
      {/* Metric Cards */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        className="glass-card card-total"
      >
        <div className="card-title">
          <Wallet size={16} color="#8b5cf6" />
          Dinero Total Del Mes
        </div>
        <div className="card-value">
          <span className="currency">$</span>
          <CountUp end={totalMes} duration={1.5} separator="." />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
        className="glass-card card-tarjeta"
      >
        <div className="card-title" style={{color: '#f97316'}}>
          <CreditCard size={16} color="#f97316" />
          Consumo Tarjeta (Mes)
        </div>
        <div className="card-value">
          <span className="currency" style={{color: '#f97316'}}>$</span>
          <CountUp end={totalTarjeta} duration={1.5} separator="." />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
        className="glass-card card-mayor" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
          <div className="card-title">
            <TrendingUp size={16} color="#ef4444" />
            Mayor Gasto del Mes
          </div>
          <div className="card-value" style={{ fontSize: '2.1rem', marginTop: '1rem' }}>
            {mayorGasto ? (
               <>
                 <span className="currency" style={{color: '#ef4444'}}>$</span>
                 <CountUp end={parseFloat(mayorGasto.monto)} duration={1.5} separator="." />
               </>
            ) : '-'}
          </div>
          {mayorGasto && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mayorGasto.descripcion} ({mayorGasto.categoria.replace(/_/g, ' ')})</div>}
        </div>
        
        {mayorGasto && (
          <div style={{ width: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {(() => {
               const pct = totalMes > 0 ? (parseFloat(mayorGasto.monto) / totalMes) * 100 : 0;
               const radius = 40;
               const circumference = Math.PI * radius;
               const dashOffset = circumference - (Math.min(pct, 100) / 100) * circumference;
               return (
                 <svg viewBox="0 0 100 55" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                   <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(239, 68, 68, 0.15)" strokeWidth="8" strokeLinecap="round" />
                   <path 
                     d="M 10 50 A 40 40 0 0 1 90 50" 
                     fill="none" 
                     stroke="#ef4444" 
                     strokeWidth="8" 
                     strokeLinecap="round" 
                     strokeDasharray={circumference} 
                     strokeDashoffset={dashOffset} 
                     style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)', filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))' }}
                   />
                   <text x="50" y="42" textAnchor="middle" fill="#ef4444" fontSize="20" fontWeight="800">
                     {pct.toFixed(1)}%
                   </text>
                 </svg>
               )
            })()}
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px', fontWeight: 600 }}>DEL MES</div>
          </div>
        )}
      </motion.div>

      {/* Chart Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.15 }}
        className="glass-card chart-section"
      >
        <div className="card-title mb-4">
          <PieChart size={16} color="#8b5cf6" />
          Distribución por Categorías
        </div>
        <div className="chart-container">
          <svg viewBox="-22 -22 44 44" className="donut-chart">
            {chartData.length === 0 ? (
              <circle
                cx="0" cy="0" r="15.9155"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="5.5"
              />
            ) : (
              chartData.map((slice, i) => {
                const isHovered = hoveredSlice?.filterKey === slice.filterKey;
                const isDimmed = hoveredSlice && !isHovered;
                const isSelected = categoryFilter === slice.filterKey;

                return (
                  <circle
                    key={i}
                    cx="0" cy="0" r="15.9155"
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={isHovered ? 7 : 5.5}
                    strokeDasharray={`${slice.pct} ${100 - slice.pct}`}
                    strokeDashoffset={slice.offset}
                    className="donut-segment"
                    style={{
                      opacity: isDimmed ? 0.35 : 1,
                      filter: isHovered ? `drop-shadow(0 0 10px ${slice.color}bb)` : isSelected ? `drop-shadow(0 0 4px ${slice.color}66)` : 'none',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setHoveredSlice(slice)}
                    onMouseLeave={() => setHoveredSlice(null)}
                    onClick={() => {
                      setCategoryFilter(categoryFilter === slice.filterKey ? 'Todas' : slice.filterKey);
                      setSubCategoryFilter('Todas');
                    }}
                  />
                );
              })
            )}
          </svg>

          <div className="chart-center-info">
            {hoveredSlice ? (
              <>
                <div className="center-cat-name" style={{ color: hoveredSlice.color }}>
                  {hoveredSlice.name}
                </div>
                <div className="center-amount">
                  $<CountUp end={hoveredSlice.value} duration={0.5} separator="." />
                </div>
                <div 
                  className="center-badge" 
                  style={{ 
                    backgroundColor: `${hoveredSlice.color}25`, 
                    color: hoveredSlice.color, 
                    borderColor: `${hoveredSlice.color}55` 
                  }}
                >
                  {hoveredSlice.pct.toFixed(1)}% del total
                </div>
              </>
            ) : (
              <>
                <div className="center-cat-name">Gastos Totales</div>
                <div className="center-amount">
                  $<CountUp end={totalMes} duration={1.5} separator="." />
                </div>
                <div className="center-badge">
                  {chartData.length} {chartData.length === 1 ? 'categoría' : 'categorías'}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="chart-legend">
          {chartData.map((slice, i) => {
            const isHovered = hoveredSlice?.filterKey === slice.filterKey;
            const isSelected = categoryFilter === slice.filterKey;
            const isDimmed = hoveredSlice && !isHovered;

            return (
              <div 
                className="legend-item" 
                key={i}
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => {
                  setCategoryFilter(categoryFilter === slice.filterKey ? 'Todas' : slice.filterKey);
                  setSubCategoryFilter('Todas');
                }}
                style={{ 
                  cursor: 'pointer', 
                  opacity: categoryFilter === 'Todas' ? (isDimmed ? 0.35 : 1) : (isSelected ? 1 : 0.3),
                  transition: 'all 0.2s ease',
                  padding: '0.35rem 0.6rem',
                  borderRadius: '0.5rem',
                  background: isHovered || isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: isHovered ? `1px solid ${slice.color}66` : '1px solid transparent',
                  transform: isHovered ? 'translateX(4px)' : 'none'
                }}
              >
                <div className="legend-name">
                  <div 
                    className="legend-color" 
                    style={{ 
                      backgroundColor: slice.color, 
                      boxShadow: isHovered ? `0 0 8px ${slice.color}` : 'none' 
                    }}
                  ></div>
                  <span>{slice.name}</span>
                  {isSelected && <Filter size={12} style={{marginLeft: '0.25rem', color: slice.color}} />}
                </div>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({slice.pct.toFixed(0)}%)</span>
                  <span>${slice.value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* List Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
        className="glass-card list-section"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Últimos Gastos Registrados</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setIsCreating(true)}
              className="primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.75rem' }}
            >
              <Plus size={14} /> Nuevo Gasto
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={14} color="var(--text-muted)" />
              <select 
                style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', outline: 'none' }}
                value={categoryFilter}
                onChange={e => {
                  setCategoryFilter(e.target.value);
                  setSubCategoryFilter('Todas');
                }}
                title="Categoría"
              >
                <option value="Todas" style={{ background: '#0f172a' }}>Todas (Cat)</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat} style={{ background: '#0f172a' }}>{cat.replace(/_/g, ' ')}</option>
                ))}
              </select>
              
              <select 
                style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', outline: 'none' }}
                value={subCategoryFilter}
                onChange={e => setSubCategoryFilter(e.target.value)}
                title="Subcategoría"
                disabled={uniqueSubCategories.length === 0}
              >
                <option value="Todas" style={{ background: '#0f172a' }}>Todas (Sub)</option>
                {uniqueSubCategories.map(subcat => (
                  <option key={subcat} value={subcat} style={{ background: '#0f172a' }}>{subcat.replace(/_/g, ' ')}</option>
                ))}
              </select>
              
              <select 
                style={{ background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', outline: 'none' }}
                value={paymentMethodFilter}
                onChange={e => setPaymentMethodFilter(e.target.value)}
                title="Método de Pago"
              >
                <option value="Todos" style={{ background: '#0f172a' }}>Todos (Pagos)</option>
                <option value="Debito_Efectivo" style={{ background: '#0f172a' }}>💵 Débito/Efectivo</option>
                <option value="Tarjeta_Credito" style={{ background: '#0f172a' }}>💳 Tarjeta de Créd.</option>
              </select>
            </div>
          </div>
        </div>
        
        {filteredGastos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No hay gastos registrados para este mes/filtro.<br/>Enviá un mensaje por Telegram para empezar.</p>
          </div>
        ) : (
          <div className="expense-list">
            <AnimatePresence>
            {filteredGastos.map(g => (
              <motion.div 
                layout="position"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="expense-item" 
                key={g.id}
              >
                <div className="expense-info">
                    <div className="expense-desc">
                      {g.descripcion} {g.metodo_pago === 'Tarjeta_Credito' && <span title="Tarjeta de Crédito" style={{fontSize:'0.8rem'}}>💳</span>}
                    </div>
                    <span 
                    className="expense-cat"
                    style={{ 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      background: categoryFilter !== 'Todas' && g.categoria === categoryFilter ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                      border: categoryFilter !== 'Todas' && g.categoria === categoryFilter ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent'
                    }}
                    onClick={() => {
                      if (categoryFilter === g.categoria && subCategoryFilter === g.subcategoria) {
                        setCategoryFilter('Todas');
                        setSubCategoryFilter('Todas');
                      } else if (categoryFilter === g.categoria) {
                         setSubCategoryFilter(g.subcategoria || 'Todas');
                      } else {
                         setCategoryFilter(g.categoria);
                         setSubCategoryFilter('Todas');
                      }
                    }}
                    title="Haz clic para filtrar por esta categoría/subcategoría"
                  >
                    {g.categoria.replace(/_/g, ' ')} 
                    {g.subcategoria && g.subcategoria !== 'Otros' && <span style={{ opacity: 0.7, fontSize: '0.7rem' }}> - {g.subcategoria.replace(/_/g, ' ')}</span>}
                    {categoryFilter !== 'Todas' && g.categoria === categoryFilter && <Filter size={10} />}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="expense-amount">
                    <span>${parseFloat(g.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</span>
                    <span className="expense-date">{new Date(g.fecha).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="actions">
                    <button className="icon-btn edit" onClick={() => setEditingGasto(g)} title="Editar o Eliminar Gasto">
                      <Pencil size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </main>
  );
};

export default Dashboard;
