import handlerSilos from './silos.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  // Reutilizamos el handler de silos para obtener el estado y derivar alertas
  const mockRes = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(obj) { this._json = obj; },
  };
  await handlerSilos({ method: 'GET' }, mockRes);
  const silos = mockRes._json || [];
  const alerts = [];
  for (const s of silos) {
    if (!s.active) alerts.push({ silo: s.name, msg: 'Silo inactivo', level: 'critical' });
    if (s.humidity >= 22) alerts.push({ silo: s.name, msg: `humedad alta (${s.humidity}%)`, level: 'critical' });
    else if (s.humidity > 18) alerts.push({ silo: s.name, msg: `humedad elevada (${s.humidity}%)`, level: 'warning' });
    if (s.requires_drying) alerts.push({ silo: s.name, msg: 'requiere secado', level: 'warning' });
    if (s.state === 'Mantenimiento') alerts.push({ silo: s.name, msg: 'en mantenimiento', level: 'warning' });
  }
  res.status(200).json(alerts);
}
