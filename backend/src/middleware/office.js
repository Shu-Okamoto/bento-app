/**
 * サブドメインから事業所スラグを取得するミドルウェア
 * yamada-inc.order.satonoaji-mikawa.net → slug = 'yamada-inc'
 * order.satonoaji-mikawa.net → slug = null（管理者用）
 * localhost → 開発時はクエリパラメータ ?slug=yamada-inc で代替
 */
function officeMiddleware(req, res, next) {
  const host = req.headers.host || '';

  // 開発環境（localhost）はクエリパラメータで代替
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    req.officeSlug = req.query.slug || null;
    return next();
  }

  // サブドメインを抽出
  // 例: yamada-inc.order.satonoaji-mikawa.net
  //   → parts = ['yamada-inc', 'order', 'satonoaji-mikawa', 'net']
  const parts = host.split('.');

  // ベースドメインが order.satonoaji-mikawa.net（3階層）なので
  // 4つ以上の部分があればサブドメインあり
  if (parts.length >= 4) {
    req.officeSlug = parts[0]; // 先頭がスラグ
  } else {
    req.officeSlug = null; // 管理者用ドメイン
  }

  console.log(`Host: ${host} → officeSlug: ${req.officeSlug}`);
  next();
}

module.exports = officeMiddleware;
