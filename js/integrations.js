/**
 * Integrações: calendário do celular (.ics / Google Agenda), WhatsApp e área do cliente
 */
function apptInfo(appt) {
  const client = findById(appData.clients, appt.clientId);
  const service = findById(appData.services, appt.serviceId);
  const barber = findById(appData.barbers, appt.barberId);
  const start = new Date(`${appt.date}T${appt.time}:00`);
  const end = new Date(start.getTime() + (Number(service?.durationMinutes) || 30) * 60000);
  return { client, service, barber, start, end };
}

const pad2 = (n) => String(n).padStart(2, "0");
const icsLocal = (d) =>
  `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
const icsUTC = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEscape = (s = "") => String(s).replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function eventTexts(appt) {
  const { service, barber, start } = apptInfo(appt);
  const title = `${service?.name || "Atendimento"} — ${SHOP.name}`;
  const details = `Barbeiro: ${barber?.name || "—"}\nServiço: ${service?.name || "—"}\nHorário: ${appt.time}`;
  return { title, details, start };
}

/** Arquivo .ics: abre direto no calendário do iPhone/Android, com 2 lembretes (1 dia e 1 hora antes) */
function buildICS(appt) {
  const { end } = apptInfo(appt);
  const { title, details, start } = eventTexts(appt);
  const alarm = (trigger, text) =>
    ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(text)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VS Studio//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:appt-${appt.id}@vsstudio`,
    `DTSTAMP:${icsUTC(new Date())}`,
    `DTSTART:${icsLocal(start)}`,
    `DTEND:${icsLocal(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    `LOCATION:${icsEscape(SHOP.address)}`,
    ...alarm("-P1D", "Amanhã você tem horário na barbearia"),
    ...alarm("-PT1H", "Seu horário na barbearia é em 1 hora"),
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function downloadICS(appt) {
  const blob = new Blob([buildICS(appt)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `agendamento-${appt.date}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function googleCalendarUrl(appt) {
  const { end } = apptInfo(appt);
  const { title, details, start } = eventTexts(appt);
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${icsLocal(start)}/${icsLocal(end)}`,
    details,
    location: SHOP.address,
    ctz: SHOP.timezone
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/* --- WhatsApp --- */
function normalizePhone(phone = "") {
  const d = String(phone).replace(/\D/g, "");
  return d.length <= 11 ? "55" + d : d;
}

function whatsappUrl(phone, message) {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`;
}

function formatBR(date) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** Mensagem de confirmação: para a barbearia (cliente agendando) ou para o cliente (dono agendando) */
function confirmationMessage(appt, toShop) {
  const { client, service, barber } = apptInfo(appt);
  const quando = `${formatBR(appt.date)} às ${appt.time}`;
  if (toShop) {
    return `Olá, ${SHOP.name}! Confirmei meu agendamento:\n✂ ${service?.name}\n💈 Barbeiro: ${barber?.name}\n📅 ${quando}\nNome: ${client?.name || ""}`;
  }
  return `Olá, ${client?.name || ""}! Seu horário na ${SHOP.name} está confirmado:\n✂ ${service?.name}\n💈 Barbeiro: ${barber?.name}\n📅 ${quando}\n📍 ${SHOP.address}\nTe esperamos!`;
}

function whatsappTargetUrl(appt) {
  const toShop = currentRole === "client";
  const phone = toShop ? SHOP.whatsapp : apptInfo(appt).client?.phone;
  return whatsappUrl(phone, confirmationMessage(appt, toShop));
}

/** Tela de confirmação após agendar (links de calendário e WhatsApp) */
function showBookingConfirmation(appt, waWin) {
  const { service, barber } = apptInfo(appt);
  const url = whatsappTargetUrl(appt);
  $("confirmSummary").textContent = `${service?.name} com ${barber?.name} — ${formatBR(appt.date)} às ${appt.time}`;
  $("confirmWhats").href = url;
  $("confirmGoogle").href = googleCalendarUrl(appt);
  $("confirmIcs").onclick = () => downloadICS(appt);
  if (waWin) waWin.location.href = url; // vai direto para o WhatsApp
  openModal("confirmModal");
}

/* --- Ações usadas nas listas --- */
window.exportAppointment = (id) => {
  const a = findById(appData.appointments, id);
  if (a) downloadICS(a);
};
window.whatsappAppointment = (id) => {
  const a = findById(appData.appointments, id);
  if (a) window.open(whatsappTargetUrl(a), "_blank");
};
window.googleAppointment = (id) => {
  const a = findById(appData.appointments, id);
  if (a) window.open(googleCalendarUrl(a), "_blank");
};

/* --- Área do cliente --- */
function renderClientArea() {
  if (currentRole !== "client") return;
  const me = appData.clients[0];
  $("clientGreeting").textContent = `Olá, ${(me?.name || currentUser?.displayName || "").split(" ")[0]}!`;
  const today = todayISO();
  const mine = appData.appointments.filter((a) => a.status !== "cancelled");
  const upcoming = mine.filter((a) => a.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const past = mine.filter((a) => a.date < today).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const row = (a, isUpcoming) => {
    const { service, barber } = apptInfo(a);
    return `<article class="booking">
      <time>${escapeHTML(a.time)}</time><i class="color-bar"></i>
      <div><strong>${escapeHTML(service?.name || "—")}</strong>
        <small>${formatBR(a.date)} · ${escapeHTML(barber?.name || "—")}</small></div>
      <div class="booking-actions">
        ${isUpcoming ? `<button type="button" class="icon-button" onclick="exportAppointment(${a.id})" title="Adicionar ao calendário do celular">📅</button>
        <button type="button" class="icon-button" onclick="googleAppointment(${a.id})" title="Google Agenda">G</button>
        <button type="button" class="icon-button" onclick="whatsappAppointment(${a.id})" title="WhatsApp da barbearia">💬</button>
        <button type="button" class="icon-button danger" onclick="cancelAppointment(${a.id})" title="Cancelar">✕</button>` : ""}
      </div></article>`;
  };

  $("clientUpcoming").innerHTML = upcoming.length
    ? upcoming.map((a) => row(a, true)).join("")
    : '<div class="empty">Você não tem horários marcados.</div>';
  $("clientPast").innerHTML = past.length
    ? past.map((a) => row(a, false)).join("")
    : '<div class="empty">Sem histórico ainda.</div>';
  renderClientShop();
}

/* --- Vitrine de produtos, reservas e equipe (cliente) --- */
function renderClientShop() {
  const saved = {};
  document.querySelectorAll(".res-qty").forEach((el) => (saved[el.id] = el.value));

  $("clientProducts").innerHTML = appData.products.length
    ? appData.products
        .map((p) => {
          const out = !(Number(p.stock) > 0);
          return `<article class="shop-card">
            <div class="shop-photo">${avatarHTML(p.photo, initials(p.name))}</div>
            <div class="shop-body">
              <strong>${escapeHTML(p.name)}</strong>
              <small>${escapeHTML(p.brand || "")}</small>
              <span class="shop-price">${money(p.price)}</span>
              ${
                out
                  ? '<span class="stock low">Esgotado</span>'
                  : `<div class="reserve-row">
                      <input type="number" class="res-qty" id="resQty${p.id}" min="1" max="${p.stock}" value="1" aria-label="Quantidade">
                      <button type="button" class="primary-button" onclick="reserveProduct(${p.id})">Reservar</button>
                    </div>`
              }
            </div>
          </article>`;
        })
        .join("")
    : '<div class="empty">Nenhum produto disponível.</div>';
  Object.entries(saved).forEach(([id, v]) => {
    if ($(id)) $(id).value = v;
  });

  const label = { reserved: "Reservado", delivered: "Retirado", cancelled: "Cancelado" };
  const mine = [...appData.reservations]
    .filter((r) => r.status !== "cancelled")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("clientReservations").innerHTML = mine.length
    ? mine
        .map((r) => {
          const p = findById(appData.products, r.productId);
          return `<article class="booking">
            <i class="color-bar"></i>
            <div><strong>${escapeHTML(p?.name || "Produto")} × ${r.qty}</strong>
              <small>${label[r.status] || r.status} · ${money((p?.price || 0) * r.qty)}</small></div>
            <div class="booking-actions">${
              r.status === "reserved"
                ? `<button type="button" class="icon-button danger" onclick="cancelReservation(${r.id})" title="Cancelar reserva">✕</button>`
                : ""
            }</div>
          </article>`;
        })
        .join("")
    : '<div class="empty">Você não tem reservas.</div>';

  $("clientTeam").innerHTML = appData.barbers.length
    ? appData.barbers
        .map(
          (b) => `<div class="team-card"><div class="team-photo">${avatarHTML(b.photo, initials(b.name))}</div>
            <strong>${escapeHTML(b.name)}</strong></div>`
        )
        .join("")
    : '<div class="empty">Equipe não cadastrada.</div>';
}

window.reserveProduct = async (id) => {
  const p = findById(appData.products, id);
  const me = appData.clients[0];
  if (!p || !me) return;
  const qty = Number($("resQty" + id).value);
  if (!Number.isInteger(qty) || qty < 1 || qty > Number(p.stock)) {
    showToast("Quantidade indisponível em estoque.", true);
    return;
  }
  const rid = nextId();
  try {
    await db.collection("reservations").doc(String(rid)).set({
      id: rid,
      clientId: me.id,
      clientUid: currentUser.uid,
      productId: p.id,
      qty,
      status: "reserved",
      createdAt: Date.now()
    });
    showToast("Produto reservado! É só retirar na barbearia.");
  } catch (err) {
    console.error(err);
    showToast("Não foi possível reservar.", true);
  }
};

window.cancelReservation = async (id) => {
  if (!confirm("Cancelar esta reserva?")) return;
  try {
    await db.collection("reservations").doc(String(id)).update({ status: "cancelled" });
    showToast("Reserva cancelada.");
  } catch (err) {
    console.error(err);
    showToast("Não foi possível cancelar.", true);
  }
};
