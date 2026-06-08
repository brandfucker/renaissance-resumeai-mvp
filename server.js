const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const phases = [
  { id: "parse", label: "解析简历经历", detail: "识别经历、动作和成果表达" },
  { id: "jd", label: "提取JD关键词", detail: "定位岗位要求、能力词和行业信号" },
  { id: "rewrite", label: "STAR法则重写", detail: "补充情境、任务、行动和结果" },
  { id: "score", label: "计算匹配度", detail: "生成评分、关键词命中和对比说明" }
];

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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStaticFilePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = decoded === "/" ? "/index.html" : decoded;
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

  if (!filePath.startsWith(PUBLIC_DIR)) return null;
  return filePath;
}

function serveStatic(req, res) {
  const filePath = getStaticFilePath(req.url);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

function pickKeywords(jobDescription) {
  const candidates = [
    "用户增长",
    "社群运营",
    "活动转化",
    "数据分析",
    "复盘报告",
    "跨部门协作",
    "内容触达",
    "用户留存",
    "转化率",
    "执行力",
    "产品运营",
    "新媒体运营"
  ];

  const hits = candidates.filter(item => jobDescription.includes(item));
  return hits.length >= 6 ? hits.slice(0, 8) : candidates.slice(0, 8);
}

function buildMockOptimization(resume = sampleResume, jobDescription = sampleJd) {
  const keywords = pickKeywords(jobDescription);

  return {
    source: "mock",
    optimizedResume: `# 张同学

产品运营实习生候选人 | 用户增长 / 社群运营 / 数据复盘

## 核心优势
- 具备校园社群运营和新媒体内容运营经验，能够围绕用户增长、活动转化和留存目标设计执行动作。
- 熟悉从用户反馈、活动数据到复盘报告的基础工作流，能用数据描述运营结果。
- 具备跨部门协作意识，能够配合产品、设计和市场角色推进活动落地。

## 项目经历

### 校园求职社群运营
- 运营 500+ 人校园求职社群，围绕就业讲座和岗位信息建立内容触达节奏，提升活动报名转化率约 18%。
- 设计活动前提醒、活动中答疑和活动后反馈收集流程，沉淀 3 份复盘报告，为后续讲座选题提供数据依据。
- 根据同学反馈梳理求职痛点，将“简历修改”“面试准备”“岗位匹配”拆分为专题内容，提高社群互动频次。

### 新媒体账号运营
- 参与公众号选题、排版和发布，结合求职季热点优化标题与内容结构，提升内容阅读完成度。
- 维护粉丝互动并整理留言反馈，将高频问题转化为后续内容选题，增强内容触达与用户留存。

## 技能
- 产品运营：用户增长、社群运营、活动转化、内容触达
- 数据意识：反馈整理、基础指标分析、复盘报告
- 协作能力：跨部门沟通、活动执行、项目推进`,
    matchScore: 88,
    keywordHits: keywords.map((keyword, index) => ({
      keyword,
      before: index > 4,
      after: true
    })),
    radar: [
      { label: "关键词匹配", before: 42, after: 88 },
      { label: "量化成果", before: 28, after: 86 },
      { label: "STAR结构", before: 34, after: 90 },
      { label: "岗位贴合", before: 48, after: 87 },
      { label: "表达专业", before: 52, after: 84 },
      { label: "可读性", before: 58, after: 82 }
    ],
    sections: [
      {
        original: "负责社群日常维护，发布活动通知",
        optimized:
          "运营 500+ 人校园求职社群，围绕就业讲座和岗位信息建立内容触达节奏，提升活动报名转化率约 18%。",
        reasoning: "补充社群规模、运营动作和转化结果，直接对齐 JD 中的社群运营与活动转化。"
      },
      {
        original: "协助老师组织就业讲座",
        optimized:
          "设计活动前提醒、活动中答疑和活动后反馈收集流程，沉淀 3 份复盘报告，为后续讲座选题提供数据依据。",
        reasoning: "把协助型表述改为流程型贡献，并加入数据复盘能力。"
      },
      {
        original: "负责公众号推文排版和发布",
        optimized:
          "参与公众号选题、排版和发布，结合求职季热点优化标题与内容结构，提升内容阅读完成度。",
        reasoning: "从执行动作扩展到内容策略，强化新媒体运营和内容触达能力。"
      }
    ],
    suggestions: [
      "将 18%、500+、3 份报告替换为真实数据后，可信度会更高。",
      "如果目标岗位偏产品，可补充需求分析、用户访谈或原型协作经历。",
      "面试前准备一段社群运营复盘案例，解释指标如何被追踪。"
    ]
  };
}

function buildPrompt(resume, jobDescription) {
  return `你是资深HR和中文简历优化专家。请根据候选人的旧简历和目标岗位JD，输出严格 JSON，不要输出 Markdown 包裹符，不要输出解释性前后缀。

目标：
1. 用 STAR 法则优化简历经历。
2. 保留真实可信的表达，不编造公司、学校、证书。
3. 可以使用“约”“可替换为真实数据”等方式提示候选人补充量化结果。
4. 强化 JD 关键词匹配。
5. 用中文输出。

JSON 字段必须包含：
{
  "optimizedResume": "优化后的Markdown简历",
  "matchScore": 0到100之间的整数,
  "keywordHits": [{"keyword":"关键词","before":true或false,"after":true或false}],
  "radar": [{"label":"维度","before":0到100之间的整数,"after":0到100之间的整数}],
  "sections": [{"original":"原句","optimized":"优化句","reasoning":"修改理由"}],
  "suggestions": ["后续建议"]
}

旧简历：
${resume}

目标岗位JD：
${jobDescription}`;
}

function normalizeOptimization(raw) {
  const fallback = buildMockOptimization();
  const result = raw && typeof raw === "object" ? raw : fallback;

  return {
    source: result.source || "deepseek",
    optimizedResume:
      typeof result.optimizedResume === "string" && result.optimizedResume.trim()
        ? result.optimizedResume
        : fallback.optimizedResume,
    matchScore: clampNumber(result.matchScore, 0, 100, fallback.matchScore),
    keywordHits: normalizeArray(result.keywordHits, fallback.keywordHits).slice(0, 10),
    radar: normalizeArray(result.radar, fallback.radar).slice(0, 8),
    sections: normalizeArray(result.sections, fallback.sections).slice(0, 6),
    suggestions: normalizeArray(result.suggestions, fallback.suggestions).slice(0, 5)
  };
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) && value.length > 0 ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

async function callDeepSeek(resume, jobDescription) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "你只输出合法 JSON。你的任务是做中文简历优化、岗位匹配和结构化诊断。"
          },
          {
            role: "user",
            content: buildPrompt(resume, jobDescription)
          }
        ],
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        temperature: 0.35,
        max_tokens: 5000
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`DeepSeek API returned ${response.status}: ${detail.slice(0, 240)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek response has no message content.");

    return normalizeOptimization(JSON.parse(content));
  } finally {
    clearTimeout(timer);
  }
}

async function streamText(res, text) {
  const chunks = text.match(/.{1,10}/gs) || [];

  for (const chunk of chunks) {
    sendSse(res, "chunk", { text: chunk });
    await wait(18);
  }
}

async function handleOptimize(req, res) {
  let payload;

  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJson(res, 400, { error: "Invalid JSON request body." });
    return;
  }

  const resume = String(payload.resume || sampleResume).trim();
  const jobDescription = String(payload.jobDescription || sampleJd).trim();
  const demoMode = Boolean(payload.demoMode);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive"
  });

  for (const phase of phases) {
    sendSse(res, "phase", phase);
    await wait(demoMode ? 420 : 560);
  }

  let result;

  if (demoMode) {
    result = normalizeOptimization(buildMockOptimization(resume, jobDescription));
  } else {
    try {
      result = await callDeepSeek(resume, jobDescription);
    } catch (error) {
      sendSse(res, "warning", {
        message: "真实 API 暂不可用，已切换到剧本模式保证演示继续。",
        detail: error.message
      });
      result = normalizeOptimization(buildMockOptimization(resume, jobDescription));
      result.source = "mock-fallback";
    }
  }

  sendSse(res, "result", result);
  await streamText(res, result.optimizedResume);
  sendSse(res, "done", { ok: true, source: result.source || "deepseek" });
  res.end();
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, model: DEFAULT_MODEL });
    return;
  }

  if (req.method === "POST" && req.url === "/api/optimize") {
    await handleOptimize(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(PORT, () => {
  console.log(`Renaissance AI MVP is running at http://localhost:${PORT}`);
});
