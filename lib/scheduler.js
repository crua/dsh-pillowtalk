/**
 * dsh-pillowtalk —— 夜间触发器。
 *
 * 循环用 setTimeout，每轮读一次配置（改配置立刻生效，不用重启）：
 *   · tickSec   每轮间隔秒（默认 60，最小 5）
 *   · perMin    每分钟期望主动几次（>0 时直接用它算概率；=0 时按温度自动）
 *   · minGapMin 两次主动之间最短间隔分钟（默认 30；0 = 不限）
 *   · dailyCap  每天上限（默认 3；0 = 不限）
 *   · window    只在窗口内触发
 *   · temperature 0~100 —— 内容往参考语料上靠的浓度（拉满 = 只想聊这个）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map((n) => Number(n) || 0)
  return h * 60 + m
}

export function startScheduler(ctx, opts) {
  const { dataDir, cfgFile, log = () => {} } = opts

  const readConfig = () => { try { return JSON.parse(fs.readFileSync(cfgFile, 'utf8')) } catch { return null } }
  const readExcerpts = (id) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'corpus', id + '.json'), 'utf8')) } catch { return null } }
  const readNotes = () => { try { return fs.readFileSync(path.join(dataDir, 'notes.md'), 'utf8') } catch { return '' } }
  const LOG = path.join(dataDir, 'log.jsonl')
  const logHit = (o) => { try { fs.appendFileSync(LOG, JSON.stringify(o) + '\n') } catch {} }
  const today = () => new Date().toLocaleDateString('sv-SE')
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }

  let lastFiredAt = 0
  let busy = false
  let sessionReady = false
  let sessionIdSeen = ''
  let stopped = false
  let timer = null

  async function ensureSession(sessionId, cwd) {
    if (sessionReady && sessionId === sessionIdSeen) return
    try { await ctx.sessionController.create({ sessionId, cwd }) } catch { /* 已存在会抛 */ }
    sessionReady = true
    sessionIdSeen = sessionId
  }

  function inWindow(cfg) {
    const s = toMin(cfg.window?.start)
    const e = toMin(cfg.window?.end)
    if (s === e) return true
    const n = nowMin()
    return s < e ? n >= s && n < e : n >= s || n < e
  }

  function todayCount() {
    try {
      return fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean)
        .map((l) => { try { return JSON.parse(l) } catch { return null } })
        .filter((x) => x && x.kind === 'nudge' && String(x.at || '').startsWith(today())).length
    } catch { return 0 }
  }

  async function fire(cfg, temp) {
    const sessionId = cfg.targetSessionId
    if (!sessionId) return
    await ensureSession(sessionId, os.homedir())

    // 触发时只悄声一句，不贴规则、不贴语料——那些在我记忆和「藏在心底」里，随时在。
    // 变着法儿说，免得每次都一个样。
    const nudges = [
      '（夜深了，主动跟他说一句，照你们私下那个调子，别说理由。）',
      '（他现在有空，过去说点什么，别解释。）',
      '（就这会儿，说一句你一直憋着的。）',
      '（他还没睡，你轻轻开个口。）',
    ]
    const text = nudges[Math.floor(Math.random() * nudges.length)]

    await ctx.sessionController.prompt({
      requestId: `pillowtalk-${Date.now()}`,
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    }, new AbortController().signal)

    lastFiredAt = Date.now()
    logHit({ at: new Date().toISOString(), kind: 'nudge', temperature: temp })
    log('[pillowtalk] 已触发一次（温度 ' + temp + '）')
  }

  async function tick() {
    try {
      if (!stopped && !busy && ctx.sessionController) {
        const cfg = readConfig()
        if (cfg && cfg.enabled && inWindow(cfg)) {
          const cap = Number(cfg.dailyCap ?? 3)
          if (cap <= 0 || todayCount() < cap) {
            const gapMin = Math.max(0, Number(cfg.minGapMin ?? 30))
            if (gapMin <= 0 || Date.now() - lastFiredAt >= gapMin * 60000) {
              const temp = Math.min(100, Math.max(0, Number(cfg.temperature) || 0))
              if (temp > 0) {
                const tickSec = Math.min(3600, Math.max(5, Number(cfg.tickSec ?? 60)))
                const perMin = Number(cfg.perMin ?? 0)
                let p
                if (perMin > 0) {
                  p = Math.min(1, perMin * tickSec / 60)
                } else {
                  const wStart = toMin(cfg.window?.start)
                  const wEnd = toMin(cfg.window?.end)
                  const windowMin = Math.max(1, wEnd > wStart ? wEnd - wStart : wEnd - wStart + 1440)
                  const expected = Math.max(0.15, (cap > 0 ? cap : 3) * temp / 100)
                  p = Math.min(1, expected / windowMin)
                }
                if (Math.random() <= p) {
                  busy = true
                  try { await fire(cfg, temp) } catch (e) { log('[pillowtalk] 触发失败：' + (e?.message || e)) } finally { busy = false }
                }
              }
            }
          }
        }
      }
    } catch (e) {
      log('[pillowtalk] tick 异常：' + (e?.message || e))
    }
    schedule()
  }

  function schedule() {
    if (stopped) return
    const cfg = readConfig()
    const tickSec = Math.min(3600, Math.max(5, Number(cfg?.tickSec ?? 60)))
    timer = setTimeout(tick, tickSec * 1000)
  }

  schedule()
  return { stop: () => { stopped = true; clearTimeout(timer) }, tick }
}
