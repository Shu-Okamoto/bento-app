const router = require('express').Router();
const supabase = require('../utils/supabase');
const { adminMiddleware } = require('../middleware/auth');

router.get('/', async (_req, res) => {
  const { data } = await supabase.from('holidays').select('*').single();
  res.json(data || { closed_sat: true, closed_sun: true, closed_hol: true, extra_dates: [] });
});

router.put('/', adminMiddleware, async (req, res) => {
  const { closed_sat, closed_sun, closed_hol, extra_dates } = req.body;
  const { data: existing } = await supabase.from('holidays').select('id').single();
  let result;
  if (existing) {
    const { data } = await supabase.from('holidays').update({ closed_sat, closed_sun, closed_hol, extra_dates }).eq('id', existing.id).select().single();
    result = data;
  } else {
    const { data } = await supabase.from('holidays').insert({ closed_sat, closed_sun, closed_hol, extra_dates }).select().single();
    result = data;
  }
  res.json(result);
});

module.exports = router;
