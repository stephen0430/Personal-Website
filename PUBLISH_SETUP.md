# Cloudflare 安全发布配置

管理台使用 GitHub OAuth 登录，再通过 Cloudflare Pages Functions 把 Markdown 提交到 `stephen0430/Personal-Website`。GitHub Pages 继续可以作为公开网站，但推荐把网站和管理台一起部署到 Cloudflare Pages，这样 OAuth Cookie 与 API 同源。

## 一、创建 Cloudflare Pages 项目

1. 登录 Cloudflare 控制台。
2. 打开 `Workers & Pages`。
3. 点击 `Create application`。
4. 选择 `Pages`，再选择连接 Git。
5. 连接 GitHub 并选择 `stephen0430/Personal-Website`。
6. 生产分支选择 `main`。
7. 构建配置填写：

```text
Framework preset: None / Other
Build command: npm run build
Build output directory: .
Root directory: /
```

当前项目是静态 HTML/CSS/JS，构建脚本只负责生成 `content/posts.json`、`rss.xml`、`sitemap.xml` 和 `robots.txt`。`functions/` 目录会自动作为 Pages Functions 路由。

部署完成后会得到一个地址，例如：

```text
https://qxy-web.pages.dev
```

之后管理台使用：

```text
https://qxy-web.pages.dev/admin.html
```

## 二、修改站点 API 地址

在 `content/site.json` 中把：

```json
"publicationApi": "https://YOUR-CLOUDFLARE-PAGES.pages.dev"
```

改成你的真实 Cloudflare Pages 地址，例如：

```json
"publicationApi": "https://qxy-web.pages.dev"
```

不要写 `/api`，也不要在末尾加 `/`。

## 三、创建 GitHub OAuth App

进入 GitHub：

```text
头像
→ Settings
→ Developer settings
→ OAuth Apps
→ New OAuth App
```

填写：

```text
Application name:
QXY Web Admin

Homepage URL:
https://qxy-web.pages.dev/

Authorization callback URL:
https://qxy-web.pages.dev/api/auth/callback
```

回调地址必须和实际 Cloudflare Pages 域名完全一致。创建后复制 `Client ID` 和 `Client Secret`。仓库是公开仓库，OAuth 授权需要 `public_repo` 和 `read:user` 权限；代码已经使用 `state` 和 PKCE 保护授权流程。`Client Secret` 不能提交到仓库。

## 四、配置 Cloudflare Variables and Secrets

进入：

```text
Cloudflare Dashboard
→ Workers & Pages
→ 你的 Pages 项目
→ Settings
→ Variables and Secrets
```

普通变量：

```text
GITHUB_CLIENT_ID=GitHub OAuth App 的 Client ID
GITHUB_CALLBACK_URL=https://qxy-web.pages.dev/api/auth/callback
ALLOWED_GITHUB_LOGIN=stephen0430
ADMIN_ORIGIN=https://qxy-web.pages.dev
ADMIN_RETURN_URL=https://qxy-web.pages.dev/admin.html
```

加密 Secret：

```text
GITHUB_CLIENT_SECRET=GitHub OAuth App 的 Client Secret
SESSION_SECRET=随机字符串
```

在 PowerShell 生成 `SESSION_SECRET`：

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

把生成结果直接粘贴到 Cloudflare Secret，不要写进 GitHub 文件，也不要发给我。每个变量至少选择 `Production` 环境。

## 五、重新部署

保存变量后，在 Cloudflare Pages 的 `Deployments` 中点击最新部署的重新部署按钮，或者向 `main` 推送新提交触发自动部署。

## 六、测试登录

打开：

```text
https://qxy-web.pages.dev/admin.html
```

点击 `登录 GitHub`，完成授权后应该回到：

```text
https://qxy-web.pages.dev/admin.html?auth=success
```

如果管理台显示 `GitHub：stephen0430`，说明登录成功。

## 七、测试发布

1. 点击 `新建`。
2. 填写标题、日期、分类、标签、摘要和正文。
3. 点击 `保存草稿`。
4. 点击 `发布到网站`。
5. Cloudflare Function 调用 GitHub Contents API。
6. GitHub 新增 `content/posts/日期-标题.md`。
7. GitHub Pages 和 Cloudflare Pages 自动重新构建。

GitHub Actions 会在提交文章后运行 `npm run build`，更新文章索引、RSS、Sitemap 和 robots.txt。

## 八、常见错误

### `GitHub OAuth is not configured`

检查 Cloudflare 是否配置了 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_CALLBACK_URL`。

### `redirect_uri_mismatch`

检查 GitHub OAuth App 的回调地址和 Cloudflare 的 `GITHUB_CALLBACK_URL` 是否完全一致。

### `GitHub login required`

检查是否使用 Cloudflare 的 `admin.html` 地址、是否完成 GitHub 授权、`ALLOWED_GITHUB_LOGIN` 是否为 `stephen0430`、OAuth App 是否包含 `public_repo` 权限，以及 Cloudflare 变量保存后是否重新部署。

### 管理台显示“等待配置发布后端”

说明 `content/site.json` 里的 `publicationApi` 还是占位地址：

```text
https://YOUR-CLOUDFLARE-PAGES.pages.dev
```

把真实 Pages 域名填进去并推送即可。
