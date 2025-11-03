import { createClient } from '@supabase/supabase-js';

const SILO_NAMES = Array.from({ length: 8 }, (_, i) => `Silo ${i + 1}`);
const nameKeys = ['silo', 'name', 'sensor', 'device', 'silo_name'];

// Hardcode activado: usamos nombres fijos de tabla/columnas
const READINGS_TABLE = 'readings';
const READINGS_ORDER_COLUMN = 'created_at';
const READINGS_HUMIDITY_FIELD = 'moisture';
const READINGS_TIMESTAMP_FIELD = 'created_at';
// Activar debug por defecto (puedes desactivar con API_DEBUG=0)
const API_DEBUG = (process.env.API_DEBUG ?? '1') === '1';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function fetchLastRows(limit) {
  if (!supabase) return [];
  const orderCandidates = [
    READINGS_ORDER_COLUMN,
    'timestamp',
    'created_at',
    'time',
    'ts',
    'inserted_at',
    'id'
  ].filter((v, i, arr) => v && arr.indexOf(v) === i);

  for (const col of orderCandidates) {
    try {
      const { data, error } = await supabase
        .from(READINGS_TABLE)
        .select('*')
        .order(col, { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (API_DEBUG) console.log(`[api/silos] got ${data?.length || 0} rows ordered by ${col}`);
      // If we got any rows, return immediately
      if (data && data.length) return data;
      // keep trying next column if empty (could be RLS though)
    } catch (e) {
      if (API_DEBUG) console.log(`[api/silos] order by '${col}' failed`, String(e));
      // try next candidate
    }
  }
  // final fallback without explicit order (returns provider default)
  try {
    const { data, error } = await supabase
      .from(READINGS_TABLE)
      .select('*')
      .limit(limit);
    if (error) throw error;
    if (API_DEBUG) console.log(`[api/silos] fallback rows without order: ${data?.length || 0}`);
    return data || [];
  } catch (e) {
    if (API_DEBUG) console.log('[api/silos] fallback query failed', String(e));
    return [];
  }
}

function parseHumidity(val) {
  if (val == null) return null;
  if (typeof val === 'string') {
    const cleaned = val.replace('%', '').trim();
    const n = Number(cleaned);
    if (!Number.isNaN(n)) return n;
    return null;
  }
  if (typeof val === 'number') return val;
  return null;
}

function mapRowsToSilos(rows) {
  const mappedByName = {};
  for (const r of rows) {
    for (const k of nameKeys) {
      if (r[k]) { mappedByName[String(r[k])] = r; break; }
    }
  }
  const silos = SILO_NAMES.map((siloName, i) => {
    let assigned = mappedByName[siloName];
    if (!assigned) {
      const short = siloName.replace(/\s+/g, '').toLowerCase();
      for (const k of Object.keys(mappedByName)) {
        const kk = k.replace(/\s+/g, '').toLowerCase();
        if (kk === short) { assigned = mappedByName[k]; break; }
      }
    }
    if (!assigned && i < rows.length) assigned = rows[i];
    // si sólo hay una lectura (o pocas) y no hay mapeo, usar la más reciente para todos
    if (!assigned && rows.length) assigned = rows[0];

    const humidityRaw = assigned ? (
      assigned[READINGS_HUMIDITY_FIELD]
      ?? assigned.moisture
      ?? assigned.humidity
      ?? assigned.humedad
      ?? assigned.value
      ?? assigned.hum
      ?? assigned.hum_perc
      ?? assigned.moisture_perc
    ) : null;
    const parsed = parseHumidity(humidityRaw);
    const h = Math.max(0, Number.isFinite(Number(parsed)) ? Number(parsed) : 0);
    const ts = assigned ? (assigned[READINGS_TIMESTAMP_FIELD] || assigned.timestamp || assigned.created_at) : new Date().toISOString();

    return {
      name: siloName,
      humidity: Number(h.toFixed(1)),
      temperature: 20.0,
      level: 50,
      requires_drying: h > 18,
      active: true,
      state: 'Activo',
      last_update: String(ts)
    };
  });
  return silos;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const rows = await fetchLastRows(SILO_NAMES.length);
    if (API_DEBUG) {
      const sample = rows && rows.length ? rows[0] : {};
      const latestHum = sample ? sample[READINGS_HUMIDITY_FIELD] : undefined;
      const latestTs  = sample ? sample[READINGS_TIMESTAMP_FIELD] || sample[READINGS_ORDER_COLUMN] : undefined;
      console.log(`[api/silos] fetched rows=${rows.length}; latest -> id=${sample?.id ?? 'n/a'} ${READINGS_HUMIDITY_FIELD}=${latestHum} ${READINGS_TIMESTAMP_FIELD||READINGS_ORDER_COLUMN}=${latestTs}`);
    }
    // modo diagnóstico: devolver filas crudas
    if (req.query && (req.query.raw === '1' || req.query.raw === 'true')) {
      res.status(200).json({ rowsCount: rows.length, rows });
      return;
    }
    const silos = mapRowsToSilos(rows);
    if (API_DEBUG) {
      console.log('[api/silos] response preview:', silos.slice(0,3).map(s=>({name:s.name, humidity:s.humidity, last_update:s.last_update})));
    }
    res.status(200).json(silos);
  } catch (err) {
    // fallback a datos deterministas si hay error de Supabase
    if (API_DEBUG) console.log('[api/silos] error', String(err));
    const silos = mapRowsToSilos([]);
    res.status(200).json(silos);
  }
}
