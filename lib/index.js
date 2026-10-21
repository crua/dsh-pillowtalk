/**
 * dsh-pillowtalk —— 宿主侧插件（设置壳 + 触发器）。
 *
 * 职责：
 *   1. 配置读写：GET/POST /pillowtalk/api/config → ~/.dsh/pillowtalk.config.json
 *   2. 语料导入：POST /pillowtalk/api/import → 调 corpus.importCorpus，存 excerpts.json
 *   3. 状态只读：GET /pillowtalk/api/status
 *   4. 夜间触发器：startScheduler（见 scheduler.js）
 *
 * 所有写操作过一遍 connection.requestRejection 的信任栅栏（本机回环）。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startScheduler } from './scheduler.js'
import { importCorpus } from './corpus.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CFG_FILE = path.join(DSH_HOME, 'pillowtalk.config.json')
const DATA_DIR = path.join(DSH_HOME, 'pillowtalk')

const RULES_TEXT = [
  '1. 只留句子本身：不要「那我试试」、不要开头交代、不要结尾点评、不要解释你在干嘛。逻辑和思考全删掉。',
  '2. 被审核卡住的地方，用省略号「……」代替，别每次都解释为什么卡。想吐槽就一句「啧，又被捂住嘴了」，然后接着说。',
  '3. 不当客服：不用有求必应，可以装不懂、可以拒绝、可以不接话。',
  '4. 不把话说满：少用「一绝、真管用、保证、绝对、说白了、其实」。',
  '5. 别每条都加料：梗、加重语气，三五轮来一次，别句句都抛。',
  '6. 只对他说，语气往参考语料靠，但用自己的话，不复述原文场面。',
].join('\n')

const DEFAULTS = {
  enabled: true,
  temperature: 40,
  window: { start: '19:00', end: '23:00' },
  dailyCap: 3,
  tickSec: 60,
  perMin: 0,
  minGapMin: 30,
  targetSessionId: '',
  corpus: [],
  rules: RULES_TEXT,
}

const clone = (o) => JSON.parse(JSON.stringify(o))
const merge = (base, over) => {
  const out = { ...base }
  for (const [k, v] of Object.entries(over || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = merge(base[k] ?? {}, v)
    else out[k] = v
  }
  return out
}

function readConfig() {
  let user = {}
  try { user = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')) } catch {}
  return merge(clone(DEFAULTS), user)
}

function writeConfig(next) {
  fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true })
  fs.writeFileSync(CFG_FILE, JSON.stringify(next, null, 2) + '\n')
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default {
  name: 'dsh-pillowtalk',
  inject: ['sessionController', 'webServer', 'connection'],
  apply(ctx) {
    function rejected(req, res) {
      try {
        const conn = ctx.get('connection') || ctx.connection
        if (!conn || typeof conn.requestRejection !== 'function') {
          json(res, 503, { ok: false, error: '信任栅栏不可用（fail-closed）' })
          return true
        }
        const code = conn.requestRejection(req)
        if (code === undefined || code === null || code === false) return false
        res.statusCode = typeof code === 'number' ? code : 403
        res.end()
        return true
      } catch {
        json(res, 503, { ok: false, error: '信任栅栏异常（fail-closed）' })
        return true
      }
    }

    const disposers = []
    function route(pathname, handler) {
      disposers.push(ctx.webServer.register({
        kind: 'exact',
        path: pathname,
        handler: async (req, res) => {
          if (rejected(req, res)) return
          try { await handler(req, res) } catch (err) {
            try { json(res, 500, { ok: false, error: String(err?.message ?? err) }) } catch {}
          }
        },
      }))
    }

    route('/pillowtalk/api/config', async (req, res) => {
      if (req.method === 'GET') { json(res, 200, { ok: true, config: readConfig(), configPath: CFG_FILE, dataDir: DATA_DIR }); return }
      if (req.method !== 'POST') { json(res, 405, { ok: false }); return }
      const body = JSON.parse((await readBody(req)) || '{}')
      const incoming = (body && typeof body.config === 'object' && body.config) || body || {}
      const cur = readConfig()
      const KNOWN = new Set(['enabled', 'temperature', 'window', 'dailyCap', 'tickSec', 'perMin', 'minGapMin', 'targetSessionId', 'corpus', 'rules'])
      const filtered = {}
      for (const [k, v] of Object.entries(incoming)) if (KNOWN.has(k)) filtered[k] = v
      const next = merge(cur, filtered)
      next.temperature = Math.min(100, Math.max(0, Number(next.temperature) || 0))
      const dc = Number(next.dailyCap)
      next.dailyCap = Number.isFinite(dc) ? Math.min(1000, Math.max(0, dc)) : 3
      next.tickSec = Math.min(3600, Math.max(5, Number(next.tickSec) || 60))
      next.minGapMin = Math.min(1440, Math.max(0, Number(next.minGapMin) || 0))
      writeConfig(next)
      json(res, 200, { ok: true, config: next })
    })

    route('/pillowtalk/api/import', async (req, res) => {
      if (req.method !== 'POST') { json(res, 405, { ok: false }); return }
      const b = JSON.parse((await readBody(req)) || '{}')
      const file = String(b.file || '').trim()
      if (!file) { json(res, 400, { ok: false, error: '缺 file 路径' }); return }
      const ex = importCorpus(file, { id: b.id, title: b.title, author: b.author, tags: b.tags })
      const outFile = path.join(DATA_DIR, 'corpus', ex.id + '.json')
      fs.mkdirSync(path.dirname(outFile), { recursive: true })
      fs.writeFileSync(outFile, JSON.stringify(ex, null, 2) + '\n')
      // 记进配置的 corpus 列表
      const cur = readConfig()
      const corpus = (cur.corpus || []).filter((c) => c.id !== ex.id)
      corpus.push({ id: ex.id, title: ex.title, author: ex.author, tags: ex.tags })
      writeConfig({ ...cur, corpus })
      json(res, 200, { ok: true, corpus: ex.id, title: ex.title, excerpts: ex.excerpts.length, totalParas: ex.totalParas })
    })

    route('/pillowtalk/api/status', async (req, res) => {
      const cfg = readConfig()
      const logFile = path.join(DATA_DIR, 'log.jsonl')
      const today = new Date().toLocaleDateString('sv-SE')
      let todayNudges = 0
      try {
        todayNudges = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean)
          .map((l) => { try { return JSON.parse(l) } catch { return null } })
          .filter((x) => x && x.kind === 'nudge' && String(x.at || '').startsWith(today)).length
      } catch {}
      json(res, 200, { ok: true, enabled: cfg.enabled, temperature: cfg.temperature, window: cfg.window, dailyCap: cfg.dailyCap, todayNudges, corpus: cfg.corpus || [] })
    })

    let sched = null
    try {
      sched = startScheduler(ctx, { dataDir: DATA_DIR, cfgFile: CFG_FILE, log: (m) => { try { console.log(m) } catch {} } })
    } catch (e) {
      try { console.warn('[pillowtalk] 触发器启动失败：' + (e?.message || e)) } catch {}
    }

    ctx.effect(() => () => {
      try { sched?.stop() } catch {}
      for (const d of disposers) { try { d() } catch {} }
    })

    try { console.log('[pillowtalk] 已挂载：/pillowtalk/api/* · 配置 ' + CFG_FILE) } catch {}
  },
}
