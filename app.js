const state = {
  config: null,
  projects: [],
  reviewsByProject: {},
  activeTag: "全部",
  search: "",
  sort: "stars"
};

const projectGrid = document.querySelector("#project-grid");
const tagStrip = document.querySelector("#tag-strip");
const searchInput = document.querySelector("#search-input");
const sortSelect = document.querySelector("#sort-select");
const toast = document.querySelector("#toast");
const cardTemplate = document.querySelector("#project-card-template");
const reviewItemTemplate = document.querySelector("#review-item-template");
const modal = document.querySelector("#review-modal");
const modalProjectName = document.querySelector("#modal-project-name");
const reviewForm = document.querySelector("#review-form");
const closeModalButton = document.querySelector("#close-modal");
const previewIssueButton = document.querySelector("#preview-issue");

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`加载失败: ${path}`);
  }
  return response.json();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatScore(score) {
  return `${Number(score || 0).toFixed(1)} / 5`;
}

function getAllTags() {
  return ["全部", ...new Set(state.projects.flatMap((project) => project.tags || []))];
}

function getProjectReviews(projectId) {
  return state.reviewsByProject[projectId] || [];
}

function getProjectStats(projectId) {
  const reviews = getProjectReviews(projectId);
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, review) => sum + Number(review.score), 0) / count : 0;
  return { count, average, reviews };
}

function createIssueLinks(project) {
  const owner = state.config.siteRepoOwner;
  const repo = state.config.siteRepoName;
  const label = `project:${project.id}`;
  const baseRepoUrl = `https://github.com/${owner}/${repo}`;
  const searchUrl = `${baseRepoUrl}/issues?q=${encodeURIComponent(`is:issue "[Review]" "${project.fullName}"`)}`;
  return { searchUrl, baseRepoUrl, label };
}

function getSelectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) || null;
}

function buildIssueDraft(project, formValues) {
  const links = createIssueLinks(project);
  const title = `[Review] ${project.fullName} · ${formValues.title}`;
  const body = [
    `Project: ${project.fullName}`,
    `Rating: ${formValues.score}`,
    `Reviewer: ${formValues.author}`,
    "",
    "Review:",
    formValues.body,
    "",
    "---",
    "Posted from the GitHub Pages community rating board."
  ].join("\n");
  const createUrl = `${links.baseRepoUrl}/issues/new?${new URLSearchParams({
    title,
    labels: `review,${links.label}`,
    body
  }).toString()}`;
  return { ...links, title, body, createUrl };
}

function readReviewFormValues() {
  return {
    author: document.querySelector("#review-author").value.trim(),
    score: document.querySelector("#review-score").value,
    title: document.querySelector("#review-title").value.trim(),
    body: document.querySelector("#review-body").value.trim()
  };
}

function openReviewModal(projectId) {
  state.selectedProjectId = projectId;
  const project = getSelectedProject();
  if (!project) return;
  modalProjectName.textContent = `${project.name} · 写经验帖`;
  reviewForm.reset();
  document.querySelector("#review-score").value = "5";
  modal.showModal();
}

function closeReviewModal() {
  modal.close();
  state.selectedProjectId = null;
}

function createReviewNode(review) {
  const node = reviewItemTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".review-title").textContent = review.title;
  node.querySelector(".review-score").textContent = `${"★".repeat(review.score)}${"☆".repeat(5 - review.score)}`;
  node.querySelector(".review-body").textContent = review.body;
  node.querySelector(".review-foot").textContent = `${review.author} · ${String(review.createdAt).slice(0, 10)}`;
  return node;
}

function renderTags() {
  tagStrip.innerHTML = "";
  getAllTags().forEach((tag) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-button${state.activeTag === tag ? " is-active" : ""}`;
    button.textContent = tag;
    button.addEventListener("click", () => {
      state.activeTag = tag;
      renderTags();
      renderProjects();
    });
    tagStrip.appendChild(button);
  });
}

function sortProjects(items) {
  const cloned = [...items];
  if (state.sort === "rating") {
    return cloned.sort((a, b) => getProjectStats(b.id).average - getProjectStats(a.id).average);
  }
  if (state.sort === "reviews") {
    return cloned.sort((a, b) => getProjectStats(b.id).count - getProjectStats(a.id).count);
  }
  if (state.sort === "name") {
    return cloned.sort((a, b) => a.name.localeCompare(b.name));
  }
  return cloned.sort((a, b) => (b.stars || 0) - (a.stars || 0));
}

function filteredProjects() {
  const keyword = state.search.trim().toLowerCase();
  return sortProjects(
    state.projects.filter((project) => {
      const matchesTag = state.activeTag === "全部" || (project.tags || []).includes(state.activeTag);
      const haystack = [project.name, project.fullName, project.description, ...(project.tags || [])].join(" ").toLowerCase();
      return matchesTag && (!keyword || haystack.includes(keyword));
    })
  );
}

function renderDashboard() {
  const totalReviews = state.projects.reduce((sum, project) => sum + getProjectStats(project.id).count, 0);
  const weightedScore = state.projects.reduce((sum, project) => {
    const stats = getProjectStats(project.id);
    return sum + stats.average * stats.count;
  }, 0);
  const average = totalReviews ? weightedScore / totalReviews : 0;
  document.querySelector("#metric-projects").textContent = String(state.projects.length);
  document.querySelector("#metric-reviews").textContent = String(totalReviews);
  document.querySelector("#metric-rating").textContent = average.toFixed(1);
}

function renderProjects() {
  const visibleProjects = filteredProjects();
  projectGrid.innerHTML = "";

  visibleProjects.forEach((project) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const stats = getProjectStats(project.id);
    const links = createIssueLinks(project);
    card.style.setProperty("--card-accent", project.accent || "#ff7a45");
    card.querySelector(".repo-path").textContent = project.fullName;
    card.querySelector(".project-name").textContent = project.name;
    card.querySelector(".star-pill").textContent = `★ ${project.starsLabel}`;
    card.querySelector(".project-description").textContent = project.description;
    card.querySelector(".project-note").textContent = project.note || "由 GitHub Actions 自动同步。";
    card.querySelector(".score-chip").textContent = `社区评分 ${formatScore(stats.average)}`;
    card.querySelector(".review-chip").textContent = `${stats.count} 篇经验帖`;

    const coreBadge = card.querySelector(".core-badge");
    if (project.isCore) {
      coreBadge.classList.add("is-visible");
    }

    const tagRow = card.querySelector(".tag-row");
    (project.tags || []).forEach((tag) => {
      const element = document.createElement("span");
      element.className = "tag";
      element.textContent = tag;
      tagRow.appendChild(element);
    });

    const reviewsContainer = card.querySelector(".recent-reviews");
    const reviews = stats.reviews.slice(0, 2);
    if (reviews.length) {
      reviews.forEach((review) => reviewsContainer.appendChild(createReviewNode(review)));
    } else {
      const empty = document.createElement("p");
      empty.className = "project-note";
      empty.textContent = "这个项目还没有公开经验帖，欢迎去 GitHub Issues 里写第一篇。";
      reviewsContainer.appendChild(empty);
    }

    card.querySelector(".repo-link").href = project.url;
    card.querySelector(".review-link").href = links.searchUrl;
    card.querySelector(".create-review-link").addEventListener("click", () => openReviewModal(project.id));
    projectGrid.appendChild(card);
  });

  renderDashboard();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

async function init() {
  try {
    const [config, projectsPayload, reviewsPayload] = await Promise.all([
      loadJson("./data/site-config.json"),
      loadJson("./data/projects.json"),
      loadJson("./data/reviews.json")
    ]);

    state.config = config;
    state.projects = projectsPayload.projects || [];
    state.reviewsByProject = reviewsPayload.reviewsByProject || {};
    document.querySelector(".panel-footnote").textContent =
      `项目更新于 ${String(projectsPayload.updatedAt || "").slice(0, 10)} · 评分更新于 ${String(reviewsPayload.updatedAt || "").slice(0, 10)}`;
    document.querySelector("#repo-link").href = `https://github.com/${config.siteRepoOwner}/${config.siteRepoName}`;
    renderTags();
    renderProjects();
  } catch (error) {
    projectGrid.innerHTML = `
      <article class="project-card">
        <div class="card-topline"></div>
        <h3>加载失败</h3>
        <p class="project-description">${error.message}</p>
      </article>
    `;
    showToast(error.message);
  }
}

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderProjects();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderProjects();
});

previewIssueButton.addEventListener("click", () => {
  const project = getSelectedProject();
  if (!project) return;
  const values = readReviewFormValues();
  if (!values.author || !values.title || !values.body) {
    showToast("先把昵称、标题和体验内容填完整");
    return;
  }
  const draft = buildIssueDraft(project, values);
  navigator.clipboard?.writeText(draft.body).then(
    () => showToast("Issue 正文已复制，你也可以直接提交跳转"),
    () => showToast("已生成 Issue 内容，可以直接提交跳转")
  );
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const project = getSelectedProject();
  if (!project) return;
  const values = readReviewFormValues();
  if (!values.author || !values.title || !values.body) {
    showToast("请先把表单填写完整");
    return;
  }
  const draft = buildIssueDraft(project, values);
  window.open(draft.createUrl, "_blank", "noopener,noreferrer");
  closeReviewModal();
  showToast("已跳转到 GitHub New Issue 页面");
});

closeModalButton.addEventListener("click", closeReviewModal);
modal.addEventListener("click", (event) => {
  const rect = modal.getBoundingClientRect();
  const inside =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width;
  if (!inside) {
    closeReviewModal();
  }
});

init();
