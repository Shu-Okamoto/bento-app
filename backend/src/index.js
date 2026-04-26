require('dotenv').config();
const express = require('express');
const cors = require('cors');
const officeMiddleware = require('./middleware/office');
const app = express();

// CORS: 全オリジン許可（開発・移行期間中）
// 本番安定後に特定ドメインのみに絞ること
app.use(cors({
  origin: true,
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
app.use('/api/line',     require('./routes/line'));
app.use('/api/pwa',      require('./routes/pwa'));

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
