# avatar-dressup

基于 three.js 的 3D 虚拟人换装，Vite + Vue 3 + TypeScript，无后端。

- 素材下载与目录：见 [docs/ASSETS.md](docs/ASSETS.md)
- 设计文档：`docs/superpowers/specs/2026-10-08-threejs-avatar-dressup-design.md`
- 实施计划：`docs/superpowers/plans/2026-10-08-avatar-dressup.md`

## 命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 打包 |
| `npm run typecheck` | 仅类型检查 |
| `npm test` | 单元测试 |
| `npm run assets:scan` | 列出 assets-src 里识别到的素材 |
| `npm run assets:build` | 生成 manifest 并复制资源 |

## 依赖版本

- three 0.186.1
- @types/three 0.186.0
- typescript 6.0.3（固定在 6.x：最新的 7.x 与 vue-tsc 3.3.12 不兼容）
- vue-tsc 3.3.12、vite 8.3.3、vue 3.5.43
