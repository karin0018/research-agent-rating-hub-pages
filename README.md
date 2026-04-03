# research-agent-rating-hub-pages

一个适合免费部署到 GitHub Pages 的版本。

## 方案特点

- 不需要租服务器
- 页面托管在 GitHub Pages
- 项目榜单由 GitHub Actions 定时同步到静态 JSON
- 用户经验帖直接写进 GitHub Issues
- 前端只读取仓库里的缓存文件，加载稳定

## 文件结构

- `index.html` `styles.css` `app.js`：静态前端
- `data/projects.json`：项目榜单缓存
- `data/reviews.json`：评分和经验帖摘要缓存
- `data/site-config.json`：站点仓库配置
- `scripts/sync-projects.mjs`：同步 GitHub 项目与 Issues 数据
- `.github/workflows/sync-data.yml`：定时同步数据
- `.github/workflows/deploy-pages.yml`：部署 Pages
- `.github/ISSUE_TEMPLATE/review.yml`：经验帖模板

## 使用步骤

1. 把这个文件夹单独放进一个 GitHub 仓库
2. 修改 [site-config.json](/Users/roey/work/research-agent-rating-hub-pages/data/site-config.json) 里的：
   - `siteRepoOwner`
   - `siteRepoName`
3. 把仓库默认分支设为 `main`
4. 打开仓库的 `Settings -> Pages`
5. 选择 `GitHub Actions` 作为部署来源
6. 启用仓库 `Issues`
7. 手动运行一次 `Sync Projects And Reviews`
8. 再运行或等待 `Deploy GitHub Pages`

## 评分帖怎么工作

- 每篇经验帖是一个 GitHub Issue
- 需要带 `review` 标签
- 需要带 `project:<project-id>` 标签
- Issue 正文里需要包含一行：`Rating: 1-5`

站点会把这些 Issue 聚合成项目评分和最新评论。

## 本地预览

可以直接用任意静态文件服务器打开这个目录，比如：

```bash
cd /Users/roey/work/research-agent-rating-hub-pages
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000`。
