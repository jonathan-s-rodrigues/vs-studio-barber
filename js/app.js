/**
 * VS Studio — interface, formulários e renderização
 */
const $ = (id) => document.getElementById(id);

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function escapeHTML(text = "") {
  return String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])
  );
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function showToast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show", "error"), 2800);
}

function clearFieldErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  form.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
}

function setFieldError(form, fieldKey, message) {
  const err = form.querySelector(`.field-error[data-for="${fieldKey}"]`);
  if (err) err.textContent = message;
  const input = form.querySelector(`#${fieldKey}`);
  if (input) input.classList.add("input-error");
}

/* --- Estado da agenda --- */
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let selectedAgendaDate = todayISO();

/* --- Navegação --- */
document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item, .page").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.page).classList.add("active");
    closeMenu();
    if (btn.dataset.page === "dashboard") renderDashboard();
    if (btn.dataset.page === "relatorios") renderReports();
  });
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab, .tab-content").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  });
});

function openModal(id) {
  $(id).classList.add("open");
}
function closeModal(id) {
  $(id).classList.remove("open");
}

document.querySelectorAll("[data-close]").forEach((b) =>
  b.addEventListener("click", () => closeModal(b.dataset.close))
);
document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) closeModal(m.id);
  })
);

function openMenu() {
  $("sidebar").classList.add("open");
  $("overlay").classList.add("open");
}
function closeMenu() {
  $("sidebar").classList.remove("open");
  $("overlay").classList.remove("open");
}

$("menuButton").onclick = openMenu;
$("closeMenu").onclick = closeMenu;
$("overlay").onclick = closeMenu;

/* --- Selects auxiliares --- */
function fillClientSelect(selectEl, includeEmpty = false) {
  let html = includeEmpty ? '<option value="">— Selecione —</option>' : "";
  html += appData.clients
    .map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`)
    .join("");
  selectEl.innerHTML = html;
}

function fillBarberSelect(selectEl, includeEmpty = false, emptyLabel = "— Selecione —") {
  let html = includeEmpty ? `<option value="">${emptyLabel}</option>` : "";
  html += appData.barbers
    .map((b) => `<option value="${b.id}">${escapeHTML(b.name)}</option>`)
    .join("");
  selectEl.innerHTML = html;
}

function fillServiceSelect(selectEl) {
  selectEl.innerHTML =
    '<option value="">— Selecione —</option>' +
    appData.services
      .map((s) => `<option value="${s.id}">${escapeHTML(s.name)} (${s.durationMinutes} min)</option>`)
      .join("");
}

/* --- Calendário --- */
function renderCalendar() {
  const grid = $("calendarGrid");
  const title = $("calTitle");
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  title.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const first = new Date(calendarYear, calendarMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const daysPrev = new Date(calendarYear, calendarMonth, 0).getDate();
  const eventDates = datesWithAppointments(calendarYear, calendarMonth);

  let html = "";
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysPrev - i;
    html += `<button type="button" class="cal-day other" disabled>${d}</button>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const classes = ["cal-day"];
    if (iso === todayISO()) classes.push("today");
    if (iso === selectedAgendaDate) classes.push("selected");
    if (eventDates.has(iso)) classes.push("has-events");
    html += `<button type="button" class="${classes.join(" ")}" data-date="${iso}">${d}</button>`;
  }
  const totalCells = startDay + daysInMonth;
  const remainder = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remainder; i++) {
    html += `<button type="button" class="cal-day other" disabled>${i}</button>`;
  }
  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedAgendaDate = btn.dataset.date;
      renderCalendar();
      renderBookings($("bookingSearch").value);
    });
  });
}

$("calPrev").onclick = () => {
  calendarMonth -= 1;
  if (calendarMonth < 0) {
    calendarMonth = 11;
    calendarYear -= 1;
  }
  renderCalendar();
};

$("calNext").onclick = () => {
  calendarMonth += 1;
  if (calendarMonth > 11) {
    calendarMonth = 0;
    calendarYear += 1;
  }
  renderCalendar();
};

/* --- Horários no modal de agendamento --- */
function renderTimeSlots() {
  const container = $("timeSlots");
  const barberId = $("bookingBarber").value;
  const serviceId = $("bookingService").value;
  const date = $("bookingDate").value;
  $("bookingTime").value = "";

  if (!barberId || !serviceId || !date) {
    container.innerHTML = '<p class="empty-hint time-slots">Selecione barbeiro, serviço e data.</p>';
    return;
  }

  const slots = getAvailableTimeSlots(barberId, serviceId, date);
  if (!slots.length) {
    container.innerHTML = '<p class="empty-hint time-slots">Nenhum horário disponível nesta data.</p>';
    return;
  }

  container.innerHTML = slots
    .map((t) => `<button type="button" class="time-slot" data-time="${t}">${t}</button>`)
    .join("");

  container.querySelectorAll(".time-slot").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".time-slot").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      $("bookingTime").value = btn.dataset.time;
    });
  });
}

["bookingBarber", "bookingService", "bookingDate"].forEach((id) => {
  $(id).addEventListener("change", renderTimeSlots);
});

/* --- Agendamentos --- */
function renderBookings(filter = "") {
  const q = filter.toLowerCase();
  const items = appData.appointments
    .filter((a) => a.date === selectedAgendaDate && a.status !== "cancelled")
    .filter((a) => {
      const client = findById(appData.clients, a.clientId);
      const service = findById(appData.services, a.serviceId);
      const text = `${client?.name || ""} ${service?.name || ""}`.toLowerCase();
      return text.includes(q);
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const dateFmt = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date(selectedAgendaDate + "T12:00:00"));

  $("agendaSelectedDate").textContent = dateFmt.charAt(0).toUpperCase() + dateFmt.slice(1);

  if (!items.length) {
    $("bookingList").innerHTML = '<div class="empty">Nenhum agendamento neste dia.</div>';
    return;
  }

  $("bookingList").innerHTML = items
    .map((a) => {
      const client = findById(appData.clients, a.clientId);
      const service = findById(appData.services, a.serviceId);
      const barber = findById(appData.barbers, a.barberId);
      const status = a.status || "scheduled";
      return `<article class="booking">
        <time>${escapeHTML(a.time)}</time>
        <i class="color-bar"></i>
        <div>
          <strong>${escapeHTML(client?.name || "Cliente")}</strong>
          <small>${escapeHTML(service?.name || "—")} · ${service?.durationMinutes || 0} min</small>
        </div>
        <span class="status-badge ${status}">${status === "completed" ? "Concluído" : "Agendado"}</span>
        <span class="barber-label">${escapeHTML(barber?.name || "—")}</span>
        <div class="booking-actions">
          <button type="button" class="icon-button" onclick="exportAppointment(${a.id})" title="Adicionar ao calendário do celular">📅</button>
          <button type="button" class="icon-button" onclick="whatsappAppointment(${a.id})" title="Enviar confirmação no WhatsApp">💬</button>
          ${
            status === "scheduled"
              ? `<button type="button" class="icon-button" onclick="completeAppointment(${a.id})" title="Concluir">✓</button>
                 <button type="button" class="icon-button danger" onclick="cancelAppointment(${a.id})" title="Cancelar">✕</button>`
              : ""
          }
        </div>
      </article>`;
    })
    .join("");
}

window.cancelAppointment = async (id) => {
  if (!confirm("Cancelar este agendamento? O horário será liberado.")) return;
  const appt = findById(appData.appointments, id);
  if (!appt) return;
  if (currentRole === "owner") markLocalAction("x" + appt.id);
  try {
    await cancelAppointmentRemote(appt);
    showToast("Agendamento cancelado. Horário liberado.");
  } catch (err) {
    console.error(err);
    showToast("Não foi possível cancelar.", true);
  }
};

window.completeAppointment = (id) => {
  const appt = findById(appData.appointments, id);
  if (!appt) return;
  appt.status = "completed";
  saveData();
  showToast("Atendimento marcado como concluído.");
};

$("openBooking").onclick = () => {
  fillClientSelect($("bookingClient"));
  $("bookingClientLabel").classList.toggle("hidden", currentRole === "client");
  fillBarberSelect($("bookingBarber"));
  fillServiceSelect($("bookingService"));
  $("bookingDate").value = selectedAgendaDate;
  $("bookingForm").reset();
  $("bookingDate").value = selectedAgendaDate;
  clearFieldErrors($("bookingForm"));
  renderTimeSlots();
  openModal("bookingModal");
};

$("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);

  const clientId = $("bookingClient").value;
  const barberId = $("bookingBarber").value;
  const serviceId = $("bookingService").value;
  const date = $("bookingDate").value;
  const time = $("bookingTime").value;
  let valid = true;

  if (!clientId) {
    setFieldError(form, "bookingClient", "Selecione um cliente.");
    valid = false;
  }
  if (!barberId) {
    setFieldError(form, "bookingBarber", "Selecione um barbeiro.");
    valid = false;
  }
  if (!serviceId) {
    setFieldError(form, "bookingService", "Selecione um serviço.");
    valid = false;
  }
  if (!date) {
    setFieldError(form, "bookingDate", "Informe a data.");
    valid = false;
  }
  if (!time) {
    setFieldError(form, "bookingTime", "Escolha um horário disponível.");
    valid = false;
  }

  if (!valid) {
    showToast("Corrija os campos destacados.", true);
    return;
  }

  const duration = getServiceDurationMinutes(serviceId);
  if (hasConflict(barberId, date, time, duration)) {
    setFieldError(form, "bookingTime", "Horário indisponível. Escolha outro.");
    showToast("Conflito de horário com outro agendamento.", true);
    renderTimeSlots();
    return;
  }

  const client = findById(appData.clients, clientId);
  const appt = {
    id: nextId(),
    clientId: Number(clientId),
    clientUid: client?.uid || null,
    barberId: Number(barberId),
    serviceId: Number(serviceId),
    date,
    time,
    status: "scheduled",
    createdAt: Date.now(),
    createdByUid: currentUser.uid
  };

  // abre a aba agora (gesto do clique) para ir direto ao WhatsApp após confirmar
  const waWin = window.open("", "_blank");
  try {
    await bookAppointment(appt);
  } catch (err) {
    if (waWin) waWin.close();
    const conflict = err.message === "CONFLICT";
    if (!conflict) console.error(err);
    setFieldError(form, "bookingTime", conflict ? "Esse horário acabou de ser ocupado." : "Erro ao agendar.");
    showToast(conflict ? "Horário indisponível. Escolha outro." : "Erro ao agendar. Tente novamente.", true);
    renderTimeSlots();
    return;
  }

  closeModal("bookingModal");
  showToast("Agendamento confirmado com sucesso.");
  showBookingConfirmation(appt, waWin);
});

$("bookingSearch").addEventListener("input", (e) => renderBookings(e.target.value));

/* --- Barbeiros CRUD --- */
function renderBarbers() {
  if (!appData.barbers.length) {
    $("barberList").innerHTML = '<div class="empty panel">Nenhum barbeiro cadastrado.</div>';
    return;
  }
  $("barberList").innerHTML = appData.barbers
    .map(
      (b) => `<article class="barber-card">
        <div class="initials">${avatarHTML(b.photo, initials(b.name))}</div>
        <h3>${escapeHTML(b.name)}</h3>
        <p>${escapeHTML(b.phone)}</p>
        <div class="card-actions">
          <button type="button" class="secondary-button" onclick="editBarber(${b.id})">Editar</button>
          <button type="button" class="icon-button danger" onclick="deleteBarber(${b.id})">Excluir</button>
        </div>
      </article>`
    )
    .join("");
}

$("openBarber").onclick = () => {
  $("barberModalTitle").textContent = "Novo barbeiro";
  $("barberForm").reset();
  $("barberId").value = "";
  barberPhotoData = undefined;
  showPhotoPreview("barberPhotoPreview", "");
  clearFieldErrors($("barberForm"));
  openModal("barberModal");
};

window.editBarber = (id) => {
  const b = findById(appData.barbers, id);
  if (!b) return;
  $("barberModalTitle").textContent = "Editar barbeiro";
  $("barberId").value = b.id;
  $("barberName").value = b.name;
  $("barberPhone").value = b.phone;
  barberPhotoData = undefined;
  showPhotoPreview("barberPhotoPreview", b.photo || "");
  clearFieldErrors($("barberForm"));
  openModal("barberModal");
};

window.deleteBarber = (id) => {
  const hasFuture = appData.appointments.some(
    (a) => String(a.barberId) === String(id) && a.status === "scheduled"
  );
  if (hasFuture && !confirm("Este barbeiro possui agendamentos. Excluir mesmo assim?")) return;
  if (!hasFuture && !confirm("Excluir este barbeiro?")) return;
  appData.barbers = appData.barbers.filter((b) => String(b.id) !== String(id));
  saveData();
  showToast("Barbeiro excluído.");
};

$("barberForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const name = $("barberName").value.trim();
  const phone = $("barberPhone").value.trim();
  if (name.length < 2) {
    setFieldError(form, "barberName", "Nome deve ter ao menos 2 caracteres.");
    showToast("Verifique o formulário.", true);
    return;
  }
  if (phone.length < 8) {
    setFieldError(form, "barberPhone", "Telefone inválido.");
    showToast("Verifique o formulário.", true);
    return;
  }
  const id = $("barberId").value;
  if (id) {
    const b = findById(appData.barbers, id);
    if (b) {
      b.name = name;
      b.phone = phone;
      if (barberPhotoData !== undefined) b.photo = barberPhotoData;
    }
    showToast("Barbeiro atualizado.");
  } else {
    appData.barbers.push({ id: nextId(appData.barbers), name, phone, photo: barberPhotoData || "" });
    showToast("Barbeiro cadastrado.");
  }
  saveData();
  closeModal("barberModal");
});

/* --- Serviços e produtos CRUD --- */
function formatDuration(min) {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  }
  return `${min} min`;
}

function renderServices() {
  $("serviceList").innerHTML = appData.services.length
    ? appData.services
        .map(
          (s, i) => `<article class="service-card">
            <div class="service-icon">${["✂", "◒", "✦", "⌁"][i % 4]}</div>
            <div class="service-copy">
              <h3>${escapeHTML(s.name)}</h3>
              <p>${escapeHTML(s.description)}</p>
              <footer>
                <span>◷ ${formatDuration(s.durationMinutes)}</span>
                <strong>${money(s.price)}</strong>
              </footer>
            </div>
            <div class="card-actions">
              <button type="button" class="icon-button" onclick="editItem('service',${s.id})" title="Editar">✎</button>
              <button type="button" class="icon-button danger" onclick="deleteService(${s.id})">×</button>
            </div>
          </article>`
        )
        .join("")
    : '<div class="empty">Nenhum serviço cadastrado.</div>';
}

function renderProducts() {
  $("productList").innerHTML = appData.products.length
    ? appData.products
        .map(
          (p) => `<article class="product-row">
            <div class="product-info">
              <span class="product-icon">${avatarHTML(p.photo, initials(p.name))}</span>
              <div><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.brand || "")}</small></div>
            </div>
            <div><span class="stock ${p.stock <= LOW_STOCK_THRESHOLD ? "low" : ""}">${
            p.stock <= LOW_STOCK_THRESHOLD ? "Estoque baixo" : p.stock + " un."
          }</span></div>
            <strong>${money(p.price)}</strong>
            <div>
              <button type="button" class="icon-button" onclick="editItem('product',${p.id})">✎</button>
              <button type="button" class="icon-button danger" onclick="deleteProduct(${p.id})">×</button>
            </div>
          </article>`
        )
        .join("")
    : '<div class="empty">Nenhum produto cadastrado.</div>';
}

function toggleItemTypeFields() {
  const isProduct = $("itemType").value === "product";
  $("stockField").classList.toggle("hidden", !isProduct);
  $("durationField").classList.toggle("hidden", isProduct);
  $("photoField").classList.toggle("hidden", !isProduct);
  $("itemDescLabelText").textContent = isProduct ? "Marca" : "Descrição";
  $("itemType").disabled = !!$("itemId").value;
}

$("itemType").addEventListener("change", toggleItemTypeFields);

$("openItem").onclick = () => {
  $("itemModalTitle").textContent = "Adicionar item";
  $("itemForm").reset();
  $("itemId").value = "";
  $("itemType").disabled = false;
  itemPhotoData = undefined;
  showPhotoPreview("itemPhotoPreview", "");
  toggleItemTypeFields();
  clearFieldErrors($("itemForm"));
  openModal("itemModal");
};

window.editItem = (type, id) => {
  const list = type === "service" ? appData.services : appData.products;
  const item = findById(list, id);
  if (!item) return;
  $("itemModalTitle").textContent = type === "service" ? "Editar serviço" : "Editar produto";
  $("itemId").value = item.id;
  $("itemType").value = type;
  $("itemName").value = item.name;
  $("itemPrice").value = item.price;
  if (type === "service") {
    $("itemDescription").value = item.description;
    $("itemDuration").value = item.durationMinutes;
  } else {
    $("itemDescription").value = item.brand || "";
    $("itemStock").value = item.stock;
  }
  itemPhotoData = undefined;
  showPhotoPreview("itemPhotoPreview", type === "product" ? item.photo || "" : "");
  toggleItemTypeFields();
  clearFieldErrors($("itemForm"));
  openModal("itemModal");
};

window.deleteService = (id) => {
  if (!confirm("Excluir este serviço?")) return;
  appData.services = appData.services.filter((s) => String(s.id) !== String(id));
  saveData();
  showToast("Serviço excluído.");
};

window.deleteProduct = (id) => {
  if (!confirm("Excluir este produto?")) return;
  appData.products = appData.products.filter((p) => String(p.id) !== String(id));
  saveData();
  showToast("Produto excluído.");
};

$("itemForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const type = $("itemType").value;
  const name = $("itemName").value.trim();
  const price = Number($("itemPrice").value);
  const editId = $("itemId").value;

  if (name.length < 2) {
    setFieldError(form, "itemName", "Nome inválido.");
    showToast("Verifique o formulário.", true);
    return;
  }
  if (!(price > 0)) {
    setFieldError(form, "itemPrice", "Preço deve ser maior que zero.");
    showToast("Verifique o formulário.", true);
    return;
  }

  if (type === "service") {
    const durationMinutes = Number($("itemDuration").value);
    if (!(durationMinutes >= 5)) {
      setFieldError(form, "itemDuration", "Duração mínima: 5 minutos.");
      showToast("Verifique o formulário.", true);
      return;
    }
    const payload = {
      name,
      description: $("itemDescription").value.trim(),
      price,
      durationMinutes
    };
    if (editId) {
      Object.assign(findById(appData.services, editId), payload);
      showToast("Serviço atualizado.");
    } else {
      appData.services.push({ id: nextId(appData.services), ...payload });
      showToast("Serviço cadastrado.");
    }
  } else {
    const stock = Number($("itemStock").value);
    if (stock < 0 || Number.isNaN(stock)) {
      setFieldError(form, "itemStock", "Estoque inválido.");
      showToast("Verifique o formulário.", true);
      return;
    }
    const payload = { name, brand: $("itemDescription").value.trim(), price, stock };
    if (itemPhotoData !== undefined) payload.photo = itemPhotoData;
    else if (!editId) payload.photo = "";
    if (editId) {
      Object.assign(findById(appData.products, editId), payload);
      showToast("Produto atualizado.");
    } else {
      appData.products.push({ id: nextId(appData.products), ...payload });
      showToast("Produto cadastrado.");
    }
  }
  saveData();
  closeModal("itemModal");
});

/* --- Clientes CRUD --- */
function renderClients(filter = "") {
  const q = filter.toLowerCase();
  const items = appData.clients.filter((c) =>
    (c.name + " " + c.phone + " " + (c.email || "")).toLowerCase().includes(q)
  );
  $("clientList").innerHTML = items.length
    ? items
        .map(
          (c) => `<article class="client-row">
            <span class="client-avatar">${initials(c.name)}</span>
            <div><strong>${escapeHTML(c.name)}</strong><small>${escapeHTML(c.email || "Sem e-mail")}</small></div>
            <span>${escapeHTML(c.phone)}</span>
            <div>
              <button type="button" class="icon-button" onclick="editClient(${c.id})">✎</button>
              <button type="button" class="icon-button danger" onclick="deleteClient(${c.id})">×</button>
            </div>
          </article>`
        )
        .join("")
    : '<div class="empty">Nenhum cliente encontrado.</div>';
}

$("openClient").onclick = () => {
  $("clientModalTitle").textContent = "Novo cliente";
  $("clientForm").reset();
  $("clientId").value = "";
  clearFieldErrors($("clientForm"));
  openModal("clientModal");
};

window.editClient = (id) => {
  const c = findById(appData.clients, id);
  if (!c) return;
  $("clientModalTitle").textContent = "Editar cliente";
  $("clientId").value = c.id;
  $("clientName").value = c.name;
  $("clientPhone").value = c.phone;
  $("clientEmail").value = c.email || "";
  clearFieldErrors($("clientForm"));
  openModal("clientModal");
};

window.deleteClient = (id) => {
  if (!confirm("Excluir este cliente?")) return;
  appData.clients = appData.clients.filter((c) => String(c.id) !== String(id));
  saveData();
  showToast("Cliente excluído.");
};

$("clientForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const name = $("clientName").value.trim();
  const phone = $("clientPhone").value.trim();
  const email = $("clientEmail").value.trim();
  if (name.length < 2) {
    setFieldError(form, "clientName", "Nome inválido.");
    showToast("Verifique o formulário.", true);
    return;
  }
  if (phone.length < 8) {
    setFieldError(form, "clientPhone", "Telefone inválido.");
    showToast("Verifique o formulário.", true);
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError(form, "clientEmail", "E-mail inválido.");
    showToast("Verifique o formulário.", true);
    return;
  }
  const id = $("clientId").value;
  if (id) {
    Object.assign(findById(appData.clients, id), { name, phone, email });
    showToast("Cliente atualizado.");
  } else {
    appData.clients.push({ id: nextId(appData.clients), name, phone, email });
    showToast("Cliente cadastrado.");
  }
  saveData();
  closeModal("clientModal");
});

$("clientSearch").addEventListener("input", (e) => renderClients(e.target.value));

/* --- Vendas --- */
function saleLineOptions() {
  const opts = ['<option value="">— Tipo —</option>'];
  appData.products.forEach((p) =>
    opts.push(`<option value="product:${p.id}">Produto: ${escapeHTML(p.name)} (${money(p.price)})</option>`)
  );
  appData.services.forEach((s) =>
    opts.push(`<option value="service:${s.id}">Serviço: ${escapeHTML(s.name)} (${money(s.price)})</option>`)
  );
  return opts.join("");
}

function addSaleLineRow() {
  const row = document.createElement("div");
  row.className = "sale-line";
  row.innerHTML = `
    <select class="sale-item-select" required>${saleLineOptions()}</select>
    <input type="number" class="sale-qty" min="1" value="1" required title="Quantidade">
    <span class="line-subtotal">${money(0)}</span>
    <button type="button" class="icon-button danger remove-line" title="Remover">×</button>`;
  $("saleLines").appendChild(row);
  row.querySelector(".sale-item-select").addEventListener("change", updateSalePreview);
  row.querySelector(".sale-qty").addEventListener("input", updateSalePreview);
  row.querySelector(".remove-line").onclick = () => {
    row.remove();
    updateSalePreview();
  };
  updateSalePreview();
}

function getLineUnitPrice(selectValue) {
  if (!selectValue) return 0;
  const [type, id] = selectValue.split(":");
  const item = findById(type === "product" ? appData.products : appData.services, id);
  return item ? Number(item.price) : 0;
}

function updateSalePreview() {
  let total = 0;
  $("saleLines").querySelectorAll(".sale-line").forEach((row) => {
    const sel = row.querySelector(".sale-item-select").value;
    const qty = Number(row.querySelector(".sale-qty").value) || 0;
    const sub = getLineUnitPrice(sel) * qty;
    row.querySelector(".line-subtotal").textContent = money(sub);
    total += sub;
  });
  $("saleTotalPreview").textContent = money(total);
}

$("openSale").onclick = () => {
  fillClientSelect($("saleClient"), true);
  $("saleClient").querySelector('option[value=""]').textContent = "— Sem cliente —";
  fillBarberSelect($("saleBarber"), true, "— Não informado —");
  $("saleForm").reset();
  $("saleDate").value = todayISO();
  $("saleLines").innerHTML = "";
  addSaleLineRow();
  clearFieldErrors($("saleForm"));
  openModal("saleModal");
};

$("addSaleLine").onclick = addSaleLineRow;

function renderSales() {
  const sales = [...appData.sales].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  $("saleList").innerHTML = sales.length
    ? sales
        .map((sale) => {
          const client = sale.clientId ? findById(appData.clients, sale.clientId) : null;
          const barber = sale.barberId ? findById(appData.barbers, sale.barberId) : null;
          const itemsHtml = sale.items
            .map((it) => {
              const name =
                it.type === "product"
                  ? findById(appData.products, it.refId)?.name
                  : findById(appData.services, it.refId)?.name;
              return `<li>${escapeHTML(name || "Item")} × ${it.qty} — ${money(it.unitPrice * it.qty)}</li>`;
            })
            .join("");
          return `<article class="sale-row">
            <span class="date">${escapeHTML(sale.date)}</span>
            <div>
              <strong>${money(sale.total)}</strong>
              <small>${escapeHTML(client?.name || "Venda avulsa")}${barber ? " · " + escapeHTML(barber.name) : ""}</small>
              <ul>${itemsHtml}</ul>
            </div>
          </article>`;
        })
        .join("")
    : '<div class="empty">Nenhuma venda registrada.</div>';
}

$("saleForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  clearFieldErrors(form);
  const date = $("saleDate").value;
  if (!date) {
    setFieldError(form, "saleDate", "Informe a data.");
    showToast("Verifique o formulário.", true);
    return;
  }

  const lines = [];
  const rows = [...$("saleLines").querySelectorAll(".sale-line")];
  if (!rows.length) {
    form.querySelector('.field-error[data-for="saleLines"]').textContent = "Adicione ao menos um item.";
    showToast("Adicione itens à venda.", true);
    return;
  }

  for (const row of rows) {
    const sel = row.querySelector(".sale-item-select").value;
    const qty = Number(row.querySelector(".sale-qty").value);
    if (!sel) {
      form.querySelector('.field-error[data-for="saleLines"]').textContent = "Selecione todos os itens.";
      showToast("Selecione todos os itens.", true);
      return;
    }
    if (!(qty >= 1)) {
      form.querySelector('.field-error[data-for="saleLines"]').textContent = "Quantidade inválida.";
      showToast("Quantidade inválida.", true);
      return;
    }
    const [type, idStr] = sel.split(":");
    const refId = Number(idStr);
    if (type === "product") {
      const product = findById(appData.products, refId);
      if (!product || product.stock < qty) {
        form.querySelector('.field-error[data-for="saleLines"]').textContent = `Estoque insuficiente: ${product?.name || "produto"}.`;
        showToast("Estoque insuficiente para um ou mais produtos.", true);
        return;
      }
    }
    lines.push({ type, refId, qty, unitPrice: getLineUnitPrice(sel) });
  }

  for (const line of lines) {
    if (line.type === "product") {
      const product = findById(appData.products, line.refId);
      product.stock -= line.qty;
    }
  }

  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const clientVal = $("saleClient").value;
  const barberVal = $("saleBarber").value;

  appData.sales.push({
    id: nextId(appData.sales),
    date,
    clientId: clientVal ? Number(clientVal) : null,
    barberId: barberVal ? Number(barberVal) : null,
    items: lines,
    total
  });

  saveData();
  closeModal("saleModal");
  showToast("Venda registrada. Estoque atualizado.");
});

/* --- Dashboard --- */
function aggregateSales(sales) {
  let productRev = 0;
  let serviceRev = 0;
  const productQty = {};
  const serviceQty = {};

  sales.forEach((sale) => {
    sale.items.forEach((it) => {
      const val = it.unitPrice * it.qty;
      if (it.type === "product") {
        productRev += val;
        const name = findById(appData.products, it.refId)?.name || "Produto";
        productQty[name] = (productQty[name] || 0) + it.qty;
      } else {
        serviceRev += val;
        const name = findById(appData.services, it.refId)?.name || "Serviço";
        serviceQty[name] = (serviceQty[name] || 0) + it.qty;
      }
    });
  });

  return { productRev, serviceRev, total: productRev + serviceRev, productQty, serviceQty };
}

function topEntries(qtyMap, limit = 5) {
  return Object.entries(qtyMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function renderDashboard() {
  renderTodayPanel();
  const { productRev, serviceRev, total, productQty, serviceQty } = aggregateSales(appData.sales);
  const completedAppts = appData.appointments.filter((a) => a.status === "completed").length;

  $("dashTotalRevenue").textContent = money(total);
  $("dashProductRevenue").textContent = money(productRev);
  $("dashServiceRevenue").textContent = money(serviceRev);
  $("dashAppointments").textContent = completedAppts;

  const topP = topEntries(productQty);
  $("dashTopProducts").innerHTML = topP.length
    ? topP.map(([n, q]) => `<div class="rank-row"><span>${escapeHTML(n)}</span><strong>${q} un.</strong></div>`).join("")
    : '<div class="empty">Sem vendas de produtos ainda.</div>';

  const topS = topEntries(serviceQty);
  $("dashTopServices").innerHTML = topS.length
    ? topS.map(([n, q]) => `<div class="rank-row"><span>${escapeHTML(n)}</span><strong>${q}×</strong></div>`).join("")
    : '<div class="empty">Sem serviços vendidos ainda.</div>';

  const low = appData.products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD);
  $("dashStockHint").textContent = low.length
    ? `${low.length} produto(s) abaixo de ${LOW_STOCK_THRESHOLD} unidades`
    : "Estoque OK";
  $("dashLowStock").innerHTML = low.length
    ? low
        .map(
          (p) => `<div class="rank-row"><span>${escapeHTML(p.name)}</span><strong class="low">${p.stock} un.</strong></div>`
        )
        .join("")
    : '<div class="empty">Nenhum alerta de estoque.</div>';
}

/* --- Relatórios --- */
function filterSalesByReport(start, end, barberId) {
  return appData.sales.filter((s) => {
    if (s.date < start || s.date > end) return false;
    if (barberId && String(s.barberId) !== String(barberId)) return false;
    return true;
  });
}

function countAppointmentsInPeriod(start, end, barberId) {
  return appData.appointments.filter((a) => {
    if (a.date < start || a.date > end) return false;
    if (a.status === "cancelled") return false;
    if (barberId && String(a.barberId) !== String(barberId)) return false;
    return true;
  }).length;
}

function renderReports() {
  const start = $("reportStart").value;
  const end = $("reportEnd").value;
  if (!start || !end) return;

  const barberId = $("reportBarber").value;
  const sales = filterSalesByReport(start, end, barberId);
  const agg = aggregateSales(sales);

  $("repRevenue").textContent = money(agg.total);
  $("repProducts").textContent = money(agg.productRev);
  $("repServices").textContent = money(agg.serviceRev);
  $("repAppointments").textContent = countAppointmentsInPeriod(start, end, barberId);

  $("reportSaleList").innerHTML = sales.length
    ? sales
        .map((sale) => {
          const client = sale.clientId ? findById(appData.clients, sale.clientId) : null;
          return `<article class="sale-row">
            <span class="date">${escapeHTML(sale.date)}</span>
            <div><strong>${money(sale.total)}</strong><small>${escapeHTML(client?.name || "Avulsa")}</small></div>
          </article>`;
        })
        .join("")
    : '<div class="empty">Nenhuma venda no período selecionado.</div>';
}

$("reportFilters").addEventListener("submit", (e) => {
  e.preventDefault();
  const start = $("reportStart").value;
  const end = $("reportEnd").value;
  if (start > end) {
    showToast("A data inicial deve ser anterior à final.", true);
    return;
  }
  renderReports();
  showToast("Relatório atualizado.");
});

/* --- Persistência + render geral --- */
function saveData() {
  saveDataStorage(); // grava só o que mudou no Firestore (apenas dono)
  renderAll();
}

function renderAll() {
  renderCalendar();
  renderBookings($("bookingSearch").value);
  renderBarbers();
  renderServices();
  renderProducts();
  renderClients($("clientSearch").value);
  renderSales();
  renderClientArea();
  renderReservations();
  fillBarberSelect($("reportBarber"), true, "Todos");
  if (typeof checkNewActivity === "function") checkNewActivity();
  const activePage = document.querySelector(".page.active");
  if (activePage?.id === "dashboard") renderDashboard();
  if (activePage?.id === "relatorios") renderReports();
}

/* --- Inicialização --- */
(function init() {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date());
  $("currentDate").textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  $("reportStart").value = monthStart;
  $("reportEnd").value = todayISO();

  renderAll();
  renderDashboard();
})();

$("openClientBooking").onclick = () => $("openBooking").onclick();

/* --- Fotos (reduzidas e salvas junto do cadastro) --- */
let itemPhotoData; // undefined = sem alteração, "" = removida, texto = nova foto
let barberPhotoData;

function avatarHTML(photo, fallback) {
  return photo && String(photo).startsWith("data:image/")
    ? `<img src="${photo}" alt="" loading="lazy">`
    : escapeHTML(fallback);
}

function resizeImage(file, size = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height); // recorte quadrado central
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = url;
  });
}

function showPhotoPreview(id, src) {
  const el = $(id);
  if (src) {
    el.src = src;
    el.classList.remove("hidden");
  } else {
    el.removeAttribute("src");
    el.classList.add("hidden");
  }
}

function setupPhotoPicker(inputId, previewId, removeId, onChange) {
  $(inputId).addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = await resizeImage(file);
      onChange(data);
      showPhotoPreview(previewId, data);
    } catch {
      showToast("Não foi possível ler a imagem.", true);
    }
  });
  $(removeId).onclick = () => {
    onChange("");
    $(inputId).value = "";
    showPhotoPreview(previewId, "");
  };
}

setupPhotoPicker("itemPhoto", "itemPhotoPreview", "itemPhotoRemove", (d) => (itemPhotoData = d));
setupPhotoPicker("barberPhoto", "barberPhotoPreview", "barberPhotoRemove", (d) => (barberPhotoData = d));

/* --- Reservas de produtos (visão do dono) --- */
function renderReservations() {
  const label = { reserved: "Reservado", delivered: "Entregue", cancelled: "Cancelado" };
  const list = [...appData.reservations].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  $("reservationList").innerHTML = list.length
    ? list
        .map((r) => {
          const p = findById(appData.products, r.productId);
          const c = findById(appData.clients, r.clientId);
          return `<article class="sale-row">
            <span class="date">${new Date(r.createdAt || Date.now()).toLocaleDateString("pt-BR")}</span>
            <div><strong>${escapeHTML(p?.name || "Produto")} × ${r.qty}</strong>
              <small>${escapeHTML(c?.name || "Cliente")} · ${escapeHTML(c?.phone || "")} · ${label[r.status] || r.status}</small></div>
            ${
              r.status === "reserved"
                ? `<div class="booking-actions">
                    <button type="button" class="icon-button" onclick="deliverReservation(${r.id})" title="Entregue: lança a venda e baixa o estoque">✓</button>
                    <button type="button" class="icon-button danger" onclick="cancelReservationOwner(${r.id})" title="Cancelar reserva">✕</button>
                  </div>`
                : ""
            }
          </article>`;
        })
        .join("")
    : '<div class="empty">Nenhuma reserva de produto.</div>';
}

window.deliverReservation = (id) => {
  const r = findById(appData.reservations, id);
  if (!r || r.status !== "reserved") return;
  const p = findById(appData.products, r.productId);
  if (!p || p.stock < r.qty) {
    showToast("Estoque insuficiente para entregar.", true);
    return;
  }
  p.stock -= r.qty;
  appData.sales.push({
    id: nextId(),
    date: todayISO(),
    clientId: r.clientId,
    barberId: null,
    items: [{ type: "product", refId: p.id, qty: r.qty, unitPrice: Number(p.price) }],
    total: Number(p.price) * r.qty
  });
  r.status = "delivered";
  saveData();
  showToast("Entrega registrada. Venda lançada e estoque atualizado.");
};

window.cancelReservationOwner = (id) => {
  const r = findById(appData.reservations, id);
  if (!r || !confirm("Cancelar esta reserva?")) return;
  r.status = "cancelled";
  saveData();
  showToast("Reserva cancelada.");
};

/* --- Agenda de hoje (dashboard) --- */
function renderTodayPanel() {
  const today = todayISO();
  const items = appData.appointments
    .filter((a) => a.date === today && a.status !== "cancelled")
    .sort((x, y) => x.time.localeCompare(y.time));
  $("dashTodayHint").textContent = items.length ? `${items.length} atendimento(s) hoje` : "Sem atendimentos hoje";
  $("dashToday").innerHTML = items.length
    ? items
        .map((a) => {
          const client = findById(appData.clients, a.clientId);
          const service = findById(appData.services, a.serviceId);
          const barber = findById(appData.barbers, a.barberId);
          return `<article class="booking">
            <time>${escapeHTML(a.time)}</time><i class="color-bar"></i>
            <div><strong>${escapeHTML(client?.name || "Cliente")}</strong>
              <small>${escapeHTML(service?.name || "—")} · ${escapeHTML(barber?.name || "—")}</small></div>
            <span class="status-badge ${a.status}">${a.status === "completed" ? "Concluído" : "Agendado"}</span>
          </article>`;
        })
        .join("")
    : '<div class="empty">Nenhum atendimento para hoje.</div>';
}
