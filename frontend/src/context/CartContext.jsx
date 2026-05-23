import { createContext, useContext, useState } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const addItem = (item) => setItems(prev => [...prev, item]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
  const clearCart = () => setItems([]);

  const total = items.reduce((s, item) => {
    const optT = item.options.reduce((a, o) => a + o.price, 0);
    return s + (item.product.price + optT) * item.qty;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, open, setOpen, total }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
