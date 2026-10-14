/* Scrawl editor: tools, selection, history, autosave, files and export.
 * Drawing maths and rendering live in scene.js. Everything is stored in this browser (localStorage).
 */
(() => {
  'use strict'

  const S = window.Scrawl
  const $ = sel => document.querySelector(sel)
  const all = sel => [...document.querySelectorAll(sel)]
  const canvas = $('#canvas')
  const ctx = canvas.getContext('2d')
  const ta = $('#textEditor')
  const bar = $('#ctxbar')
  const pop = $('#pop')

  /* ---------- constants ---------- */

  // Risograph inks: the marker colours in the rail.
  const STROKES = ['#1d1d1b', '#0078bf', '#ff48b0', '#00a95c', '#ff6c2f', '#e3342f']
  const FILLS = ['#ffe14a', '#ffb3dd', '#a6d3f2', '#9fe0bd', '#ffc49e']
  const DEFAULT_STYLE = {
    stroke: '#1d1d1b', markStroke: '#ffe14a', bg: 'transparent', fill: 'offset', width: 2, dash: 'solid',
    rough: 1, round: false, start: 'none', end: 'triangle', font: 'hand', fontSize: 24, align: 'left', opacity: 1, tape: true,
  }
  const KEYS_FOR = {
    rect: ['stroke', 'bg', 'fill', 'width', 'dash', 'rough', 'round', 'opacity'],
    diamond: ['stroke', 'bg', 'fill', 'width', 'dash', 'rough', 'round', 'opacity'],
    ellipse: ['stroke', 'bg', 'fill', 'width', 'dash', 'rough', 'opacity'],
    line: ['stroke', 'width', 'dash', 'rough', 'opacity'],
    arrow: ['stroke', 'width', 'dash', 'rough', 'start', 'end', 'opacity'],
    draw: ['stroke', 'width', 'opacity'],
    mark: ['stroke', 'width', 'opacity'],
    text: ['stroke', 'font', 'fontSize', 'align', 'opacity'],
    image: ['tape', 'opacity'],
  }
  const TOOL_TYPES = ['rect', 'diamond', 'ellipse', 'line', 'arrow', 'draw', 'mark', 'text']
  const TOOL_KEYS = { v: 'select', h: 'hand', r: 'rect', d: 'diamond', o: 'ellipse', a: 'arrow', l: 'line', p: 'draw', m: 'mark', t: 'text', e: 'eraser' }
  const IMAGE_TYPE = /^image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml)$/
  const MAX_IMAGE_SIDE = 2400
  const GRID = 24
  const MIN_ZOOM = 0.1, MAX_ZOOM = 8
  const HISTORY_LIMIT = 150
  const KEY = { index: 'scrawl.index', current: 'scrawl.current', prefs: 'scrawl.prefs.v2', doc: id => `scrawl.doc.${id}` }

  /* ---------- icons (own set, 24px grid) ---------- */

  const ICONS = {
    hand: '<path d="M8.5 12.5V6a1.5 1.5 0 0 1 3 0v5.5M11.5 6V4.5a1.5 1.5 0 0 1 3 0v7M14.5 6.5a1.5 1.5 0 0 1 3 0V12M17.5 9a1.5 1.5 0 0 1 3 0v4.5a7 7 0 0 1-7 7h-.7a6.5 6.5 0 0 1-5.2-2.6l-3.1-4.2a1.6 1.6 0 0 1 2.4-2.1l1.6 1.6"/>',
    select: '<path d="M6 3.5 19 10.7l-5.8 1.6-2.6 5.6z"/><path d="m13.2 12.3 4.3 5.2"/>',
    rect: '<path d="M3.5 6h17M3.5 18h17M5 4.5v15M19 4.5v15"/>',
    diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
    ellipse: '<path d="M19.5 9.5c-1-3.5-5-5.4-9-4.3S4 9.6 4.8 13.4s5 6 9.2 5.2 6.2-4.3 5.5-8.1c-.2-1.2-1.2-2.6-2.4-3.4"/>',
    arrow: '<path d="M4.5 18.5c4-1 9-5 13.5-12.5"/><path d="M12.5 6.5 18 6l.6 5.5z" fill="currentColor"/>',
    line: '<path d="M4.5 18.5 19.5 5.5"/>',
    draw: '<path d="M4 19c2-1 3-4 5-7s3.5-6 6-6c2 0 2.5 2 1 4s-4 5-2.5 6.5S19 16 20 14"/>',
    mark: '<path d="M14.5 4.5l5 5-7 7-5-5zM7.5 11.5l-2 6 1 1 6-2"/><path d="M4 21h8" stroke-width="3"/>',
    text: '<path d="M6 7V5h12v2M12 5v14M9.5 19h5"/>',
    eraser: '<path d="M8.5 19.5 4 15l9.5-9.5a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8l-8 8zM10 19.5h10M8 11.5l5 5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    lockopen: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 6.8-1.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5M12 17.2v.1"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9.5 7V4.5h5V7"/>',
    duplicate: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    toFront: '<path d="M5 4h14M12 20V9M7.5 13.5 12 9l4.5 4.5"/>',
    toBack: '<path d="M5 20h14M12 4v11M7.5 10.5 12 15l4.5-4.5"/>',
    stack: '<path d="M4 8.5 12 4l8 4.5-8 4.5z"/><path d="m4 12.5 8 4.5 8-4.5M4 16.5 12 21l8-4.5"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L6 19"/>',
    grid: '<path stroke-width="3" d="M6 6h.01M12 6h.01M18 6h.01M6 12h.01M12 12h.01M18 12h.01M6 18h.01M12 18h.01M18 18h.01"/>',
    none: '<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5 17.5 6.5"/>',
    fill: '<rect x="7" y="7" width="13" height="13" rx="2" fill="currentColor" opacity=".35" stroke="none"/><rect x="4" y="4" width="13" height="13" rx="2"/>',
    opacity: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 7.5h4.5M12 11.5h6M12 15.5h5"/>',
    w1: '<path d="M4 12h16" stroke-width="1.2"/>',
    w2: '<path d="M4 12h16" stroke-width="2.6"/>',
    w4: '<path d="M4 12h16" stroke-width="4.5"/>',
    solidline: '<path d="M4 12h16"/>',
    dashed: '<path d="M4 12h3.5M10.25 12h3.5M16.5 12H20"/>',
    dotted: '<path stroke-width="2.6" d="M4.5 12h.01M8.25 12h.01M12 12h.01M15.75 12h.01M19.5 12h.01"/>',
    sharp: '<path d="M3 5h16M5 3v16"/>',
    rounded: '<path d="M5 19v-8a6 6 0 0 1 6-6h8"/>',
    headnone: '<path d="M4 12h16"/>',
    headend: '<path d="M4 12h16M14 7l6 5-6 5"/>',
    headtri: '<path d="M4 12h10"/><path d="M13 7.5 20 12l-7 4.5z" fill="currentColor"/>',
    headenddot: '<path d="M4 12h12"/><circle cx="18" cy="12" r="2.5" fill="currentColor"/>',
    headstart: '<path d="M4 12h16M10 7l-6 5 6 5"/>',
    headstarttri: '<path d="M10 12h10"/><path d="M11 7.5 4 12l7 4.5z" fill="currentColor"/>',
    headdot: '<path d="M8 12h12"/><circle cx="5.5" cy="12" r="2.5" fill="currentColor"/>',
    alignl: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    alignc: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    alignr: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    tape: '<path d="M5 8.5 18.5 5l1.5 6L6.5 14.5z" fill="currentColor" opacity=".35"/><path d="M5 8.5 18.5 5l1.5 6L6.5 14.5zM8 14v5.5h11V12"/>',
  }
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`

  for (const el of all('[data-icon]')) {
    const svg = icon(el.dataset.icon)
    if (el.textContent.trim()) el.insertAdjacentHTML('afterbegin', svg)
    else el.innerHTML = svg
    if (!el.title && el.getAttribute('aria-label')) el.title = el.getAttribute('aria-label')
  }

  /* ---------- storage ---------- */

  const store = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } },
    del(k) { try { localStorage.removeItem(k) } catch { /* ignore */ } },
  }

  const prefs = Object.assign({ theme: 'system', grid: false, paper: 'dots' }, store.get(KEY.prefs) || {})
  const style = Object.assign({}, DEFAULT_STYLE, prefs.style || {})
  const savePrefs = () => store.set(KEY.prefs, { theme: prefs.theme, grid: prefs.grid, paper: prefs.paper, style })

  /* ---------- state ---------- */

  let doc = null
  const view = { ox: 0, oy: 0, zoom: 1 }
  let selected = new Set()
  let tool = 'select'
  let locked = false
  let dark = false
  let drag = null
  let editing = null
  let spaceDown = false
  let lastScene = [innerWidth / 2, innerHeight / 2]
  let history = { undo: [], redo: [], last: '[]' }

  const byId = id => doc.elements.find(e => e.id === id)
  const selectedEls = () => doc.elements.filter(e => selected.has(e.id))
  const bump = el => { el.v = Math.random() }
  const toScene = (px, py) => [(px - view.ox) / view.zoom, (py - view.oy) / view.zoom]
  const snap = v => (prefs.grid ? Math.round(v / GRID) * GRID : v)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const isTyping = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  const dialogOpen = () => all('dialog').some(d => d.open)
  const isPhone = () => innerWidth <= 760
  const railWidth = () => (isPhone() ? 0 : 68)
  // The highlighter keeps its own colour, so switching tools doesn't turn the pen yellow.
  const styleKey = (type, key) => (type === 'mark' && key === 'stroke' ? 'markStroke' : key)

  /* ---------- theme and paper ---------- */

  const media = matchMedia('(prefers-color-scheme: dark)')
  function applyTheme() {
    const t = prefs.theme
    if (t === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
    dark = t === 'dark' || (t === 'system' && media.matches)
    for (const b of all('#themeSeg button')) b.classList.toggle('is-on', b.dataset.theme === t)
    for (const b of all('#paperSeg button')) b.classList.toggle('is-on', b.dataset.paper === prefs.paper)
    // Swatches and pens show each colour the way it will look on this paper.
    for (const b of all('.swatch[data-value], .pen')) if (b.dataset.value !== 'transparent') b.style.color = S.ink(b.dataset.value, dark)
    updateContext()
    requestRender()
  }
  media.addEventListener?.('change', applyTheme)

  /* ---------- rendering ---------- */

  let frameQueued = false
  function requestRender() {
    if (frameQueued) return
    frameQueued = true
    requestAnimationFrame(render)
  }

  const selColor = () => (dark ? '#5fb4f0' : '#0078bf')
  const sx = x => x * view.zoom + view.ox
  const sy = y => y * view.zoom + view.oy

  function render() {
    frameQueued = false
    const dpr = window.devicePixelRatio || 1
    const w = innerWidth, h = innerHeight
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = dark ? S.PAPER.dark : S.PAPER.light
    ctx.fillRect(0, 0, w, h)
    drawPaper(w, h)

    const [vx1, vy1] = toScene(0, 0), [vx2, vy2] = toScene(w, h)
    ctx.save()
    ctx.translate(view.ox, view.oy)
    ctx.scale(view.zoom, view.zoom)
    for (const el of doc.elements) {
      if (editing && editing.el === el) continue
      const b = S.bounds(el)
      const pad = 60
      if (b.x > vx2 + pad || b.y > vy2 + pad || b.x + b.w < vx1 - pad || b.y + b.h < vy1 - pad) continue
      if (drag?.mode === 'erase' && drag.hits.has(el.id)) { ctx.globalAlpha = 0.2; S.drawElement(ctx, el, dark); ctx.globalAlpha = 1 }
      else S.drawElement(ctx, el, dark)
    }
    ctx.restore()

    drawSelection()
    $('#emptyNote').hidden = doc.elements.length > 0 || !!editing
    placeContext()
  }

  // Dotted or ruled sketchbook paper, drawn in screen space so it stays crisp at any zoom.
  function drawPaper(w, h) {
    if (prefs.paper === 'plain') return
    let step = GRID * view.zoom
    while (step < 12) step *= 4
    if (prefs.paper === 'ruled') {
      ctx.fillStyle = dark ? 'rgba(95,180,240,.14)' : 'rgba(0,120,191,.13)'
      const rstep = step * 1.5
      const ry0 = ((view.oy % rstep) + rstep) % rstep
      for (let y = ry0; y < h; y += rstep) ctx.fillRect(0, Math.round(y), w, 1)
      return
    }
    const x0 = ((view.ox % step) + step) % step, y0 = ((view.oy % step) + step) % step
    ctx.fillStyle = dark ? 'rgba(238,237,230,.16)' : 'rgba(29,29,27,.2)'
    const r = Math.min(1.4, Math.max(0.8, view.zoom))
    ctx.beginPath()
    for (let x = x0; x < w; x += step) for (let y = y0; y < h; y += step) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2) }
    ctx.fill()
  }

  function drawSelection() {
    const color = selColor()
    ctx.save()
    if (drag?.mode === 'marquee') {
      const x = sx(Math.min(drag.sx, drag.x)), y = sy(Math.min(drag.sy, drag.y))
      const w = Math.abs(drag.x - drag.sx) * view.zoom, h = Math.abs(drag.y - drag.sy) * view.zoom
      ctx.fillStyle = dark ? 'rgba(95,180,240,.10)' : 'rgba(0,120,191,.07)'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.setLineDash([5, 4])
      ctx.strokeRect(x + 0.5, y + 0.5, w, h)
      ctx.setLineDash([])
    }
    const sel = selectedEls()
    if (!sel.length || (drag && ['shape', 'line', 'draw'].includes(drag.mode))) { ctx.restore(); return }
    ctx.strokeStyle = color
    if (sel.length > 1) {
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      for (const el of sel) { const b = S.unionBounds([el]); ctx.strokeRect(sx(b.x) - 4 + 0.5, sy(b.y) - 4 + 0.5, b.w * view.zoom + 8, b.h * view.zoom + 8) }
      ctx.setLineDash([])
    }
    const single = sel.length === 1 ? sel[0] : null
    if (!(single && (single.type === 'line' || single.type === 'arrow'))) {
      const b = S.unionBounds(sel)
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 5])
      ctx.strokeRect(sx(b.x) - 10, sy(b.y) - 10, b.w * view.zoom + 20, b.h * view.zoom + 20)
      ctx.setLineDash([])
    }
    if (!drag || drag.mode === 'resize' || drag.mode === 'point') {
      ctx.fillStyle = color
      for (const hd of handles()) {
        ctx.beginPath()
        if (hd.kind === 'point') ctx.arc(hd.x, hd.y, 6.5, 0, Math.PI * 2)
        else ctx.rect(hd.x - 5, hd.y - 5, 10, 10)
        ctx.fill()
      }
    }
    ctx.restore()
  }

  function handles() {
    const sel = selectedEls()
    if (!sel.length || tool !== 'select' || editing) return []
    if (sel.length === 1 && (sel[0].type === 'line' || sel[0].type === 'arrow')) {
      const el = sel[0]
      return el.points.map((p, i) => ({ kind: 'point', index: i, el, x: sx(el.x + p[0]), y: sy(el.y + p[1]) }))
    }
    const b = S.unionBounds(sel)
    const x1 = sx(b.x) - 10, y1 = sy(b.y) - 10, x2 = sx(b.x + b.w) + 10, y2 = sy(b.y + b.h) + 10
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const textOnly = sel.every(e => e.type === 'text')
    const small = x2 - x1 < 48 || y2 - y1 < 48
    const list = [{ name: 'nw', x: x1, y: y1 }, { name: 'ne', x: x2, y: y1 }, { name: 'se', x: x2, y: y2 }, { name: 'sw', x: x1, y: y2 }]
    if (!textOnly && !small) list.push({ name: 'n', x: mx, y: y1 }, { name: 'e', x: x2, y: my }, { name: 's', x: mx, y: y2 }, { name: 'w', x: x1, y: my })
    return list.map(hd => ({ kind: 'resize', ...hd }))
  }

  function handleAt(px, py) {
    for (const hd of handles()) if (Math.hypot(px - hd.x, py - hd.y) <= 11) return hd
    return null
  }

  function topHit(x, y) {
    const tol = 6 / view.zoom
    for (let i = doc.elements.length - 1; i >= 0; i--) {
      const el = doc.elements[i]
      if (selected.has(el.id) && selected.size === 1 && el.type !== 'line' && el.type !== 'arrow') {
        const b = S.bounds(el)
        if (x >= b.x - tol && x <= b.x + b.w + tol && y >= b.y - tol && y <= b.y + b.h + tol) return el
      }
      if (S.hitTest(el, x, y, tol)) return el
    }
    return null
  }

  /* ---------- history and saving ---------- */

  function resetHistory() {
    history = { undo: [], redo: [], last: JSON.stringify(doc.elements) }
    updateHistoryButtons()
  }

  function commit() {
    const snapStr = JSON.stringify(doc.elements)
    if (snapStr === history.last) return
    history.undo.push(history.last)
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift()
    history.redo = []
    history.last = snapStr
    updateHistoryButtons()
    saveSoon()
  }

  function restore(snapStr) {
    doc.elements = JSON.parse(snapStr).map(S.sanitize).filter(Boolean)
    measureTexts(doc.elements)
    ensureFiles(doc.elements)
    history.last = snapStr
    for (const id of [...selected]) if (!byId(id)) selected.delete(id)
    updateHistoryButtons(); updateContext(); saveSoon(); requestRender()
  }

  function undo() {
    if (editing) commitText()
    if (!history.undo.length) return
    history.redo.push(history.last)
    restore(history.undo.pop())
  }
  function redo() {
    if (!history.redo.length) return
    history.undo.push(history.last)
    restore(history.redo.pop())
  }
  function updateHistoryButtons() {
    $('#undoBtn').disabled = !history.undo.length
    $('#redoBtn').disabled = !history.redo.length
  }

  let saveTimer = 0
  function saveSoon() {
    $('#savedNote').classList.add('is-busy')
    $('#savedNote').textContent = 'Saving…'
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 400)
  }

  function saveNow() {
    clearTimeout(saveTimer)
    if (!doc) return
    const updated = Date.now()
    const ok = store.set(KEY.doc(doc.id), { id: doc.id, name: doc.name, elements: doc.elements, view, updated })
    const index = (store.get(KEY.index) || []).filter(d => d.id !== doc.id)
    index.unshift({ id: doc.id, name: doc.name, updated, count: doc.elements.length })
    store.set(KEY.index, index)
    store.set(KEY.current, doc.id)
    const note = $('#savedNote')
    note.classList.remove('is-busy')
    note.textContent = ok ? 'Saved' : 'Not saved: storage full'
    if (!ok) toast('Browser storage is full. Use Save to file to keep this drawing.')
  }

  /* ---------- documents ---------- */

  const defaultName = () => `Page, ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`

  function loadDoc(id) {
    const raw = store.get(KEY.doc(id))
    if (!raw || !Array.isArray(raw.elements)) return null
    return {
      id: raw.id || id,
      name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.slice(0, 60) : defaultName(),
      elements: raw.elements.map(S.sanitize).filter(Boolean),
      view: raw.view,
    }
  }

  function measureTexts(els) {
    for (const el of els) if (el.type === 'text') { Object.assign(el, S.measureText(el)); bump(el) }
  }

  function openDoc(d) {
    if (editing) commitText()
    doc = { id: d.id, name: d.name, elements: d.elements }
    measureTexts(doc.elements)
    ensureFiles(doc.elements)
    selected = new Set()
    if (d.view && Number.isFinite(d.view.zoom)) Object.assign(view, { ox: d.view.ox, oy: d.view.oy, zoom: clamp(d.view.zoom, MIN_ZOOM, MAX_ZOOM) })
    else Object.assign(view, { ox: 0, oy: 0, zoom: 1 })
    resetHistory()
    renderName()
    updateZoomLabel()
    updateContext()
    store.set(KEY.current, doc.id)
    requestRender()
  }

  function leaveCurrent() {
    if (!doc) return
    if (doc.elements.length) { saveNow(); return }
    store.del(KEY.doc(doc.id))
    store.set(KEY.index, (store.get(KEY.index) || []).filter(d => d.id !== doc.id))
  }

  function newDrawing() {
    if (doc && !doc.elements.length) { toast('This page is already blank'); return }
    leaveCurrent()
    openDoc({ id: S.uid(), name: defaultName(), elements: [] })
    saveNow()
    setTool('select')
    toast('New page')
  }

  function switchTo(id) {
    if (doc && id === doc.id) return
    const d = loadDoc(id)
    if (!d) { toast("That drawing couldn't be opened"); return }
    leaveCurrent()
    openDoc(d)
  }

  async function deleteDrawing(id) {
    const entry = (store.get(KEY.index) || []).find(d => d.id === id)
    const ok = await confirmAction('Delete this drawing?', `“${entry?.name || 'Untitled'}” will be removed from this browser. This can't be undone.`, 'Delete')
    if (!ok) return
    store.del(KEY.doc(id))
    const index = (store.get(KEY.index) || []).filter(d => d.id !== id)
    store.set(KEY.index, index)
    if (doc.id === id) {
      const next = index.map(d => loadDoc(d.id)).find(Boolean)
      openDoc(next || { id: S.uid(), name: defaultName(), elements: [] })
      saveNow()
    }
    renderDrawings()
    collectGarbage()
  }

  function renderName() {
    $('#docName').textContent = doc.name
    document.title = `${doc.name} · Scrawl`
  }

  $('#docName').addEventListener('click', () => {
    $('#docName').hidden = true
    $('#renameForm').hidden = false
    const input = $('#renameInput')
    input.value = doc.name
    input.focus(); input.select()
  })
  function closeRename(save) {
    if ($('#renameForm').hidden) return
    const name = $('#renameInput').value.trim().slice(0, 60)
    if (save && name && name !== doc.name) { doc.name = name; renderName(); saveNow() }
    $('#renameForm').hidden = true
    $('#docName').hidden = false
  }
  $('#renameForm').addEventListener('submit', e => { e.preventDefault(); closeRename(true) })
  $('#renameInput').addEventListener('blur', () => closeRename(true))
  $('#renameInput').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closeRename(false) } })

  /* ---------- pictures (kept in IndexedDB, which has room for photos) ---------- */

  const files = new Map()   // fileId -> { blob, url, img, ready, dataUrl }
  let dbPromise = null
  let warnedNoStore = false

  function openDb() {
    dbPromise = dbPromise || new Promise((resolve, reject) => {
      const req = indexedDB.open('scrawl', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    return dbPromise
  }

  async function fileStore(mode, run) {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode)
      const req = run(tx.objectStore('files'))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  function useBlob(id, blob) {
    const old = files.get(id)
    if (old?.url) URL.revokeObjectURL(old.url)
    const url = URL.createObjectURL(blob)
    const img = new Image()
    const ready = new Promise(res => { img.onload = img.onerror = () => { res(); requestRender() } })
    img.src = url
    files.set(id, { blob, url, img, ready })
  }

  async function saveBlob(id, blob) {
    useBlob(id, blob)
    try { await fileStore('readwrite', st => st.put({ id, blob, created: Date.now() })) }
    catch {
      if (!warnedNoStore) toast('This browser will not keep pictures here. Use Save to file to keep them.')
      warnedNoStore = true
    }
  }

  async function ensureFiles(els) {
    const ids = [...new Set(els.filter(e => e.type === 'image').map(e => e.fileId))].filter(id => !files.has(id))
    for (const id of ids) {
      files.set(id, { missing: true })
      try {
        const rec = await fileStore('readonly', st => st.get(id))
        if (rec?.blob) useBlob(id, rec.blob)
      } catch { /* stays as a placeholder */ }
    }
    if (ids.length) requestRender()
  }

  const blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob) })
  async function dataUrlFor(id) {
    const f = files.get(id)
    if (!f?.blob) return null
    f.dataUrl = f.dataUrl || await blobToDataUrl(f.blob)
    return f.dataUrl
  }
  async function picturesReady(els) {
    await ensureFiles(els)
    await Promise.all(els.filter(e => e.type === 'image').map(e => files.get(e.fileId)?.ready))
  }

  S.setImageSource(id => files.get(id))

  // Forget picture files no drawing uses any more.
  async function collectGarbage() {
    try {
      const used = new Set()
      for (const entry of store.get(KEY.index) || []) {
        const d = entry.id === doc.id ? doc : loadDoc(entry.id)
        for (const el of d?.elements || []) if (el.type === 'image') used.add(el.fileId)
      }
      for (const el of doc.elements) if (el.type === 'image') used.add(el.fileId)
      const keys = await fileStore('readonly', st => st.getAllKeys())
      const stale = (keys || []).filter(k => !used.has(k))
      if (stale.length) await fileStore('readwrite', st => { stale.forEach(k => st.delete(k)); return null })
    } catch { /* nothing to tidy */ }
  }

  const loadImage = url => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url })

  // Shrink very large photos so a drawing stays quick to open and to save.
  async function prepareImage(file) {
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      let w = img.naturalWidth || 480, h = img.naturalHeight || 360
      let blob = file
      const big = Math.max(w, h) > MAX_IMAGE_SIDE || file.size > 3 * 1024 * 1024
      if (big && !/svg|gif/.test(file.type)) {
        const k = Math.min(1, MAX_IMAGE_SIDE / Math.max(w, h))
        w = Math.round(w * k); h = Math.round(h * k)
        const c = document.createElement('canvas')
        c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        const toBlob = type => new Promise(res => c.toBlob(res, type, 0.86))
        blob = await toBlob('image/webp')
        if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
      }
      return { blob, w, h }
    } finally { URL.revokeObjectURL(url) }
  }

  async function addImages(list, x, y) {
    const pics = [...(list || [])].filter(f => IMAGE_TYPE.test(f.type)).slice(0, 20)
    if (!pics.length) return false
    if (editing) commitText()
    const added = []
    let shift = 0
    for (const file of pics) {
      try {
        const { blob, w, h } = await prepareImage(file)
        const id = S.uid(16)
        await saveBlob(id, blob)
        const room = Math.min(520, ((innerWidth - railWidth()) * 0.5) / view.zoom, (innerHeight * 0.55) / view.zoom)
        const k = Math.min(1, room / Math.max(w, h))
        const el = makeEl('image', x - (w * k) / 2 + shift, y - (h * k) / 2 + shift)
        el.w = w * k; el.h = h * k; el.fileId = id
        doc.elements.push(el)
        added.push(el.id)
        shift += 28
      } catch { toast(`Couldn't read ${file.name || 'that picture'}`) }
    }
    if (!added.length) return true
    setTool('select')
    selected = new Set(added)
    commit(); updateContext(); requestRender()
    toast(added.length === 1 ? 'Picture added' : `${added.length} pictures added`)
    return true
  }

  const centre = () => toScene(railWidth() + (innerWidth - railWidth()) / 2, innerHeight / 2)
  $('#imageBtn').addEventListener('click', () => $('#imageFile').click())
  $('#imageFile').addEventListener('change', e => { addImages(e.target.files, ...centre()); e.target.value = '' })

  /* ---------- elements ---------- */

  function makeEl(type, x, y) {
    const el = { id: S.uid(), type, x, y, w: 0, h: 0, seed: S.newSeed(), v: Math.random() }
    for (const k of KEYS_FOR[type]) el[k] = style[styleKey(type, k)]
    if (type === 'line' || type === 'arrow') el.points = [[0, 0], [0, 0]]
    if (type === 'draw' || type === 'mark') el.points = [[0, 0]]
    if (type === 'text') { el.text = ''; el.w = 1; el.h = el.fontSize * S.LINE_HEIGHT }
    return el
  }

  function normalize(el) {
    if (el.points) return
    if (el.w < 0) { el.x += el.w; el.w = -el.w }
    if (el.h < 0) { el.y += el.h; el.h = -el.h }
  }

  function removeIds(ids) {
    doc.elements = doc.elements.filter(e => !ids.has(e.id))
    for (const id of ids) selected.delete(id)
  }

  function deleteSelected() {
    if (!selected.size) return
    removeIds(new Set(selected))
    commit(); updateContext(); requestRender()
  }

  function cloneEls(els, dx, dy) {
    return els.map(el => {
      const c = JSON.parse(JSON.stringify(el))
      c.id = S.uid(); c.x += dx; c.y += dy; c.v = Math.random()
      return c
    })
  }

  function duplicate() {
    const sel = selectedEls()
    if (!sel.length) return
    const copies = cloneEls(sel, 20, 20)
    doc.elements.push(...copies)
    selected = new Set(copies.map(c => c.id))
    commit(); updateContext(); requestRender()
  }

  function reorder(kind) {
    const els = doc.elements
    if (!selected.size) return
    const isSel = e => selected.has(e.id)
    if (kind === 'front') doc.elements = [...els.filter(e => !isSel(e)), ...els.filter(isSel)]
    else if (kind === 'back') doc.elements = [...els.filter(isSel), ...els.filter(e => !isSel(e))]
    else if (kind === 'forward') { for (let i = els.length - 2; i >= 0; i--) if (isSel(els[i]) && !isSel(els[i + 1])) [els[i], els[i + 1]] = [els[i + 1], els[i]] }
    else if (kind === 'backward') { for (let i = 1; i < els.length; i++) if (isSel(els[i]) && !isSel(els[i - 1])) [els[i], els[i - 1]] = [els[i - 1], els[i]] }
    commit(); requestRender()
  }

  function selectAll() {
    if (editing) return
    setTool('select')
    selected = new Set(doc.elements.map(e => e.id))
    updateContext(); requestRender()
  }

  function nudge(dx, dy) {
    for (const el of selectedEls()) { el.x += dx; el.y += dy; bump(el) }
    commit(); requestRender()
  }

  /* ---------- tools ---------- */

  function setTool(t) {
    if (editing && t !== 'text') commitText()
    tool = t
    document.body.dataset.tool = t
    for (const b of all('.tool[data-tool]')) {
      const on = b.dataset.tool === t
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-pressed', String(on))
    }
    if (t !== 'select') selected.clear()
    canvas.style.cursor = ''
    closePop()
    updateContext()
    requestRender()
  }

  function toggleLock() {
    locked = !locked
    const b = $('#lockBtn')
    b.setAttribute('aria-pressed', String(locked))
    b.innerHTML = icon(locked ? 'lock' : 'lockopen')
    toast(locked ? 'Tool stays on after each drawing' : 'Back to select after each drawing')
  }

  for (const b of all('.tool[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool))
  $('#lockBtn').addEventListener('click', toggleLock)

  // Marker pens in the rail: one tap sets the colour for whatever you're drawing or have selected.
  function buildPens() {
    const box = $('#pens')
    STROKES.forEach((c, i) => {
      const b = document.createElement('button')
      b.type = 'button'; b.className = 'pen'; b.dataset.value = c
      b.setAttribute('aria-label', `Marker colour ${i + 1}`)
      b.title = `Colour ${i + 1}`
      b.addEventListener('click', () => setStyle('stroke', c))
      box.append(b)
    })
  }

  /* ---------- pointer input ---------- */

  const pointers = new Map()
  let pinch = null

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pinch = null; if (drag) cancelDrag() })

  function onDown(e) {
    // Stop the browser's own mouse-down from moving focus to the page (it would close a fresh text box).
    e.preventDefault()
    if (document.activeElement && document.activeElement !== ta && document.activeElement !== document.body) document.activeElement.blur()
    closeMenu()
    closePop()
    closeRename(true)
    if (e.pointerType === 'touch') pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.size === 2) { cancelDrag(); startPinch(); return }
    if (pointers.size > 2) return
    if (editing) { commitText(); if (tool === 'text') return }
    canvas.setPointerCapture(e.pointerId)
    const [x, y] = toScene(e.clientX, e.clientY)
    lastScene = [x, y]

    if (e.button === 1 || spaceDown || tool === 'hand') {
      drag = { mode: 'pan', px: e.clientX, py: e.clientY, ox: view.ox, oy: view.oy }
      document.body.classList.add('is-panning')
      e.preventDefault()
      requestRender()
      return
    }
    if (e.button !== 0) return

    if (tool === 'select') return selectDown(e, x, y)
    if (tool === 'eraser') { drag = { mode: 'erase', hits: new Set(), last: [x, y] }; eraseAt(x, y); requestRender(); return }
    if (tool === 'text') {
      const hit = topHit(x, y)
      if (hit?.type === 'text') editText(hit)
      else createText(x, y - style.fontSize * 0.6)
      return
    }
    const free = tool === 'draw' || tool === 'mark'
    const el = makeEl(tool, free ? x : snap(x), free ? y : snap(y))
    doc.elements.push(el)
    selected.clear()
    drag = { mode: free ? 'draw' : tool === 'line' || tool === 'arrow' ? 'line' : 'shape', el, sx: el.x, sy: el.y }
    requestRender()
  }

  function selectDown(e, x, y) {
    const hd = handleAt(e.clientX, e.clientY)
    if (hd) {
      drag = hd.kind === 'point'
        ? { mode: 'point', el: hd.el, index: hd.index }
        : { mode: 'resize', handle: hd.name, ob: S.unionBounds(selectedEls()), originals: selectedEls().map(o => JSON.parse(JSON.stringify(o))) }
      requestRender()
      return
    }
    const el = topHit(x, y)
    if (el) {
      if (e.shiftKey) {
        if (selected.has(el.id)) { selected.delete(el.id); updateContext(); requestRender(); return }
        selected.add(el.id)
      } else if (!selected.has(el.id)) {
        selected = new Set([el.id])
      }
      if (e.altKey) {
        const copies = cloneEls(selectedEls(), 0, 0)
        doc.elements.push(...copies)
        selected = new Set(copies.map(c => c.id))
      }
      drag = { mode: 'move', sx: x, sy: y, ob: S.unionBounds(selectedEls()), originals: selectedEls().map(o => ({ id: o.id, x: o.x, y: o.y })), moved: false }
    } else {
      if (!e.shiftKey) selected.clear()
      drag = { mode: 'marquee', sx: x, sy: y, x, y, base: new Set(selected) }
    }
    updateContext()
    requestRender()
  }

  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && pointers.size === 2) { pinchMove(); return }
    const [x, y] = toScene(e.clientX, e.clientY)
    lastScene = [x, y]
    if (!drag) { hoverCursor(e, x, y); return }

    switch (drag.mode) {
      case 'pan':
        view.ox = drag.ox + (e.clientX - drag.px)
        view.oy = drag.oy + (e.clientY - drag.py)
        break
      case 'shape': {
        const el = drag.el
        let dx = snap(x) - drag.sx, dy = snap(y) - drag.sy
        if (e.shiftKey) { const s = Math.max(Math.abs(dx), Math.abs(dy)); dx = Math.sign(dx || 1) * s; dy = Math.sign(dy || 1) * s }
        el.x = dx < 0 ? drag.sx + dx : drag.sx
        el.y = dy < 0 ? drag.sy + dy : drag.sy
        el.w = Math.abs(dx); el.h = Math.abs(dy)
        bump(el)
        break
      }
      case 'line': {
        const el = drag.el
        let dx = snap(x) - el.x, dy = snap(y) - el.y
        if (e.shiftKey) [dx, dy] = snapAngle(dx, dy)
        el.points[1] = [dx, dy]
        bump(el)
        break
      }
      case 'draw': {
        const el = drag.el
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : []
        for (const ev of events.length ? events : [e]) {
          const [px, py] = toScene(ev.clientX, ev.clientY)
          const last = el.points[el.points.length - 1]
          const rx = px - el.x
          const ry = el.type === 'mark' && e.shiftKey ? el.points[0][1] : py - el.y
          if (Math.hypot(rx - last[0], ry - last[1]) * view.zoom >= 1.5) el.points.push([rx, ry])
        }
        bump(el)
        break
      }
      case 'move': {
        let dx = x - drag.sx, dy = y - drag.sy
        if (prefs.grid) { dx = snap(drag.ob.x + dx) - drag.ob.x; dy = snap(drag.ob.y + dy) - drag.ob.y }
        if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0 }
        for (const o of drag.originals) { const el = byId(o.id); if (el) { el.x = o.x + dx; el.y = o.y + dy; bump(el) } }
        drag.moved = drag.moved || Math.hypot(dx, dy) > 0
        break
      }
      case 'resize':
        resizeSelection(snap(x), snap(y), e.shiftKey)
        break
      case 'point':
        movePoint(drag.el, drag.index, snap(x), snap(y), e.shiftKey)
        break
      case 'marquee': {
        drag.x = x; drag.y = y
        const x1 = Math.min(drag.sx, x), y1 = Math.min(drag.sy, y), x2 = Math.max(drag.sx, x), y2 = Math.max(drag.sy, y)
        selected = new Set(drag.base)
        for (const el of doc.elements) {
          const b = S.bounds(el)
          if (b.x >= x1 && b.y >= y1 && b.x + b.w <= x2 && b.y + b.h <= y2) selected.add(el.id)
        }
        break
      }
      case 'erase': {
        const [lx, ly] = drag.last
        const steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / (6 / view.zoom)))
        for (let i = 1; i <= steps; i++) eraseAt(lx + ((x - lx) * i) / steps, ly + ((y - ly) * i) / steps)
        drag.last = [x, y]
        break
      }
    }
    requestRender()
  }

  function onUp(e) {
    pointers.delete(e.pointerId)
    if (pinch) { if (pointers.size < 2) { pinch = null; saveSoon() } return }
    if (!drag) return
    const d = drag
    drag = null
    document.body.classList.remove('is-panning')
    switch (d.mode) {
      case 'pan':
        saveSoon()
        break
      case 'shape':
        if (d.el.w < 3 && d.el.h < 3) removeIds(new Set([d.el.id]))
        else finishCreate(d.el)
        break
      case 'line': {
        const [dx, dy] = d.el.points[1]
        if (Math.hypot(dx, dy) < 3) removeIds(new Set([d.el.id]))
        else finishCreate(d.el)
        break
      }
      case 'draw':
        commit()
        break
      case 'move':
        if (d.moved) commit()
        break
      case 'resize':
      case 'point':
        selectedEls().forEach(normalize)
        commit()
        break
      case 'erase':
        if (d.hits.size) { removeIds(d.hits); commit() }
        break
    }
    updateContext()
    requestRender()
  }

  function finishCreate(el) {
    normalize(el)
    if (!locked) { setTool('select'); selected = new Set([el.id]) }
    commit()
  }

  function cancelDrag() {
    if (!drag) return
    drag = null
    document.body.classList.remove('is-panning')
    restore(history.last)
  }

  function hoverCursor(e, x, y) {
    if (tool !== 'select' || e.pointerType !== 'mouse' || spaceDown) { canvas.style.cursor = ''; return }
    const hd = handleAt(e.clientX, e.clientY)
    if (hd) {
      canvas.style.cursor = hd.kind === 'point' ? 'move' : { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' }[hd.name]
      return
    }
    canvas.style.cursor = topHit(x, y) ? 'move' : ''
  }

  function snapAngle(dx, dy) {
    const len = Math.hypot(dx, dy)
    const step = Math.PI / 12
    const a = Math.round(Math.atan2(dy, dx) / step) * step
    return [Math.cos(a) * len, Math.sin(a) * len]
  }

  function movePoint(el, index, x, y, shift) {
    const abs = el.points.map(p => [el.x + p[0], el.y + p[1]])
    if (shift && abs.length === 2) {
      const other = abs[1 - index]
      const [dx, dy] = snapAngle(x - other[0], y - other[1])
      x = other[0] + dx; y = other[1] + dy
    }
    abs[index] = [x, y]
    el.x = abs[0][0]; el.y = abs[0][1]
    el.points = abs.map(p => [p[0] - el.x, p[1] - el.y])
    bump(el)
  }

  function resizeSelection(x, y, shift) {
    const { ob, originals, handle } = drag
    let x1 = ob.x, y1 = ob.y, x2 = ob.x + ob.w, y2 = ob.y + ob.h
    if (handle.includes('w')) x1 = x
    if (handle.includes('e')) x2 = x
    if (handle.includes('n')) y1 = y
    if (handle.includes('s')) y2 = y
    const keepShape = originals.every(o => o.type === 'text' || o.type === 'image')
    if ((shift || keepShape) && ob.w && ob.h) {
      if (handle.length === 2) {
        let fx = (x2 - x1) / ob.w, fy = (y2 - y1) / ob.h
        const s = Math.max(Math.abs(fx), Math.abs(fy))
        fx = Math.sign(fx || 1) * s; fy = Math.sign(fy || 1) * s
        if (handle.includes('w')) x1 = x2 - ob.w * fx; else x2 = x1 + ob.w * fx
        if (handle.includes('n')) y1 = y2 - ob.h * fy; else y2 = y1 + ob.h * fy
      } else if (handle === 'e' || handle === 'w') {
        const nh = ob.h * Math.abs((x2 - x1) / ob.w); y1 = ob.y + ob.h / 2 - nh / 2; y2 = y1 + nh
      } else {
        const nw = ob.w * Math.abs((y2 - y1) / ob.h); x1 = ob.x + ob.w / 2 - nw / 2; x2 = x1 + nw
      }
    }
    const fx = ob.w ? (x2 - x1) / ob.w : 1
    const fy = ob.h ? (y2 - y1) / ob.h : 1
    for (const o of originals) {
      const el = byId(o.id)
      if (!el) continue
      if (el.points) {
        el.x = x1 + (o.x - ob.x) * fx
        el.y = y1 + (o.y - ob.y) * fy
        el.points = o.points.map(([px, py]) => [px * fx, py * fy])
      } else if (el.type === 'text') {
        const f = Math.max(0.05, handle.length === 2 ? Math.min(Math.abs(fx), Math.abs(fy)) : handle === 'e' || handle === 'w' ? Math.abs(fx) : Math.abs(fy))
        el.fontSize = Math.max(4, Math.round(o.fontSize * f * 10) / 10)
        Object.assign(el, S.measureText(el))
        const nx1 = x1 + (o.x - ob.x) * fx, nx2 = x1 + (o.x + o.w - ob.x) * fx
        const ny1 = y1 + (o.y - ob.y) * fy, ny2 = y1 + (o.y + o.h - ob.y) * fy
        el.x = (nx1 + nx2) / 2 - el.w / 2
        el.y = (ny1 + ny2) / 2 - el.h / 2
      } else {
        el.x = x1 + (o.x - ob.x) * fx
        el.y = y1 + (o.y - ob.y) * fy
        el.w = o.w * fx
        el.h = o.h * fy
      }
      bump(el)
    }
  }

  function eraseAt(x, y) {
    for (const el of doc.elements) if (S.hitTest(el, x, y, 8 / view.zoom)) drag.hits.add(el.id)
  }

  /* Two-finger pinch to zoom and pan on touch screens. */
  function startPinch() {
    const [a, b] = [...pointers.values()]
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, zoom: view.zoom, ox: view.ox, oy: view.oy }
  }
  function pinchMove() {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1
    const z = clamp(pinch.zoom * (d / pinch.d), MIN_ZOOM, MAX_ZOOM)
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
    const scX = (pinch.mx - pinch.ox) / pinch.zoom, scY = (pinch.my - pinch.oy) / pinch.zoom
    view.zoom = z
    view.ox = mx - scX * z
    view.oy = my - scY * z
    updateZoomLabel()
    requestRender()
  }

  canvas.addEventListener('wheel', e => {
    e.preventDefault()
    closePop()
    if (e.ctrlKey || e.metaKey) {
      setZoom(view.zoom * Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0085)), e.clientX, e.clientY)
    } else {
      const k = e.deltaMode === 1 ? 16 : 1
      view.ox -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k
      view.oy -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k
      saveSoon()
      requestRender()
    }
  }, { passive: false })

  canvas.addEventListener('dblclick', e => {
    if (tool !== 'select') return
    const [x, y] = toScene(e.clientX, e.clientY)
    const hit = topHit(x, y)
    if (hit?.type === 'text') return editText(hit)
    if (hit && S.SHAPES.includes(hit.type)) {
      const b = S.bounds(hit)
      return createText(b.x + b.w / 2, b.y + b.h / 2 - (style.fontSize * S.LINE_HEIGHT) / 2, { center: true })
    }
    createText(x, y - style.fontSize * 0.6)
  })

  /* ---------- zoom ---------- */

  function setZoom(z, cx = railWidth() + (innerWidth - railWidth()) / 2, cy = innerHeight / 2) {
    z = clamp(z, MIN_ZOOM, MAX_ZOOM)
    view.ox = cx - (cx - view.ox) * (z / view.zoom)
    view.oy = cy - (cy - view.oy) * (z / view.zoom)
    view.zoom = z
    updateZoomLabel()
    if (editing) layoutEditor()
    saveSoon()
    requestRender()
  }

  function zoomToFit() {
    const b = S.unionBounds(doc.elements)
    if (!b) { Object.assign(view, { ox: 0, oy: 0, zoom: 1 }); updateZoomLabel(); requestRender(); return }
    const pad = isPhone() ? 36 : 110, left = railWidth()
    const z = clamp(Math.min((innerWidth - left - pad * 2) / (b.w || 1), (innerHeight - pad * 2) / (b.h || 1), 2), MIN_ZOOM, MAX_ZOOM)
    view.zoom = z
    view.ox = left + (innerWidth - left) / 2 - (b.x + b.w / 2) * z
    view.oy = (innerHeight - (isPhone() ? 64 : 0)) / 2 - (b.y + b.h / 2) * z
    updateZoomLabel(); saveSoon(); requestRender()
  }

  const updateZoomLabel = () => { $('#zoomReset').textContent = `${Math.round(view.zoom * 100)}%` }
  $('#zoomIn').addEventListener('click', () => setZoom(view.zoom * 1.2))
  $('#zoomOut').addEventListener('click', () => setZoom(view.zoom / 1.2))
  $('#zoomReset').addEventListener('click', () => setZoom(1))
  $('#fitBtn').addEventListener('click', zoomToFit)
  $('#undoBtn').addEventListener('click', undo)
  $('#redoBtn').addEventListener('click', redo)

  /* ---------- text ---------- */

  function createText(x, y, opts = {}) {
    const el = makeEl('text', x, y)
    if (opts.center) el.align = 'center'
    doc.elements.push(el)
    openEditor(el, true, opts.center ? x : null)
  }

  function editText(el) {
    const b = S.bounds(el)
    openEditor(el, false, el.align === 'center' ? b.x + b.w / 2 : null)
  }

  function openEditor(el, isNew, cx) {
    editing = { el, isNew, cx }
    selected.clear()
    ta.value = el.text
    ta.hidden = false
    layoutEditor()
    ta.focus()
    if (!isNew) ta.setSelectionRange(ta.value.length, ta.value.length)
    requestAnimationFrame(() => { if (editing && document.activeElement !== ta) ta.focus() })
    updateContext()
    requestRender()
  }

  function layoutEditor() {
    if (!editing) return
    const el = editing.el
    const m = S.measureText({ ...el, text: ta.value || ' ' })
    if (editing.cx != null) el.x = editing.cx - m.w / 2
    el.w = m.w; el.h = m.h
    ta.style.font = `${el.fontSize}px ${S.fontFamily(el.font)}`
    ta.style.lineHeight = String(S.LINE_HEIGHT)
    ta.style.left = `${sx(el.x)}px`
    ta.style.top = `${sy(el.y)}px`
    ta.style.width = `${m.w + el.fontSize}px`
    ta.style.height = `${m.h}px`
    ta.style.transform = `scale(${view.zoom})`
    ta.style.color = S.ink(el.stroke, dark)
    ta.style.opacity = String(el.opacity ?? 1)
  }

  function commitText() {
    if (!editing) return
    const { el, isNew } = editing
    editing = null
    ta.hidden = true
    el.text = ta.value.replace(/\s+$/, '')
    if (!el.text.trim()) {
      removeIds(new Set([el.id]))
      if (!isNew) commit()
    } else {
      Object.assign(el, S.measureText(el))
      bump(el)
      selected = new Set([el.id])
      commit()
    }
    if (!locked && tool === 'text') setTool('select')
    updateContext()
    requestRender()
  }

  ta.addEventListener('input', () => { layoutEditor(); requestRender() })
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); commitText() }
    if (e.key === 'Tab') { e.preventDefault(); document.execCommand?.('insertText', false, '  ') }
    e.stopPropagation()
  })
  ta.addEventListener('blur', () => setTimeout(() => {
    if (editing && document.activeElement !== ta && !pop.contains(document.activeElement) && !bar.contains(document.activeElement)) commitText()
  }, 0))

  /* ---------- context bar and popovers ---------- */

  function contextTypes() {
    if (editing) return [editing.el.type]
    const sel = selectedEls()
    if (sel.length) return [...new Set(sel.map(e => e.type))]
    if (TOOL_TYPES.includes(tool)) return [tool]
    return []
  }

  function valueOf(key) {
    const source = editing ? [editing.el] : selectedEls()
    if (!source.length) return style[styleKey(tool, key)]
    const vals = source.filter(e => KEYS_FOR[e.type].includes(key)).map(e => e[key])
    return vals.length && vals.every(v => v === vals[0]) ? vals[0] : null
  }

  function updateContext() {
    if (!doc) return
    const types = contextTypes()
    const keys = new Set(types.flatMap(t => KEYS_FOR[t]))
    const hasSel = selected.size > 0 && !editing
    const show = (sel, on) => { for (const el of bar.querySelectorAll(sel)) el.hidden = !on }
    show('[data-pop="color"]', keys.has('stroke'))
    show('[data-pop="fill"]', keys.has('bg'))
    show('[data-pop="stroke"]', keys.has('width'))
    show('[data-pop="ends"]', keys.has('end'))
    show('[data-pop="text"]', keys.has('font'))
    show('[data-pop="opacity"]', keys.has('opacity'))
    show('[data-pop="tape"]', keys.has('tape'))
    show('[data-sel]', hasSel)
    for (const el of pop.querySelectorAll('[data-only]')) el.hidden = !keys.has(el.dataset.only)

    const stroke = valueOf('stroke')
    $('#ctxColor').style.color = stroke ? S.ink(stroke, dark) : 'transparent'
    for (const p of all('.pen')) p.classList.toggle('is-on', p.dataset.value === stroke)
    for (const box of pop.querySelectorAll('[data-key]')) {
      const v = valueOf(box.dataset.key)
      if (box.classList.contains('range')) { box.value = String(Math.round((v ?? 1) * 100)); continue }
      for (const b of box.querySelectorAll('[data-value]')) b.classList.toggle('is-on', v != null && String(v).toLowerCase() === b.dataset.value.toLowerCase())
    }
    requestRender()
  }

  // The bar sits just above the selection (or under the title while a drawing tool is in hand).
  function placeContext() {
    const types = contextTypes()
    if (drag || pinch || !types.length) { bar.hidden = true; closePop(); return }
    bar.hidden = false
    const bw = bar.offsetWidth, bh = bar.offsetHeight
    const left = railWidth()
    const sel = editing ? [editing.el] : selectedEls()
    let x = left + (innerWidth - left) / 2 - bw / 2
    let y = 72
    if (sel.length && !isPhone()) {
      const b = S.unionBounds(sel)
      x = sx(b.x + b.w / 2) - bw / 2
      y = sy(b.y) - bh - 22
      if (y < 70) y = sy(b.y + b.h) + 22
    }
    x = clamp(x, left + 10, innerWidth - bw - 10)
    y = clamp(y, 70, innerHeight - bh - (isPhone() ? 130 : 70))
    bar.style.left = `${Math.round(x)}px`
    bar.style.top = `${Math.round(y)}px`
    if (!pop.hidden) positionPop()
  }

  let popGroup = null
  function openPop(group) {
    if (popGroup === group) { closePop(); return }
    popGroup = group
    for (const s of pop.querySelectorAll('section')) s.hidden = s.dataset.group !== group
    for (const b of bar.querySelectorAll('[data-pop]')) b.setAttribute('aria-expanded', String(b.dataset.pop === group))
    pop.hidden = false
    updateContext()
    positionPop()
  }
  function closePop() {
    if (pop.hidden) return
    pop.hidden = true
    popGroup = null
    for (const b of bar.querySelectorAll('[data-pop]')) b.setAttribute('aria-expanded', 'false')
  }
  function positionPop() {
    const btn = bar.querySelector(`[data-pop="${popGroup}"]`)
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const pw = pop.offsetWidth, ph = pop.offsetHeight
    const x = r.left + r.width / 2 - pw / 2
    let y = r.bottom + 10
    if (y + ph > innerHeight - 10) y = r.top - ph - 10
    pop.style.left = `${Math.round(clamp(x, railWidth() + 10, innerWidth - pw - 10))}px`
    pop.style.top = `${Math.round(clamp(y, 10, innerHeight - ph - 10))}px`
  }

  bar.addEventListener('click', e => {
    const b = e.target.closest('button')
    if (!b) return
    if (b.dataset.pop) return openPop(b.dataset.pop)
    const act = b.dataset.do
    if (act === 'delete') deleteSelected()
    else if (act === 'duplicate') duplicate()
    else if (act) reorder(act)
  })
  // Keep the text box focused while you restyle the words you're typing.
  for (const el of [bar, pop]) el.addEventListener('pointerdown', e => { if (editing && e.target.closest('button')) e.preventDefault() })
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !e.target.closest('#pop, #ctxbar')) closePop() })

  function buildSwatches() {
    const make = (key, colors, withNone) => {
      const box = pop.querySelector(`.swatches[data-key="${key}"]`)
      if (withNone) {
        const none = document.createElement('button')
        none.type = 'button'; none.className = 'swatch swatch-none'; none.dataset.value = 'transparent'
        none.innerHTML = icon('none'); none.title = 'No fill'
        box.append(none)
      }
      for (const c of colors) {
        const b = document.createElement('button')
        b.type = 'button'; b.className = 'swatch'; b.dataset.value = c; b.title = c
        box.append(b)
      }
      const custom = document.createElement('label')
      custom.className = 'swatch swatch-custom'
      custom.title = 'Any colour'
      custom.innerHTML = `${icon('plus')}<input type="color" aria-label="Any colour">`
      box.append(custom)
      box.addEventListener('click', e => { const b = e.target.closest('button.swatch'); if (b) setStyle(key, b.dataset.value) })
      const input = custom.querySelector('input')
      input.addEventListener('input', () => setStyle(key, input.value, false))
      input.addEventListener('change', () => { setStyle(key, input.value); commit() })
    }
    make('stroke', STROKES, false)
    make('bg', FILLS, true)
  }

  function parseValue(key, raw) {
    if (['width', 'rough', 'fontSize'].includes(key)) return Number(raw)
    if (key === 'round' || key === 'tape') return raw === true || raw === 'true'
    if (key === 'opacity') return clamp(Number(raw) / 100, 0.1, 1)
    return raw
  }

  function setStyle(key, raw, doCommit = true) {
    const value = parseValue(key, raw)
    const targets = editing ? [editing.el] : selectedEls()
    // Defaults follow the tool in hand, or the kind of thing you just restyled.
    const ctxType = targets[0]?.type || tool
    style[styleKey(ctxType, key)] = value
    savePrefs()
    let changed = false
    for (const el of targets) {
      if (!KEYS_FOR[el.type].includes(key)) continue
      el[key] = value
      if (el.type === 'text' && (key === 'font' || key === 'fontSize')) {
        const b = S.bounds(el)
        Object.assign(el, S.measureText(el))
        if (el.align === 'center') el.x = b.x + b.w / 2 - el.w / 2
      }
      bump(el)
      changed = true
    }
    if (editing) { layoutEditor(); ta.focus() }
    if (changed && doCommit && !editing) commit()
    updateContext()
  }

  for (const seg of pop.querySelectorAll('.seg[data-key]')) {
    seg.addEventListener('click', e => { const b = e.target.closest('button[data-value]'); if (b) setStyle(seg.dataset.key, b.dataset.value) })
  }
  const range = pop.querySelector('.range')
  range.addEventListener('input', () => setStyle('opacity', range.value, false))
  range.addEventListener('change', () => commit())

  /* ---------- keyboard ---------- */

  addEventListener('keydown', e => {
    if (isTyping(e.target) || dialogOpen()) return
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (e.key === ' ') {
      if (!spaceDown) { spaceDown = true; document.body.classList.add('is-space') }
      e.preventDefault()
      return
    }
    if (mod) {
      if (k === 'z' && !e.shiftKey) undo()
      else if ((k === 'z' && e.shiftKey) || k === 'y') redo()
      else if (k === 'a') selectAll()
      else if (k === 'd') duplicate()
      else if (k === 's') saveFile()
      else if (k === 'o') $('#openFile').click()
      else if (k === 'e' && e.shiftKey) openExport()
      else if (k === '=' || k === '+') setZoom(view.zoom * 1.2)
      else if (k === '-') setZoom(view.zoom / 1.2)
      else if (k === '0') setZoom(1)
      else if (e.code === 'BracketRight') reorder(e.shiftKey ? 'front' : 'forward')
      else if (e.code === 'BracketLeft') reorder(e.shiftKey ? 'back' : 'backward')
      else if (e.code === 'Quote') toggleGrid()
      else return
      e.preventDefault()
      return
    }
    if (e.altKey) return
    if (e.key === 'Escape') {
      if (drag) cancelDrag()
      else if (!pop.hidden) closePop()
      else if (!$('#menu').hidden) closeMenu()
      else if (selected.size) { selected.clear(); updateContext() }
      else setTool('select')
      requestRender()
    } else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
    else if (e.key.startsWith('Arrow') && selected.size) {
      const s = e.shiftKey ? 10 : 1
      nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0)
    } else if (e.code === 'Digit1' && e.shiftKey) zoomToFit()
    else if (e.key === '?') openDialog('#helpDialog')
    else if (e.key === 'Enter' && selected.size === 1 && selectedEls()[0].type === 'text') editText(selectedEls()[0])
    else if (k === 'q') toggleLock()
    else if (k === 'i') $('#imageFile').click()
    else if (!e.shiftKey && /^[1-6]$/.test(e.key)) setStyle('stroke', STROKES[Number(e.key) - 1])
    else if (!e.shiftKey && TOOL_KEYS[k]) setTool(TOOL_KEYS[k])
    else return
    e.preventDefault()
  })
  addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; document.body.classList.remove('is-space') } })
  addEventListener('blur', () => { spaceDown = false; document.body.classList.remove('is-space') })

  /* ---------- clipboard ---------- */

  const clip = () => JSON.stringify({ type: 'scrawl/clipboard', elements: selectedEls() })
  document.addEventListener('copy', e => {
    if (isTyping(e.target) || !selected.size) return
    e.clipboardData.setData('text/plain', clip())
    e.preventDefault()
    toast(selected.size === 1 ? 'Copied' : `Copied ${selected.size} things`)
  })
  document.addEventListener('cut', e => {
    if (isTyping(e.target) || !selected.size) return
    e.clipboardData.setData('text/plain', clip())
    e.preventDefault()
    deleteSelected()
  })
  document.addEventListener('paste', e => {
    if (isTyping(e.target) || dialogOpen()) return
    const pics = [...(e.clipboardData?.files || [])].filter(f => IMAGE_TYPE.test(f.type))
    if (pics.length) { e.preventDefault(); addImages(pics, ...lastScene); return }
    const text = e.clipboardData?.getData('text/plain') || ''
    let data = null
    try { data = JSON.parse(text) } catch { /* plain text */ }
    if (data && (data.type === 'scrawl/clipboard' || data.type === 'scrawl') && Array.isArray(data.elements)) {
      const els = data.elements.map(S.sanitize).filter(Boolean)
      if (!els.length) return
      measureTexts(els)
      ensureFiles(els)
      const b = S.unionBounds(els)
      const copies = cloneEls(els, lastScene[0] - (b.x + b.w / 2), lastScene[1] - (b.y + b.h / 2))
      doc.elements.push(...copies)
      setTool('select')
      selected = new Set(copies.map(c => c.id))
      commit(); updateContext()
    } else if (text.trim()) {
      const el = makeEl('text', lastScene[0], lastScene[1])
      el.text = text.slice(0, 20000)
      Object.assign(el, S.measureText(el))
      doc.elements.push(el)
      setTool('select')
      selected = new Set([el.id])
      commit(); updateContext()
    }
    e.preventDefault()
  })

  /* ---------- menu ---------- */

  function openMenu() { loadStars(); $('#menu').hidden = false; $('#menuBtn').setAttribute('aria-expanded', 'true'); $('#gridItem').setAttribute('aria-pressed', String(prefs.grid)) }
  function closeMenu() { $('#menu').hidden = true; $('#menuBtn').setAttribute('aria-expanded', 'false') }
  $('#menuBtn').addEventListener('click', e => { e.stopPropagation(); $('#menu').hidden ? openMenu() : closeMenu() })
  document.addEventListener('pointerdown', e => { if (!$('#menu').hidden && !e.target.closest('#menu, #menuBtn')) closeMenu() })

  $('#menu').addEventListener('click', e => {
    const theme = e.target.closest('[data-theme]')
    if (theme) { prefs.theme = theme.dataset.theme; savePrefs(); applyTheme(); return }
    const paper = e.target.closest('[data-paper]')
    if (paper) { prefs.paper = paper.dataset.paper; savePrefs(); applyTheme(); return }
    const item = e.target.closest('[data-action]')
    if (!item) return
    const a = item.dataset.action
    if (a !== 'grid') closeMenu()
    if (a === 'new') newDrawing()
    else if (a === 'drawings') showDrawings()
    else if (a === 'open') $('#openFile').click()
    else if (a === 'save') saveFile()
    else if (a === 'export') openExport()
    else if (a === 'grid') toggleGrid()
    else if (a === 'help') openDialog('#helpDialog')
    else if (a === 'clear') clearCanvas()
  })

  // Star count for the menu: fetched the first time the menu opens, and at most once an hour
  // (GitHub allows 60 unauthenticated requests an hour). On any failure the count just stays hidden.
  let starsAsked = false
  async function loadStars() {
    if (starsAsked) return
    starsAsked = true
    const KEY = 'scrawl-stars', HOUR = 3600e3
    let n = null
    try { const c = JSON.parse(localStorage.getItem(KEY)); if (c && Date.now() - c.t < HOUR) n = c.n } catch {}
    if (n === null) {
      try {
        const res = await fetch('https://api.github.com/repos/mhfrough/scrawl')
        if (res.ok) n = (await res.json()).stargazers_count
        if (typeof n === 'number') try { localStorage.setItem(KEY, JSON.stringify({ n, t: Date.now() })) } catch {}
      } catch {}
    }
    if (typeof n !== 'number' || n < 1) return
    $('#starCount').textContent = n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n)
    $('#starCount').hidden = false
    $('#starLink').setAttribute('aria-label', `Star Scrawl on GitHub, ${n} ${n === 1 ? 'star' : 'stars'}`)
  }

  function toggleGrid() {
    prefs.grid = !prefs.grid
    savePrefs()
    $('#gridItem').setAttribute('aria-pressed', String(prefs.grid))
    toast(prefs.grid ? 'Snapping to the dots' : 'Snapping off')
  }

  async function clearCanvas() {
    if (!doc.elements.length) return
    const ok = await confirmAction('Clear this page?', 'Everything on it will be removed. You can undo this.', 'Clear')
    if (!ok) return
    doc.elements = []
    selected.clear()
    commit(); updateContext()
  }

  $('#exportBtn').addEventListener('click', openExport)
  $('#drawingsBtn').addEventListener('click', showDrawings)

  /* ---------- dialogs ---------- */

  function openDialog(sel) {
    if (editing) commitText()
    closePop()
    const d = $(sel)
    if (!d.open) d.showModal()
  }
  for (const d of all('dialog')) d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close() })

  function confirmAction(title, text, yes) {
    const d = $('#confirmDialog')
    $('#confirmTitle').textContent = title
    $('#confirmText').textContent = text
    $('#confirmYes').textContent = yes
    d.returnValue = ''
    d.showModal()
    return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'yes'), { once: true }))
  }

  const ago = t => {
    const s = (Date.now() - t) / 1000
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)} min ago`
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`
    return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function showDrawings() { renderDrawings(); openDialog('#drawingsDialog') }

  function renderDrawings() {
    saveNow()
    const list = $('#drawingsList')
    list.replaceChildren()
    for (const entry of store.get(KEY.index) || []) {
      const d = entry.id === doc.id ? { ...doc } : loadDoc(entry.id)
      if (!d) continue
      const current = entry.id === doc.id
      const li = document.createElement('li')
      li.className = `drawing${current ? ' is-current' : ''}`
      const thumb = document.createElement('button')
      thumb.type = 'button'
      thumb.className = 'drawing-thumb'
      thumb.setAttribute('aria-label', `Open ${d.name}`)
      if (d.elements.length) {
        measureTexts(d.elements)
        const img = new Image()
        img.alt = ''
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(S.renderSVG(d.elements, { padding: 8, background: false, dark: dark && !current, embedFonts: false, images: false }))}`
        thumb.append(img)
      } else {
        thumb.append(Object.assign(document.createElement('span'), { className: 'drawing-empty', textContent: 'blank page' }))
      }
      const open = document.createElement('button')
      open.type = 'button'
      open.className = 'drawing-open'
      const n = d.elements.length
      open.append(
        Object.assign(document.createElement('span'), { className: 'drawing-name', textContent: d.name }),
        Object.assign(document.createElement('span'), { className: 'drawing-meta', textContent: `${current ? 'Open now' : ago(entry.updated)} · ${n ? `${n} item${n === 1 ? '' : 's'}` : 'blank'}` }))
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'icon-btn is-danger'
      del.innerHTML = icon('trash')
      del.setAttribute('aria-label', `Delete ${d.name}`)
      del.title = 'Delete'
      const go = () => { switchTo(entry.id); $('#drawingsDialog').close() }
      thumb.addEventListener('click', go)
      open.addEventListener('click', go)
      del.addEventListener('click', () => deleteDrawing(entry.id))
      const row = document.createElement('div')
      row.className = 'drawing-row'
      row.append(open, del)
      li.append(thumb, row)
      list.append(li)
    }
  }
  $('#newFromList').addEventListener('click', () => { $('#drawingsDialog').close(); newDrawing() })

  /* ---------- export ---------- */

  let exportScale = 2
  const exportEls = () => ($('#expSel').checked && selected.size ? selectedEls() : doc.elements)
  const exportOpts = () => ({ background: $('#expBg').checked, dark: $('#expDark').checked, scale: exportScale })
  const fileBase = () => (doc.name.replace(/[\\/:*?"<>|,]+/g, ' ').replace(/\s+/g, ' ').trim() || 'scrawl')

  function openExport() {
    if (!doc.elements.length) { toast('Nothing to export yet. Draw something first.'); return }
    $('#expSelWrap').hidden = !selected.size
    $('#expSel').checked = selected.size > 0
    $('#expDark').checked = dark
    for (const b of all('#expScale button')) b.classList.toggle('is-on', Number(b.dataset.value) === exportScale)
    openDialog('#exportDialog')
    refreshPreview()
  }

  async function refreshPreview() {
    await picturesReady(exportEls())
    const c = S.renderPNG(exportEls(), { ...exportOpts(), scale: 1 })
    const img = new Image()
    img.alt = 'Preview of the exported image'
    img.src = c.toDataURL('image/png')
    $('#exportPreview').replaceChildren(img)
  }
  for (const id of ['#expBg', '#expDark', '#expSel']) $(id).addEventListener('change', refreshPreview)
  $('#expScale').addEventListener('click', e => {
    const b = e.target.closest('button[data-value]')
    if (!b) return
    exportScale = Number(b.dataset.value)
    for (const x of all('#expScale button')) x.classList.toggle('is-on', x === b)
  })

  function download(blob, name) {
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    document.body.append(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const pngBlob = async () => { await picturesReady(exportEls()); return new Promise(res => S.renderPNG(exportEls(), exportOpts()).toBlob(res, 'image/png')) }
  $('#expPng').addEventListener('click', async () => { download(await pngBlob(), `${fileBase()}.png`); toast('PNG saved') })
  $('#expSvg').addEventListener('click', async () => {
    await picturesReady(exportEls())
    await Promise.all(exportEls().filter(e => e.type === 'image').map(e => dataUrlFor(e.fileId)))
    download(new Blob([S.renderSVG(exportEls(), exportOpts())], { type: 'image/svg+xml' }), `${fileBase()}.svg`)
    toast('SVG saved')
  })
  $('#expCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })])
      toast('Image copied')
    } catch { toast("This browser can't copy images. Download the PNG instead.") }
  })

  /* ---------- files ---------- */

  async function saveFile() {
    await picturesReady(doc.elements)
    const pics = {}
    for (const el of doc.elements) if (el.type === 'image' && !pics[el.fileId]) pics[el.fileId] = await dataUrlFor(el.fileId)
    const data = { type: 'scrawl', version: 1, name: doc.name, elements: doc.elements, files: pics }
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${fileBase()}.scrawl`)
    toast('Saved to file')
  }

  async function openFile(file) {
    if (!file) return
    if (file.size > 30 * 1024 * 1024) { toast('That file is too big to open'); return }
    let data
    try { data = JSON.parse(await file.text()) } catch { toast("That isn't a Scrawl file"); return }
    if (!data || !Array.isArray(data.elements)) { toast("That isn't a Scrawl file"); return }
    const elements = data.elements.map(S.sanitize).filter(Boolean)
    if (data.files && typeof data.files === 'object') {
      for (const [id, url] of Object.entries(data.files)) {
        if (!/^[a-z0-9]{6,40}$/.test(id) || typeof url !== 'string' || !/^data:image\/(png|jpeg|gif|webp|avif|bmp|svg\+xml);base64,/.test(url)) continue
        try { await saveBlob(id, await (await fetch(url)).blob()) } catch { /* skip a broken picture */ }
      }
    }
    leaveCurrent()
    openDoc({ id: S.uid(), name: typeof data.name === 'string' && data.name.trim() ? data.name.slice(0, 60) : file.name.replace(/\.[^.]+$/, ''), elements })
    saveNow()
    zoomToFit()
    toast(`Opened ${file.name}`)
  }
  $('#openFile').addEventListener('change', e => { openFile(e.target.files[0]); e.target.value = '' })

  // Drop pictures anywhere on the page to stick them there; drop a .scrawl file to open it.
  let dragDepth = 0
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files')
  const setDropping = on => document.body.classList.toggle('is-dropping', on)
  addEventListener('dragenter', e => { if (hasFiles(e)) { dragDepth++; setDropping(true) } })
  addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; setDropping(false) } })
  addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } })
  addEventListener('drop', e => {
    dragDepth = 0
    setDropping(false)
    const list = [...(e.dataTransfer?.files || [])]
    if (!list.length) return
    e.preventDefault()
    const drawingFile = list.find(f => /\.(scrawl|json)$/i.test(f.name) || f.type === 'application/json')
    if (drawingFile) { openFile(drawingFile); return }
    if (list.some(f => IMAGE_TYPE.test(f.type))) addImages(list, ...toScene(e.clientX, e.clientY))
    else toast('Drop pictures or a .scrawl file')
  })

  /* ---------- toast ---------- */

  let toastTimer = 0
  function toast(msg) {
    const t = $('#toast')
    t.textContent = msg
    t.classList.add('is-shown')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => t.classList.remove('is-shown'), 2400)
  }

  /* ---------- other tabs ---------- */

  addEventListener('storage', e => {
    if (!doc || e.key !== KEY.doc(doc.id) || drag || editing) return
    const d = loadDoc(doc.id)
    if (!d) return
    doc.elements = d.elements
    doc.name = d.name
    measureTexts(doc.elements)
    ensureFiles(doc.elements)
    for (const id of [...selected]) if (!byId(id)) selected.delete(id)
    history.last = JSON.stringify(doc.elements)
    renderName(); updateContext()
  })

  /* ---------- start ---------- */

  buildSwatches()
  buildPens()
  const startId = store.get(KEY.current)
  const first = (startId && loadDoc(startId)) || (store.get(KEY.index) || []).map(d => loadDoc(d.id)).find(Boolean)
  openDoc(first || { id: S.uid(), name: defaultName(), elements: [] })
  applyTheme()
  setTool('select')
  $('#savedNote').textContent = 'Saved'

  // Measure text again once the fonts arrive, so boxes fit the real letters.
  if (document.fonts) {
    Promise.all([document.fonts.load('24px "Shantell Sans"'), document.fonts.load('24px "Bricolage Grotesque"')])
      .catch(() => {})
      .then(() => { measureTexts(doc.elements); requestRender() })
  }

  setTimeout(collectGarbage, 4000)
  addEventListener('resize', () => { if (editing) layoutEditor(); requestRender() })
  addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow() })

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
  }
})()
