# 前端开发的数据库完全指南

> 面向：前端开发 / 后端小白 / 面试准备
> 特色：每个概念配前端类比 + 结合 avatar-dressup 项目实战 + 面试题库
> 预计学习时间：4-6 周

---

# 目录

- [第一章：数据库世界观](#第一章数据库世界观)
- [第二章：SQL 完整语法](#第二章sql-完整语法)
- [第三章：表设计深入](#第三章表设计深入)
- [第四章：索引原理与优化](#第四章索引原理与优化)
- [第五章：事务与并发](#第五章事务与并发)
- [第六章：锁机制](#第六章锁机制)
- [第七章：性能优化专题](#第七章性能优化专题)
- [第八章：ORM 与 Prisma 深入](#第八章orm-与-prisma-深入)
- [第九章：Redis 缓存](#第九章redis-缓存)
- [第十章：数据库架构](#第十章数据库架构)
- [第十一章：运维基础](#第十一章运维基础)
- [第十二章：面试题库（30+）](#第十二章面试题库30)
- [第十三章：实战练习](#第十三章实战练习)

---

# 第一章：数据库世界观

## 1.1 为什么需要数据库

假设你写一个前端项目存用户数据，你可能这样：

```javascript
// 方案 1：存内存
let users = []  // ❌ 服务器一重启，数据全没了

// 方案 2：存文件
fs.writeFileSync('users.json', JSON.stringify(users))  // ❌ 10 万人同时写怎么办？

// 方案 3：localStorage
localStorage.setItem('users', ...)  // ❌ 只存在浏览器，换个设备就没了
```

数据库就是为了解决这三个问题而生的：

| 问题 | 数据库的解法 |
|------|------------|
| 重启丢数据 | 持久化（写磁盘 + WAL 日志） |
| 并发冲突 | 事务 + 锁 |
| 多端共享 | 网络服务，谁都能连 |

## 1.2 数据库的分类

```
数据库
├── 关系型（SQL）
│   ├── MySQL      —— 国内互联网公司主流
│   ├── PostgreSQL —— 你的项目用的，功能最强
│   ├── SQLite     —— 嵌入式，手机 App、本地小工具
│   └── Oracle     —— 银行、国企
│
└── 非关系型（NoSQL）
    ├── Redis      —— 内存键值对，做缓存
    ├── MongoDB    —— 文档型，存 JSON
    └── Elasticsearch —— 搜索引擎
```

**怎么选（一句话版）**：
- 结构化数据 + 需要事务 → 关系型（MySQL/PG）
- 极速读写 + 可丢失 → Redis
- 结构多变的文档 → MongoDB
- 全文搜索 → Elasticsearch

## 1.3 核心概念对照表（前端 → 数据库）

| 前端 | 数据库 | 说明 |
|------|--------|------|
| `localStorage` / 一个 JSON 文件 | 数据库（Database） | 最大的容器 |
| 一个数组 `users = []` | 表（Table） | 存同一类数据 |
| 数组中的一个对象 | 行（Row / Record） | 一条具体数据 |
| 对象的属性 | 列（Column / Field） | 数据的一个字段 |
| `array.find(x => x.id === 1)` | `SELECT ... WHERE id = 1` | 查询 |
| `array.filter(x => x.age > 18)` | `WHERE age > 18` | 条件过滤 |
| `array.sort((a,b) => b.time - a.time)` | `ORDER BY time DESC` | 排序 |
| `array.slice(20, 30)` | `LIMIT 10 OFFSET 20` | 分页 |
| 对象的 `key`（React key） | 主键（Primary Key） | 唯一标识一行 |
| 接口的 TypeScript 类型定义 | 表的 Schema（列 + 类型 + 约束） | 定义数据结构 |

## 1.4 你项目的架构全景

```
浏览器（React）
   │  fetch('/api/auth/login')
   ▼
Next.js API Routes（app/api/**/route.ts）
   │  prisma.user.findUnique(...)
   ▼
Prisma Client（生成类型安全的查询）
   │  TCP 连接
   ▼
PostgreSQL（localhost:5432）
   │
   ▼
数据文件（磁盘）
```

每一次你点击"登录"，这条链路完整走一遍。

---

# 第二章：SQL 完整语法

> SQL 分三类：**DDL**（定义表结构）、**DML**（操作数据）、**DCL**（权限控制）。面试 90% 考 DML。

## 2.1 DDL：定义表结构

```sql
-- 建表（相当于定义一个 TypeScript interface + 创建数组）
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 加一列
ALTER TABLE users ADD COLUMN email VARCHAR(100);

-- 删一列
ALTER TABLE users DROP COLUMN email;

-- 改列类型
ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(100);

-- 删表（高危！）
DROP TABLE users;
```

**类比**：DDL ≈ 改 TypeScript 的 interface；DML ≈ 操作数据本身。

## 2.2 SELECT 查询详解

### 基础查询

```sql
SELECT * FROM users;                          -- 查全部
SELECT id, username FROM users;               -- 只查两列
SELECT DISTINCT status FROM poster_jobs;      -- 去重（看有哪些状态）
```

### WHERE 条件全家桶

```sql
-- 比较
WHERE id = 'xxx'
WHERE created_at > '2026-01-01'

-- 范围
WHERE created_at BETWEEN '2026-01-01' AND '2026-12-31'

-- 集合
WHERE status IN ('pending', 'running')     -- 相当于 ['pending','running'].includes(status)

-- 模糊匹配
WHERE username LIKE 'xiao%'    -- xiao 开头（可以用索引）
WHERE username LIKE '%ming'    -- ming 结尾（索引失效！）
WHERE username LIKE '%aom%'    -- 包含（索引失效！）

-- 空值判断（注意：不能用 = NULL）
WHERE cover_url IS NULL
WHERE cover_url IS NOT NULL

-- 组合条件（注意 AND 优先级高于 OR，加括号保平安）
WHERE status = 'done' AND (style = 'anime' OR style = 'realistic')
```

### 排序与分页

```sql
-- 排序（多列：先按 status，同状态再按时间）
SELECT * FROM poster_jobs
ORDER BY status ASC, created_at DESC;

-- 分页（LIMIT 取几条，OFFSET 跳过几条）
SELECT * FROM avatars
ORDER BY created_at DESC
LIMIT 10 OFFSET 20;    -- 第 3 页（跳过前 20 条，取 10 条）
```

### 聚合函数 + GROUP BY

```sql
-- 5 个聚合函数：COUNT 计数 / SUM 求和 / AVG 平均 / MAX 最大 / MIN 最小
SELECT COUNT(*) FROM users;                    -- 总用户数

-- 分组：每个用户有多少头像
SELECT user_id, COUNT(*) AS avatar_count
FROM avatars
GROUP BY user_id;

-- HAVING：对分组结果再过滤（WHERE 是分组前过滤）
SELECT user_id, COUNT(*) AS cnt
FROM avatars
GROUP BY user_id
HAVING COUNT(*) > 5;        -- 只要头像数大于 5 的用户
```

**执行顺序（面试常问）**：
```
FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```
记住这个顺序，就能解释"为什么 WHERE 里不能用 SELECT 的别名"。

### JOIN 三种连接（画图理解）

```
表A（users）        表B（avatars）
  ○○○○              ●●●●●

INNER JOIN：  只有交集（用户有头像的才显示）
LEFT JOIN：   左表全保留，右表没匹配补 NULL（所有用户，没头像的也显示）
RIGHT JOIN：  右表全保留（很少用，通常反过来写 LEFT）
```

```sql
-- 查所有用户和他们的头像数（没头像的用户也要显示，用 LEFT JOIN）
SELECT u.username, COUNT(a.id) AS avatar_count
FROM users u
LEFT JOIN avatars a ON a.user_id = u.id
GROUP BY u.username;
```

**易错点**：LEFT JOIN 后 `COUNT(a.id)` 而不是 `COUNT(*)`，因为没匹配的行 `a.id` 是 NULL，`COUNT(列)` 会忽略 NULL。

### 子查询

```sql
-- 查"头像数超过平均值"的用户
SELECT username FROM users
WHERE id IN (
  SELECT user_id FROM avatars
  GROUP BY user_id
  HAVING COUNT(*) > (SELECT AVG(cnt) FROM (
    SELECT COUNT(*) AS cnt FROM avatars GROUP BY user_id
  ) t)
);
```

### UNION：合并两个查询结果

```sql
-- UNION 去重，UNION ALL 不去重（更快）
SELECT id, username AS name FROM users
UNION ALL
SELECT id, name FROM avatars;
```

### CASE WHEN：SQL 里的 if-else

```sql
SELECT
  name,
  CASE
    WHEN status = 'done' THEN '已完成'
    WHEN status = 'running' THEN '进行中'
    ELSE '其他'
  END AS status_text          -- 前端直接拿来渲染
FROM poster_jobs;
```

### 常用函数速查

| 函数 | 作用 | 例子 |
|------|------|------|
| `NOW()` | 当前时间 | `WHERE created_at > NOW() - INTERVAL '7 days'` |
| `COALESCE(a, b)` | a 为 NULL 时用 b | `COALESCE(cover_url, '/default.png')` |
| `LENGTH(s)` | 字符串长度 | — |
| `UPPER / LOWER` | 大小写 | — |
| `SUBSTRING(s, 1, 3)` | 截取 | — |
| `CONCAT(a, b)` / `\|\|` | 拼接 | `username \|\| '@avatar'` |
| `DATE_TRUNC('day', ts)` | 时间截断到天 | 按天统计必备 |

## 2.3 INSERT / UPDATE / DELETE

```sql
-- 插入单条 + 返回插入的行（PG 特性，MySQL 没有 RETURNING）
INSERT INTO users (username, password_hash)
VALUES ('xiaoming', 'hash...')
RETURNING id, created_at;

-- 插入多条
INSERT INTO users (username, password_hash) VALUES
  ('a', 'hash1'),
  ('b', 'hash2');

-- 更新（基于旧值计算）
UPDATE avatars SET name = name || '-副本' WHERE id = 'xxx';

-- 删除
DELETE FROM poster_jobs WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';
```

> ⚠️ **铁律**：UPDATE 和 DELETE 之前，先用同样的 WHERE 跑一次 SELECT 确认影响范围。

---

# 第三章：表设计深入

## 3.1 数据类型怎么选

| 需求 | PostgreSQL 类型 | 说明 |
|------|----------------|------|
| 主键 | `UUID` | 你项目用的，分布式友好 |
| 短文本 | `VARCHAR(n)` | 用户名、标题 |
| 长文本 | `TEXT` | 内容、JSON 字符串 |
| 整数 | `INT` / `BIGINT` | 数量、状态码 |
| 布尔 | `BOOLEAN` | — |
| 时间 | `TIMESTAMP` | 创建/更新时间 |
| JSON | `JSONB` | 可索引的 JSON（PG 王牌） |
| 金额 | `NUMERIC(10,2)` | **千万别用 FLOAT**，浮点精度丢失 |

## 3.2 约束详解

```sql
CREATE TABLE avatars (
  id         UUID PRIMARY KEY,                    -- 主键：唯一 + 非空
  user_id    UUID NOT NULL REFERENCES users(id)   -- 外键：必须是 users 里存在的 id
             ON DELETE CASCADE,                   -- 级联：删用户连带删头像
  name       VARCHAR(100) NOT NULL,               -- 非空
  base_id    VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()              -- 默认值
);

-- 给高频查询建索引
CREATE INDEX idx_avatars_user_created ON avatars(user_id, created_at);
```

**外键的三种行为**（面试常问）：
- `CASCADE`：删父删子（你的项目：删用户 → 删其所有头像）
- `SET NULL`：删父后子的外键置空
- `RESTRICT`：有子数据时不让删父（默认，最安全）

## 3.3 范式与反范式

**三大范式（记人话版）**：

1. **1NF：列不可再分**
   ❌ `tags = "帽子,衣服,鞋"`（一个格子存了三个值）
   ✅ 建一张 `avatar_tags` 关联表，或者用 JSONB

2. **2NF：非主键列完全依赖主键**
   ❌ avatars 表里存 `username`（username 依赖的是 user_id，不是 avatar 的 id）
   ✅ username 只在 users 表存一份，要显示就 JOIN

3. **3NF：没有传递依赖**
   ❌ users 表存 `city_id` 和 `city_name`（city_name 依赖 city_id，city_id 依赖 user id → 传递依赖）
   ✅ city 信息单独建表

**反范式（故意违反）**：当 JOIN 成为性能瓶颈时，可以冗余字段。
> 例：avatars 表冗余一份 `username`，列表页不用 JOIN，查询快。
> 代价：用户改名时，要同时更新两张表，否则数据不一致。
> **原则：先按范式来，性能真有问题再反范式。**

## 3.4 表设计实战流程

设计"头像保存"功能的表（就是你项目的 avatars）：

```
第 1 步：列实体和字段
  头像：名字、穿搭数据、封面图、所属用户、创建时间

第 2 步：确定关系
  用户 1 : N 头像（一个用户多个头像）→ 头像表加 user_id 外键

第 3 步：选类型加约束
  parts 是嵌套 JSON → JSONB 或 TEXT
  user_id 必须存在 → 外键 + NOT NULL
  用户删除时头像怎么处理 → ON DELETE CASCADE

第 4 步：为查询建索引
  高频查询："某用户的头像列表，按时间倒序"
  → @@index([userId, createdAt]) 联合索引
```

---

# 第四章：索引原理与优化

> 索引是面试第一高频考点，也是性能优化的核心。

## 4.1 为什么索引快：B+ 树图解

假设 100 万条数据，用二叉树查找要 20 层。B+ 树每个节点存几百个 key，**100 万数据只要 3 层**：

```
            [根节点]         ← 第 1 次磁盘 IO
           /   |    \
     [内部节点]...[内部节点]   ← 第 2 次磁盘 IO
      /  \          /  \
 [叶子节点]      [叶子节点]    ← 第 3 次磁盘 IO，找到数据
 (存实际数据)    (叶子间有链表相连，方便范围查询)
```

**B+ 树 vs B 树的区别**（面试题）：
- B+ 树数据全在叶子节点，内部节点只存 key → 同样大小的节点能存更多 key → 树更矮 → IO 更少
- 叶子节点有双向链表 → 范围查询（`WHERE id > 100`）顺着链表扫就行，B 树要反复回溯

## 4.2 聚簇索引 vs 非聚簇索引

| | 聚簇索引（主键索引） | 非聚簇索引（二级索引） |
|---|---|---|
| 叶子节点存什么 | **整行数据** | 主键 ID |
| 一张表有几个 | 只能有 1 个 | 可以有多个 |
| 查询过程 | 一次找到 | 先找到主键 ID，再**回表**查整行 |

**回表**：用二级索引查到主键后，还要再去聚簇索引查一次完整数据。多一次 IO。

**覆盖索引**（优化手段）：如果查询的列都在索引里，就不用回表：
```sql
-- 有索引 (user_id, created_at)
SELECT user_id, created_at FROM avatars WHERE user_id = 'x';
-- ✅ 要查的两列都在索引里 → 覆盖索引，不回表，飞快

SELECT * FROM avatars WHERE user_id = 'x';
-- ❌ 要查所有列，索引里没有 → 必须回表
```

## 4.3 联合索引与最左前缀（必考）

有联合索引 `(user_id, created_at)`，相当于电话簿按"姓 + 名"排序：

```sql
-- ✅ 走索引
WHERE user_id = 'x'                              -- 相当于只用"姓"查
WHERE user_id = 'x' AND created_at > '2026-01-01' -- 姓+名一起查
WHERE user_id = 'x' ORDER BY created_at          -- 排序也能用上索引

-- ❌ 不走索引（跳过了左边的列）
WHERE created_at > '2026-01-01'                  -- 只知道"名"，电话簿没法查
```

**记忆法**：联合索引 = 多级排序，必须从第一级开始用。

## 4.4 索引失效场景（必考，扩充版）

```sql
-- 1. 对索引列做运算/函数 → 失效
WHERE YEAR(created_at) = 2026                    -- ❌
WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'  -- ✅

-- 2. LIKE 以 % 开头 → 失效
WHERE username LIKE '%ming'   -- ❌（电话簿按姓排序，你只知道名）
WHERE username LIKE 'xiao%'   -- ✅

-- 3. 违反最左前缀 → 部分失效（见 4.3）

-- 4. 隐式类型转换 → 失效
WHERE phone = 13800138000  -- phone 是 VARCHAR，传数字触发转换 ❌

-- 5. OR 两侧有一侧没索引 → 全表扫描
WHERE user_id = 'x' OR description LIKE '%test%'  -- description 无索引 ❌

-- 6. 不等号 != / NOT IN → 大概率失效（要扫的范围太大，优化器干脆全表扫）

-- 7. 数据区分度太低 → 优化器主动放弃索引
WHERE status = 'done'  -- 如果 99% 的行都是 done，索引没意义
```

## 4.5 EXPLAIN 详解

```sql
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'uuid-xxx';
```

重点看输出里的：

| 字段 | 看什么 |
|------|--------|
| `Seq Scan` | 全表扫描 → 🚨 警报，该加索引了 |
| `Index Scan` | 走了索引 → ✅ |
| `Index Only Scan` | 覆盖索引，没回表 → ✅✅ 最快 |
| `rows` | 预计扫描行数，越小越好 |
| `actual time` | ANALYZE 模式下真实耗时（毫秒） |

---

# 第五章：事务与并发

## 5.1 为什么需要事务

```typescript
// 没有事务的危险操作：
await prisma.user.delete({ where: { id } })        // 删了用户
// ← 如果这里服务器断电
await prisma.avatar.deleteMany({ where: { userId: id } })  // 头像没删 → 脏数据！

// 有事务：两步要么都成功，要么都回滚
await prisma.$transaction([
  prisma.user.delete({ where: { id } }),
  prisma.avatar.deleteMany({ where: { userId: id } }),
])
```

## 5.2 ACID 详解（必考）

| 特性 | 含义 | 靠什么实现 |
|------|------|-----------|
| **A** 原子性 | 事务内操作不可分割，全做或全不做 | Undo Log（回滚日志） |
| **C** 一致性 | 事务前后数据满足所有约束 | 由 A、I、D 共同保证 + 应用层 |
| **I** 隔离性 | 并发事务互相看不到中间状态 | 锁 + MVCC |
| **D** 持久性 | 提交后断电也不丢 | Redo Log（WAL，先写日志再写数据） |

**WAL 为什么重要（加分项）**：每次改数据先写日志文件（顺序写，快），再慢慢刷到数据文件（随机写，慢）。断电后靠日志重放恢复。这就是"先记账，后干活"。

## 5.3 并发读问题与隔离级别（必考）

三种脏数据现象：

```
脏读：      事务A读到了事务B【还没提交】的修改
           B 改了一半回滚了，A 读到的是幻觉

不可重复读： 事务A两次读同一行，结果不一样
           （中间事务B修改并提交了）

幻读：      事务A两次按同样条件查询，第二次多出了行
           （中间事务B插入了新数据）
           区别：不可重复读针对"修改"，幻读针对"新增"
```

四种隔离级别 vs 三种问题：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|----------|------|-----------|------|
| 读未提交（Read Uncommitted） | ❌ 有 | ❌ 有 | ❌ 有 |
| **读已提交（Read Committed）** | ✅ 防住 | ❌ 有 | ❌ 有 |
| **可重复读（Repeatable Read）** | ✅ | ✅ 防住 | 大部分防住 |
| 串行化（Serializable） | ✅ | ✅ | ✅ 全防住 |

**记住**：PostgreSQL 默认是**读已提交**；MySQL InnoDB 默认是**可重复读**。

## 5.4 MVCC：高并发的秘密（进阶加分项）

**问题**：如果读写都加锁，并发性能会很差。怎么办？

**MVCC（多版本并发控制）**：每行数据保存多个版本，每个事务读自己"快照"里的版本：

```
事务A开始 → 拿到快照（数据版本号 100）
事务B修改数据并提交 → 数据变成版本 101
事务A再读 → 还是读版本 100（不受 B 影响）→ 可重复读！
```

**效果**：读不阻塞写，写不阻塞读，并发性能起飞。这是 PG 和 MySQL InnoDB 高性能的核心。

**面试话术**：
> "MVCC 通过保存数据的多个版本，让读操作读快照、写操作写新版本，实现了读写不互斥。快照的生成时机决定了隔离级别：读已提交是每条语句一个快照，可重复读是整个事务一个快照。"

---

# 第六章：锁机制

## 6.1 锁的粒度

| 锁 | 锁住范围 | 并发度 | 场景 |
|----|---------|--------|------|
| 表锁 | 整张表 | 低 | DDL（改表结构） |
| 行锁 | 一行 | 高 | UPDATE/DELETE 单行 |

## 6.2 乐观锁 vs 悲观锁（必考）

**悲观锁**：很悲观，总觉得有人抢，先锁住再干活。
```sql
BEGIN;
SELECT * FROM avatars WHERE id = 'x' FOR UPDATE;  -- 锁住这行，别人改不了
UPDATE avatars SET name = 'new' WHERE id = 'x';
COMMIT;
```

**乐观锁**：很乐观，不锁，改的时候检查一下数据有没有被别人动过。
```sql
-- 表加 version 字段
UPDATE avatars
SET name = 'new', version = version + 1
WHERE id = 'x' AND version = 3;   -- 我读到时是 3，改的时候还必须是 3

-- 如果返回 0 行受影响 → 说明被别人改了 → 重试或报错
```

**怎么选**：冲突少（读多写少）用乐观锁；冲突多（秒杀库存）用悲观锁。

## 6.3 死锁（经典场景）

```
事务A：锁住了行1，想锁行2
事务B：锁住了行2，想锁行1
→ 互相等对方放锁 → 死锁 → 数据库检测到后强制回滚其中一个
```

**预防**：
1. 所有事务按**固定顺序**访问数据（都先锁行1再锁行2）
2. 事务尽量短小，别在事务里调外部 API
3. 一次性锁定需要的所有行

---

# 第七章：性能优化专题

## 7.1 慢查询优化全流程（面试被问"怎么优化"就按这个答）

```
第 1 步：定位慢查询
  → 开慢查询日志（PG: log_min_duration_statement = 200）
  → 或 APM 监控发现某接口慢

第 2 步：EXPLAIN 分析执行计划
  → 看是不是 Seq Scan（全表扫描）

第 3 步：对症下药
  → 缺索引 → 加索引
  → 索引失效 → 改写法（见 4.4）
  → SELECT * → 只查需要的列
  → 深分页 → 改游标分页

第 4 步：SQL 层面无解 → 架构层面
  → 加 Redis 缓存
  → 读写分离（读走从库）
  → 分库分表（最后手段）
```

## 7.2 SQL 优化 10 条军规

```sql
-- 1. 别 SELECT *，只查需要的列（减少 IO + 可能触发覆盖索引）
SELECT id, name FROM avatars;  -- ✅

-- 2. 深分页改游标分页
SELECT * FROM avatars ORDER BY id LIMIT 10 OFFSET 100000;   -- ❌ 慢
SELECT * FROM avatars WHERE id > '上一页最后的id' ORDER BY id LIMIT 10;  -- ✅ 快

-- 3. 小表驱动大表（JOIN 时小表放前面，PG/MySQL 优化器大多会自动调整）

-- 4. 批量操作代替循环单条
INSERT INTO t VALUES (...), (...), (...);  -- ✅ 一次搞定
-- 而不是循环执行 100 次单条 INSERT

-- 5. COUNT(*) 就行，别 COUNT(列)（后者要判断 NULL）

-- 6. 能用 UNION ALL 就别用 UNION（省去去重排序）

-- 7. 避免在 WHERE 中对 NULL 做判断后参与 OR（容易全表扫）

-- 8. 大事务拆小事务（长事务占锁、占连接）

-- 9. 统计类查询考虑预计算（定时任务算好存结果表）

-- 10. LIKE '%xx' 全文搜索需求 → 别硬扛，上 Elasticsearch
```

## 7.3 什么时候优化到头了

| 手段 | 能扛的量级 | 复杂度 |
|------|-----------|--------|
| 加索引/优化 SQL | 百万级 | ⭐ |
| Redis 缓存 | 千万级读 | ⭐⭐ |
| 读写分离（主从） | 读多写少场景 | ⭐⭐⭐ |
| 分库分表 | 亿级 | ⭐⭐⭐⭐⭐（小项目别碰） |

---

# 第八章：ORM 与 Prisma 深入

## 8.1 Prisma 工作链路

```
prisma/schema.prisma（定义模型）
      │  npx prisma generate
      ▼
生成 TypeScript Client（node_modules/.prisma）
      │  npx prisma migrate dev/deploy
      ▼
数据库表结构（自动同步）
```

**为什么 `prisma generate` 必须在部署时执行**：Client 是根据 schema 生成的代码，代码拉下来后必须重新生成才能用。（这就是为什么你流水线里部署脚本有这一步）

## 8.2 常用操作对照

```typescript
// 查询单条
prisma.user.findUnique({ where: { username } })
// → SELECT * FROM users WHERE username = $1 LIMIT 1

// 查询多条 + 条件 + 排序 + 分页
prisma.avatar.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  take: 10,      // LIMIT
  skip: 20,      // OFFSET
})

// 关联查询（避免 N+1）
prisma.avatar.findMany({ include: { user: true } })
// → JOIN users

// 创建
prisma.user.create({ data: { username, passwordHash } })

// 更新
prisma.avatar.update({ where: { id }, data: { name } })

// 删除
prisma.avatar.delete({ where: { id } })

// 事务
prisma.$transaction([
  prisma.user.delete({ where: { id } }),
  prisma.avatar.deleteMany({ where: { userId: id } }),
])
```

## 8.3 N+1 问题（必考）

```typescript
// ❌ 101 次查询（1 次查头像列表 + 100 次查各自的用户）
const avatars = await prisma.avatar.findMany()
for (const a of avatars) {
  const user = await prisma.user.findUnique({ where: { id: a.userId } })
}

// ✅ 1 次查询（JOIN）
const avatars = await prisma.avatar.findMany({ include: { user: true } })
```

**前端类比**：列表页 100 个item，每个 item 单独发一次请求拿详情 vs 后端一次返回所有数据。谁都知道选后者。

## 8.4 连接池

```typescript
// Prisma 默认自带连接池
// DATABASE_URL 里可以配：
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
```

**为什么需要连接池**：建一次数据库连接要 TCP 握手 + 认证，耗时几十毫秒。池子里常备 10 条连接，请求来了直接用，用完归还。

---

# 第九章：Redis 缓存

## 9.1 Redis 是什么

```
PostgreSQL：数据存磁盘，查询毫秒级
Redis：     数据存内存，查询微秒级（快 1000 倍）
            代价：内存贵、宕机可能丢数据（有持久化机制缓解）
```

## 9.2 五种数据结构 + 场景（必考）

| 结构 | 前端类比 | 典型场景 |
|------|---------|---------|
| String | 普通变量 | 缓存 JSON、计数器、session |
| Hash | 对象 | 存用户信息（`HSET user:1 name "小明"`） |
| List | 数组（双端队列） | 消息队列、最新列表 |
| Set | `Set` | 去重、共同好友 |
| ZSet（有序Set） | 带分数的 Set | **排行榜**（按分数排序） |

## 9.3 缓存读写策略（Cache Aside，最常用）

```
读：先查 Redis → 命中返回 → 未命中查 DB → 写入 Redis → 返回
写：先更新 DB → 再删除 Redis（是删除不是更新！防止并发下缓存和 DB 不一致）
```

## 9.4 缓存三大问题（必考，背熟）

| 问题 | 现象 | 比喻 | 解决方案 |
|------|------|------|---------|
| **穿透** | 查不存在的数据，缓存永远未命中，每次打 DB | 有人一直问"不存在的商品" | ① 缓存空值（key 存 null，短 TTL）② 布隆过滤器 |
| **击穿** | 某个热点 key 刚好过期，瞬间几千请求打 DB | 双十一爆款缓存过期 | 互斥锁：只放一个请求去查 DB，其他等着 |
| **雪崩** | 大量 key 同时过期 | 所有缓存一起失效 | 过期时间加随机值（`3600 + random(600)` 秒） |

## 9.5 持久化与过期

- **RDB**：定时快照（像 `JSON.stringify` 全量存盘），恢复快但可能丢最近的数据
- **AOF**：记录每条写命令（像操作日志），丢得少但文件大
- 生产一般**两个都开**

**内存淘汰**：内存满了怎么办？`LRU`（淘汰最近最少使用的）—— 就像你清理手机先删很久没打开的 App。

---

# 第十章：数据库架构

## 10.1 主从复制（读写分离）

```
        写（INSERT/UPDATE/DELETE）
              │
              ▼
        ┌──────────┐   同步binlog/WAL   ┌──────────┐
        │  主库     │ ───────────────→ │  从库     │
        └──────────┘                   └──────────┘
              ▲                              ▲
              │ 写                           │ 读（SELECT）
```

**面试要点**：
- 主从同步有延迟（毫秒到秒级），刚写完马上读从库可能读不到 → 强制读主库
- 一主多从可以抗很高的读流量

## 10.2 分库分表

| 方式 | 做法 | 例子 |
|------|------|------|
| 垂直拆分 | 按业务拆 | 用户库、订单库分开 |
| 水平拆分 | 按数据拆 | user_id % 4 决定进哪张表 |

**代价**：跨库 JOIN 没了、分布式事务、全局 ID 生成…… 复杂度爆炸。**单表千万级以下别考虑**。

---

# 第十一章：运维基础

## 11.1 常用命令（在你的服务器上练）

```bash
# 连数据库
sudo -u postgres psql -d avatar_dressup

# 进去之后
\dt                     # 列出所有表
\d users                # 查看表结构
\di                     # 查看索引
\q                      # 退出

# 查看当前正在执行的查询（排查卡顿神器）
SELECT pid, query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active';

# 杀掉卡死的查询
SELECT pg_terminate_backend(pid);
```

## 11.2 备份与恢复

```bash
# 备份（导出整个库）
pg_dump -U avatar avatar_dressup > backup.sql

# 恢复
psql -U avatar avatar_dressup < backup.sql

# 定时备份（crontab 每天凌晨 3 点）
0 3 * * * pg_dump -U avatar avatar_dressup > /backup/$(date +\%Y\%m\%d).sql
```

## 11.3 用户权限最小化

```sql
-- 应用账号只给需要的权限，别用超级用户跑应用！
CREATE USER app_user WITH PASSWORD 'xxx';
GRANT CONNECT ON DATABASE avatar_dressup TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- 不给 DROP、不给 ALTER，防止删库跑路
```

---

# 第十二章：面试题库（30+）

## 基础概念（⭐⭐⭐）

**Q1：数据库三大范式？**
> 1NF 列不可再分；2NF 非主键列完全依赖主键；3NF 无传递依赖。实际开发中遵循范式为主，高并发读场景可适当反范式冗余。

**Q2：CHAR 和 VARCHAR 区别？**
> CHAR 定长（存不满补空格），VARCHAR 变长。定长查询略快但浪费空间，一般都用 VARCHAR/TEXT。

**Q3：DROP、DELETE、TRUNCATE 区别？**

| | DELETE | TRUNCATE | DROP |
|---|---|---|---|
| 删什么 | 行（可带 WHERE） | 全表数据 | 整张表（结构也没了） |
| 能回滚 | ✅ | 看库（PG 可以） | ❌ |
| 速度 | 慢（逐行记日志） | 快 | 最快 |

## 索引（⭐⭐⭐ 必考区）

**Q4：索引是什么数据结构？为什么用 B+ 树不用二叉树/哈希？**
> B+ 树。相比二叉树：每个节点存几百个 key，树高只有 3 层，磁盘 IO 少。相比哈希：哈希只能等值查询，不支持范围查询和排序，B+ 树叶子节点有链表天然支持范围扫描。

**Q5：什么是回表？覆盖索引？**
> 二级索引叶子节点只存主键，查到主键后还要回聚簇索引查整行 = 回表。如果查询的列都在索引里就不用回表 = 覆盖索引。优化技巧：SELECT 只查需要的列，配合联合索引实现覆盖。

**Q6：最左前缀原则？**
> 联合索引 (a, b, c) 相当于按 a → b → c 排序。查询必须从 a 开始连续使用才能走索引。`WHERE b=1` 跳过 a 用不上。类比电话簿按"姓+名"排序，只知道名查不了。

**Q7：索引失效的场景？**
> ① 列上做函数/运算 ② LIKE 以 % 开头 ③ 违反最左前缀 ④ 隐式类型转换 ⑤ OR 一侧无索引 ⑥ 数据区分度低优化器主动放弃。不确定就 EXPLAIN。

**Q8：什么字段适合建索引？**
> 高频 WHERE / JOIN / ORDER BY 的列；区分度高的列（如用户 ID，而不是性别）。不适合：频繁更新的列、数据量小的表、低区分度列。

**Q9：索引的缺点？**
> ① 占磁盘空间（索引也是数据）② 写入时要维护索引树，降低 INSERT/UPDATE/DELETE 速度 ③ 索引太多优化器可能选错。所以不是越多越好。

**Q10：为什么主键推荐自增/有序的？（进阶）**
> B+ 树插入时，有序 ID 永远追加到最右叶子节点，效率高；随机 ID（如 UUID）会导致插入位置随机 → 页分裂 → 索引碎片化。你项目用 UUID 是因为分布式场景需要，代价就是略低的写入性能，小项目无感知。

## 事务与锁（⭐⭐⭐）

**Q11：ACID 及实现原理？**
> 原子性靠 Undo Log；持久性靠 Redo Log（WAL 先写日志再写数据）；隔离性靠锁 + MVCC；一致性是最终目标，由其他三个保证。

**Q12：脏读、不可重复读、幻读？隔离级别？**
> 见 5.3。记住：脏读=读到未提交；不可重复读=同事务两次读同一行变了（针对 UPDATE）；幻读=同事务两次查同一条件多了行（针对 INSERT）。PG 默认读已提交，MySQL 默认可重复读。

**Q13：MVCC 是什么？**
> 多版本并发控制。每行数据保存多个版本，读操作读快照不加锁，写操作生成新版本。效果：读写互不阻塞。快照粒度决定隔离级别：读已提交=每条语句一个快照；可重复读=事务开始一个快照。

**Q14：乐观锁和悲观锁？**
> 悲观锁：`SELECT ... FOR UPDATE` 先锁再改，适合冲突多。乐观锁：version 字段 + `UPDATE ... WHERE version = 旧值`，冲突少时用，性能更好。

**Q15：死锁怎么产生和避免？**
> 两个事务互相持有对方需要的锁。避免：固定加锁顺序、事务短小、一次锁定所有需要的行。出现死锁数据库会自动检测并回滚其中一个事务。

## SQL 与优化（⭐⭐⭐）

**Q16：SQL 执行顺序？**
> FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。所以 WHERE 里不能用 SELECT 的别名（SELECT 还没执行）。

**Q17：JOIN 的类型？**
> INNER（交集）、LEFT（左表全留，右表 NULL 补齐）、RIGHT、FULL OUTER（两边全留）。实战 95% 用 INNER 和 LEFT。

**Q18：深分页怎么优化？**
> `LIMIT 10 OFFSET 100000` 要扫 10 万行再丢弃。改成游标分页：`WHERE id > 上一页最大id ORDER BY id LIMIT 10`，直接走索引定位，O(1) 起步。代价：不能跳页，适合"加载更多"式交互。

**Q19：慢查询怎么排查？**
> 按 7.1 的流程：慢日志定位 → EXPLAIN 看执行计划 → 加索引/改写法 → SQL 无解上缓存 → 还不够读写分离/分库分表。**说出这个分层思路比背技巧更打动面试官**。

**Q20：COUNT(*)、COUNT(1)、COUNT(列) 区别？**
> COUNT(*) 和 COUNT(1) 一样，统计行数含 NULL；COUNT(列) 忽略该列为 NULL 的行。性能上前两者最快。

## 设计题（⭐⭐ 场景题）

**Q21：设计一个用户关注关系表？**
```sql
CREATE TABLE follows (
  id          UUID PRIMARY KEY,
  follower_id UUID REFERENCES users(id),   -- 粉丝
  followee_id UUID REFERENCES users(id),   -- 被关注的人
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, followee_id)          -- 防重复关注
);
CREATE INDEX idx_follows_followee ON follows(followee_id);  -- 查"谁关注了我"
CREATE INDEX idx_follows_follower ON follows(follower_id);  -- 查"我关注了谁"
```
> 考点：多对多关系用中间表、唯一约束防重复、双向查询都要索引。

**Q22：秒杀库存怎么设计（不超卖）？**
> 方案 1（DB 层）：`UPDATE stock SET count = count - 1 WHERE id = x AND count > 0`，利用行锁原子性，返回 0 行说明卖完。
> 方案 2（高并发）：Redis 预减库存（`DECR` 原子操作）+ 消息队列异步落库。
> 核心考点：**检查库存和扣减必须原子**，否则超卖。

**Q23：登录状态怎么存？Session 还是 JWT？**（你项目用的 JWT）
> Session：状态存服务端（Redis），Cookie 存 sessionId，可以主动踢人下线。
> JWT：状态在 token 里（自包含），服务端不存，天然支持分布式，但签发后无法单独作废（除非维护黑名单）。
> 你项目：JWT + HttpOnly Cookie，兼顾无状态和 XSS 防护。

## Redis（⭐⭐）

**Q24：Redis 为什么快？**
> ① 纯内存操作 ② 单线程无锁竞争（6.0 后 IO 多线程）③ IO 多路复用。

**Q25：缓存穿透/击穿/雪崩？**
> 见 9.4，必背。

**Q26：缓存和数据库一致性怎么保证？**
> 常用 Cache Aside：先更新 DB，再删除缓存。极端情况下仍有小窗口不一致，对一致性要求极高的场景用延迟双删或订阅 binlog 同步（canal）。**先承认没有完美方案，再讲权衡，这是加分回答**。

**Q27：Redis 过期策略？**
> 惰性删除（访问时检查）+ 定期删除（定时抽查）。内存不够了还有淘汰策略：LRU（淘汰最久没用的）最常用。

## 综合题（⭐）

**Q28：你们项目为什么选 PostgreSQL？**
> 用之前给你的框架：JSONB 匹配穿搭数据 + Web3 预留字段的复杂查询 + Prisma 生态 + 补一句什么时候会选 MySQL。

**Q29：数据库连接池是什么？为什么要？**
> 建连接要 TCP 握手 + 认证，成本高（几十 ms）。连接池预建一批连接反复复用。Prisma 自带，通过 `connection_limit` 参数配置。

**Q30：一条 SQL 从发送到返回经历了什么？（大题）**
> ① 连接器：建立连接、认证 ② 解析器：词法语法分析，生成语法树 ③ 优化器：选择索引、生成执行计划 ④ 执行器：调存储引擎接口取数据 ⑤ 存储引擎：通过索引找到数据页，从磁盘读入内存返回。

**Q31：从 URL 输入到页面展示，数据库在哪一环？（前端友好题）**
> DNS 解析 → TCP/TLS → 到达服务器 → Next.js 路由 → Prisma 查询 → PG 执行 SQL（解析→优化→索引查找→返回行）→ API 组装 JSON → 前端渲染。这题能把前后端串起来讲，非常加分。

**Q32：如果数据库 CPU 100% 怎么排查？**
> ① `pg_stat_activity` 看当前活跃查询 ② 找耗时最长的 SQL ③ EXPLAIN 分析 ④ 临时方案：杀掉问题查询 ⑤ 长期方案：优化 SQL/加索引/限流。

---

# 第十三章：实战练习

## 练习 1：SQL 上手（第 1 周）

```bash
sudo -u postgres psql -d avatar_dressup
```

```sql
-- 任务 1：看表结构
\dt
\d avatars

-- 任务 2：查你自己的账号
SELECT id, username, created_at FROM users;

-- 任务 3：造测试数据
INSERT INTO avatars (id, user_id, name, base_id, parts)
SELECT
  gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),
  '测试头像' || i,
  'base1',
  '{"hat": ["hat1"]}'
FROM generate_series(1, 100) AS i;   -- 一次造 100 条

-- 任务 4：练查询
SELECT name, created_at FROM avatars ORDER BY created_at DESC LIMIT 5;
SELECT user_id, COUNT(*) FROM avatars GROUP BY user_id;

-- 任务 5：EXPLAIN 看索引效果
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = '你的用户id';
-- 注意是 Index Scan 还是 Seq Scan
```

## 练习 2：感受索引的威力（第 2 周）

```sql
-- 造 10 万条数据
INSERT INTO avatars (id, user_id, name, base_id, parts)
SELECT gen_random_uuid(), (SELECT id FROM users LIMIT 1),
       'bulk' || i, 'base1', '{}'
FROM generate_series(1, 100000) AS i;

-- 先删掉索引测试全表扫描
DROP INDEX IF EXISTS avatars_user_id_created_at_idx;
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'xxx' ORDER BY created_at DESC;
-- 记录耗时（应该是几十~几百 ms，Seq Scan）

-- 加回索引再测
CREATE INDEX ON avatars(user_id, created_at);
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'xxx' ORDER BY created_at DESC;
-- 对比耗时（应该是几 ms，Index Scan）
```

**亲眼看到 100 倍差距，比背十遍索引原理都管用。**

## 练习 3：读源码找 SQL（第 3 周）

打开你项目的 `src/app/api/` 目录，对每个接口回答：

1. 这个接口调用了哪个 Prisma 方法？
2. 等价于什么 SQL？
3. 这个 SQL 会走哪个索引？（用 EXPLAIN 验证）

## 练习 4：模拟面试（第 4 周）

从第十二章随机抽 5 道题，**用手机录音**，自己讲出来。讲完听录音：
- 有没有"呃""那个" → 不熟
- 讲不讲得出"为什么" → 只背了答案没理解
- 能不能举出例子 → 能举例 = 真懂

---

# 附录：一张图总结

```
┌─────────────────────────────────────────────┐
│                 面试答题优先级                 │
├─────────────────────────────────────────────┤
│ 索引（B+树/失效/最左前缀）  ← 考得最多         │
│ 事务（ACID/隔离级别/MVCC）  ← 第二高频        │
│ 锁（乐观/悲观/死锁）                          │
│ Redis（三大问题/数据结构）                    │
│ SQL 优化（EXPLAIN/深分页）                    │
│ 场景题（秒杀/关注设计）     ← 区分度最高       │
└─────────────────────────────────────────────┘

排查问题的万能思路：
现象 → 定位（日志/EXPLAIN/监控）→ 分层（SQL层？索引层？架构层？）→ 对症下药
```
