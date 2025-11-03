export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  // Sin backend con estado, devolvemos historiales vacíos por defecto
  res.status(200).json({});
}
