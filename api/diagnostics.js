import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  // Hardcode activado para facilitar la verificación
  const READINGS_TABLE = 'readings';
  const ORDER_COL = 'created_at';
  const HUM_FIELD = 'moisture';

    const envOk = Boolean(SUPABASE_URL && SUPABASE_KEY);
    if (!envOk) {
      res.status(200).json({ envOk, reason: 'Missing SUPABASE_URL and/or KEY', vars: {
        hasUrl: Boolean(SUPABASE_URL), hasKey: Boolean(SUPABASE_KEY), READINGS_TABLE, ORDER_COL, HUM_FIELD
      }});
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data, error } = await supabase
      .from(READINGS_TABLE)
      .select('*')
      .order(ORDER_COL, { ascending: false })
      .limit(3);

    res.status(200).json({ envOk, count: data?.length || 0, sample: data || [], table: READINGS_TABLE, orderBy: ORDER_COL, moistureField: HUM_FIELD, error: error ? String(error) : null });
  } catch (err) {
    res.status(200).json({ envOk: true, error: String(err) });
  }
}
