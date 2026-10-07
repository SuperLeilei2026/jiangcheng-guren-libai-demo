const screens = new Map(
  [...document.querySelectorAll("[data-screen]")].map((screen) => [screen.dataset.screen, screen]),
);

const state = {
  screen: "intro",
  explored: new Set(),
  keywords: [],
  revision: 0,
  memoryId: "",
  memoryHash: "",
};

const stories = {
  flute: {
    type: "诗文 · 听笛",
    title: "玉笛声里，五月如飞雪",
    dialogue:
      "“黄鹤楼中吹玉笛，江城五月落梅花。”乾元二年途中，我曾把笛声与《梅花落》写进诗里。如今江水仍向东去，旧愁却不必替谁停住脚步。",
    note: "诗句出自李白《与史郎中钦听黄鹤楼上吹笛》；梅花意象与笛曲相关，不作为五月物候结论。",
  },
  crane: {
    type: "传说 · 黄鹤",
    title: "昔人乘鹤去，后世架长虹",
    dialogue:
      "崔颢诗里写“昔人已乘黄鹤去”。仙人乘鹤是楼名传说，眼前跨江的长桥却是后世真切的巧思。古人的飞天想象，竟在今日有了另一种回声。",
    note: "黄鹤仙踪按传说呈现；现代桥梁以数字水墨舞台作诗意演绎。",
  },
  wall: {
    type: "典故 · 搁笔",
    title: "好景不只容得下一种写法",
    dialogue:
      "相传我见崔颢题诗，曾叹眼前有景却一时难写。故事归故事，好诗在前，先欣赏也无妨；换个角度，说出自己眼中的江风，同样是一种落笔。",
    note: "“搁笔”按流传典故讲述，不把舞台对白当作可核验的现场实录。今日黄鹤楼也不是唐代楼宇原物。",
  },
};

const poemVariants = [
  (a, b) => [`${a}入梦到江城`, `${b}照水过晴川`, "玉笛一声梅似雪", "同题新句寄流年"],
  (a, b, c) => ["黄鹤衔云过楚天", `${a}随风落酒船`, `${b}携我上层楼`, c ? `${c}化作满江秋` : "一笔横江写少年"],
  (a, b) => [`${a}轻拂鹤楼前`, `${b}遥连天际帆`, "今人不必争诗句", "且把此心付月圆"],
];

function showScreen(name) {
  state.screen = name;
  screens.forEach((screen, key) => {
    screen.hidden = key !== name;
    screen.classList.toggle("screen--active", key === name);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateExploreUI() {
  const count = state.explored.size;
  document.querySelector("[data-progress-count]").textContent = `${count} / 3`;
  document.querySelectorAll(".stamp-row i").forEach((stamp, index) => {
    stamp.classList.toggle("is-filled", index < count);
  });
  document.querySelectorAll("[data-anchor]").forEach((button) => {
    const done = state.explored.has(button.dataset.anchor);
    button.classList.toggle("is-done", done);
    button.setAttribute("aria-pressed", String(done));
  });
  document.querySelector("[data-action='start-poem']").hidden = count !== 3;
}

function openStory(anchor) {
  const story = stories[anchor];
  if (!story) return;
  state.explored.add(anchor);
  document.querySelector("[data-story-type]").textContent = story.type;
  document.querySelector("[data-story-title]").textContent = story.title;
  document.querySelector("[data-story-dialogue]").textContent = story.dialogue;
  document.querySelector("[data-story-note]").textContent = story.note;
  updateExploreUI();
}

function cleanKeyword(value) {
  const cleaned = String(value || "").replace(/[\s，,。！？!?.、]/g, "").slice(0, 2);
  if (!cleaned) return "";
  return cleaned.length === 1 ? `${cleaned}影` : cleaned;
}

function updateKeywordUI() {
  document.querySelectorAll(".keyword-chip").forEach((button) => {
    const selected = state.keywords.includes(button.dataset.keyword);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const hint = document.querySelector("[data-keyword-hint]");
  hint.textContent = state.keywords.length
    ? `已收进诗笺：${state.keywords.join("、")}（最多三项）`
    : "还未选择意象";
}

function toggleKeyword(keyword) {
  if (state.keywords.includes(keyword)) {
    state.keywords = state.keywords.filter((item) => item !== keyword);
  } else if (state.keywords.length < 3) {
    state.keywords.push(keyword);
  } else {
    document.querySelector("[data-keyword-hint]").textContent = "诗笺最多收三项，请先去掉一个意象。";
    return;
  }
  updateKeywordUI();
}

function addCustomKeyword() {
  const input = document.querySelector("#custom-word");
  const keyword = cleanKeyword(input.value);
  if (!keyword) {
    document.querySelector("[data-keyword-hint]").textContent = "写下一个词，再收进诗笺。";
    return;
  }
  if (![...document.querySelectorAll(".keyword-chip")].some((button) => button.dataset.keyword === keyword)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "keyword-chip";
    button.dataset.keyword = keyword;
    button.textContent = keyword;
    document.querySelector(".keyword-list").append(button);
  }
  if (!state.keywords.includes(keyword)) toggleKeyword(keyword);
  input.value = "";
}

function generatePoem(isRewrite = false) {
  if (!state.keywords.length) {
    document.querySelector("[data-keyword-hint]").textContent = "请先选一个意象，太白才好落笔。";
    return null;
  }

  if (isRewrite) state.revision += 1;
  const chosen = state.keywords.map(cleanKeyword);
  const a = chosen[0] || "江风";
  const b = chosen[1] || "黄鹤";
  const c = chosen[2] || "";
  const variant = poemVariants[state.revision % poemVariants.length];
  const lines = variant(a, b, c);
  const title = c ? `${a}${c}小记` : `借一笔${a}`;

  document.querySelector("#poem-name").value = title;
  document.querySelector("#poem-lines").value = lines.join("\n");
  document.querySelector("[data-draft-editor]").hidden = false;
  document.querySelector("[data-revision]").textContent = state.revision ? `第 ${state.revision + 1} 稿` : "初稿";
  document.querySelector("[data-poet-prompt]").textContent = `“${state.keywords.join("、")}都收下了。你若想改，今日便由你落最后一笔。”`;
  return { title, lines };
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char]);
}

async function buildMemory() {
  const title = document.querySelector("#poem-name").value.trim() || "江城新句";
  const lines = document.querySelector("#poem-lines").value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 6);
  if (!lines.length) {
    document.querySelector("#poem-lines").focus();
    return;
  }

  state.memoryId = `JC-LB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const payload = {
    memoryId: state.memoryId,
    characterId: "libai",
    packageVersion: "libai_yellow_crane_demo_v1",
    title,
    lines,
    keywords: [...state.keywords],
    provenance: "local_demo_confirmed",
  };
  state.memoryHash = await sha256(JSON.stringify(payload));

  document.querySelector("[data-memory-title]").textContent = title;
  document.querySelector("[data-memory-poem]").innerHTML = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
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

async function downloadCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 1672;
  canvas.height = 941;
  const ctx = canvas.getContext("2d");
  const background = await loadImage("./assets/memory-settlement.png");
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

  const title = document.querySelector("[data-memory-title]").textContent;
  const lines = [...document.querySelectorAll("[data-memory-poem] p")].map((p) => p.textContent);
  ctx.fillStyle = "#9c3f35";
  ctx.font = "700 24px system-ui";
  ctx.fillText("江城故人 · 李白篇", 820, 145);
  ctx.fillStyle = "#17383b";
  ctx.font = "700 58px 'Songti SC', serif";
  ctx.fillText(title.slice(0, 12), 820, 220);
  ctx.font = "34px 'Songti SC', serif";
  lines.slice(0, 6).forEach((line, index) => ctx.fillText(line.slice(0, 24), 825, 305 + index * 58));
  ctx.fillStyle = "rgba(23,56,59,.12)";
  ctx.fillRect(810, 700, 760, 105);
  ctx.fillStyle = "#365c61";
  ctx.font = "20px system-ui";
  ctx.fillText(`今日意象：${state.keywords.join("、")}`, 835, 738);
  ctx.fillText(`记忆编号：${state.memoryId}`, 835, 775);
  ctx.fillStyle = "#8b5e50";
  ctx.font = "700 18px system-ui";
  ctx.fillText("演示回执 · 未登记 BOT Chain", 835, 845);

  const link = document.createElement("a");
  link.download = `${state.memoryId || "jiangcheng-libai-memory"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resetJourney() {
  state.explored.clear();
  state.keywords = [];
  state.revision = 0;
  state.memoryId = "";
  state.memoryHash = "";
  document.querySelector("[data-draft-editor]").hidden = true;
  document.querySelector("#poem-lines").value = "";
  document.querySelectorAll(".keyword-chip[data-keyword]").forEach((button) => {
    if (!["江风", "白云", "帆影", "黄鹤", "玉笛", "霓虹"].includes(button.dataset.keyword)) button.remove();
  });
  updateKeywordUI();
  updateExploreUI();
  showScreen("select");
}

document.addEventListener("click", async (event) => {
  const anchor = event.target.closest("[data-anchor]")?.dataset.anchor;
  if (anchor) {
    openStory(anchor);
    return;
  }

  const keyword = event.target.closest(".keyword-chip")?.dataset.keyword;
  if (keyword) {
    toggleKeyword(keyword);
    return;
  }

  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "enter") showScreen("select");
  if (action === "choose-libai") showScreen("flight");
  if (action === "back-select") showScreen("select");
  if (action === "arrive-map") showScreen("map");
  if (action === "enter-tower") showScreen("explore");
  if (action === "start-poem") showScreen("poem");
  if (action === "back-explore") showScreen("explore");
  if (action === "add-keyword") addCustomKeyword();
  if (action === "generate-poem") generatePoem(false);
  if (action === "rewrite-poem") generatePoem(true);
  if (action === "adopt-poem") await buildMemory();
  if (action === "download-card") await downloadCard();
  if (action === "restart") resetJourney();
});

document.querySelector("#custom-word").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addCustomKeyword();
  }
});

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const options = { signal: lifecycle.signal };
  const report = (error) => console.warn("WebMCP registration failed", error);
  const tools = [
    {
      name: "get_li_bai_journey_state",
      title: "读取李白旅程状态",
      description: "读取当前游戏画面、寻幽进度、已采用意象和记忆编号，不改变游戏状态。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return { screen: state.screen, exploredAnchors: [...state.explored], keywords: [...state.keywords], memoryId: state.memoryId || null };
      },
    },
    {
      name: "start_li_bai_journey",
      title: "开始李白旅程",
      description: "选择李白并打开御笔飞行画面，与界面的“与太白同行”按钮效果相同。",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        showScreen("flight");
        return { screen: state.screen, characterId: "libai" };
      },
    },
    {
      name: "stage_poem_keywords",
      title: "设置共题诗意象",
      description: "把一至三个意象收进共题诗笺并打开题诗画面，不会自动采用或下载最终诗作。",
      inputSchema: {
        type: "object",
        properties: { keywords: { type: "array", minItems: 1, maxItems: 3, items: { type: "string", minLength: 1, maxLength: 8 } } },
        required: ["keywords"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || !Array.isArray(input.keywords) || input.keywords.length < 1 || input.keywords.length > 3) {
          throw new TypeError("keywords must contain one to three strings");
        }
        const next = input.keywords.map(cleanKeyword);
        if (next.some((value) => !value)) throw new TypeError("each keyword must contain visible text");
        state.keywords = [...new Set(next)].slice(0, 3);
        updateKeywordUI();
        showScreen("poem");
        return { screen: state.screen, keywords: [...state.keywords] };
      },
    },
  ];

  tools.forEach((tool) => {
    try {
      Promise.resolve(context.registerTool(tool, options)).catch(report);
    } catch (error) {
      report(error);
    }
  });
}

updateExploreUI();
updateKeywordUI();
registerWebMcpTools();
