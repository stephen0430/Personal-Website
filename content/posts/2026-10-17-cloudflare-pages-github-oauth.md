---
title: Cloudflare Pages + GitHub OAuth
date: 2026-10-17
category: 随笔
tags: [个人网站建立]
cover: /assets/cover.webp
excerpt: 
---

# QXY Web：Cloudflare Pages + GitHub OAuth 安全发布配置手册

这份文档记录 QXY Web 从 Cloudflare Pages 部署，到 GitHub OAuth 登录，再到管理台发布文章的完整配置流程。

适用项目：

```text
GitHub 仓库：stephen0430/Personal-Website
公开网站：GitHub Pages 或 Cloudflare Pages
管理台：Cloudflare Pages 的 /admin.html
后端：Cloudflare Pages Functions
文章发布目标：GitHub 仓库 main 分支的 content/posts/
```

## 0. 最终效果

配置完成后，日常发布流程如下：

```text
打开 Cloudflare 管理台
        ↓
点击“登录 GitHub”
        ↓
GitHub 授权
        ↓
编辑 Markdown 文章
        ↓
点击“发布到网站”
        ↓
Cloudflare Pages Function 调用 GitHub Contents API
        ↓
文章写入 content/posts/
        ↓
GitHub Actions 运行 npm run build
        ↓
自动更新 RSS、Sitemap、搜索索引和网站
```

GitHub Token 不会写入网页、`localStorage` 或 GitHub 仓库；它只在 Cloudflare 的服务端会话中使用。

## 1. 当前项目结构

Cloudflare Pages Functions 使用根目录下的 `functions/` 文件夹。Cloudflare 会根据文件路径自动创建 API 路由；例如 `functions/api/publish.js` 对应 `/api/publish`。Functions 必须位于 Pages 项目根目录，不能放在 `dist/` 等静态输出目录中。

```text
Personal-Website/
├── index.html
├── admin.html
├── app.js
├── admin.js
├── styles.css
├── assets/
├── content/
│   ├── site.json
│   └── posts/
├── functions/
│   ├── _lib/auth.js
│   └── api/
│       ├── auth/
│       │   ├── login.js
│       │   ├── callback.js
│       │   ├── me.js
│       │   └── logout.js
│       └── publish.js
├── scripts/build.mjs
└── .github/workflows/deploy-pages.yml
```

## 2. 准备信息

部署前需要准备：

```text
GitHub 用户名：stephen0430
GitHub 仓库：stephen0430/Personal-Website
Cloudflare Pages 域名：personal-website-8cn.pages.dev
```

当前实际使用的管理台地址：

```text
https://personal-website-8cn.pages.dev/admin.html
```

当前实际 OAuth 回调地址：

```text
https://personal-website-8cn.pages.dev/api/auth/callback
```

## 3. 创建 Cloudflare Pages 项目

### 3.1 进入 Cloudflare

打开：

```text
https://dash.cloudflare.com/
```

进入：

```text
Workers & Pages
→ Create application
→ Pages
→ Connect to Git
```

Cloudflare Pages 支持连接 GitHub 仓库，并在推送到生产分支后自动部署。

### 3.2 授权 GitHub

第一次连接时，Cloudflare 会跳到 GitHub 授权页面。

推荐选择：

```text
Only select repositories
```

只允许 Cloudflare 访问：

```text
stephen0430/Personal-Website
```

如果找不到仓库，到 GitHub：

```text
Settings
→ Applications
→ Installed GitHub Apps
→ Cloudflare Workers and Pages
→ Configure
```

把 `Personal-Website` 加入允许访问的仓库。

### 3.3 选择仓库

选择：

```text
stephen0430/Personal-Website
```

点击：

```text
Begin setup
```

### 3.4 填写构建配置

```text
Project name:
personal-website

Production branch:
main

Framework preset:
None / Other

Build command:
npm run build

Build output directory:
.

Root directory:
/

Deploy command:
留空
```

当前项目的构建命令会生成：

```text
content/posts.json
rss.xml
sitemap.xml
robots.txt
```

Cloudflare Pages 的输出目录应该指向构建后的静态文件所在位置；未指定 Root directory 时，Cloudflare 默认使用仓库根目录。

### 3.5 特别注意：不要使用 `npx wrangler deploy`

之前部署时遇到过这个错误：

```text
Executing user deploy command: npx wrangler deploy
Asset too large.
node_modules/workerd/bin/workerd ... 129 MiB
```

原因是把 Pages 项目误当成普通 Worker 部署。`npx wrangler deploy` 会把整个项目根目录当作 Worker 资产目录，导致把构建环境里的 `node_modules/workerd` 也打包进去。

正确做法是：

```text
使用 Cloudflare Pages + Connect to Git
```

不要设置：

```text
Deploy command: npx wrangler deploy
```

如果 Cloudflare 页面出现 `Deploy command` 输入框，通常说明创建的是 Worker Builds 项目，而不是 Pages Git 项目。返回重新进入：

```text
Workers & Pages
→ Create application
→ Pages
→ Connect to Git
```

Cloudflare 文档也说明，Pages Functions 应通过 Pages 项目和 `functions/` 目录部署；普通 Direct Upload 不适合带 Functions 的项目。

### 3.6 记录 Pages 域名

当前项目域名为：

```text
https://personal-website-8cn.pages.dev
```

后续所有地址都基于这个域名。

## 4. 创建 GitHub OAuth App

### 4.1 进入 OAuth Apps

打开：

```text
https://github.com/settings/developers
```

进入：

```text
Developer settings
→ OAuth Apps
→ New OAuth App
```

GitHub 官方流程也是从个人设置中的 Developer settings → OAuth Apps → New OAuth App 创建。

### 4.2 填写应用信息

```text
Application name:
QXY Web Admin

Homepage URL:
https://personal-website-8cn.pages.dev/

Application description:
Private publishing console for QXY Web

Authorization callback URL:
https://personal-website-8cn.pages.dev/api/auth/callback
```

回调地址必须完全匹配，不能写成：

```text
https://personal-website-8cn.pages.dev/
```

也不能写成：

```text
https://stephen0430.github.io/Personal-Website/api/auth/callback
```

正确的回调地址必须包含：

```text
/api/auth/callback
```

### 4.3 Redirect URI 设置

GitHub OAuth App 页面中的 Redirect URI 应该是：

```text
https://personal-website-8cn.pages.dev/api/auth/callback
```

如果页面有：

```text
Allow wildcard matching
```

建议取消勾选，只允许精确回调地址。

如果页面有：

```text
Enable Device Flow
```

当前项目不需要，保持不勾选。

如果页面有：

```text
Expire user access tokens
```

当前实现尚未处理 refresh token 自动续期，建议暂时取消勾选，否则后续可能需要重新授权。GitHub 官方文档也说明，如果应用尚未支持短期 Token 过期流程，可以暂时取消该选项。

### 4.4 获取 Client ID 和 Client Secret

创建后复制：

```text
Client ID
Client Secret
```

Client Secret 只放在 Cloudflare Secret 中，不要：

- 发到聊天里；
- 写入 `content/site.json`；
- 写入 `admin.js`；
- 提交到 GitHub；
- 截图公开。

这个仓库是公开仓库，OAuth 请求使用：

```text
public_repo read:user
```

其中 `public_repo` 用来允许发布接口写入公开仓库的文章文件。

## 5. 配置 Cloudflare Variables and Secrets

### 5.1 进入变量页面

打开：

```text
Cloudflare Dashboard
→ Workers & Pages
→ personal-website
→ Settings
→ Variables and Secrets
```

选择环境：

```text
Production
```

Cloudflare Pages Functions 通过 `context.env` 读取变量和 Secrets。敏感值应使用 Secret 类型保存。

### 5.2 添加普通变量

点击：

```text
+ Add
```

选择：

```text
Type: Text
```

逐个添加下面五项。

#### GITHUB_CLIENT_ID

```text
Name:
GITHUB_CLIENT_ID

Value:
你的 GitHub OAuth Client ID
```

当前 Client ID 是：

```text
Ov23libU5isH9Ynq8cNE
```

#### GITHUB_CALLBACK_URL

```text
Name:
GITHUB_CALLBACK_URL

Value:
https://personal-website-8cn.pages.dev/api/auth/callback
```

#### ALLOWED_GITHUB_LOGIN

```text
Name:
ALLOWED_GITHUB_LOGIN

Value:
stephen0430
```

#### ADMIN_ORIGIN

```text
Name:
ADMIN_ORIGIN

Value:
https://personal-website-8cn.pages.dev
```

最后不要加 `/`。

#### ADMIN_RETURN_URL

```text
Name:
ADMIN_RETURN_URL

Value:
https://personal-website-8cn.pages.dev/admin.html
```

### 5.3 添加 Secret：GITHUB_CLIENT_SECRET

点击：

```text
+ Add
```

选择：

```text
Type: Secret
```

填写：

```text
Name:
GITHUB_CLIENT_SECRET

Value:
GitHub OAuth App 的完整 Client Secret
```

### 5.4 添加 Secret：SESSION_SECRET

在 PowerShell 运行：

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

复制生成结果，添加：

```text
Name:
SESSION_SECRET

Value:
刚才生成的随机字符串
```

Cloudflare Secrets 保存后不会在控制台显示完整值。Cloudflare 官方建议使用 Secrets 保存密码、API Token 和其他敏感信息，不要把它们写入 Wrangler 配置或 Git 仓库。

### 5.5 最终变量清单

普通 Text：

```text
GITHUB_CLIENT_ID
GITHUB_CALLBACK_URL
ALLOWED_GITHUB_LOGIN
ADMIN_ORIGIN
ADMIN_RETURN_URL
```

Secret：

```text
GITHUB_CLIENT_SECRET
SESSION_SECRET
```

每个变量至少选择：

```text
Production
```

### 5.6 保存后重新部署

保存变量后进入：

```text
Deployments
```

点击最新部署右侧的：

```text
Retry deployment
```

如果菜单显示：

```text
Retry build
```

也可以点击。

注意：环境变量保存后，必须重新部署，旧部署不会自动读取新变量。

## 6. 配置 `publicationApi`

当前 `content/site.json` 应该使用：

```json
"publicationApi": "https://personal-website-8cn.pages.dev"
```

不要填写：

```text
https://personal-website-8cn.pages.dev/api
```

也不要填写：

```text
https://YOUR-CLOUDFLARE-PAGES.pages.dev
```

发布接口会自动拼接：

```text
/api/auth/login
/api/auth/me
/api/publish
```

## 7. 测试 GitHub 登录

打开：

```text
https://personal-website-8cn.pages.dev/admin.html
```

点击：

```text
登录 GitHub
```

正常过程：

```text
管理台
→ GitHub 授权页面
→ GitHub 回调 /api/auth/callback
→ 返回 admin.html
```

成功后管理台会显示：

```text
GitHub：stephen0430
```

### 登录成功的检查项

- 页面不再显示 `GitHub 登录失败`；
- 地址栏不再停留在 `?auth=error`；
- “登录 GitHub”按钮变成 `GitHub：stephen0430`；
- “发布到网站”按钮可以点击；
- Cloudflare Functions 日志没有错误。

## 8. 测试发布文章

1. 点击 `新建`。
2. 填写标题。
3. 填写日期，格式必须是：

```text
2026-10-17
```

4. 填写分类。
5. 填写标签，多个标签用英文逗号分隔。
6. 填写摘要。
7. 写 Markdown 正文。
8. 点击 `保存草稿`。
9. 点击 `发布到网站`。

发布成功后，GitHub 仓库中会新增：

```text
content/posts/2026-10-17-文章标题.md
```

随后 GitHub Actions 会运行：

```text
npm run build
```

自动更新：

```text
content/posts.json
rss.xml
sitemap.xml
robots.txt
```

## 9. 这次实际遇到的问题和解决方法

### 问题一：Wrangler 把 `node_modules/workerd` 当成资产

错误类似：

```text
Asset too large.
node_modules/workerd/bin/workerd ... 129 MiB
```

原因：Cloudflare 项目配置成了 Worker Builds，并使用：

```text
npx wrangler deploy
```

正确做法：

```text
使用 Pages → Connect to Git
```

并设置：

```text
Build command: npm run build
Build output directory: .
Deploy command: 留空
```

不要使用：

```text
npx wrangler deploy
```

### 问题二：Cloudflare 页面显示 GitHub OAuth is not configured

原因通常是以下变量缺失或没有重新部署：

```text
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_CALLBACK_URL
```

处理方法：

1. 检查变量是否在 `Production` 环境；
2. 检查名称拼写是否完全一致；
3. 点击 Retry deployment；
4. 清除浏览器旧缓存后重新打开管理台。

### 问题三：GitHub OAuth 回调显示登录失败

最常见原因：

- GitHub OAuth App 的 callback URL 不一致；
- Cloudflare 的 `GITHUB_CALLBACK_URL` 不一致；
- Client Secret 错误；
- `SESSION_SECRET` 缺失；
- `ALLOWED_GITHUB_LOGIN` 不是 `stephen0430`；
- 管理台不是从 `personal-website-8cn.pages.dev` 打开的。

正确回调地址必须是：

```text
https://personal-website-8cn.pages.dev/api/auth/callback
```

### 问题四：显示 OAuth 回调内部错误

项目后来增加了错误分类，管理台会显示更具体的原因：

```text
token_exchange_failed
github_profile_failed
session_creation_failed
state_mismatch
session_secret_missing
```

同时可以在 Cloudflare：

```text
Workers & Pages
→ personal-website
→ Logs / Functions logs
```

查看 Functions 日志。

### 问题五：使用了 GitHub Pages 的管理台

不建议使用：

```text
https://stephen0430.github.io/Personal-Website/admin.html
```

发布时应使用 Cloudflare 同源管理台：

```text
https://personal-website-8cn.pages.dev/admin.html
```

这样管理台、OAuth 回调和 Functions API 都在同一个域名下，登录 Cookie 更稳定。

## 10. 安全注意事项

不要把这些值发到聊天、截图、GitHub Issue 或代码文件中：

```text
GITHUB_CLIENT_SECRET
SESSION_SECRET
```

如果 Client Secret 泄露：

1. GitHub OAuth App 页面点击 `Generate a new client secret`；
2. 更新 Cloudflare 的 `GITHUB_CLIENT_SECRET`；
3. 重新部署 Cloudflare Pages。

如果 `SESSION_SECRET` 泄露：

1. 生成新的随机字符串；
2. 更新 Cloudflare Secret；
3. 重新部署；
4. 所有旧登录会话都会失效，需要重新登录。

当前发布接口只允许：

```text
stephen0430
```

如果需要更换管理者，修改 Cloudflare 变量：

```text
ALLOWED_GITHUB_LOGIN
```

## 11. 最终检查清单

- [ ] Cloudflare 项目类型是 Pages，不是普通 Worker
- [ ] GitHub 仓库是 `stephen0430/Personal-Website`
- [ ] Production branch 是 `main`
- [ ] Build command 是 `npm run build`
- [ ] Build output directory 是 `.`
- [ ] 没有配置 `npx wrangler deploy`
- [ ] GitHub OAuth Homepage URL 正确
- [ ] GitHub OAuth callback URL 正确
- [ ] `GITHUB_CLIENT_ID` 已配置
- [ ] `GITHUB_CLIENT_SECRET` 使用 Secret 类型
- [ ] `GITHUB_CALLBACK_URL` 与 GitHub 页面完全一致
- [ ] `ALLOWED_GITHUB_LOGIN=stephen0430`
- [ ] `ADMIN_ORIGIN` 使用 Pages 域名
- [ ] `ADMIN_RETURN_URL` 使用 Pages 管理台地址
- [ ] `SESSION_SECRET` 使用 Secret 类型
- [ ] 保存变量后重新部署
- [ ] 使用 Cloudflare 管理台登录
- [ ] GitHub 登录成功
- [ ] 发布测试文章成功
- [ ] GitHub `content/posts/` 出现新 Markdown 文件
- [ ] Actions 构建成功
- [ ] 网站首页出现新文章
