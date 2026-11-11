/**
 * Camada de dados — Firebase Auth + Firestore (VS Studio)
 * appData funciona como cache local, alimentado em tempo real pelo Firestore.
 */
const LOW_STOCK_THRESHOLD = 5;

/** Horário de funcionamento para agendamentos */
const SHOP_HOURS = { start: 8 * 60, end: 20 * 60, slotStep: 15 };
/** Granularidade dos bloqueios de horário (minutos) */
const LOCK_UNIT = 5;

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentRole = null; // "owner" | "client"
let bookedLocks = new Set();

const OWNER_COLLECTIONS = ["barbers", "clients", "services", "products", "appointments", "sales", "reservations"];

function emptyData() {
  return { barbers: [], clients: [], services: [], products: [], appointments: [], sales: [], reservations: [] };
}
let appData = emptyData();

/** Data local (evita o erro de fuso do toISOString) */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ids numéricos únicos entre dispositivos (vários usuários criam registros ao mesmo tempo) */
function nextId() {
  return Date.now() * 10 + Math.floor(Math.random() * 10);
}

function findById(list, id) {
  return list.find((x) => String(x.id) === String(id));
}

/* --- Sincronização em tempo real --- */
const remote = {}; // nome -> Map(docId -> json estável)
let unsubscribers = [];
let renderTimer = null;

const stable = (v) =>
  Array.isArray(v)
    ? "[" + v.map(stable).join(",") + "]"
    : v && typeof v === "object"
    ? "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
    : JSON.stringify(v);

function onDataChanged() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => typeof renderAll === "function" && renderAll(), 30);
}

function startDataSync(role, uid) {
  stopDataSync();
  const col = (n) => db.collection(n);
  const queries =
    role === "owner"
      ? Object.fromEntries(OWNER_COLLECTIONS.map((n) => [n, col(n)]))
      : {
          barbers: col("barbers"),
          services: col("services"),
          products: col("products"),
          reservations: col("reservations").where("clientUid", "==", uid),
          clients: col("clients").where("uid", "==", uid),
          appointments: col("appointments").where("clientUid", "==", uid)
        };

  Object.entries(queries).forEach(([name, q]) => {
    unsubscribers.push(
      q.onSnapshot(
        (snap) => {
          appData[name] = snap.docs.map((d) => d.data());
          remote[name] = new Map(snap.docs.map((d) => [d.id, stable(d.data())]));
          onDataChanged();
        },
        (err) => console.error("Firestore:", name, err)
      )
    );
  });

  unsubscribers.push(
    col("locks")
      .where("date", ">=", todayISO())
      .onSnapshot((snap) => {
        bookedLocks = new Set(snap.docs.map((d) => d.id));
        onDataChanged();
      })
  );
}

function stopDataSync() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
  Object.keys(remote).forEach((k) => delete remote[k]);
  appData = emptyData();
  bookedLocks = new Set();
}

/** Dono: grava no Firestore apenas o que mudou em relação ao último snapshot */
async function saveDataStorage() {
  if (currentRole !== "owner") return;
  const batch = db.batch();
  let n = 0;
  for (const name of OWNER_COLLECTIONS) {
    if (!remote[name]) continue;
    const seen = new Set();
    appData[name].forEach((item) => {
      const id = String(item.id);
      seen.add(id);
      const clean = JSON.parse(JSON.stringify(item));
      if (remote[name].get(id) !== stable(clean)) {
        batch.set(db.collection(name).doc(id), clean);
        n++;
      }
    });
    remote[name].forEach((_, id) => {
      if (!seen.has(id)) {
        batch.delete(db.collection(name).doc(id));
        n++;
      }
    });
  }
  if (!n) return;
  try {
    await batch.commit();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar no Firebase.", true);
  }
}

/* --- Agendamento sem conflito (transação com bloqueios de horário) --- */
function lockKeys(barberId, date, startTime, durationMinutes) {
  const start = timeToMinutes(startTime);
  const keys = [];
  for (let t = start; t < start + durationMinutes; t += LOCK_UNIT) {
    keys.push(`${barberId}_${date}_${t}`);
  }
  return keys;
}

async function bookAppointment(appt) {
  const keys = lockKeys(appt.barberId, appt.date, appt.time, getServiceDurationMinutes(appt.serviceId));
  const refs = keys.map((k) => db.collection("locks").doc(k));
  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    if (snaps.some((s) => s.exists)) throw new Error("CONFLICT");
    refs.forEach((r) => tx.set(r, { uid: currentUser.uid, date: appt.date, barberId: String(appt.barberId) }));
    tx.set(db.collection("appointments").doc(String(appt.id)), { ...appt, lockKeys: keys });
  });
}

async function cancelAppointmentRemote(appt) {
  const batch = db.batch();
  batch.update(db.collection("appointments").doc(String(appt.id)), { status: "cancelled" });
  (appt.lockKeys || []).forEach((k) => batch.delete(db.collection("locks").doc(k)));
  await batch.commit();
}
