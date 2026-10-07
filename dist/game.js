const screens = new Map(
  [...document.querySelectorAll("[data-screen]")].map((screen) => [screen.dataset.screen, screen]),
);
const ANCHORS = ["jade_flute", "golden_crane"];
const SITE_TERMS = ["黄鹤", "江城", "长江", "江水", "长桥", "江风", "云楼"];
const DEFAULT_KEYWORDS = ["江风", "黄鹤", "长桥", "白云", "笛声", "远帆"];
const characters = {
  libai: { title: "李白", description: "主题：黄鹤楼诗旅。乘幻想御笔，听玉笛、寻黄鹤，与这位 AI 演绎的故人共题新诗。李白路线现可体验。" },
  quyuan: { title: "屈原 · 筹备中", description: "主题：江滩楚风；载具：龙舟。角色卡已展示，剧情与互动将在后续补充。" },
  boya_ziqi: { title: "伯牙与钟子期 · 筹备中", description: "主题：古琴台知音；载具：琴舟。角色卡已展示，剧情与互动将在后续补充。" },
  zhangzhidong: { title: "张之洞 · 筹备中", description: "主题：汉阳工业；载具：蒸汽火车。角色卡已展示，剧情与互动将在后续补充。" },
};
const stories = {
  jade_flute: {
    type: "诗文 · 玉笛",
    title: "玉笛声里，江城五月",
    dialogue: "“黄鹤楼中吹玉笛，江城五月落梅花。”后生，这“梅花”借的是《梅花落》的曲意，也寄着迁客的愁怀。眼前这支玉笛，是今日为你我设下的诗境道具；江风仍在，旧愁已远。你愿把怎样的心绪寄给这江水？",
    note: "诗句与诗境道具分开呈现，玉笛不作为历史文物实录。",
    source: "诗句：李白《与史郎中钦听黄鹤楼上吹笛》。笛曲《梅花落》为诗中“落梅花”的曲意来源；此处画面与对白为游戏演绎。",
  },
  golden_crane: {
    type: "典故 · 黄鹤",
    title: "昔人乘鹤去，后世架长虹",
    dialogue: "“昔人已乘黄鹤去，此地空余黄鹤楼。”这是崔颢的诗。乘鹤仙踪有不同传说，今日这只金鹤则是为你我点亮的幻想。你看江面上那道跨江长虹，后世巧匠的手段，也可入诗！",
    note: "金鹤是幻想设计；乘鹤仙踪以传说而非史实呈现。",
    source: "诗句：崔颢《黄鹤楼》。乘鹤故事存在不同传说版本；画面中的金鹤及李白对白为游戏演绎。",
  },
};
const state = {
  screen: "intro",
  selectedCharacterId: null,
  activeAnchorId: null,
  explored: new Set(),
  keywords: [],
  generationCount: 0,
  acceptedPoem: null,
  memoryId: "",
  memoryHash: "",
  mapFlightTimer: null,
  mapFlying: false,
};

const bgMusic = document.querySelector("[data-bg-music]");
const MUSIC_STORAGE_KEY = "jiangcheng-guren-music-enabled";
let musicEnabled = true;
try {
  musicEnabled = localStorage.getItem(MUSIC_STORAGE_KEY) !== "off";
} catch {}
bgMusic.volume = 0.35;

function syncMusicButton() {
  const button = document.querySelector("[data-action='toggle-music']");
  if (!button) return;
  button.setAttribute("aria-pressed", String(musicEnabled));
  button.classList.toggle("is-muted", !musicEnabled);
  document.querySelector("[data-music-icon]").textContent = musicEnabled ? "♫" : "×";
  document.querySelector("[data-music-label]").textContent = musicEnabled ? "音乐开启" : "音乐关闭";
}

function ensureMusicPlaying() {
  if (!musicEnabled || !bgMusic.paused) return;
  bgMusic.play().catch(() => {});
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  try { localStorage.setItem(MUSIC_STORAGE_KEY, musicEnabled ? "on" : "off"); } catch {}
  if (musicEnabled) ensureMusicPlaying();
  else bgMusic.pause();
  syncMusicButton();
}

function showScreen(name) {
  if ((name === "poem" || name === "memory") && state.explored.size !== ANCHORS.length) return false;
  if (name !== "explore") {
    document.querySelectorAll("[data-anchor-dialog]").forEach((dialog) => {
      if (dialog.open) dialog.close();
    });
  }
  state.screen = name;
  screens.forEach((screen, key) => {
    screen.hidden = key !== name;
    screen.classList.toggle("screen--active", key === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
  return true;
}

function resetMapFlight() {
  clearTimeout(state.mapFlightTimer);
  state.mapFlying = false;
  document.querySelector("[data-screen='map']").classList.remove("is-flying");
  document.querySelector("[data-map-flight-gif]").hidden = true;
  document.querySelector("[data-map-flight-status]").hidden = true;
  document.querySelector("[data-action='enter-tower']").disabled = false;
}

function beginMapFlight() {
  if (state.screen !== "map" || state.mapFlying) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showScreen("explore");
    return;
  }
  state.mapFlying = true;
  document.querySelector("[data-screen='map']").classList.add("is-flying");
  document.querySelector("[data-action='enter-tower']").disabled = true;
  const previousGif = document.querySelector("[data-map-flight-gif]");
  const gif = previousGif.cloneNode();
  previousGif.replaceWith(gif);
  gif.hidden = false;
  document.querySelector("[data-map-flight-status]").hidden = false;
  state.mapFlightTimer = setTimeout(() => {
    if (state.screen === "map") showScreen("explore");
    resetMapFlight();
  }, 2800);
}

function selectCharacter(id, { launch = false } = {}) {
  const character = characters[id];
  if (!character) return;
  state.selectedCharacterId = id;
  document.querySelectorAll("[data-character]").forEach((button) => {
    const selected = button.dataset.character === id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  if (launch && id === "libai") showScreen("flight");
}

function updateExploreUI() {
  const count = state.explored.size;
  document.querySelector("[data-progress-count]").textContent = `${count} / 2`;
  document.querySelectorAll(".stamp-row i").forEach((stamp, index) => {
    stamp.classList.toggle("is-filled", index < count);
  });
  document.querySelectorAll("[data-anchor]").forEach((button) => {
    const id = button.dataset.anchor;
    button.classList.toggle("is-done", state.explored.has(id));
    button.classList.toggle("is-active", state.activeAnchorId === id);
    button.setAttribute("aria-pressed", String(state.activeAnchorId === id));
  });
  document.querySelector("[data-action='start-poem']").hidden = count !== ANCHORS.length;
}

function openStory(anchor) {
  if (state.screen !== "explore" || !stories[anchor]) return;
  state.activeAnchorId = anchor;
  const story = stories[anchor];
  updateExploreUI();
  const dialog = document.querySelector(anchor === "jade_flute" ? "[data-flute-dialog]" : "[data-crane-dialog]");
  if (dialog && !dialog.open) {
    dialog.querySelector("[data-journey-type]").textContent = story.type;
    dialog.querySelector("[data-journey-title]").textContent = story.title;
    dialog.querySelector("[data-journey-dialogue]").textContent = story.dialogue;
    dialog.querySelector("[data-journey-note]").textContent = story.note;
    dialog.querySelector("[data-journey-source]").textContent = story.source;
    dialog.querySelector(".journey-source").open = false;
    dialog.querySelector(".journey-ack").hidden = state.explored.has(anchor);
    const animation = dialog.querySelector("img");
    animation.src = animation.src;
    dialog.showModal();
  }
}

function acknowledgeAnchor() {
  const anchor = state.activeAnchorId;
  if (!anchor || !stories[anchor] || state.explored.has(anchor)) return;
  state.explored.add(anchor);
  state.activeAnchorId = null;
  document.querySelectorAll("[data-anchor-dialog]").forEach((dialog) => { if (dialog.open) dialog.close(); });
  updateExploreUI();
}

function cleanKeyword(value) {
  const cleaned = String(value || "").trim();
  return /^[\p{Script=Han}]{1,6}$/u.test(cleaned) ? cleaned : "";
}

function updateKeywordUI(message = "") {
  document.querySelectorAll(".keyword-chip").forEach((button) => {
    const selected = state.keywords.includes(button.dataset.keyword);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelector("[data-keyword-hint]").textContent = message ||
    (state.keywords.length ? `已选择：${state.keywords.join("、")}（还可选择 ${Math.max(0, 3 - state.keywords.length)} 项）` : "请选择 2 至 3 个意象");
}

function toggleKeyword(keyword) {
  if (state.keywords.includes(keyword)) {
    state.keywords = state.keywords.filter((item) => item !== keyword);
  } else if (state.keywords.length < 3) {
    state.keywords.push(keyword);
  } else {
    updateKeywordUI("最多选择三个意象，请先取消一个再换选。");
    return;
  }
  updateKeywordUI();
}

const firstTails = {
  0: ["来", "起", "明"], 1: ["逐浪", "入画", "满袖"], 2: ["入江城", "过长桥", "映江水"],
  3: ["随江水去", "照长桥月", "过江城夜"], 4: ["吹过黄鹤楼", "照见长江月", "同上黄鹤楼"],
  5: ["映黄鹤楼春水", "照长江两岸春", "入江城万里风"],
};
const secondTails = {
  0: ["飞", "归", "长"], 1: ["随风", "逐云", "入诗"], 2: ["照长江", "落江城", "过云楼"],
  3: ["随江水去", "映长桥灯", "到云楼前"], 4: ["随风入江城", "遥照黄鹤楼", "轻拂长江水"],
  5: ["随一叶远帆去", "照江城万家灯", "入黄鹤楼前月"],
};
const thirdLines = ["黄鹤楼头月未央", "长桥横影入江流", "江城今夜月如舟"];
const fourthLines = ["与君同题此夜诗", "一笔同书故人游", "此心随鹤过云楼"];

function poemLinesFor(a, b, c, variant) {
  const first = a + firstTails[6 - a.length][variant];
  const second = b ? b + secondTails[6 - b.length][variant] : ["江风吹过长桥月", "江水遥连万里云", "黄鹤翩然入梦来"][variant];
  const third = c ? c + secondTails[6 - c.length][variant] : thirdLines[variant];
  return [first, second, third, fourthLines[variant]];
}

function validatePoem(lines) {
  if (lines.length !== 4 || lines.some((line) => !/^[\p{Script=Han}]{7}$/u.test(line))) {
    return "诗稿须为四句，每句恰好七个汉字，不含标点。";
  }
  const poem = lines.join("");
  if (state.keywords.some((word) => !poem.includes(word))) return "诗稿须完整包含已选的每个意象。";
  if (!SITE_TERMS.some((term) => poem.includes(term))) return "诗稿还需包含一处江城场景意象。";
  return "";
}

function generatePoem() {
  if (state.screen !== "poem") return;
  if (state.keywords.length < 2) {
    updateKeywordUI("请至少选择两个意象，太白才好落笔。");
    return;
  }
  if (state.generationCount >= 3) {
    showDraftError("演示诗稿最多生成三次；你仍可修改诗题或重新生成。");
    return;
  }
  const variant = state.generationCount;
  const [a, b, c] = state.keywords;
  const lines = poemLinesFor(a, b, c, variant);
  state.generationCount += 1;
  document.querySelector("#poem-name").value = `江城${a}小记`.slice(0, 12);
  document.querySelector("#poem-lines").value = lines.join("\n");
  document.querySelector("[data-draft-editor]").hidden = false;
  document.querySelector("[data-revision]").textContent = `第 ${state.generationCount} 稿 / 共 3 稿`;
  document.querySelector("[data-action='rewrite-poem']").disabled = state.generationCount >= 3;
  document.querySelector("[data-action='generate-poem']").disabled = state.generationCount >= 3;
  showDraftError("");
}

function showDraftError(message) {
  const error = document.querySelector("[data-draft-error]");
  error.textContent = message;
  error.hidden = !message;
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function buildMemory() {
  if (state.explored.size !== ANCHORS.length || state.generationCount === 0) return;
  const lines = document.querySelector("#poem-lines").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const error = validatePoem(lines);
  if (error) {
    showDraftError(error);
    document.querySelector("#poem-lines").focus();
    return;
  }
  const poemTitle = document.querySelector("#poem-name").value.trim() || "江城新句";
  state.acceptedPoem = { title: poemTitle, lines };
  state.memoryId = `JC-LB-DEMO-${Date.now().toString(36).toUpperCase()}`;
  const payload = {
    memoryId: state.memoryId, characterId: "libai", anchorIds: ANCHORS,
    title: poemTitle, lines, keywords: [...state.keywords], status: "local_demo_unregistered",
  };
  state.memoryHash = await sha256(JSON.stringify(payload));
  document.querySelector("[data-memory-poem-title]").textContent = poemTitle;
  document.querySelector("[data-memory-poem]").replaceChildren(...lines.map((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    return p;
  }));
  document.querySelector("[data-memory-keywords]").textContent = state.keywords.join("、");
  document.querySelector("[data-memory-id]").textContent = state.memoryId;
  document.querySelector("[data-memory-hash]").textContent = `${state.memoryHash.slice(0, 12)}…${state.memoryHash.slice(-8)}`;
  showScreen("memory");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = "";
  let count = 0;
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + count * lineHeight);
      count += 1;
      if (count >= maxLines) return;
      line = char;
    } else {
      line = next;
    }
  }
  if (line && count < maxLines) ctx.fillText(line, x, y + count * lineHeight);
}

async function downloadCard() {
  if (!state.acceptedPoem || state.screen !== "memory") return;
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  const background = await loadImage("./assets/memory-settlement.png");
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#9c3f35";
  ctx.font = "700 27px system-ui";
  ctx.fillText("江城故人 · 李白篇", 965, 140);
  ctx.fillStyle = "#17383b";
  ctx.font = "700 58px 'Songti SC', serif";
  ctx.fillText("黄鹤楼同游诗旅记忆", 965, 222);
  ctx.font = "30px 'Songti SC', serif";
  ctx.fillText(state.acceptedPoem.title.slice(0, 12), 968, 280);
  ctx.font = "38px 'Songti SC', serif";
  state.acceptedPoem.lines.forEach((line, index) => ctx.fillText(line, 968, 360 + index * 65));
  ctx.fillStyle = "#365c61";
  ctx.font = "24px system-ui";
  ctx.fillText(`今日意象：${state.keywords.join("、")}`, 968, 690);
  ctx.fillText("同行记忆：玉笛、黄鹤", 968, 730);
  const note = document.querySelector("#player-note").value.trim();
  if (note) {
    ctx.fillStyle = "#ad3127";
    ctx.font = "700 27px system-ui";
    wrapText(ctx, `我的留言：${note}`, 968, 784, 780, 32, 2);
    ctx.fillStyle = "#365c61";
  }
  ctx.font = "19px system-ui";
  ctx.fillText("同游寄语：江风作伴，今日新句留与君。", 968, 865);
  ctx.fillText(`记忆编号：${state.memoryId}`, 968, 918);
  ctx.fillStyle = "#8b5e50";
  ctx.font = "700 20px system-ui";
  ctx.fillText("演示回执 · 未登记 BOT Chain", 968, 970);
  const link = document.createElement("a");
  link.download = `${state.memoryId}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetJourney() {
  resetMapFlight();
  state.activeAnchorId = null;
  state.explored.clear();
  state.keywords = [];
  state.generationCount = 0;
  state.acceptedPoem = null;
  state.memoryId = "";
  state.memoryHash = "";
  document.querySelector("[data-draft-editor]").hidden = true;
  document.querySelector("#poem-lines").value = "";
  document.querySelector("#player-note").value = "";
  document.querySelector("[data-memory-note]").textContent = "尚未填写";
  document.querySelector("[data-action='generate-poem']").disabled = false;
  document.querySelector("[data-action='rewrite-poem']").disabled = false;
  document.querySelectorAll(".keyword-chip[data-keyword]").forEach((button) => {
    if (!DEFAULT_KEYWORDS.includes(button.dataset.keyword)) button.remove();
  });
  selectCharacter("libai");
  updateKeywordUI();
  updateExploreUI();
  showScreen("select");
}

document.addEventListener("click", async (event) => {
  if (!event.target.closest("[data-action='toggle-music']")) ensureMusicPlaying();
  const character = event.target.closest("[data-character]")?.dataset.character;
  if (character) { selectCharacter(character, { launch: character === "libai" }); return; }
  const anchor = event.target.closest("[data-anchor]")?.dataset.anchor;
  if (anchor) { openStory(anchor); return; }
  const keyword = event.target.closest(".keyword-chip")?.dataset.keyword;
  if (keyword) { toggleKeyword(keyword); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "toggle-music") { toggleMusic(); return; }
  if (action === "enter") showScreen("select");
  if (action === "back-select") showScreen("select");
  if (action === "arrive-map") showScreen("map");
  if (action === "enter-tower") beginMapFlight();
  if (action === "close-anchor-dialog") event.target.closest("dialog")?.close();
  if (action === "ack-anchor") acknowledgeAnchor();
  if (action === "start-poem") showScreen("poem");
  if (action === "back-explore") showScreen("explore");
  if (action === "generate-poem" || action === "rewrite-poem") generatePoem();
  if (action === "adopt-poem") await buildMemory();
  if (action === "download-card") await downloadCard();
  if (action === "restart") resetJourney();
});
document.querySelector("#player-note").addEventListener("input", (event) => {
  const note = event.target.value.trim();
  document.querySelector("[data-memory-note]").textContent = note || "尚未填写";
});

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const report = (error) => console.warn("WebMCP registration failed", error);
  const tools = [
    {
      name: "get_li_bai_journey_state", title: "读取李白旅程状态",
      description: "读取画面、两处已确认的诗境、意象和本地记忆编号，不改变状态。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() { return { screen: state.screen, exploredAnchors: [...state.explored], keywords: [...state.keywords], memoryId: state.memoryId || null }; },
    },
    {
      name: "start_li_bai_journey", title: "开始李白旅程",
      description: "选择李白并打开御笔飞行画面。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() { selectCharacter("libai"); showScreen("flight"); return { screen: state.screen, characterId: "libai" }; },
    },
    {
      name: "stage_poem_keywords", title: "设置共题诗意象",
      description: "仅在玉笛、黄鹤两处都完成后，收进二至三个意象并打开题诗画面。",
      inputSchema: {
        type: "object",
        properties: { keywords: { type: "array", minItems: 2, maxItems: 3, items: { type: "string", minLength: 1, maxLength: 6 } } },
        required: ["keywords"], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (state.explored.size !== ANCHORS.length) throw new Error("请先确认玉笛和黄鹤两处剧情。");
        if (!Array.isArray(input?.keywords) || input.keywords.length < 2 || input.keywords.length > 3) throw new TypeError("keywords 须为二至三个意象");
        const next = input.keywords.map(cleanKeyword);
        if (next.some((word) => !DEFAULT_KEYWORDS.includes(word)) || new Set(next).size !== next.length) throw new TypeError("意象须从页面提供的选项中选择，且不能重复");
        state.keywords = next;
        updateKeywordUI();
        showScreen("poem");
        return { screen: state.screen, keywords: [...state.keywords] };
      },
    },
  ];
  tools.forEach((tool) => { try { Promise.resolve(context.registerTool(tool)).catch(report); } catch (error) { report(error); } });
}

updateExploreUI();
updateKeywordUI();
syncMusicButton();
registerWebMcpTools();
