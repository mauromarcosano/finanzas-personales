const pool = require('./db');

async function debugTarjetasBandeja() {
  const query = `
    SELECT ct.id as cuota_id, ct.numero_cuota, ct.monto, ct.estado, ct.gasto_id,
           c.id as compra_id, c.descripcion, c.monto_total, c.cuotas_totales, c.categoria, c.subcategoria, c.fecha_compra,
           COALESCE(c.cuota_inicial, 1) as cuota_inicial
    FROM cuotas_tarjeta ct
    JOIN compras_tarjeta c ON ct.compra_id = c.id
    ORDER BY c.fecha_compra DESC, ct.numero_cuota ASC;
  `;
  const res = await pool.query(query);
  const cuotasPendientes = res.rows;

  console.log(`Total cuotas en DB: ${cuotasPendientes.length}`);

  const selectedYear = 2026;
  const selectedMonth = 8; // Septiembre (0-indexed)
  const isCurrentCalendarMonth = true;

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

  // Lógica actual en TarjetasBandeja.jsx
  const cuotasPorCompra = {};

  cuotasPendientes.forEach(c => {
    if (c.estado !== 'Pendiente') return;
    const { year, month } = getCuotaYearMonth(c.fecha_compra, c.numero_cuota, c.cuota_inicial || 1);
    console.log(`Compra ${c.compra_id} ('${c.descripcion}'), Cuota ${c.numero_cuota}/${c.cuotas_totales}, fecha_compra=${c.fecha_compra} -> Calculated Year/Month: ${year}/${month} (Selected: ${selectedYear}/${selectedMonth})`);
    if (year === selectedYear && month === selectedMonth) {
      if (!cuotasPorCompra[c.compra_id] || c.numero_cuota < cuotasPorCompra[c.compra_id].numero_cuota) {
        cuotasPorCompra[c.compra_id] = c;
      }
    }
  });

  if (isCurrentCalendarMonth) {
    cuotasPendientes.filter(c => c.estado === 'Pendiente').forEach(c => {
      if (!cuotasPorCompra[c.compra_id] || c.numero_cuota < cuotasPorCompra[c.compra_id].numero_cuota) {
        cuotasPorCompra[c.compra_id] = c;
      }
    });
  }

  const result = Object.values(cuotasPorCompra);
  console.log(`\nResulting cuotasActivas (${result.length}):`);
  console.table(result.map(c => ({
    compra_id: c.compra_id,
    desc: c.descripcion,
    cuota: `${c.numero_cuota}/${c.cuotas_totales}`,
    monto: c.monto
  })));

  process.exit(0);
}

debugTarjetasBandeja();
