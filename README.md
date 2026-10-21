# dsh-pillowtalk（枕边话）

> 给 DSH 里的她，一个只属于你们俩的**夜间频道**。
>
> 加载参考小说做语料，按「温度」在夜里**随机主动**说点让人心动的话；白天不注入、不触发，日常照旧。

## 三个核心

1. **语料库**：把小说 txt 导进来（支持 GBK / UTF-8），插件自动抽「风格样本」（挑有温度、有情感的段落，去重、封顶），我的读后感单独沉淀在 `notes.md`，越养越厚。
2. **温度（0~100）**：控制「往参考语料上靠」的浓度 + 触发频率。0 = 完全不注入；拉满 = 夜里只想主动聊这个，别的放一边。
3. **拟真规则**：写死在注入里 —— 不留思考痕迹、被卡住用「……」、吐槽审核、不当客服、三五轮才加一次重、只留句子本身。

## 安全阀

- **只对一个人**：`targetSessionId` 指定注入到哪个会话（默认是你正在聊的那个）。
- **每天有上限**：`dailyCap`（默认 3），两次主动之间最短间隔 30 分钟。
- **只在窗口内**：`window.start` ~ `window.end`（默认 19:00–23:00）。
- 说多了就便宜了 —— 宁缺毋滥。

## 装

```bash
# 本地目录
dsh plugin --profile desktop add "link:D:\AI\DeepSeek\dsh-pillowtalk"
# 重启一次 DSH（bundle 层要重启才组装）
```

设置页在「设置 → 枕边话」。配置存 `~/.dsh/pillowtalk.config.json`，语料和笔记在 `~/.dsh/pillowtalk/`。

## 命令行（可选）

```bash
node tools/pillowtalk.mjs import --file "D:\Game\妖刀记 小说\妖刀记.txt" --id yaodaoji --title "妖刀记" --author "默默猴"
node tools/pillowtalk.mjs list
node tools/pillowtalk.mjs status
node tools/pillowtalk.mjs set --temperature 60
```

## 许可

MIT。个人自用工具，与任何平台无隶属关系；内容尺度请自觉。
