import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

const OfficeContext = createContext(null);

export function OfficeProvider({ children }) {
  const [office, setOffice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = window.location.hostname;
    const parts = host.split('.');

    // 開発環境（localhost）
    if (host === 'localhost' || host === '127.0.0.1') {
      const pathSlug = window.location.pathname.match(/^\/o\/([^/]+)/)?.[1];
      if (pathSlug) setOffice({ slug: pathSlug });
      setLoading(false);
      return;
    }

    // 本番：4つ以上のパーツがあればサブドメインあり
    // 例: yamada.order.satonoaji-mikawa.net → ['yamada','order','satonoaji-mikawa','net']
    if (parts.length >= 4) {
      const slug = parts[0];
      api.get('/offices/current')
        .then(data => {
          setOffice(data);
          if (data.slug) localStorage.setItem('office_slug', data.slug);
        })
        .catch(() => setOffice({ slug }))
        .finally(() => setLoading(false));
    } else {
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
