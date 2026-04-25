require('dotenv').config();
const express = require('express');
const cors = require('cors');
const officeMiddleware = require('./middleware/office');
const app = express();

// CORS: すべての許可オリジンを列挙
const allowedOrigins = [
  process.env.FRONTEND_URL,                        // Vercel URL
  'https://order.satonoaji-mikawa.net',            // カスタムドメイン
  'https://www.order.satonoaji-mikawa.net',
  /https:\/\/[a-z0-9-]+\.order\.satonoaji-mikawa\.net$/,  // 事業所サブドメイン
  /https:\/\/[a-z0-9-]+\.order\.satonoaji-mikawa\.co\.jp$/,
  /http:\/\/localhost/,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    console.log(`CORS check: ${origin} → ${allowed ? 'OK' : 'BLOCKED'}`);
    callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
  },
  credentials: true
}));
app.use(express.json());
app.use(officeMiddleware);

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/offices',  require('./routes/offices'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/members',  require('./routes/members'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/holidays', require('./routes/holidays'));

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
