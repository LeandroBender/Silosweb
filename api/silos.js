import { createClient } from '@supabase/supabase-js';

const SILO_NAMES = Array.from({ length: 8 }, (_, i) => `Silo ${i + 1}`);
const nameKeys = ['silo', 'name', 'sensor', 'device', 'silo_name'];

const READINGS_TABLE = process.env.READINGS_TABLE || 'readings';
const READINGS_ORDER_COLUMN = process.env.READINGS_ORDER_COLUMN || 'created_at';
const READINGS_HUMIDITY_FIELD = process.env.READINGS_HUMIDITY_FIELD || 'moisture';
const READINGS_TIMESTAMP_FIELD = process.env.READINGS_TIMESTAMP_FIELD || 'created_at';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function fetchLastRows(limit) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(READINGS_TABLE)
    .select('*')
    .order(READINGS_ORDER_COLUMN, { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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

    const humidityRaw = assigned ? (
      assigned[READINGS_HUMIDITY_FIELD] ?? assigned.moisture ?? assigned.humidity ?? assigned.humedad ?? assigned.value ?? assigned.hum ?? assigned.hum_perc
    ) : null;
    const h = Math.max(0, Number.isFinite(Number(humidityRaw)) ? Number(humidityRaw) : 0);
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
    const silos = mapRowsToSilos(rows);
    res.status(200).json(silos);
  } catch (err) {
    // fallback a datos deterministas si hay error de Supabase
    const silos = mapRowsToSilos([]);
    res.status(200).json(silos);
  }
}
