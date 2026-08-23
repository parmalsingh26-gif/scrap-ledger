import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_123';

export const authMiddleware = (req, res, next) => {
  // Allow health check, login, and public assets
  if (req.path === '/health' || req.path.startsWith('/auth') || req.path.startsWith('/bvp/init') || req.path === '/init') {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user payload to request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};
