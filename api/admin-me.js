import { requireAdmin } from '../lib/auth.js';

export default async function handler(req, res) {
  const admin = requireAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  res.status(200).json({ email: admin.email, nombre: admin.nombre });
}
