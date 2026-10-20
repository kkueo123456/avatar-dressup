# 前端开发的数据库完全指南（初学者详解版）

> **面向**：前端开发 / 后端小白 / 面试准备
> **特色**：每个概念配前端类比 + 结合 avatar-dressup 项目实战 + 面试题库
> **预计学习时间**：4-6 周（每周 3-5 小时）
> **怎么用这份文档**：先通读一遍不求全懂 → 按第十三章的练习动手 → 遇到问题时回来查 → 面试前刷第十二章

---

# 目录

- [开始之前：新手必读](#开始之前新手必读)
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
- [第十二章：面试题库（32 题）](#第十二章面试题库32-题)
- [第十三章：实战练习](#第十三章实战练习)
- [附录 A：术语表](#附录-a术语表)
- [附录 B：报错速查表](#附录-b报错速查表)

---

# 开始之前：新手必读

## 0.1 你会学到什么（学习地图）

数据库知识看起来很多，其实核心就 5 块，按这个顺序学：

```
第 1 层：会用（第 1-2 章）      → 知道数据库是什么，会写增删改查
第 2 层：会设计（第 3 章）      → 给你一个需求，能设计出表结构
第 3 层：会优化（第 4、7 章）   → 查询慢了知道怎么办
第 4 层：懂原理（第 5、6 章）   → 理解数据安全和高并发背后的机制
第 5 层：懂生态（第 8-11 章）   → ORM、缓存、集群，知道真实项目长什么样
```

**为什么要学前端学数据库？** 三个现实原因：
1. **全栈趋势**：Next.js / Nuxt 等框架让前端直接写后端，不懂数据库寸步难行（你的项目就是 Next.js + Prisma + PostgreSQL）
2. **面试硬通货**：前端面试的高级题（性能、架构、状态管理）背后都会拐到数据库
3. **排查问题的能力**：接口慢、数据错、页面白屏——很多"前端 Bug"最后查出来是数据库问题

## 0.2 学习节奏建议

> 🆕 **想优先学 MySQL？** 两份文档配合使用：本文档讲通用概念（SQL、索引原理、事务思想），MySQL 特有的深入内容（InnoDB、三大日志、间隙锁、EXPLAIN、主从复制）在同目录 **`mysql-guide.md`**。推荐路线：本文档第 1、2 章打底 → 直接切到 `mysql-guide.md` 跟着它的四周计划走。通用章节本文档依然是最完整的参考。

| 周 | 学什么 | 动手任务 |
|----|--------|---------|
| 第 1 周 | 第 1、2 章 | 连上数据库，跑通练习 1 的全部 SQL |
| 第 2 周 | 第 3 章 + 复习第 2 章 | 自己设计两张新表 |
| 第 3 周 | 第 4 章（索引） | 做练习 2，亲眼看索引提速 100 倍 |
| 第 3-4 周 | 第 5、6 章（事务锁） | 在项目里找一个能加事务的地方 |
| 第 4 周 | 第 7-9 章 | 读项目源码，对照第 8 章找 SQL |
| 第 5-6 周 | 第 10-13 章 | 模拟面试 + 查漏补缺 |

**学习心法**：不要试图一次看懂所有内容。第一遍快速过，动手做练习；第二遍精读卡壳的章节；面试前第三遍只看面试题和重点。

## 0.3 环境准备

你手上已经有最好的学习环境——你自己项目的数据库。确认以下几件事：

```bash
# 1. 能连上 PostgreSQL（在你的服务器上）
sudo -u postgres psql -d avatar_dressup
# 看到 avatar_dressup=# 提示符就说明成功了，输入 \q 退出

# 2. 项目本地能跑（Prisma 能连库）
npx prisma studio
# 浏览器打开后能看到 users / avatars 等表就 OK
```

**没有现成环境怎么办**：本地安装 PostgreSQL（Windows/Mac 都有安装包），或者用 Docker 起一个：`docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=123456 postgres`。

**推荐练习工具**：`psql` 命令行（练手感）+ `Prisma Studio`（可视化，看数据方便）+ `DataGrip/DBeaver`（可选，免费图形化客户端）。

## 0.4 两个阅读约定

1. **代码块里 `--` 开头的行是 SQL 注释**，不是要执行的内容
2. 文档里的表名（users、avatars、poster_jobs）都来自你的真实项目，示例可以直接拿去数据库里跑（数据量小改一下 LIMIT 就行）

---

# 第一章：数据库世界观

## 1.1 为什么需要数据库

### 从一个具体的问题说起

假设你写了一个头像换装应用，用户辛辛苦苦搭配了 3 小时的头像，你打算把数据存在哪？

**方案 1：存内存（JS 变量）**

```javascript
let avatars = [
  { id: 1, name: '我的头像', parts: { hat: 'hat-red' } }
]
```

- ✅ 读写最快（纳秒级，就在 CPU 手边）
- ❌ **致命缺陷：服务器一重启，数据全没了**。内存是"易失性"的——断电即清空。用户 3 小时的心血直接蒸发。
- ❌ 还有个隐藏问题：Node.js 进程之间内存不共享。你起两个进程做负载均衡，用户在进程 A 存的头像，进程 B 根本看不到。

**方案 2：存文件（JSON 落盘）**

```javascript
fs.writeFileSync('avatars.json', JSON.stringify(avatars))
```

- ✅ 重启不丢（数据在磁盘上）
- ❌ **并发是灾难**：10 万人同时保存头像。A 读文件 → B 读文件 → A 写回 → B 写回 → **B 把 A 的数据覆盖了**（经典"丢失更新"问题）。文件系统没有帮你排队、加锁的机制。
- ❌ 查询效率低：想找"某个用户的头像"？只能把整个 JSON 读进内存再 `filter`。数据到 100MB，每次查询都要读 100MB。
- ❌ 写入是全量的：改一个字符也要重写整个文件。

**方案 3：localStorage**

```javascript
localStorage.setItem('avatars', JSON.stringify(avatars))
```

- ❌ 只存在**当前浏览器**里。用户换手机、换电脑、清缓存，数据就没了。
- ❌ 只有这台设备的这个浏览器能访问，别人（包括服务器）都看不到——"分享头像"功能直接做不了。
- ❌ 容量上限只有 5-10MB。

### 数据库的解法

数据库不是什么黑魔法，它就是把上面三个方案的痛点一个个解决掉：

| 方案的问题 | 数据库的解法 | 一句话原理 |
|-----------|------------|-----------|
| 重启丢数据（方案1） | **持久化** | 数据写磁盘 + WAL 日志（第 5 章细讲） |
| 并发写冲突（方案2） | **事务 + 锁** | 写操作自动排队、加锁，谁也不会覆盖谁 |
| 查询慢（方案2） | **索引** | 像书的目录，按 key 直达数据，不用全量扫描（第 4 章） |
| 多端共享（方案3） | **网络服务** | 数据库是一个常驻网络服务，谁都能连、都在同一份数据上操作 |

> 💡 **心智模型**：把数据库想象成一个"住在你服务器上的、24 小时营业的图书馆"——书（数据）存在它那，任何人（任何进程/设备）都能来借阅，而且它有完善的管理制度（排队、登记、防盗）保证书永远不会弄丢、弄乱。

## 1.2 数据库的分类

### 关系型 vs 非关系型

**关系型（SQL）**：数据存在一张张**表**里，表和表之间可以建"关系"（外键）。就像 Excel：固定的列、一行行数据、多个 Sheet 之间可以引用。

- 特点：结构固定、支持事务（钱相关的场景必需）、用 SQL 语言操作
- 适合：用户、订单、支付……绝大多数业务核心数据

**非关系型（NoSQL）**：不强制表结构，根据数据形态选择不同的存储模型。 "NoSQL" 不是"反 SQL"，而是"Not Only SQL"。

### 主流数据库一览

```
数据库
├── 关系型（SQL）
│   ├── MySQL      —— 国内互联网公司主流（阿里系、字节等大量在用）
│   ├── PostgreSQL —— 你的项目用的，功能最强的开源数据库
│   ├── SQLite     —— 嵌入式，整个库就是一个文件，手机 App、本地小工具
│   └── Oracle     —— 银行、国企，贵，但稳
│
└── 非关系型（NoSQL）
    ├── Redis         —— 内存键值对，做缓存（第 9 章）
    ├── MongoDB       —— 文档型，直接存 JSON，前端学起来最亲切
    └── Elasticsearch —— 搜索引擎，全文搜索领域的王者
```

**怎么选（一句话版）**：
- 结构化数据 + 需要事务（转账、下单）→ 关系型（MySQL/PG）
- 极速读写 + 数据丢了能接受（缓存、排行榜）→ Redis
- 结构多变的文档（日志、埋点、内容管理）→ MongoDB
- 全文搜索（商品搜索、文章搜索）→ Elasticsearch

> 💡 **为什么你的项目选 PostgreSQL？** 三个理由：① 你的穿搭数据是嵌套 JSON，PG 的 JSONB 类型原生支持存 JSON 还能建索引查询（MySQL 的 JSON 支持较弱）；② Prisma 对 PG 支持最完善；③ 免费开源、社区活跃。面试被问"为什么选 PG"就按这个思路答（详见第十二章 Q28）。

## 1.3 核心概念对照表（前端 → 数据库）

学新领域最快的方法是映射到已知概念。下面这张表是**全文档最重要的一张表**，建议打印贴墙上：

| 前端概念 | 数据库概念 | 说明 |
|------|--------|------|
| `localStorage` / 一个 JSON 文件 | **数据库（Database）** | 最大的容器，一个库里有多个表 |
| 一个数组 `users = []` | **表（Table）** | 存同一类数据，结构固定 |
| 数组中的一个对象 `{id, name}` | **行（Row / Record）** | 一条具体的数据 |
| 对象的属性 `obj.name` | **列（Column / Field）** | 数据的一个字段 |
| `array.find(x => x.id === 1)` | `SELECT ... WHERE id = 1` | 查询一条 |
| `array.filter(x => x.age > 18)` | `WHERE age > 18` | 条件过滤 |
| `array.sort((a,b) => b.time - a.time)` | `ORDER BY time DESC` | 排序 |
| `array.slice(20, 30)` | `LIMIT 10 OFFSET 20` | 分页 |
| 对象的 `key`（React 列表的 key） | **主键（Primary Key）** | 唯一标识一行，绝不重复 |
| 接口的 TypeScript 类型定义 | 表的 **Schema**（列 + 类型 + 约束） | 定义数据结构 |
| 两个对象通过 id 互相引用 | **外键（Foreign Key）** | 建立表间关系 |

**逐条理解几个容易懵的**：

- **主键**：React 列表渲染为什么要求 key？为了区分"这一行是谁"。数据库同理：每行必须有个唯一标识，不然"更新第 3 条数据"这种话毫无意义。主键 = 最重要的那个 key，一张表只有一个，不能重复、不能为空。
- **Schema**：TS 的 interface 编译成 JS 后就没了，但表的 Schema 是**真实存储在数据库里**的强制约束——你往 users 表塞一个没有 username 的对象，数据库直接报错拒绝，而不是像 JS 一样默默变成 `undefined`。
- **外键**：avatars 表的 `user_id` 列存的是 users 表某行的 id。相当于 JS 里 `avatar.userId` 引用 `user.id`——但外键是数据库**强制保证**这个 id 确实存在，引用一个不存在的用户？门都没有。

## 1.4 你项目的架构全景

从点击到数据的完整链路（**面试讲项目时的黄金素材**）：

```
浏览器（React）
   │  fetch('/api/auth/login')
   ▼
Next.js API Routes（app/api/**/route.ts）     ← 后端入口，处理请求
   │  prisma.user.findUnique(...)
   ▼
Prisma Client（生成类型安全的查询）            ← ORM，把 JS 调用翻译成 SQL
   │  TCP 连接（走的 5432 端口）
   ▼
PostgreSQL（localhost:5432）                  ← 数据库本体，执行 SQL
   │
   ▼
数据文件（磁盘）                              ← 最终落盘的地方
```

**逐层拆解一次"登录"请求**：

1. 浏览器 `fetch('/api/auth/login')`，携带用户名和密码
2. Next.js 的 `app/api/auth/login/route.ts` 收到请求，取出参数
3. 代码调用 `prisma.user.findUnique({ where: { username } })`
4. Prisma 把这行 JS 翻译成 SQL：`SELECT * FROM users WHERE username = $1 LIMIT 1`，通过 TCP 连接发给 PostgreSQL
5. PostgreSQL 解析 SQL → 用索引找到那一行 → 返回
6. Prisma 把返回的行包装成 TypeScript 对象（带类型），交给你的代码
7. 代码比对密码哈希，签发 JWT，返回响应
8. 浏览器拿到响应，跳转页面

> 💡 **为什么要知道这个**：以后接口报错，你要能判断"锅在哪一层"——是前端参数没传对？API 逻辑错了？还是数据库挂了/查询慢了？分层思维是排查问题的第一能力。

---

# 第二章：SQL 完整语法

> SQL 分三类，先记住这个大框架：
> - **DDL**（Data Definition Language，数据定义）：创建/修改/删除**表结构**——`CREATE / ALTER / DROP`
> - **DML**（Data Manipulation Language，数据操作）：操作**表里的数据**——`SELECT / INSERT / UPDATE / DELETE`
> - **DCL**（Data Control Language，数据控制）：管理**权限**——`GRANT / REVOKE`
>
> 面试 90% 考 DML，DCL 见第十一章。

## 2.1 DDL：定义表结构

### CREATE TABLE 逐行精讲

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);
```

逐行拆开（**这段是理解约束的钥匙**）：

- **`id UUID PRIMARY KEY`**：id 列的类型是 UUID（通用唯一标识符，形如 `a3bb189e-8bf9-3888-9912-ace4e6543002`）。`PRIMARY KEY` = 唯一 + 非空，是这行的身份证。
- **`DEFAULT gen_random_uuid()`**：不手动传 id 时，数据库自动生成一个随机 UUID。相当于写了个默认参数 `id = id ?? gen_random_uuid()`。
- **`username VARCHAR(50) UNIQUE NOT NULL`**：
  - `VARCHAR(50)`：变长字符串，最长 50 字符，存 5 个就占 5 个的空间
  - `NOT NULL`：必填。插入时没有 username？报错
  - `UNIQUE`：唯一。两个人都叫 `xiaoming`？第二个人插入直接失败——注册重名检测**不用写代码**，数据库帮你把门
- **`password_hash VARCHAR(255) NOT NULL`**：存的是密码的**哈希值**而不是明文。为什么？数据库被拖库时，攻击者拿到的也是一堆不可逆的哈希，用户密码不泄露。**这是后端安全的铁律：永远不存明文密码。**
- **`created_at TIMESTAMP DEFAULT NOW()`**：创建时间，默认当前时刻。`NOW()` 是数据库的时间，不是你服务器的时间——相信数据库，它的时钟最准。

### ALTER / DROP 详解

```sql
-- 加一列（对已有表"无痛"扩展，老数据该列自动填 NULL）
ALTER TABLE users ADD COLUMN email VARCHAR(100);

-- 删一列（列里的数据一并删除！不可恢复，生产环境慎用）
ALTER TABLE users DROP COLUMN email;

-- 改列类型（如果现有数据转不成新类型会失败）
ALTER TABLE users ALTER COLUMN username TYPE VARCHAR(100);

-- 删表（整个表连结构带数据一起消失，高危中的高危）
DROP TABLE users;
```

**类比**：DDL ≈ 改 TypeScript 的 interface（改的是"结构"）；DML ≈ 操作数据本身（往数组里 push 一条）。改 interface 不影响已运行的程序，但 DDL 是**立即生效**的——ALTER 表的瞬间，所有依赖该表的查询都按新结构来。

**生产环境注意**：对大表执行 ALTER 可能锁表（几百万行的表加列可能卡住线上请求）。加索引要用 `CREATE INDEX CONCURRENTLY`（不阻塞写入），改表结构要挑低峰期。

## 2.2 SELECT 查询详解

### 基础查询

```sql
SELECT * FROM users;                          -- 查全部（* 表示所有列）
SELECT id, username FROM users;               -- 只查两列（推荐写法，省流量）
SELECT DISTINCT status FROM poster_jobs;      -- 去重，看这张表有哪些状态值
```

**为什么要少用 `SELECT *`**：① 传输浪费——前端只要 2 列你传 20 列；② 索引失效——查询所有列就没法用"覆盖索引"优化（第 4 章）；③ 代码脆弱——表加列后，依赖列顺序的代码会悄悄出 Bug。**练完第 4 章你会回来感谢这条建议的。**

### WHERE 条件全家桶（逐条讲透）

WHERE 是 SQL 的 `filter()`，熟练度直接决定你写 SQL 的速度。

```sql
-- ① 比较：= > < >= <= <>（<> 是"不等于"，等价于 !=）
WHERE id = 'xxx'
WHERE created_at > '2026-01-01'

-- ② 范围：BETWEEN 是"闭区间"，包含两端
WHERE created_at BETWEEN '2026-01-01' AND '2026-12-31'
-- 等价于 created_at >= '2026-01-01' AND created_at <= '2026-12-31'

-- ③ 集合：IN
WHERE status IN ('pending', 'running')
-- 相当于 ['pending','running'].includes(status)

-- ④ 模糊匹配：LIKE
WHERE username LIKE 'xiao%'    -- xiao 开头（% 匹配任意长度任意字符）
WHERE username LIKE '%ming'    -- ming 结尾
WHERE username LIKE '%aom%'    -- 中间包含
-- 还有 _ 匹配单个字符：LIKE 'xiao_' 匹配 xiaoming 但不匹配 xiaom
```

**LIKE 与索引的关键关系**（第 4 章伏笔，先记住结论）：
- `LIKE 'xiao%'` ✅ **可以用索引**——索引是按字母序排的，"x 开头的都在连续区域"，直接定位
- `LIKE '%ming'` ❌ **索引失效**——结尾是 ming 的字符串在索引里散落在各处，只能全表扫
- 类比电话簿（按姓排序）：知道姓（开头）能翻到那一页；只知道名（结尾）？从头翻到尾吧

```sql
-- ⑤ 空值判断（初学者第一大坑！）
WHERE cover_url IS NULL       -- ✅ 正确
WHERE cover_url IS NOT NULL   -- ✅ 正确
WHERE cover_url = NULL        -- ❌ 永远查不到任何东西！
```

**为什么 `= NULL` 不行**：SQL 里 NULL 的语义是"未知"，不是某个具体值。未知的值和任何东西比较，结果还是"未知"（不是 true），所以条件永远不成立。记住口诀：**判断 NULL 只能用 IS，不能用 =**。

```sql
-- ⑥ 组合条件
WHERE status = 'done' AND (style = 'anime' OR style = 'realistic')
```

**AND 优先级高于 OR**（类似乘法优先于加法）。如果不加括号，`A AND B OR C` 会被解析成 `(A AND B) OR C`——含义完全变了。**口诀：AND 和 OR 混用时，永远加括号。**

### 排序与分页

```sql
-- 排序：ASC 升序（默认），DESC 降序
-- 多列排序：先按 status 升序，status 相同的再按 created_at 降序
SELECT * FROM poster_jobs
ORDER BY status ASC, created_at DESC;

-- 分页：LIMIT 取几条，OFFSET 跳过几条
SELECT * FROM avatars
ORDER BY created_at DESC
LIMIT 10 OFFSET 20;    -- 第 3 页（跳过前 20 条，取 10 条）
```

**OFFSET 的坑**（第 7 章深讲）：`OFFSET 100000` 意味着数据库要**先扫出前 10 万条再扔掉**。数据量大的表翻到后面页会越来越慢——这就是"深分页问题"，解法是游标分页（第 7 章）。

**前端对接分页的完整例子**：
```sql
-- 前端传页码 page=3、每页 10 条，后端换算：
-- LIMIT = 10（每页条数）
-- OFFSET = (page - 1) * 10 = 20（跳过前两页）
```

### 聚合函数 + GROUP BY

聚合 = 把多行压缩成一个值（数组操作里的 `reduce`）。

```sql
-- 五大聚合函数：COUNT 计数 / SUM 求和 / AVG 平均 / MAX 最大 / MIN 最小
SELECT COUNT(*) FROM users;                    -- 总用户数：一个数字

-- GROUP BY：分组聚合——"每个用户有多少头像"
SELECT user_id, COUNT(*) AS avatar_count
FROM avatars
GROUP BY user_id;
```

**GROUP BY 怎么理解**：`GROUP BY user_id` 把相同 user_id 的行归成一堆，然后**每堆输出一行**。`COUNT(*)` 数的是每堆的行数。类似：

```javascript
// 等价的 JS：
const result = {}
for (const avatar of avatars) {
  const key = avatar.userId
  result[key] = (result[key] || 0) + 1
}
```

**铁律**：`SELECT` 里出现的非聚合列，**必须**出现在 `GROUP BY` 里。为什么？分组后每堆可能有很多不同的 name，数据库不知道该输出哪个——直接报错。这是初学者写 GROUP BY 最常见的报错。

```sql
-- ❌ 报错：name 没在 GROUP BY 里
SELECT user_id, name, COUNT(*) FROM avatars GROUP BY user_id;

-- ✅ 正确
SELECT user_id, COUNT(*) FROM avatars GROUP BY user_id;
```

```sql
-- HAVING：对"分组后的结果"再过滤
SELECT user_id, COUNT(*) AS cnt
FROM avatars
GROUP BY user_id
HAVING COUNT(*) > 5;        -- 只要头像数 > 5 的用户
```

**WHERE 和 HAVING 的区别**（高频面试题）：
- `WHERE` 在分组**前**过滤原始行 → 不影响分组的内容
- `HAVING` 在分组**后**过滤"聚合结果" → 可以用聚合函数做条件
- 记法：**WHERE 管行，HAVING 管组**。WHERE 里写 `COUNT(*)` 是非法的（还没分组，没法数）。

```sql
-- 组合示例：2026 年创建的、头像数超过 5 的用户
SELECT user_id, COUNT(*) AS cnt
FROM avatars
WHERE created_at >= '2026-01-01'    -- 先过滤行：只要 2026 年的
GROUP BY user_id                     -- 再分组
HAVING COUNT(*) > 5;                 -- 最后过滤组
```

### 执行顺序（面试常问，必须理解）

SQL 的**书写顺序**和**执行顺序**不一样：

```
书写：SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
执行：FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

为什么执行顺序重要？两个实战场景：

1. **为什么 WHERE 里不能用 SELECT 的别名**：
```sql
SELECT user_id, COUNT(*) AS cnt FROM avatars
WHERE cnt > 5;    -- ❌ 报错！执行到 WHERE 时，SELECT 还没跑，根本不存在 cnt
```
2. **为什么 ORDER BY 可以用别名**：ORDER BY 在 SELECT 之后执行，别名已经生效了。

> 💡 记忆技巧：把 SQL 想成一条流水线——先找到表（FROM）→ 筛选行（WHERE）→ 打包（GROUP BY）→ 筛选包（HAVING）→ 决定输出什么（SELECT）→ 排序（ORDER BY）→ 截断（LIMIT）。

### JOIN 三种连接（画图理解）

JOIN 解决"数据分散在多张表，怎么一起查"的问题。

```
表A（users）        表B（avatars）
  ○○○○              ●●●●●

INNER JOIN：  两表的交集（用户有头像的才显示）
LEFT JOIN：   左表全保留 + 右表匹配的；右表没匹配的补 NULL
              （所有用户都显示，没头像的用户头像数显示 0）
RIGHT JOIN：  右表全保留（很少用，通常把表换个位置改写 LEFT）
```

**用真实场景理解**：

```sql
-- 需求：查所有用户和他们的头像数，没头像的用户也要显示 0
SELECT u.username, COUNT(a.id) AS avatar_count
FROM users u
LEFT JOIN avatars a ON a.user_id = u.id
GROUP BY u.username;
```

逐个拆解：
- `FROM users u`：主表是 users（u 是别名，后面写 u.id 比 users.id 省事）
- `LEFT JOIN avatars a ON a.user_id = u.id`：把 avatars 表"贴"到 users 上，匹配条件是 `a.user_id = u.id`。LEFT 意味着 users 的每一行都保留——没头像的用户，贴上来的 a 列全是 NULL
- `GROUP BY u.username`：按用户名分组
- `COUNT(a.id)`：数每组的 avatar id 个数

**易错点（高频考点）**：为什么是 `COUNT(a.id)` 而不是 `COUNT(*)`？
- 没头像的用户那一行，`a.id` 是 NULL
- `COUNT(列)` **忽略 NULL**，所以数出来是 0 ✅
- `COUNT(*)` 数所有行，NULL 也算，数出来是 1 ❌（明明没头像却显示 1！）

### 子查询

子查询 = 查询里套查询，适合"先算个中间结果，再基于它查"的场景。

```sql
-- 需求：查"头像数超过平均头像数"的用户
SELECT username FROM users
WHERE id IN (
  SELECT user_id FROM avatars
  GROUP BY user_id
  HAVING COUNT(*) > (SELECT AVG(cnt) FROM (
    SELECT COUNT(*) AS cnt FROM avatars GROUP BY user_id
  ) t)
);
```

**从里往外读**：
1. 最内层：算出每个用户的头像数（一堆数字）
2. 中间层：对这堆数字求平均（一个数字）
3. 外层：找出头像数大于这个平均值的用户

**什么时候用子查询 vs JOIN**：逻辑简单（IN 一个列表）时子查询可读性好；复杂关联时 JOIN 通常性能更好（优化器处理 JOIN 的手段更多）。初学阶段优先写对，再追求写快。

### UNION：合并两个查询结果

```sql
-- UNION 去重（合并后帮你去掉重复行），UNION ALL 不去重（更快）
SELECT id, username AS name FROM users
UNION ALL
SELECT id, name FROM avatars;
```

**注意**：UNION 两个查询的**列数和对应列类型必须一致**（列名可以不同，取第一个查询的）。去重要额外排序比较，**确定没有重复时就用 UNION ALL 省性能**。

### CASE WHEN：SQL 里的 if-else

```sql
SELECT
  name,
  CASE
    WHEN status = 'done' THEN '已完成'
    WHEN status = 'running' THEN '进行中'
    ELSE '其他'
  END AS status_text          -- 前端拿到直接渲染，不用再写映射函数
FROM poster_jobs;
```

**前端价值**：状态映射这种事，写在前端要每个页面重复一份，写在 SQL 里一次搞定。CASE WHEN 还能做**行转列**（把"按天分行的统计"变成"一行 12 个月"），是报表 SQL 的核心技巧。

### 常用函数速查

| 函数 | 作用 | 例子 |
|------|------|------|
| `NOW()` | 当前时间 | `WHERE created_at > NOW() - INTERVAL '7 days'`（最近 7 天） |
| `COALESCE(a, b)` | a 为 NULL 时用 b 兜底 | `COALESCE(cover_url, '/default.png')` ≈ `cover_url ?? '/default.png'` |
| `LENGTH(s)` | 字符串长度 | `WHERE LENGTH(username) < 2`（过滤太短的用户名） |
| `UPPER / LOWER` | 大小写转换 | `WHERE LOWER(email) = LOWER(input)`（忽略大小写比对） |
| `SUBSTRING(s, 1, 3)` | 截取字符串（从第 1 位取 3 个） | — |
| `CONCAT(a, b)` / `\|\|` | 拼接 | `username \|\| '@avatar'` ≈ JS 的模板字符串 |
| `DATE_TRUNC('day', ts)` | 时间截断到天 | 按天统计必备（把 10:30 和 11:45 都归到"那天"） |

**按天统计的黄金组合**（前端做图表常用）：
```sql
SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*)
FROM avatars
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

## 2.3 INSERT / UPDATE / DELETE

### INSERT 详解

```sql
-- 插入单条 + 返回插入的行（PG 特有 RETURNING，MySQL 没有）
-- 为什么有用：id 是数据库自动生成的，RETURNING 让你立刻拿到它，不用再查一次
INSERT INTO users (username, password_hash)
VALUES ('xiaoming', 'hash...')
RETURNING id, created_at;

-- 插入多条（批量，性能远好于循环插 100 次）
INSERT INTO users (username, password_hash) VALUES
  ('a', 'hash1'),
  ('b', 'hash2');

-- 插入时冲突怎么办？ON CONFLICT：已存在就更新（"upsert"）
INSERT INTO users (id, username) VALUES (...)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;
```

**列名列表的意义**：`INSERT INTO users (username, password_hash)` 明确只提供这两列，其他列走默认值。**永远显式写列名**——不写的话数据库按列顺序填，表结构一变（中间加了列）你的代码就悄悄错位了。

### UPDATE 详解

```sql
-- 基础更新
UPDATE avatars SET name = '新名字' WHERE id = 'xxx';

-- 基于旧值计算（读取-计算-写入是原子的，并发安全）
UPDATE avatars SET name = name || '-副本' WHERE id = 'xxx';

-- 更新多列
UPDATE avatars SET name = 'x', base_id = 'y' WHERE id = 'xxx';
```

### DELETE 详解

```sql
-- 带条件删除
DELETE FROM poster_jobs
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';

-- ⚠️ 不带 WHERE = 删除全表数据！和 TRUNCATE 效果一样，但更慢
DELETE FROM avatars;   -- 手一抖，全没了
```

### ⚠️ 铁律：UPDATE / DELETE 前先 SELECT

```sql
-- 第 1 步：用同样的 WHERE 跑 SELECT，确认影响范围
SELECT * FROM poster_jobs
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';
-- 看一眼：哦，12 条，都是该删的

-- 第 2 步：确认无误，改成 DELETE 再执行
DELETE FROM poster_jobs
WHERE status = 'failed' AND created_at < NOW() - INTERVAL '30 days';
```

这不是仪式感，是无数删库事故换来的规矩。生产环境删数据前，最好再用事务包裹：BEGIN → DELETE → 检查行数 → 确认后 COMMIT / 后悔了 ROLLBACK（第 5 章细讲）。

---

# 第三章：表设计深入

> 表设计 = 数据库世界的"架构设计"。表设计得好，后面 80% 的麻烦都没有；设计得烂，写再多 SQL 都是在还债。

## 3.1 数据类型怎么选

类型选错，轻则浪费空间，重则数据出错（金额精度丢失）或查询变慢。逐个讲：

| 需求 | PostgreSQL 类型 | 说明 |
|------|----------------|------|
| 主键 | `UUID` | 你项目用的，分布式友好 |
| 短文本 | `VARCHAR(n)` | 用户名、标题（有长度上限的） |
| 长文本 | `TEXT` | 内容、JSON 字符串（不限长度） |
| 整数 | `INT` / `BIGINT` | 数量、状态码（INT 21亿级，BIGINT 天文数字） |
| 布尔 | `BOOLEAN` | true / false |
| 时间 | `TIMESTAMP` | 创建/更新时间 |
| JSON | `JSONB` | 可索引的 JSON（PG 王牌） |
| 金额 | `NUMERIC(10,2)` | **千万别用 FLOAT，浮点精度丢失** |

**几个类型的深入说明**：

**① 为什么金额千万别用 FLOAT/DOUBLE？**

```javascript
// 前端同学都踩过这个坑：
0.1 + 0.2 === 0.30000000000000004   // true！
```

FLOAT 用二进制存小数，0.1 这种十进制小数在二进制里是无限循环，必然有误差。存钱用 FLOAT，一天百万笔交易累计下来，账就对不上了。`NUMERIC(10,2)` 是"精确十进制"，10 位数字、2 位小数，最多存 99999999.99，**分毫不差**。
（另一个常见做法：金额以"分"为单位存 INT，100 元存 10000，彻底避开小数。）

**② VARCHAR vs TEXT 的区别？**

功能上 PG 里几乎没区别（VARCHAR(n) 只是多了个长度上限）。经验法则：想要"强制限长"（用户名最多 50 字）用 VARCHAR(50)——超长直接报错，相当于数据库层的数据校验；不限长的用 TEXT。

**③ JSONB 是什么？为什么是你项目的关键类型？**

JSONB = 存进数据库时**解析成二进制格式**的 JSON。对比普通 JSON 类型：

```sql
-- 穿搭数据用 JSONB 存
parts JSONB DEFAULT '{}'

-- ① 可以按字段查询（普通 JSON 做不到这么高效）
SELECT * FROM avatars WHERE parts @> '{"hat": ["hat-red"]}';

-- ② 可以建索引，查询不减速
CREATE INDEX idx_parts ON avatars USING GIN (parts);
```

你的头像穿搭数据（帽子、衣服、鞋子……每套组合都不同）用关系型列存要建一堆列，用 JSONB 一个字段全装下，还能查询和建索引。**这就是"结构灵活但需要查询"场景的 PG 解法。**

**④ TIMESTAMP 补充**：还有个 `TIMESTAMPTZ`（带时区）。存"绝对时刻"（创建时间）推荐 TIMESTAMPTZ，跨时区不会乱。初学先知道有这回事即可。

## 3.2 约束详解

约束（Constraint）= 数据库帮你守门。**能在约束层挡住的脏数据，就不要靠应用代码判断**——应用代码可能有 10 个入口，约束只有一道闸，漏不掉。

```sql
CREATE TABLE avatars (
  id         UUID PRIMARY KEY,                    -- 主键：唯一 + 非空
  user_id    UUID NOT NULL REFERENCES users(id),  -- 外键：必须是 users 里存在的 id
             ON DELETE CASCADE,                   -- 级联：删用户连带删头像
  name       VARCHAR(100) NOT NULL,               -- 非空
  base_id    VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()              -- 默认值
);
```

**约束全家福**：

| 约束 | 作用 | 违反时会怎样 |
|------|------|------------|
| `PRIMARY KEY` | 唯一 + 非空，行的身份证 | 重复 id 或空 id → 插入报错 |
| `NOT NULL` | 必填 | 不传值 → 报错 |
| `UNIQUE` | 不许重复 | 重名 → 报错 |
| `DEFAULT` | 不传时给默认值 | 不报错，静默用默认值 |
| `CHECK` | 自定义规则 | `CHECK (price >= 0)`：负价格 → 报错 |

**外键的三种行为**（面试常问，"删用户时他的头像怎么办"）：

- `CASCADE`：删父删子——删用户 → 自动删掉他所有头像。适合头像这种"完全从属于用户"的数据
- `SET NULL`：删父后子的外键置空——要求列允许 NULL。适合"参考关系"数据（文章删除，评论的 article_id 置空保留评论）
- `RESTRICT`（默认）：有子数据时**拒绝删父**——还有头像的用户不许删。最安全，逼你显式处理

**加索引**（第 4 章主角，这里先埋个种子）：

```sql
-- 给高频查询建索引
CREATE INDEX idx_avatars_user_created ON avatars(user_id, created_at);
```

## 3.3 范式与反范式

范式 = 表设计的"卫生规范"，告诉你数据该怎么放才不留后患。

**三大范式（记人话版）**：

**1NF（第一范式）：列不可再分** —— 每个格子只存一个值

```
❌ 违反：tags = "帽子,衣服,鞋"        （一个格子塞了 3 个值）
✅ 正确：建一张 avatar_tags 关联表，或者用 JSONB
```

为什么违反 1NF 有害？想查"所有戴帽子的头像"，你只能 `LIKE '%帽子%'`——又慢又不准（"帽子"和"草帽子"分不清）。

**2NF（第二范式）：非主键列必须完全依赖主键** —— 别把"属于别人的信息"存我这

```
❌ 违反：avatars 表里存 username
   （username 依赖的是 user_id，跟 avatar 自己的 id 没有直接关系）
✅ 正确：username 只在 users 表存一份，要显示就 JOIN
```

为什么有害？用户改名后，avatars 表里 1000 条记录的 username 全是旧的——**数据不一致**的万恶之源。

**3NF（第三范式）：没有传递依赖** —— A 依赖 B、B 依赖 C，那 A 别跟 C 存一起

```
❌ 违反：users 表存 city_id 和 city_name
   （city_name 依赖 city_id，city_id 依赖 user → 传递依赖）
✅ 正确：city 信息单独建一张 cities 表
```

为什么有害？同上：城市改名（比如襄樊→襄阳）要改几十万用户行，漏改一条就是脏数据。

**范式的本质（一句话）**：**每个事实只存一份，存在它该在的地方。** 违反范式的代价都是同一个：同一事实存了多份 → 更新时有的改了有的没改 → 数据不一致。

**反范式（故意违反）**：当 JOIN 成为性能瓶颈时，可以冗余字段换性能。

> 例：avatars 表冗余一份 `username`，列表页不用 JOIN users，查询快一截。
> 代价：用户改名时要同时更新两张表，否则数据不一致。
> **原则：先按范式来，性能真有问题再反范式，且冗余的字段要写清楚同步逻辑。**

## 3.4 表设计实战流程

设计"头像保存"功能的表（就是你项目的 avatars 表，走一遍完整思路）：

```
第 1 步：列实体和字段
  头像：名字、穿搭数据（parts）、封面图、所属用户、创建时间
  ↓ 想清楚"这个实体有哪些属性"，别漏也别贪多

第 2 步：确定关系
  用户 1 : N 头像（一个用户多个头像）
  → 头像表加 user_id 外键
  ↓ 关系判断口诀：1对1（合并？分表？）、1对多（外键放"多"的一方）、多对多（中间表）

第 3 步：选类型加约束
  parts 是嵌套 JSON → JSONB（能查询、能建索引）
  user_id 必须存在 → 外键 + NOT NULL
  用户删除时头像怎么处理 → ON DELETE CASCADE
  ↓ 每一列都要过一遍：什么类型？允不允许空？要不要唯一？

第 4 步：为查询建索引
  高频查询："某用户的头像列表，按时间倒序"
  → @@index([userId, createdAt]) 联合索引
  ↓ 索引跟着查询走，不是跟着列走
```

**常见关系的设计套路**（背下来）：

- **1 : 1**（用户 : 用户详情）：外键放随便一方，加 UNIQUE
- **1 : N**（用户 : 头像）：外键放 N 方（avatars.user_id）
- **N : N**（用户 : 标签）：建中间表 `avatar_tags(avatar_id, tag_id)`，两列组成联合唯一

---

# 第四章：索引原理与优化

> 索引是面试第一高频考点，也是性能优化的核心。这一章值得反复读。

## 4.1 为什么索引快：B+ 树图解

**先感受问题**：没有索引时，查 `WHERE username = 'xiaoming'` 只能**全表扫描**（Seq Scan）——从第 1 行读到第 100 万行，逐个比对。100 万行大约要几百毫秒到几秒。

**直觉解法是二叉树**：把数据按 key 排好，每次比较排除一半，log₂(100万) ≈ 20 次比较就能找到。看起来很快？但有个致命问题——**每比较一次就是一次磁盘 IO**，20 层 = 20 次 IO，每次磁盘寻道约 10ms，就是 200ms，根本不快。

**B+ 树的智慧：把树压扁**。磁盘读写有个特性：读 1 字节和读 4KB 耗时几乎一样（按"页"读取）。既然一次能带 4KB，那就让**每个节点存几百个 key**（4KB 一页）：

```
            [根节点]         ← 第 1 次磁盘 IO（几百个 key 里二分定位）
           /   |    \
     [内部节点]...[内部节点]   ← 第 2 次磁盘 IO
      /  \          /  \
 [叶子节点]      [叶子节点]    ← 第 3 次磁盘 IO，找到数据
 (存实际数据)    (叶子间有链表相连，方便范围查询)
```

**100 万数据只要 3 层 = 3 次 IO ≈ 30ms 以内，比全表扫描快百倍。**

**B+ 树 vs B 树的区别**（经典面试题）：

- B+ 树**数据全在叶子节点**，内部节点只存 key（不存数据）→ 同样 4KB 的节点能塞更多 key → 树更矮 → IO 更少
- B+ 树**叶子节点有双向链表** → 范围查询（`WHERE id > 100 AND id < 200`）顺着链表扫就行；B 树范围查询要回到上层反复横跳

**为什么不用哈希表？** 哈希等值查询 O(1) 确实快，但**不支持范围查询和排序**（`WHERE age > 18`、`ORDER BY` 直接歇菜）。B+ 树是"等值也快、范围更强"的六边形战士。（PG 确实有哈希索引，但 B-tree 是默认通用选择。）

## 4.2 聚簇索引 vs 非聚簇索引

| | 聚簇索引（主键索引） | 非聚簇索引（二级索引） |
|---|---|---|
| 叶子节点存什么 | **整行数据** | 主键 ID |
| 一张表有几个 | 只能有 1 个 | 可以有多个 |
| 查询过程 | 一次找到 | 先查到主键 ID，再**回表**查整行 |

**为什么只能有 1 个聚簇索引**：数据只能按一种方式物理排序（书的内容只能按一种顺序装订）。主键索引决定了数据在磁盘上的物理排列，其他索引只能"间接引用"。

**回表（高频名词）**：用二级索引（如 user_id 索引）查到主键 ID 后，还要再去聚簇索引查一次完整数据。等于查了**两棵树**，多一次 IO。
（PG 的实现细节略有不同——PG 堆表 + 索引指向行位置，但"二级索引查完要再取整行"的思想一致，面试按通用概念答即可。）

**覆盖索引（性能优化利器）**：如果查询的列**都在索引里**，就不用回表：

```sql
-- 有索引 (user_id, created_at)
SELECT user_id, created_at FROM avatars WHERE user_id = 'x';
-- ✅ 要查的两列都在索引里 → 覆盖索引，不回表，飞快

SELECT * FROM avatars WHERE user_id = 'x';
-- ❌ 要查所有列，索引里只有两列 → 必须回表
```

这就是第 2 章说"别 SELECT *"的根本原因：**只查需要的列，才有机会命中覆盖索引**。

## 4.3 联合索引与最左前缀（必考）

联合索引 `(user_id, created_at)` 的本质：**先按 user_id 排序，user_id 相同的再按 created_at 排序**——就像电话簿按"姓 + 名"排序。

```sql
-- ✅ 走索引
WHERE user_id = 'x'                               -- 相当于只用"姓"查：翻到姓 X 的区域
WHERE user_id = 'x' AND created_at > '2026-01-01'  -- 姓+名一起查：定位更准
WHERE user_id = 'x' ORDER BY created_at           -- 排序也免了：姓 X 区域内天然按时间有序

-- ❌ 不走索引（跳过了左边的列）
WHERE created_at > '2026-01-01'                   -- 只知道"名"：电话簿没法按名查
```

**为什么跳过第一列就失效**？想象按（姓, 名）排序的电话簿：所有"张"聚在一起，张内部按名排。你只知道名"伟"——张伟、李伟、王伟散布全簿，只能全簿扫。

**记忆法**：联合索引 = 多级排序，**必须从第一级开始连续使用**。`(a, b, c)` 索引能用的查询：`a` / `a+b` / `a+b+c`；`b`、`a+c`（c 跳过 b）都部分失效。

**设计启示**：建联合索引时，**最常用的等值条件放最左边**，范围条件放后面（范围条件后面的列用不上排序优势）。

## 4.4 索引失效场景（必考，扩充版）

索引不是建了就万事大吉，下面这些写法会让索引悄悄失效，**每一类都要理解"为什么"**：

```sql
-- 1. 对索引列做运算/函数 → 失效
WHERE YEAR(created_at) = 2026                    -- ❌ 索引存的是原始时间，YEAR() 结果没索引
WHERE created_at >= '2026-01-01'
  AND created_at < '2027-01-01'                  -- ✅ 改写成范围查询，索引能用

-- 2. LIKE 以 % 开头 → 失效
WHERE username LIKE '%ming'   -- ❌ 电话簿按姓排序，你只知道名
WHERE username LIKE 'xiao%'   -- ✅ 开头确定，能定位到连续区域

-- 3. 违反最左前缀 → 部分失效（见 4.3）

-- 4. 隐式类型转换 → 失效
WHERE phone = 13800138000  -- phone 是 VARCHAR，传数字 → 数据库偷偷给列做转换
                           -- 相当于 CAST(phone AS INT) = ... → 回到场景 1

-- 5. OR 两侧有一侧没索引 → 全表扫描
WHERE user_id = 'x' OR description LIKE '%test%'
-- description 无索引 → user_id 那边索引救不了整个 OR → 优化器放弃

-- 6. 不等号 != / NOT IN → 大概率失效
-- 否定条件意味着"除了这几行全都要"，通常范围太大，优化器干脆全表扫

-- 7. 数据区分度太低 → 优化器主动放弃索引
WHERE status = 'done'  -- 如果 99% 的行都是 done，走索引还要回表 99 万次，不如直接扫
```

**第 7 条值得展开**：索引的价值在于"排除大多数行"。性别、状态这种只有两三个取值的列，索引几乎帮不上忙。**索引要建在区分度高的列上**（如 user_id，几乎每个值只对应几行）。

**怀疑索引失效怎么办**：别猜，**EXPLAIN 一下**（见 4.5），让数据库告诉你走没走索引。

## 4.5 EXPLAIN 详解

EXPLAIN 是数据库的"透视镜"——不执行查询（ANALYZE 才真执行），展示它**打算怎么查**。

```sql
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'uuid-xxx';
-- EXPLAIN       只看计划（不执行）
-- EXPLAIN ANALYZE 真实执行并报告真实耗时（学习/debug 用，别在生产乱跑慢查询）
```

重点看输出里的：

| 字段 | 看什么 |
|------|--------|
| `Seq Scan` | 全表扫描 → 🚨 警报，该加索引了 |
| `Index Scan` | 走了索引 → ✅ |
| `Index Only Scan` | 覆盖索引，没回表 → ✅✅ 最快 |
| `rows` | 预计扫描行数，越小越好 |
| `actual time` | ANALYZE 模式下真实耗时（毫秒） |

**实战读法示例**：

```
Index Scan using idx_avatars_user_created on avatars
  (cost=0.42..8.44 rows=1 width=222) (actual time=0.015..0.018 rows=1 loops=1)
```

翻译：用了 idx_avatars_user_created 索引 ✅，预计扫 1 行，实际 0.018ms —— 非常健康。

如果是 `Seq Scan on avatars (rows=100000)` —— 没走索引、要扫 10 万行，赶紧检查 WHERE 条件是不是触发了 4.4 的失效场景。

---

# 第五章：事务与并发

## 5.1 为什么需要事务

**事务（Transaction）= 把多条 SQL 捆绑成一个"要么全成、要么全不干"的单元。**

```typescript
// 没有事务的危险操作：
await prisma.user.delete({ where: { id } })        // 删了用户
// ← 如果这里服务器断电 / 进程崩溃 / 磁盘满了
await prisma.avatar.deleteMany({ where: { userId: id } })  // 头像没删 → 脏数据！
// 结果：头像的 user_id 指向一个不存在的用户（好在有外键会拦住，但如果没有外键呢？）
```

现实世界的类比：**银行转账**。A 账户 -100 元 和 B 账户 +100 元 必须同时成功。只成功一半，要么 A 白亏 100，要么银行凭空印 100。事务保证这两步是原子的。

```typescript
// 有事务：两步要么都成功，要么都回滚
await prisma.$transaction([
  prisma.user.delete({ where: { id } }),
  prisma.avatar.deleteMany({ where: { userId: id } }),
])
// 中途任何一步失败 → 之前已执行的步骤自动撤销 → 数据回到事务开始前的样子
```

**事务的三个关键词**（psql 手动操作时）：

```sql
BEGIN;      -- 开启事务
UPDATE ...; -- 操作 1
DELETE ...; -- 操作 2
COMMIT;     -- 确认提交（所有操作生效）
-- 或者
ROLLBACK;   -- 反悔撤销（所有操作作废）
```

## 5.2 ACID 详解（必考）

ACID 是事务的四大特性，逐个拆：

| 特性 | 含义（人话） | 靠什么实现 |
|------|------|-----------|
| **A** 原子性 Atomicity | 事务内操作不可分割，全做或全不做（转账不能只扣不加） | Undo Log（回滚日志） |
| **C** 一致性 Consistency | 事务前后数据满足所有约束（钱的总额不变、外键不悬空） | 由 A、I、D 共同保证 + 应用层 |
| **I** 隔离性 Isolation | 并发事务互相看不到中间状态（A 转账转一半，B 不能来查余额） | 锁 + MVCC |
| **D** 持久性 Durability | 提交后断电也不丢（COMMIT 成功 = 数据真的在磁盘上了） | Redo Log（WAL，先写日志再写数据） |

**四个特性怎么记**：
- A 是对**一个事务**说的：内部操作打包，不可分割
- I 是对**多个事务**说的：并发时互不干扰
- D 是对**故障**说的：提交了就别想丢
- C 是**最终目标**：前三者是手段，一致性是结果（所以面试答"C 由 AID 共同保证"是加分项）

**WAL 为什么重要（加分项）**：

WAL（Write-Ahead Log，预写日志）的核心思想：**每次改数据，先写日志文件，再慢慢改数据文件**。

为什么这么设计？
- 写日志是**顺序写**（往文件末尾追加），磁盘顺序写极快
- 改数据文件是**随机写**（数据散落在磁盘各处），慢

所以流程是：`改数据 → 先记 WAL（快） → 告诉用户"提交成功" → 后台慢慢把改动刷进数据文件`。如果刷盘途中断电？重启后**重放 WAL 日志**，把没刷完的改动补上。这就是"**先记账，后干活**"——账本（日志）永远比实际库存（数据）新。

## 5.3 并发读问题与隔离级别（必考）

多个事务并发跑，如果隔离不彻底，会出现三种"脏数据"现象。**逐个用时间线理解**：

**① 脏读（Dirty Read）**——读到了别人**还没提交**的数据

```
时间 →
事务A：读余额（读到 1000）          读到的是 B 改的 1500！
事务B：    改余额 1000 → 1500 ... 然后 B 回滚了（ROLLBACK）
```

B 后来回滚了，A 读到的 1500 是个**从未存在过的幻觉**。如果 A 基于 1500 做了业务决策（比如允许用户提现 1500）——事故。

**② 不可重复读（Non-Repeatable Read）**——同一事务两次读**同一行**，结果不一样

```
事务A：读余额 = 1000   ... 再读余额 = 800（变了！）
事务B：            改余额 1000 → 800，提交
```

A 在一个事务里两次读同一行，中间被 B 改了。如果 A 的逻辑是"读两次做比对校验"，直接错乱。

**③ 幻读（Phantom Read）**——同一事务两次按**同样条件**查询，第二次**多出/少了行**

```
事务A：COUNT(年龄>18 的用户) = 50   ... 再 COUNT = 51（凭空多了 1 个！）
事务B：                    INSERT 一个 19 岁用户，提交
```

**②和③的区别（面试必问）**：不可重复读针对**已存在行的修改**（UPDATE），幻读针对**行的增删**（INSERT/DELETE）。记法：改的是"读不准"，增的是"见鬼了"。

### 四种隔离级别 vs 三种问题

隔离级别 = 你愿意用多少并发性能换多干净的数据。隔离越严格，问题防得越多，但并发性能越差：

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|----------|------|-----------|------|
| 读未提交（Read Uncommitted） | ❌ 有 | ❌ 有 | ❌ 有 |
| **读已提交（Read Committed）** | ✅ 防住 | ❌ 有 | ❌ 有 |
| **可重复读（Repeatable Read）** | ✅ | ✅ 防住 | 大部分防住 |
| 串行化（Serializable） | ✅ | ✅ | ✅ 全防住 |

- **读未提交**：啥也不防，性能最好，几乎没人用
- **读已提交**：只读别人提交了的数据——最低的"卫生底线"
- **可重复读**：一个事务内读到的数据保持一致——大部分业务的最优选
- **串行化**：并发事务排队执行，全防住但性能最差

**必须记住的两个默认值**：
> **PostgreSQL 默认：读已提交（Read Committed）**
> **MySQL InnoDB 默认：可重复读（Repeatable Read）**

**怎么选**：一般用默认就好。转账、库存这种强一致场景可以升到可重复读；串行化极少用（性能损耗太大，PG 的 Serializable 是基于SSI 的高性能实现，仍然有代价）。

## 5.4 MVCC：高并发的秘密（进阶加分项）

**问题**：如果靠纯锁实现隔离——读加共享锁、写加排他锁——那么"读写"和"写写"都要互相等待，并发性能会很差。

**MVCC（Multi-Version Concurrency Control，多版本并发控制）的思路**：每行数据保留多个版本，每个事务"各读各的版本"，互不打扰：

```
事务A开始 → 拿到快照（看到的是数据版本号 100）
事务B修改数据并提交 → 数据变成版本 101（旧版本 100 仍保留着）
事务A再读 → 还是读版本 100（不受 B 影响）→ 可重复读达成！
```

**效果**：读不阻塞写，写不阻塞读——读的读旧版本，写的写新版本，井水不犯河水。并发性能起飞。这是 PG 和 MySQL InnoDB 高性能的核心。

**快照时机决定隔离级别**（点睛之笔）：
- 读已提交：**每条语句**执行时拿新快照 → 能看到别人最新提交 → 所以会不可重复读
- 可重复读：**事务开始**时拿快照，全程不换 → 整个事务看到的世界不变

**面试话术（背这段）**：
> "MVCC 通过保存数据的多个版本，让读操作读快照、写操作写新版本，实现了读写不互斥。快照的生成时机决定了隔离级别：读已提交是每条语句一个快照，可重复读是整个事务一个快照。"

---

# 第六章：锁机制

> 锁是隔离性的"物理实现"。MVCC 解决了读写冲突，但**写写冲突**还得靠锁。

## 6.1 锁的粒度

| 锁 | 锁住范围 | 并发度 | 场景 |
|----|---------|--------|------|
| 表锁 | 整张表 | 低 | DDL（改表结构）、全表 UPDATE |
| 行锁 | 一行 | 高 | UPDATE/DELETE 单行 |

类比：表锁 = 整个图书馆闭馆（谁也别进）；行锁 = 某本书被借走（其他人随便看别的书）。**行锁是高并发的关键**——10 个用户同时改各自的数据，互不影响。

（PG 还有更细的：页锁、咨询锁等，初学知道"表锁/行锁"两级即可。）

## 6.2 乐观锁 vs 悲观锁（必考）

这不是数据库的两种"锁对象"，而是**两种并发控制思想**：

**悲观锁（Pessimistic Lock）**：很悲观，"总觉得有人要抢"，先锁住再干活。

```sql
BEGIN;
SELECT * FROM avatars WHERE id = 'x' FOR UPDATE;  -- 锁住这行，别人改不了也读不了（等锁）
UPDATE avatars SET name = 'new' WHERE id = 'x';
COMMIT;                                            -- 提交后才放锁
```

`FOR UPDATE` = "我选中这行就是要改它，其他人排队等着"。适合**冲突频繁**的场景（秒杀扣库存），排队虽然慢但数据绝对安全。

**乐观锁（Optimistic Lock）**：很乐观，"冲突应该很少"，不锁，改的时候再检查数据有没有被人动过。

```sql
-- 表加 version 字段（每次修改 version + 1）
UPDATE avatars
SET name = 'new', version = version + 1
WHERE id = 'x' AND version = 3;
-- 我读到时 version 是 3，改的时候还必须是 3
-- 如果返回 0 行受影响 → 说明被人改过（version 已变）→ 重试或报错
```

**类比**：悲观锁 = 公共厕所锁门；乐观锁 = Git 提交前 `git pull` 检查冲突。Git 就是典型的乐观锁思想——平时随便写，push 时才发现冲突，解决重来。

**怎么选**：
- 冲突少（读多写少，比如编辑个人资料）→ 乐观锁（无锁开销，性能好）
- 冲突多（写多且集中，比如秒杀库存、抢票）→ 悲观锁（乐观锁重试风暴反而更慢）

## 6.3 死锁（经典场景）

**死锁 = 两个事务互相持有对方想要的锁，互相等待，永远等下去。**

```
事务A：锁住了行1，想锁行2  ↘
                             ← 互相等对方放锁 → 死锁
事务B：锁住了行2，想锁行1  ↖
```

具体时间线：

```
时刻1：事务A 执行 UPDATE ... WHERE id=1  → A 锁住行1
时刻2：事务B 执行 UPDATE ... WHERE id=2  → B 锁住行2
时刻3：事务A 执行 UPDATE ... WHERE id=2  → A 等 B 放锁
时刻4：事务B 执行 UPDATE ... WHERE id=1  → B 等 A 放锁
→ 两人死等。数据库死锁检测器发现后，强制回滚其中一个（牺牲者），另一个继续
```

**预防**：
1. 所有事务按**固定顺序**访问数据（都先处理行1再处理行2 → A、B 都先抢行1，抢到的先干，抢不到的排队，不会成环）
2. 事务尽量短小，**别在事务里调外部 API / sleep**（锁持有时间越长，死锁概率越大）
3. 一次性锁定需要的所有行（PG 可用 `SELECT ... FOR UPDATE` 一次锁多行）

> 💡 应用层还有一个"死锁近亲"叫**丢失更新**：两人同时读旧值 → 各自计算 → 先后写回 → 后写的覆盖先写的。解法就是 6.2 的乐观锁或悲观锁。

---

# 第七章：性能优化专题

> 优化是一门"先测量、再动手"的科学。核心口诀：**用数据说话，别拍脑袋。**

## 7.1 慢查询优化全流程（面试被问"怎么优化"就按这个答）

```
第 1 步：定位慢查询
  → 开慢查询日志（PG: log_min_duration_statement = 200，超过 200ms 的记录下来）
  → 或 APM 监控发现某接口 P95 耗时高

第 2 步：EXPLAIN 分析执行计划
  → 看是不是 Seq Scan（全表扫描）
  → 看 rows 预估行数是否离谱

第 3 步：对症下药
  → 缺索引 → 加索引（90% 的慢查询止步于此）
  → 索引失效 → 改写法（见 4.4：函数运算改范围、前导 % 换搜索引擎）
  → SELECT * → 只查需要的列（争取覆盖索引）
  → 深分页 → 改游标分页

第 4 步：SQL 层面无解 → 架构层面
  → 加 Redis 缓存（读多写少的热点数据）
  → 读写分离（读走从库）
  → 分库分表（最后手段）
```

**答题技巧**：面试时**说出这个分层思路比背十个别技巧更打动面试官**——它体现的是"定位 → 分析 → 分层解决"的工程思维。

## 7.2 SQL 优化 10 条军规（逐条讲为什么）

```sql
-- 1. 别 SELECT *，只查需要的列
-- 为什么：① 减少网络传输 ② 有机会命中覆盖索引（见 4.2）③ 加列不炸隐式依赖
SELECT id, name FROM avatars;  -- ✅

-- 2. 深分页改游标分页
-- 为什么：OFFSET 100000 要扫 10 万行再丢弃，越翻越慢
SELECT * FROM avatars ORDER BY id LIMIT 10 OFFSET 100000;   -- ❌ 慢
SELECT * FROM avatars WHERE id > '上一页最后的id' ORDER BY id LIMIT 10;  -- ✅ 快
-- 原理：WHERE id > xxx 直接用索引定位起点，跳过的行根本不碰
-- 代价：不能跳页（只能"下一页"），适合信息流的"加载更多"交互

-- 3. 小表驱动大表（JOIN 优化）
-- 思想：外层循环次数越少越好。PG/MySQL 优化器大多会自动调整顺序，
-- 但子查询 IN (...) 的小结果集驱动大表扫描是经典优化

-- 4. 批量操作代替循环单条
-- 为什么：每条 SQL 都有网络往返 + 解析开销，100 次 = 100 倍开销
INSERT INTO t VALUES (...), (...), (...);  -- ✅ 一次搞定
-- 而不是循环执行 100 次单条 INSERT

-- 5. COUNT(*) 就行，别 COUNT(列)
-- 为什么：COUNT(列) 要逐行判断 NULL，COUNT(*) 什么都不用判断
-- （COUNT(1) 和 COUNT(*) 在 PG/MySQL 里性能等价）

-- 6. 能用 UNION ALL 就别用 UNION
-- 为什么：UNION 要去重（先合并再排序比较），UNION ALL 直接连缀，省一大截

-- 7. 避免在 WHERE 中对 NULL 做判断后参与 OR（容易全表扫）

-- 8. 大事务拆小事务
-- 为什么：长事务占锁（阻塞别人）、占连接（连接池耗尽）、拖主从延迟

-- 9. 统计类查询考虑预计算
-- 为什么：COUNT 百万行每次现算太贵，定时任务算好存结果表，查询变 O(1)

-- 10. LIKE '%xx' 全文搜索需求 → 别硬扛，上 Elasticsearch
-- 为什么：数据库的模糊匹配是全表扫描，ES 是倒排索引，专业的事交给专业的工具
```

## 7.3 什么时候优化到头了（量级参考）

| 手段 | 能扛的量级 | 复杂度 |
|------|-----------|--------|
| 加索引/优化 SQL | 百万级 | ⭐ |
| Redis 缓存 | 千万级读 | ⭐⭐ |
| 读写分离（主从） | 读多写少场景 | ⭐⭐⭐ |
| 分库分表 | 亿级 | ⭐⭐⭐⭐⭐（小项目别碰） |

**决策心法**：能靠加索引解决就不上缓存；能靠缓存扛住就不拆主从；能主从扛住就别分库分表。**复杂度是最后手段**——每升一级，运维成本和故障面都翻倍。你现在的项目，索引 + SQL 写好就足够了。

---

# 第八章：ORM 与 Prisma 深入

> ORM（Object-Relational Mapping，对象关系映射）= 用写 JS 的方式操作数据库。你写 `prisma.user.findUnique()`，它帮你翻译成 SQL。**但记住：ORM 再好用，SQL 功底不能丢**——ORM 出了性能问题，最后还得靠读 SQL、看 EXPLAIN 来救。

## 8.1 Prisma 工作链路

```
prisma/schema.prisma（定义模型，单一数据源）
      │  npx prisma generate
      ▼
生成 TypeScript Client（node_modules/.prisma）
      │  npx prisma migrate dev（开发）/ deploy（生产）
      ▼
数据库表结构（自动同步 + 生成迁移文件）
```

**三个关键命令**（初学者最容易混）：

| 命令 | 干什么 | 什么时候用 |
|------|--------|-----------|
| `npx prisma generate` | 读 schema → 生成 TS Client 代码 | **每次改 schema 后、部署时必须跑** |
| `npx prisma migrate dev` | 对比 schema 和数据库差异 → 生成迁移 SQL → 应用 | 本地开发 |
| `npx prisma migrate deploy` | 只应用已有的迁移文件（不生成新的） | 生产部署 |

**为什么 `prisma generate` 必须在部署时执行**：Client 是根据 schema **生成的代码**，不在 git 里。代码拉下来后 node_modules 里可能还是旧 Client（没有新字段的方法），必须重新生成才能用。这就是为什么你流水线里部署脚本有这一步。

**schema 定义长什么样**（对应第 3 章的表设计）：

```prisma
model Avatar {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  baseId    String   @map("base_id")
  parts     Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId, createdAt])   // 联合索引（第 4 章）
  @@map("avatars")               // 映射到数据库的表名
}
```

## 8.2 常用操作对照（Prisma ↔ SQL ↔ 前端类比）

```typescript
// 查询单条（findUnique：按唯一约束查）
prisma.user.findUnique({ where: { username } })
// → SELECT * FROM users WHERE username = $1 LIMIT 1

// 查询多条 + 条件 + 排序 + 分页（列表页标配四件套）
prisma.avatar.findMany({
  where: { userId },                 // WHERE
  orderBy: { createdAt: 'desc' },    // ORDER BY created_at DESC
  take: 10,      // LIMIT
  skip: 20,      // OFFSET
})

// 关联查询（一次 JOIN 拿到关联数据）
prisma.avatar.findMany({ include: { user: true } })
// → SELECT ... FROM avatars JOIN users ON ...

// 创建（返回值就是带默认值的完整行，PG 的 RETURNING）
prisma.user.create({ data: { username, passwordHash } })

// 更新
prisma.avatar.update({ where: { id }, data: { name } })

// 删除
prisma.avatar.delete({ where: { id } })

// 事务（第 5 章）
prisma.$transaction([
  prisma.user.delete({ where: { id } }),
  prisma.avatar.deleteMany({ where: { userId: id } }),
])
```

**where 条件的进阶写法**（对照第 2 章的 WHERE 全家桶）：

```typescript
prisma.avatar.findMany({
  where: {
    AND: [
      { status: 'done' },
      { OR: [{ style: 'anime' }, { style: 'realistic' }] },  // AND/OR 组合
    ],
    createdAt: { gte: new Date('2026-01-01') },   // >= （gt >, lt <, lte <=）
    name: { contains: '测试' },                    // LIKE '%测试%'
    coverUrl: null,                                // IS NULL
  },
})
```

## 8.3 N+1 问题（必考）

**N+1 = 查 1 次列表 + N 次循环查关联 = 数据库被你打了一百遍。**

```typescript
// ❌ 101 次查询（1 次查头像列表 + 100 次逐个查用户）
const avatars = await prisma.avatar.findMany()
for (const a of avatars) {
  const user = await prisma.user.findUnique({ where: { id: a.userId } })
}
// 每次查询 ~5ms × 101 = 500ms+，而且随列表长度线性恶化

// ✅ 1 次查询（JOIN）
const avatars = await prisma.avatar.findMany({ include: { user: true } })
// SELECT ... FROM avatars JOIN users ON users.id = avatars.user_id
```

**前端类比**：列表页 100 个 item，每个 item 单独发一次请求拿详情 vs 后端一次返回所有数据。谁都知道选后者——但换成后端代码，很多人就无意识地写出循环查询了。

**怎么发现自己写了 N+1**：打开 Prisma 的 query log（`new PrismaClient({ log: ['query'] })`），看一次页面加载打印了多少条 SQL。超过 5 条就要警觉。

## 8.4 连接池

**为什么需要连接池**：建一次数据库连接 = TCP 三次握手 + 认证 + 分配会话内存，耗时几十毫秒。高并发下每个请求都新建连接，数据库直接被连接数打爆。

**连接池（Connection Pool）的原理**：应用启动时预建 N 条连接放"池子"里，请求来了**借**一条，用完**还**回去——复用连接，免去反复建拆的开销。

```typescript
// Prisma 默认自带连接池，DATABASE_URL 里配置：
// postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
//                                              ↑ 最多 10 条连接    ↑ 借不到等 20 秒报错
```

**数量怎么定（经验公式）**：`连接数 ≈ (CPU 核数 × 2) + 磁盘数`。数据库大多是有状态服务，**连接不是越多越好**——几千条连接反而互相争抢。Serverless 部署要特别注意：每个实例一个池，实例多了池子总数爆炸，可以用 Prisma Accelerate / pgBouncer 解决（知道有这回事即可）。

---

# 第九章：Redis 缓存

## 9.1 Redis 是什么

```
PostgreSQL：数据存磁盘，查询毫秒级（ms），容量便宜（TB 级）
Redis：     数据存内存，查询微秒级（μs，快 1000 倍）
            代价：内存贵（GB 级）、宕机可能丢数据（有持久化机制缓解）
```

**定位**：Redis 不是来替代 PostgreSQL 的，而是给它当"贴身保镖"——热点数据放 Redis，扛住 99% 的读请求，数据库只处理冷数据和写请求。

**典型场景**：首页热门内容、用户 session、验证码、排行榜、计数器。

## 9.2 五种数据结构 + 场景（必考）

| 结构 | 前端类比 | 典型场景 |
|------|---------|---------|
| **String** | 普通变量 | 缓存 JSON 字符串、计数器（INCR）、session |
| **Hash** | 对象 | 存用户信息，可单独改一个字段 |
| **List** | 双端队列 | 消息队列、最新动态列表 |
| **Set** | `new Set()` | 去重、共同好友（交集）、抽奖去重 |
| **ZSet** | 带分数的 Set | **排行榜**（按分数排序，还能查排名） |

**各结构核心命令速记**：

```bash
SET user:1:profile '{"name":"小明"}'    # String：存 JSON
GET user:1:profile
INCR page:views                          # 计数器 +1（原子操作）

HSET user:1 name "小明" age 18           # Hash：像对象一样存
HGET user:1 name                         # 只取一个字段

LPUSH feed 1001 1002 1003                # List：最新列表
LRANGE feed 0 9                          # 取最新 10 条

SADD online:today user:1 user:2          # Set：今日在线用户
SINTER follow:me follow:other            # 交集：共同关注

ZADD rank 95 user:1                      # ZSet：排行榜
ZREVRANK rank user:1                     # 查某人排第几（倒序）
ZREVRANGE rank 0 9                       # 前 10 名
```

**为什么排行榜用 ZSet 而不是 SQL 的 ORDER BY**：SQL 每次排序都要扫全表/索引，百万人实时排行榜扛不住；ZSet 是跳表结构，插入和排名查询都是 O(log N)，天生干这个的。

## 9.3 缓存读写策略（Cache Aside，最常用）

Cache Aside（旁路缓存）= 应用代码自己管缓存，数据库为主、缓存为辅：

```
读：先查 Redis → 命中？直接返回 ✅
              → 未命中？查 DB → 写入 Redis（设过期时间）→ 返回

写：先更新 DB → 再删除 Redis 里对应的 key
                    ↑ 注意是"删除"不是"更新"！
```

**为什么写操作是"删缓存"而不是"更新缓存"**：
1. 更新缓存在并发下容易写乱（A、B 两个写请求，更新缓存的顺序可能和数据相反 → 缓存里是旧值）
2. 很多缓存值是计算出来的（关联多张表），更新一处缓存要算一大圈，删了等下次读时重建，简单且正确
3. 懒加载思想：没人读的数据根本不占缓存

## 9.4 缓存三大问题（必考，背熟）

这三个问题的名字很形象，结合"比喻"记忆：

| 问题 | 现象 | 比喻 | 解决方案 |
|------|------|------|---------|
| **穿透** | 查**不存在**的数据，缓存永远未命中，每次都打 DB | 有人一直问"负一号的商品"——查无此物，缓存里永远不会存它，每次都去问库房 | ① 缓存空值（key 存 null，短 TTL 如 60s）② 布隆过滤器（提前挡住"肯定不存在"的 key） |
| **击穿** | 某个**热点 key 刚好过期**的瞬间，几千个请求同时打到 DB | 双十一爆款缓存过期那一毫秒，瞬间万人涌进库房 | 互斥锁：只放一个请求去查 DB 重建缓存，其他请求等它；或热点 key 不过期 |
| **雪崩** | **大量 key 同时过期**（或 Redis 整个挂了），DB 被打崩 | 所有缓存一起失效，像雪崩一样 | 过期时间加随机值（`3600 + random(600)` 秒，把过期时间打散）；Redis 高可用集群 |

**记忆口诀**：**穿透查"没有的"，击穿是"热点的"，雪崩是"一大片的"。**

**三者的区分技巧**（面试被追问时）：
- 穿透：DB 里也**没有**这条数据（恶意请求或 bug）
- 击穿：DB 里**有**，只是缓存恰好过期，且是**单点热点**
- 雪崩：DB 里**有**，**大面积**缓存同时失效

## 9.5 持久化与过期

Redis 数据在内存里，宕机就没了？它有两套持久化机制：

- **RDB**（快照）：定时把整个内存"拍照"存盘（像 `JSON.stringify` 全量存盘）。恢复快，但两次快照之间的数据可能丢
- **AOF**（日志）：把每条写命令追加到日志文件（像操作日志）。重启时重放命令恢复，丢得少但文件大、恢复慢
- 生产一般**两个都开**（AOF 保底 + RDB 加速恢复）

**过期删除策略**：给 key 设了 TTL（如 `SET key val EX 3600`），Redis 怎么删？
- **惰性删除**：访问 key 时检查，过期就删——省 CPU，但没人访问的过期 key 会赖着占内存
- **定期删除**：后台定时随机抽查一批 key，过期的删掉——兜底
- 两者结合，既不浪费 CPU 也不漏垃圾

**内存淘汰（内存满了怎么办）**：`maxmemory` 触顶后按淘汰策略腾地方。最常用 **LRU**（Least Recently Used，淘汰最近最少使用的）——就像你清理手机时先删很久没打开的 App："最近都没人用的，大概率以后也没人用"。其他策略还有 LFU（按使用频率）、随机、按 TTL 等，初学掌握 LRU 即可。

---

# 第十章：数据库架构

> 单机数据库扛不住怎么办？这一章讲"扩展路线图"。你现在用不到，但**面试聊架构、看懂公司技术方案**都需要它。

## 10.1 主从复制（读写分离）

单机数据库的瓶颈往往先出现在**读**（读请求通常是写的几十倍）。思路：数据复制多份，分摊读流量。

```
        写（INSERT/UPDATE/DELETE）
              │
              ▼
        ┌──────────┐   同步 binlog/WAL   ┌──────────┐
        │  主库     │ ───────────────→ │  从库     │
        │ (Master) │                    │ (Slave)  │
        └──────────┘                   └──────────┘
              ▲                              ▲
              │ 写                           │ 读（SELECT）
```

**工作原理**：主库把每次变更写进日志（MySQL 是 binlog，PG 是 WAL），从库拉取日志回放，保持数据一致。**一主多从**可以横向加从库抗读流量。

**面试要点**：
- **主从同步有延迟**（毫秒到秒级）：用户刚发完帖跳转详情页（读从库）可能读不到自己的帖子 → 解决：关键路径强制读主库
- 从库挂了不影响主库（只是少了分摊）；主库挂了需要**故障转移**（提升某个从库为新主库）——这就是"高可用"的基础
- 读写分离的前提是**读多写少**；写成为瓶颈时它救不了你，得看分库分表

## 10.2 分库分表

单表数据太大（千万到亿级），索引树变高、维护变慢，一台机器也放不下了——把数据拆开存：

| 方式 | 做法 | 例子 |
|------|------|------|
| **垂直拆分** | 按业务拆 | 用户库、订单库分开（不同业务不同库） |
| **水平拆分** | 按数据行拆 | user_id % 4 = 0/1/2/3 分散到 4 张表（同结构，各存一部分行） |

**水平拆分的路由**：查 user_id=100 的数据 → 100 % 4 = 0 → 去 0 号表找。写入同理。路由规则通常由中间件（如 ShardingSphere）或应用层实现。

**代价（为什么说是最后手段）**：
- **跨库 JOIN 没了**：用户表和订单表在不同库，一句 SQL 查不了，要应用层手动聚合
- **分布式事务**：转账两步在不同库，本地事务罩不住，得引入两阶段提交/TCC 等复杂方案
- **全局 ID**：自增 ID 各库会重复，要用雪花算法等分布式 ID 生成器
- 查询不带路由键 → 要广播到所有库再合并，慢

**结论：单表千万级以下、读写分离 + 缓存能扛住，就别碰分库分表。**（面试说出这个"克制"的判断，比吹会用分库分表更加分。）

---

# 第十一章：运维基础

> 不求成为 DBA，但这三件事每个后端开发者都要会：**看现场、会备份、懂权限**。

## 11.1 常用命令（在你的服务器上练）

```bash
# 连数据库（以 postgres 系统用户身份，连 avatar_dressup 库）
sudo -u postgres psql -d avatar_dressup

# 进去之后（\ 开头的是 psql 元命令，不是 SQL）
\dt                     # 列出所有表
\d users                # 查看表结构（列、类型、索引、约束一次看全）
\di                     # 查看所有索引
\timing on              # 显示每条 SQL 的执行时间（学性能优化必备）
\q                      # 退出
```

**排查卡顿两板斧**：

```sql
-- 1. 查看当前正在执行的查询（谁在跑？跑了多久？）
SELECT pid, query, state, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active';
-- duration 很长的就是嫌疑人

-- 2. 杀掉卡死的查询
SELECT pg_terminate_backend(pid);
-- ⚠️ 只杀确认有问题的，别误杀正常连接
```

## 11.2 备份与恢复

**没做过恢复的备份等于没备份**——备份了也要定期演练恢复，不然真出事时会发现备份是坏的。

```bash
# 备份（导出整个库为 SQL 文件）
pg_dump -U avatar avatar_dressup > backup.sql

# 恢复（把 SQL 文件灌回去）
psql -U avatar avatar_dressup < backup.sql

# 定时备份（crontab 每天凌晨 3 点自动执行）
0 3 * * * pg_dump -U avatar avatar_dressup > /backup/$(date +\%Y\%m\%d).sql
```

**补充两点**：
- `pg_dump` 是逻辑备份（导出 SQL），大库可以用 `pg_basebackup` 做物理备份（直接拷数据文件），初学掌握 pg_dump 即可
- 备份文件**要存到别的机器**（定时 scp 到备份服务器或对象存储）——服务器整个没了，本机备份也一起火葬

## 11.3 用户权限最小化

**原则：应用用什么账号，就只给它需要的权限，别用超级用户跑应用！** 万一代码有 SQL 注入漏洞，攻击者拿到的是 app_user（只能增删改查），而不是 postgres 超级用户（能 DROP 整个库）。

```sql
-- 创建应用专用账号，只给 CRUD 权限
CREATE USER app_user WITH PASSWORD 'xxx';
GRANT CONNECT ON DATABASE avatar_dressup TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- 注意：不给 DROP、不给 ALTER —— 就算代码被注入，也删不了表、改不了结构
```

这就是"最小权限原则"（Principle of Least Privilege）：**权限刚好够用，多一点也不给**。和前端安全里"别给扩展要多余权限"是同一个思想。

---

# 第十二章：面试题库（32 题）

> 用法：先自己答（说出声），再对照参考答案。**能讲出"为什么"和"举出例子"才算过**——只背结论面试官一追问就露馅。标 ⭐ 的是高频中的高频。

## 基础概念（⭐⭐⭐）

**Q1：数据库三大范式？**
> 1NF 列不可再分；2NF 非主键列完全依赖主键；3NF 无传递依赖。本质：每个事实只存一份、存在它该在的地方。实际开发中遵循范式为主，高并发读场景可适当反范式冗余（代价是更新要同步多处）。

**Q2：CHAR 和 VARCHAR 区别？**
> CHAR 定长（存不满补空格，读取时去掉），VARCHAR 变长（按实际长度存）。CHAR 查询略快但浪费空间，一般都用 VARCHAR/TEXT。PG 里两者性能几乎无差，按"要不要强制限长"选即可。

**Q3：DROP、DELETE、TRUNCATE 区别？**

| | DELETE | TRUNCATE | DROP |
|---|---|---|---|
| 删什么 | 行（可带 WHERE） | 全表数据 | 整张表（结构也没了） |
| 能回滚 | ✅ | 看库（PG 可以） | ❌ |
| 速度 | 慢（逐行记日志） | 快 | 最快 |

> 一句话：DELETE 是"撕掉几页"，TRUNCATE 是"倒空文件夹"，DROP 是"把文件夹扔了"。

**Q4：为什么不用文件存数据，要用数据库？（看似送分，考理解）**
> 文件方案有三大死穴：① 并发写冲突（没有锁和排队机制，互相覆盖）② 查询要全量加载（没有索引）③ 没有事务（多步操作无法保证原子性）。数据库 = 持久化 + 并发控制 + 索引 + 事务的集大成者。

## 索引（⭐⭐⭐ 必考区）

**Q5：索引是什么数据结构？为什么用 B+ 树不用二叉树/哈希？**
> B+ 树。相比二叉树：二叉树每个节点只有 2 个分叉，100 万数据要 20 层 = 20 次磁盘 IO；B+ 树每个节点存几百个 key，只要 3 层 = 3 次 IO。相比哈希：哈希只能等值查询，不支持范围查询和排序；B+ 树叶子节点有链表，天然支持范围扫描。

**Q6：什么是回表？覆盖索引？**
> 二级索引叶子节点只存主键，查到主键后还要回聚簇索引查整行 = 回表（查了两棵树）。如果查询的列都在索引里就不用回表 = 覆盖索引。优化技巧：SELECT 只查需要的列，配合联合索引实现覆盖。

**Q7：最左前缀原则？**
> 联合索引 (a, b, c) 相当于按 a → b → c 多级排序。查询必须从 a 开始**连续**使用才能走索引：`WHERE b=1` 跳过 a 用不上；`WHERE a=1 AND c=3` 中 c 也用不上（b 缺位）。类比电话簿按"姓+名"排序，只知道名查不了。

**Q8：索引失效的场景？**
> ① 列上做函数/运算 ② LIKE 以 % 开头 ③ 违反最左前缀 ④ 隐式类型转换 ⑤ OR 一侧无索引 ⑥ 不等号 != / NOT IN ⑦ 数据区分度低优化器主动放弃。不确定就 EXPLAIN。

**Q9：什么字段适合建索引？**
> 高频 WHERE / JOIN / ORDER BY 的列；区分度高的列（如 user_id，而不是性别——性别只有两个值，索引等于没建）。不适合：频繁更新的列（索引要跟着维护）、数据量小的表（全表扫本来就快）、低区分度列。

**Q10：索引的缺点？**
> ① 占磁盘空间（索引也是数据，联合索引可能比表还大）② 降低写入速度（INSERT/UPDATE/DELETE 都要同步维护索引树）③ 索引太多优化器可能选错。所以不是越多越好——按查询建，定期清理没用的索引。

**Q11：为什么主键推荐自增/有序的？（进阶）**
> B+ 树插入时，有序 ID 永远追加到最右叶子节点，顺序写效率高；随机 ID（如 UUID）插入位置随机 → 频繁页分裂（已有页满了要拆成两页）→ 索引碎片化 + 写入变慢。你项目用 UUID 是因为分布式场景下自增 ID 会冲突，UUID 天然全局唯一，代价是略低的写入性能，小项目无感知。

## 事务与锁（⭐⭐⭐）

**Q12：ACID 及实现原理？**
> 原子性靠 Undo Log（回滚日志）；持久性靠 Redo Log（WAL 先写日志再写数据）；隔离性靠锁 + MVCC；一致性是最终目标，由其他三个共同保证。

**Q13：脏读、不可重复读、幻读？隔离级别？**
> 脏读 = 读到别人未提交的数据；不可重复读 = 同事务两次读同一行不一样（别人 UPDATE 了）；幻读 = 同事务两次同条件查询行数变了（别人 INSERT 了）。隔离级别从低到高：读未提交 → 读已提交（防脏读）→ 可重复读（再防不可重复读）→ 串行化（全防）。**PG 默认读已提交，MySQL 默认可重复读。**

**Q14：MVCC 是什么？**
> 多版本并发控制。每行数据保留多个版本，读操作读快照不加锁，写操作写新版本。效果：读写互不阻塞。快照粒度决定隔离级别：读已提交 = 每条语句一个快照；可重复读 = 事务开始一个快照。

**Q15：乐观锁和悲观锁？**
> 悲观锁：`SELECT ... FOR UPDATE` 先锁再改，适合写冲突频繁（秒杀）。乐观锁：version 字段 + `UPDATE ... WHERE version = 旧值`，改时检查有没有被人动过，失败则重试，适合读多写少（编辑资料）。思想类比：悲观锁 = 公共厕所锁门，乐观锁 = Git 提交前 pull 检查冲突。

**Q16：死锁怎么产生和避免？**
> 两个事务互相持有对方需要的锁（A 锁行1 等行2，B 锁行2 等行1）。避免：① 固定加锁顺序 ② 事务短小、别在事务里调外部 API ③ 一次锁定所有需要的行。数据库死锁检测器会自动发现并回滚其中一个（牺牲者）。

## SQL 与优化（⭐⭐⭐）

**Q17：SQL 执行顺序？**
> FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。所以 WHERE 里不能用 SELECT 的别名（执行到 WHERE 时 SELECT 还没跑）；ORDER BY 可以用别名（它在 SELECT 之后）。

**Q18：JOIN 的类型？**
> INNER（交集）、LEFT（左表全留，右表没匹配补 NULL）、RIGHT、FULL OUTER（两边全留）。实战 95% 用 INNER 和 LEFT。LEFT JOIN 后统计关联数要用 COUNT(右表.列) 而不是 COUNT(*)——NULL 不计入。

**Q19：深分页怎么优化？**
> `LIMIT 10 OFFSET 100000` 要先扫 10 万行再丢弃。改成游标分页：`WHERE id > 上一页最大id ORDER BY id LIMIT 10`，直接走索引定位起点。代价：不能跳页，适合"加载更多"式交互（你的头像列表滚动加载就是理想场景）。

**Q20：慢查询怎么排查？（分层答题法）**
> 第 1 步定位：慢查询日志 / APM 监控。第 2 步分析：EXPLAIN 看执行计划（Seq Scan 还是 Index Scan）。第 3 步 SQL 层：加索引 / 改写法避失效 / 去 SELECT * / 游标分页。第 4 步架构层：Redis 缓存 → 读写分离 → 分库分表。**说出分层思路比背技巧更打动面试官。**

**Q21：COUNT(*)、COUNT(1)、COUNT(列) 区别？**
> COUNT(*) 和 COUNT(1) 等价，统计所有行（含 NULL）；COUNT(列) 忽略该列为 NULL 的行。性能上 COUNT(*) / COUNT(1) 最快（无需判断列值）。

## 设计题（⭐⭐ 场景题）

**Q22：设计一个用户关注关系表？**
```sql
CREATE TABLE follows (
  id          UUID PRIMARY KEY,
  follower_id UUID REFERENCES users(id),   -- 粉丝（关注别人的人）
  followee_id UUID REFERENCES users(id),   -- 被关注的人
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(follower_id, followee_id)          -- 防重复关注
);
CREATE INDEX idx_follows_followee ON follows(followee_id);  -- 查"谁关注了我"
CREATE INDEX idx_follows_follower ON follows(follower_id);  -- 查"我关注了谁"
```
> 考点：多对多关系用中间表、联合唯一约束防重复、**两个方向的查询都要有索引**（只建一个，反方向查询就全表扫）。

**Q23：秒杀库存怎么设计（不超卖）？**
> 核心考点：**检查库存和扣减必须原子**，分两步就有超卖窗口。
> 方案 1（DB 层）：`UPDATE stock SET count = count - 1 WHERE id = x AND count > 0`——单条 UPDATE 里同时检查和扣减，利用行锁原子性；返回 0 行说明卖完。
> 方案 2（高并发）：Redis 预减库存（`DECR` 原子操作，减到负数拒绝）+ 消息队列异步落库。
> 加分：提一句"前端按钮置灰、限流"是第一道防线，别让所有请求都打到库存层。

**Q24：登录状态怎么存？Session 还是 JWT？（你项目用的 JWT）**
> Session：状态存服务端（通常 Redis），Cookie 只存 sessionId；优点是能主动踢人下线，缺点是服务端有状态（分布式要共享存储）。
> JWT：状态全在 token 里（自包含、签名防篡改），服务端不存；天然支持分布式，但**签发后无法单独作废**（只能等过期或维护黑名单）。
> 你项目：JWT + HttpOnly Cookie（JS 读不到，防 XSS 偷 token），登录用的主动过期靠短有效期 + refresh。

## Redis（⭐⭐）

**Q25：Redis 为什么快？**
> ① 纯内存操作（微秒级）② 核心线程单线程无锁竞争（6.0 后网络 IO 多线程，命令执行仍单线程）③ IO 多路复用（epoll，一个线程管几万连接）④ 高效数据结构（跳表、压缩列表等按场景特化）。

**Q26：缓存穿透/击穿/雪崩？（必背）**
> 穿透 = 查不存在的数据，每次都打 DB（解：缓存空值/布隆过滤器）；击穿 = 热点 key 过期瞬间大量请求打 DB（解：互斥锁重建）；雪崩 = 大量 key 同时过期（解：过期时间加随机值）。区分技巧：穿透"DB 里也没有"，击穿"单点热点过期"，雪崩"大面积同时失效"。

**Q27：缓存和数据库一致性怎么保证？**
> 常用 Cache Aside：先更新 DB，再删除缓存。极端时序下仍有小窗口不一致（删缓存后、下次读回填前，DB 又被改）。要求更高的场景用延迟双删或订阅 binlog 异步删（canal）。**先承认没有完美方案，再讲权衡取舍，这是加分回答**——比背"标准答案"高级得多。

**Q28：Redis 过期策略？**
> 过期删除：惰性删除（访问时检查）+ 定期删除（后台抽查），两者结合。内存不够时走淘汰策略：LRU 淘汰最近最少使用的（最常用）、LFU 按使用频率、随机、按 TTL。

## 综合题（⭐）

**Q29：你们项目为什么选 PostgreSQL？**
> 用这个框架答：① 穿搭数据是嵌套 JSON，PG 的 JSONB 原生存储 + GIN 索引查询，MySQL 的 JSON 支持没这么顺 ② Prisma 对 PG 支持最完善 ③ 开源免费、社区活跃。再补一句"如果是团队全是 MySQL 运维经验/公司已有 MySQL 集群，我会选 MySQL"——展示的是**选型思维**而不是站队。

**Q30：数据库连接池是什么？为什么要？**
> 建连接要 TCP 握手 + 认证，成本几十 ms；连接池预建一批连接反复复用（借出→归还），避免频繁建拆。Prisma 自带，用 `connection_limit` 配置。数量经验公式：(CPU 核数 × 2) + 磁盘数——连接不是越多越好。

**Q31：一条 SQL 从发送到返回经历了什么？（大题）**
> ① 连接器：建立连接、认证、拿权限 ② 解析器：词法语法分析，生成语法树（语法错在这报）③ 优化器：选择用哪个索引、JOIN 顺序，生成执行计划（SQL 慢往往在这选错路）④ 执行器：按计划调存储引擎接口 ⑤ 存储引擎：通过 B+ 树索引定位数据页，从磁盘读入内存，逐行过滤返回。返回路上再经过连接器回给客户端。

**Q32：从 URL 输入到页面展示，数据库在哪一环？（前端友好题，串起前后端）**
> DNS 解析 → TCP/TLS 握手 → 到达服务器 → Next.js 路由匹配 → API handler 调 Prisma → Prisma 生成 SQL 通过连接池发给 PG → PG 解析→优化→索引查找→返回行 → API 组装 JSON 响应 → 浏览器解析渲染。**这题答好 = 你同时懂前端链路和后端数据链路，全栈面试的送分大题。**

**Q33：如果数据库 CPU 100% 怎么排查？**
> ① `pg_stat_activity` 看当前活跃查询，找耗时最长的 ② EXPLAIN 分析嫌疑 SQL ③ 临时方案：`pg_terminate_backend` 杀掉问题查询 ④ 长期方案：优化 SQL/加索引/上缓存/限流。体现的还是"定位 → 分析 → 分层处理"的思路。

---

# 第十三章：实战练习

> **看懂 ≠ 会用**。这一章是全文档的"期末考试"，务必动手。

## 练习 1：SQL 上手（第 1 周）

```bash
sudo -u postgres psql -d avatar_dressup
```

```sql
-- 任务 1：看表结构（先认识战场）
\dt
\d avatars

-- 任务 2：查你自己的账号
SELECT id, username, created_at FROM users;

-- 任务 3：造测试数据（generate_series：生成 1~100 的序列，配合 SELECT 一次插 100 行）
INSERT INTO avatars (id, user_id, name, base_id, parts)
SELECT
  gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),      -- 子查询：拿第一个用户的 id
  '测试头像' || i,                      -- || 拼接字符串，i 是序号
  'base1',
  '{"hat": ["hat1"]}'
FROM generate_series(1, 100) AS i;    -- 一次造 100 条

-- 任务 4：练查询（对照第 2 章逐个试）
SELECT name, created_at FROM avatars ORDER BY created_at DESC LIMIT 5;
SELECT user_id, COUNT(*) FROM avatars GROUP BY user_id;
-- 挑战：只显示头像数 > 10 的用户（HAVING）

-- 任务 5：EXPLAIN 看索引效果
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = '你的用户id';
-- 观察输出：是 Index Scan 还是 Seq Scan？耗时多少？
```

**验收标准**：不看文档能独立写出"分页 + 条件 + 排序"的查询。

## 练习 2：感受索引的威力（第 2 周，强烈推荐）

```sql
-- 造 10 万条数据（可能要几秒到几十秒）
INSERT INTO avatars (id, user_id, name, base_id, parts)
SELECT gen_random_uuid(), (SELECT id FROM users LIMIT 1),
       'bulk' || i, 'base1', '{}'
FROM generate_series(1, 100000) AS i;

-- 第 1 轮：删掉索引测试全表扫描
DROP INDEX IF EXISTS avatars_user_id_created_at_idx;
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'xxx' ORDER BY created_at DESC;
-- 记录耗时（几十~几百 ms，Plan 显示 Seq Scan）

-- 第 2 轮：加回索引再测
CREATE INDEX ON avatars(user_id, created_at);
EXPLAIN ANALYZE SELECT * FROM avatars WHERE user_id = 'xxx' ORDER BY created_at DESC;
-- 对比耗时（几 ms，Plan 显示 Index Scan）
```

**亲眼看到 100 倍差距，比背十遍索引原理都管用。** 做完这个练习你会对"加索引"产生肌肉记忆。

**收尾（重要）**：练完把测试数据删掉，别污染真实数据：
```sql
DELETE FROM avatars WHERE name LIKE 'bulk%' OR name LIKE '测试头像%';
```

## 练习 3：读源码找 SQL（第 3 周）

打开你项目的 `src/app/api/` 目录，对每个接口回答：

1. 这个接口调用了哪个 Prisma 方法？
2. 等价于什么 SQL？（拿不准就开 query log 看）
3. 这个 SQL 会走哪个索引？（用 EXPLAIN 验证）
4. 有没有 N+1 问题？有没有 SELECT * 嫌疑？

开 query log 的方法：
```typescript
// 实例化 PrismaClient 时
const prisma = new PrismaClient({ log: ['query'] })
// 控制台会打印每条真实执行的 SQL
```

## 练习 4：模拟面试（第 4 周）

从第十二章随机抽 5 道题，**用手机录音**，自己讲出来。讲完听录音，对照三条标准：

- 有没有"呃""那个" → 不熟
- 讲不讲得出"为什么" → 只背了答案没理解
- 能不能举出例子（最好是你项目的例子）→ 能举例 = 真懂

**进阶**：把 Q20（慢查询排查）、Q23（秒杀）、Q32（全链路）这三个大题讲给朋友/同事听，讲明白 = 你已经超过大部分前端候选人了。

---

# 附录 A：术语表

按拼音/字母排序，忘了就来查：

| 术语 | 一句话解释 | 详见 |
|------|-----------|------|
| ACID | 事务四特性：原子/一致/隔离/持久 | 5.2 |
| B+ 树 | 索引的底层数据结构，矮胖多叉树，3 层管百万数据 | 4.1 |
| Cache Aside | 最常用缓存策略：读先查缓存，写先更 DB 再删缓存 | 9.3 |
| DDL / DML / DCL | 定义表结构 / 操作数据 / 管权限的三类 SQL | 2 章 |
| 脏读 | 读到别人未提交的数据 | 5.3 |
| 覆盖索引 | 查询列全在索引里，免回表 | 4.2 |
| 回表 | 二级索引查到主键后，再回聚簇索引取整行 | 4.2 |
| JOIN | 多表关联查询 | 2.2 |
| 聚簇索引 | 叶子节点存整行数据的索引（主键索引），一张表只有一个 | 4.2 |
| 连接池 | 预建一批数据库连接反复复用 | 8.4 |
| 乐观锁/悲观锁 | 改时才检查冲突 / 先锁再改 | 6.2 |
| MVCC | 多版本并发控制，读写互不阻塞 | 5.4 |
| N+1 问题 | 查 1 次列表 + N 次循环查关联 | 8.3 |
| 范式（1/2/3NF） | 表设计卫生规范：列不可再分 / 完全依赖主键 / 无传递依赖 | 3.3 |
| 幻读 | 两次同条件查询，行数变了（别人 INSERT） | 5.3 |
| WAL | 预写日志：先记日志再改数据，保证持久性 | 5.2 |
| 主从复制 | 主库写、从库同步、读走从库 | 10.1 |
| 最左前缀 | 联合索引必须从最左列开始连续使用 | 4.3 |

# 附录 B：报错速查表

新手最常撞见的报错，按"人话翻译 + 怎么办"整理：

| 报错关键词 | 人话翻译 | 怎么办 |
|-----------|---------|--------|
| `duplicate key value violates unique constraint` | 唯一约束冲突：这个值已存在 | 检查是否重复注册/重复插入；业务上先查再插，或用 ON CONFLICT |
| `violates foreign key constraint` | 外键约束：引用了不存在的 id | 检查 user_id 等关联值是否真实存在；插入顺序对不对 |
| `column "xxx" does not exist` | 列名写错了 | 检查拼写；大小写（PG 里加引号的列名区分大小写）；是不是该跑迁移了 |
| `relation "xxx" does not exist` | 表名错了 / 表还没建 | `\dt` 看看表是否存在；是否连错了库；`prisma migrate` 跑了吗 |
| `value too long for type character varying(50)` | 超过 VARCHAR 上限 | 应用层做长度校验，或 ALTER 改大上限 |
| `deadlock detected` | 死锁，数据库回滚了你 | 按 6.3 检查加锁顺序；重试一次通常就好 |
| `too many connections` | 连接数爆了 | 检查连接池配置；是否有连接没释放；Serverless 场景用 Accelerate/pgBouncer |
| `permission denied` | 没权限 | 用有权限的账号，或让管理员 GRANT（11.3） |
| `cannot drop table because other objects depend on it` | 有外键依赖着这张表 | 先删依赖它的表/数据，或用 CASCADE（想清楚再删） |
| Prisma: `P2025` | 记录不存在（update/delete 找不到目标） | 先 findUnique 确认存在，处理"不存在"的业务分支 |
| Prisma: `P2002` | 唯一约束冲突（同上数据库报错） | 捕获后给用户友好提示"已存在" |

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

学习循环（贯穿 4-6 周）：
读一章 → 动手练（第十三章）→ 回来重读卡壳处 → 面试前刷题（第十二章）

MySQL 学习者专属路线：
本文档第 1、2 章（SQL 打底）→ mysql-guide.md 全部（MySQL 深入）
→ 回读本文档第 5、6 章（事务思想互补）→ 两份题库都刷
```

---

*文档版本：v2.1 初学者详解版 · 基于 avatar-dressup 项目（Next.js + Prisma + PostgreSQL）*
*姊妹篇：`mysql-guide.md`（MySQL 优先学习路线，含 InnoDB 日志/MVCC/锁/主从复制详解）*


