// Apply before first paint; keep working when storage is unavailable.
(() => {
  let theme;
  try { theme = localStorage.getItem("theme"); } catch { /* Private mode. */ }
  const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
})();
