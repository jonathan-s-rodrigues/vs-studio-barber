/**
 * App instalável (PWA): service worker e botão "Instalar app"
 */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.error));
}

let deferredInstallPrompt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

function refreshInstallButtons() {
  const show = !isStandalone() && (deferredInstallPrompt || isIOS);
  document.querySelectorAll(".install-button").forEach((b) => b.classList.toggle("hidden", !show));
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  refreshInstallButtons();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  refreshInstallButtons();
  showToast("App instalado!");
});

document.querySelectorAll(".install-button").forEach((b) =>
  b.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      refreshInstallButtons();
    } else if (isIOS) {
      alert("No iPhone: toque em Compartilhar (quadrado com seta) e depois em “Adicionar à Tela de Início”.");
    }
  })
);

refreshInstallButtons();
