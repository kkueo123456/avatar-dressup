# MySQL 数据库完全指南（前端开发者 · 初学者详解版）

> **面向**：前端开发 / 后端小白 / 面试准备，以 **MySQL 8.0** 为主角
> **特色**：每个概念配前端类比 + 从零讲透"是什么→为什么→怎么用→易错点" + 面试题库
> **预计学习时间**：4-6 周（每周 3-5 小时）
> **怎么用**：先通读一遍不求全懂 → 按第十三章的练习动手 → 遇到问题时回来查 → 面试前刷第十二章

---

# 目录

- [开始之前：新手必读](#开始之前新手必读)
- [第一章：数据库世界观](#第一章数据库世界观)
- [第二章：SQL 完整语法（MySQL 版）](#第二章sql-完整语法mysql-版)
- [第三章：表设计与字符集](#第三章表设计与字符集)
- [第四章：索引与 EXPLAIN 详解](#第四章索引与-explain-详解)
- [第五章：事务与 ACID](#第五章事务与-acid)
- [第六章：InnoDB 日志体系](#第六章innodb-日志体系)
- [第七章：MVCC 与锁（面试深水区）](#第七章mvcc-与-锁面试深水区)
- [第八章：性能优化实战](#第八章性能优化实战)
- [第九章：ORM 与 Prisma](#第九章orm-与-prisma)
- [第十章：Redis 缓存](#第十章redis-缓存)
- [第十一章：主从复制、运维与权限](#第十一章主从复制运维与权限)
- [第十二章：面试题库（45 题）](#第十二章面试题库45-题)
- [第十三章：实战练习](#第十三章实战练习)
- [附录 A：术语表](#附录-a术语表)
- [附录 B：报错速查表](#附录-b报错速查表)
- [附录 C：MySQL vs PostgreSQL 对照](#附录-cmysql-vs-postgresql-对照)
- [附录 D：MySQL 常用命令速查](#附录-dmysql-常用命令速查)

---

# 开始之前：新手必读

## 0.1 你会学到什么（学习地图）

数据库知识看起来很多，其实核心就 5 块，按这个顺序学：

```
第 1 层：会用（第 1-2 章）      → 知道数据库是什么，会写增删改查
第 2 层：会设计（第 3 章）      → 给你一个需求，能设计出表结构
第 3 层：会优化（第 4、8 章）   → 查询慢了知道怎么办
第 4 层：懂原理（第 5-7 章）    → 理解数据安全和高并发背后的机制（面试深水区）
第 5 层：懂生态（第 9-11 章）   → ORM、缓存、主从架构，知道真实项目长什么样
```

**为什么要前端学数据库？** 三个现实原因：
1. **全栈趋势**：Next.js / Nuxt 等框架让前端直接写后端，不懂数据库寸步难行
2. **面试硬通货**：前端面试的高级题（性能、架构、状态管理）背后都会拐到数据库；MySQL 是国内面试和岗位的绝对主流
3. **排查问题的能力**：接口慢、数据错、页面白屏——很多"前端 Bug"最后查出来是数据库问题

## 0.2 学习节奏建议

| 周 | 学什么 | 动手任务 |
|----|--------|---------|
| 第 1 周 | 第 1、2 章 | 装 MySQL，跑通练习 1 的全部 SQL |
| 第 2 周 | 第 3、4 章 | 做练习 2，亲眼看索引提速 100 倍 |
| 第 3 周 | 第 5、6 章 | 练习 3：两终端验证 MVCC |
| 第 4 周 | 第 7、8 章 | EXPLAIN 分析自己的查询 |
| 第 5-6 周 | 第 9-14 章 | 模拟面试 + 查漏补缺 |

**学习心法**：不要试图一次看懂所有内容。第一遍快速过，动手做练习；第二遍精读卡壳的章节；面试前第三遍只看面试题和重点。

## 0.3 环境准备（三选一）

```bash
# 方案 A：Docker（推荐，干净、秒起、随便删）
docker run -d --name mysql-learn -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=learn mysql:8.0

# 方案 B：本机安装（Windows 有安装器，macOS 用 brew install mysql）
# 装 8.0 以上版本，别用 5.7（面试默认聊 8.0）

# 方案 C：已有 MySQL 服务器（公司/云上的），申请一个练习用的数据库

# 连接验证（装好后）
docker exec -it mysql-learn mysql -uroot -p123456
mysql> SELECT VERSION();   -- 看到 8.0.x 就 OK
```

**推荐练习工具**：`mysql` 命令行（练手感）+ 图形化客户端任选其一（DBeaver 免费 / DataGrip / Navicat）。

## 0.4 两个阅读约定

1. **代码块里 `--` 开头的行是 SQL 注释**，不是要执行的内容
2. 文档示例统一用"头像换装应用"的业务（users / avatars / poster_jobs 三张表），你可以把 SQL 直接抄到自己的练习库里跑（先按第三章的建表语句建表）

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
| 重启丢数据（方案1） | **持久化** | 数据写磁盘 + redo log 日志（第 6 章细讲） |
| 并发写冲突（方案2） | **事务 + 锁** | 写操作自动排队、加锁，谁也不会覆盖谁 |
| 查询慢（方案2） | **索引** | 像书的目录，按 key 直达数据，不用全量扫描（第 4 章） |
| 多端共享（方案3） | **网络服务** | 数据库是一个常驻网络服务，谁都能连、都在同一份数据上操作 |

> 💡 **心智模型**：把数据库想象成一个"住在你服务器上的、24 小时营业的图书馆"——书（数据）存在它那，任何人（任何进程/设备）都能来借阅，而且它有完善的管理制度（排队、登记、防盗）保证书永远不会弄丢、弄乱。

## 1.2 数据库的分类

**关系型（SQL）**：数据存在一张张**表**里，表和表之间可以建"关系"（外键）。就像 Excel：固定的列、一行行数据、多个 Sheet 之间可以引用。

**非关系型（NoSQL）**：不强制表结构，根据数据形态选择不同的存储模型。"NoSQL" 不是"反 SQL"，而是"Not Only SQL"。

```
数据库
├── 关系型（SQL）
│   ├── MySQL      —— 国内互联网公司主流（阿里系、字节等大量在用）← 本文主角
│   ├── PostgreSQL —— 功能最强的开源数据库（见附录 C 对照）
│   ├── SQLite     —— 嵌入式，整个库就是一个文件，手机 App、本地小工具
│   └── Oracle     —— 银行、国企，贵，但稳
│
└── 非关系型（NoSQL）
    ├── Redis         —— 内存键值对，做缓存（第 10 章）
    ├── MongoDB       —— 文档型，直接存 JSON，前端学起来最亲切
    └── Elasticsearch —— 搜索引擎，全文搜索领域的王者
```

**怎么选（一句话版）**：
- 结构化数据 + 需要事务（转账、下单）→ 关系型（MySQL）
- 极速读写 + 数据丢了能接受（缓存、排行榜）→ Redis
- 结构多变的文档（日志、埋点、内容管理）→ MongoDB
- 全文搜索（商品搜索、文章搜索）→ Elasticsearch

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
| `array.slice(20, 30)` | `LIMIT 20 OFFSET 10` | 分页 |
| 对象的 `key`（React 列表的 key） | **主键（Primary Key）** | 唯一标识一行，绝不重复 |
| 接口的 TypeScript 类型定义 | 表的 **Schema**（列 + 类型 + 约束） | 定义数据结构 |
| 两个对象通过 id 互相引用 | **外键（Foreign Key）** | 建立表间关系 |

**逐条理解几个容易懵的**：

- **主键**：React 列表渲染为什么要求 key？为了区分"这一行是谁"。数据库同理：每行必须有个唯一标识，不然"更新第 3 条数据"这种话毫无意义。主键 = 最重要的那个 key，一张表只有一个，不能重复、不能为空。
- **Schema**：TS 的 interface 编译成 JS 后就没了，但表的 Schema 是**真实存储在数据库里**的强制约束——你往 users 表塞一个没有 username 的对象，数据库直接报错拒绝，而不是像 JS 一样默默变成 `undefined`。
- **外键**：avatars 表的 `user_id` 列存的是 users 表某行的 id。相当于 JS 里 `avatar.userId` 引用 `user.id`——但外键是数据库**强制保证**这个 id 确实存在，引用一个不存在的用户？门都没有。

## 1.4 MySQL 的分层架构（面试开场白素材）

MySQL 不是铁板一块，而是**分层的**——这个分层直接决定了后面所有话题（SQL 怎么执行、日志在哪层、引擎是什么）：

```
┌───────────────────────────────────────┐
│  连接层    连接管理、认证、权限校验          │  ← 客户端连上来先过这
├───────────────────────────────────────┤
│  服务层    解析器 → 优化器 → 执行器         │  ← SQL 在这被"看懂"和"优化"
│           （8.0 已移除查询缓存）           │
├───────────────────────────────────────┤
│  存储引擎层  InnoDB（默认）/ MyISAM / 其他   │  ← 数据真正存取的地方，可插拔
├───────────────────────────────────────┤
│  文件系统    数据文件、日志文件              │  ← 磁盘
└───────────────────────────────────────┘
```

**为什么要分层 + 引擎可插拔**：服务层管"逻辑"（SQL 怎么理解、怎么优化），引擎层管"物理"（数据怎么存、怎么读）。谁都能写自己的引擎——就像浏览器和引擎的关系。**面试聊到任何 MySQL 机制，你都可以先问自己：这发生在服务层还是引擎层？**（比如 binlog 在服务层，redo log 在 InnoDB 引擎层——这是第 6 章的伏笔。）

## 1.5 InnoDB vs MyISAM（经典送分题）

| | InnoDB（默认） | MyISAM（旧默认） |
|---|---|---|
| 事务 | ✅ 支持 | ❌ 不支持 |
| 行锁 | ✅ | ❌ 只有表锁 |
| 外键 | ✅ | ❌ |
| 崩溃恢复 | ✅ 靠 redo log | ❌ 坏了就坏了 |
| 全文索引 | ✅（5.6+） | ✅（传统强项） |
| COUNT(*) 无 WHERE | 要扫（MVCC 下不同事务看到的行数不同） | 秒出（存了总行数） |

**为什么现在默认 InnoDB**：事务 + 行锁 + 崩溃恢复，是业务系统的刚需。MyISAM 只在"纯读、无事务、要快速 COUNT"的极少数场景还占优。**面试一句话答**："现在无脑 InnoDB，MyISAM 不支持事务和行锁，已被淘汰。"

**一个必懂概念：聚簇索引**。InnoDB 的表 = 主键的 B+ 树，**数据就挂在主键索引的叶子节点上**（表即索引）。所以：
- 主键查询最快（一次查树就拿到整行）
- 二级索引的叶子存主键值 → 查完要**回表**（第 4 章详解）
- 没建主键的表，InnoDB 会找一个唯一非空列顶替，实在没有就偷偷生成隐藏的 row_id——**所以永远显式定义主键**

## 1.6 全链路：一次"登录"请求的完整旅程

```
浏览器（React）
   │  fetch('/api/auth/login')
   ▼
后端服务（如 Next.js API Routes / Express）
   │  prisma.user.findUnique(...) 或 SQL
   ▼
MySQL Client / ORM（翻译成 SQL，走连接池）
   │  TCP 连接（3306 端口）
   ▼
MySQL 服务层（连接器 → 解析器 → 优化器 → 执行器）
   ▼
InnoDB 引擎（通过 B+ 树索引找到数据页，读写内存/磁盘）
   ▼
数据文件 + redo log（磁盘）
```

逐步拆解：
1. 浏览器 `fetch('/api/auth/login')`，携带用户名和密码
2. 后端代码调用 ORM 或直接发 SQL：`SELECT * FROM users WHERE username = 'x' LIMIT 1`
3. SQL 通过连接池里的一条 TCP 连接（3306 端口）发给 MySQL
4. 服务层：认证 → 解析成语法树 → 优化器选索引 → 执行器开工
5. InnoDB：走 username 索引找到那行，返回
6. 后端比对密码哈希，签发 JWT，返回响应
7. 浏览器跳转页面

> 💡 **为什么要知道这个**：以后接口报错，你要能判断"锅在哪一层"——是前端参数没传对？后端逻辑错了？还是数据库挂了/查询慢了？分层思维是排查问题的第一能力。

---

# 第二章：SQL 完整语法（MySQL 版）

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
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

逐行拆开（**这段是理解约束的钥匙**）：

- **`id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY`**：
  - `BIGINT UNSIGNED`：无符号大整数（最大约 1844 亿亿），8 字节
  - `AUTO_INCREMENT`：自增——插入时不传 id，数据库自动 +1
  - `PRIMARY KEY`：唯一 + 非空，是这行的身份证
  - 为什么推荐自增主键：见 3.3 节（B+ 树顺序插入，不页分裂）
- **`username VARCHAR(50) UNIQUE NOT NULL`**：
  - `VARCHAR(50)`：变长字符串，最长 50 字符，存 5 个就占 5 个的空间
  - `NOT NULL`：必填。插入时没有 username？报错
  - `UNIQUE`：唯一。两个人都叫 `xiaoming`？第二个人插入直接失败——注册重名检测**不用写代码**，数据库帮你把门
- **`password_hash VARCHAR(255) NOT NULL`**：存的是密码的**哈希值**而不是明文。为什么？数据库被拖库时，攻击者拿到的也是一堆不可逆的哈希，用户密码不泄露。**这是后端安全的铁律：永远不存明文密码。**
- **`created_at DATETIME DEFAULT CURRENT_TIMESTAMP`**：创建时间，默认当前时刻。`CURRENT_TIMESTAMP` 是数据库的时间，不是你服务器的时间——相信数据库，它的时钟最准。
- **`ENGINE=InnoDB`**：指定存储引擎（见 1.5，无脑 InnoDB）
- **`CHARSET=utf8mb4`**：字符集（见 3.1，永远 utf8mb4）

### ALTER / DROP 详解

```sql
-- 加一列（8.0 对很多操作支持 INSTANT，秒级完成）
ALTER TABLE users ADD COLUMN email VARCHAR(100);

-- 删一列（列里的数据一并删除！不可恢复）
ALTER TABLE users DROP COLUMN email;

-- 改列类型（如果现有数据转不成新类型会失败）
ALTER TABLE users MODIFY username VARCHAR(100);

-- 加索引（INPLACE 方式，不锁表，5.6+）
ALTER TABLE users ADD INDEX idx_email (email);

-- 删表（整个表连结构带数据一起消失，高危中的高危）
DROP TABLE users;
```

**类比**：DDL ≈ 改 TypeScript 的 interface（改的是"结构"）；DML ≈ 操作数据本身（往数组里 push 一条）。改 interface 不影响已运行的程序，但 DDL 是**立即生效**的——ALTER 表的瞬间，所有依赖该表的查询都按新结构来。

**生产环境注意**：对大表执行 ALTER 前先确认算法（`ALGORITHM=INSTANT/INPLACE/COPY`，COPY 最危险会锁表），改表结构要挑低峰期（面试题 M20 展开）。

## 2.2 SELECT 查询详解

### 基础查询

```sql
SELECT * FROM users;                          -- 查全部（* 表示所有列）
SELECT id, username FROM users;               -- 只查两列（推荐写法）
SELECT DISTINCT status FROM poster_jobs;      -- 去重，看这张表有哪些状态值
```

**为什么要少用 `SELECT *`**：① 传输浪费——前端只要 2 列你传 20 列；② 索引失效——查询所有列就没法用"覆盖索引"优化（第 4 章）；③ 代码脆弱——表加列后，依赖列顺序的代码会悄悄出 Bug。**练完第 4 章你会回来感谢这条建议的。**

**标识符引用惯例**：MySQL 里表名/列名习惯用反引号包裹（当列名撞了关键字时必须用）：

```sql
SELECT `name`, `status` FROM `users`;   -- name 和 status 都不是保留字时可省略
SELECT `order` FROM orders;             -- order 是关键字，必须反引号
```

### WHERE 条件全家桶（逐条讲透）

WHERE 是 SQL 的 `filter()`，熟练度直接决定你写 SQL 的速度。

```sql
-- ① 比较：= > < >= <= <>（<> 是"不等于"，等价于 !=）
WHERE id = 1
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

**大小写敏感的坑（MySQL 特有）**：默认排序规则 utf8mb4_xxx_ci 里的 `ci` = case insensitive，所以 `WHERE username = 'XIAOMING'` 能匹配 `xiaoming`！PG 默认是区分的。想要区分大小写：改列的 collation 为 `_bin` 或 `_cs`，或用 `WHERE BINARY username = 'x'`。

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
LIMIT 10 OFFSET 20;    -- 跳过前 20 条，取 10 条（第 3 页）

-- MySQL 独有简写：LIMIT 偏移量, 条数
SELECT * FROM avatars ORDER BY created_at DESC LIMIT 20, 10;
-- ⚠️ 注意顺序！LIMIT a,b 是"跳过 a 条取 b 条"，和 OFFSET 写法相反，小心背锅
```

**OFFSET 的坑**（第 8 章深讲）：`OFFSET 100000` 意味着数据库要**先扫出前 10 万条再扔掉**。数据量大的表翻到后面页会越来越慢——这就是"深分页问题"，解法是游标分页或延迟关联（第 8 章）。

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

-- 分组：每个用户有多少头像
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

**铁律**：`SELECT` 里出现的非聚合列，**必须**出现在 `GROUP BY` 里。为什么？分组后每堆可能有很多不同的 name，数据库不知道该输出哪个。MySQL 8.0 默认开启 `ONLY_FULL_GROUP_BY` 模式强制这条规则（老版本会"随机"返回一行的值，是著名的数据陷阱）。

```sql
-- ❌ 8.0 报错：name 没在 GROUP BY 里
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

### 常用函数速查（MySQL 版）

| 函数 | 作用 | 例子 |
|------|------|------|
| `NOW()` | 当前时间 | `WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`（最近 7 天） |
| `IFNULL(a, b)` | a 为 NULL 时用 b 兜底 | `IFNULL(cover_url, '/default.png')` ≈ `cover_url ?? '/default.png'` |
| `COALESCE(a, b, ...)` | 多参数版 IFNULL，取第一个非 NULL | — |
| `LENGTH(s)` / `CHAR_LENGTH(s)` | 字节长度 / 字符长度（中文重要！） | `CHAR_LENGTH('你好')` = 2，`LENGTH` = 6 |
| `CONCAT(a, b)` | 拼接 | `CONCAT(username, '@avatar')` |
| `UPPER / LOWER` | 大小写转换 | — |
| `SUBSTRING(s, 1, 3)` | 截取字符串（从第 1 位取 3 个） | — |
| `DATE_FORMAT(ts, '%Y-%m-%d')` | 时间格式化 | 类似 dayjs 的 format |
| `DATE(created_at)` | 取日期部分 | 按天统计分组用 |

**按天统计的黄金组合**（前端做图表常用）：
```sql
SELECT DATE(created_at) AS day, COUNT(*)
FROM avatars
WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY day
ORDER BY day;
```

## 2.3 INSERT / UPDATE / DELETE

### INSERT 详解

```sql
-- 插入单条（id 自增不用传）
INSERT INTO users (username, password_hash)
VALUES ('xiaoming', 'hash...');

-- 拿自增 id（MySQL 没有 PG 的 RETURNING，用这个）
SELECT LAST_INSERT_ID();   -- 返回本连接刚才插入的自增 id
-- ⚠️ 注意：是"本连接"，别的连接插的不会混进来

-- 插入多条（批量，性能远好于循环插 100 次）
INSERT INTO users (username, password_hash) VALUES
  ('a', 'hash1'),
  ('b', 'hash2');

-- 插入时冲突怎么办？ON DUPLICATE KEY UPDATE（"upsert"）
INSERT INTO users (id, username) VALUES (1, 'xiaoming')
ON DUPLICATE KEY UPDATE username = VALUES(username);
-- 主键/唯一键冲突时不报错，改为更新
```

**列名列表的意义**：`INSERT INTO users (username, password_hash)` 明确只提供这两列，其他列走默认值。**永远显式写列名**——不写的话数据库按列顺序填，表结构一变（中间加了列）你的代码就悄悄错位了。

### UPDATE 详解

```sql
-- 基础更新
UPDATE avatars SET name = '新名字' WHERE id = 1;

-- 基于旧值计算（读取-计算-写入是原子的，并发安全）
UPDATE avatars SET name = CONCAT(name, '-副本') WHERE id = 1;

-- 更新多列
UPDATE avatars SET name = 'x', base_id = 'y' WHERE id = 1;
```

### DELETE 详解

```sql
-- 带条件删除
DELETE FROM poster_jobs
WHERE status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);

-- ⚠️ 不带 WHERE = 删除全表数据！
DELETE FROM avatars;   -- 手一抖，全没了（逐行删+记日志，慢但可回滚）
```

### DELETE / TRUNCATE / DROP 的区别（必考）

| | DELETE | TRUNCATE | DROP |
|---|---|---|---|
| 删什么 | 行（可带 WHERE） | 全表数据 | 整张表（结构也没了） |
| 能回滚 | ✅ | ❌（隐式提交） | ❌ |
| 速度 | 慢（逐行记 undo/binlog） | 快（重建表） | 最快 |
| 自增计数器 | 不重置 | **重置为 1** | 表都没了 |

> 一句话：DELETE 是"撕掉几页"，TRUNCATE 是"倒空文件夹"，DROP 是"把文件夹扔了"。

### ⚠️ 铁律：UPDATE / DELETE 前先 SELECT

```sql
-- 第 1 步：用同样的 WHERE 跑 SELECT，确认影响范围
SELECT * FROM poster_jobs
WHERE status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
-- 看一眼：哦，12 条，都是该删的

-- 第 2 步：确认无误，改成 DELETE 再执行
DELETE FROM poster_jobs
WHERE status = 'failed' AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

这不是仪式感，是无数删库事故换来的规矩。生产环境删数据前，最好再用事务包裹：`BEGIN` → `DELETE` → `SELECT` 检查 → 确认 `COMMIT` / 后悔了 `ROLLBACK`（第 5 章细讲）。

---

# 第三章：表设计与字符集

> 表设计 = 数据库世界的"架构设计"。表设计得好，后面 80% 的麻烦都没有；设计得烂，写再多 SQL 都是在还债。

## 3.1 字符集：中文世界的 MySQL 第一坑

**先记结论：永远用 utf8mb4，别用 utf8**。

为什么？MySQL 的 "utf8" 是个**历史遗留的残缺实现**——最多 3 字节，存不下 emoji（4 字节）和部分生僻字。utf8mb4 才是真正的 UTF-8（mb = multi-bytes，最多 4 字节）。

```
utf8     → 最多 3 字节 → 用户昵称带个 😀 直接报错/截断
utf8mb4  → 最多 4 字节 → 全字符集，现代标配
```

```sql
-- 建库/建表时显式指定（别依赖服务器默认值，那可能是历史配置）
CREATE DATABASE learn DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE users (...) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**排序规则（Collation）顺带理解**：`utf8mb4_unicode_ci` 里的 `_ci` = case insensitive（比较不区分大小写），`_cs` 才区分。还有 8.0 默认的 `utf8mb4_0900_ai_ci`（ai = 口音不敏感）。**知道 ci/cs 的区别、知道为什么 `WHERE name='ABC'` 能匹配 'abc' 是 collation 在起作用，就够面试用了。**

**字符集还有个隐藏坑**：两张表字符集不同（一张 utf8，一张 utf8mb4），JOIN 时会发生**隐式字符集转换 → 索引失效**。所以"全库统一 utf8mb4"不只是为了 emoji。

## 3.2 数据类型怎么选

类型选错，轻则浪费空间，重则数据出错（金额精度丢失）或查询变慢。逐个讲：

| 需求 | MySQL 类型 | 说明 |
|------|----------------|------|
| 主键 | `BIGINT UNSIGNED AUTO_INCREMENT` | 顺序插入性能好（见 3.3） |
| 短文本 | `VARCHAR(n)` | 用户名、标题（有长度上限的） |
| 长文本 | `TEXT` | 内容、JSON 字符串（不限长度） |
| 整数 | `INT` / `BIGINT` | 数量、状态码（INT 21亿级，BIGINT 天文数字） |
| 布尔 | `TINYINT(1)` | 存 0/1，约定俗成当布尔用 |
| 时间 | `DATETIME` / `TIMESTAMP` | 创建/更新时间（区别见下） |
| JSON | `JSON`（5.7+） | 校验合法性，查询见 2.4 |
| 金额 | `DECIMAL(10,2)` | **千万别用 FLOAT，浮点精度丢失** |

**几个类型的深入说明**：

**① 为什么金额千万别用 FLOAT/DOUBLE？**

```javascript
// 前端同学都踩过这个坑：
0.1 + 0.2 === 0.30000000000000004   // true！
```

FLOAT 用二进制存小数，0.1 这种十进制小数在二进制里是无限循环，必然有误差。存钱用 FLOAT，一天百万笔交易累计下来，账就对不上了。`DECIMAL(10,2)` 是"精确十进制"，10 位数字、2 位小数，最多存 99999999.99，**分毫不差**。
（另一个常见做法：金额以"分"为单位存 INT，100 元存 10000，彻底避开小数。）

**② VARCHAR vs TEXT 的区别？**

VARCHAR 要显式限长（校验层），TEXT 不限长（最大 64KB）。经验法则：想要"强制限长"（用户名最多 50 字）用 VARCHAR(50)——超长直接报错，相当于数据库层的数据校验；不限长的内容用 TEXT。**注意 TEXT 列不能设默认值、排序时只能用前缀索引**，所以能用 VARCHAR 尽量 VARCHAR。

**③ DATETIME vs TIMESTAMP**（高频小题）：

| | DATETIME | TIMESTAMP |
|---|---|---|
| 范围 | 1000-9999 年 | 1970-2038 年（**2038 问题**） |
| 时区 | 存"字面时间"，不随连接时区变 | 存 UTC，查询时按连接时区转换 |
| 空间 | 8 字节 | 4 字节 |

推荐：存创建/更新时间用 DATETIME（别赌 2038 年前重写系统），需要时区智能转换才用 TIMESTAMP。

**④ JSON 类型怎么用**（穿搭数据这种嵌套结构的场景）：

```sql
CREATE TABLE avatars (
  parts JSON,                      -- 插入时校验 JSON 合法性（非法直接报错）
);

-- 查询：JSON_EXTRACT 或 ->> 操作符（->> 返回文本并去掉引号）
SELECT parts->>'$.hat' FROM avatars WHERE parts->>'$.hat' LIKE '%red%';

-- 虚拟列 + 索引（让 JSON 里的字段可索引，关键技巧！）
ALTER TABLE avatars
  ADD COLUMN hat VARCHAR(100)
  GENERATED ALWAYS AS (parts->>'$.hat[0]'),      -- 虚拟列：不占空间，取值时计算
  ADD INDEX idx_hat (hat);
```

**对比一句**（面试素材）：PG 的 JSONB 是解析成二进制存储 + 原生 GIN 索引；MySQL 的 JSON 本质是文本存储 + 虚拟列绕行建索引。MySQL 能用，PG 更强。

## 3.3 主键设计：自增 BIGINT 的正反两面

MySQL 面试必问"自增还是 UUID"，答"看场景 + 知道取舍"：

| | 自增 BIGINT | UUID（VARCHAR(36)） |
|---|---|---|
| 插入性能 | ✅ 追加到 B+ 树最右，顺序写 | ❌ 随机位置插入 → 页分裂 |
| 空间 | 8 字节 | 36 字节（二级索引的叶子全存着主键，到处复制） |
| 分布式 | ❌ 多库会重复 | ✅ 天然全局唯一 |
| 安全 | ❌ 可被遍历（/user/1、/user/2...） | ✅ 不可猜测 |

**为什么随机主键会页分裂**（联系第 4 章的 B+ 树）：B+ 树的叶子节点是按主键顺序排列的数据页。自增 id 永远追加到最后一页，页满了顺势开新页；UUID 随机落点，命中已满的页就得"分裂"成两页并把一半数据挪过去——写入变慢 + 碎片化。

**生产常见折中**：单库用自增 BIGINT；分布式用**雪花算法**（Snowflake，64bit：时间戳+机器ID+序列号，既全局唯一又趋势递增）。

## 3.4 约束详解

约束（Constraint）= 数据库帮你守门。**能在约束层挡住的脏数据，就不要靠应用代码判断**——应用代码可能有 10 个入口，约束只有一道闸，漏不掉。

```sql
CREATE TABLE avatars (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  base_id    VARCHAR(50) NOT NULL DEFAULT 'base1',
  parts      JSON,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_avatars_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**约束全家福**：

| 约束 | 作用 | 违反时会怎样 |
|------|------|------------|
| `PRIMARY KEY` | 唯一 + 非空，行的身份证 | 重复 id 或空 id → 插入报错 |
| `NOT NULL` | 必填 | 不传值 → 报错 |
| `UNIQUE` | 不许重复 | 重名 → 报错 |
| `DEFAULT` | 不传时给默认值 | 不报错，静默用默认值 |
| `FOREIGN KEY` | 引用的值必须存在 | 悬空引用 → 报错 |
| `CHECK`（8.0.16+ 才真正生效） | 自定义规则 | `CHECK (price >= 0)`：负价格 → 报错 |

**两个 MySQL 特有的好东西**：
- `ON UPDATE CURRENT_TIMESTAMP`：行被更新时自动刷新 updated_at（不用写触发器）
- `KEY idx_xxx (col)`：建表语句里直接建索引，顺手

**外键的三种行为**（面试常问，"删用户时他的头像怎么办"）：

- `CASCADE`：删父删子——删用户 → 自动删掉他所有头像。适合头像这种"完全从属于用户"的数据
- `SET NULL`：删父后子的外键置空——要求列允许 NULL。适合"参考关系"数据（文章删除，评论的 article_id 置空保留评论）
- `RESTRICT`（默认）：有子数据时**拒绝删父**——还有头像的用户不许删。最安全，逼你显式处理

**互联网公司的实际做法**（加分认知）：很多大厂**不在生产库建外键**（用应用层保证 + 定时对账），因为外键的每次检查都有开销、级联操作不可控、也不利于分库分表。初学阶段建议练习时用外键培养"数据完整性"意识，知道生产为什么常常不用。

## 3.5 范式与反范式

范式 = 表设计的"卫生规范"，告诉你数据该怎么放才不留后患。

**三大范式（记人话版）**：

**1NF（第一范式）：列不可再分** —— 每个格子只存一个值

```
❌ 违反：tags = "帽子,衣服,鞋"        （一个格子塞了 3 个值）
✅ 正确：建一张 avatar_tags 关联表，或者用 JSON 列
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

## 3.6 表设计实战流程

设计"头像保存"功能的表，走一遍完整思路：

```
第 1 步：列实体和字段
  头像：名字、穿搭数据（parts）、封面图、所属用户、创建时间
  ↓ 想清楚"这个实体有哪些属性"，别漏也别贪多

第 2 步：确定关系
  用户 1 : N 头像（一个用户多个头像）
  → 头像表加 user_id 外键
  ↓ 关系判断口诀：1对1（合并？分表？）、1对多（外键放"多"的一方）、多对多（中间表）

第 3 步：选类型加约束
  parts 是嵌套 JSON → JSON 类型（要按字段查就加虚拟列+索引）
  user_id 必须存在 → 外键 + NOT NULL
  用户删除时头像怎么处理 → ON DELETE CASCADE
  ↓ 每一列都要过一遍：什么类型？允不允许空？要不要唯一？

第 4 步：为查询建索引
  高频查询："某用户的头像列表，按时间倒序"
  → KEY idx_user_created (user_id, created_at) 联合索引
  ↓ 索引跟着查询走，不是跟着列走
```

**常见关系的设计套路**（背下来）：

- **1 : 1**（用户 : 用户详情）：外键放随便一方，加 UNIQUE
- **1 : N**（用户 : 头像）：外键放 N 方（avatars.user_id）
- **N : N**（用户 : 标签）：建中间表 `avatar_tags(avatar_id, tag_id)`，两列组成联合唯一

---

# 第四章：索引与 EXPLAIN 详解

> 索引是面试第一高频考点，也是性能优化的核心。这一章值得反复读。

## 4.1 为什么索引快：B+ 树图解（零基础补课版）

> 没学过数据结构也能读懂本节——从"树是什么"讲起。

### 4.1.1 前置知识：什么是"树"

你天天在跟树打交道——**DOM 就是树**：

```
document
├── <html>
│   ├── <head>
│   └── <body>
│       ├── <div>
│       └── <ul>
```

数据结构里的"树"是一回事：**一个节点连着几个子节点，一层层展开，没有环**。几个术语对应着记：

| 术语 | DOM 里的对应物 | 说明 |
|------|--------------|------|
| 节点（Node） | 一个 DOM 元素 | 树上的一个"点"，存了一些数据 |
| 根节点（Root） | `document` | 最顶上那个，唯一的入口 |
| 叶子节点（Leaf） | 没有子元素的节点 | 最底层的节点，**不能再分叉** |
| 层（Level） | 嵌套深度 | 根是第 1 层，往下数 |
| 树高 | 最大嵌套深度 | 从根到最深叶子要经过几层 |

**B+ 树里的"节点"不神秘**：就是一个 16KB 的磁盘块（MySQL 叫"页"），里面塞了一批排好序的数字（key）和指向子节点的指针。

### 4.1.2 排好序的树，查询像二分查找

树按什么规则长，决定了查询快不快。**搜索树**的规则很简单：**左小右大**。

查 37 的过程（对照下图）：从根 [50] 开始 → 37 < 50，往左 → 到 [25] → 37 > 25，往右 → 到 [37] → 命中！**每比较一次，就排除掉一整棵子树**——这就是树查询快的本质。

```javascript
// 前端同学秒懂：这就是二分查找的思想
function binarySearch(sortedArr, target) {
  let lo = 0, hi = sortedArr.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sortedArr[mid] === target) return mid
    if (sortedArr[mid] < target) lo = mid + 1   // 排除左半边
    else hi = mid - 1                           // 排除右半边
  }
  return -1
}
// 每次排除一半 → 100 万数据只要 ~20 次比较
```

### 4.1.3 直觉解法"二叉树"为什么不行：磁盘 IO 才是瓶颈

每个节点只有 2 个分叉的树叫**二叉树**。按上面的"排除法"，100 万数据只要 log₂(100万) ≈ 20 次比较，看起来很快？

**但数据库的瓶颈不是比较，是磁盘 IO**。内存里的数组二分查找，跳来跳去都是纳秒级；而数据库的数据在磁盘上，**每访问一个节点 = 读一次磁盘 = 一次寻道约 10ms**。20 层的二叉树 = 20 次 IO = 200ms——根本不快。

```
二叉树（瘦高个）：100 万数据
[根] → [子] → ... 20 层 ... → [叶子]
= 20 次磁盘 IO ≈ 200ms ❌
```

### 4.1.4 B+ 树的智慧：把树压扁成"矮胖子"

关键洞察来自磁盘的物理特性：**读 1 字节和读 16KB 耗时几乎一样**（磁盘按"页"读，一次就是一个块）。既然一次 IO 能带 16KB，那就别浪费——**让每个节点塞几百个 key**（一个 16KB 的页）：

```
B+ 树（矮胖子）：100 万数据，每节点 ~几百个 key

            [根节点]         ← 第 1 次磁盘 IO（几百个 key 里二分定位走哪边）
           /   |    \
     [内部节点]...[内部节点]   ← 第 2 次磁盘 IO
      /  \          /  \
 [叶子节点]      [叶子节点]    ← 第 3 次磁盘 IO，找到数据
 (存主键+整行数据) (叶子间有双向链表，方便范围查询)
```

每个节点几百个分叉，100 万数据只要 3 层：
- 根节点 1 个节点，几百个分叉
- 第 2 层几百个节点，每个又几百个分叉 → 覆盖几十万个区间
- 第 3 层（叶子）放数据，百万级全覆盖

**3 层 = 3 次磁盘 IO ≈ 30ms 以内，比全表扫描快百倍。**而且根节点和第 2 层节点是热点数据，基本常驻内存，实际常常只要 1 次磁盘 IO。

**一句话理解 B+ 树**：
> **把二叉树"每个节点 2 个分叉"改成"每个节点几百个分叉"，树高从 20 压到 3，磁盘 IO 从 20 次降到 3 次。**二叉树是"瘦高个"，B+ 树是"矮胖子"——数据库要的就是矮。

> 💡 前端类比：B+ 树 ≈ 无限层级但每层**超级宽**的菜单导航。找一个功能：二叉树式菜单（每层只有 2 项）要点 20 层；B+ 树式菜单（每层几百项）点 3 层就到底。

### 4.1.5 B+ 树的三个硬规矩（定义）

1. **所有数据只存叶子节点**——内部节点只存 key（路标），不存数据
2. **叶子节点按顺序排，且两两之间有双向链表相连**——从左到右就是排好序的全表
3. **非叶子节点存 key + 子指针**，key 是"路标"：告诉你要找的值在左边还是右边的子树

为什么要立这些规矩？——见 4.1.6 的 B 树对比和范围查询说明。

### 4.1.6 B+ 树 vs B 树的区别（经典面试题）

B 树（B 是平衡 Balanced 的意思，不是 Binary）：和 B+ 树像，但**每个节点都存数据**（不只是叶子）。

| | B+ 树 | B 树 |
|---|---|---|
| 数据存哪 | **只在叶子** | 每个节点都可能存 |
| 内部节点 | 只存 key → 同样 16KB 能塞**更多路标** → 树更矮 → IO 更少 | 存 key + 数据 → 路标变少 → 树更高 |
| 范围查询 | 叶子有链表，`WHERE id > 100 AND id < 200` 顺着链表滑过去 | 要回到上层节点反复横跳 |
| 查询稳定性 | 每次都走到叶子，耗时稳定 | 命中内部节点就提前结束，快慢不一 |

**面试一句话**："B+ 树数据全在叶子（内部节点更瘦、树更矮、IO 更少）+ 叶子双向链表（范围查询顺藤摸瓜）——这是 InnoDB 选它的两个原因。"

### 4.1.7 为什么不用哈希表？

哈希等值查询 O(1) 确实比 B+ 树快，但**不支持范围查询和排序**（`WHERE age > 18`、`ORDER BY` 直接歇菜——哈希把顺序打散了）。B+ 树是"等值也快、范围更强"的六边形战士。（MySQL 也有自适应哈希索引，InnoDB 自动管理，不用你操心。）

### 4.1.8 把 4.1 节串起来（60 秒复述版）

```
全表扫描慢（逐行比对）
  → 想用树：每比较一次排除一大片
    → 二叉树不行：20 层 = 20 次磁盘 IO（瓶颈是 IO 不是比较）
      → B+ 树：每节点几百 key（16KB 一页），3 层搞定百万数据
        → 数据全在叶子 + 叶子有链表 = 等值快 + 范围强
          → 这就是 InnoDB 索引的全部秘密
```

能不看书写出上面这个推理链，4.1 就算真懂了。

## 4.2 聚簇索引 vs 二级索引（InnoDB 特有的核心概念）

**聚簇索引（主键索引）**：InnoDB 的表**就是**主键的 B+ 树——叶子节点存的是**整行数据**。"表即索引"。

**二级索引（普通索引）**：另建的 B+ 树，叶子节点存的是**主键值**（不是整行）。

| | 聚簇索引（主键索引） | 二级索引 |
|---|---|---|
| 叶子节点存什么 | **整行数据** | 主键 ID |
| 一张表有几个 | 只能有 1 个 | 可以有多个 |
| 查询过程 | 一次查树拿到整行 | 先查到主键 ID，再**回表**查整行 |

**为什么只能有 1 个聚簇索引**：数据只能按一种方式物理排序（书的内容只能按一种顺序装订）。主键索引决定了数据在磁盘上的物理排列，其他索引只能"间接引用"。

**回表（高频名词）**：用二级索引（如 user_id 索引）查到主键 ID 后，还要再去聚簇索引查一次完整数据。等于查了**两棵树**，多一次 IO。

```sql
-- 有索引 idx_user_created (user_id, created_at)
SELECT * FROM avatars WHERE user_id = 1;
-- 执行过程：① user_id 索引树找到 user_id=1 的所有主键 id
--           ② 拿着 id 们逐个回聚簇索引树查整行（回表！）
```

**覆盖索引（性能优化利器）**：如果查询的列**都在索引里**，就不用回表：

```sql
SELECT user_id, created_at FROM avatars WHERE user_id = 1;
-- ✅ 要查的两列都在索引里 → 覆盖索引，不回表，飞快
-- EXPLAIN 的 Extra 会显示 Using index

SELECT * FROM avatars WHERE user_id = 1;
-- ❌ 要查所有列，索引里只有两列 → 必须回表
```

这就是"别 SELECT *"的根本原因：**只查需要的列，才有机会命中覆盖索引**。

## 4.3 联合索引与最左前缀（必考）

联合索引 `(user_id, created_at)` 的本质：**先按 user_id 排序，user_id 相同的再按 created_at 排序**——就像电话簿按"姓 + 名"排序。

```sql
-- ✅ 走索引
WHERE user_id = 1                                -- 相当于只用"姓"查：翻到姓 X 的区域
WHERE user_id = 1 AND created_at > '2026-01-01'  -- 姓+名一起查：定位更准
WHERE user_id = 1 ORDER BY created_at            -- 排序也免了：姓 X 区域内天然按时间有序

-- ❌ 不走索引（跳过了左边的列）
WHERE created_at > '2026-01-01'                  -- 只知道"名"：电话簿没法按名查
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
                           -- 相当于 CAST(phone AS ...) = ... → 回到场景 1
-- ⚠️ 反过来（列是数字传字符串）MySQL 能走索引，但别依赖这种宽容

-- 5. OR 两侧有一侧没索引 → 全表扫描
WHERE user_id = 1 OR description LIKE '%test%'
-- description 无索引 → user_id 那边索引救不了整个 OR → 优化器放弃

-- 6. 不等号 != / NOT IN → 大概率失效
-- 否定条件意味着"除了这几行全都要"，通常范围太大，优化器干脆全表扫

-- 7. 数据区分度太低 → 优化器主动放弃索引
WHERE status = 'done'  -- 如果 99% 的行都是 done，走索引还要回表 99 万次，不如直接扫
```

**第 7 条值得展开**：索引的价值在于"排除大多数行"。性别、状态这种只有两三个取值的列，索引几乎帮不上忙。**索引要建在区分度高的列上**（如 user_id，几乎每个值只对应几行）。

**怀疑索引失效怎么办**：别猜，**EXPLAIN 一下**（见 4.5），让数据库告诉你走没走索引。

## 4.5 EXPLAIN：MySQL 版深入（面试重灾区）

EXPLAIN 是 MySQL 的"透视镜"——不执行查询，展示它**打算怎么查**：

```sql
EXPLAIN SELECT * FROM avatars WHERE user_id = 1;
-- 想看真实耗时：EXPLAIN ANALYZE（8.0.18+，真实执行并报告各阶段时间）
```

**必须会读的字段**（按重要性排序）：

| 字段 | 看什么 |
|------|--------|
| **type**（最重要） | 访问类型，性能从好到坏：`system > const > eq_ref > ref > range > index > ALL` |
| **key** | 实际用到的索引名（NULL = 没用索引） |
| **rows** | 预估扫描行数，越小越好 |
| **Extra** | 额外信息，藏着宝藏（见下） |
| key_len | 用了联合索引的几个列、是否用到全部 |
| possible_keys | 备选索引（列出来但没用的） |

**type 常见值逐个讲**（面试说出这些词 = 专业）：

- `const`：主键/唯一索引等值查，最多一行。最快
- `eq_ref`：JOIN 时被驱动表用主键/唯一索引关联。很好
- `ref`：普通二级索引等值查。良好（业务代码大部分应该在这及以上）
- `range`：索引范围扫描（BETWEEN、>、<、IN）。可以接受
- `index`：扫整棵索引树（比扫全表好一点点，覆盖索引时出现）
- `ALL`：**全表扫描 → 🚨 警报**

**Extra 的黄金信号**：

| Extra 值 | 含义 |
|----------|------|
| `Using index` | ✅✅ 覆盖索引，没回表 |
| `Using index condition` | ✅ 索引下推（ICP）在工作（见 4.6） |
| `Using where` | 服务层过滤（正常） |
| `Using filesort` | ⚠️ 排序没走索引，额外排序（ORDER BY 的列没索引） |
| `Using temporary` | 🚨 建了临时表（GROUP BY/DISTINCT 没走索引），优先优化 |

**一次完整的优化演示**（把上面所有知识串起来）：

```sql
-- 慢：EXPLAIN 显示 type=ALL，rows=100000，Extra=Using filesort
SELECT * FROM avatars WHERE user_id = 1 ORDER BY created_at DESC;

-- 加联合索引后：type=ref，rows=5，Extra 干净了
ALTER TABLE avatars ADD INDEX idx_user_created (user_id, created_at);
-- WHERE 和 ORDER BY 都被索引消化了（最左前缀的排序优势，见 4.3）
```

## 4.6 MySQL 特色索引技巧

**① 前缀索引**：对长字符串列（如 URL、邮箱），只索引前 N 个字符，大幅省空间：

```sql
CREATE INDEX idx_email ON users(email(10));   -- 只索引前 10 个字符
```
代价：不能用于覆盖索引和 ORDER BY。
怎么定 N：看区分度——`SELECT COUNT(DISTINCT LEFT(email,10)) / COUNT(*) FROM users;` 越接近 1 越好，取"区分度够高的最小值"。

**② 索引下推（ICP，Index Condition Pushdown，5.6+）**：

没有 ICP 时：联合索引 (name, age)，查询 `WHERE name LIKE 'xiao%' AND age = 18` → 索引定位到 name 匹配的所有行 → **全部回表** → 服务层再过滤 age。
有 ICP 时：引擎层先在索引里把 age=18 也判断了 → **只回表真正匹配的行**。

效果：回表次数大减。EXPLAIN 的 Extra 显示 `Using index condition` 就是它在工作。

**③ 索引的代价（什么时候不该建）**：

- 占磁盘空间（索引也是数据，联合索引可能比表还大）
- 降低写入速度（INSERT/UPDATE/DELETE 都要同步维护所有索引树）
- 索引太多优化器可能选错

所以：**按查询建索引，不是越多越好**。用 `sys.schema_unused_indexes` 找出从没用过的索引删掉（第 11 章）。

---

# 第五章：事务与 ACID

## 5.1 为什么需要事务

**事务（Transaction）= 把多条 SQL 捆绑成一个"要么全成、要么全不干"的单元。**

现实世界的类比：**银行转账**。A 账户 -100 元 和 B 账户 +100 元 必须同时成功。只成功一半，要么 A 白亏 100，要么银行凭空印 100。事务保证这两步是原子的。

```sql
-- MySQL 手动事务三件套
BEGIN;          -- 或 START TRANSACTION，开启事务
UPDATE accounts SET balance = balance - 100 WHERE id = 1;   -- 操作 1
UPDATE accounts SET balance = balance + 100 WHERE id = 2;   -- 操作 2
COMMIT;         -- 确认提交：所有操作永久生效
-- 或者中途发现不对：
ROLLBACK;       -- 反悔撤销：所有操作作废，数据回到事务开始前
```

**没有事务的危险**（代码视角）：

```typescript
// 删用户和他的头像，两步操作
await db.user.delete(id)          // 删了用户
// ← 如果这里服务器断电 / 进程崩溃 / 磁盘满
await db.avatar.deleteMany(...)   // 头像没删 → 脏数据！
```

**事务的隐式提交**：MySQL 里默认 `autocommit=1`（每条 SQL 自动当成一个事务提交）。DDL 语句（ALTER/DROP）会**隐式提交**当前事务——事务里写了半截 DDL，前面的 DML 直接被提交了，ROLLBACK 不回来！**记住：事务里别混 DDL。**

## 5.2 ACID 详解（必考）

ACID 是事务的四大特性，逐个拆：

| 特性 | 含义（人话） | 靠什么实现 |
|------|------|-----------|
| **A** 原子性 Atomicity | 事务内操作不可分割，全做或全不做（转账不能只扣不加） | undo log（回滚日志） |
| **C** 一致性 Consistency | 事务前后数据满足所有约束（钱的总额不变、外键不悬空） | 由 A、I、D 共同保证 + 应用层 |
| **I** 隔离性 Isolation | 并发事务互相看不到中间状态（A 转账转一半，B 不能来查余额） | 锁 + MVCC |
| **D** 持久性 Durability | 提交后断电也不丢（COMMIT 成功 = 数据真的在磁盘上了） | redo log（WAL，先写日志再写数据） |

**四个特性怎么记**：
- A 是对**一个事务**说的：内部操作打包，不可分割
- I 是对**多个事务**说的：并发时互不干扰
- D 是对**故障**说的：提交了就别想丢
- C 是**最终目标**：前三者是手段，一致性是结果（所以面试答"C 由 AID 共同保证"是加分项）

**实现细节在第 6 章**（redo log / undo log 的原理），这里先建立框架。

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
| 读已提交（Read Committed） | ✅ 防住 | ❌ 有 | ❌ 有 |
| **可重复读（Repeatable Read）** | ✅ | ✅ 防住 | 基本防住* |
| 串行化（Serializable） | ✅ | ✅ | ✅ 全防住 |

*MySQL 的 RR 靠 MVCC 防快照读的幻读 + 间隙锁防当前读的幻读（第 7 章展开），所以是"基本防住"。

- **读未提交**：啥也不防，性能最好，几乎没人用
- **读已提交**：只读别人提交了的数据——最低的"卫生底线"（PG、Oracle 默认）
- **可重复读**：一个事务内读到的数据保持一致——**MySQL InnoDB 默认**
- **串行化**：并发事务排队执行，全防住但性能最差

**必须记住的默认值**：
> **MySQL InnoDB 默认：可重复读（Repeatable Read）**
> **PostgreSQL 默认：读已提交（Read Committed）**

```sql
-- 查看和设置隔离级别（MySQL 8.0 语法）
SELECT @@transaction_isolation;
SET SESSION transaction_isolation = 'READ-COMMITTED';
```

**怎么选**：一般用默认。互联网公司很多把 MySQL 调成 RC（锁范围更小，并发更好）；金融强一致场景保持 RR。

## 5.4 事务的实战注意事项

- **事务要短小**：事务持有锁和资源，越长越容易阻塞别人、引发死锁。**别在事务里调外部 API / sleep / 发 HTTP 请求**
- **大批量操作分批提交**：一次 DELETE 百万行 = 巨型事务（undo log 爆炸 + 锁太久 + 主从延迟），改成每批 1000 行循环
- **失败要回滚**：代码里 try-catch 捕获异常后记得 ROLLBACK，否则连接断开前的中间状态可能被后续提交搞乱

---

# 第六章：InnoDB 日志体系

> **MySQL 面试的深水区，也是区分"背题的"和"真懂的"的分水岭**。核心是三种日志各司其职：undo log、redo log、binlog。

## 6.1 三大日志总览（先建框架）

| 日志 | 属于 | 作用 | 一句话 |
|------|------|------|--------|
| **redo log** | InnoDB 引擎层 | 崩溃恢复（持久性 D） | "我改了什么"，重启后照着重做 |
| **undo log** | InnoDB 引擎层 | 回滚 + MVCC（原子性 A） | "我原来是什么"，后悔药 |
| **binlog** | 服务层（所有引擎共用） | 主从复制 + 数据归档 | "操作流水账"，给从库和备份用 |

**为什么要三本账？**（理解了这个，后面全是细节）
- 崩溃后要恢复 **InnoDB 自己的数据** → redo log（引擎私有）
- 要**回滚**未提交的事务 → undo log（记录改前旧值）
- 要把变更**同步给从库/备份系统** → binlog（服务层统一出口，MyISAM 也能有）

## 6.2 redo log：崩溃恢复的基石（WAL）

redo log 实现的是 **WAL（Write-Ahead Log，预写日志）**：**每次改数据，先写日志文件，再慢慢改数据文件**。

为什么这么设计？
- 写日志是**顺序写**（往文件末尾追加），磁盘顺序写极快
- 改数据页是**随机写**（数据页散落在磁盘各处），慢

所以流程是：`改数据 → 先记 redo log（快） → 告诉用户"提交成功" → 后台慢慢把改动刷进数据文件`。如果刷盘途中断电？重启后**重放 redo log**，把没刷完的改动补上。这就是"**先记账，后干活**"——账本（日志）永远比实际库存（数据）新。

**循环写（固定大小）**：redo log 是一块固定大小的环形空间（如 4 组文件轮着写），写满就从头覆盖。这就带来 **checkpoint 机制**：InnoDB 定期把"已刷盘的进度"打 checkpoint，崩溃恢复只从 checkpoint 重放到最后——不会重放整个历史。

**刷盘策略 `innodb_flush_log_at_trx_commit`**（生产经验题）：

| 值 | 行为 | 安全性/性能 |
|---|---|---|
| 1（默认） | 每次提交都刷盘 | 最安全，最慢（但也就慢几 ms） |
| 2 | 提交写到 OS 缓存，每秒刷盘 | MySQL 崩了不丢，**操作系统崩了丢 1 秒** |
| 0 | 每秒自己刷 | 可能丢 1 秒，最快 |

**面试问"能不能为了性能调 0/2"**：钱相关的库锁死 1，日志类业务可以放宽——体现"权衡"意识。

## 6.3 undo log：回滚与 MVCC 的地基

undo log 记录的是**逻辑反操作**：INSERT 的 undo 是 DELETE，UPDATE 的 undo 是反向 UPDATE。

**双重使命**：
1. **回滚**：事务失败/ROLLBACK 时，照着 undo log 反着做一遍，数据复原（原子性 A）
2. **MVCC**：旧版本数据不是复制整行存着，而是**通过 undo log 链往回找**（第 7 章展开）

## 6.4 binlog：主从复制的生命线

binlog（归档日志）记录所有**已提交**的数据变更，三种格式：

| 格式 | 记什么 | 特点 |
|------|--------|------|
| STATEMENT | 记 SQL 原文 | 小，但 NOW()/UUID() 在从库重放会不一致 |
| ROW（默认） | 记每行的实际变更 | 大，但绝对一致（8.0 默认） |
| MIXED | 自动切换 | 折中 |

**binlog vs redo log 的区别（高频面试题）**：

| | redo log | binlog |
|---|---|---|
| 层级 | InnoDB 引擎层 | 服务层 |
| 内容 | 物理页修改（"第 X 页改了啥"） | 逻辑变更（SQL 或行变更） |
| 写法 | 循环写，会覆盖 | 追加写，不覆盖 |
| 用途 | 崩溃恢复 | 主从复制、按时间点恢复 |

**两者缺一不可**：只有 redo log——从库没法同步（它是引擎私有的循环日志）；只有 binlog——崩溃恢复不够快不够可靠（没有 checkpoint 的物理重放）。

## 6.5 两阶段提交（2PC）：redo 和 binlog 的一致性

**灵魂拷问**：一个事务既要写 redo log 又要写 binlog，**万一两个日志不同步呢？**

```
写 binlog 成功，redo log 没写  → 崩溃恢复后：主库没这数据，但从库收到了 → 主从不一致！
写 redo log 成功，binlog 没写 → 崩溃恢复后：主库有，从库没有 → 也不一致！
```

**解法：两阶段提交**（把 redo log 的提交拆成 prepare 和 commit 两步）：

```
事务提交流程：
① 写 redo log，状态 = prepare     ←"我先准备好了，还没最终确认"
② 写 binlog                       ← 流水账记上
③ 写 redo log，状态 = commit      ← 最终确认
        ↓ 崩溃恢复时的规则
- redo 是 commit 态  → 提交有效，恢复数据 ✅
- redo 是 prepare 态 → 去查 binlog：
    - binlog 里有这条 → 提交（补 commit）
    - binlog 里没有   → 回滚（当作没发生）
```

**面试答法**："redo log 和 binlog 是两个独立的日志，两阶段提交保证它们的一致性：先 redo prepare → 写 binlog → 再 redo commit。崩溃恢复时，prepare 态的事务看 binlog 决定提交还是回滚。"——这段能流利说出来，面试官知道你下过功夫。

---

# 第七章：MVCC 与锁（面试深水区）

## 7.1 MVCC：高并发的秘密

**问题**：如果靠纯锁实现隔离——读加共享锁、写加排他锁——那么"读写"和"写写"都要互相等待，并发性能会很差。

**MVCC（Multi-Version Concurrency Control，多版本并发控制）的思路**：每行数据保留多个版本，每个事务"各读各的版本"，互不打扰：

```
事务A开始 → 拿到快照（看到的是数据的版本 100）
事务B修改数据并提交 → 数据变成版本 101（旧版本 100 仍可通过 undo log 找到）
事务A再读 → 还是读版本 100（不受 B 影响）→ 可重复读达成！
```

**效果**：读不阻塞写，写不阻塞读——读的读旧版本，写的写新版本，井水不犯河水。并发性能起飞。

## 7.2 InnoDB 的 MVCC 实现（面试高频）

**三个关键组件**：

1. **隐藏列**：每行有两个隐藏列——`DB_TRX_ID`（最后修改它的事务 id）、`DB_ROLL_PTR`（回滚指针，指向 undo log 里的上一个版本）

2. **版本链**：一行被改多次后，通过 DB_ROLL_PTR 串起一条链：`当前版本 → undo 里的旧版本 → 更旧版本...`

3. **ReadView（快照）**：事务开始时生成，记录当时"活跃（未提交）事务列表"。读数据时沿版本链找**第一个对自己可见**的版本。

**可见性判断（简化版）**：沿着版本链回溯，找到的版本如果是"在我快照生成前已提交的"就可见；否则继续往回找旧版本。

**快照时机 = 隔离级别（点睛之笔）**：
- **RC（读已提交）**：每条 SELECT 都生成新 ReadView → 能看到别人新提交 → 不可重复读
- **RR（可重复读，MySQL 默认）**：只在事务第一条 SELECT 时生成 ReadView，全程复用 → 整个事务看到的世界不变

**面试话术（背这段）**：
> "InnoDB 的 MVCC 靠三件套：行的隐藏事务id + undo log 版本链 + ReadView 快照。RC 每条语句一个 ReadView，RR 整个事务一个，这就是两个隔离级别的实现差异。"

## 7.3 当前读 vs 快照读（MySQL 特有的重要区分）

**快照读**：普通 SELECT —— 读 MVCC 快照，不加锁。
**当前读**：下面这些操作读的是**最新已提交版本**，并加锁：

```sql
SELECT * FROM avatars WHERE id = 1 FOR UPDATE;         -- 当前读 + 排他锁
SELECT * FROM avatars WHERE id = 1 LOCK IN SHARE MODE; -- 当前读 + 共享锁（8.0 可写 FOR SHARE）
UPDATE / DELETE / INSERT                                -- 隐含当前读（要改，必须看最新）
```

**为什么必须有当前读**：转账场景，你 UPDATE 余额时如果基于旧快照算，就会覆盖别人的修改（丢失更新）。**改数据必须基于最新值**，所以写操作天然是当前读。

**这解释了一个经典现象**：RR 级别下普通 SELECT 看不到别人新插的行（快照读），但 UPDATE 能改到它们（当前读）——幻读在"快照读"下防住了，在"当前读"下靠**间隙锁**防（见 7.5）。

## 7.4 InnoDB 的锁全家福

```
InnoDB 锁
├── 全局锁（FTWRL，备份用）
├── 表级锁
│   ├── 表锁（基本不用）
│   ├── 意向锁（IS/IX，表级"占位声明"，加快表锁冲突判断）
│   └── AUTO-INC 锁（自增主键分配）
└── 行级锁（真正的重头戏，锁的是索引记录）
    ├── Record Lock（记录锁）：锁单条索引记录
    ├── Gap Lock（间隙锁）：锁两条记录之间的"空隙"，防插入 → 防幻读的关键
    └── Next-Key Lock（临键锁）：Record + Gap，左开右闭区间 (a, b]
```

**乐观锁 vs 悲观锁**（必考，两种并发控制**思想**，不是 MySQL 的具体锁）：

**悲观锁**：很悲观，"总觉得有人要抢"，先锁住再干活：

```sql
BEGIN;
SELECT * FROM stock WHERE id = 1 FOR UPDATE;  -- 锁住这行，别人改不了（排队）
UPDATE stock SET count = count - 1 WHERE id = 1;
COMMIT;
```

**乐观锁**：很乐观，"冲突应该很少"，不锁，改的时候再检查数据有没有被人动过：

```sql
-- 表加 version 字段（每次修改 version + 1）
UPDATE avatars
SET name = 'new', version = version + 1
WHERE id = 1 AND version = 3;
-- 我读到时 version 是 3，改的时候还必须是 3
-- 返回 0 行受影响 → 被人改过 → 重试或报错
```

**类比**：悲观锁 = 公共厕所锁门；乐观锁 = Git 提交前 `git pull` 检查冲突。
**怎么选**：冲突少（读多写少）用乐观锁；冲突多（秒杀库存、抢票）用悲观锁。

## 7.5 间隙锁（Gap Lock）——MySQL 防幻读的杀招

RR 级别下，`SELECT ... WHERE id BETWEEN 10 AND 20 FOR UPDATE` 不止锁住已存在的记录 12、15，还锁住间隙 (10,12)、(12,15)、(15,20)——**别人想 INSERT id=13？插不进来**。于是"当前读"下的幻读也被防住了。

**这就是"MySQL 的 RR 基本防住幻读"的底层原因**（5.3 节表格里那个"基本防住"的注脚）。

**间隙锁的代价（面试加分点）**：锁范围放大 → 并发插入被阻塞 → 死锁概率上升。
**等值查询命中唯一索引时退化为记录锁**（不锁间隙）；**没走索引的当前读会锁全表记录**（间隙全锁）——**"UPDATE 必须走索引"不只是性能问题，是锁范围问题。**

## 7.6 死锁：产生、排查、预防

**死锁 = 两个事务互相持有对方想要的锁，互相等待，永远等下去。**

```
经典案例：
时刻1：事务A 执行 UPDATE ... WHERE id=1  → A 锁住行1
时刻2：事务B 执行 UPDATE ... WHERE id=2  → B 锁住行2
时刻3：事务A 执行 UPDATE ... WHERE id=2  → A 等 B 放锁
时刻4：事务B 执行 UPDATE ... WHERE id=1  → B 等 A 放锁
→ 死锁。InnoDB 死锁检测器（默认开启）发现环路 → 回滚代价小的一个

间隙锁版本（更隐蔽）：
事务A：INSERT id=13  → 等待间隙 (12,15) 的锁（被 B 占着）
事务B：INSERT id=14  → 也在等同一间隙 → 死锁
```

**排查命令**（实操加分）：
```sql
SHOW ENGINE INNODB STATUS\G    -- 看 LATEST DETECTED DEADLOCK 段
```

**预防**：
1. 所有事务按**固定顺序**访问数据（都先处理行1再行2 → 不会成环）
2. 事务尽量短小，**别在事务里调外部 API / sleep**
3. 一次锁定需要的所有行；等值条件尽量命中唯一索引（避免间隙锁）

---

# 第八章：性能优化实战

> 优化是一门"先测量、再动手"的科学。核心口诀：**用数据说话，别拍脑袋。**

## 8.1 慢查询优化全流程（面试被问"怎么优化"就按这个答）

```
第 1 步：定位慢查询
  → 开慢查询日志（long_query_time = 1，超过 1 秒的记录下来）
  → 或 APM 监控发现某接口 P95 耗时高

第 2 步：EXPLAIN 分析执行计划
  → type 是不是 ALL（全表扫描）？
  → Extra 有没有 Using filesort / Using temporary？
  → rows 预估行数是否离谱？

第 3 步：对症下药
  → 缺索引 → 加索引（90% 的慢查询止步于此）
  → 索引失效 → 改写法（见 4.4：函数运算改范围、前导 % 换搜索引擎）
  → SELECT * → 只查需要的列（争取覆盖索引）
  → 深分页 → 改游标分页 / 延迟关联

第 4 步：SQL 层面无解 → 架构层面
  → 加 Redis 缓存（读多写少的热点数据）
  → 读写分离（读走从库）
  → 分库分表（最后手段）
```

**答题技巧**：面试时**说出这个分层思路比背十个别技巧更打动面试官**——它体现的是"定位 → 分析 → 分层解决"的工程思维。

## 8.2 慢查询日志与分析工具

```sql
-- 开启慢日志（动态设置，记录超过 1 秒的查询）
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 1;

-- 看日志文件在哪
SHOW VARIABLES LIKE 'slow_query_log_file';
```

```bash
# 分析工具（比肉眼快 100 倍）
mysqldumpslow -s t -t 10 /var/lib/mysql/slow.log
# -s t 按总耗时排序，-t 10 只看前 10 条
```

## 8.3 SQL 优化 10 条军规（逐条讲为什么）

```sql
-- 1. 别 SELECT *，只查需要的列
-- 为什么：① 减少网络传输 ② 有机会命中覆盖索引（见 4.2）③ 加列不炸隐式依赖
SELECT id, name FROM avatars;  -- ✅

-- 2. 深分页改游标分页 / 延迟关联
-- 为什么：OFFSET 100000 要扫 10 万行再丢弃，越翻越慢
SELECT * FROM avatars ORDER BY id LIMIT 10 OFFSET 100000;   -- ❌ 慢

-- 方案 A：游标分页（"加载更多"式交互）
SELECT * FROM avatars WHERE id > 上一页最大id ORDER BY id LIMIT 10;  -- ✅

-- 方案 B：延迟关联（MySQL 特色解法，能跳页）
SELECT a.* FROM avatars a
JOIN (SELECT id FROM avatars ORDER BY id LIMIT 100000, 10) t ON a.id = t.id;
-- 先在索引树里翻页（覆盖索引不回表），只回表最终 10 行

-- 3. 小表驱动大表（JOIN 优化）
-- 思想：外层循环次数越少越好。MySQL 优化器大多会自动调整顺序，
-- 但子查询 IN (...) 的小结果集驱动大表扫描是经典优化

-- 4. 批量操作代替循环单条
-- 为什么：每条 SQL 都有网络往返 + 解析开销，100 次 = 100 倍开销
INSERT INTO t VALUES (...), (...), (...);  -- ✅ 一次搞定

-- 5. COUNT(*) 就行，别 COUNT(列)
-- 为什么：COUNT(列) 要逐行判断 NULL，COUNT(*) 什么都不用判断
-- COUNT(1) 和 COUNT(*) 在 MySQL 里性能等价

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

## 8.4 什么时候优化到头了（量级参考）

| 手段 | 能扛的量级 | 复杂度 |
|------|-----------|--------|
| 加索引/优化 SQL | 百万级 | ⭐ |
| Redis 缓存 | 千万级读 | ⭐⭐ |
| 读写分离（主从） | 读多写少场景 | ⭐⭐⭐ |
| 分库分表 | 亿级 | ⭐⭐⭐⭐⭐（小项目别碰） |

**决策心法**：能靠加索引解决就不上缓存；能靠缓存扛住就不拆主从；能主从扛住就别分库分表。**复杂度是最后手段**——每升一级，运维成本和故障面都翻倍。

---

# 第九章：ORM 与 Prisma

> ORM（Object-Relational Mapping，对象关系映射）= 用写 JS 的方式操作数据库。你写 `prisma.user.findUnique()`，它帮你翻译成 SQL。**但记住：ORM 再好用，SQL 功底不能丢**——ORM 出了性能问题，最后还得靠读 SQL、看 EXPLAIN 来救。

## 9.1 Prisma 工作链路（MySQL 版）

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

**schema 定义长什么样**（对应第 3 章的表设计）：

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Avatar {
  id        Int      @id @default(autoincrement())   // 对应 AUTO_INCREMENT
  userId    Int      @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  baseId    String   @map("base_id")
  parts     Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at") @db.DateTime(3)

  @@index([userId, createdAt])   // 联合索引（第 4 章）
  @@map("avatars")
}
```

## 9.2 常用操作对照（Prisma ↔ SQL ↔ 前端类比）

```typescript
// 查询单条（findUnique：按唯一约束查）
prisma.user.findUnique({ where: { username } })
// → SELECT * FROM users WHERE username = ? LIMIT 1

// 查询多条 + 条件 + 排序 + 分页（列表页标配四件套）
prisma.avatar.findMany({
  where: { userId },                 // WHERE
  orderBy: { createdAt: 'desc' },    // ORDER BY created_at DESC
  take: 10,      // LIMIT
  skip: 20,      // OFFSET
})

// 关联查询（一次 JOIN 拿到关联数据）
prisma.avatar.findMany({ include: { user: true } })

// 创建（拿自增 id 看返回值，Prisma 自动处理，不用 LAST_INSERT_ID）
const user = await prisma.user.create({ data: { username, passwordHash } })
console.log(user.id)   // 自增 id 就在返回值里 ✅

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

## 9.3 N+1 问题（必考）

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
```

**前端类比**：列表页 100 个 item，每个 item 单独发一次请求拿详情 vs 后端一次返回所有数据。谁都知道选后者——但换成后端代码，很多人就无意识地写出循环查询了。

**怎么发现自己写了 N+1**：打开 Prisma 的 query log（`new PrismaClient({ log: ['query'] })`），看一次页面加载打印了多少条 SQL。超过 5 条就要警觉。

## 9.4 连接池

**为什么需要连接池**：建一次 MySQL 连接 = TCP 三次握手 + 认证 + 分配会话内存，耗时几十毫秒。高并发下每个请求都新建连接，MySQL 的 `max_connections`（默认 151）直接被打爆。

**连接池（Connection Pool）的原理**：应用启动时预建 N 条连接放"池子"里，请求来了**借**一条，用完**还**回去——复用连接，免去反复建拆的开销。

```typescript
// Prisma 自带连接池，DATABASE_URL 里配置：
// mysql://user:pass@host:3306/db?connection_limit=10&pool_timeout=20
//                                        ↑ 最多 10 条连接  ↑ 借不到等 20 秒报错
```

**数量怎么定（经验公式）**：`连接数 ≈ (CPU 核数 × 2) + 磁盘数`。**连接不是越多越好**——几千条连接反而互相争抢。Serverless 部署要特别注意：每个实例一个池，实例多了池子总数爆炸，可以用 Prisma Accelerate / ProxySQL 解决（知道有这回事即可）。

---

# 第十章：Redis 缓存

## 10.1 Redis 是什么

```
MySQL：  数据存磁盘，查询毫秒级（ms），容量便宜（TB 级）
Redis：  数据存内存，查询微秒级（μs，快 1000 倍）
         代价：内存贵（GB 级）、宕机可能丢数据（有持久化机制缓解）
```

**定位**：Redis 不是来替代 MySQL 的，而是给它当"贴身保镖"——热点数据放 Redis，扛住 99% 的读请求，数据库只处理冷数据和写请求。

**典型场景**：首页热门内容、用户 session、验证码、排行榜、计数器。

## 10.2 五种数据结构 + 场景（必考）

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

## 10.3 缓存读写策略（Cache Aside，最常用）

Cache Aside（旁路缓存）= 应用代码自己管缓存，数据库为主、缓存为辅：

```
读：先查 Redis → 命中？直接返回 ✅
              → 未命中？查 MySQL → 写入 Redis（设过期时间）→ 返回

写：先更新 MySQL → 再删除 Redis 里对应的 key
                    ↑ 注意是"删除"不是"更新"！
```

**为什么写操作是"删缓存"而不是"更新缓存"**：
1. 更新缓存在并发下容易写乱（A、B 两个写请求，更新缓存的顺序可能和数据相反 → 缓存里是旧值）
2. 很多缓存值是计算出来的（关联多张表），更新一处缓存要算一大圈，删了等下次读时重建，简单且正确
3. 懒加载思想：没人读的数据根本不占缓存

## 10.4 缓存三大问题（必考，背熟）

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

## 10.5 持久化与过期

Redis 数据在内存里，宕机就没了？它有两套持久化机制：

- **RDB**（快照）：定时把整个内存"拍照"存盘（像 `JSON.stringify` 全量存盘）。恢复快，但两次快照之间的数据可能丢
- **AOF**（日志）：把每条写命令追加到日志文件（像操作日志）。重启时重放命令恢复，丢得少但文件大、恢复慢
- 生产一般**两个都开**（AOF 保底 + RDB 加速恢复）

**过期删除策略**：给 key 设了 TTL（如 `SET key val EX 3600`），Redis 怎么删？
- **惰性删除**：访问 key 时检查，过期就删——省 CPU，但没人访问的过期 key 会赖着占内存
- **定期删除**：后台定时随机抽查一批 key，过期的删掉——兜底
- 两者结合，既不浪费 CPU 也不漏垃圾

**内存淘汰（内存满了怎么办）**：`maxmemory` 触顶后按淘汰策略腾地方。最常用 **LRU**（Least Recently Used，淘汰最近最少使用的）——就像你清理手机时先删很久没打开的 App："最近都没人用的，大概率以后也没人用"。

---

# 第十一章：主从复制、运维与权限

## 11.1 主从复制（读写分离）

单机 MySQL 的瓶颈往往先出现在**读**（读请求通常是写的几十倍）。思路：数据复制多份，分摊读流量。

**复制流程：三线程模型（面试必背）**：

```
主库                      从库
┌─────────────┐          ┌──────────────┐
│ 客户端写入   │          │ IO 线程       │──┐
│     ↓      │   binlog  │  ↑ 接收       │  │ 写入
│ binlog dump ├────────→ │  ↓            │  ↓
│ 线程（推送） │          │ 中继日志      │ relay log
└─────────────┘          │     ↓        │  │
                         │ SQL 线程      │──┘ 重放
                         │  ↑ 读 relay   │
                         │  ↓ 更新数据   │
                         └──────────────┘
```

**三步流程**：
1. 主库把变更写入 binlog，binlog dump 线程推送给从库
2. 从库 **IO 线程**接收，写入**中继日志（relay log）**
3. 从库 **SQL 线程**读 relay log，重放执行

**主从延迟的根因（追问率极高）**：
- SQL 线程是**单线程**重放 → 主库并发写入，从库串行回放 → 大事务/写入高峰时越拉越远
- 对策：MySQL 5.7+ 的**并行复制**（MTS，按组提交并行回放）、拆大事务、关键读强制走主库

**复制模式**：
- **异步复制**（默认）：主库提交不等从库 → 主库崩了可能丢最后一点数据
- **半同步**：至少 1 个从库确认收到 binlog 才算提交 → 平衡，金融场景常用
- **组复制（MGR）**：官方高可用方案，基于 Paxos 多数派

**读写分离的注意点**：刚写完马上读从库可能读不到（延迟）→ 关键路径（写后立即读）强制读主库。

**分库分表（知道概念即可，初学别碰）**：垂直拆分（按业务拆库）、水平拆分（按行拆表，如 user_id % 4）。代价：跨库 JOIN 没了、分布式事务、全局 ID 生成。**单表千万级以下、主从+缓存能扛住就别碰**。

## 11.2 运维基础：看现场

**排查卡顿三板斧**：

```sql
-- 1. 看当前连接在干嘛（谁在跑？跑了多久？）
SHOW PROCESSLIST;
-- Command=Query 且 Time 很长的就是嫌疑人
-- 杀掉：KILL <id>;

-- 2. 看死锁/锁等待详情
SHOW ENGINE INNODB STATUS\G
-- 看 LATEST DETECTED DEADLOCK 段

-- 3. 看服务器状态（连接数/缓存命中率等）
SHOW STATUS LIKE 'Threads%';
SHOW STATUS LIKE 'Innodb_buffer_pool_read%';
-- buffer pool 命中率 = 1 - reads/requests，应接近 99%
```

## 11.3 备份与恢复

**没做过恢复的备份等于没备份**——备份了也要定期演练恢复，不然真出事时会发现备份是坏的。

```bash
# 备份（导出整个库为 SQL 文件）
mysqldump -uroot -p learn > backup.sql

# InnoDB 一致性备份的关键参数（面试考点）
mysqldump -uroot -p learn --single-transaction > backup.sql
# --single-transaction：利用 MVCC 快照，备份期间不锁表、数据一致

# 恢复
mysql -uroot -p learn < backup.sql

# 定时备份（crontab 每天凌晨 3 点自动执行）
0 3 * * * mysqldump -uroot -p'xxx' --single-transaction learn > /backup/$(date +\%Y\%m\%d).sql
```

**补充**：备份文件**要存到别的机器**（scp 到备份服务器或对象存储）——服务器整个没了，本机备份也一起火葬。binlog 别删太干净——它支持"按时间点恢复"（全量备份 + 重放之后的 binlog）。

## 11.4 用户权限最小化

**原则：应用用什么账号，就只给它需要的权限，别用 root 跑应用！** 万一代码有 SQL 注入漏洞，攻击者拿到的是 app_user（只能增删改查），而不是 root（能 DROP 整个库）。

```sql
-- 创建应用专用账号，只给 learn 库的 CRUD 权限
CREATE USER 'app_user'@'%' IDENTIFIED BY '强密码';
GRANT SELECT, INSERT, UPDATE, DELETE ON learn.* TO 'app_user'@'%';
-- 不给 DROP、不给 ALTER —— 就算代码被注入，也删不了表、改不了结构
FLUSH PRIVILEGES;
```

这就是"最小权限原则"（Principle of Least Privilege）：**权限刚好够用，多一点也不给**。和前端安全里"别给扩展要多余权限"是同一个思想。

---

# 第十二章：面试题库（45 题）

> 用法：先自己答（说出声），再对照参考答案。**能讲出"为什么"和"举出例子"才算过**——只背结论面试官一追问就露馅。按主题分组，⭐ 越多越高频。

## 基础概念（⭐⭐⭐）

**Q1：数据库三大范式？**
> 1NF 列不可再分；2NF 非主键列完全依赖主键；3NF 无传递依赖。本质：每个事实只存一份、存在它该在的地方。实际开发中遵循范式为主，高并发读场景可适当反范式冗余（代价是更新要同步多处）。

**Q2：CHAR 和 VARCHAR 区别？**
> CHAR 定长（存不满补空格），VARCHAR 变长（按实际长度存）+ 1-2 字节长度前缀。CHAR 查询略快但浪费空间。经验：定短字段（如国家码）可用 CHAR，一般都用 VARCHAR；超长内容用 TEXT。

**Q3：VARCHAR(50) 和 TEXT 的区别？还能给 TEXT 设默认值吗？**
> VARCHAR 限长可设默认值、可全程索引；TEXT 不限长（64KB）、不能设默认值、排序/索引只能用前缀。能用 VARCHAR 尽量 VARCHAR。

**Q4：DATETIME 和 TIMESTAMP 区别？**
> 范围：DATETIME 1000-9999，TIMESTAMP 1970-2038（2038 问题）；时区：DATETIME 存字面时间，TIMESTAMP 存 UTC 自动按连接时区转换；空间：8 字节 vs 4 字节。一般业务用 DATETIME。

**Q5：为什么不用文件存数据，要用数据库？（看似送分，考理解）**
> 文件方案有三大死穴：① 并发写冲突（没有锁和排队机制，互相覆盖）② 查询要全量加载（没有索引）③ 没有事务（多步操作无法保证原子性）。数据库 = 持久化 + 并发控制 + 索引 + 事务的集大成者。

**Q6：DROP、DELETE、TRUNCATE 区别？**

| | DELETE | TRUNCATE | DROP |
|---|---|---|---|
| 删什么 | 行（可带 WHERE） | 全表数据 | 整张表 |
| 能回滚 | ✅ | ❌ | ❌ |
| 速度 | 慢 | 快 | 最快 |
| 自增重置 | 否 | **重置为 1** | 表没了 |

> 一句话：DELETE 撕几页，TRUNCATE 倒空文件夹，DROP 扔掉文件夹。

## MySQL 架构（⭐⭐⭐）

**Q7：InnoDB 和 MyISAM 的区别？**
> 事务/行锁/外键/崩溃恢复 InnoDB 全有，MyISAM 全无；MyISAM 只剩"无 WHERE 的 COUNT(*) 快"（存了总行数，InnoDB 因 MVCC 不同事务看到的行数不同必须现算）。结论：8.0 时代无脑 InnoDB。

**Q8：为什么 InnoDB 表必须有主键？没建会怎样？**
> InnoDB 是聚簇索引组织表，数据挂在主键 B+ 树上。没显式主键 → 找第一个非空唯一索引顶替 → 都没有 → 生成隐藏 row_id（所有无主键表共享同一个计数器，还有全局锁竞争）。**所以永远显式定义主键。**

**Q9：MySQL 一条 SQL 的执行流程？**
> 连接器（认证）→（8.0 已删查询缓存）→ 解析器（语法树）→ 优化器（选索引、定 JOIN 顺序）→ 执行器 → 调 InnoDB 引擎接口取数据。**差异点：8.0 移除了查询缓存**（命中率低、表一写全失效、锁竞争大）。

**Q10：自增主键用完了怎么办？（脑筋急转弯型）**
> BIGINT UNSIGNED 上限约 1844 亿亿，正常业务用不完。真用完：INSERT 报错，要提前归档/分表。考的是你知不知道自增有上限、INT vs BIGINT 的量级（INT 21 亿，BIGINT 天文数字）。

**Q11：自增 id 做主键好还是 UUID？**
> 自增：顺序插入不页分裂、8 字节小，但分布式冲突、可被遍历。UUID：全局唯一，但 36 字节 + 随机插入页分裂。折中：雪花算法（趋势递增 + 全局唯一）。**为什么随机主键页分裂**：B+ 树叶子按主键序排列，随机 id 落点随机，命中满页就分裂。

**Q12：utf8 和 utf8mb4 的区别？**
> MySQL 的 utf8 最多 3 字节（历史残缺实现），存不了 emoji；utf8mb4 才是真 UTF-8（4 字节）。现代项目一律 utf8mb4。加分：隐含坑——两表字符集不同 JOIN 时隐式转换导致索引失效。

## 索引（⭐⭐⭐ 必考区）

**Q13：索引是什么数据结构？为什么用 B+ 树不用二叉树/哈希？**
> B+ 树。相比二叉树：二叉树每节点 2 叉，100 万数据 20 层 = 20 次磁盘 IO；B+ 树每节点存几百 key（16KB 一页），只要 3 层。相比哈希：哈希只能等值查询，不支持范围和排序；B+ 树叶子有双向链表，天然支持范围扫描。加分：B+ vs B 树——数据全在叶子（内部节点更瘦、树更矮）+ 叶子链表（范围查询顺藤摸瓜）。

**Q14：什么是聚簇索引？回表？覆盖索引？**
> 聚簇索引：InnoDB 表=主键 B+ 树，叶子存整行（表即索引），一张表只有一个。回表：二级索引叶子只存主键，查完二级索引还要回聚簇索引查整行（两棵树）。覆盖索引：查询的列全在索引里，免回表——EXPLAIN 显示 Using index。优化：SELECT 只查需要的列 + 配合联合索引。

**Q15：最左前缀原则？**
> 联合索引 (a,b,c) 相当于按 a→b→c 多级排序。查询必须从 a 开始**连续**使用：`WHERE b=1` 跳过 a 用不上；`WHERE a=1 AND c=3` 中 c 也用不上（b 缺位）。类比电话簿按"姓+名"排序，只知道名查不了。设计：等值条件放最左，范围条件放后面。

**Q16：索引失效的场景？**
> ① 列上做函数/运算 ② LIKE 以 % 开头 ③ 违反最左前缀 ④ 隐式类型转换（含字符集不一致）⑤ OR 一侧无索引 ⑥ 不等号 !=/NOT IN ⑦ 区分度低优化器主动放弃。不确定就 EXPLAIN。

**Q17：什么字段适合建索引？索引的缺点？**
> 适合：高频 WHERE/JOIN/ORDER BY 的列、区分度高的列（user_id 而非性别）。缺点：① 占磁盘空间 ② 拖慢写入（每次写都要维护所有索引树）③ 太多优化器可能选错。**按查询建，不是越多越好。**

**Q18：前缀索引是什么？什么时候用？**
> 只索引字符串前 N 个字符（INDEX(email(10))），省空间。代价：用不上覆盖索引和 ORDER BY。N 的选择：`COUNT(DISTINCT LEFT(col,n))/COUNT(*)` 接近 1 的最小 n。

**Q19：什么是索引下推（ICP）？**
> 5.6 引入。联合索引 (a,b) 查 `a LIKE 'x%' AND b=1`：没 ICP 时先回表所有 a 匹配行再服务层过滤 b；有 ICP 时引擎层直接在索引里把 b 也判了，回表次数大减。EXPLAIN 显示 Using index condition。

**Q20：为什么 UPDATE 必须走索引？（锁视角）**
> 当前读的行锁锁的是**索引记录**。WHERE 列没索引 → 锁全部记录（近似锁全表）→ 并发全阻塞 + 死锁高发。性能和锁范围双重原因。

**Q21：EXPLAIN 重点看什么？**
> type（访问级别：至少 range 以上，ALL=全表扫警报）、key（实际用的索引）、rows（预估行数）、Extra（Using index=覆盖索引好；Using filesort=排序没走索引；Using temporary=临时表优先优化）。

## 事务与日志（⭐⭐⭐ 深水区）

**Q22：ACID 及实现原理？**
> 原子性靠 undo log（回滚日志）；持久性靠 redo log（WAL 先写日志再写数据）；隔离性靠锁 + MVCC；一致性是最终目标，由其他三个共同保证。

**Q23：脏读、不可重复读、幻读？隔离级别？**
> 脏读=读到未提交；不可重复读=同事务两次读同一行变了（别人 UPDATE）；幻读=同事务两次同条件查询行数变了（别人 INSERT）。隔离级别：读未提交→读已提交（防脏读）→可重复读（再防不可重复读）→串行化（全防）。**MySQL 默认 RR，PG 默认 RC。**

**Q24：redo log 和 binlog 的区别？**
> ① 层级：redo 在 InnoDB 引擎层，binlog 在服务层（所有引擎都有）② 内容：redo 是物理页修改，binlog 是逻辑变更（ROW 格式记行变更）③ 写法：redo 循环写会覆盖，binlog 追加写 ④ 用途：redo 管崩溃恢复，binlog 管主从复制和按时间点恢复。

**Q25：什么是两阶段提交？为什么需要？**
> 两个独立日志必须一致，否则崩溃恢复后主从不一致。流程：redo prepare → 写 binlog → redo commit。恢复时 prepare 态的事务看 binlog：有则提交，无则回滚。

**Q26：crash-safe 是什么？靠什么保证？**
> 数据库崩溃重启后，已提交的数据不丢、未提交的数据不留。靠 redo log（WAL）+ 两阶段提交。binlog 本身没有 crash-safe 能力（服务层日志，不知道引擎内部状态）。

**Q27：innodb_flush_log_at_trx_commit 的三个值？（生产经验题）**
> 1=每事务刷盘（默认，最安全）；2=写到 OS 缓存每秒刷（MySQL 崩不丢，OS 崩丢 1 秒）；0=每秒刷。金融锁死 1，可容忍秒级丢失的业务可放宽到 2。

**Q28：MySQL 的 MVCC 怎么实现的？（超高频）**
> 三件套：行隐藏列（DB_TRX_ID 事务id + DB_ROLL_PTR 回滚指针）→ undo log 版本链 → ReadView 快照（记录活跃事务列表）。读时沿版本链找第一个对自己可见的版本。RC 每条语句一个 ReadView，RR 事务级一个。

**Q29：快照读和当前读的区别？**
> 快照读=普通 SELECT，读 MVCC 快照不加锁；当前读=FOR UPDATE / FOR SHARE / UPDATE / DELETE，读最新版本并加锁。RR 防幻读是分工的：快照读靠 MVCC，当前读靠间隙锁。

**Q30：什么是间隙锁？为什么 RR 需要？**
> 锁住索引记录之间的间隙，阻止插入。RR 下当前读如果不锁间隙，事务 A 两次范围读之间别人插了行 → 幻读。代价：并发插入被阻塞、死锁增多；等值命中唯一索引时退化为记录锁。

**Q31：乐观锁和悲观锁？**
> 悲观锁：`SELECT ... FOR UPDATE` 先锁再改，适合冲突多（秒杀）。乐观锁：version 字段 + `UPDATE ... WHERE version=旧值`，失败重试，适合读多写少。类比：悲观锁=厕所锁门，乐观锁=Git 提交前 pull。

**Q32：死锁怎么产生和避免？**
> 两个事务互相持有对方需要的锁。避免：① 固定加锁顺序 ② 事务短小、别在事务里调外部 API ③ 一次锁定所有行。InnoDB 死锁检测器自动发现并回滚代价小的一个。排查：`SHOW ENGINE INNODB STATUS`。

## SQL 与优化（⭐⭐⭐）

**Q33：SQL 执行顺序？**
> FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。所以 WHERE 里不能用 SELECT 的别名（执行到 WHERE 时 SELECT 还没跑）；ORDER BY 可以用别名。

**Q34：JOIN 的类型？**
> INNER（交集）、LEFT（左表全留，右表补 NULL）、RIGHT、FULL OUTER（MySQL 没有！要用 LEFT JOIN UNION RIGHT JOIN 模拟）。实战 95% 用 INNER 和 LEFT。LEFT JOIN 后统计用 COUNT(右表.列) 不用 COUNT(*)——NULL 不计入。

**Q35：深分页 LIMIT 100000,10 怎么优化？**
> 方案 A 游标分页：`WHERE id > 上一页最大id ORDER BY id LIMIT 10`（适合"加载更多"，不能跳页）。方案 B 延迟关联（MySQL 特色，能跳页）：`SELECT a.* FROM t a JOIN (SELECT id FROM t ORDER BY id LIMIT 100000,10) tmp ON a.id=tmp.id`——先在覆盖索引里翻页不回表，只回表最终 10 行。

**Q36：慢查询怎么排查？（分层答题法）**
> 第 1 步定位：慢日志（mysqldumpslow 分析）/ SHOW PROCESSLIST。第 2 步分析：EXPLAIN 看执行计划。第 3 步 SQL 层：加索引/改写法避失效/去 SELECT */游标分页。第 4 步架构层：Redis 缓存→读写分离→分库分表。**说出分层思路比背技巧更打动面试官。**

**Q37：线上一条 SQL 突然慢了，之前很快？（追问王）**
> ① 执行计划变了：统计信息过期 → ANALYZE TABLE 重新采样 ② 数据量过了临界点：优化器弃索引改全扫 ③ 系统层面：锁等待（SHOW ENGINE INNODB STATUS）、buffer pool 不够 ④ 缓解：杀会话/强制索引 hint，根治：改 SQL/加索引。

**Q38：COUNT(*)、COUNT(1)、COUNT(列) 区别？**
> COUNT(*) 和 COUNT(1) 等价，统计所有行（含 NULL）；COUNT(列) 忽略该列为 NULL 的行。性能上 COUNT(*)/COUNT(1) 最快（无需判断列值）。

## 场景与架构（⭐⭐）

**Q39：设计一个用户关注关系表？**
```sql
CREATE TABLE follows (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follower_id BIGINT UNSIGNED NOT NULL,   -- 粉丝
  followee_id BIGINT UNSIGNED NOT NULL,   -- 被关注的人
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, followee_id),       -- 防重复关注
  KEY idx_followee (followee_id),          -- 查"谁关注了我"
  KEY idx_follower (follower_id)           -- 查"我关注了谁"
);
```
> 考点：多对多用中间表、联合唯一防重复、**双向查询都要索引**。

**Q40：秒杀库存怎么设计（不超卖）？**
> 核心考点：**检查库存和扣减必须原子**。
> 方案 1（DB 层）：`UPDATE stock SET count = count - 1 WHERE id = x AND count > 0`——单条 UPDATE 同时检查和扣减，行锁保证原子；返回 0 行说明卖完。
> 方案 2（高并发）：Redis 预减库存（DECR 原子，减到负数拒绝）+ 消息队列异步落库。
> 加分：前端按钮置灰、限流是第一道防线。

**Q41：主从复制原理？（超高频）**
> 主库写 binlog → dump 线程推送 → 从库 IO 线程收进 relay log → 从库 SQL 线程重放。延迟根因：SQL 线程单线程串行回放 vs 主库并发写；对策：并行复制（MTS）、拆大事务、关键读走主库。

**Q42：主从延迟怎么处理？**
> ① 写完立即读的场景强制读主库 ② 半同步复制减少丢失 ③ 并行复制提速 ④ 拆大事务（大事务是延迟最大来源）。

**Q43：千万级大表怎么安全删除历史数据？**
> ❌ 一条 DELETE 删千万行：巨事务 + 锁 + binlog 爆炸。✅ 分批删（每批 LIMIT 1000 循环，间隔 sleep）。✅✅ 新表迁移法：INSERT SELECT 保留数据到新表 → RENAME 原子换名 → 删旧表。答出 RENAME 原子性 = 懂 DDL 元数据锁。

**Q44：大表加字段/加索引会锁表吗？**
> 8.0 加列：ALGORITHM=INSTANT 秒级（只改元数据）；加索引：INPLACE（允许并发 DML）5.6+ 支持；危险的是 COPY（复制整表）。答出三档 = 专家感。

**Q45：数据库 CPU 100% 怎么排查？**
> ① SHOW PROCESSLIST 找耗时长的查询 ② EXPLAIN 分析嫌疑 SQL ③ 临时方案：KILL 问题会话 ④ 长期方案：优化 SQL/加索引/上缓存/限流。还是"定位→分析→分层处理"的思路。

## Redis 快问快答（⭐⭐，详解第 10 章）

**Q46：Redis 为什么快？**
> ① 纯内存（微秒级）② 命令执行单线程无锁竞争（6.0 后网络 IO 多线程）③ IO 多路复用（epoll）④ 特化数据结构（跳表/压缩列表）。

**Q47：缓存穿透/击穿/雪崩？**
> 穿透=查不存在的数据（缓存空值/布隆过滤器）；击穿=热点 key 过期瞬间（互斥锁重建）；雪崩=大面积同时失效（过期时间加随机值）。区分：穿透"DB 里也没有"，击穿"单点热点"，雪崩"一大片"。

**Q48：缓存和数据库一致性怎么保证？**
> Cache Aside：先更新 DB，再删除缓存。极端时序仍有小窗口不一致。要求更高用延迟双删或订阅 binlog（canal）。**先承认没有完美方案，再讲权衡，是加分回答。**

---

# 第十三章：实战练习

> **看懂 ≠ 会用**。这一章是全文档的"期末考试"，务必动手。

## 练习 1：SQL 上手（第 1 周）

```sql
-- 先建练习用的表（第 3 章的完整建表语句）
CREATE DATABASE learn DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE learn;

CREATE TABLE users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE avatars (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(100) NOT NULL,
  base_id    VARCHAR(50) NOT NULL DEFAULT 'base1',
  parts      JSON,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_avatars_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_user_created (user_id, created_at)
) ENGINE=InnoDB;

-- ① 插入用户和头像
INSERT INTO users (username, password_hash) VALUES ('xiaoming', 'hash1');
INSERT INTO users (username, password_hash) VALUES ('xiaohong', 'hash2');
INSERT INTO avatars (user_id, name, parts)
VALUES (1, '测试头像1', '{"hat": ["hat-red"]}'), (1, '测试头像2', '{}'), (2, '测试头像3', '{}');

-- ② 练查询（对照第 2 章逐个试）
SELECT id, username, created_at FROM users;
SELECT name, created_at FROM avatars ORDER BY created_at DESC LIMIT 5;
SELECT user_id, COUNT(*) AS cnt FROM avatars GROUP BY user_id HAVING cnt >= 2;
-- 挑战：LEFT JOIN 查"所有用户和头像数，没头像的显示 0"（对照 2.2 易错点）

-- ③ 验证约束的威力
INSERT INTO users (username) VALUES ('xiaoming');   -- 重复用户名 → 报 Duplicate entry
INSERT INTO avatars (user_id, name) VALUES (999, 'x'); -- 外键 → 报 Cannot add or update
UPDATE avatars SET parts = 'not-json' WHERE id = 1;  -- JSON 校验 → 报 Invalid JSON

-- ④ 看表结构和索引
SHOW CREATE TABLE avatars\G   -- 对照第 3 章逐行确认
```

**验收标准**：不看文档能独立写出"分页 + 条件 + 排序 + 聚合"的查询。

## 练习 2：感受索引的威力（第 2 周，强烈推荐）

```sql
-- 造 10 万条数据（MySQL 没有 generate_series，用存储过程）
DELIMITER $$
CREATE PROCEDURE seed()
BEGIN
  DECLARE i INT DEFAULT 0;
  SET autocommit = 0;            -- 关自动提交，批量插入快 10 倍
  WHILE i < 100000 DO
    INSERT INTO avatars (user_id, name, parts)
    VALUES (i % 100, CONCAT('avatar-', i), '{}');
    SET i = i + 1;
  END WHILE;
  COMMIT;
END$$
DELIMITER ;
CALL seed();   -- 几十秒

-- 第 1 轮：删掉索引测试全表扫描
DROP INDEX idx_user_created ON avatars;
EXPLAIN SELECT * FROM avatars WHERE user_id = 1 ORDER BY created_at DESC;
-- 记录：type=ALL，rows=100000，Extra 里有 Using filesort ⚠️

-- 第 2 轮：加回索引再测
ALTER TABLE avatars ADD INDEX idx_user_created (user_id, created_at);
EXPLAIN SELECT * FROM avatars WHERE user_id = 1 ORDER BY created_at DESC;
-- 对比：type=ref，rows≈1000，filesort 消失 ✅

-- 再验证最左前缀（第 4.3 节的结论）
EXPLAIN SELECT * FROM avatars WHERE created_at > '2026-01-01';
-- type=ALL —— 跳过 user_id，索引废了，亲眼确认

-- 收尾：清理测试数据，恢复原状
DELETE FROM avatars WHERE name LIKE 'avatar-%';
```

**亲眼看到 100 倍差距，比背十遍索引原理都管用。**

## 练习 3：亲手验证 MVCC（第 3 周，强烈推荐）

开**两个终端**都连上数据库，模拟并发事务：

```sql
-- ============ 终端 A ============        -- ============ 终端 B ============
-- 确认隔离级别
SELECT @@transaction_isolation;            SELECT @@transaction_isolation;
-- 应显示 REPEATABLE-READ（MySQL 默认）

BEGIN;                                     -- B 先别动
SELECT COUNT(*) FROM avatars;
-- 记住这个数字（比如 5）
                                           BEGIN;
                                           INSERT INTO avatars (user_id, name)
                                             VALUES (1, 'phantom');
                                           COMMIT;   -- B 插入并提交

-- 回到 A：再查一次（同一个事务里）
SELECT COUNT(*) FROM avatars;
-- 还是 5！B 新插的看不到 → 快照读 + MVCC 生效 ✅

-- 但当前读试试：
SELECT COUNT(*) FROM avatars FOR UPDATE;
-- 6！B 插入的出现了 → 当前读读最新版本 ✅

COMMIT;
SELECT COUNT(*) FROM avatars;  -- 事务结束，6（能看到新数据了）
```

**这个练习做完，Q28/Q29/Q30 三道大题你就不是背的了，是亲眼看过。**

## 练习 4：EXPLAIN 分析（第 4 周）

用练习 2 的表，逐个触发并**读懂**这些信号：

```sql
-- 触发 Using filesort
EXPLAIN SELECT * FROM avatars ORDER BY name;
-- name 无索引 → filesort

-- 触发 Using index（覆盖索引）
EXPLAIN SELECT user_id, created_at FROM avatars WHERE user_id = 1;
-- 查的列全在联合索引里 → 不回表

-- 触发 Using temporary
EXPLAIN SELECT name, COUNT(*) FROM avatars GROUP BY name;
-- GROUP BY 的列没索引 → 临时表

-- 触发索引失效（对比 key 列）
EXPLAIN SELECT * FROM avatars WHERE user_id + 1 = 5;    -- 列上运算，key=NULL
EXPLAIN SELECT * FROM avatars WHERE user_id = 5;        -- 正常走索引
EXPLAIN SELECT * FROM avatars WHERE name LIKE '%avatar-1%'; -- 前导%，全表扫
```

**验收标准**：随手写一条 SQL，你能**预判** EXPLAIN 的 type 和 Extra，再跑出来验证。

## 练习 5：模拟面试（第 5-6 周）

从第十二章随机抽 5 道题，**用手机录音**，自己讲出来。讲完听录音，对照三条标准：

- 有没有"呃""那个" → 不熟
- 讲不讲得出"为什么" → 只背了答案没理解
- 能不能举出例子 → 能举例 = 真懂

**重点关照大题**：Q25（两阶段提交）、Q28（MVCC）、Q35（深分页）、Q36（慢查询分层）、Q40（秒杀）、Q41（主从）。讲给朋友/同事听，讲明白 = 你已经超过大部分前端候选人。

---

# 附录 A：术语表

忘了就来查：

| 术语 | 一句话解释 | 详见 |
|------|-----------|------|
| ACID | 事务四特性：原子/一致/隔离/持久 | 5.2 |
| 树/节点/根/叶子 | 层级数据结构（类比 DOM）：节点=元素，根=顶层入口，叶子=最底层不再分叉的节点 | 4.1.1 |
| 二叉树 | 每个节点最多 2 个分叉的树，"瘦高个"，20 层才管百万数据，磁盘 IO 太多 | 4.1.3 |
| B 树 | 平衡多叉树，每个节点都存数据（B 是 Balanced 不是 Binary） | 4.1.6 |
| B+ 树 | 索引的底层数据结构，矮胖多叉树（数据全在叶子+叶子有链表），3 层管百万数据 | 4.1 |
| 页（Page） | InnoDB 磁盘读写的最小单位，16KB，一个节点占一页 | 4.1.4 |
| binlog | 服务层归档日志，主从复制+按时间点恢复 | 6.4 |
| Cache Aside | 最常用缓存策略：读先查缓存，写先更 DB 再删缓存 | 10.3 |
| DDL / DML / DCL | 定义表结构 / 操作数据 / 管权限的三类 SQL | 2 章 |
| redo log | InnoDB 崩溃恢复日志（WAL），循环写 | 6.2 |
| undo log | 回滚日志，记录逻辑反操作，MVCC 的版本链 | 6.3 |
| 二级索引 | 非主键索引，叶子存主键 → 要回表 | 4.2 |
| 脏读 | 读到别人未提交的数据 | 5.3 |
| 覆盖索引 | 查询列全在索引里，免回表 | 4.2 |
| 回表 | 二级索引查到主键后，再回聚簇索引取整行 | 4.2 |
| 聚簇索引 | 叶子节点存整行数据的索引（主键索引），表即索引 | 1.5/4.2 |
| 间隙锁 | 锁住索引记录间的空隙防插入，RR 防幻读的关键 | 7.5 |
| 当前读/快照读 | 读最新版本并加锁 / 读 MVCC 快照不加锁 | 7.3 |
| 连接池 | 预建一批数据库连接反复复用 | 9.4 |
| 乐观锁/悲观锁 | 改时才检查冲突 / 先锁再改 | 7.4 |
| MVCC | 多版本并发控制，读写互不阻塞 | 7.1/7.2 |
| N+1 问题 | 查 1 次列表 + N 次循环查关联 | 9.3 |
| 范式（1/2/3NF） | 列不可分 / 完全依赖主键 / 无传递依赖 | 3.5 |
| 幻读 | 两次同条件查询，行数变了（别人 INSERT） | 5.3 |
| 两阶段提交 | redo prepare → binlog → redo commit，保证两日志一致 | 6.5 |
| ReadView | MVCC 的快照，记录活跃事务列表 | 7.2 |
| WAL | 预写日志：先记日志再改数据，保证持久性 | 6.2 |
| 页分裂 | 随机主键插入命中满页，B+ 树拆页挪数据 | 3.3 |
| 主从复制 | 主库写 binlog，从库重放同步，读分摊到从库 | 11.1 |
| 最左前缀 | 联合索引必须从最左列开始连续使用 | 4.3 |

# 附录 B：报错速查表

新手最常撞见的报错，按"人话翻译 + 怎么办"整理：

| 报错关键词 | 人话翻译 | 怎么办 |
|-----------|---------|--------|
| `Duplicate entry 'xxx' for key 'username'` | 唯一约束冲突：这个值已存在 | 检查是否重复注册/插入；业务上先查再插，或用 ON DUPLICATE KEY UPDATE |
| `Cannot add or update a child row: a foreign key constraint fails` | 外键约束：引用了不存在的 id | 检查 user_id 等关联值是否真实存在；插入顺序对不对 |
| `Unknown column 'xxx' in 'where clause'` | 列名写错了 | 检查拼写；是不是该跑迁移了；别名作用域问题 |
| `Table 'learn.xxx' doesn't exist` | 表名错了 / 表还没建 | `SHOW TABLES` 看看；是不是连错了库（USE learn） |
| `Data too long for column 'name' at row 1` | 超过 VARCHAR 上限 | 应用层做长度校验，或 ALTER MODIFY 改大上限 |
| `Incorrect string value: '\xF0\x9F...'` | 字符集存不下（emoji！） | 列/表/库改 utf8mb4（3.1 的经典坑） |
| `Invalid JSON text` | JSON 列塞了非法 JSON | 检查 JSON 语法；前端 JSON.stringify 了没有 |
| `Deadlock found when trying to get lock` | 死锁，数据库回滚了你 | 按 7.6 检查加锁顺序；重试一次通常就好 |
| `Too many connections` | 连接数爆了 | 检查连接池配置；是否有连接没释放；调 max_connections 治标 |
| `Lock wait timeout exceeded` | 锁等待超时（别人锁太久） | SHOW PROCESSLIST 找持锁事务；优化长事务 |
| `Access denied for user` | 认证失败 / 没权限 | 检查密码、host 白名单（'user'@'%'）；GRANT 授权 |
| `Mixing of collations` | 两表字符集/排序规则不同 | 统一 utf8mb4 + 同一 collation（还会导致索引失效） |
| `Expression #1 of SELECT list is not in GROUP BY` | 违反 ONLY_FULL_GROUP_BY | 非聚合列都加进 GROUP BY，或用 ANY_VALUE() |

# 附录 C：MySQL vs PostgreSQL 对照

面试被问"你更熟哪个 / 为什么选某个"时的参考。**核心心态：承认差异、给出理由、不贬低任何一方。**

| 维度 | MySQL | PostgreSQL |
|------|-------|------------|
| 定位 | 简单可靠、读写快、生态大 | 功能最强、标准最全 |
| 默认引擎/架构 | InnoDB 聚簇索引（表即主键 B+ 树） | 堆表 + 索引指向行位置 |
| JSON | JSON 类型 + 虚拟列绕行建索引 | **JSONB 原生 + GIN 索引，明显更强** |
| 复杂查询 | 较弱（优化器对复杂 JOIN 力不从心） | 强（CTE、窗口函数、并行查询成熟） |
| 默认隔离级别 | RR（+ 间隙锁防幻读） | RC |
| 全文搜索 | 内置可用 | 内置更强，还有 pg_trgm 模糊搜索 |
| 生态 | **国内岗位/DBA/云服务最多** | 云原生时代上升明显 |
| 拿自增 id | LAST_INSERT_ID() | RETURNING 子句（更优雅） |
| 布尔类型 | TINYINT(1) 约定 | 原生 BOOLEAN |
| 大小写 | 默认不区分（_ci collation） | 默认区分（要 ILIKE） |

**三段式回答模板**（被问"为什么你们项目用 PG"）：
> ① "两者都是成熟的关系型数据库，核心 SQL 和事务能力一致，概念可以互相迁移。"
> ② "具体差异上：我们的业务数据有嵌套 JSON，PG 的 JSONB + GIN 索引原生支持，MySQL 要虚拟列绕行；复杂分析查询 PG 的优化器也更强。"
> ③ "但如果团队已有 MySQL 运维经验、或业务是典型的高并发简单读写，MySQL 是更稳妥的选择——**工具服务于场景**。"

# 附录 D：MySQL 常用命令速查

```sql
-- === 元命令 ===
SHOW DATABASES;                    -- 列出所有库
USE learn;                         -- 切库
SHOW TABLES;                       -- 列出表
DESC avatars;                      -- 看表结构
SHOW CREATE TABLE avatars\G        -- 完整建表语句（含索引/字符集/引擎）
SHOW INDEX FROM avatars;           -- 看索引

-- === 状态排查 ===
SHOW PROCESSLIST;                  -- 当前连接在干嘛（杀：KILL <id>）
SHOW ENGINE INNODB STATUS\G        -- 死锁/锁等待详情
SHOW VARIABLES LIKE 'char%';       -- 字符集配置
SELECT @@transaction_isolation;    -- 当前隔离级别
SHOW MASTER STATUS;                -- binlog 位点
SHOW SLAVE STATUS\G                -- 从库状态（看 Seconds_Behind_Master）
SHOW STATUS LIKE 'Threads%';       -- 连接数概况

-- === 性能 ===
EXPLAIN <SQL>;                     -- 执行计划
EXPLAIN ANALYZE <SQL>;             -- 真实执行+耗时（8.0.18+）
ANALYZE TABLE avatars;             -- 重采样统计信息（计划跳变时用）
SET GLOBAL slow_query_log = ON;    -- 开慢日志
SET GLOBAL long_query_time = 1;    -- 阈值 1 秒

-- === 备份恢复（shell 里执行）===
mysqldump -uroot -p learn --single-transaction > backup.sql   -- 一致性备份
mysql -uroot -p learn < backup.sql                            -- 恢复

-- === 权限 ===
CREATE USER 'app'@'%' IDENTIFIED BY 'pwd';
GRANT SELECT, INSERT, UPDATE, DELETE ON learn.* TO 'app'@'%';
FLUSH PRIVILEGES;
```

---

# 附录：一张图总结

```
┌─────────────────────────────────────────────┐
│           MySQL 面试答题优先级                 │
├─────────────────────────────────────────────┤
│ 索引（B+树/回表/最左前缀/失效/EXPLAIN）← 考得最多│
│ 事务（ACID/隔离级别/MVCC/日志）    ← 第二高频   │
│ 锁（间隙锁/乐观悲观/死锁）                     │
│ Redis（三大问题/数据结构）                    │
│ SQL 优化（深分页/慢查询分层）                 │
│ 架构（主从复制/延迟）                          │
│ 场景题（秒杀/大表删数据）      ← 区分度最高    │
└─────────────────────────────────────────────┘

排查问题的万能思路：
现象 → 定位（慢日志/PROCESSLIST/EXPLAIN）→ 分层（SQL层？索引层？架构层？）→ 对症下药

学习循环（贯穿 4-6 周）：
读一章 → 动手练（第十三章）→ 回来重读卡壳处 → 面试前刷题（第十二章）
```

---

*文档版本：v3.0 MySQL 合并完整版 · 自包含（无需配合其他文档）*
*覆盖 MySQL 8.0 · 示例业务：头像换装应用（users / avatars / poster_jobs）*


