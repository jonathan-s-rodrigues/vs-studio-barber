/**
 * Login: dono e clientes (Firebase Auth). O dono é quem tem um documento em owners/{uid}.
 */
let pendingProfile = null;

const AUTH_ERRORS = {
  "auth/invalid-email": "E-mail inválido.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já está cadastrado.",
  "auth/weak-password": "A senha deve ter ao menos 6 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente em alguns minutos.",
  "auth/popup-closed-by-user": "Login cancelado.",
  "auth/network-request-failed": "Sem conexão com a internet."
};

const setAuthMessage = (msg, ok = false) => {
  $("authError").textContent = msg;
  $("authError").classList.toggle("ok", ok);
};
const authFail = (err) => setAuthMessage(AUTH_ERRORS[err.code] || err.message);

document.querySelectorAll(".auth-tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((b) => b.classList.toggle("active", b === btn));
    $("loginForm").classList.toggle("hidden", btn.dataset.mode !== "login");
    $("signupForm").classList.toggle("hidden", btn.dataset.mode !== "signup");
    setAuthMessage("");
  })
);

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("");
  try {
    await auth.signInWithEmailAndPassword($("loginEmail").value.trim(), $("loginPassword").value);
  } catch (err) {
    authFail(err);
  }
});

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthMessage("");
  const name = $("signupName").value.trim();
  const phone = $("signupPhone").value.trim();
  if (name.length < 2) return setAuthMessage("Informe seu nome.");
  if (phone.replace(/\D/g, "").length < 10) return setAuthMessage("Informe o WhatsApp com DDD.");
  pendingProfile = { name, phone };
  try {
    const cred = await auth.createUserWithEmailAndPassword($("signupEmail").value.trim(), $("signupPassword").value);
    await cred.user.updateProfile({ displayName: name });
  } catch (err) {
    pendingProfile = null;
    authFail(err);
  }
});

$("googleLogin").addEventListener("click", async () => {
  setAuthMessage("");
  try {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (err) {
    authFail(err);
  }
});

$("resetPassword").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  if (!email) return setAuthMessage("Digite seu e-mail acima para redefinir a senha.");
  try {
    await auth.sendPasswordResetEmail(email);
    setAuthMessage("Enviamos o link de redefinição para o seu e-mail.", true);
  } catch (err) {
    authFail(err);
  }
});

document.querySelectorAll(".logout-button").forEach((b) => (b.onclick = () => auth.signOut()));

/** Garante o cadastro de cliente (clients/{id}) ligado ao usuário logado */
async function ensureClientProfile(user) {
  const snap = await db.collection("clients").where("uid", "==", user.uid).limit(1).get();
  if (!snap.empty) return;
  const p = pendingProfile || {};
  const phone = p.phone || window.prompt("Informe seu WhatsApp com DDD para a barbearia confirmar seus horários:") || "";
  const id = nextId();
  await db.collection("clients").doc(String(id)).set({
    id,
    uid: user.uid,
    name: p.name || user.displayName || "Cliente",
    phone,
    email: user.email || ""
  });
}

function setBodyState(state, role) {
  document.body.classList.remove("state-loading", "state-login");
  if (state) document.body.classList.add(state);
  document.body.classList.toggle("role-client", role === "client");
}

auth.onAuthStateChanged(async (user) => {
  stopDataSync();
  if (typeof resetNotifications === "function") resetNotifications();
  currentUser = user;
  currentRole = null;
  if (!user) {
    setBodyState("state-login", null);
    return;
  }
  try {
    const owner = await db.collection("owners").doc(user.uid).get();
    currentRole = owner.exists ? "owner" : "client";
    if (currentRole === "client") await ensureClientProfile(user);
    pendingProfile = null;
    $("shopUserName").textContent = user.displayName || user.email;
    $("shopUserRole").textContent = currentRole === "owner" ? "Proprietário" : "Cliente";
    setBodyState(null, currentRole);
    startDataSync(currentRole, user.uid);
    renderAll();
  } catch (err) {
    console.error(err);
    setBodyState("state-login", null);
    setAuthMessage("Erro ao carregar sua conta. Verifique as regras do Firestore.");
    auth.signOut();
  }
});
