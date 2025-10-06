// components/ThemeScript.tsx
"use client";

export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  try {
    var saved = localStorage.getItem('theme') || 'system';
    var dark = saved === 'dark' ||
      (saved === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch(e) {}
})();`,
      }}
    />
  );
}
