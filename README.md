# research-agent-rating-hub-pages

一个部署在 GitHub Pages 上的免费社区榜单，用来给 GitHub 上的开源 auto research agent 项目打分，并通过 GitHub Issues 收集经验分享帖。

在线地址：

- https://karin0018.github.io/research-agent-rating-hub-pages/

## 仓库功能

- 展示 GitHub 上高关注度的 auto research agent / deep research agent 项目
- 以卡片形式展示项目名称、GitHub 链接、星标、标签、简介和社区评分
- 用户可以在页面里点击“写经验帖”，先在站内弹窗填写内容
- 提交后会自动跳转到 GitHub `new issue` 页面，并预填标题与正文
- 站点会自动从 GitHub Issues 聚合评分和经验帖摘要
- GitHub Actions 会定时同步项目榜单，并在新 Issue 创建或编辑后自动更新页面数据

## 收录项目

- [karpathy/autoresearch](https://github.com/karpathy/autoresearch)
- [bytedance/deer-flow](https://github.com/bytedance/deer-flow)
- [assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher)

## 数据来源

- 项目榜单：GitHub API
- 经验帖与评分：本仓库 GitHub Issues
- 页面托管：GitHub Pages
- 自动更新：GitHub Actions

## 经验帖规则

- 每篇经验帖是一个 GitHub Issue
- 标题需要以 `[Review]` 开头
- Issue 正文里需要包含：
  - `Project: owner/repo`
  - `Rating: 1-5`

站点会自动解析这些 Issue，并把它们展示为项目评分和最新评论。

## 主要文件

- `index.html` `styles.css` `app.js`：静态前端页面
- `data/projects.json`：项目榜单缓存
- `data/reviews.json`：评分和经验帖摘要缓存
- `data/site-config.json`：站点仓库配置
- `scripts/sync-projects.mjs`：同步 GitHub 项目与 Issues 数据
- `.github/workflows/deploy-pages.yml`：同步数据并部署 GitHub Pages
- `.github/ISSUE_TEMPLATE/review.yml`：经验帖模板
