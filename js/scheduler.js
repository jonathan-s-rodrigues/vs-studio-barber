/**
 * Cálculo de horários disponíveis e detecção de conflitos
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getServiceDurationMinutes(serviceId) {
  const s = findById(appData.services, serviceId);
  return s ? Number(s.durationMinutes) || 30 : 30;
}

/** Agendamentos ativos do barbeiro na data (exclui cancelados) */
function getBarberAppointmentsForDate(barberId, date, excludeAppointmentId = null) {
  return appData.appointments.filter(
    (a) =>
      String(a.barberId) === String(barberId) &&
      a.date === date &&
      a.status !== "cancelled" &&
      String(a.id) !== String(excludeAppointmentId)
  );
}

function appointmentEndMinutes(appointment) {
  const start = timeToMinutes(appointment.time);
  const dur = getServiceDurationMinutes(appointment.serviceId);
  return start + dur;
}

/** Verifica sobreposição entre [start, start+duration) e agendamentos existentes */
function hasConflict(barberId, date, startTime, durationMinutes, excludeAppointmentId = null) {
  // bloqueios de horário (inclui agendamentos de outros clientes, sem expor dados pessoais)
  if (lockKeys(barberId, date, startTime, durationMinutes).some((k) => bookedLocks.has(k))) return true;

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  const existing = getBarberAppointmentsForDate(barberId, date, excludeAppointmentId);

  return existing.some((appt) => {
    const aStart = timeToMinutes(appt.time);
    const aEnd = appointmentEndMinutes(appt);
    return start < aEnd && end > aStart;
  });
}

/** Lista horários de início disponíveis para barbeiro + serviço + data */
function getAvailableTimeSlots(barberId, serviceId, date) {
  if (!barberId || !serviceId || !date) return [];

  const duration = getServiceDurationMinutes(serviceId);
  const slots = [];
  const { start, end, slotStep } = SHOP_HOURS;
  const now = new Date();
  const minNow = date === todayISO() ? now.getHours() * 60 + now.getMinutes() : -1;

  for (let t = start; t + duration <= end; t += slotStep) {
    if (t <= minNow) continue; // não oferece horários que já passaram
    const timeStr = minutesToTime(t);
    if (!hasConflict(barberId, date, timeStr, duration)) {
      slots.push(timeStr);
    }
  }
  return slots;
}

function datesWithAppointments(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const set = new Set();
  appData.appointments
    .filter((a) => a.status !== "cancelled" && a.date.startsWith(prefix))
    .forEach((a) => set.add(a.date));
  return set;
}
