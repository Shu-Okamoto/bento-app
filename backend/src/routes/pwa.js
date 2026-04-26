const router = require('express').Router();
const supabase = require('../utils/supabase');

// 事業所ごとの動的マニフェスト生成
router.get('/o/:slug/manifest.json', async (req, res) => {
  const { slug } = req.params;
  const { data: office } = await supabase
    .from('offices').select('name, short_name').eq('slug', slug).single();
  const officeName = office?.short_name || office?.name || slug;

  const manifest = {
    name: `${officeName} 弁当注文`,
    short_name: officeName,
    description: '里の味みかわ 弁当注文システム',
    theme_color: '#1D9E75',
    background_color: '#F9F4E8',
    display: 'standalone',
    orientation: 'portrait',
    start_url: `/o/${slug}/home`,
    scope: `/o/${slug}/`,
    icons: [
      { src: `/api/pwa/o/${slug}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `/api/pwa/o/${slug}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };

  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.json(manifest);
});

// フリー会員用マニフェスト
router.get('/free/manifest.json', async (req, res) => {
  const manifest = {
    name: 'みかわ弁当注文',
    short_name: '弁当注文',
    description: '里の味みかわ 弁当注文システム',
    theme_color: '#1D9E75',
    background_color: '#F9F4E8',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/free/home',
    scope: '/free/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');
  res.json(manifest);
});

// 動的アイコン生成（SVG）
router.get('/o/:slug/icon-:size.png', async (req, res) => {
  const { slug } = req.params;
  const size = parseInt(req.params.size) || 192;
  const { data: office } = await supabase
    .from('offices').select('name, short_name').eq('slug', slug).single();
  const officeName = office?.short_name || office?.name || slug;

  const len = officeName.length;
  const fontSize = len <= 3 ? Math.round(size * 0.14)
                : len <= 5 ? Math.round(size * 0.12)
                : len <= 7 ? Math.round(size * 0.10)
                : Math.round(size * 0.08);

  const bm = Math.round(size * 0.04);
  const bw = Math.max(1, Math.round(size * 0.018));
  const logoSize = Math.round(size * 0.52);
  const logoX = Math.round((size - logoSize) / 2);
  const logoY = Math.round(size * 0.07);
  const sepY = Math.round(size * 0.65);
  const textY = Math.round(size * 0.82);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#F9F4E8"/>
  <rect x="${bm+bw/2}" y="${bm+bw/2}" width="${size-bm*2-bw}" height="${size-bm*2-bw}" fill="none" stroke="#D93A1A" stroke-width="${bw}"/>
  <g transform="translate(${logoX},${logoY})">
    <circle cx="${logoSize/2}" cy="${logoSize/2}" r="${logoSize*0.46}" fill="none" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.04)}"/>
    <line x1="${logoSize*0.30}" y1="${logoSize*0.22}" x2="${logoSize*0.70}" y2="${logoSize*0.22}" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.035)}"/>
    <line x1="${logoSize*0.26}" y1="${logoSize*0.32}" x2="${logoSize*0.74}" y2="${logoSize*0.32}" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.035)}"/>
    <line x1="${logoSize*0.30}" y1="${logoSize*0.42}" x2="${logoSize*0.70}" y2="${logoSize*0.42}" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.035)}"/>
    <polyline points="${logoSize*0.50},${logoSize*0.44} ${logoSize*0.72},${logoSize*0.58} ${logoSize*0.72},${logoSize*0.75} ${logoSize*0.28},${logoSize*0.75} ${logoSize*0.28},${logoSize*0.58} ${logoSize*0.50},${logoSize*0.44}" fill="none" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.035)}" stroke-linejoin="round"/>
    <line x1="${logoSize*0.50}" y1="${logoSize*0.58}" x2="${logoSize*0.50}" y2="${logoSize*0.75}" stroke="#C8102E" stroke-width="${Math.max(1,logoSize*0.035)}"/>
  </g>
  <line x1="${size*0.28}" y1="${sepY}" x2="${size*0.72}" y2="${sepY}" stroke="#D93A1A" stroke-width="${Math.max(1,size*0.005)}"/>
  <text x="${size/2}" y="${textY}" font-family="'Hiragino Mincho ProN','Yu Mincho',serif" font-size="${fontSize}" font-weight="bold" fill="#2B2318" text-anchor="middle" dominant-baseline="middle">${officeName}</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

module.exports = router;
