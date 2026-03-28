const fs = require("fs");
const path = require("path");
const axios = require("axios");

// .env dosyasını yükle
const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

// Ayarlar
const START_ID = 1;
const BATCH_SIZE = 20;
const DELAY_MS = 2000;

// URL
const BASE_URL = "https://ogmmateryal.eba.gov.tr/soru-bankasi/test-yazdir?id=";

// Veri yolu tanımları (Log vb. yerel fallback kaldırıldı, sadece GitHub kullanılıyor)
const PROGRESS_FILE_PATH = "ogm_materyal/progress.json";
const DATA_FILE_PATH = "ogm_materyal/sorular.json";
const LOG_FILE_PATH = "ogm_materyal/logs.json";

const fileShas = {
  data: null,
  progress: null,
  logs: null
};

const logHistory = [];
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  const msg = args.join(" ");
  logHistory.unshift({ time: new Date().toLocaleTimeString('tr-TR'), msg, type: 'info' });
  if (logHistory.length > 50) logHistory.pop();
  originalLog.apply(console, args);
};

console.error = function(...args) {
  const msg = args.join(" ");
  logHistory.unshift({ time: new Date().toLocaleTimeString('tr-TR'), msg, type: 'error' });
  if (logHistory.length > 50) logHistory.pop();
  originalError.apply(console, args);
};

let isRunning = false;
let statusObj = {
  active: false,
  message: "Sistem kapalı. Başlatılması bekleniyor.",
  lastId: 0,
  savedCount: 0,
  failedCount: 0,
  retryQueueLength: 0
};

// delay
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// progress yükle
async function loadProgress() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    console.error("❌ GITHUB_TOKEN veya GITHUB_REPO eksik! GitHub senkronizasyonu yapılamıyor.");
    return { lastSuccessId: 0, savedIds: [], failedIds: [], notFoundId: null };
  }

  const url = `https://api.github.com/repos/${repo}/contents/${PROGRESS_FILE_PATH}`;
  try {
    const res = await axios.get(url, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "katip-pipeline" }
    });
    if (res.status === 200) {
      const json = res.data;
      fileShas.progress = json.sha;
      return JSON.parse(Buffer.from(json.content, "base64").toString("utf-8"));
    }
  } catch (err) {}
  
  return { lastSuccessId: 0, savedIds: [], failedIds: [], notFoundId: null };
}

// progress kaydet
async function saveProgress(progress, message = "Progress güncellendi") {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) return;

  const url = `https://api.github.com/repos/${repo}/contents/${PROGRESS_FILE_PATH}`;
  const body = {
    message: message,
    content: Buffer.from(JSON.stringify(progress, null, 2)).toString("base64")
  };
  if (fileShas.progress) body.sha = fileShas.progress;

  try {
    const putRes = await axios.put(url, body, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "katip-pipeline" }
    });
    if (putRes.status === 200 || putRes.status === 201) {
      fileShas.progress = putRes.data.content.sha;
    }
  } catch (err) {
    if (err.response && err.response.status === 409) {
      console.log(`⚠️ (Progress) 409 Conflict tetiklendi. Ağdaki gecikmelerden dolayı SHA uyuşmazlığı oldu. Yeni SHA alınıyor...`);
      try {
        const getRes = await axios.get(url + `?t=${Date.now()}`, {
          headers: { "Authorization": `token ${token}`, "User-Agent": "katip-pipeline", "Cache-Control": "no-store" }
        });
        if (getRes.status === 200) fileShas.progress = getRes.data.sha;
      } catch (e) {}
    }
  }
}

// data yükle
async function loadData() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) return [];

  const url = `https://api.github.com/repos/${repo}/contents/${DATA_FILE_PATH}`;
  try {
    const res = await axios.get(url, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "katip-pipeline" }
    });
    if (res.status === 200) {
      const json = res.data;
      fileShas.data = json.sha;
      return JSON.parse(Buffer.from(json.content, "base64").toString("utf-8"));
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      console.error("⚠️ GitHub'dan veri alınamadı:", err.response.data);
    } else if (!err.response) {
      console.error("⚠️ GitHub isteği başarısız oldu:", err.message);
    }
  }
  return [];
}

// data kaydet
async function saveData(data, message = "Sorular güncellendi") {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) return;

  const url = `https://api.github.com/repos/${repo}/contents/${DATA_FILE_PATH}`;
  const body = {
    message: message,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString("base64")
  };
  if (fileShas.data) body.sha = fileShas.data;

  try {
    const putRes = await axios.put(url, body, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "katip-pipeline" }
    });
    
    if (putRes.status === 200 || putRes.status === 201) {
      fileShas.data = putRes.data.content.sha;
    }
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      console.error(`❌ Soruları GitHub'a kaydederken hata (${status}):`, err.response.data);
      if (status === 409) {
        console.log(`⚠️ (Data) 409 Conflict tetiklendi. Yeni SHA alınıyor...`);
        try {
          const getRes = await axios.get(url + `?t=${Date.now()}`, {
            headers: { "Authorization": `token ${token}`, "User-Agent": "katip-pipeline", "Cache-Control": "no-store" }
          });
          if (getRes.status === 200) fileShas.data = getRes.data.sha;
        } catch (e) {}
      }
    } else {
      console.error("❌ GitHub API isteği başarısız oldu:", err.message);
    }
  }
}

// log yükle
async function loadLogs() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) return {};

  const url = `https://api.github.com/repos/${repo}/contents/${LOG_FILE_PATH}`;
  try {
    const res = await axios.get(url, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "User-Agent": "katip-pipeline" }
    });
    if (res.status === 200) {
      const json = res.data;
      fileShas.logs = json.sha;
      return JSON.parse(Buffer.from(json.content, "base64").toString("utf-8"));
    }
  } catch (err) {}
  
  return {};
}

// log kaydet
async function saveLogs(logs, message = "Logs güncellendi") {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) return;

  const url = `https://api.github.com/repos/${repo}/contents/${LOG_FILE_PATH}`;
  const body = {
    message: message,
    content: Buffer.from(JSON.stringify(logs, null, 2)).toString("base64")
  };
  if (fileShas.logs) body.sha = fileShas.logs;

  try {
    const putRes = await axios.put(url, body, {
      headers: { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json", "User-Agent": "katip-pipeline" }
    });
    if (putRes.status === 200 || putRes.status === 201) {
      fileShas.logs = putRes.data.content.sha;
    }
  } catch (err) {
    if (err.response && err.response.status === 409) {
      try {
        const getRes = await axios.get(url + `?t=${Date.now()}`, {
          headers: { "Authorization": `token ${token}`, "User-Agent": "katip-pipeline", "Cache-Control": "no-store" }
        });
        if (getRes.status === 200) fileShas.logs = getRes.data.sha;
      } catch (e) {}
    }
  }
}

// axios ile HTML çek
async function fetchHTML(id) {
  try {
    const res = await axios.get(BASE_URL + id, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36)" },
      timeout: 15000
    });
    return res.data;
  } catch (err) {
    return err.message || null;
  }
}

function parseQuestion(html, id) {
  const log = { id, timestamp: new Date().toISOString(), steps: [] };

  const step = (name, result, detail = "") => {
    log.steps.push({ step: name, result: result ? "✅" : "❌", detail: String(detail).slice(0, 300) });
  };

  if (!html || html.trim() === "") {
    step("html_check", false, "HTML boş");
    return { status: "NOT_FOUND", log };
  }
  step("html_check", true, `HTML uzunluğu: ${html.length} karakter`);

  if (html.includes("404")) {
    step("404_check", false, "Sayfa bulunamadı (404)");
    return { status: "NOT_FOUND", log };
  }
  step("404_check", true, "404 yok");

  // --- SORU ---
  const questionMatch = html.match(
    /<p class="question-item-ask">([\s\S]*?)(?=<div class="form-check">)/
  );
  if (!questionMatch) {
    step("soru_regex", false, "question-item-ask bloğu bulunamadı");
  } else {
    step("soru_regex", true, `Ham eşleşme uzunluğu: ${questionMatch[1].length}`);
  }

  const question = questionMatch
    ? questionMatch[1].replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim()
    : null;
  step("soru_temizle", !!question, question ? `"${question.slice(0, 150)}..."` : "null");

  // --- ŞIKLAR ---
  const rawChoiceBlocks = html.match(/<div class="form-check">[\s\S]*?<\/div>\s*<\/div>/g) || [];
  step("ham_sik_blok", rawChoiceBlocks.length > 0, `${rawChoiceBlocks.length} adet form-check bloğu bulundu`);

  const choices = [];
  const choiceRegex = /<div class="d-flex">([\s\S]*?)<\/div>/g;
  let m;
  let rawChoiceLog = [];
  while ((m = choiceRegex.exec(html)) !== null) {
    const raw = m[1];
    const cleaned = raw
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&[a-z]+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    rawChoiceLog.push({ raw: raw.slice(0, 80), cleaned });
    if (cleaned.match(/^[A-E]\)/)) choices.push(cleaned);
  }
  step("sik_regex_ham", rawChoiceLog.length > 0, `Toplam eşleşme: ${rawChoiceLog.length} → ${JSON.stringify(rawChoiceLog.slice(0, 2))}`);
  step("sik_filtrele", choices.length > 0, `Geçerli şık sayısı: ${choices.length} → ${JSON.stringify(choices)}`);

  // --- CEVAP ---
  const answerMatch = html.match(/<span>\s*\d+\s*-\s*([A-E])/);
  const answer = answerMatch ? answerMatch[1] : null;
  step("cevap_regex", !!answer, answer ? `Cevap: ${answer}` : "Cevap bulunamadı");

  // --- SONUÇ ---
  const success = !!question && choices.length > 0;
  log.result = success ? "OK" : "FAILED";
  log.missing = [
    !question && "soru",
    choices.length === 0 && "şıklar",
    !answer && "cevap",
  ].filter(Boolean);

  if (!success) {
    console.log(`❌ ID ${id} FAILED — Eksik: ${log.missing.join(", ")}`);
    log.steps.forEach(s => console.log(`   ${s.result} [${s.step}] ${s.detail}`));
    return { status: "FAILED", log };
  }

  console.log(`✅ ID ${id} OK`);
  return { status: "OK", data: { id, question, choices, answer }, log };
}

// retry mantığı
async function fetchWithRetry(id, retries = 3, logs) {
  for (let i = 0; i < retries; i++) {
    const html = await fetchHTML(id);
    const parsed = parseQuestion(html, id);

    // Her denemede logu kaydet
    if (!logs[id]) logs[id] = [];
    logs[id].push({ attempt: i + 1, ...parsed.log });

    if (parsed.status === "NOT_FOUND") return "NOT_FOUND";
    if (parsed.status === "OK") return parsed.data;

    console.log(`🔁 Retry ${i + 1} for ID ${id} — Eksik: ${parsed.log.missing?.join(", ")}`);
    await delay(1000);
  }
  return "FAILED";
}

// ana fonksiyon
async function getQuestions() {
  statusObj.message = "Veriler GitHub'dan güvenle çekiliyor...";
  let progress = await loadProgress();
  let data = await loadData();
  let logs = await loadLogs();
  let currentId = progress.lastSuccessId + 1;
  
  statusObj.savedCount = progress.savedIds.length;
  statusObj.failedCount = progress.failedIds.length;
  statusObj.lastId = progress.lastSuccessId;

  while (isRunning) {
    statusObj.message = "Veri işleme döngüsü çalışıyor...";
    // eski failedId'leri tekrar dene
    let retryIds = [...progress.failedIds];
    progress.failedIds = [];
    statusObj.retryQueueLength = retryIds.length;
    
    await saveProgress(progress, `Retry batch öncesi progress temizliği`);

    if (retryIds.length > 0) {
      console.log(`\n♻️  Eski başarısız ID’leri tekrar deniyoruz: ${retryIds.join(", ")}`);
      for (const id of retryIds) {
        if (progress.savedIds.includes(id)) continue;

        const result = await fetchWithRetry(id, 3, logs);

        if (result === "NOT_FOUND") {
          console.log("🛑 404 bulundu, durduruluyor.");
          progress.notFoundId = id;
          await Promise.all([
            saveProgress(progress, `ID ${id} (404) işlendi`),
            saveLogs(logs, `ID ${id} (404) logları eklendi`)
          ]);
          return;
        }

        if (result === "FAILED") {
          console.log(`⚠️ Yine başarısız: ${id}`);
          progress.failedIds.push(id);
          statusObj.failedCount++;
        } else {
          console.log(`✅ Kaydedildi: ${id}`);
          data.push(result);
          progress.savedIds.push(id);
          progress.lastSuccessId = id;
          statusObj.savedCount++;
          statusObj.lastId = id;
        }

        await Promise.all([
          saveData(data, `Soru ID ${id} eklendi`),
          saveProgress(progress, `Soru ID ${id} işlendi`),
          saveLogs(logs, `Soru ID ${id} logları eklendi`)
        ]);
        await delay(DELAY_MS);
      }
    }

    // yeni batch
    console.log(`\n🚀 Yeni batch: ${currentId} - ${currentId + BATCH_SIZE - 1}`);
    for (let i = 0; i < BATCH_SIZE; i++) {
      const id = currentId + i;
      if (progress.savedIds.includes(id)) continue;

      const result = await fetchWithRetry(id, 3, logs);

      if (result === "NOT_FOUND") {
        console.log("🛑 404 bulundu, durduruluyor.");
        progress.notFoundId = id;
        await Promise.all([
          saveProgress(progress, `ID ${id} (404) işlendi`),
          saveLogs(logs, `ID ${id} (404) logları eklendi`)
        ]);
        return;
      }

      if (result === "FAILED") {
        console.log(`⚠️ Başarısız: ${id}`);
        progress.failedIds.push(id);
        statusObj.failedCount++;
      } else {
        console.log(`✅ Kaydedildi: ${id}`);
        data.push(result);
        progress.savedIds.push(id);
        progress.lastSuccessId = id;
        statusObj.savedCount++;
        statusObj.lastId = id;
      }

      await Promise.all([
        saveData(data, `Soru ID ${id} eklendi`),
        saveProgress(progress, `Soru ID ${id} işlendi`),
        saveLogs(logs, `Soru ID ${id} logları eklendi`)
      ]);
      await delay(DELAY_MS);
    }

    currentId += BATCH_SIZE;
  }
}

async function startPipeline() {
  if (isRunning) return;
  isRunning = true;
  statusObj.active = true;
  statusObj.message = "Başlatılıyor...";
  try {
    await getQuestions();
  } catch (err) {
    statusObj.message = "Hata oluştu: " + err.message;
  }
  isRunning = false;
  statusObj.active = false;
  if (statusObj.message !== "Durduruldu") statusObj.message = "Sistem durdu";
}

function stopPipeline() {
  isRunning = false;
  statusObj.message = "Durduruluyor... (Mevcut işlem bittiğinde tamamen duracak)";
}

function getPipelineStatus() {
  return {
    ...statusObj,
    logHistory,
    fileShas
  };
}

module.exports = { getQuestions, startPipeline, stopPipeline, getPipelineStatus };