import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      res.status(500).json({ error: 'Missing SUPABASE_URL and/or SUPABASE_[ANON|SERVICE]_KEY env vars' });
      return;
    }

  // Hardcode activado para simplificar
  const TABLE = 'readings';
  const ORDER_COL = 'created_at';
  const HUM_FIELD = 'moisture';

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    let data = null, error = null;
    try {
      const r = await supabase
        .from(TABLE)
        .select(`id, ${HUM_FIELD}, ${ORDER_COL}`)
        .order(ORDER_COL, { ascending: false })
        .limit(1)
        .maybeSingle();
      data = r.data; error = r.error;
    } catch (e) {
      error = e;
    }

    if (error) {
      res.status(500).json({ error: String(error) });
      return;
    }
    if (!data) {
      res.status(404).json({ error: 'No data' });
      return;
    }

    const value = data[HUM_FIELD];
    res.status(200).json({ id: data.id, moisture: value, created_at: data[ORDER_COL] });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
