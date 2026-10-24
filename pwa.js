// アプリとしてインストールするための準備（Chrome / Edge）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__install = e; // 画面の「インストール」ボタンから呼び出す
  window.dispatchEvent(new Event("pwa-ready"));
});
