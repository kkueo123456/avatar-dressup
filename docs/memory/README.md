# 团队记忆库

> 人工干预的决策、踩坑记录、架构变更，全部存这里。
> AI 助手会通过 `scripts/sync-memory.mjs` 生成索引，实现语义检索。

## 文件命名

```
YYYY-MM-DD.md        # 当天的决策汇总
YYYY-MM-DD_标题.md    # 某一主题的独立记录（可选）
```

## 每篇记忆的结构

```markdown
# 日期 + 一句话摘要

## 背景
为什么需要这个决策。

## 决策内容
做了什么、怎么做的。

## 关键代码/配置
路径或片段。

## 踩坑记录
遇到的问题和解决方案。

## 后续待办
- [ ] 某个改进点

## 标签
#auth #db #performance #ui
```

## 如何同步索引

```bash
node scripts/sync-memory.mjs
```

运行后会更新 `docs/memory/.index.json`，AI 助手查询时会读取这个索引召回相关记忆。
