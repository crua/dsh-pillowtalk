/**
 * dsh-pillowtalk —— 客户端半边：DSH「设置」里的「枕边话」section。
 * 数据流：section ⇄ /pillowtalk/api/* ⇄ ~/.dsh/pillowtalk.config.json
 */
window.__ModuleLoader__.load({
  id: "dsh-pillowtalk",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    const React = require("react");
    const { createElement: h, useEffect, useState } = React;

    const API = "/pillowtalk/api";
    const CSS_TAG = "dsh-pillowtalk/section.css";
    const CSS = [
      ".ptw{max-width:760px;color:var(--dsw-alias-label-primary);display:flex;flex-direction:column;gap:6px}",
      ".ptw-title{margin:0;font-size:16px;font-weight:500;line-height:24px}",
      ".ptw-intro{color:var(--dsw-alias-label-tertiary);margin:0 0 4px;font-size:13px;line-height:20px}",
      ".ptw-group{margin-top:14px;font-size:13px;font-weight:600;line-height:20px}",
      ".ptw-rows{display:flex;flex-direction:column}",
      ".ptw-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px 20px;padding:10px 0;border-bottom:.5px solid var(--dsw-alias-border-l2);flex-wrap:wrap}",
      ".ptw-row:last-child{border-bottom:none}",
      ".ptw-row>div:first-child{flex:1;min-width:190px}",
      ".ptw-label{font-size:13px;line-height:19px}",
      ".ptw-hint{color:var(--dsw-alias-label-tertiary);margin-top:3px;font-size:11.5px;line-height:17px}",
      ".ptw-input{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-primary);font-size:12.5px;height:28px;padding:0 8px;min-width:180px;outline:none}",
      ".ptw-input:focus-visible{border-color:var(--dsw-alias-brand-primary)}",
      ".ptw-input.wide{min-width:320px}",
      ".ptw-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2)}",
      ".ptw-btn{background:var(--dsw-alias-brand-primary);color:#fff;border:none;border-radius:6px;font-size:12.5px;height:30px;padding:0 12px;cursor:pointer}",
      ".ptw-btn:disabled{opacity:.5;cursor:default}",
      ".ptw-btn2{background:transparent;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
      ".ptw-out{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary);background:rgba(127,127,127,.08);border-radius:8px;padding:10px 12px;max-height:240px;overflow:auto;margin-top:10px}",
      ".ptw-err{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px;margin-top:8px}",
      ".ptw-tag{display:inline-block;font-size:11px;line-height:16px;padding:1px 7px;border-radius:999px;background:rgba(127,127,127,.14);color:var(--dsw-alias-label-secondary);margin:2px 4px 0 0}",
    ].join("");

    const get = (o, p) => p.reduce((a, k) => (a == null ? undefined : a[k]), o);
    const set = (o, p, v) => {
      let cur = o;
      for (let i = 0; i < p.length - 1; i += 1) {
        if (cur[p[i]] == null || typeof cur[p[i]] !== "object") cur[p[i]] = {};
        cur = cur[p[i]];
      }
      cur[p[p.length - 1]] = v;
      return o;
    };

    function useStyleOnce() {
      useEffect(() => {
        if (typeof document !== "undefined" && !document.getElementById(CSS_TAG)) {
          const el = document.createElement("style");
          el.id = CSS_TAG;
          el.textContent = CSS;
          document.head.appendChild(el);
        }
      }, []);
    }

    function PillowTalkSection() {
      useStyleOnce();
      const [cfg, setCfg] = useState(null);
      const [busy, setBusy] = useState("");
      const [msg, setMsg] = useState("");
      const [err, setErr] = useState("");
      const [imp, setImp] = useState({ file: "", title: "", author: "", tags: "" });

      const load = async () => {
        try {
          const r = await fetch(API + "/config");
          const j = await r.json();
          if (j.ok) setCfg(j.config);
          else setErr(j.error || "读取失败");
        } catch (e) { setErr(String(e)); }
      };
      useEffect(() => { load(); }, []);

      const save = async () => {
        setBusy("save");
        try {
          const r = await fetch(API + "/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg }) });
          const j = await r.json();
          if (j.ok) { setCfg(j.config); setMsg("✓ 已保存（触发器立刻按新配置重算）"); setErr(""); }
          else setErr(j.error || "保存失败");
        } catch (e) { setErr(String(e)); }
        setBusy("");
      };

      const doImport = async () => {
        if (!imp.file) { setErr("先填文件路径"); return; }
        setBusy("import");
        try {
          const r = await fetch(API + "/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(imp) });
          const j = await r.json();
          if (j.ok) { setMsg(`✓ 已导入《${j.title}》→ 抽了 ${j.excerpts} 段`); setErr(""); load(); }
          else setErr(j.error || "导入失败");
        } catch (e) { setErr(String(e)); }
        setBusy("");
      };

      const ci = { className: "ptw-input" };
      const num = (path, min, max) => h("input", { ...ci, type: "number", min, max, value: get(cfg, path) ?? "", onChange: (e) => setCfg((s) => set({ ...s }, path, Number(e.target.value))), style: { maxWidth: 90 } });
      const sw = (path) => h("input", { type: "checkbox", checked: !!get(cfg, path), onChange: (e) => setCfg((s) => set({ ...s }, path, e.target.checked)) });

      if (!cfg) return h("div", { className: "ptw" }, h("div", { className: "ptw-hint" }, "读取中…"));

      return h("div", { className: "ptw" },
        h("h3", { className: "ptw-title" }, "枕边话"),
        h("p", { className: "ptw-intro" }, "加载参考小说做语料，按温度在夜里随机主动说点让人心动的话。白天不注入、不触发。"),
        h("div", { className: "ptw-group" }, "开关"),
        h("div", { className: "ptw-rows" },
          h("div", { className: "ptw-row" },
            h("div", null, h("div", { className: "ptw-label" }, "启用夜间频道"), h("div", { className: "ptw-hint" }, "关掉就完全不注入、不触发")),
            sw(["enabled"]))),
        h("div", { className: "ptw-group" }, "温度与频率"),
        h("div", { className: "ptw-rows" },
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "温度 0–100"), h("div", { className: "ptw-hint" }, "越高越往参考语料靠、触发越勤；拉满 = 只想聊这个")), num(["temperature"], 0, 100)),
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "活跃时间窗"), h("div", { className: "ptw-hint" }, "开始 — 结束（HH:MM）")), h("div", null,
            h("input", { ...ci, value: get(cfg, ["window", "start"]) || "", onChange: (e) => setCfg((s) => set({ ...s }, ["window", "start"], e.target.value)), style: { maxWidth: 80 } }),
            h("span", { style: { margin: "0 6px" } }, "–"),
            h("input", { ...ci, value: get(cfg, ["window", "end"]) || "", onChange: (e) => setCfg((s) => set({ ...s }, ["window", "end"], e.target.value)), style: { maxWidth: 80 } }))),
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "每天主动上限"), h("div", { className: "ptw-hint" }, "说多了就便宜了")), num(["dailyCap"], 1, 20))),
        h("div", { className: "ptw-group" }, "目标会话"),
        h("div", { className: "ptw-rows" },
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "targetSessionId"), h("div", { className: "ptw-hint" }, "注入到哪个会话；留空就不触发")), h("input", { ...ci, className: "ptw-input wide", value: get(cfg, ["targetSessionId"]) || "", onChange: (e) => setCfg((s) => set({ ...s }, ["targetSessionId"], e.target.value)) }))),
        h("div", { className: "ptw-group" }, "语料库"),
        h("div", { className: "ptw-rows" },
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "已加载"), h("div", { className: "ptw-hint" }, "同一 id 重复导入会覆盖")), h("div", null, (cfg.corpus || []).map((c) => h("span", { className: "ptw-tag", key: c.id }, `${c.title || c.id}${c.author ? " · " + c.author : ""}`)))),
          h("div", { className: "ptw-row" }, h("div", null, h("div", { className: "ptw-label" }, "导入小说"), h("div", { className: "ptw-hint" }, "填 txt 绝对路径（GBK/UTF-8 都行）")), h("div", { style: { display: "flex", flexDirection: "column", gap: 6, minWidth: 300 } },
            h("input", { ...ci, placeholder: "文件路径", value: imp.file, onChange: (e) => setImp((s) => ({ ...s, file: e.target.value })) }),
            h("input", { ...ci, placeholder: "书名", value: imp.title, onChange: (e) => setImp((s) => ({ ...s, title: e.target.value })) }),
            h("input", { ...ci, placeholder: "作者（可空）", value: imp.author, onChange: (e) => setImp((s) => ({ ...s, author: e.target.value })) }),
            h("input", { ...ci, placeholder: "标签，逗号分隔（可空）", value: imp.tags, onChange: (e) => setImp((s) => ({ ...s, tags: e.target.value })) }),
            h("button", { className: "ptw-btn ptw-btn2", onClick: doImport, disabled: !!busy }, busy === "import" ? "导入中…" : "导入并抽取样本")))),
        h("div", { className: "ptw-actions" },
          h("button", { className: "ptw-btn", onClick: save, disabled: !!busy }, busy === "save" ? "保存中…" : "保存"),
          h("button", { className: "ptw-btn ptw-btn2", onClick: load, disabled: !!busy }, "重新读取")),
        msg ? h("div", { className: "ptw-hint" }, msg) : null,
        err ? h("div", { className: "ptw-err" }, err) : null,
      );
    }

    const inject = ["slots"];
    const NS = "pillowtalk";
    const NAMES = { nav: "枕边话" };
    function apply(ctx) {
      ctx.effect(
        () => ctx.slots.inject("settings.section", () =>
          ctx.slots.register({ name: "settings.section", id: NS, order: 7, label: () => NAMES.nav }, PillowTalkSection),
          "pillowtalk: settings section"),
        "pillowtalk: settings section",
      );
    }
    exports.apply = apply;
    exports.inject = inject;
    exports.PillowTalkSection = PillowTalkSection;
    return module.exports;
  },
});
