# 素材下载与放置说明

本项目的模型来自 Quaternius 的免费素材包，所有部件共用同一副 65 关节骨骼，所以可以互相组合。脚本生成的 `public/avatar/` 已经提交在仓库里，只有需要重新生成或加新素材时才用本说明。

## 1. 下载

| 包 | 下载地址 | 下载哪个文件 | 免费层包含 |
|---|---|---|---|
| Universal Base Characters（底模与发型） | https://quaternius.itch.io/universal-base-characters | Standard zip，约 122 MB | 2 个底模、8 个发型眉毛 |
| Modular Character Outfits - Fantasy（服装部件） | https://quaternius.itch.io/modular-character-outfits-fantasy | Standard zip，约 280 MB | Ranger、Peasant 两套，男女各一 |
| Universal Animation Library（动画，取 Idle） | https://quaternius.itch.io/universal-animation-library | Standard zip，约 13 MB | 45 个动画 |

页面点「Download Now」，付费框里选「No thanks, just take me to the downloads」。许可以 zip 内 LICENSE 文件为准，itch 页面标注 CC0。

## 2. 解压到这些目录

```
avatar-dressup/
  assets-src/
    base/      <- Universal Base Characters 的 zip 解压到这里
    outfits/   <- Modular Character Outfits - Fantasy 的 zip 解压到这里
    anim/      <- Universal Animation Library 的 zip 解压到这里
```

PowerShell 里可以这样解压：

```powershell
Expand-Archive -LiteralPath "Universal Base Characters[Standard].zip" -DestinationPath assets-src/base -Force
Expand-Archive -LiteralPath "Modular Character Outfits - Fantasy[Standard].zip" -DestinationPath assets-src/outfits -Force
Expand-Archive -LiteralPath "Universal Animation Library[Standard].zip" -DestinationPath assets-src/anim -Force
```

`assets-src/` 不进 git。脚本只读这些子目录：底模的 `Base Characters`、发型眉毛的 `Rigged to Head Bone`、服装的 `Modular Parts`、动画里不带 `_RM` 的文件。`Origin at 0` 的静态发型、`Outfits` 整套文件、FBX 目录都会被忽略。

素材包里有两个 `.gltf` 引用的贴图名比磁盘上的多一个 `_png` 后缀，脚本读取前会自动从正确命名复制一份补上，输出里会打印「修复:」。

## 3. 生成

先看脚本识别到了什么：

```bash
npm run assets:scan
```

再生成，脚本会去重、裁剪、把贴图缩到 1024 并转 webp，输出单文件 glb；动画只保留 `Idle_Loop` 一个剪辑：

```bash
npm run assets:build
```

输出 `public/avatar/manifest.json`、`public/avatar/models/`、`public/avatar/anim/`，全部进 git。生成后再跑一次 `npm run fonts:build`，让标题字体包含新的部件名。

## 4. 加新素材

把新文件放进对应目录，若 `assets:scan` 归类不对，改 `scripts/manifest.config.mjs` 里的 `rules`、`setLabels`、`pieceLabels`、`nameLabels`，不要改脚本逻辑。
