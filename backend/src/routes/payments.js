const router = require('express').Router();
const crypto = require('crypto');
const supabase = require('../utils/supabase');
const shopify = require('../utils/shopify');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { checkDeadline, getDayOfWeek } = require('../utils/deadline');
const { sendLineNotify, sendEmailNotify } = require('../utils/notify');

// =============================================
// Shopify連携によるフリー会員のその場決済
// =============================================
// 「決済が完了してから注文を作る」方式。
//   1. POST /api/payments/checkout
//        → カート内容をサーバー側で再計算し payment_sessions に pending で保存
//        → Shopifyの下書き注文を作り invoice_url を返す
//   2. 会員はShopifyのホスト型決済ページでカード決済
//   3. Shopify Webhook（orders/paid）→ orders を作成しセッションを paid に
//   4. Webhookが届かなくても、会員がアプリに戻った時点の照会で自動的に補完する
//
// 金額・ポイント・締切・最低注文金額はすべてサーバー側で検証する。
// クライアントから送られた価格は一切信用しない。
// =============================================

const DEFAULT_FREE_MIN = 3000;
const MAX_ITEMS = 50;
const MAX_QTY = 99;

async function getPaymentSettings() {
  const { data } = await supabase.from('payment_settings').select('*').eq('id', 1).single();
  return {
    credit_enabled: !!data?.credit_enabled,
    free_min_total: data?.free_min_total ?? DEFAULT_FREE_MIN,
  };
}

// 実際にクレジット決済を提供できるか（管理画面のトグル＋環境変数の両方が必要）
async function creditAvailable() {
  const s = await getPaymentSettings();
  return s.credit_enabled && shopify.isConfigured();
}

function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function publicSession(s) {
  if (!s) return null;
  return {
    token: s.token,
    status: s.status,
    subtotal: s.subtotal,
    points_used: s.points_used,
    amount: s.amount,
    item_count: Array.isArray(s.items) ? s.items.length : 0,
    items: (s.items || []).map(i => ({
      product_name: i.product_name,
      quantity: i.quantity,
      delivery_date: i.delivery_date,
      options: i.options,
      note: i.note,
      line_total: i.line_total,
    })),
    checkout_url: s.invoice_url,
    shopify_order_name: s.shopify_order_name,
    order_count: s.order_count,
    needs_support: !!s.finalize_error,
    created_at: s.created_at,
    expires_at: s.expires_at,
    paid_at: s.paid_at,
  };
}

// ---------------------------------------------
// カート内容の検証（価格はすべてDBから引き直す）
// ---------------------------------------------
async function buildLineItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error('カートが空です');
  }
  if (rawItems.length > MAX_ITEMS) {
    throw new Error(`一度に注文できるのは${MAX_ITEMS}件までです`);
  }

  const productIds = [...new Set(rawItems.map(i => i.product_id).filter(Boolean))];
  if (productIds.length === 0) throw new Error('商品が指定されていません');

  const { data: products } = await supabase
    .from('products')
    .select('id, name, price, is_active, available_days, show_for_free, product_options(name, price)')
    .in('id', productIds);
  const productMap = Object.fromEntries((products || []).map(p => [p.id, p]));

  const items = [];
  for (const raw of rawItems) {
    const product = productMap[raw.product_id];
    if (!product) throw new Error('商品が見つかりません');
    if (product.is_active === false) throw new Error(`${product.name}は現在ご注文いただけません`);
    if (product.show_for_free === false) throw new Error(`${product.name}はフリー会員向けの商品ではありません`);

    const quantity = Math.floor(Number(raw.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      throw new Error('個数が不正です');
    }
    if (!isValidDate(raw.delivery_date)) throw new Error('お届け日が不正です');

    // 提供曜日の検証（空配列 / 7日指定は「毎日提供」）
    const days = product.available_days;
    if (Array.isArray(days) && days.length > 0 && days.length < 7) {
      if (!days.includes(getDayOfWeek(raw.delivery_date))) {
        throw new Error(`${product.name}は${raw.delivery_date}の曜日にはご注文いただけません`);
      }
    }

    // オプションは名前だけ受け取り、価格はDBの product_options を使う
    const catalog = product.product_options || [];
    const options = [];
    for (const opt of (raw.options || [])) {
      const found = catalog.find(c => c.name === opt?.name);
      if (!found) throw new Error(`「${opt?.name || '不明'}」は${product.name}のオプションにありません`);
      if (options.some(o => o.name === found.name)) continue; // 重複は無視
      options.push({ name: found.name, price: Number(found.price) || 0 });
    }

    const unitPrice = Number(product.price) || 0;
    const optTotal = options.reduce((s, o) => s + o.price, 0);
    const lineTotal = (unitPrice + optTotal) * quantity;

    items.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity,
      options,
      note: (raw.note || '').toString().slice(0, 200) || null,
      delivery_date: raw.delivery_date,
      line_total: lineTotal,
    });
  }

  return items;
}

// ---------------------------------------------
// ポイントの確保 / 返却
// ---------------------------------------------
// 二重利用を避けるため、決済セッション作成時点で残高から引いておく。
// 期限切れ・キャンセル時に戻す。
async function reservePoints(memberId, requested, cap) {
  const want = Math.floor(Number(requested) || 0);
  if (want <= 0) return 0;

  const { data: member } = await supabase.from('members').select('points').eq('id', memberId).single();
  const available = member?.points || 0;
  const use = Math.min(want, available, cap);
  if (use <= 0) return 0;

  // 残高が読み取り時から変わっていないことを条件に更新（同時実行対策）
  const { data: updated } = await supabase.from('members')
    .update({ points: available - use })
    .eq('id', memberId).eq('points', available)
    .select('points').maybeSingle();
  if (!updated) throw new Error('ポイント残高が更新されました。もう一度お試しください');
  return use;
}

async function refundPoints(memberId, points) {
  if (!memberId || !points || points <= 0) return;
  const { data: member } = await supabase.from('members').select('points').eq('id', memberId).single();
  await supabase.from('members')
    .update({ points: (member?.points || 0) + points })
    .eq('id', memberId);
}

// ---------------------------------------------
// 決済確定 → 注文作成
// ---------------------------------------------
async function notifyPaidOrders(session, memberName, lateDates) {
  const lines = (session.items || []).map(i => {
    const opts = (i.options || []).map(o => o.name).join('・');
    return `・${i.delivery_date} ${i.product_name} × ${i.quantity}個${opts ? `（${opts}）` : ''}`;
  });
  const msg = [
    '💳 フリー会員のカード決済が完了しました',
    '━━━━━━━━━━━━',
    `注文者：${memberName}`,
    `件数　：${(session.items || []).length}件`,
    ...lines,
    session.points_used > 0 ? `ポイント：-¥${session.points_used.toLocaleString()}` : '',
    `決済額：¥${Number(session.amount).toLocaleString()}`,
    session.shopify_order_name ? `Shopify：${session.shopify_order_name}` : '',
    lateDates.length > 0 ? `⚠ 締切後の決済（要確認）：${lateDates.join('・')}` : '',
    '━━━━━━━━━━━━',
  ].filter(Boolean).join('\n');

  await Promise.all([
    sendLineNotify(msg),
    sendEmailNotify('【みかわ弁当】カード決済で注文が入りました', msg),
  ]);
}

/**
 * セッションを paid にして注文を作成する。
 * status を pending → paid に変える更新を「予約」として使うため、
 * Webhookとポーリングがほぼ同時に走っても注文は一度しか作られない。
 */
async function finalizeSession(token, { shopifyOrderId, shopifyOrderName }) {
  const { data: claimed } = await supabase.from('payment_sessions')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      shopify_order_id: shopifyOrderId || null,
      shopify_order_name: shopifyOrderName || null,
    })
    .eq('token', token).eq('status', 'pending')
    .select().maybeSingle();

  if (!claimed) {
    const { data: current } = await supabase.from('payment_sessions')
      .select('*').eq('token', token).maybeSingle();

    // 期限切れ・中止扱いにした直後に入金された場合、入金だけが残ってしまう。
    // 自動では復旧できないので必ず管理者に知らせる。
    if (current && current.status !== 'paid') {
      const detail = `セッション：${token}\n状態：${current.status}\nShopify注文：${shopifyOrderName || '-'}\n金額：¥${Number(current.amount || 0).toLocaleString()}`;
      console.error('finalizeSession: 期限切れセッションへの入金', detail);
      await supabase.from('payment_sessions')
        .update({ finalize_error: `入金時にセッションが ${current.status} でした` })
        .eq('token', token);
      try {
        await Promise.all([
          sendLineNotify(`🚨 期限切れの決済に入金がありました\n${detail}\n※返金または手動での注文登録が必要です`),
          sendEmailNotify('【みかわ弁当】期限切れの決済に入金がありました', `${detail}\n\n返金または手動での注文登録をお願いします。`),
        ]);
      } catch (_) { /* 通知失敗は握りつぶす */ }
    }
    return current;
  }

  try {
    // ポイントはセッション作成時に確保済み。明細の頭から順に充当していく。
    let remaining = claimed.points_used || 0;
    const lateDates = [];
    const paidAt = claimed.paid_at || new Date().toISOString();
    let created = 0;

    for (const item of (claimed.items || [])) {
      // 決済中に締切を過ぎることがある。入金済みなので注文は作り、備考で分かるようにする。
      const check = await checkDeadline(item.delivery_date, claimed.office_id);
      if (!check.allowed && !lateDates.includes(item.delivery_date)) lateDates.push(item.delivery_date);

      const applied = Math.min(remaining, item.line_total);
      remaining -= applied;

      const note = [
        item.note,
        check.allowed ? null : '※締切後の決済（要確認）',
      ].filter(Boolean).join(' / ') || null;

      const { data: order, error } = await supabase.from('orders').insert({
        member_id: claimed.member_id,
        office_id: claimed.office_id,
        product_id: item.product_id,
        quantity: item.quantity,
        delivery_date: item.delivery_date,
        total_price: item.line_total - applied,
        is_delivered: false,
        note,
        payment_method: 'credit',
        payment_status: 'paid',
        paid_at: paidAt,
        points_used: applied,
        shopify_order_id: claimed.shopify_order_id,
        payment_session_token: claimed.token,
      }).select().single();
      if (error) throw new Error(error.message);

      if (item.options && item.options.length > 0) {
        await supabase.from('order_options').insert(
          item.options.map(o => ({ order_id: order.id, name: o.name, price: o.price }))
        );
      }
      created++;
    }

    const { data: done } = await supabase.from('payment_sessions')
      .update({ order_count: created, finalize_error: null })
      .eq('token', token).select().maybeSingle();

    try {
      const { data: member } = await supabase.from('members').select('name').eq('id', claimed.member_id).single();
      await notifyPaidOrders(done || claimed, member?.name || '不明', lateDates);
    } catch (e) { console.error('Notify error:', e); }

    return done || claimed;
  } catch (e) {
    // 入金済みなのに注文が作れなかった場合は、放置せず必ず管理者へ知らせる
    console.error('finalizeSession error:', e);
    const message = e.message || String(e);
    await supabase.from('payment_sessions')
      .update({ finalize_error: message }).eq('token', token);
    try {
      await Promise.all([
        sendLineNotify(`🚨 決済は完了しましたが注文の登録に失敗しました\nセッション：${token}\nShopify：${shopifyOrderName || '-'}\n理由：${message}\n※管理画面から手動で注文を登録してください`),
        sendEmailNotify('【みかわ弁当】決済後の注文登録に失敗しました', `セッション：${token}\nShopify注文：${shopifyOrderName || '-'}\n理由：${message}\n\n管理画面から手動で注文を登録してください。`),
      ]);
    } catch (_) { /* 通知失敗は握りつぶす */ }
    const { data: current } = await supabase.from('payment_sessions')
      .select('*').eq('token', token).maybeSingle();
    return current;
  }
}

// 期限切れ処理（ポイントを返し、Shopifyの下書きも削除する）
async function expireSession(session, status = 'expired') {
  const { data: claimed } = await supabase.from('payment_sessions')
    .update({ status })
    .eq('token', session.token).eq('status', 'pending')
    .select().maybeSingle();
  if (!claimed) {
    const { data: current } = await supabase.from('payment_sessions')
      .select('*').eq('token', session.token).maybeSingle();
    return current;
  }

  await refundPoints(claimed.member_id, claimed.points_used);
  if (claimed.shopify_draft_order_id) {
    try { await shopify.deleteDraftOrder(claimed.shopify_draft_order_id); }
    catch (e) { console.error('Draft order delete error:', e.message); }
  }
  return claimed;
}

/**
 * Webhookが届かなかった場合に備え、Shopify側の状態を見て追いつく。
 * 未払いのまま有効期限を過ぎていれば期限切れにする。
 */
async function reconcileSession(session) {
  if (!session || session.status !== 'pending') return session;

  if (session.shopify_draft_order_id && shopify.isConfigured()) {
    try {
      const draft = await shopify.getDraftOrder(session.shopify_draft_order_id);
      const order = draft?.order;
      const paid = order && (
        draft.status === 'COMPLETED' ||
        ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.displayFinancialStatus)
      );
      if (paid) {
        return await finalizeSession(session.token, {
          shopifyOrderId: order.id,
          shopifyOrderName: order.name,
        });
      }
    } catch (e) {
      console.error('Shopify reconcile error:', e.message);
      return session; // Shopifyに繋がらない間は期限切れにしない
    }
  }

  if (new Date() > new Date(session.expires_at)) {
    return await expireSession(session);
  }
  return session;
}

// =============================================
// 会員向けエンドポイント
// =============================================

// 決済方法の利用可否（カート画面の表示切替に使う）
router.get('/config', authMiddleware, async (req, res) => {
  const s = await getPaymentSettings();
  res.json({
    credit_enabled: s.credit_enabled && shopify.isConfigured() && req.user.member_type === 'free',
    free_min_total: s.free_min_total,
    currency: 'JPY',
  });
});

// 決済セッション作成 → Shopifyの決済ページURLを返す
router.post('/checkout', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'member') {
      return res.status(403).json({ error: '会員のみご利用いただけます' });
    }
    if (req.user.member_type !== 'free') {
      return res.status(400).json({ error: 'カード決済はフリー会員のみご利用いただけます' });
    }
    if (!(await creditAvailable())) {
      return res.status(400).json({ error: '現在カード決済はご利用いただけません' });
    }

    const settings = await getPaymentSettings();
    const items = await buildLineItems(req.body?.items);

    // 締切チェック（同じ日付は1回だけ確認）
    const dates = [...new Set(items.map(i => i.delivery_date))];
    for (const d of dates) {
      const check = await checkDeadline(d, req.user.office_id);
      if (!check.allowed) return res.status(400).json({ error: `${d}：${check.reason}` });
    }

    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    if (subtotal < settings.free_min_total) {
      return res.status(400).json({
        error: `合計¥${settings.free_min_total.toLocaleString()}以上から注文できます（現在：¥${subtotal.toLocaleString()}）`,
      });
    }

    const { data: member } = await supabase.from('members')
      .select('name, phone, points').eq('id', req.user.id).single();
    if (!member) return res.status(404).json({ error: '会員が見つかりません' });

    // 全額ポイント払いだとShopifyで0円決済になってしまうため現金払いへ誘導する
    const pointsCap = Math.max(0, subtotal - 1);
    const pointsUsed = await reservePoints(req.user.id, req.body?.points_used, pointsCap);
    const amount = subtotal - pointsUsed;

    const token = newToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data: session, error: insErr } = await supabase.from('payment_sessions').insert({
      token,
      member_id: req.user.id,
      office_id: req.user.office_id,
      provider: 'shopify',
      status: 'pending',
      subtotal,
      points_used: pointsUsed,
      amount,
      items,
      expires_at: expiresAt,
    }).select().single();
    if (insErr) {
      await refundPoints(req.user.id, pointsUsed);
      return res.status(500).json({ error: insErr.message });
    }

    // Shopifyの下書き注文を作成
    let draft;
    try {
      draft = await shopify.createDraftOrder({
        lineItems: items.map(i => {
          const optTotal = i.options.reduce((s, o) => s + o.price, 0);
          const optLabel = i.options.length > 0 ? `／${i.options.map(o => o.name).join('・')}` : '';
          return {
            title: `${i.product_name}（${i.delivery_date} お届け${optLabel}）`,
            price: i.unit_price + optTotal,
            quantity: i.quantity,
            customAttributes: [
              { key: 'お届け日', value: i.delivery_date },
              ...(i.options.length > 0 ? [{ key: 'オプション', value: i.options.map(o => o.name).join('・') }] : []),
              ...(i.note ? [{ key: '備考', value: i.note }] : []),
            ],
          };
        }),
        discount: pointsUsed,
        discountTitle: 'ポイント利用',
        note: `里の味みかわ 弁当注文アプリ（フリー会員）\n注文者：${member.name}\n電話：${member.phone || '-'}`,
        customAttributes: [
          { key: 'bento_session', value: token },
          { key: '注文者', value: member.name || '' },
          { key: '電話番号', value: member.phone || '' },
        ],
        tags: ['bento-app', 'フリー会員'],
      });
    } catch (e) {
      await supabase.from('payment_sessions').update({ status: 'cancelled' }).eq('token', token);
      await refundPoints(req.user.id, pointsUsed);
      console.error('Draft order create error:', e);
      return res.status(502).json({ error: `決済ページの作成に失敗しました：${e.message}` });
    }

    const { data: updated } = await supabase.from('payment_sessions')
      .update({ shopify_draft_order_id: draft.id, invoice_url: draft.invoiceUrl })
      .eq('token', token).select().maybeSingle();

    res.json({
      ...publicSession(updated || session),
      checkout_url: draft.invoiceUrl,
    });
  } catch (e) {
    console.error('Checkout error:', e);
    res.status(400).json({ error: e.message || '決済の開始に失敗しました' });
  }
});

// セッション照会（未確定なら Shopify に問い合わせて追いつく）
router.get('/session/:token', authMiddleware, async (req, res) => {
  const { data: session } = await supabase.from('payment_sessions')
    .select('*').eq('token', req.params.token).maybeSingle();
  if (!session) return res.status(404).json({ error: '決済情報が見つかりません' });
  if (req.user.role !== 'admin' && session.member_id !== req.user.id) {
    return res.status(403).json({ error: 'この決済を参照する権限がありません' });
  }
  const current = await reconcileSession(session);
  res.json(publicSession(current || session));
});

// 未払いセッションの取り消し（ポイントは返却される）
router.post('/session/:token/cancel', authMiddleware, async (req, res) => {
  const { data: session } = await supabase.from('payment_sessions')
    .select('*').eq('token', req.params.token).maybeSingle();
  if (!session) return res.status(404).json({ error: '決済情報が見つかりません' });
  if (req.user.role !== 'admin' && session.member_id !== req.user.id) {
    return res.status(403).json({ error: 'この決済を操作する権限がありません' });
  }
  if (session.status !== 'pending') {
    return res.status(400).json({ error: 'この決済は取り消せません' });
  }
  const current = await expireSession(session, 'cancelled');
  res.json(publicSession(current || session));
});

// 自分の直近の未払いセッション（決済ページから戻ってきた会員の復帰用）
router.get('/my/pending', authMiddleware, async (req, res) => {
  const { data } = await supabase.from('payment_sessions')
    .select('*').eq('member_id', req.user.id).eq('status', 'pending')
    .order('created_at', { ascending: false }).limit(1);
  const session = (data || [])[0];
  if (!session) return res.json(null);
  const current = await reconcileSession(session);
  res.json(publicSession(current || session));
});

// =============================================
// Shopify Webhook（認証なし・HMACで検証）
// =============================================
router.post('/webhook/shopify', async (req, res) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  if (!shopify.verifyWebhook(req.rawBody, hmac)) {
    console.warn('Shopify webhook: HMAC検証に失敗');
    return res.status(401).json({ error: 'invalid signature' });
  }

  const shopHeader = (req.get('X-Shopify-Shop-Domain') || '').toLowerCase();
  if (shopHeader && shopify.shopDomain() && shopHeader !== shopify.shopDomain().toLowerCase()) {
    console.warn('Shopify webhook: 想定外のショップ', shopHeader);
    return res.status(401).json({ error: 'unknown shop' });
  }

  // 検証を通ったら再送されないよう、以降は必ず200を返す
  try {
    const topic = req.get('X-Shopify-Topic') || '';
    const order = req.body || {};
    const attrs = order.note_attributes || [];
    const token = attrs.find(a => a?.name === 'bento_session')?.value;

    if (!token) {
      console.log(`Shopify webhook(${topic}): bento_session なし。無視します`);
      return res.json({ ok: true, ignored: true });
    }
    if (order.financial_status !== 'paid' && topic !== 'orders/paid') {
      console.log(`Shopify webhook(${topic}): 未入金（${order.financial_status}）のため保留`);
      return res.json({ ok: true, pending: true });
    }

    const result = await finalizeSession(token, {
      shopifyOrderId: order.admin_graphql_api_id || (order.id ? `gid://shopify/Order/${order.id}` : null),
      shopifyOrderName: order.name || null,
    });
    console.log(`Shopify webhook(${topic}): セッション ${token} → ${result?.status || '不明'}`);
    res.json({ ok: true, status: result?.status || null });
  } catch (e) {
    console.error('Shopify webhook error:', e);
    res.json({ ok: false, error: e.message });
  }
});

// =============================================
// 管理者向け
// =============================================

router.get('/admin/settings', adminMiddleware, async (_req, res) => {
  const s = await getPaymentSettings();
  res.json({
    ...s,
    shopify_configured: shopify.isConfigured(),
    shopify_shop_domain: shopify.shopDomain() || null,
    shopify_api_version: shopify.apiVersion(),
    shopify_auth_mode: shopify.authMode(),
    webhook_secret_configured: !!shopify.webhookSecret(),
  });
});

// 接続テスト（トークン・スコープが実際に有効かをShopifyに問い合わせて確認する）
router.post('/admin/test-connection', adminMiddleware, async (_req, res) => {
  if (!shopify.isConfigured()) {
    return res.status(400).json({ error: 'Shopifyの環境変数が設定されていません' });
  }
  try {
    const shop = await shopify.testConnection();
    res.json({ ok: true, shop });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.put('/admin/settings', adminMiddleware, async (req, res) => {
  const update = { updated_at: new Date().toISOString() };
  if (req.body.credit_enabled !== undefined) update.credit_enabled = !!req.body.credit_enabled;
  if (req.body.free_min_total !== undefined) {
    const v = Math.floor(Number(req.body.free_min_total));
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: '最低注文金額が不正です' });
    update.free_min_total = v;
  }
  const { data, error } = await supabase.from('payment_settings')
    .update(update).eq('id', 1).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Shopify側にWebhookを登録する（何度実行しても重複登録されない）
router.post('/admin/register-webhook', adminMiddleware, async (req, res) => {
  if (!shopify.isConfigured()) {
    return res.status(400).json({ error: 'Shopifyの環境変数が設定されていません' });
  }
  const base = (req.body?.callback_base || process.env.BACKEND_URL || `https://${req.get('host')}`)
    .replace(/\/+$/, '');
  const callbackUrl = `${base}/api/payments/webhook/shopify`;
  try {
    const results = [];
    for (const topic of ['ORDERS_PAID', 'ORDERS_CREATE']) {
      results.push(await shopify.ensureWebhook(topic, callbackUrl));
    }
    res.json({ callback_url: callbackUrl, results });
  } catch (e) {
    console.error('Webhook register error:', e);
    res.status(502).json({ error: e.message });
  }
});

// 決済セッション一覧（トラブル調査用）
router.get('/admin/sessions', adminMiddleware, async (req, res) => {
  const { status } = req.query;
  let query = supabase.from('payment_sessions')
    .select('*, members(name, phone)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(s => ({
    ...publicSession(s),
    member_name: s.members?.name || null,
    member_phone: s.members?.phone || null,
    finalize_error: s.finalize_error,
    shopify_admin_url: shopify.orderAdminUrl(s.shopify_order_id),
  })));
});

module.exports = router;
module.exports.finalizeSession = finalizeSession;
