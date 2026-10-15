---
name: avatar-dressup-a-deferred-cleanup
overview: 收尾子项目 A 评审时 deferred 的 12 项小问题：前端交互与竞态（PosterDialog 中止/焦点陷阱、空场景海报、相机分段不同步、两处 dispose 泄漏）、后端两条缺失的回归测试、.gitignore 与两个脚本的健壮性，并把规格文档与实现的两处偏差同步回来。分 4 批推进，每批跑 npm test 与 npm run typecheck。
todos:
  - id: hardening-config
    content: 把根目录素材 zip 与 pdf 加入 .gitignore，并把 build-fonts 的字体镜像固定到 commit 6692879
    status: completed
  - id: manifest-memory-repair
    content: 新增 scripts/lib/gltf-resources.mjs，改 build-manifest 用 io.readJSON 内存修 uri，配单测并跑 assets:scan 回归
    status: completed
  - id: poster-tests
    content: 在 tests/posterRoute.test.ts 补两条回归测试：FF D8 损坏 JPEG 返回 500、Content-Length 超限不进请求解析
    status: completed
  - id: dialog-race-focus
    content: 给 PosterDialog 加 AbortController、请求序号、Esc 关闭与 Tab 焦点陷阱
    status: completed
  - id: viewer-dispose-leaks
    content: AvatarViewer 与 ThumbnailRenderer 加 disposed 短路，用 [skill:lsp-code-analysis] 核对调用点
    status: completed
  - id: guard-poster-and-focus-sync
    content: 底模加载中禁用生成海报，切底模后分段控件同步回全身
    status: completed
  - id: docs-and-ledger
    content: 同步规格三处事实偏差并在 progress.md 追加本轮记录
    status: completed
    dependencies:
      - hardening-config
      - manifest-memory-repair
      - poster-tests
      - dialog-race-focus
      - viewer-dispose-leaks
      - guard-poster-and-focus-sync
---

## 产品概述
`avatar-dressup` 是 three.js 3D 虚拟人换装 + 服务端假适配器「AI 海报」的站点，子项目 A（Next.js 迁移、换装页、假海报、云托管部署）已全部落地（`dev` 分支，最新 `4ae3b3`/`4ace3b3`），但整体评审留下 12 条 deferred 小问题未收尾。本轮只做这些遗留项的清理，不新增功能、不改界面文案与对外契约。

## 核心功能
- **海报弹窗健壮性**：关闭弹窗或组件卸载时中止在途请求，响应回来不再写状态、不再创建悬挂的 blob URL；弹窗支持 Esc 关闭、打开时焦点进入弹窗、Tab 在弹窗内循环、关闭后焦点归还。
- **资源释放正确性**：3D 视口销毁后不再回调加载状态、不再推相机；缩略图渲染器销毁后排队的渲染不再重建 WebGL 上下文。
- **交互状态一致性**：底模仍在加载时「生成海报」不可点（避免截出空场景）；切换底模后相机回全身，分段控件也同步显示「全身」。
- **后端补测**：补齐两条回归测试，覆盖「FF D8 开头但内容损坏的 JPEG 返回 500」与「声明长度超上限时不进入请求解析」。
- **工程健壮性与可复现**：仓库根目录的素材 zip 与 pdf 不再出现在 git 状态里；字体下载镜像固定在某个 commit，不随 `main` 漂移；素材脚本修贴图名时改为内存映射，不再往 `assets-src` 写文件。
- **文档对齐**：把规格文档中 3 处与实现不符的描述改成事实，并在评审账本追加本轮记录。

## 范围边界
不改七槽位规则、manifest 结构、`POST /api/poster` 状态码与固定文案、截图 768×1152 q0.85；不引入限流/鉴权（属子项目 C）；不引入新的测试框架。


## 技术栈
全部沿用现有栈，不新增依赖：Next.js 16 App Router + React 19（客户端组件）、zustand 5、three 0.186 + @types/three、sharp 0.35（服务端）、vitest 5（`environment: 'node'`，alias `@` → `./src`）、@gltf-transform/core 4.5、TypeScript 严格模式。
已核实可用性：`node_modules/@gltf-transform/core/dist/index.d.ts` 提供 `JSONDocument = { json: GLTF, resources: Record<uri, Uint8Array> }` 与 `NodeIO.readJSON(jsonDoc): Promise<Document>`；本机存在 `assets-src/`，可做只读回归。

## 实现方案
分 4 批推进，每批结束跑 `npm test` 与 `npm run typecheck`。

**批 1｜配置与可复现（零行为风险）**
- `.gitignore` 追加根锚定规则 `/*.zip` 与 `/*.pdf`，只排仓库根目录的素材包，不影响 `public/`、`app/` 下任何文件。
- `scripts/build-fonts.mjs` 把 `GITHUB_FONTS` 从 `@main` 改为固定 commit `6692879`（已通过 `api.github.com/repos/google/fonts/commits/main` 核到 sha `66928797f271fed5ee428544e7229685e2d90127`，2026-10-12）。因本轮不改任何界面中文文案，**不重跑 `fonts:build`**，产物 woff2 已在 git 中，仅让重跑时结果可复现。注意：本机当前访问 `cdn.jsdelivr.net` 不通，脚本跑不通属环境问题，不影响该改动（提交信息里说明验证手段）。

**批 2｜资源脚本内存化（有单测）**
新增 `scripts/lib/gltf-resources.mjs`，导出纯函数（可注入 `exists`，便于测试）：

```js
/** 把 .gltf 里引用但磁盘缺失的 uri 解析到实际存在的替代文件名，纯计算不写盘 */
export function resolveGltfUris(json, exists, decode = decodeURIComponent)
// 返回 { entries: [{ uri, actualUri | null }], repairs: [{ uri, from }] }
```

`scripts/build-manifest.mjs` 里删掉 `repairResourceNames` 的 `copyFile` 分支，改为：读 `.gltf` JSON → `resolveGltfUris(json, (rel) => existsSync(path.join(dir, rel)))` → 对每个 `uri` 用 `readFile` 读 `actualUri` 的字节，组成 `resources`（**key 必须是 JSON 里原样的 `uri` 字符串**，含百分号编码）→ `await io.readJSON({ json, resources })` 得到 `Document`；`console.warn('修复: …')` 文案保留。`.glb` 分支仍走 `io.read(abs)`。
回归：`npm run assets:scan` 在本机 `assets-src/` 上跑通且修复日志与改造前一致。
单测 `tests/gltfResources.test.mjs`：命中原名不改、缺 `_png.png` 时解析到 `.png`、缺 `.png` 时解析到 `_png.png`、两者都缺时 `actualUri: null`；沿用 `tests/classify.test.mjs` 的 `../scripts/...` 相对导入风格。

**批 3｜后端两条回归测试**
`tests/posterRoute.test.ts` 追加：
- 损坏 JPEG → 500：`data:image/jpeg;base64,` + `Buffer.from([0xff,0xd8,0x00,0x00,0x00,0x00])`，`POSTER_PROVIDER=mock`；断言 `status === 500` 且 `error` 以「海报生成失败：」开头（证明 `parsePosterRequest` 放行后由适配器失败兜住，而不是 400/崩溃）。
- Content-Length 超限不进解析：用 `vi.mock('@/poster/request', ...)` 做 partial mock，把 `parsePosterRequest` 包成 `vi.fn(actual.parsePosterRequest)`，测试里传一个 `as unknown as Request` 的轻量对象（`headers: new Headers({ 'content-length': String(MAX_BODY_BYTES + 1) })`，body 为合法小 JSON），断言 400「图片超过 4 MB」且该 spy 未被调用。注意 route 与测试必须用同一个模块说明符 `@/poster/request` 才能共享 mock；同文件其它用例仍走真实实现，mock 必须透传 `actual`。

**批 4｜前端交互修复**
- `PosterDialog.tsx`：加 `useRef<AbortController | null>` 与 `useRef(0)` 请求序号；`generate()` 每次先 `abort` 上一个、递增序号、带 `signal` 发请求；`await` 后先判断「序号仍是自己的且未 abort」再 `setState`，并在创建 blob URL **之前**判断，避免悬挂；`open` 变 false 与卸载时 `abort`。再加 `dialogRef` + `useEffect`：打开时记录 `document.activeElement` 并把焦点移到弹窗首个可聚焦元素，`keydown` 捕获 `Escape` 调 `onClose`、`Tab` 时**每次实时查询**弹窗内 `button, a[href], input, select, textarea, [tabindex]` 做首尾循环（busy 态无可聚焦元素时不吞按键），卸载时移除监听并把焦点还给触发按钮。
- `AvatarViewer.ts`：加 `private disposed = false`；`dispose()` 里置位并清空 listeners；`setBase/equip/playAnimation` 在 `await` 之后先判 `disposed` 再 `focus()`，`catch`/`finally` 里也判 `disposed` 才发 `error`/`loading('end')`，杜绝卸载后 setState 与「提前熄灭加载中」。
- `ThumbnailRenderer.ts`：加 `private disposed = false`；`dispose()` 置位；`get()` 在已释放时直接返回 rejected promise（`PartCard` 已有 `.catch(() => undefined)`，不会 unhandled）；`render()` 首行判 `disposed` 直接抛错，从而不再 `new WebGLRenderer`。已排队任务因此短路，不影响正常路径。
- `DressUp.tsx`：算出 `const baseLoading = phase.manifest.bases.some((b) => loadingIds.has(b.id))`（`loadingIds` 是 state，底模加载开始/结束都会触发重渲染），`onPoster={viewer && !baseLoading ? () => setPosterOpen(true) : undefined}`；`TopBar` 已内置 `disabled={!onPoster}`，无需改动组件。
- `Viewport.tsx`：`changeBase()` 里成功调用 `setBase` 后 `setFocus('body')`，与 `AvatarViewer.setBase` 内部 `focus('body')` 的行为对齐。

**批 5｜文档与账本**
`docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md` 三处改事实：§7 基础镜像 node:20-alpine → node:22-alpine；§8 错误表把「manifest 校验失败 / WebGL 不可用（整页）」与「底模加载失败（视口内遮罩）」拆成两行；§6.5 明确 `DressUp` 负责建 store/AvatarViewer/viewerSync/ThumbnailRenderer，`Viewport` 只提供容器与交互。`.superpowers/sdd/2026-10-10-nextjs-cloudbase-poster/progress.md` 追加本轮每条的处理结果。

## 性能与可靠性
- 内存化读取把「写盘 + 复制」换成「读字节 + 组合对象」，单文件量级（贴图 1024 webp，数百 KB），无额外拷贝放大；不再污染 `assets-src`，脚本可反复重跑。
- `readJSON` 的 `resources` 是内存对象，不改变 `writeGlb` 的输出路径与产物，`public/avatar/` 与 manifest 结构完全不变（`realManifest.test.ts` 应继续通过）。
- 前端两处 `disposed` 短路是 O(1) 判断，避免在卸载后重建 WebGL 上下文（浏览器上下文数量有限，重建会挤占资源）。
- `PosterDialog` 的请求序号 + abort 避免重复渲染与悬挂 URL 累积。

## 实施注意
- 每批结束 `npm test` 与 `npm run typecheck`；typecheck 的退出码历史上会被管道吞掉，判定用 `grep 'error TS'`。
- 不擅自 `git commit`，除非用户明确要求；若要求，沿用 `fix:` / `chore:` 前缀与仓库既有提交风格。
- 前端两条（弹窗竞态、焦点陷阱、底模加载中禁用、切底模聚焦）**不引入 jsdom / @testing-library**：vitest 现为 node 环境，靠 `npm run dev` 人工验收（打开弹窗按 Esc、Tab 循环、关闭后重开看是否残留结果、底模切换瞬间看按钮禁用与分段高亮）+ `npm run build` 把关。
- 改动面集中在 5 个前端文件、2 个脚本、1 个测试文件与 2 个文档；不动 3D 渲染管线、store、viewerSync、manifest 校验与海报契约，避免连带回归。

## 目录结构
```
avatar-dressup/
├── .gitignore                                  # [MODIFY] 追加 /*.zip 与 /*.pdf，仅排根目录素材包
├── components/
│   ├── PosterDialog.tsx                        # [MODIFY] AbortController + 请求序号 + 创建 blob 前判活；Esc 关闭、初始聚焦、Tab 焦点陷阱、关闭后焦点归还
│   ├── DressUp.tsx                             # [MODIFY] 按 bases ∩ loadingIds 算出底模是否在加载，条件传 onPoster
│   └── Viewport.tsx                            # [MODIFY] changeBase 成功后 setFocus('body')，与相机行为对齐
├── src/avatar/
│   ├── AvatarViewer.ts                         # [MODIFY] 加 disposed 标志，dispose 清 listeners；setBase/equip/playAnimation 的 focus 与回调按 disposed 短路
│   └── ThumbnailRenderer.ts                    # [MODIFY] 加 disposed 标志；get 已释放时 reject，render 首行短路，杜绝重建 WebGL 上下文
├── scripts/
│   ├── lib/gltf-resources.mjs                  # [NEW] 纯函数 resolveGltfUris：把缺失 uri 解析到实际存在的替代文件名，返回 entries 与 repairs，不写盘
│   ├── build-manifest.mjs                      # [MODIFY] 删 copyFile 分支，改用 resolveGltfUris + io.readJSON({ json, resources })；保留「修复:」日志
│   └── build-fonts.mjs                         # [MODIFY] GITHUB_FONTS 由 @main 改为固定 commit 6692879（注释说明取法）
├── tests/
│   ├── gltfResources.test.mjs                  # [NEW] 覆盖原名命中、_png.png ↔ .png 两种互换、两者都缺返回 null
│   └── posterRoute.test.ts                     # [MODIFY] 补两条用例：FF D8 损坏图 → 500；Content-Length 超限不进 parsePosterRequest（partial mock + spy）
├── docs/superpowers/specs/2026-10-10-nextjs-cloudbase-poster-design.md   # [MODIFY] §7 镜像版本、§8 底模失败表现、§6.5 谁建 viewer
└── .superpowers/sdd/2026-10-10-nextjs-cloudbase-poster/progress.md       # [MODIFY] 追加本轮 12 项的处理结果与验证手段
```


## Agent Extensions
### Skill
- **lsp-code-analysis**
  - Purpose: 在改动 `AvatarViewer.dispose` 与 `ThumbnailRenderer.get/dispose` 前，用「引用/实现」导航确认所有调用点与实现关系，避免漏改清理路径造成的回归。
  - Expected outcome: 拿到精确的调用点清单（如 `DressUp.tsx` 的卸载清理、`PartCard.tsx` 的 `thumbs.get`），据此确认 disposed 短路不会破坏正常路径。
### SubAgent
- **code-explorer**
  - Purpose: 在批 2 与批 4 开工前做一次 quick 级别的定点核查，确认 `inspect()`/`writeGlb()` 对 `Document` 的使用方式、以及 `PosterDialog`/`TopBar`/`Viewport` 之间 props 与 props 可选性的现状。
  - Expected outcome: 输出带路径与行号的结论，保证 `io.readJSON` 改造不破坏后续 `doc.transform` 流程，且前端 props 改动是向后兼容的。
