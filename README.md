# VS Studio — Gestão de Barbearia (Firebase)

Sistema para barbearia em **HTML, CSS e JavaScript**, agora com **login**, **banco de dados Firebase (Firestore)**, **integração com o calendário do celular** e **confirmação direta no WhatsApp**.

## O que mudou

- **Login** (e-mail/senha e Google) com dois perfis: **dono** (painel completo) e **cliente** (agenda os próprios horários).
- **Firestore em tempo real**: agendamentos, produtos, serviços, barbeiros, clientes e vendas ficam na nuvem e sincronizam entre dispositivos.
- **Sem horário duplo**: o agendamento usa uma transação com bloqueios de horário, então dois clientes não conseguem pegar o mesmo horário.
- **Calendário do celular**: após agendar, o cliente baixa um `.ics` (iPhone/Android) com **lembretes 1 dia e 1 hora antes**, ou abre no Google Agenda.
- **WhatsApp**: ao confirmar, abre direto a conversa com a mensagem pronta (cliente → barbearia; dono → cliente).

## Configuração (uma vez)

1. Em https://console.firebase.google.com crie um projeto e adicione um **app Web**. Copie o `firebaseConfig` para `js/firebase-config.js` e ajuste também `SHOP` (WhatsApp da barbearia com DDI+DDD, endereço).
2. **Authentication → Sign-in method**: ative **E-mail/senha** e **Google**.
3. **Firestore Database**: crie o banco e, em **Regras**, cole o conteúdo de `firestore.rules` e publique.
4. **Defina o dono**: crie sua conta pelo app (aba *Criar conta*), copie seu **UID** em *Authentication → Users*, e no Firestore crie a coleção `owners` com um documento cujo **ID é o seu UID** (pode ter um campo qualquer, ex.: `ok: true`). Saia e entre de novo: você verá o painel do dono.
5. Cadastre **barbeiros** e **serviços** no painel (o banco começa vazio). Clientes que criarem conta já poderão agendar.
6. Em **Authentication → Settings → Authorized domains**, adicione o domínio onde o site ficar hospedado.

## Como executar

O Firebase Auth **não funciona via `file://`**. Use um servidor local:

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`. Para publicar, use o **Firebase Hosting** (`firebase deploy`) ou qualquer hospedagem estática com HTTPS.

## Estrutura

| Arquivo | Função |
|---------|--------|
| `index.html` | Login, painel do dono, área do cliente e modais |
| `styles.css` | Visual preto/dourado e responsividade |
| `firestore.rules` | Regras de segurança (dono x cliente) |
| `js/firebase-config.js` | Credenciais do Firebase e dados da barbearia |
| `js/storage.js` | Firestore: sincronização, agendamento por transação |
| `js/auth.js` | Login, cadastro, perfis |
| `js/scheduler.js` | Horários disponíveis e conflitos |
| `js/integrations.js` | `.ics`, Google Agenda, WhatsApp, área do cliente |
| `js/app.js` | Formulários, listagens, dashboard e relatórios |
| `js/notify.js` | Avisos e contadores do dono |
| `js/pwa.js`, `sw.js`, `manifest.webmanifest`, `icons/` | App instalável |

## App instalável (PWA) e avisos do dono

- **Instalar**: no Android/Chrome aparece o botão **📲 Instalar app** (login, área do cliente e menu do dono). No iPhone, abra no Safari → Compartilhar → **Adicionar à Tela de Início**.
- **Avisos do dono** (com o app aberto ou em segundo plano): ao entrar um **agendamento, reserva ou cancelamento** aparece um aviso na tela, toca um bip e, se o dono tiver clicado em **🔔 Ativar avisos**, chega uma notificação do sistema.
- **Contadores no menu**: **Agenda** mostra os agendamentos novos desde a última vez que o dono abriu a agenda; **Reservas** mostra as pendentes. No app instalado, o total vira o número no ícone.
- **Agenda de hoje**: painel no Dashboard com os atendimentos do dia.

## Limites desta versão

- O WhatsApp abre com a **mensagem pronta e a pessoa toca em enviar** (usa `wa.me`, gratuito e sem servidor). Envio 100% automático, sem toque, exige a **WhatsApp Business Cloud API** + **Cloud Functions** (plano Blaze).
- O lembrete no celular vem do **calendário do próprio aparelho** (o `.ics` já traz os alertas). Lembretes enviados pelo servidor, mesmo sem o cliente ter adicionado ao calendário, também exigem Cloud Functions agendadas.
- Notificações do sistema só chegam com o app aberto ou em segundo plano. Com o app **totalmente fechado**, o aviso só aparece quando o dono abrir (nos contadores). Push com o app fechado exige Firebase Cloud Messaging + Cloud Functions (plano Blaze). No iPhone, notificações só funcionam com o app instalado na Tela de Início (iOS 16.4 ou superior).
- Os dados antigos do `localStorage` não são migrados: o banco no Firebase começa vazio.
