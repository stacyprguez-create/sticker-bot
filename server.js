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
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 7860;

const TEMP_DIR = path.join(__dirname, 'temp');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const AUTH_DIR = path.join(__dirname, 'auth_info');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
const HTML_PAGE = '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>StickerAudio Bot</title>\n  <style>\n    :root {\n      --bg: #0b141a;\n      --card: #111b21;\n      --card-2: #202c33;\n      --green: #00a884;\n      --text: #e9edef;\n      --muted: #8696a0;\n      --danger: #f15c6d;\n    }\n    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\n    body { margin: 0; background: var(--bg); color: var(--text); padding: 20px 14px; display: flex; justify-content: center; }\n    .wrap { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 16px; }\n    h1 { margin: 0; font-size: 1.4rem; color: var(--green); text-align: center; }\n    .sub { margin: 4px 0 0; font-size: 0.88rem; color: var(--muted); text-align: center; }\n    .card { background: var(--card); border: 1px solid #222d34; border-radius: 16px; padding: 18px; }\n    .badge { display: inline-block; background: rgba(0,168,132,0.15); color: var(--green); font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 99px; margin-bottom: 10px; }\n    .pill { display: inline-flex; align-items: center; gap: 8px; background: var(--card-2); padding: 8px 14px; border-radius: 99px; font-size: 0.88rem; font-weight: 600; }\n    .dot { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; }\n    .dot.ready { background: var(--green); }\n    label { display: block; font-size: 0.84rem; color: var(--muted); margin: 12px 0 6px; }\n    input, select { width: 100%; background: var(--card-2); border: 1px solid #2a3942; color: var(--text); padding: 12px; border-radius: 10px; font-size: 1rem; }\n    .btn { width: 100%; margin-top: 14px; background: var(--green); color: #0b141a; border: none; padding: 14px; border-radius: 12px; font-size: 1rem; font-weight: 700; cursor: pointer; }\n    .btn:disabled { opacity: 0.5; }\n    .btn-sec { background: var(--card-2); color: var(--text); margin-top: 10px; }\n    .code-box { margin-top: 12px; background: var(--card-2); padding: 14px; border-radius: 12px; text-align: center; font-size: 1.6rem; font-weight: 800; letter-spacing: 3px; color: var(--green); }\n    .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\n    .tab { background: var(--card-2); color: var(--muted); border: none; padding: 10px; border-radius: 10px; font-weight: 600; cursor: pointer; }\n    .tab.active { background: var(--green); color: #0b141a; }\n    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }\n    .qr { width: 210px; height: 210px; background: #fff; padding: 8px; border-radius: 12px; display: block; margin: 12px auto; }\n    .alert { margin-top: 12px; padding: 12px; border-radius: 10px; font-size: 0.9rem; display: none; }\n    .alert.ok { display: block; background: rgba(0,168,132,0.16); border: 1px solid var(--green); color: #53bdeb; }\n    .alert.err { display: block; background: rgba(241,92,109,0.15); border: 1px solid var(--danger); color: var(--danger); }\n    .hidden { display: none; }\n  </style>\n</head>\n<body>\n  <div class="wrap">\n    <div>\n      <h1>StickerAudio Bot</h1>\n      <p class="sub">Crea stickers con audio desde TikTok o tu galería</p>\n    </div>\n\n    <div class="card">\n      <span class="badge">PASO 1 · CONECTAR WHATSAPP</span>\n      <div><span class="pill"><span class="dot" id="dot"></span><span id="statusText">Iniciando...</span></span></div>\n\n      <div id="linkBox" class="hidden">\n        <img id="qrImg" class="qr" alt="Código QR WhatsApp" />\n        <p style="font-size:0.82rem; color:var(--muted); text-align:center; margin:4px 0 12px;">\n          Escanea este código QR desde <b>WhatsApp &gt; Dispositivos vinculados &gt; Vincular un dispositivo</b>\n        </p>\n\n        <details>\n          <summary style="font-size:0.85rem; color:var(--green); cursor:pointer; font-weight:600;">O vincular sin cámara (con código de 8 letras)</summary>\n          <label>Tu número con código de país (ej: 18095551234)</label>\n          <input type="tel" id="myPhone" placeholder="18095551234" />\n          <button class="btn btn-sec" onclick="getCode()">Obtener código de 8 letras</button>\n          <div id="codeDisplay" class="code-box hidden"></div>\n        </details>\n      </div>\n    </div>\n\n    <div class="card">\n      <span class="badge">PASO 2 · CREAR STICKER CON AUDIO</span>\n      <div class="tabs">\n        <button class="tab active" id="tTik" onclick="setMode(\'tiktok\')">Link TikTok</button>\n        <button class="tab" id="tGal" onclick="setMode(\'file\')">Subir Video</button>\n      </div>\n\n      <div id="boxTik">\n        <label>Pega el enlace de TikTok</label>\n        <input type="text" id="tiktokUrl" placeholder="https://vt.tiktok.com/..." />\n      </div>\n\n      <div id="boxGal" class="hidden">\n        <label>Elige un video de tu galería</label>\n        <input type="file" id="videoFile" accept="video/*" />\n      </div>\n\n      <div class="row">\n        <div>\n          <label>Empezar en segundo</label>\n          <input type="number" id="startTime" value="0" min="0" />\n        </div>\n        <div>\n          <label>Recorte cuadrado</label>\n          <select id="fitMode">\n            <option value="crop">Llenar cuadro</option>\n            <option value="pad">Video completo</option>\n          </select>\n        </div>\n      </div>\n\n      <button class="btn" id="sendBtn" onclick="sendSticker()">Crear y Enviar a mi Chat</button>\n      <div class="alert" id="alertBox"></div>\n    </div>\n  </div>\n\n  <script>\n    var mode = \'tiktok\';\n    function setMode(m) {\n      mode = m;\n      document.getElementById(\'tTik\').classList.toggle(\'active\', m === \'tiktok\');\n      document.getElementById(\'tGal\').classList.toggle(\'active\', m === \'file\');\n      document.getElementById(\'boxTik\').classList.toggle(\'hidden\', m !== \'tiktok\');\n      document.getElementById(\'boxGal\').classList.toggle(\'hidden\', m !== \'file\');\n    }\n\n    async function check() {\n      try {\n        var r = await fetch(\'/api/status\');\n        var d = await r.json();\n        document.getElementById(\'statusText\').textContent = d.message;\n        document.getElementById(\'dot\').classList.toggle(\'ready\', d.status === \'ready\');\n        document.getElementById(\'linkBox\').classList.toggle(\'hidden\', d.status !== \'qr\');\n        if (d.qrDataUrl) document.getElementById(\'qrImg\').src = d.qrDataUrl;\n        if (d.pairingCode) {\n          var cb = document.getElementById(\'codeDisplay\');\n          cb.textContent = d.pairingCode;\n          cb.classList.remove(\'hidden\');\n        }\n      } catch (e) {}\n    }\n    setInterval(check, 2000);\n    check();\n\n    async function getCode() {\n      var phone = document.getElementById(\'myPhone\').value;\n      var r = await fetch(\'/api/pair-code\', {\n        method: \'POST\',\n        headers: { \'Content-Type\': \'application/json\' },\n        body: JSON.stringify({ phoneNumber: phone })\n      });\n      var d = await r.json();\n      if (d.ok) {\n        var cb = document.getElementById(\'codeDisplay\');\n        cb.textContent = d.code;\n        cb.classList.remove(\'hidden\');\n      } else {\n        alert(d.error);\n      }\n    }\n\n    async function sendSticker() {\n      var btn = document.getElementById(\'sendBtn\');\n      var box = document.getElementById(\'alertBox\');\n      box.className = \'alert\';\n      var fd = new FormData();\n      fd.append(\'startTime\', document.getElementById(\'startTime\').value || \'0\');\n      fd.append(\'fitMode\', document.getElementById(\'fitMode\').value);\n\n      if (mode === \'tiktok\') {\n        var u = document.getElementById(\'tiktokUrl\').value.trim();\n        if (!u) { box.className = \'alert err\'; box.textContent = \'Pega un link de TikTok.\'; return; }\n        fd.append(\'tiktokUrl\', u);\n      } else {\n        var f = document.getElementById(\'videoFile\').files[0];\n        if (!f) { box.className = \'alert err\'; box.textContent = \'Elige un video primero.\'; return; }\n        fd.append(\'videoFile\', f);\n      }\n\n      btn.disabled = true;\n      btn.textContent = \'Creando sticker...\';\n      try {\n        var r = await fetch(\'/api/create-sticker\', { method: \'POST\', body: fd });\n        var d = await r.json();\n        if (d.ok) {\n          box.className = \'alert ok\';\n          box.textContent = d.message;\n        } else {\n          box.className = \'alert err\';\n          box.textContent = d.error;\n        }\n      } catch (e) {\n        box.className = \'alert err\';\n        box.textContent = \'Error de conexión.\';\n      } finally {\n        btn.disabled = false;\n        btn.textContent = \'Crear y Enviar a mi Chat\';\n      }\n    }\n  </script>\n</body>\n</html>';

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(HTML_PAGE);
});

const upload = multer({ dest: UPLOADS_DIR });

let sock = null;
let waState = {
  status: 'starting',
  qrDataUrl: null,
  pairingCode: null,
  phone: null,
  wid: null,
  message: 'Conectando motor ligero de WhatsApp...'
};

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

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve(stdout);
    });
  });
}

async function downloadTikTok(tiktokUrl, outputPath) {
  const res = await fetch('https://www.tikwm.com/api/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0'
    },
    body: new URLSearchParams({ url: tiktokUrl, hd: '1' })
  });
  const data = await res.json();
  if (!data || data.code !== 0 || !data.data || !data.data.play) {
    throw new Error('No se pudo bajar el video de TikTok. Verifica que sea público.');
  }
  const videoRes = await fetch(data.data.play);
  if (!videoRes.ok) throw new Error('Error descargando el video de TikTok.');
  const arrayBuffer = await videoRes.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
}

function embedAudioInWebp(webpPath, oggPath, finalWebpPath) {
  const webpBuf = fs.readFileSync(webpPath);
  const audioBuf = fs.readFileSync(oggPath);
  if (webpBuf.toString('ascii', 0, 4) !== 'RIFF' || webpBuf.toString('ascii', 8, 12) !== 'WEBP') {
    fs.copyFileSync(webpPath, finalWebpPath);
    return;
  }
  const chunkId = Buffer.from('AUDI', 'ascii');
  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32LE(audioBuf.length, 0);
  const needsPad = audioBuf.length % 2 === 1;
  const parts = [webpBuf, chunkId, chunkSize, audioBuf];
  if (needsPad) parts.push(Buffer.from([0x00]));
  const combined = Buffer.concat(parts);
  combined.writeUInt32LE(combined.length - 8, 4);
  fs.writeFileSync(finalWebpPath, combined);
}

app.post('/api/create-sticker', upload.single('videoFile'), async (req, res) => {
  const filesToClean = [];
  try {
    if (waState.status !== 'ready' || !waState.wid || !sock) {
      return res.status(400).json({ ok: false, error: 'Primero vincula tu WhatsApp en el Paso 1.' });
    }

    const { tiktokUrl, startTime = '0', fitMode = 'crop' } = req.body;
    const startSec = Math.max(0, parseFloat(startTime) || 0);
    const id = Date.now().toString();

    const rawInputPath = path.join(TEMP_DIR, `raw_${id}.mp4`);
    const clipMp4Path = path.join(TEMP_DIR, `sticker_${id}.mp4`);
    const rawWebpPath = path.join(TEMP_DIR, `raw_${id}.webp`);
    const oggAudioPath = path.join(TEMP_DIR, `audio_${id}.ogg`);
    const finalWebpPath = path.join(TEMP_DIR, `final_${id}.webp`);

    filesToClean.push(rawInputPath, rawWebpPath, oggAudioPath, clipMp4Path, finalWebpPath);

    if (req.file) {
      filesToClean.push(req.file.path);
      fs.copyFileSync(req.file.path, rawInputPath);
    } else if (tiktokUrl && tiktokUrl.trim()) {
      await downloadTikTok(tiktokUrl.trim(), rawInputPath);
    } else {
      return res.status(400).json({ ok: false, error: 'Pega un link de TikTok o elige un video.' });
    }

    const scaleFilter = fitMode === 'pad'
      ? 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black'
      : 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512';

    await runFfmpeg([
      '-y', '-ss', String(startSec), '-t', '5', '-i', rawInputPath,
      '-vf', `${scaleFilter},fps=15`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '96k', clipMp4Path
    ]);

    await runFfmpeg([
      '-y', '-i', clipMp4Path,
      '-vcodec', 'libwebp', '-filter:v', 'fps=fps=15',
      '-lossless', '0', '-compression_level', '4', '-q:v', '55',
      '-loop', '0', '-preset', 'default', '-an', '-vsync', '0', rawWebpPath
    ]);

    let hasAudio = true;
    try {
      await runFfmpeg([
        '-y', '-i', clipMp4Path, '-vn',
        '-c:a', 'libopus', '-b:a', '32k', '-ar', '48000', '-ac', '1', oggAudioPath
      ]);
    } catch (e) {
      hasAudio = false;
    }

    if (hasAudio && fs.existsSync(oggAudioPath)) {
      embedAudioInWebp(rawWebpPath, oggAudioPath, finalWebpPath);
    } else {
      fs.copyFileSync(rawWebpPath, finalWebpPath);
    }

    await sock.sendMessage(waState.wid, {
      sticker: fs.readFileSync(finalWebpPath)
    });

    res.json({
      ok: true,
      message: '¡Listo! Revisa tu chat privado ("Tú") en WhatsApp y guarda el sticker en Favoritos.'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Error procesando el sticker.' });
  } finally {
    for (const f of filesToClean) {
      if (f && fs.existsSync(f)) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
