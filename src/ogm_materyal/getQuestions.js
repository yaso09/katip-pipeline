const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Ayarlar
const START_ID = 1;
const BATCH_SIZE = 20;
const DELAY_MS = 2000;

// URL
const BASE_URL = "https://ogmmateryal.eba.gov.tr/soru-bankasi/test-yazdir?id=";

// Dosyalar
const DATA_FILE = path.join(__dirname, "data", "sorular.json");
const PROGRESS_FILE = path.join(__dirname, "data", "progress.json");
const LOG_FILE = path.join(__dirname, "data", "logs.json");

// klasör oluştur
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// delay
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// progress yükle
function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return {
      lastSuccessId: 0,
      savedIds: [],
      failedIds: [],
      notFoundId: null
    };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
}

// progress kaydet
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// data yükle
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

// data kaydet
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// log yükle
function loadLogs() {
  if (!fs.existsSync(LOG_FILE)) return {};
  return JSON.parse(fs.readFileSync(LOG_FILE, "utf-8"));
}

// log kaydet
function saveLogs(logs) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// curl ile HTML çek
function fetchHTMLCurl(id) {
  try {
    const cmd = `curl -s -A "curl/7.88.1" "${BASE_URL + id}"`;
    const html = execSync(cmd, { timeout: 15000 }).toString();
    return html;
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
    const html = fetchHTMLCurl(id);
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
  let progress = loadProgress();
  let data = loadData();
  let logs = loadLogs();
  let currentId = progress.lastSuccessId + 1;

  while (true) {
    // eski failedId'leri tekrar dene
    let retryIds = [...progress.failedIds];
    progress.failedIds = [];
    saveProgress(progress);

    if (retryIds.length > 0) {
      console.log(`\n♻️  Eski başarısız ID’leri tekrar deniyoruz: ${retryIds.join(", ")}`);
      for (const id of retryIds) {
        if (progress.savedIds.includes(id)) continue;

        const result = await fetchWithRetry(id, 3, logs);

        if (result === "NOT_FOUND") {
          console.log("🛑 404 bulundu, durduruluyor.");
          progress.notFoundId = id;
          saveProgress(progress);
          saveLogs(logs);
          return;
        }

        if (result === "FAILED") {
          console.log(`⚠️ Yine başarısız: ${id}`);
          progress.failedIds.push(id);
        } else {
          console.log(`✅ Kaydedildi: ${id}`);
          data.push(result);
          progress.savedIds.push(id);
          progress.lastSuccessId = id;
        }

        saveData(data);
        saveProgress(progress);
        saveLogs(logs);
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
        saveProgress(progress);
        saveLogs(logs);
        return;
      }

      if (result === "FAILED") {
        console.log(`⚠️ Başarısız: ${id}`);
        progress.failedIds.push(id);
      } else {
        console.log(`✅ Kaydedildi: ${id}`);
        data.push(result);
        progress.savedIds.push(id);
        progress.lastSuccessId = id;
      }

      saveData(data);
      saveProgress(progress);
      saveLogs(logs);
      await delay(DELAY_MS);
    }

    currentId += BATCH_SIZE;
  }
}

module.exports = { getQuestions };