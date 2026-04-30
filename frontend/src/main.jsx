import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/* =========================
   ★ ここから追加（最重要）
========================= */
function injectDynamicManifest() {
  const pathParts = window.location.pathname.split("/");
  const officeId = pathParts[2]; // /o/iwakuni

  if (!officeId) return;

  const manifest = {
    name: `弁当注文 ${officeId}`,
    short_name: officeId,
    start_url: `/o/${officeId}`,
    scope: `/o/${officeId}`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff"
  };

  const blob = new Blob([JSON.stringify(manifest)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);

  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }

  link.href = url;
}

// ★ React起動前に実行
injectDynamicManifest();
/* =========================
   ★ ここまで追加
========================= */


/* =========================
   ★ service worker登録
========================= */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
  //  navigator.serviceWorker.register("/sw.js");
  });
}
/* ========================= */


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
