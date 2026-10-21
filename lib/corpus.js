/**
 * dsh-pillowtalk —— 语料解析：把一个小说 txt 抽成「风格样本」。
 * 不存全文，只存有代表性的段落（有温度/情感的先挑），供夜间注入用。
 */
import fs from 'node:fs'
import path from 'node:path'

const KEYWORDS = [
  '吻', '耳根', '心跳', '酥', '颤', '喘', '娇', '欲', '情', '爱', '想', '抱', '抚', '痒', '烫',
  '近', '呼吸', '唇', '胸', '腰', '腿', '红', '羞', '呻吟', '悸', '温', '柔', '软', '热', '贴',
  '裸', '睡', '床', '肤', '体', '香', '疼', '紧', '深', '湿',
]

function slug(name) {
  return String(name || '').replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/^-+|-+$/g, '') || 'corpus'
}

/** 优先 utf-8，失败退回 gbk（中文小说常见的两种编码） */
function decode(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    try { return new TextDecoder('gbk').decode(buf) } catch { return buf.toString('utf8') }
  }
}

function score(t) {
  let s = 0
  for (const k of KEYWORDS) if (t.includes(k)) s += 1
  return s
}

/**
 * 把 txt 抽成 { id, title, author, tags, file, totalChars, totalParas, excerpts }
 */
export function importCorpus(filePath, meta = {}) {
  if (!fs.existsSync(filePath)) throw new Error('文件不存在：' + filePath)
  const id = meta.id || slug(path.basename(filePath))
  const text = decode(fs.readFileSync(filePath))
  const paras = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length >= 16 && s.length <= 400)

  const scored = paras.map((t, i) => ({ t, i, s: score(t) }))
  const hot = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 80)
  const cool = scored.filter((x) => x.s === 0).sort((a, b) => (a.i % 37) - (b.i % 37)).slice(0, 20)
  // 按原文顺序排回去，读起来顺
  const pick = [...hot, ...cool].sort((a, b) => a.i - b.i).slice(0, 80)

  return {
    id,
    title: meta.title || id,
    author: meta.author || '',
    tags: Array.isArray(meta.tags) ? meta.tags : (meta.tags ? String(meta.tags).split(/[,，]/).map((s) => s.trim()).filter(Boolean) : []),
    file: path.resolve(filePath),
    importedAt: new Date().toISOString(),
    totalChars: text.length,
    totalParas: paras.length,
    excerpts: pick.map((x) => ({ t: x.t })),
  }
}
