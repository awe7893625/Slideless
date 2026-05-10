// Slideless nav — floating back button for report pages
(function() {
  // Don't show on index page
  if (location.pathname === '/' || location.pathname.endsWith('/index.html')) return;

  var btn = document.createElement('a');
  btn.href = '/index.html';
  btn.textContent = '\u2190 Reports';
  btn.style.cssText = 'position:fixed;top:16px;left:16px;z-index:9999;'
    + 'background:#fff;color:#37352f;border:1px solid #ebebea;'
    + 'padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;'
    + 'text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.08);'
    + 'font-family:-apple-system,BlinkMacSystemFont,sans-serif;'
    + 'transition:all 120ms ease;';
  btn.onmouseenter = function() {
    btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
    btn.style.transform = 'translateY(-1px)';
  };
  btn.onmouseleave = function() {
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    btn.style.transform = 'none';
  };
  document.body.appendChild(btn);
})();
