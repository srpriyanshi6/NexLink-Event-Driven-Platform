const jwt = require('jsonwebtoken');

const validateJWT = (req, res, next) => {
  const publicPaths = ['/health', '/api/auth/register', '/api/auth/login'];
  
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { validateJWT };