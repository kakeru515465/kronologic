// オンライン対戦のサーバーの場所。
// GitHub Pages で開いたときは、Render のサーバーにつなぐ。
// Render 自身や、自分のパソコンで開いたときは、空（同じ場所のサーバーを使う）。
window.SERVER_URL = location.hostname.endsWith("github.io") ? "https://kronologic.onrender.com" : "";
