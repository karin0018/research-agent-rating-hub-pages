import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_PATH = path.join(DATA_DIR, "site-config.json");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const REVIEWS_PATH = path.join(DATA_DIR, "reviews.json");

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";

const CORE_PROJECTS = [
  "karpathy/autoresearch",
  "bytedance/deer-flow",
  "assafelovic/gpt-researcher",
  "dzhng/deep-research",
  "Alibaba-NLP/DeepResearch",
  "microsoft/RD-Agent",
  "nickscamara/open-deep-research"
];

const REPO_CANDIDATES = [
  ...CORE_PROJECTS,
  "zilliztech/deep-searcher",
  "CopilotKit/open-research-ANA",
  "virattt/ai-financial-agent",
  "Intelligent-Internet/ii-researcher",
  "langchain-ai/open_deep_research"
];

const SEARCH_QUERIES = [
  "\"deep research\" agent in:name,description,readme archived:false",
  "\"research agent\" llm in:name,description,readme archived:false",
  "\"open deep research\" in:name,description,readme archived:false",
  "autoresearch agent in:name,description,readme archived:false",
  "\"researcher\" agent llm in:name,description,readme archived:false"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function githubHeaders() {
  const headers = {
    "User-Agent": "research-agent-rating-hub-pages",
    Accept: "application/vnd.github+json"
  };
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }
  return headers;
}

async function github(endpoint) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: githubHeaders(),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function ensureLabel(name, color, description) {
  if (!GITHUB_REPOSITORY) return;
  try {
    await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/labels`, {
      method: "POST",
      headers: githubHeaders(),
      body: JSON.stringify({ name, color, description }),
      signal: AbortSignal.timeout(10000)
    });
  } catch {}
}

function pickAccent(seed) {
  const palette = ["#ff7a45", "#0f8c86", "#e56b6f", "#f0b33b", "#5a67d8", "#d97706", "#0ea5e9", "#c2410c"];
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function extractTags(repo) {
  const tags = new Set((repo.topics || []).slice(0, 4));
  const text = `${repo.name} ${repo.description || ""}`.toLowerCase();
  if (text.includes("research")) tags.add("research");
  if (text.includes("deep")) tags.add("deep-research");
  if (text.includes("agent")) tags.add("agent");
  if (text.includes("search")) tags.add("search");
  return [...tags].slice(0, 5);
}

function summarize(repo) {
  return {
    id: repo.full_name.toLowerCase().replace(/[^\w]+/g, "-"),
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    stars: repo.stargazers_count,
    starsLabel: repo.stargazers_count >= 1000 ? `${(repo.stargazers_count / 1000).toFixed(1)}k` : String(repo.stargazers_count),
    accent: pickAccent(repo.full_name),
    tags: extractTags(repo),
    description: repo.description || "Research agent related open-source project on GitHub.",
    note: CORE_PROJECTS.includes(repo.full_name)
      ? "核心项目，优先保留。"
      : "由 GitHub Actions 自动同步收录。",
    isCore: CORE_PROJECTS.includes(repo.full_name)
  };
}

function isResearchAgent(project) {
  const text = `${project.fullName} ${project.description} ${(project.tags || []).join(" ")}`.toLowerCase();
  const identity = `${project.fullName} ${project.name}`.toLowerCase();
  const strongNameMatch = [
    "research",
    "researcher",
    "autoresearch",
    "deep-research",
    "open_deep_research",
    "open-deep-research",
    "rd-agent",
    "deep-searcher"
  ].some((signal) => identity.includes(signal));
  const negativeSignals = ["awesome", "benchmark", "tutorial", "course", "sdk", "model serving", "ollama"];
  if (negativeSignals.some((signal) => text.includes(signal))) return false;
  const hasResearch = text.includes("research") || text.includes("researcher") || text.includes("deep-research");
  const hasAgentOrSearch = text.includes("agent") || text.includes("assistant") || text.includes("search");
  return CORE_PROJECTS.includes(project.fullName) || (strongNameMatch && hasResearch && hasAgentOrSearch && project.stars >= 300);
}

function parseRating(body) {
  const match = String(body || "").match(/rating:\s*([1-5])/i);
  return match ? Number(match[1]) : null;
}

function parseProjectFullName(body) {
  const match = String(body || "").match(/project:\s*([^\n\r]+)/i);
  return match ? match[1].trim() : null;
}

async function syncProjects() {
  const repoMap = new Map();

  const searchResults = await Promise.allSettled(
    SEARCH_QUERIES.map((query) =>
      github(`/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=6`)
    )
  );

  for (const result of searchResults) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value.items || []) {
      if (!item.archived && !item.fork) {
        repoMap.set(item.full_name, summarize(item));
      }
    }
  }

  const missing = REPO_CANDIDATES.filter((fullName) => !repoMap.has(fullName));
  const repoResults = await Promise.allSettled(missing.map((fullName) => github(`/repos/${fullName}`)));
  for (const result of repoResults) {
    if (result.status !== "fulfilled") continue;
    repoMap.set(result.value.full_name, summarize(result.value));
  }

  const core = CORE_PROJECTS.map((fullName) => repoMap.get(fullName)).filter(Boolean);
  const supplemental = [...repoMap.values()]
    .filter((project) => !CORE_PROJECTS.includes(project.fullName))
    .filter(isResearchAgent)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, Math.max(0, 20 - core.length));

  const projects = [...core, ...supplemental].sort((a, b) => b.stars - a.stars).slice(0, 20);
  writeJson(PROJECTS_PATH, {
    updatedAt: new Date().toISOString(),
    projects
  });
  return projects;
}

async function syncReviews(projects) {
  if (!GITHUB_REPOSITORY) {
    writeJson(REVIEWS_PATH, { updatedAt: new Date().toISOString(), reviewsByProject: {} });
    return;
  }

  const issues = await github(`/repos/${GITHUB_REPOSITORY}/issues?state=all&per_page=100`);
  const projectIdByFullName = Object.fromEntries(projects.map((project) => [project.fullName.toLowerCase(), project.id]));
  const reviewsByProject = {};

  for (const issue of issues) {
    if (issue.pull_request) continue;
    const isReviewTitle = /^\[Review\]/i.test(issue.title || "");
    const projectFullName = parseProjectFullName(issue.body);
    const projectId = projectFullName ? projectIdByFullName[projectFullName.toLowerCase()] : null;
    if (!isReviewTitle || !projectId) continue;
    const score = parseRating(issue.body);
    if (!score) continue;

    if (!reviewsByProject[projectId]) {
      reviewsByProject[projectId] = [];
    }
    reviewsByProject[projectId].push({
      title: issue.title.replace(/^\[Review\]\s*/i, ""),
      body: String(issue.body || "").replace(/rating:\s*[1-5]/i, "").trim(),
      author: issue.user?.login || "anonymous",
      score,
      createdAt: issue.created_at,
      issueNumber: issue.number,
      issueUrl: issue.html_url
    });
  }

  for (const projectId of Object.keys(reviewsByProject)) {
    reviewsByProject[projectId].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  writeJson(REVIEWS_PATH, {
    updatedAt: new Date().toISOString(),
    reviewsByProject
  });
}

async function main() {
  readJson(CONFIG_PATH);
  await ensureLabel("review", "FBCA04", "Community review posts collected by the GitHub Pages board");
  const projects = await syncProjects();
  await syncReviews(projects);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
