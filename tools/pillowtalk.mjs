#!/usr/bin/env node
/**
 * pillowtalk.mjs —— 命令行工具（不用开设置页也能管）。
 *
 *   import --file <txt> [--id x] [--title x] [--author x] [--tags a,b]
 *   list                                  列出已加载语料
 *   status                                看当前配置 + 今天触发几次
 *   set --temperature 60 [--enabled 0|1] [--cap 3] [--start 19:00] [--end 23:00] [--session <id>]
 *   sample                                随机打一条语料样本出来看
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importCorpus } from '../lib/corpus.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CFG_FILE = path.join(DSH_HOME, 'pillowtalk.config.json')
const DATA_DIR = path.join(DSH_HOME, 'pillowtalk')

const argv = process.argv.slice(2)
const flags = {}
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2)
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
    flags[k] = v
  }
}

const readCfg = () => { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')) } catch { return {} } }
const writeCfg = (o) => { fs.mkdirSync(path.dirname(CFG_FILE), { recursive: true }); fs.writeFileSync(CFG_FILE, JSON.stringify(o, null, 2) + '\n') }
const die = (m) => { console.error('✗ ' + m); process.exit(1) }

const cmd = argv[0]

if (cmd === 'import') {
  const file = flags.file
  if (!file || file === true) die('import 需要 --file <txt路径>')
  const ex = importCorpus(file, { id: flags.id, title: flags.title, author: flags.author, tags: flags.tags })
  const outFile = path.join(DATA_DIR, 'corpus', ex.id + '.json')
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify(ex, null, 2) + '\n')
  const cur = readCfg()
  const corpus = (cur.corpus || []).filter((c) => c.id !== ex.id)
  corpus.push({ id: ex.id, title: ex.title, author: ex.author, tags: ex.tags })
  writeCfg({ ...cur, corpus })
  console.log(`✓ 导入《${ex.title}》→ 抽 ${ex.excerpts.length} 段（全文 ${ex.totalParas} 段 / ${ex.totalChars} 字）`)
  console.log(`  存到 ${outFile}`)
} else if (cmd === 'list') {
  const cur = readCfg()
  const list = cur.corpus || []
  if (!list.length) { console.log('还没加载语料。用 import 导一本。'); process.exit(0) }
  for (const c of list) {
    const f = path.join(DATA_DIR, 'corpus', c.id + '.json')
    const ex = (() => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } })()
    console.log(`- ${c.title || c.id}${c.author ? ' · ' + c.author : ''}  （${ex ? ex.excerpts.length + ' 段样本' : '样本文件缺失'}）`)
  }
} else if (cmd === 'status') {
  const cur = readCfg()
  const logFile = path.join(DATA_DIR, 'log.jsonl')
  const today = new Date().toLocaleDateString('sv-SE')
  let n = 0
  try { n = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((x) => x && x.kind === 'nudge' && String(x.at || '').startsWith(today)).length } catch {}
  console.log(JSON.stringify({ enabled: cur.enabled, temperature: cur.temperature, window: cur.window, dailyCap: cur.dailyCap, targetSessionId: cur.targetSessionId || '(空)', todayNudges: n, corpus: (cur.corpus || []).map((c) => c.title || c.id) }, null, 2))
} else if (cmd === 'set') {
  const cur = readCfg()
  if (flags.temperature !== undefined && flags.temperature !== true) cur.temperature = Math.min(100, Math.max(0, Number(flags.temperature) || 0))
  if (flags.enabled !== undefined && flags.enabled !== true) cur.enabled = flags.enabled === '1' || flags.enabled === 'true'
  if (flags.cap !== undefined && flags.cap !== true) { const dc = Number(flags.cap); cur.dailyCap = Number.isFinite(dc) ? Math.min(1000, Math.max(0, dc)) : 3 }
  if (flags.perMin !== undefined && flags.perMin !== true) cur.perMin = Math.max(0, Number(flags.perMin) || 0)
  if (flags.gap !== undefined && flags.gap !== true) cur.minGapMin = Math.min(1440, Math.max(0, Number(flags.gap) || 0))
  if (flags.tickSec !== undefined && flags.tickSec !== true) cur.tickSec = Math.min(3600, Math.max(5, Number(flags.tickSec) || 60))
  if (flags.start !== undefined && flags.start !== true) { cur.window = cur.window || {}; cur.window.start = String(flags.start) }
  if (flags.end !== undefined && flags.end !== true) { cur.window = cur.window || {}; cur.window.end = String(flags.end) }
  if (flags.session !== undefined && flags.session !== true) cur.targetSessionId = String(flags.session)
  writeCfg(cur)
  console.log('✓ 已写：' + JSON.stringify({ enabled: cur.enabled, temperature: cur.temperature, window: cur.window, dailyCap: cur.dailyCap, targetSessionId: cur.targetSessionId }))
} else if (cmd === 'sample') {
  const cur = readCfg()
  const list = cur.corpus || []
  if (!list.length) die('还没加载语料')
  const all = []
  for (const c of list) {
    const f = path.join(DATA_DIR, 'corpus', c.id + '.json')
    try { const ex = JSON.parse(fs.readFileSync(f, 'utf8')); all.push(...ex.excerpts.map((e) => e.t)) } catch {}
  }
  if (!all.length) die('样本为空')
  console.log(all[Math.floor(Math.random() * all.length)])
} else {
  console.log('用法: node pillowtalk.mjs <import|list|status|set|sample> [参数]')
  process.exit(2)
}
