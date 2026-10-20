// PM2 进程清单：Web 应用 + 海报 Worker 双进程
//
// 使用方式（服务器上，~/avatar-dressup）：
//   pm2 start ecosystem.config.cjs        # 启动全部
//   pm2 restart ecosystem.config.cjs      # 更新代码后重启全部
//   pm2 logs poster-worker                # 只看 worker 日志
//   pm2 status                            # 查看进程状态
//
// 为什么是 .cjs：package.json 声明了 "type": "module"，
// PM2 加载 CommonJS 配置文件时必须用 .cjs 后缀。

const fs = require('fs')
const path = require('path')

// ── 零依赖 .env 加载（等价 shell 的 set -a && . ./.env）──────────────
// PM2 启动配置时进程未必继承服务器 .env，这里手动解析注入 env，
// 使 DATABASE_URL / POSTER_PROVIDER / JWT_SECRET 等对两个进程都可见。
// 优先级对齐 Next.js 惯例：.env.local 覆盖 .env（.env.local 被 gitignore，
// 服务器上放敏感值；.env 放共享默认值）。
function loadEnv(file) {
  const result = {}
  if (!fs.existsSync(file)) return result
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // 去掉成对的单/双引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

const fileEnv = {
  ...loadEnv(path.join(__dirname, '.env')),
  ...loadEnv(path.join(__dirname, '.env.local')),
}
const NODE_ENV = fileEnv.NODE_ENV || process.env.NODE_ENV || 'production'

module.exports = {
  apps: [
    {
      // ── Web 应用（Next.js）─────────────────────────────
      name: 'avatar-dressup',
      script: 'node_modules/next/dist/bin/next', // 直接用 node 跑，不经过 npx，避免每次解析开销
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV,
        ...fileEnv, // DATABASE_URL / JWT_SECRET / NEXT_PUBLIC_* 等
      },
      max_memory_restart: '512M', // 2核2G 服务器上给 Web 留 512M
      // next start 端口由 PORT 环境变量或 -p 参数控制，默认 3000
    },
    {
      // ── 海报 Worker（异步任务消费者）───────────────────
      name: 'poster-worker',
      // 用 tsx 直接跑 TypeScript 源码，无需预编译步骤；
      // 若后续想去 tsx 依赖，可改用 tsc 产物：node dist/worker/posterWorker.js
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/worker/posterWorker.ts',
      cwd: __dirname,
      env: {
        NODE_ENV,
        ...fileEnv, // DATABASE_URL / POSTER_PROVIDER 等
      },
      max_memory_restart: '512M',
      // worker 是 while(true) 轮询，主流程不会自然退出；
      // 若意外崩溃（如 DB 断连后重连失败），PM2 自动拉起
      autorestart: true,
      max_restarts: 10,
      min_uptime: '30s', // 启动 30 秒内崩溃视为异常启动，配合 max_restarts 避免疯狂重启
      restart_delay: 5000, // 崩溃后等 5 秒再拉起，给 DB/网络恢复时间
    },
  ],
}
