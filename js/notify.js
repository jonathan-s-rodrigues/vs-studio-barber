/**
 * Avisos do dono: novos agendamentos, reservas e cancelamentos + contadores no menu
 */
let seenKeys = null; // null = ainda não carregou (a primeira carga não gera aviso)
const localActions = new Set(); // ações feitas pelo próprio dono nesta sessão

function resetNotifications() {
  seenKeys = null;
}
function markLocalAction(key) {
  localActions.add(key);
}

const agendaSeenKey = () => `vsAgendaSeen_${currentUser?.uid}`;

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function notifyOwner(title, body) {
  showToast(`${title}: ${body}`);
  beep();
  if ("Notification" in window && Notification.permission === "granted") {
    const options = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", vibrate: [200, 100, 200] };
    (navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : Promise.resolve(null))
      .then((reg) => (reg ? reg.showNotification(title, options) : new Notification(title, options)))
      .catch(() => {});
  }
}

function setNavBadge(page, n) {
  const btn = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (!btn) return;
  let badge = btn.querySelector(".nav-badge");
  if (!n) return badge && badge.remove();
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "nav-badge";
    btn.appendChild(badge);
  }
  badge.textContent = n;
}

function updateBadges() {
  if (currentRole !== "owner") return;
  try {
    if (document.querySelector(".page.active")?.id === "agenda") {
      localStorage.setItem(agendaSeenKey(), String(Date.now()));
    }
    if (localStorage.getItem(agendaSeenKey()) === null) {
      localStorage.setItem(agendaSeenKey(), String(Date.now()));
    }
  } catch {}
  let last = 0;
  try {
    last = Number(localStorage.getItem(agendaSeenKey())) || 0;
  } catch {}
  const newAppts = appData.appointments.filter(
    (a) => a.status === "scheduled" && a.createdAt > last && a.createdByUid !== currentUser.uid
  ).length;
  const pendingRes = appData.reservations.filter((r) => r.status === "reserved").length;
  setNavBadge("agenda", newAppts);
  setNavBadge("reservas", pendingRes);
  if (navigator.setAppBadge) {
    const total = newAppts + pendingRes;
    (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
  }
}

function refreshNotifyButton() {
  const btn = document.getElementById("enableNotifications");
  if (!btn) return;
  const can = currentRole === "owner" && "Notification" in window && Notification.permission === "default";
  btn.classList.toggle("hidden", !can);
}

/** Chamada a cada atualização dos dados (via renderAll) */
function checkNewActivity() {
  if (currentRole !== "owner" || !remote.appointments || !remote.reservations) return;
  const keys = new Set();
  appData.appointments.forEach((a) => keys.add((a.status === "cancelled" ? "x" : "a") + a.id));
  appData.reservations.forEach((r) => keys.add("r" + r.id));

  if (seenKeys === null) {
    seenKeys = keys;
    refreshNotifyButton();
    updateBadges();
    return;
  }

  const who = (id) => findById(appData.clients, id)?.name || "Cliente";
  appData.appointments.forEach((a) => {
    const info = `${who(a.clientId)} — ${findById(appData.services, a.serviceId)?.name || ""}, ${formatBR(a.date)} às ${a.time}`;
    if (a.status === "scheduled" && !seenKeys.has("a" + a.id) && a.createdByUid !== currentUser.uid) {
      notifyOwner("Novo agendamento", info);
    }
    const cancelKey = "x" + a.id;
    if (a.status === "cancelled" && !seenKeys.has(cancelKey) && !localActions.has(cancelKey)) {
      notifyOwner("Agendamento cancelado", info);
    }
  });
  appData.reservations.forEach((r) => {
    if (r.status === "reserved" && !seenKeys.has("r" + r.id)) {
      const p = findById(appData.products, r.productId);
      notifyOwner("Nova reserva", `${who(r.clientId)} — ${p?.name || "Produto"} × ${r.qty}`);
    }
  });

  seenKeys = keys;
  updateBadges();
}

document.querySelector('.nav-item[data-page="agenda"]')?.addEventListener("click", () => {
  try {
    localStorage.setItem(agendaSeenKey(), String(Date.now()));
  } catch {}
  updateBadges();
});

document.getElementById("enableNotifications")?.addEventListener("click", async () => {
  const result = await Notification.requestPermission();
  refreshNotifyButton();
  showToast(result === "granted" ? "Avisos ativados." : "Avisos não permitidos pelo navegador.", result !== "granted");
});
