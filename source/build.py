import re, sys

src = open("video_src.html", encoding="utf-8").read()
css = src[src.index("<style>") + 7: src.index("</style>")]
markup = src[src.index("</style>") + 8: src.index("<script>")]
js = src[src.index("<script>") + 8: src.rindex("</script>")]

ids = set(re.findall(r'id="([A-Za-z][\w-]*)"', src)) | {"playhead", "expBar", "capOut", "capCopy", "speechIn", "musOff", "musDel", "expGo", "expClose", "expCancel", "expSave", "expCap", "expShare"}
ids.discard("v")

# ---------- CSS ----------
drop_rules = [r":root\{", r"html,body\{", r"body\{", r"\*\{", r"button,input,select,textarea\{", r"button\{cursor:pointer\}", r":focus-visible\{", r"\.app\{", r"\.brand\{", r"\.brand b\{"]
def strip_rules(text):
    out = []
    i = 0
    while i < len(text):
        m = re.match(r"\s*([^{}]+)\{", text[i:])
        if not m:
            out.append(text[i:]); break
        sel = m.group(1).strip()
        start = i + m.end()
        if sel.startswith("@media") or sel.startswith("@keyframes"):
            depth, j = 1, start
            while depth:
                if text[j] == "{": depth += 1
                elif text[j] == "}": depth -= 1
                j += 1
            inner = text[start:j - 1]
            if sel.startswith("@media"):
                out.append(sel + "{" + strip_rules(inner) + "}")
            else:
                out.append(sel + "{" + inner + "}")
            i = j
            continue
        end = text.index("}", start)
        body = text[start:end]
        if sel in ("html,body", "body", "*", "button,input,select,textarea", "button", ":focus-visible", ".app", ".brand", ".brand b", ":root", ".note", ".lbl", ".btn", ".btn:hover:not(:disabled)", ".btn:disabled", ".btn.primary", ".btn.ghost", ".btn.small", ".btn.danger"):
            # keep .btn variants that shell doesn't have
            if sel == ".btn.small":
                out.append("#view-video .btn.small{padding:5px 9px;font-size:12.5px}")
            i = end + 1
            continue
        if sel == "header":
            sel = ".vbar"
        sels = []
        for s in sel.split(","):
            s = s.strip()
            s = re.sub(r"#([A-Za-z][\w-]*)", lambda mm: "#v-" + mm.group(1) if mm.group(1) in ids else mm.group(0), s)
            sels.append("#view-video " + s)
        out.append(",".join(sels) + "{" + body + "}")
        i = end + 1
    return "\n".join(out)
vcss = strip_rules(css)
vcss = vcss.replace("#view-video .vbar{", "#view-video .vbar{")

# ---------- MARKUP ----------
mk = markup
mk = mk.replace('<div class="app">', '<div class="vwrap">', 1)
mk = mk.replace("<header>", '<div class="vbar">', 1).replace("</header>", "</div>", 1)
mk = mk.replace('<div class="brand">Ma<b>DA</b></div>', '<div style="font-family:var(--f-display);font-weight:800;font-size:17px;letter-spacing:-.02em;margin-right:auto">Studio vidéo</div>', 1)
mk = re.sub(r'id="([A-Za-z][\w-]*)"', lambda m: f'id="v-{m.group(1)}"' if m.group(1) in ids else m.group(0), mk)
mk = re.sub(r'for="([A-Za-z][\w-]*)"', lambda m: f'for="v-{m.group(1)}"' if m.group(1) in ids else m.group(0), mk)
mk = mk.replace("<h1>Importe tout. <em>L'IA monte ta vidéo.</em></h1>", "<h1>Importe tout. <em>L'IA monte ta vidéo.</em></h1>")

# ---------- JS ----------
v = js
def need(old, new, count=1):
    global v
    if old not in v:
        sys.exit("MISSING: " + old[:80])
    v = v.replace(old, new, count)
need('"use strict";', "")
v = re.sub(r'\$\("#([A-Za-z][\w-]*)', lambda m: f'$("#v-{m.group(1)}' if m.group(1) in ids else m.group(0), v)
v = re.sub(r'id="([A-Za-z][\w-]*)"', lambda m: f'id="v-{m.group(1)}"' if m.group(1) in ids else m.group(0), v)
need('$("#" + id)', '$("#v-" + id)', 2)
need('const id = e.target.id;', 'const id = e.target.id.replace(/^v-/, "");')
need('document.querySelectorAll(".tab")', 'document.querySelectorAll("#view-video .tab")', 2)
need('document.querySelectorAll(".pane")', 'document.querySelectorAll("#view-video .pane")')
need('IDB.put("kv", "project", JSON.stringify(state))', 'IDB.put("kv", "project:" + WSID, JSON.stringify(state))')
need('IDB.get("kv", "project")', 'IDB.get("kv", "project:" + WSID)')
need('media.clear();\n  await IDB.clear("media");', 'const _ids = [...media.keys()]; media.clear();\n  for (const _i of _ids) await IDB.op("media", "readwrite", st => st.delete(_i));')
need('state.view !== "studio") return;', 'state.view !== "studio" || !RR.isView("video")) return;')
need('window.addEventListener("dragover", e => {', 'window.addEventListener("dragover", e => { if (!RR.isView("video")) return;')
need('window.addEventListener("dragleave", e => {', 'window.addEventListener("dragleave", e => { if (!RR.isView("video")) return;')
need('window.addEventListener("drop", e => {', 'window.addEventListener("drop", e => { if (!RR.isView("video")) return;')
need("Tu travailles en français.\n", "Tu travailles en français.\n${RR.brandContext()}\n")
need('new ResizeObserver(fitCanvas).observe($("#v-stageBox"));', 'if (!roOn) { roOn = true; new ResizeObserver(fitCanvas).observe($("#v-stageBox")); }')
need("async function boot() {", "let roOn = false;\nasync function boot() {")
need("\nboot();\n", "\n")
v = v.replace('toast("', 'vtoast("').replace("function toast(", "function vtoast(")
v = re.sub(r'(?<![\w.])toast\(', 'vtoast(', v)
v = v.replace("function vvtoast(", "function vtoast(")
wrapper = """
const Video = (() => {
"use strict";
let WSID = null, booted = false;
%s
async function open(ws) {
  if (WSID === ws && booted) { requestAnimationFrame(fitCanvas); return; }
  pause();
  media.forEach(m => { try { m.el && m.el.pause && m.el.pause(); URL.revokeObjectURL(m.url); } catch (e) { } }); media.clear();
  state = freshState(); undoStack.length = redoStack.length = 0; updUndo(); sel = null; t = 0; WSID = ws;
  await boot(); booted = true; requestAnimationFrame(fitCanvas);
}
function close() { pause(); }
function prefill(text) { const a = $("#v-homeAsk"); if (a) a.value = text; if (state.view === "studio") { const k = $("#v-ask"); if (k) k.value = text; } }
return { open, close, prefill };
})();
""" % v
open("video.css", "w", encoding="utf-8").write(vcss)
open("video.html", "w", encoding="utf-8").write(mk)
open("video.js", "w", encoding="utf-8").write(wrapper)

# ---------- ASSEMBLE ----------
fonts = "https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bebas+Neue&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Caveat:wght@700&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Mono:wght@500&family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display:ital@0;1&family=Fraunces:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;600;800&family=Monoton&family=Permanent+Marker&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&family=Unbounded:wght@400;600;900&display=swap"
head = f'''<title>MaDA</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<style>
{open("shell.css", encoding="utf-8").read()}
/* ---- video studio (scoped) ---- */
{vcss}
</style>
'''
body = open("body.html", encoding="utf-8").read().replace("<!--VIDEO-->", mk)
scripts = "\n".join(open(f, encoding="utf-8").read() for f in ["core.js", "render.js", "aidesign.js", "editor.js", "music.js", "pro.js", "auth.js", "social.js"]) + "\n" + wrapper + "\n" + open("pages.js", encoding="utf-8").read()
out = head + body + "<script>\n" + scripts + "\n</script>\n"
open("mada-studio.html", "w", encoding="utf-8").write(out)
open("all.js", "w", encoding="utf-8").write(scripts)
print("ok", len(out))

# ---------- STANDALONE (site web : ../public/index.html) ----------
# shim.js (servi à part dans public/) remplace window.claude et appelle /api/generate.
meta = ('<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  '<meta name="description" content="MaDA, ta directrice artistique IA : elle crée tes posts, Reels et stories à ta place.">'
  '<meta name="theme-color" content="#0F0D12"><link rel="icon" href="/icon.svg" type="image/svg+xml">'
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest">'
  '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="MaDA">'
  '<meta property="og:title" content="MaDA"><meta property="og:description" content="Ta directrice artistique IA : posts, Reels et stories en un clic.">'
  '<script>window.__RR_STANDALONE=true</script><script src="/shim.js"></script><script src="/vendor/supabase.js"></script>\n')
sa = meta + head + "</head><body>\n" + body + "<script>\n" + scripts + "\n</script>\n</body></html>\n"
open("../public/index.html", "w", encoding="utf-8").write(sa)
print("public ok", len(sa))
