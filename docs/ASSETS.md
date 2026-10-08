# 素材下载与放置说明

本项目不带任何 3D 模型。模型来自 Quaternius 的免费素材包，所有部件共用同一副 65 关节骨骼，所以可以互相组合。请按下面步骤下载并解压到指定目录，然后运行脚本生成 `public/avatar/manifest.json`。

## 1. 下载

| 包 | 下载地址 | 下载哪个文件 | 免费层包含 |
|---|---|---|---|
| Universal Base Characters（底模与发型） | https://quaternius.itch.io/universal-base-characters | Standard zip，约 122 MB | 2 个底模、5 个发型 |
| Modular Character Outfits - Fantasy（服装部件） | https://quaternius.itch.io/modular-character-outfits-fantasy | Standard zip，约 280 MB | Ranger、Peasant 两套 |
| Universal Animation Library（动画，取 Idle） | https://quaternius.itch.io/universal-animation-library | Standard zip，约 13 MB | 45 个动画 |

操作：打开页面，点「Download Now」，弹出付费框时选「No thanks, just take me to the downloads」，然后只下载 Standard zip。想要全部底模、发型和 12 套服装，前两个包各约 20 美元，下载 Standard 即可，Source 是 Blender 工程不需要。

许可：itch 页面标注 CC0，以 zip 内 LICENSE 文件为准。

## 2. 解压到这些目录

```
avatar-dressup/
  assets-src/
    base/      <- Universal Base Characters 解压后的全部内容
    outfits/   <- Modular Character Outfits - Fantasy 解压后的全部内容
    anim/      <- Universal Animation Library 解压后的全部内容
```

子目录层级不限，脚本会递归扫描。`assets-src/` 已在 `.gitignore` 里，不会提交。

## 3. 生成 manifest

先看脚本识别到了什么：

```bash
npm run assets:scan
```

它会列出每个 glb/gltf 文件、网格名、骨骼数、动画名，以及所有 PNG 贴图。如果某些文件归类不对，改 `scripts/manifest.config.mjs` 里的 `rules`。

然后生成：

```bash
npm run assets:build
```

输出 `public/avatar/manifest.json`，并把模型复制为单文件 glb 到 `public/avatar/models/`，贴图到 `public/avatar/textures/`，动画到 `public/avatar/anim/`。加 `-- --optimize` 可做网格去重与贴图缩放。

## 4. 启动

```bash
npm run dev
```
