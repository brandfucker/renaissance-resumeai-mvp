const sampleResume = `张同学
应届毕业生 | 产品运营方向

教育经历
某某大学 市场营销 本科

项目经历
校园求职社群运营
- 负责社群日常维护，发布活动通知
- 协助老师组织就业讲座
- 整理同学反馈，做过简单的数据统计

新媒体账号运营
- 负责公众号推文排版和发布
- 参与选题讨论
- 维护粉丝互动`;

const sampleJd = `岗位：产品运营实习生

岗位职责：
1. 负责用户增长、社群运营和活动转化；
2. 分析用户反馈和运营数据，输出复盘报告；
3. 协同产品、设计和市场团队推进项目；
4. 优化内容触达策略，提高用户留存。

任职要求：
1. 有校园社群、新媒体或活动运营经验；
2. 具备数据分析意识，能用数据描述结果；
3. 表达清晰，执行力强，熟悉用户增长、转化率、留存率等概念。`;

const defaultRadar = [
  { label: "关键词匹配", before: 0, after: 0 },
  { label: "量化成果", before: 0, after: 0 },
  { label: "STAR结构", before: 0, after: 0 },
  { label: "岗位贴合", before: 0, after: 0 },
  { label: "表达专业", before: 0, after: 0 },
  { label: "可读性", before: 0, after: 0 }
];

const HR_STORAGE_KEY = "renaissance-hr-reviews";
const hrScoreWeights = {
  jobFit: 28,
  experience: 22,
  clarity: 15,
  quantified: 15,
  credibility: 10,
  interview: 10
};
const hrScoreLabels = {
  jobFit: "岗位匹配",
  experience: "经验质量",
  clarity: "表达清晰",
  quantified: "量化成果",
  credibility: "可信度",
  interview: "面试价值"
};
const hrDirectionMap = {
  jobFit: "补充与JD职责直接相关的经历，把岗位关键词放进项目描述。",
  experience: "突出个人负责的任务边界，减少泛泛的协助型表达。",
  clarity: "压缩长句，按动作、方法、结果的顺序重写经历。",
  quantified: "补充规模、转化率、留存率、完成数量等真实指标。",
  credibility: "标注数据来源或使用保守表述，避免无法解释的夸大数字。",
  interview: "增加一个可在面试中展开讲清楚的代表性项目案例。"
};

const state = {
  result: null,
  streamedMarkdown: "",
  activePhase: null,
  busy: false,
  hrReviews: []
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  state.hrReviews = loadHrReviews();
  fillSample();
  renderRadar(defaultRadar);
  renderKeywords([]);
  renderHrPanel();
});

function bindElements() {
  Object.assign(els, {
    demoMode: document.getElementById("demoMode"),
    sampleBtn: document.getElementById("sampleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    exportBtn: document.getElementById("exportBtn"),
    optimizeBtn: document.getElementById("optimizeBtn"),
    resumeFile: document.getElementById("resumeFile"),
    resumeInput: document.getElementById("resumeInput"),
    jdInput: document.getElementById("jdInput"),
    statusText: document.getElementById("statusText"),
    phaseList: document.getElementById("phaseList"),
    scoreRing: document.getElementById("scoreRing"),
    scoreValue: document.getElementById("scoreValue"),
    sourceText: document.getElementById("sourceText"),
    radarChart: document.getElementById("radarChart"),
    keywordList: document.getElementById("keywordList"),
    resultBadge: document.getElementById("resultBadge"),
    optimizedOutput: document.getElementById("optimizedOutput"),
    diffList: document.getElementById("diffList"),
    printContent: document.getElementById("printContent"),
    hrScoreInputs: Array.from(document.querySelectorAll("[data-hr-score]")),
    hrNoteInput: document.getElementById("hrNoteInput"),
    saveHrScoreBtn: document.getElementById("saveHrScoreBtn"),
    resetHrScoresBtn: document.getElementById("resetHrScoresBtn"),
    hrTotalScore: document.getElementById("hrTotalScore"),
    hrDecisionText: document.getElementById("hrDecisionText"),
    candidateDirectionText: document.getElementById("candidateDirectionText"),
    hrHistoryList: document.getElementById("hrHistoryList"),
    reviewCount: document.getElementById("reviewCount")
  });
}

function bindEvents() {
  els.sampleBtn.addEventListener("click", fillSample);
  els.clearBtn.addEventListener("click", clearInputs);
  els.exportBtn.addEventListener("click", exportPdf);
  els.optimizeBtn.addEventListener("click", optimizeResume);
  els.resumeFile.addEventListener("change", importResumeFile);
  els.saveHrScoreBtn.addEventListener("click", saveHrScore);
  els.resetHrScoresBtn.addEventListener("click", resetHrScores);
  els.hrScoreInputs.forEach(input => {
    input.addEventListener("input", renderHrPanel);
  });
}

function fillSample() {
  els.resumeInput.value = sampleResume;
  els.jdInput.value = sampleJd;
  setStatus("样例已填入");
}

function clearInputs() {
  els.resumeInput.value = "";
  els.jdInput.value = "";
  state.result = null;
  state.streamedMarkdown = "";
  resetVisuals();
  setStatus("已清空");
}

function resetVisuals() {
  updateScore(0);
  renderRadar(defaultRadar);
  renderKeywords([]);
  renderDiff([]);
  renderMarkdown("");
  els.resultBadge.textContent = "未生成";
  els.resultBadge.style.borderColor = "";
  els.sourceText.textContent = "尚未生成";
  document.querySelectorAll(".phase-item").forEach(item => {
    item.classList.remove("active", "done");
  });
}

async function importResumeFile(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  const text = await file.text();
  els.resumeInput.value = text;
  setStatus(`已导入：${file.name}`);
  event.target.value = "";
}

async function optimizeResume() {
  if (state.busy) return;

  const resume = els.resumeInput.value.trim();
  const jobDescription = els.jdInput.value.trim();

  if (!resume || !jobDescription) {
    setStatus("请先填写简历和 JD");
    return;
  }

  state.busy = true;
  state.result = null;
  state.streamedMarkdown = "";
  setBusy(true);
  resetVisuals();
  setStatus("正在启动优化链路");
  renderMarkdown("", true);

  try {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume,
        jobDescription,
        demoMode: els.demoMode.checked
      })
    });

    if (!response.ok || !response.body) {
      throw new Error(`请求失败：${response.status}`);
    }

    await readEventStream(response.body);
  } catch (error) {
    setStatus(error.message || "优化失败");
    els.resultBadge.textContent = "请求失败";
  } finally {
    state.busy = false;
    setBusy(false);
  }
}

async function readEventStream(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const rawEvent of events) {
      handleSseEvent(parseSseEvent(rawEvent));
    }
  }

  if (buffer.trim()) {
    handleSseEvent(parseSseEvent(buffer));
  }
}

function parseSseEvent(rawEvent) {
  const lines = rawEvent.split(/\r?\n/);
  let event = "message";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data += line.slice(5).trim();
  }

  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data: {} };
  }
}

function handleSseEvent(message) {
  const { event, data } = message;

  if (event === "phase") {
    updatePhase(data.id);
    setStatus(data.label);
    return;
  }

  if (event === "warning") {
    setStatus(data.message || "已切换到剧本模式");
    return;
  }

  if (event === "result") {
    state.result = data;
    state.streamedMarkdown = "";
    renderResultScaffold(data);
    renderMarkdown("", true);
    return;
  }

  if (event === "chunk") {
    state.streamedMarkdown += data.text || "";
    renderMarkdown(state.streamedMarkdown, true);
    return;
  }

  if (event === "done") {
    finishPhases();
    if (state.result?.optimizedResume) {
      state.streamedMarkdown = state.result.optimizedResume;
      renderMarkdown(state.streamedMarkdown, false);
      els.printContent.innerHTML = markdownToHtml(state.streamedMarkdown);
    }
    setStatus(data.source === "deepseek" ? "DeepSeek 优化完成" : "剧本模式演示完成");
    els.resultBadge.textContent = data.source === "deepseek" ? "真实AI结果" : "演示结果";
  }
}

function renderResultScaffold(result) {
  updateScore(result.matchScore || 0);
  renderRadar(result.radar || defaultRadar);
  renderKeywords(result.keywordHits || []);
  renderDiff(result.sections || []);
  els.sourceText.textContent =
    result.source === "mock" || result.source === "mock-fallback"
      ? "当前使用剧本模式"
      : "当前使用 DeepSeek";
  els.resultBadge.textContent = "生成中";
  els.resultBadge.style.borderColor = "rgba(63, 224, 181, 0.45)";
}

function updatePhase(phaseId) {
  state.activePhase = phaseId;
  let passedActive = false;

  document.querySelectorAll(".phase-item").forEach(item => {
    const isActive = item.dataset.phase === phaseId;
    item.classList.toggle("active", isActive);

    if (isActive) {
      passedActive = true;
      item.classList.remove("done");
    } else if (!passedActive && state.activePhase) {
      item.classList.add("done");
    }
  });
}

function finishPhases() {
  document.querySelectorAll(".phase-item").forEach(item => {
    item.classList.remove("active");
    item.classList.add("done");
  });
}

function updateScore(score) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  els.scoreRing.style.setProperty("--score", value);
  animateNumber(els.scoreValue, Number(els.scoreValue.textContent) || 0, value);
}

function animateNumber(element, from, to) {
  const start = performance.now();
  const duration = 520;

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = String(Math.round(from + (to - from) * eased));

    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function renderRadar(data) {
  const values = Array.isArray(data) && data.length ? data : defaultRadar;
  const size = 230;
  const cx = 130;
  const cy = 112;
  const radius = 76;
  const levels = [0.25, 0.5, 0.75, 1];
  const axis = values.map((item, index) => getPoint(index, values.length, radius, cx, cy));

  const beforePoints = values
    .map((item, index) => getPoint(index, values.length, radius * ((item.before || 0) / 100), cx, cy))
    .map(pointToString)
    .join(" ");
  const afterPoints = values
    .map((item, index) => getPoint(index, values.length, radius * ((item.after || 0) / 100), cx, cy))
    .map(pointToString)
    .join(" ");

  els.radarChart.innerHTML = `
    <g>
      ${levels
        .map(level => {
          const points = values
            .map((_, index) => getPoint(index, values.length, radius * level, cx, cy))
            .map(pointToString)
            .join(" ");
          return `<polygon points="${points}" fill="none" stroke="rgba(255,255,255,.1)" />`;
        })
        .join("")}
      ${axis
        .map(point => `<line x1="${cx}" y1="${cy}" x2="${point.x}" y2="${point.y}" stroke="rgba(255,255,255,.1)" />`)
        .join("")}
      <polygon points="${beforePoints}" fill="rgba(243,108,127,.16)" stroke="rgba(243,108,127,.7)" />
      <polygon points="${afterPoints}" fill="rgba(63,224,181,.2)" stroke="rgba(63,224,181,.9)" />
      ${values
        .map((item, index) => {
          const point = getPoint(index, values.length, radius + 25, cx, cy);
          return `<text class="radar-label" x="${point.x}" y="${point.y}" text-anchor="middle">${escapeHtml(item.label || "")}</text>`;
        })
        .join("")}
    </g>
    <g transform="translate(22 ${size - 18})">
      <rect width="9" height="9" fill="rgba(243,108,127,.7)"></rect>
      <text x="14" y="9" class="radar-label">优化前</text>
      <rect x="72" width="9" height="9" fill="rgba(63,224,181,.9)"></rect>
      <text x="86" y="9" class="radar-label">优化后</text>
    </g>
  `;
}

function getPoint(index, total, radius, cx, cy) {
  const angle = Math.PI * 2 * (index / total) - Math.PI / 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius
  };
}

function pointToString(point) {
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function renderKeywords(items) {
  const keywords = Array.isArray(items) ? items : [];

  if (!keywords.length) {
    els.keywordList.innerHTML = `<span class="keyword">等待分析</span>`;
    return;
  }

  els.keywordList.innerHTML = keywords
    .map(item => {
      const className = item.after ? "keyword hit" : "keyword missed";
      return `<span class="${className}">${escapeHtml(item.keyword || "")}</span>`;
    })
    .join("");
}

function getHrScores() {
  return els.hrScoreInputs.reduce((scores, input) => {
    scores[input.dataset.hrScore] = Number(input.value);
    return scores;
  }, {});
}

function calculateHrTotal(scores) {
  return Object.entries(hrScoreWeights).reduce((total, [key, weight]) => {
    return total + ((scores[key] || 0) / 10) * weight;
  }, 0);
}

function getCandidateName() {
  const firstLine = els.resumeInput.value
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);
  return firstLine || "未命名候选人";
}

function getWeakestDimension(scores) {
  return Object.entries(scores).sort((a, b) => a[1] - b[1])[0]?.[0] || "jobFit";
}

function getHistoryAverage() {
  if (!state.hrReviews.length) return 0;
  const total = state.hrReviews.reduce((sum, review) => sum + review.total, 0);
  return Math.round(total / state.hrReviews.length);
}

function buildHrDecision(total, scores) {
  const weakest = getWeakestDimension(scores);
  const historyAverage = getHistoryAverage();
  const threshold = historyAverage ? Math.max(70, historyAverage + 3) : 75;
  let decision;

  if (total >= 85) {
    decision = "优先面试";
  } else if (total >= threshold) {
    decision = "进入候选池";
  } else if (total >= 55) {
    decision = "待补充材料";
  } else {
    decision = "暂缓筛选";
  }

  const benchmark = historyAverage
    ? `当前候选池均分 ${historyAverage}，建议筛选线 ${threshold}。`
    : `建议先以 ${threshold} 分作为本岗位候选池筛选线。`;

  return {
    decision,
    direction: `${benchmark} 求职者优化方向：${hrDirectionMap[weakest]}`,
    weakestLabel: hrScoreLabels[weakest]
  };
}

function renderHrPanel() {
  const scores = getHrScores();
  const total = Math.round(calculateHrTotal(scores));
  const insight = buildHrDecision(total, scores);

  els.hrScoreInputs.forEach(input => {
    const valueEl = document.getElementById(`${input.dataset.hrScore}Value`);
    if (valueEl) valueEl.textContent = input.value;
  });

  els.hrTotalScore.textContent = String(total);
  els.hrDecisionText.textContent = `${insight.decision} · 短板：${insight.weakestLabel}`;
  els.candidateDirectionText.textContent = insight.direction;
  els.reviewCount.textContent = `${state.hrReviews.length}条`;
  renderHrHistory();
}

function saveHrScore() {
  const scores = getHrScores();
  const total = Math.round(calculateHrTotal(scores));
  const insight = buildHrDecision(total, scores);
  const review = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    candidate: getCandidateName(),
    total,
    decision: insight.decision,
    weakestLabel: insight.weakestLabel,
    note: els.hrNoteInput.value.trim(),
    aiScore: state.result?.matchScore || 0,
    createdAt: new Date().toLocaleString("zh-CN"),
    scores
  };

  state.hrReviews = [review, ...state.hrReviews].slice(0, 8);
  saveHrReviews(state.hrReviews);
  renderHrPanel();
  setStatus(`HR评分已保存：${total}/100`);
}

function resetHrScores() {
  const defaults = {
    jobFit: 8,
    experience: 7,
    clarity: 8,
    quantified: 6,
    credibility: 7,
    interview: 7
  };

  els.hrScoreInputs.forEach(input => {
    input.value = String(defaults[input.dataset.hrScore] || 7);
  });
  els.hrNoteInput.value = "适合进入候选池，建议补充更真实的活动数据和个人贡献边界。";
  renderHrPanel();
  setStatus("HR评分已重置");
}

function renderHrHistory() {
  if (!state.hrReviews.length) {
    els.hrHistoryList.innerHTML = `<div class="hr-history-item"><p>暂无HR评分记录。</p></div>`;
    return;
  }

  els.hrHistoryList.innerHTML = state.hrReviews
    .slice(0, 3)
    .map(
      review => `
        <div class="hr-history-item">
          <strong>${escapeHtml(review.candidate)} · ${review.total}/100 · ${escapeHtml(review.decision)}</strong>
          <p>短板：${escapeHtml(review.weakestLabel)}。${escapeHtml(review.note || "未填写评语")}</p>
        </div>
      `
    )
    .join("");
}

function loadHrReviews() {
  try {
    const stored = localStorage.getItem(HR_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHrReviews(reviews) {
  try {
    localStorage.setItem(HR_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    setStatus("评分记录无法写入本地存储");
  }
}

function renderDiff(sections) {
  const list = Array.isArray(sections) ? sections : [];

  if (!list.length) {
    els.diffList.innerHTML = `<div class="diff-box"><p class="placeholder">等待生成修改对比。</p></div>`;
    return;
  }

  els.diffList.innerHTML = list
    .map(
      item => `
        <div class="diff-item">
          <div class="diff-box before">
            <strong>Before</strong>
            <p>${escapeHtml(item.original || "")}</p>
          </div>
          <div class="diff-box after">
            <strong>After</strong>
            <p>${highlightText(item.optimized || "")}</p>
          </div>
          <div class="reasoning">${escapeHtml(item.reasoning || "")}</div>
        </div>
      `
    )
    .join("");
}

function renderMarkdown(markdown, withCursor = false) {
  if (!markdown) {
    els.optimizedOutput.innerHTML = `<p class="placeholder">正在等待 AI 输出。</p>${withCursor ? '<span class="cursor"></span>' : ""}`;
    return;
  }

  const cursor = withCursor ? '<span class="cursor"></span>' : "";
  els.optimizedOutput.innerHTML = `${markdownToHtml(markdown)}${cursor}`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  let html = "";
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h3>${escapeHtml(trimmed.slice(4))}</h3>`;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h2>${escapeHtml(trimmed.slice(3))}</h2>`;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += `<h1>${escapeHtml(trimmed.slice(2))}</h1>`;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${highlightText(trimmed.slice(2))}</li>`;
      continue;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }
    html += `<p>${highlightText(trimmed)}</p>`;
  }

  if (inList) html += "</ul>";
  return html;
}

function highlightText(text) {
  const escaped = escapeHtml(text);
  const numberMarked = escaped.replace(
    /(\d+(?:\.\d+)?\+?%?)/g,
    '<span class="number-highlight">$1</span>'
  );
  const terms = [
    "用户增长",
    "社群运营",
    "活动转化",
    "数据分析",
    "复盘报告",
    "跨部门协作",
    "内容触达",
    "用户留存",
    "转化率",
    "STAR"
  ];

  return terms.reduce((html, term) => {
    return html.replaceAll(term, `<span class="highlight">${term}</span>`);
  }, numberMarked);
}

function exportPdf() {
  const content = state.streamedMarkdown || state.result?.optimizedResume;

  if (!content) {
    setStatus("请先生成优化结果");
    return;
  }

  els.printContent.innerHTML = markdownToHtml(content);
  window.print();
}

function setBusy(isBusy) {
  els.optimizeBtn.disabled = isBusy;
  els.sampleBtn.disabled = isBusy;
  els.clearBtn.disabled = isBusy;
  els.optimizeBtn.textContent = isBusy ? "优化中" : "开始优化";
  if (!isBusy) {
    els.optimizeBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 12 4 4L19 6" />
      </svg>
      开始优化
    `;
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
