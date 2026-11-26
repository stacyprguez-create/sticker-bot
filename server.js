const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const QRCode = require('qrcode');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 7860;

const TEMP_DIR = path.join(__dirname, 'temp');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AUTH_DIR = path.join(__dirname, 'auth_info');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
const HTML_PAGE = '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>StickerAudio Bot</title>\n  <style>\n    :root {\n      --bg: #0b141a;\n      --card: #111b21;\n      --card-2: #202c33;\n      --green: #00a884;\n      --text: #e9edef;\n      --muted: #8696a0;\n      --danger: #f15c6d;\n    }\n    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\n    body { margin: 0; background: var(--bg); color: var(--text); padding: 20px 14px; display: flex; justify-content: center; }\n    .wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 16px; }\n    h1 { margin: 0; font-size: 1.4rem; color: var(--green); text-align: center; }\n    .sub { margin: 4px 0 0; font-size: 0.88rem; color: var(--muted); text-align: center; }\n    .card { background: var(--card); border: 1px solid #222d34; border-radius: 16px; padding: 18px; }\n    .badge { display: inline-block; background: rgba(0,168,132,0.15); color: var(--green); font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 99px; margin-bottom: 10px; }\n    .pill { display: inline-flex; align-items: center; gap: 8px; background: var(--card-2); padding: 8px 14px; border-radius: 99px; font-size: 0.88rem; font-weight: 600; }\n    .dot { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; }\n    .dot.ready { background: var(--green); }\n    label { display: block; font-size: 0.84rem; color: var(--muted); margin: 12px 0 6px; }\n    input, select { width: 100%; background: var(--card-2); border: 1px solid #2a3942; color: var(--text); padding: 12px; border-radius: 10px; font-size: 1rem; }\n    .btn { width: 100%; margin-top: 14px; background: var(--green); color: #0b141a; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; }\n    .btn:disabled { opacity: 0.5; }\n    .btn-sec { background: var(--card-2); color: var(--text); margin-top: 10px; }\n    .code-box { margin-top: 12px; background: var(--card-2); padding: 14px; border-radius: 12px; text-align: center; font-size: 1.6rem; font-weight: 800; letter-spacing: 3px; color: var(--green); }\n    .qr { width: 220px; height: 220px; background: #fff; padding: 8px; border-radius: 12px; display: block; margin: 12px auto; }\n    .how-list { margin: 8px 0 0; padding-left: 18px; color: var(--text); font-size: 0.92rem; line-height: 1.55; }\n    .how-list li { margin-bottom: 6px; }\n    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\n    .tab { background: var(--card-2); color: var(--muted); border: none; padding: 10px; border-radius: 10px; font-weight: 600; cursor: pointer; }\n    .tab.active { background: var(--green); color: #0b141a; }\n    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\n    .alert { margin-top: 12px; padding: 12px; border-radius: 10px; font-size: 0.9rem; display: none; }\n    .alert.ok { display: block; background: rgba(0,168,132,0.16); border: 1px solid var(--green); color: #53bdeb; }\n    .alert.err { display: block; background: rgba(241,92,109,0.15); border: 1px solid var(--danger); color: var(--danger); }\n    .hidden { display: none; }\n  </style>\n</head>\n<body>\n  <div class="wrap">\n    <div>\n      <h1>StickerAudio Bot</h1>\n      <p class="sub">Envía un video o link de TikTok en WhatsApp y recibe el sticker con sonido integrado</p>\n    </div>\n\n    <div class="card">\n      <span class="badge">PASO 1 · CONECTAR TU WHATSAPP</span>\n      <div><span class="pill"><span class="dot" id="dot"></span><span id="statusText">Iniciando...</span></span></div>\n\n      <div id="linkBox" class="hidden">\n        <img id="qrImg" class="qr" alt="Código QR WhatsApp" />\n        <p style="font-size:0.82rem; color:var(--muted); text-align:center; margin:4px 0 12px;">\n          Escanea este QR en <b>WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo</b>\n        </p>\n\n        <details>\n          <summary style="font-size:0.85rem; color:var(--green); cursor:pointer; font-weight:600;">O vincular sin cámara (código de 8 letras)</summary>\n          <label>Tu número con código de país (ej: 18095551234)</label>\n          <input type="tel" id="myPhone" placeholder="18095551234" />\n          <button class="btn btn-sec" onclick="getCode()">Obtener código de 8 letras</button>\n          <div id="codeDisplay" class="code-box hidden"></div>\n        </details>\n      </div>\n    </div>\n\n    <div class="card">\n      <span class="badge">CÓMO USARLO DIRECTO EN WHATSAPP</span>\n      <ul class="how-list">\n        <li>Abre tu chat privado contigo misma (<b>Tú</b>) en WhatsApp.</li>\n        <li>Envía cualquier <b>video de tu galería</b> o pega un <b>enlace de TikTok</b>.</li>\n        <li>El bot te responderá con el <b>sticker en el formato nuevo con sonido</b> listo para guardar en Favoritos.</li>\n        <li><i>Truco:</i> Si quieres empezar en otro segundo, escribe el número junto al link o en el comentario del video (ej: <code>3</code>).</li>\n      </ul>\n    </div>\n\n    <div class="card">\n      <span class="badge">OPCIONAL · CREAR DESDE AQUÍ</span>\n      <div class="tabs">\n        <button class="tab active" id="tTik" onclick="setMode(\'tiktok\')">Link TikTok</button>\n        <button class="tab" id="tGal" onclick="setMode(\'file\')">Subir Video</button>\n      </div>\n\n      <div id="boxTik">\n        <label>Enlace de TikTok</label>\n        <input type="text" id="tiktokUrl" placeholder="https://vt.tiktok.com/..." />\n      </div>\n\n      <div id="boxGal" class="hidden">\n        <label>Video de tu galería</label>\n        <input type="file" id="videoFile" accept="video/*" />\n      </div>\n\n      <div class="row">\n        <div>\n          <label>Empezar en segundo</label>\n          <input type="number" id="startTime" value="0" min="0" />\n        </div>\n        <div>\n          <label>Recorte cuadrado</label>\n          <select id="fitMode">\n            <option value="crop">Llenar cuadro</option>\n            <option value="pad">Video completo</option>\n          </select>\n        </div>\n      </div>\n\n      <label>Tipo de sticker</label>\n      <select id="stickerType">\n        <option value="audio">Nuevo con sonido (icono de bocina)</option>\n        <option value="silent">Clásico animado sin sonido</option>\n      </select>\n\n      <button class="btn" id="sendBtn" onclick="sendSticker()">Crear y Enviar Sticker</button>\n      <div class="alert" id="alertBox"></div>\n    </div>\n  </div>\n\n  <script>\n    var mode = \'tiktok\';\n    function setMode(m) {\n      mode = m;\n      document.getElementById(\'tTik\').classList.toggle(\'active\', m === \'tiktok\');\n      document.getElementById(\'tGal\').classList.toggle(\'active\', m === \'file\');\n      document.getElementById(\'boxTik\').classList.toggle(\'hidden\', m !== \'tiktok\');\n      document.getElementById(\'boxGal\').classList.toggle(\'hidden\', m !== \'file\');\n    }\n\n    async function check() {\n      try {\n        var r = await fetch(\'/api/status\');\n        var d = await r.json();\n        document.getElementById(\'statusText\').textContent = d.message;\n        document.getElementById(\'dot\').classList.toggle(\'ready\', d.status === \'ready\');\n        document.getElementById(\'linkBox\').classList.toggle(\'hidden\', d.status !== \'qr\');\n        if (d.qrDataUrl) document.getElementById(\'qrImg\').src = d.qrDataUrl;\n        if (d.pairingCode) {\n          var cb = document.getElementById(\'codeDisplay\');\n          cb.textContent = d.pairingCode;\n          cb.classList.remove(\'hidden\');\n        }\n      } catch (e) {}\n    }\n    setInterval(check, 2000);\n    check();\n\n    async function getCode() {\n      var phone = document.getElementById(\'myPhone\').value;\n      var r = await fetch(\'/api/pair-code\', {\n        method: \'POST\',\n        headers: { \'Content-Type\': \'application/json\' },\n        body: JSON.stringify({ phoneNumber: phone })\n      });\n      var d = await r.json();\n      if (d.ok) {\n        var cb = document.getElementById(\'codeDisplay\');\n        cb.textContent = d.code;\n        cb.classList.remove(\'hidden\');\n      } else {\n        alert(d.error);\n      }\n    }\n\n    async function sendSticker() {\n      var btn = document.getElementById(\'sendBtn\');\n      var box = document.getElementById(\'alertBox\');\n      box.className = \'alert\';\n      var fd = new FormData();\n      fd.append(\'startTime\', document.getElementById(\'startTime\').value || \'0\');\n      fd.append(\'fitMode\', document.getElementById(\'fitMode\').value);\n      fd.append(\'stickerType\', document.getElementById(\'stickerType\').value);\n\n      if (mode === \'tiktok\') {\n        var u = document.getElementById(\'tiktokUrl\').value.trim();\n        if (!u) { box.className = \'alert err\'; box.textContent = \'Pega un link de TikTok.\'; return; }\n        fd.append(\'tiktokUrl\', u);\n      } else {\n        var f = document.getElementById(\'videoFile\').files[0];\n        if (!f) { box.className = \'alert err\'; box.textContent = \'Elige un video primero.\'; return; }\n        fd.append(\'videoFile\', f);\n      }\n\n      btn.disabled = true;\n      btn.textContent = \'Creando sticker con sonido...\';\n      try {\n        var r = await fetch(\'/api/create-sticker\', { method: \'POST\', body: fd });\n        var d = await r.json();\n        if (d.ok) {\n          box.className = \'alert ok\';\n          box.textContent = d.message;\n        } else {\n          box.className = \'alert err\';\n          box.textContent = d.error;\n        }\n      } catch (e) {\n        box.className = \'alert err\';\n        box.textContent = \'Error de conexión.\';\n      } finally {\n        btn.disabled = false;\n        btn.textContent = \'Crear y Enviar Sticker\';\n      }\n    }\n  </script>\n</body>\n</html>';

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML_PAGE);
});

const upload = multer({ dest: UPLOADS_DIR });
const processedMsgIds = new Set();

let sock = null;
let waState = {
  status: 'starting',
  qrDataUrl: null,
  pairingCode: null,
  phone: null,
  wid: null,
  message: 'Conectando motor de WhatsApp...'
};

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

async function downloadTikTok(tiktokUrl, outputPath) {
  let targetUrl = tiktokUrl.trim();
  try {
    const headRes = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (headRes && headRes.url) targetUrl = headRes.url;
  } catch (_) {}

  const res = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: new URLSearchParams({ url: targetUrl, hd: '1' })
  });
  const data = await res.json();
  if (!data || data.code !== 0 || !data.data || !data.data.play) {
    throw new Error('No se pudo descargar el video de TikTok. Verifica que el enlace sea público.');
  }
  let playUrl = data.data.play;
  if (playUrl.startsWith('/')) {
    playUrl = 'https://www.tikwm.com' + playUrl;
  }
  const videoRes = await fetch(playUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!videoRes.ok) throw new Error('Error descargando el archivo de TikTok.');
  const arrayBuffer = await videoRes.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

async function buildSticker({ inputFilePath, tiktokUrl, startSec = 0, fitMode = 'crop', withAudio = true }) {
  const id = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
  const rawInputPath = path.join(TEMP_DIR, `raw_${id}.mp4`);
  const clipMp4Path = path.join(TEMP_DIR, `clip_${id}.mp4`);
  const webpPath = path.join(TEMP_DIR, `sticker_${id}.webp`);
  const cleanup = [rawInputPath, clipMp4Path, webpPath];

  try {
    if (inputFilePath) {
      fs.copyFileSync(inputFilePath, rawInputPath);
    } else if (tiktokUrl) {
      await downloadTikTok(tiktokUrl, rawInputPath);
    } else {
      throw new Error('No se recibió video ni enlace.');
    }

    const scaleFilter = fitMode === 'pad'
      ? 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black'
      : 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512';

    // 1. Generar el clip cuadrado MP4 con audio AAC para el formato nuevo de sticker de WhatsApp
    await runFfmpeg([
      '-y', '-ss', String(startSec), '-t', '5', '-i', rawInputPath,
      '-vf', `${scaleFilter},fps=24,format=yuv420p`,
      '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
      '-preset', 'fast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '64k', '-ar', '44100',
      '-movflags', '+faststart', clipMp4Path
    ]);

    // Si supera 850 KB, ajustar peso para cumplir con el límite de stickers de WhatsApp
    if (fs.existsSync(clipMp4Path) && fs.statSync(clipMp4Path).size > 850000) {
      await runFfmpeg([
        '-y', '-ss', String(startSec), '-t', '4', '-i', rawInputPath,
        '-vf', `${scaleFilter},fps=20,format=yuv420p`,
        '-c:v', 'libx264', '-profile:v', 'baseline', '-level', '3.0',
        '-preset', 'fast', '-crf', '30',
        '-c:a', 'aac', '-b:a', '48k', '-ar', '44100',
        '-movflags', '+faststart', clipMp4Path
      ]);
    }

    if (withAudio) {
      const mp4Buffer = fs.readFileSync(clipMp4Path);
      return {
        buffer: mp4Buffer,
        mimetype: 'video/mp4',
        isAnimated: true
      };
    }

    // Modo clásico sin sonido (WebP animado)
    await runFfmpeg([
      '-y', '-i', clipMp4Path,
      '-vcodec', 'libwebp', '-filter:v', 'fps=fps=15',
      '-lossless', '0', '-compression_level', '4', '-q:v', '50',
      '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', webpPath
    ]);

    const webpBuffer = fs.readFileSync(webpPath);
    return {
      buffer: webpBuffer,
      mimetype: 'image/webp',
      isAnimated: true
    };
  } finally {
    for (const f of cleanup) {
      if (f && fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
}

async function sendStickerMessage(chatJid, stickerData, quotedMsg) {
  const payload = stickerData.mimetype === 'video/mp4'
    ? {
        sticker: stickerData.buffer,
        mimetype: 'video/mp4',
        isAnimated: true,
        width: 512,
        height: 512
      }
    : {
        sticker: stickerData.buffer
      };

  await sock.sendMessage(
    chatJid,
    payload,
    quotedMsg ? { quoted: quotedMsg } : undefined
  );
}

async function startWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 260, margin: 2 });
          waState.status = 'qr';
          waState.qrDataUrl = qrDataUrl;
          waState.message = 'Listo para vincular tu WhatsApp';
        } catch (e) {
          console.error('Error QR:', e);
        }
      }

      if (connection === 'open') {
        const rawId = sock.user && sock.user.id ? sock.user.id : '';
        const phone = rawId.split(':')[0].split('@')[0];
        const wid = `${phone}@s.whatsapp.net`;
        waState = {
          status: 'ready',
          qrDataUrl: null,
          pairingCode: null,
          phone,
          wid,
          message: `Conectado (+${phone})`
        };
        console.log('WhatsApp conectado:', wid);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output
          ? lastDisconnect.error.output.statusCode
          : 0;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (loggedOut && fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }

        waState = {
          status: 'starting',
          qrDataUrl: null,
          pairingCode: null,
          phone: null,
          wid: null,
          message: 'Reconectando con WhatsApp...'
        };
        setTimeout(startWhatsApp, 2000);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        try {
          if (!msg.message || !msg.key || !msg.key.remoteJid) continue;
          const msgId = msg.key.id;
          if (processedMsgIds.has(msgId)) continue;
          processedMsgIds.add(msgId);
          if (processedMsgIds.size > 500) {
            const first = processedMsgIds.values().next().value;
            processedMsgIds.delete(first);
          }

          const chatJid = msg.key.remoteJid;
          if (chatJid === 'status@broadcast') continue;

          const isSelfChat = waState.phone && chatJid.startsWith(waState.phone);
          if (msg.key.fromMe && !isSelfChat) continue;
          if (msg.message.stickerMessage) continue;

          const text =
            msg.message.conversation ||
            (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) ||
            (msg.message.videoMessage && msg.message.videoMessage.caption) ||
            '';

          const tiktokMatch = text.match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+/i);
          const videoMsg = msg.message.videoMessage;

          if (!tiktokMatch && !videoMsg) continue;

          const cleanTextWithoutUrl = text.replace(/https?:\/\/[^\s]+/gi, '').trim();
          const secMatch = cleanTextWithoutUrl.match(/\b(\d+(?:\.\d+)?)\b/);
          const startSec = secMatch ? Math.max(0, parseFloat(secMatch[1])) : 0;
          const wantsSilent = /\bmudo\b|\bsin\s+audio\b/i.test(cleanTextWithoutUrl);

          if (videoMsg) {
            const tempVid = path.join(TEMP_DIR, `wa_in_${Date.now()}.mp4`);
            try {
              const mediaBuffer = await downloadMediaMessage(
                msg,
                'buffer',
                {},
                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
              );
              fs.writeFileSync(tempVid, mediaBuffer);
              const stickerData = await buildSticker({
                inputFilePath: tempVid,
                startSec,
                fitMode: 'crop',
                withAudio: !wantsSilent
              });
              await sendStickerMessage(chatJid, stickerData, msg);
            } finally {
              if (fs.existsSync(tempVid)) try { fs.unlinkSync(tempVid); } catch (_) {}
            }
          } else if (tiktokMatch) {
            const stickerData = await buildSticker({
              tiktokUrl: tiktokMatch[0],
              startSec,
              fitMode: 'crop',
              withAudio: !wantsSilent
            });
            await sendStickerMessage(chatJid, stickerData, msg);
          }
        } catch (err) {
          console.error('Error procesando mensaje WA:', err.message);
          if (msg && msg.key && msg.key.remoteJid) {
            await sock.sendMessage(
              msg.key.remoteJid,
              { text: '❌ No pude crear el sticker: ' + err.message },
              { quoted: msg }
            ).catch(() => {});
          }
        }
      }
    });
  } catch (err) {
    waState.status = 'error';
    waState.message = 'Error al iniciar: ' + err.message;
    setTimeout(startWhatsApp, 5000);
  }
}

startWhatsApp();

app.get('/api/status', (req, res) => {
  res.json(waState);
});

app.post('/api/pair-code', async (req, res) => {
  try {
    if (!sock) return res.status(400).json({ ok: false, error: 'Espera 3 segundos y vuelve a intentar.' });
    const { phoneNumber } = req.body;
    const digits = (phoneNumber || '').replace(/\D/g, '');
    if (digits.length < 8) {
      return res.status(400).json({ ok: false, error: 'Escribe tu número completo con código de país (ej: 18095551234).' });
    }
    const code = await sock.requestPairingCode(digits);
    waState.pairingCode = code;
    res.json({ ok: true, code });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'No se pudo generar el código: ' + err.message });
  }
});

app.post('/api/create-sticker', upload.single('videoFile'), async (req, res) => {
  try {
    if (waState.status !== 'ready' || !waState.wid || !sock) {
      return res.status(400).json({ ok: false, error: 'Primero vincula tu WhatsApp en el Paso 1.' });
    }

    const { tiktokUrl, startTime = '0', fitMode = 'crop', stickerType = 'audio' } = req.body;
    const startSec = Math.max(0, parseFloat(startTime) || 0);

    if (!req.file && (!tiktokUrl || !tiktokUrl.trim())) {
      return res.status(400).json({ ok: false, error: 'Pega un link de TikTok o elige un video.' });
    }

    const stickerData = await buildSticker({
      inputFilePath: req.file ? req.file.path : null,
      tiktokUrl: tiktokUrl ? tiktokUrl.trim() : null,
      startSec,
      fitMode,
      withAudio: stickerType !== 'silent'
    });

    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }

    await sendStickerMessage(waState.wid, stickerData, null);

    res.json({
      ok: true,
      message: '¡Listo! Revisa tu chat privado ("Tú") en WhatsApp y guarda el sticker en Favoritos.'
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    res.status(500).json({ ok: false, error: err.message || 'Error procesando el sticker.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
