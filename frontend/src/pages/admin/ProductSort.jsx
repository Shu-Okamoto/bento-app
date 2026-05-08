import { useState, useRef } from 'react';
import { api } from '../../utils/api';
import { useToast } from '../../components/Toast';

export default function ProductSort({ products, onSorted }) {
  const { showToast } = useToast();
  const [items, setItems] = useState(() =>
    [...products].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  );
  const [saving, setSaving] = useState(false);
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  function handleDragStart(idx) {
    dragIdx.current = idx;
  }

  function handleDragOver(e, idx) {
    e.preventDefault();
    dragOverIdx.current = idx;
  }

  function handleDrop() {
    const from = dragIdx.current;
    const to = dragOverIdx.current;
    if (from === null || to === null || from === to) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    dragIdx.current = null;
    dragOverIdx.current = null;
  }

  async function save() {
    setSaving(true);
    try {
      const orders = items.map((p, i) => ({ id: p.id, sort_order: i }));
      await api.patch('/products/sort', { orders });
      showToast('並び順を保存しました', 'success');
      onSorted(items);
    } catch(e) {
      showToast(e.message, 'error');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <p style={{ fontSize:13, color:'#666' }}>ドラッグ＆ドロップで順番を変更できます</p>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '保存中...' : '並び順を保存'}
        </button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {items.map((p, i) => (
          <div
            key={p.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={handleDrop}
            style={{
              display:'flex', alignItems:'center', gap:12,
              background:'white', border:'1px solid #e0dfd8',
              borderRadius:10, padding:'10px 14px',
              cursor:'grab', userSelect:'none',
              transition:'background 0.1s',
            }}
          >
            {/* ドラッグハンドル */}
            <div style={{ color:'#bbb', fontSize:18, cursor:'grab', flexShrink:0 }}>⠿</div>

            {/* 順番 */}
            <div style={{ width:24, height:24, background:'#1D9E75', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:700, flexShrink:0 }}>
              {i + 1}
            </div>

            {/* 商品画像 */}
            <div style={{ width:36, height:36, background:'#E1F5EE', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0, overflow:'hidden' }}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : '🍱'}
            </div>

            {/* 商品情報 */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
              <div style={{ fontSize:12, color:'#1D9E75' }}>¥{p.price?.toLocaleString()}</div>
            </div>

            {/* 公開状態 */}
            <span className={`badge ${p.is_active ? 'badge-green' : 'badge-amber'}`} style={{ flexShrink:0 }}>
              {p.is_active ? '公開' : '非公開'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
