import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const OfficeContext = createContext(null);

/**
 * サブドメインから事業所情報を取得して保持する
 * yamada-inc.order.satonoaji-mikawa.net → { slug: 'yamada-inc', name: '山田製作所' }
 * order.satonoaji-mikawa.net → { slug: null } → 管理者画面
 */
export function OfficeProvider({ children }) {
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // サブドメインを取得
    const host = window.location.hostname;
    const parts = host.split('.');

    // 開発環境（localhost）はURLパスから slug を読む
    if (host === 'localhost' || host === '127.0.0.1') {
      const pathSlug = window.location.pathname.match(/^\/o\/([^/]+)/)?.[1];
      if (pathSlug) {
        setOffice({ slug: pathSlug });
      }
      setLoading(false);
      return;
    }

    // 本番: 4つ以上の部分があればサブドメインあり
    // 例: yamada-inc.order.satonoaji-mikawa.net → 4部分
    if (parts.length >= 4) {
      const slug = parts[0];
      // バックエンドで事業所情報を確認
      api.get('/offices/current')
        .then(data => {
          setOffice(data);
          if (data.slug) localStorage.setItem('office_slug', data.slug);
        })
        .catch(() => setOffice({ slug }))
        .finally(() => setLoading(false));
    } else {
      // 管理者用ドメイン or メインドメイン
      setOffice({ slug: null });
      setLoading(false);
    }
  }, []);

  return (
    <OfficeContext.Provider value={{ office, loading }}>
      {children}
    </OfficeContext.Provider>
  );
}

export const useOffice = () => useContext(OfficeContext);
