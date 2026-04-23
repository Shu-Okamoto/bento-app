const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');

// 管理者ログイン
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', email);

    const { data, error } = await supabase
      .from('admins').select('*').eq('email', email).single();

    console.log('DB result:', data ? 'found' : 'not found', error);

    if (error || !data) {
      return res.status(401).json({ error: 'メールまたはパスワードが違います' });
    }

    const { data: matched } = await supabase
      .rpc('check_admin_password', { input_email: email, input_password: password });

    console.log('Password match:', matched);

    if (!matched) {
      return res.status(401).json({ error: 'メールまたはパスワードが違います' });
    }

    const token = jwt.sign(
      { id: data.id, role: 'admin', email: data.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: data.id, email: data.email, role: 'admin' } });
  } catch(e) {
    console.error('Login error:', e);
    res.status(500).json({ error: e.message });
  }
});

// 事業所会員登録
router.post('/register', async (req, res) => {
  const { office_slug, name, department, phone, address, password } = req.body;
  if (!office_slug || !name || !password) return res.status(400).json({ error: '必須項目が不足しています' });

  const { data: office } = await supabase.from('offices').select('id').eq('slug', office_slug).single();
  if (!office) return res.status(404).json({ error: '事業所が見つかりません' });

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('members')
    .insert({ office_id: office.id, name, department, phone, address, password_hash, member_type: 'office' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  const token = jwt.sign(
    { id: data.id, role: 'member', office_id: office.id, member_type: 'office' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token, user: { id: data.id, name: data.name, role: 'member', member_type: 'office' } });
});

// フリー会員登録（/register/free）
router.post('/register/free', async (req, res) => {
  const { name, phone, address, password } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ error: '必須項目が不足しています' });

  // フリー会員用オフィスを取得
  const { data: office } = await supabase.from('offices').select('id').eq('slug', 'free').single();
  if (!office) return res.status(500).json({ error: 'フリー会員設定が見つかりません' });

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase.from('members')
    .insert({ office_id: office.id, name, phone, address, password_hash, member_type: 'free' })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });

  const token = jwt.sign(
    { id: data.id, role: 'member', office_id: office.id, member_type: 'free' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token, user: { id: data.id, name: data.name, role: 'member', member_type: 'free' } });
});

// 事業所会員ログイン
router.post('/login', async (req, res) => {
  const { office_slug, phone, password } = req.body;
  const { data: office } = await supabase.from('offices').select('id').eq('slug', office_slug).single();
  if (!office) return res.status(404).json({ error: '事業所が見つかりません' });

  const { data } = await supabase.from('members').select('*')
    .eq('office_id', office.id).eq('phone', phone).eq('member_type', 'office').single();
  if (!data) return res.status(401).json({ error: '電話番号またはパスワードが違います' });

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return res.status(401).json({ error: '電話番号またはパスワードが違います' });

  const token = jwt.sign(
    { id: data.id, role: 'member', office_id: office.id, member_type: 'office' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token, user: { id: data.id, name: data.name, department: data.department, role: 'member', member_type: 'office' } });
});

// フリー会員ログイン（/login/free）
router.post('/login/free', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: '必須項目が不足しています' });

  const { data } = await supabase.from('members').select('*')
    .eq('phone', phone).eq('member_type', 'free').single();
  if (!data) return res.status(401).json({ error: '電話番号またはパスワードが違います' });

  const ok = await bcrypt.compare(password, data.password_hash);
  if (!ok) return res.status(401).json({ error: '電話番号またはパスワードが違います' });

  const token = jwt.sign(
    { id: data.id, role: 'member', office_id: data.office_id, member_type: 'free' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  res.json({ token, user: { id: data.id, name: data.name, role: 'member', member_type: 'free' } });
});

module.exports = router;
