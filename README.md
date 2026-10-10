# avatar-dressup

基于 three.js 的 3D 虚拟人换装，加一个走服务端适配器的「AI 海报」。Next.js 16 加 React 19，部署在腾讯云云托管。

- 首页 `/`：介绍页。
- 换装页 `/create`：七个部位换装、一键套装、底模切换、待机动画、截图、生成海报。
- 海报接口 `POST /api/poster`：当前只有假适配器（sharp 做风格化），真实 AI 服务以后接。

## 本地运行

```bash
npm install
cp .env.example .env.local      # POSTER_PROVIDER=mock
npm run dev                     # http://localhost:3000
```

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建，standalone 输出 |
| `npm start` | 跑生产构建 |
| `npm run typecheck` | tsc 类型检查 |
| `npm test` | vitest 单元测试 |
| `npm run assets:scan` / `assets:build` | 从 assets-src 生成模型与 manifest，见 docs/ASSETS.md |
| `npm run fonts:build` | 按源码字符子集化两款自托管字体 |
| `npm run landing:webp` | 首页海报素材转 webp |

## 环境变量

| 变量 | 何时生效 | 说明 |
|---|---|---|
| `POSTER_PROVIDER` | 运行时 | 海报适配器，当前只有 `mock`；未设置或拼错时接口返回 500 |
| `NEXT_PUBLIC_ASSET_BASE` | 构建时 | 模型贴图的基址，默认同源 `/avatar/` |
| `NEXT_PUBLIC_REPO_URL` | 构建时 | 首页 GitHub 按钮，留空不显示 |

## 部署到腾讯云云托管

```bash
npm i -g @cloudbase/cli
tcb login
tcb cloudrun deploy --port 3000
```

部署后在控制台「云托管 → 服务 → 服务设置」里：环境变量加 `POSTER_PROVIDER=mock`；规格 0.25 核 0.5 GB；副本模式高可用，最小 1 最大 2。云端构建用仓库里的 Dockerfile。

本机有 Docker 时可以先验证镜像：

```bash
docker build -t avatar-dressup:local .
docker run --rm -p 3000:3000 -e POSTER_PROVIDER=mock avatar-dressup:local
```

## 文档

- 设计：`docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-10-nextjs-cloudbase-poster.md`
- 3D 换装核心设计：`docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md`
- 素材：`docs/ASSETS.md`

## 素材与许可

模型来自 Quaternius 的 Universal Base Characters、Modular Character Outfits - Fantasy、Universal Animation Library，CC0。字体 Orbitron 与站酷庆科黄油体，OFL。
