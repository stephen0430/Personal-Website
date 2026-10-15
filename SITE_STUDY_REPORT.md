# Study-HYK 网站学习报告

> 研究对象：`https://study.hykpromax.top/`
>
> 研究时间：2026-10-15（Asia/Shanghai）

## 1. 结论先行

Study-HYK 是一个 **Hexo 静态博客**，使用 Butterfly 主题，并通过 Git 维护源码、构建生成静态文件，再发布到静态托管平台。它没有登录、后台编辑器、数据库或文章发布 API；“上传内容”发生在本地源码仓库中，网页端只负责阅读和浏览。

观测到的核心版本和配置：

| 项目 | 观测结果 |
| --- | --- |
| 静态生成器 | Hexo 8.1.2 |
| 主题 | Butterfly 5.5.5 |
| 文章数 | 37 |
| 标签数 | 85 |
| 分类数 | 4 |
| 分类分布 | 学习 21、杂谈 2、语音信号处理 3、项目复盘 11 |
| 站点总字数 | 约 82.2k |
| 托管信号 | 页脚徽章标注 Vercel、4EVERLAND，源码由 GitHub 管理 |
| 域名信号 | 当前访问域为 `study.hykpromax.top`，canonical 和文章版权链接大量指向 `learn.hykpromax.top` |
| 搜索 | 浏览器端本地搜索，数据来自 `/search.xml` |
| 评论 | 观测到的文章页没有评论表单或评论区 |

核心模式是：**Markdown 内容 -> Hexo 构建 -> HTML/CSS/JS 成品 -> 静态托管 -> 浏览器端增强交互。**

## 2. 页面和路由地图

| 路由 | 用途 | 页面特点 |
| --- | --- | --- |
| `/` | 首页 | 全屏头图、一言、社交链接、文章卡片、侧栏 |
| `/page/2/` ... | 首页分页 | 与首页同一套文章卡片和侧栏 |
| `/archives/` | 时间轴 | 按年份和日期列出全部文章 |
| `/tags/` | 标签云 | 标签字号和颜色随文章关联变化 |
| `/tags/<tag>/` | 单标签列表 | 某标签下的文章 |
| `/categories/` | 分类页 | 分类名称和文章数 |
| `/categories/<category>/` | 单分类列表 | 某分类下的文章 |
| `/link/` | 友链页 | 以文章内容形式展示技术支持和外链 |
| `/about/` | 关于页 | 极简居中内容，隐藏侧栏 |
| `/:year/:month/:day/:slug/` | 文章页 | 头图、元信息、正文、目录、版权、分享 |
| `/search.xml` | 搜索索引 | 标题、URL、分类、标签和正文 |
| 任意不存在路径 | 404 | 自定义 404 卡片和返回建议 |

共享外层结构大致如下：

```text
body
├── #web_bg                 全站背景图层
├── #sidebar                移动端和桌面侧边菜单
├── #body-wrap
│   ├── #page-header / post-bg / not-home-page
│   ├── #nav                 站点导航
│   ├── #content-inner       页面主体
│   └── #footer               页脚和技术徽章
├── #rightside                设置、夜间模式、回到顶部
└── #local-search             搜索弹层
```

## 3. 技术栈和文件职责

HTML 明确包含 `meta name="generator" content="Hexo 8.1.2"`，页脚还展示 Hexo 和 Butterfly 版本徽章。页面使用 Butterfly 的 `GLOBAL_CONFIG`：本地搜索、代码复制、图片灯箱、目录、简繁转换和 PJAX 刷新都由它驱动。

| 文件/资源 | 作用 |
| --- | --- |
| `/css/index.css?v=5.5.5` | Butterfly 主样式 |
| `/css/custom.css` | 蓝色头图/页脚、极简关于页、增强 404 |
| `/css/runtime.css` | 运行时间电子钟和页脚徽章提示 |
| `/js/utils.js` | 滚动、动画、PJAX、公共事件工具 |
| `/js/main.js` | 侧栏、代码块、右侧工具栏、目录、图片增强 |
| `/js/tw_cn.js` | 简体/繁体替换和状态保存 |
| `/js/search/local-search.js` | 读取 `/search.xml` 并执行本地搜索 |
| `/js/runtime.js` | 建站运行时间 |
| `/js/hitokoto-typed.js` | 一言接口和 Typed.js 打字动画 |
| `busuanzi.pure.mini.js` | UV/PV 统计 |
| `canvas-nest.min.js` | 背景粒子/连线效果，移动端关闭 |

外部依赖包括 Font Awesome、Typed.js、Mermaid、KaTeX、medium-zoom、InfiniteGrid、CDN 字体和图片。关键视觉资源主要来自外部图床，文章图片还出现了 CSDN 和 loli 图床地址。

### 静态和动态边界

**构建时生成：** 文章页、首页列表、归档、分类、标签、搜索 XML、SEO 元信息、canonical、Open Graph。

**浏览器运行时：** 一言、运行时间、Busuanzi 统计、暗色模式、简繁转换、搜索结果、目录高亮、代码复制提示、图片放大、Mermaid、KaTeX、PJAX 状态。

它仍然是静态站点，只是在浏览器端叠加了若干无后端交互。

## 4. 首页展示设计

### 首屏

- 全屏背景图加半透明蓝色头图层。
- 顶部显示站点名、搜索和移动端菜单入口。
- 中央显示 `Study-HYK`、随机一言/出处、GitHub 和 Bilibili 图标。
- 底部向下箭头点击后滚动到 `#content-inner`。
- 移动端首屏接近完整视口，先建立个人品牌和氛围，再进入文章列表。

### 文章卡片

每张卡片包含封面、标题、发布时间、分类和摘要，封面或标题都能进入文章页。移动端是一列布局，桌面端由 Butterfly 控制卡片与侧栏的比例。

### 侧栏信息架构

头像和作者名 -> 文章/标签/分类数量 -> GitHub/Bilibili -> 公告 -> 最新文章 -> 分类 -> 标签 -> 月度归档 -> 网站信息。

这套结构同时支持按最新内容、主题、分类、标签和时间浏览，适合知识型个人博客。

## 5. 文章页展示设计

文章页由四段组成：

```text
文章头图
├── 标题
├── 发表于 / 更新于 / 分类
├── 总字数 / 阅读时长 / 浏览量

正文卡片
├── 段落、标题、列表、引用、表格
├── 代码块：语言、行号、复制和折叠工具
├── 图片：懒加载 + medium-zoom
├── Mermaid：运行时转 SVG，可打开、缩放、拖动
└── KaTeX：运行时加载公式样式

正文之后
├── 版权声明
├── 社交分享
├── 下一篇/上一篇
└── 侧栏目录和最新文章
```

文章标题会生成锚点 ID，目录直接跳到小节。页面还设置了 `description`、Open Graph、文章标签和 canonical，用于分享和搜索引擎抓取。

## 6. 用户交互清单

| 交互 | 实际行为 | 主要实现 |
| --- | --- | --- |
| 移动端菜单 | 汉堡按钮打开带遮罩的侧边导航 | `#sidebar-menus`、`#menu-mask` |
| 搜索 | 打开全屏弹层，本地匹配标题、标签和正文 | `/search.xml` + `local-search.js` |
| 夜间模式 | 切换 `html[data-theme]`，更新主题和背景 | localStorage 的 `theme` |
| 简繁转换 | 递归替换文本、标题、alt、placeholder | cookie `translate-chn-cht` |
| 单栏/双栏 | 隐藏或显示 aside | localStorage 的 `aside-status` |
| 阅读模式 | 保留文章阅读区，隐藏干扰项 | `read-mode` class |
| 移动端目录 | 弹出目录面板并跳转 | `mobile-toc-button` |
| 回到顶部 | 平滑滚动到页面顶部 | `go-up` + `scrollToDest` |
| 代码复制 | 复制代码并显示成功/失败提示 | Clipboard API |
| 图片放大 | 点击图片进入灯箱 | medium-zoom |
| Mermaid | 运行时渲染，支持拖动、缩放和重置 | Mermaid + 自定义事件 |
| 一言 | 异步请求句子和出处并循环打字 | `v1.hitokoto.cn` + Typed.js |
| 统计 | 异步展示 UV/PV | Busuanzi |

观测到的交互都不需要登录或提交表单，状态尽量保存在浏览器本地；站点没有在线投稿或后台编辑入口。

## 7. 内容上传和日常写作

### 推荐目录

```text
blog/
├── source/
│   ├── _posts/              # 文章 Markdown
│   ├── about/index.md       # 关于页
│   └── link/index.md        # 友链页
├── themes/butterfly/        # 主题
├── public/                  # Hexo 生成的静态成品
├── _config.yml              # Hexo 主配置
├── _config.butterfly.yml   # Butterfly 配置
├── package.json
└── package-lock.json
```

### 文章 front matter

```markdown
---
title: 文章标题
date: 2026-10-15 12:00:00
updated: 2026-10-15 12:00:00
categories:
  - 学习
tags:
  - Hexo
  - 博客搭建
cover: /images/posts/hexo-cover.webp
description: 首页摘要和 SEO 描述
---

正文写在这里。
```

标题、日期、分类、标签、封面和摘要来自 front matter 或主题配置。Hexo 每次生成时会自动刷新首页、归档、分类、标签和 `search.xml`。

### 本地预览和部署

目标站点文章中明确展示了这套日常流程：

```powershell
# 新文章放进 source/_posts/
npm run build
npm run server
npm run deploy
```

推荐的完整流程是：编辑 Markdown -> `npm run build` -> `npm run server` 检查 -> 确认图片/代码/公式/目录 -> `npm run deploy` 发布 -> 线上复查。

### 源码和成品要分开

`git add / git commit / git push` 是推送 Git 仓库内容；`npm run deploy` 是生成 `public` 后发布静态成品。建议源码放独立分支或私有仓库，发布分支只放生成文件，避免把 `hexo-source`、备份网页、`node_modules` 和 `public` 混在一起。

## 8. 部署、域名和 SEO

从页面徽章和 canonical 看，它采用了多线路静态托管思路：

```text
本地 Hexo 源码
      |
      v
GitHub 静态成品分支
      |
      +--> Vercel 主线路
      +--> 4EVERLAND 备用线路
      +--> 自定义域名
```

当前访问域是 `study.hykpromax.top`，但 canonical、文章版权链接和 Open Graph URL 大量指向 `learn.hykpromax.top`。如果这是镜像域名，应统一 DNS、重定向和 canonical；如果不是有意设计，应在 Hexo `url`、主题配置和部署域名中统一。

在 2026-10-15 检查时，以下路径返回 404：`/robots.txt`、`/sitemap.xml`、`/atom.xml`、`/rss.xml`、`/manifest.json`。建议至少补上 `robots.txt` 和 sitemap。

## 9. 风险和改进建议

1. **域名信号不一致**：会造成 SEO、分享链接和统计分裂。
2. **第三方 CDN 较多**：头像、背景、封面、脚本和统计可能受外部服务影响；关键资源应放到自己的对象存储或仓库，并加失败降级。
3. **搜索索引偏大**：当前 `/search.xml` 约 633 KB，且包含文章正文；文章变多后可改为轻量 JSON 或分片索引。
4. **没有在线内容管理**：静态方案维护简单、攻击面小，但没有草稿、评论审核和协作。需要评论时可单独接入评论服务，不必把 Hexo 改成数据库应用。
5. **统计依赖运行时脚本**：Busuanzi 或网络失败时应显示静态兜底，避免加载状态长期留在页面上。

## 10. 在当前工作区复刻的顺序

当前工作区只有一个空 Git 仓库，没有现成网站代码。建议按以下顺序实现：

1. 初始化 Hexo 和 Butterfly；
2. 完成首页、文章、归档、标签、分类、关于、友链七类页面；
3. 用 3 篇示例文章验证 Markdown、代码、图片、表格、公式和 Mermaid；
4. 加入蓝色透明头图/页脚、极简关于页和自定义 404；
5. 加入本地搜索、暗色模式、简繁切换、代码复制和图片灯箱；
6. 配置源码分支和静态发布分支；
7. 统一唯一 canonical 域名；
8. 增加 robots、sitemap 和部署后检查；
9. 最后再加入一言、运行时间、统计和背景动画。

### 发布前检查

- [ ] 首页、文章、归档、标签、分类、关于、友链和 404 都能访问
- [ ] 移动端没有横向溢出
- [ ] front matter、摘要、封面、分类和标签完整
- [ ] 搜索能命中标题、标签和正文关键词
- [ ] 代码复制、目录跳转、图片放大、公式和 Mermaid 正常
- [ ] canonical、Open Graph、版权链接使用同一个主域名
- [ ] 发布分支不包含源码备份和 `node_modules`
- [ ] 外部图片和脚本失败时有降级
- [ ] robots、sitemap、RSS 按需求提供

## 11. 一句话总结

这个网站的核心不是后台 CMS，而是 **用 Hexo 编译 Markdown，用 Butterfly 提供成熟页面骨架，再用少量自定义 CSS 和浏览器端脚本形成个人风格与交互**。内容维护靠本地 Git，页面展示靠静态生成物，动态体验靠 JavaScript，部署靠静态托管平台。

