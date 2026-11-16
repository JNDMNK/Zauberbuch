// Verhindert Aufblitzen des falschen Farbschemas vor dem Laden von React (CSP-konform als Datei)
(function () {
  try {
    var t = localStorage.getItem('zb-theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
