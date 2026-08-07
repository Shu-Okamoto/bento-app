const crypto = require('crypto');

// =============================================
// Shopify Admin API クライアント
// =============================================
// フリー会員のその場決済は「下書き注文（Draft Order）」方式を使う。
//   - 商品をShopify側に登録しなくても、任意の名称・金額の明細を作れる
//   - 作成時に返る invoiceUrl がそのままShopifyのホスト型決済ページになる
//   - 支払われると通常の注文が生成され orders/paid Webhookが飛ぶ
// これにより弁当アプリ側の商品マスタとShopifyを同期する必要がない。
// =============================================

const DEFAULT_API_VERSION = '2024-10';

function apiVersion() {
  return process.env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION;
}

// "https://xxx.myshopify.com/" のような値も受け付けてホスト名だけにする
function shopDomain() {
  return (process.env.SHOPIFY_SHOP_DOMAIN || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function isConfigured() {
  return !!(shopDomain() && process.env.SHOPIFY_ADMIN_TOKEN);
}

function webhookSecret() {
  return process.env.SHOPIFY_WEBHOOK_SECRET || '';
}

async function graphql(query, variables) {
  if (!isConfigured()) throw new Error('Shopify連携が設定されていません');

  const res = await fetch(`https://${shopDomain()}/admin/api/${apiVersion()}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Shopifyの応答を解析できません（HTTP ${res.status}）`);
  }
  if (!res.ok) {
    throw new Error(`Shopify APIエラー（HTTP ${res.status}）: ${text.slice(0, 300)}`);
  }
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify APIエラー: ${json.errors.map(e => e.message).join(' / ')}`);
  }
  return json.data;
}

function throwUserErrors(payload, label) {
  const errs = payload?.userErrors || [];
  if (errs.length > 0) {
    throw new Error(`${label}に失敗しました: ${errs.map(e => e.message).join(' / ')}`);
  }
}

// gid://shopify/Order/12345 → "12345"
function numericId(gid) {
  if (!gid) return null;
  const m = String(gid).match(/(\d+)$/);
  return m ? m[1] : null;
}

// 管理者が返金などを行うためのShopify管理画面URL
function orderAdminUrl(gidOrId) {
  const id = numericId(gidOrId);
  if (!id || !shopDomain()) return null;
  return `https://${shopDomain()}/admin/orders/${id}`;
}

// ---------------------------------------------
// 下書き注文
// ---------------------------------------------

const DRAFT_ORDER_CREATE = `
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl status totalPriceSet { shopMoney { amount currencyCode } } }
      userErrors { field message }
    }
  }
`;

/**
 * 下書き注文を作成し、決済ページのURLを返す。
 *
 * @param {object}   params
 * @param {Array}    params.lineItems  [{ title, price(円/整数), quantity, customAttributes }]
 * @param {number}   params.discount   ポイント利用などの値引き額（円）
 * @param {string}   params.discountTitle
 * @param {string}   params.note       Shopify管理画面に表示するメモ
 * @param {Array}    params.customAttributes [{ key, value }] 注文の note_attributes に引き継がれる
 * @param {string[]} params.tags
 * @param {string}   params.email
 * @param {string}   params.phone
 */
async function createDraftOrder({ lineItems, discount, discountTitle, note, customAttributes, tags, email, phone }) {
  const input = {
    // 弁当は配達員が届けるためShopifyの配送は使わない。
    // requiresShipping:false にすると決済画面で住所入力を求められない。
    lineItems: (lineItems || []).map(li => ({
      title: li.title,
      originalUnitPrice: String(li.price),
      quantity: li.quantity,
      requiresShipping: false,
      taxable: false,
      customAttributes: li.customAttributes || [],
    })),
    // 商品価格は税込で登録されている前提。Shopify側で税を上乗せさせない。
    taxExempt: true,
    useCustomerDefaultAddress: false,
    customAttributes: customAttributes || [],
    tags: tags || [],
  };
  if (note) input.note = note;
  if (email) input.email = email;
  if (phone) input.phone = phone;
  if (discount && discount > 0) {
    input.appliedDiscount = {
      valueType: 'FIXED_AMOUNT',
      value: Number(discount),
      title: discountTitle || '値引き',
    };
  }

  const data = await graphql(DRAFT_ORDER_CREATE, { input });
  throwUserErrors(data.draftOrderCreate, '下書き注文の作成');

  const draft = data.draftOrderCreate.draftOrder;
  if (!draft?.invoiceUrl) throw new Error('Shopifyの決済URLを取得できませんでした');
  return draft;
}

const DRAFT_ORDER_QUERY = `
  query draftOrder($id: ID!) {
    draftOrder(id: $id) {
      id
      name
      status
      order { id name displayFinancialStatus }
    }
  }
`;

// Webhookが届かなかった場合のフォールバック確認用
async function getDraftOrder(id) {
  const data = await graphql(DRAFT_ORDER_QUERY, { id });
  return data.draftOrder;
}

const DRAFT_ORDER_DELETE = `
  mutation draftOrderDelete($input: DraftOrderDeleteInput!) {
    draftOrderDelete(input: $input) {
      deletedId
      userErrors { field message }
    }
  }
`;

// 期限切れ・キャンセル時にShopify側の下書きも片付ける
async function deleteDraftOrder(id) {
  const data = await graphql(DRAFT_ORDER_DELETE, { input: { id } });
  throwUserErrors(data.draftOrderDelete, '下書き注文の削除');
  return data.draftOrderDelete.deletedId;
}

// ---------------------------------------------
// Webhook
// ---------------------------------------------

const WEBHOOK_CREATE = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
      webhookSubscription { id topic }
      userErrors { field message }
    }
  }
`;

const WEBHOOK_LIST = `
  query webhookSubscriptions {
    webhookSubscriptions(first: 50) {
      nodes {
        id
        topic
        endpoint { ... on WebhookHttpEndpoint { callbackUrl } }
      }
    }
  }
`;

async function listWebhooks() {
  const data = await graphql(WEBHOOK_LIST, {});
  return (data.webhookSubscriptions?.nodes || []).map(n => ({
    id: n.id,
    topic: n.topic,
    callbackUrl: n.endpoint?.callbackUrl || null,
  }));
}

// 同じトピック・同じURLの購読が既にあれば作らない（何度実行しても安全）
async function ensureWebhook(topic, callbackUrl) {
  const existing = await listWebhooks();
  const hit = existing.find(w => w.topic === topic && w.callbackUrl === callbackUrl);
  if (hit) return { topic, callbackUrl, created: false, id: hit.id };

  const data = await graphql(WEBHOOK_CREATE, {
    topic,
    sub: { callbackUrl, format: 'JSON' },
  });
  throwUserErrors(data.webhookSubscriptionCreate, `Webhook（${topic}）の登録`);
  return {
    topic,
    callbackUrl,
    created: true,
    id: data.webhookSubscriptionCreate.webhookSubscription?.id || null,
  };
}

/**
 * Shopify Webhookの署名検証。
 * 生のリクエストボディ（Buffer）に対する HMAC-SHA256 を base64 で比較する。
 */
function verifyWebhook(rawBody, hmacHeader) {
  const secret = webhookSecret();
  if (!secret || !rawBody || !hmacHeader) return false;

  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(String(hmacHeader), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  shopDomain,
  apiVersion,
  webhookSecret,
  graphql,
  numericId,
  orderAdminUrl,
  createDraftOrder,
  getDraftOrder,
  deleteDraftOrder,
  listWebhooks,
  ensureWebhook,
  verifyWebhook,
};
