# 安全发布配置

管理台现在支持“登录 GitHub -> 发布到网站”，但需要先部署 `api/` 目录。GitHub Pages 只负责展示静态文件，OAuth 和 GitHub 写入权限由 Vercel Serverless Functions 负责。

## 1. 部署 API

在 Vercel 中导入同一个 `Personal-Website` 仓库，项目根目录保持仓库根目录，Framework Preset 选择 `Other`。部署后得到一个地址，例如：

```text
https://qxy-web-api.vercel.app
```

把这个地址写入 `content/site.json` 的 `publicationApi`，再提交一次：

```json
"publicationApi": "https://qxy-web-api.vercel.app"
```

## 2. 创建 GitHub OAuth App

在 GitHub 的 Developer Settings 创建 OAuth App，回调地址填写：

```text
https://qxy-web-api.vercel.app/api/auth/callback
```

不要把 Client Secret 写进仓库。

## 3. 配置 Vercel 环境变量

```text
GITHUB_CLIENT_ID=你的 OAuth App Client ID
GITHUB_CLIENT_SECRET=你的 OAuth App Client Secret
GITHUB_CALLBACK_URL=https://qxy-web-api.vercel.app/api/auth/callback
ALLOWED_GITHUB_LOGIN=stephen0430
ADMIN_ORIGIN=https://stephen0430.github.io
ADMIN_RETURN_URL=https://stephen0430.github.io/Personal-Website/admin.html
SESSION_SECRET=一段至少 32 位的随机字符串
```

## 4. 发布流程

1. 打开 `admin.html`。
2. 点击“登录 GitHub”。
3. GitHub 授权后回到管理台。
4. 编辑或新建文章。
5. 点击“发布到网站”。
6. API 会把 Markdown 提交到 `content/posts/`。
7. GitHub Actions 自动运行 `npm run build`，更新文章索引、RSS、Sitemap 和 GitHub Pages。

GitHub Token 只存在于服务端加密会话 Cookie 中，不保存到 localStorage，也不会写入网页源码。
