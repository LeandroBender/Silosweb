export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  const { name } = req.query || {};
  // Sin backend persistente, devolvemos arreglo vacío (la UI lo maneja)
  res.status(200).json([]);
}
