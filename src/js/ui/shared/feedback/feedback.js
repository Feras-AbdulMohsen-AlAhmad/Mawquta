const FEEDBACK_COPY = {
  loading: { label: "جارٍ التحميل", icon: "↻" },
  empty: { label: "لا توجد بيانات", icon: "—" },
  error: { label: "تعذر إكمال العملية", icon: "!" },
};

export function renderFeedbackState({
  type = "loading",
  message,
  ariaLabel,
  retryAttribute,
  className = "",
}) {
  const copy = FEEDBACK_COPY[type] || FEEDBACK_COPY.loading;
  const classes = ["state-block", `state-block--${type}`, className]
    .filter(Boolean)
    .join(" ");
  const role = type === "error" ? "alert" : "status";
  const retry = retryAttribute
    ? `<button type="button" class="state-block__retry btn btn--outline" data-${retryAttribute}>إعادة المحاولة</button>`
    : "";

  return `<div class="${classes}" role="${role}" aria-label="${ariaLabel || copy.label}"><span class="state-block__icon" aria-hidden="true">${copy.icon}</span><span class="state-block__message">${message || copy.label}</span>${retry}</div>`;
}

export function createToastController(documentRef = globalThis.document) {
  if (!documentRef) return Object.freeze({ show: () => {}, dismiss: () => {} });

  const region = documentRef.getElementById("app-toast-region") || (() => {
    const element = documentRef.createElement("div");
    element.id = "app-toast-region";
    element.className = "toast-region";
    element.setAttribute("aria-live", "polite");
    element.setAttribute("aria-atomic", "false");
    documentRef.body.append(element);
    return element;
  })();
  const activeMessages = new Map();

  function dismiss(toast) {
    if (!toast) return;
    const key = toast.dataset.toastKey;
    if (key) activeMessages.delete(key);
    toast.remove();
  }

  function show(type = "info", message, { key = message, duration = 4500 } = {}) {
    const safeMessage = String(message || "").trim();
    if (!safeMessage || activeMessages.has(key)) return () => {};
    const toast = documentRef.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.dataset.toastKey = key;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span class="toast__icon" aria-hidden="true">${type === "success" ? "✓" : type === "error" ? "!" : type === "warning" ? "⚠" : "i"}</span><span class="toast__message"></span><button type="button" class="toast__dismiss" aria-label="إغلاق الرسالة">×</button>`;
    toast.querySelector(".toast__message").textContent = safeMessage;
    toast.querySelector(".toast__dismiss").addEventListener("click", () => dismiss(toast));
    region.append(toast);
    activeMessages.set(key, toast);
    const timeout = duration > 0 ? globalThis.setTimeout(() => dismiss(toast), duration) : null;
    return () => {
      if (timeout) globalThis.clearTimeout(timeout);
      dismiss(toast);
    };
  }

  return Object.freeze({ show, dismiss });
}
