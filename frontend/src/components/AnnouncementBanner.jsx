import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_announcements') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    api.get('/announcements/active')
      .then(setAnnouncements)
      .catch(() => {});
  }, []);

  function dismiss(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem('dismissed_announcements', JSON.stringify(next));
  }

  const visible = announcements.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
      {visible.map(a => (
        <div key={a.id} style={{
          background:'#FFF8E1', border:'1px solid #FAC775', borderRadius:10,
          padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start'
        }}>
          <span style={{ fontSize:20, flexShrink:0 }}>📢</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:'#633806', marginBottom:4 }}>{a.title}</div>
            <div style={{ fontSize:13, color:'#5a4520', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{a.body}</div>
          </div>
          <button onClick={() => dismiss(a.id)}
            style={{ background:'none', border:'none', color:'#999', fontSize:18, cursor:'pointer', lineHeight:1, padding:'0 4px', flexShrink:0 }}
            aria-label="閉じる">×</button>
        </div>
      ))}
    </div>
  );
}
