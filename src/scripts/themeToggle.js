const STORAGE_KEY = "theme";

export default function initThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  toggle.setAttribute("aria-checked", String(isDark));

  toggle.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

    document.documentElement.setAttribute("data-theme", next);
    toggle.setAttribute("aria-checked", String(next === "dark"));

    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // Storage can throw (e.g. private browsing, full quota) - theme still applies for this page view.
    }
  });
}
