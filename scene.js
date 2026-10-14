/* Scrawl scene: the element model, the marker-on-paper look, hit testing, and the two renderers
 * (canvas for the editor and PNG export, SVG for vector export). No libraries.
 *
 * The look: one confident felt-tip stroke per edge, with corners that run past each other the way
 * a quick architect's sketch does; fills printed slightly off-register, like a risograph; a pen with
 * a tapered, pressure-like line; and a translucent highlighter.
 * Every element carries a seed, so its wobble is identical on every redraw and in every export.
 */
(() => {
  'use strict'

  const HAND = '"Shantell Sans", "Segoe Print", "Comic Sans MS", cursive'
  const SANS = '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
  const LINE_HEIGHT = 1.25
  const SHAPES = ['rect', 'diamond', 'ellipse']
  const TYPES = ['rect', 'diamond', 'ellipse', 'line', 'arrow', 'draw', 'mark', 'text', 'image']
  const HEADS = ['none', 'arrow', 'triangle', 'dot']

  const fontFamily = f => (f === 'sans' ? SANS : HAND)
  const fontCss = el => `${el.fontSize}px ${fontFamily(el.font)}`

  /* ---------- small maths ---------- */

  function rng(seed) {
    let a = seed >>> 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]
  const r2 = n => Math.round(n * 100) / 100

  function rotate(x, y, cx, cy, a) {
    const cos = Math.cos(a), sin = Math.sin(a), dx = x - cx, dy = y - cy
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  function pointInPolygon(x, y, poly) {
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }

  /* ---------- path building ---------- */

  class Path {
    constructor() { this.d = [] }
    M(x, y) { this.d.push(`M${r2(x)} ${r2(y)}`) }
    L(x, y) { this.d.push(`L${r2(x)} ${r2(y)}`) }
    Q(a, b, x, y) { this.d.push(`Q${r2(a)} ${r2(b)} ${r2(x)} ${r2(y)}`) }
    C(a, b, c, d, x, y) { this.d.push(`C${r2(a)} ${r2(b)} ${r2(c)} ${r2(d)} ${r2(x)} ${r2(y)}`) }
    dot(x, y, r) { this.d.push(`M${r2(x - r)} ${r2(y)}a${r2(r)} ${r2(r)} 0 1 0 ${r2(r * 2)} 0a${r2(r)} ${r2(r)} 0 1 0 ${r2(-r * 2)} 0`) }
    Z() { this.d.push('Z') }
    toString() { return this.d.join('') }
  }

  /* One felt-tip stroke: a gently bowed curve with a slight wobble. `over` lets it run past both ends. */
  function markerLine(p, x1, y1, x2, y2, rough, rand, over = 0) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len
    if (over) {
      const a = over * (0.4 + rand() * 0.8), b = over * (0.4 + rand() * 0.8)
      x1 -= ux * a; y1 -= uy * a; x2 += ux * b; y2 += uy * b
    }
    if (!rough) { p.M(x1, y1); p.L(x2, y2); return }
    const j = () => (rand() - 0.5) * 2 * Math.min(1.2 * rough, len / 12)
    const bow = (rand() - 0.5) * Math.min(len / 24, 7) * rough
    const nx = -uy, ny = ux
    const t1 = 0.25 + rand() * 0.15, t2 = 0.6 + rand() * 0.15
    p.M(x1 + j(), y1 + j())
    p.C(
      x1 + (x2 - x1) * t1 + nx * bow, y1 + (y2 - y1) * t1 + ny * bow,
      x1 + (x2 - x1) * t2 + nx * bow * 0.8, y1 + (y2 - y1) * t2 + ny * bow * 0.8,
      x2 + j(), y2 + j())
  }

  /* Smooth curve through points (Catmull-Rom as cubic Béziers). */
  function curveThrough(p, pts, closed) {
    const n = pts.length
    if (n < 2) return
    const at = i => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))])
    p.M(pts[0][0], pts[0][1])
    const segs = closed ? n : n - 1
    for (let i = 0; i < segs; i++) {
      const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2)
      p.C(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6, c[0] - (d[0] - b[0]) / 6, c[1] - (d[1] - b[1]) / 6, c[0], c[1])
    }
    if (closed) p.Z()
  }

  /* A closed loop drawn in one go: it wobbles, and the pen carries on past where it started. */
  function markerLoop(p, pts, rough, rand) {
    if (!rough) { curveThrough(p, pts, true); return }
    const o = rough * 1.6
    const q = pts.map(([x, y]) => [x + (rand() - 0.5) * 2 * o, y + (rand() - 0.5) * 2 * o])
    const run = 1 + Math.floor(rand() * 2)
    for (let i = 0; i < run; i++) q.push([q[i][0] + (rand() - 0.5) * 3 * rough, q[i][1] + (rand() - 0.5) * 3 * rough])
    curveThrough(p, q, false)
  }

  function ellipsePoints(cx, cy, rx, ry, n, start = 0, rand = null, jitter = 0) {
    const pts = []
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2
      const k = rand ? 1 + (rand() - 0.5) * jitter : 1
      pts.push([cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)])
    }
    return pts
  }

  function polygonFor(el) {
    const { x, y, w, h } = el
    return el.type === 'rect'
      ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
      : [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]
  }

  const cornerRadius = el => Math.min(28, Math.min(Math.abs(el.w), Math.abs(el.h)) * (el.type === 'rect' ? 0.2 : 0.12))
  const toward = (a, b, d) => { const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + ((b[0] - a[0]) / len) * d, a[1] + ((b[1] - a[1]) / len) * d] }

  /* Points along a polygon with rounded corners, close enough together to keep the sides straight. */
  function roundedPoints(verts, r) {
    const out = []
    const n = verts.length
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n], cur = verts[i], next = verts[(i + 1) % n]
      const rr = Math.min(r, Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / 2, Math.hypot(next[0] - cur[0], next[1] - cur[1]) / 2)
      const a = toward(cur, prev, rr), b = toward(cur, next, rr)
      for (let k = 0; k <= 4; k++) {
        const t = k / 4, u = 1 - t
        out.push([u * u * a[0] + 2 * u * t * cur[0] + t * t * b[0], u * u * a[1] + 2 * u * t * cur[1] + t * t * b[1]])
      }
      const nb = toward(next, cur, Math.min(r, Math.hypot(next[0] - cur[0], next[1] - cur[1]) / 2))
      const steps = Math.floor(Math.hypot(nb[0] - b[0], nb[1] - b[1]) / 70)
      for (let k = 1; k <= steps; k++) out.push([b[0] + ((nb[0] - b[0]) * k) / (steps + 1), b[1] + ((nb[1] - b[1]) * k) / (steps + 1)])
    }
    return out
  }

  function roundedPath(p, verts, r) {
    const n = verts.length
    for (let i = 0; i < n; i++) {
      const prev = verts[(i - 1 + n) % n], cur = verts[i], next = verts[(i + 1) % n]
      const rr = Math.min(r, Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) / 2, Math.hypot(next[0] - cur[0], next[1] - cur[1]) / 2)
      const a = toward(cur, prev, rr), b = toward(cur, next, rr)
      if (i === 0) p.M(a[0], a[1]); else p.L(a[0], a[1])
      p.Q(cur[0], cur[1], b[0], b[1])
    }
    p.Z()
  }

  function polyPath(p, pts) { p.M(...pts[0]); for (let i = 1; i < pts.length; i++) p.L(...pts[i]); p.Z() }

  /* Pen: a filled outline that swells with slow strokes and tapers at both ends. */
  function penOutline(p, pts, base) {
    const n = pts.length
    const widths = pts.map((pt, i) => {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)]
      const speed = Math.hypot(next[0] - prev[0], next[1] - prev[1])
      const ends = Math.min(1, (i + 1) / 5, (n - i) / 5)
      return base * (0.55 + 0.45 * ends) * (1.15 - Math.min(speed / 60, 0.45))
    })
    const left = [], right = []
    for (let i = 0; i < n; i++) {
      const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(n - 1, i + 1)]
      let dx = next[0] - prev[0], dy = next[1] - prev[1]
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      const w = widths[i] / 2
      left.push([pts[i][0] - dy * w, pts[i][1] + dx * w])
      right.push([pts[i][0] + dy * w, pts[i][1] - dx * w])
    }
    curveThrough(p, [...left, ...right.reverse()], true)
    p.dot(pts[0][0], pts[0][1], widths[0] / 2)
    p.dot(pts[n - 1][0], pts[n - 1][1], widths[n - 1] / 2)
  }

  function smoothPolyline(p, pts) {
    p.M(...pts[0])
    for (let i = 1; i < pts.length - 1; i++) p.Q(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)
    p.L(...pts[pts.length - 1])
  }

  /* Halftone dots inside a polygon, like a screen-printed tint. */
  function halftone(p, poly, sw) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (const [x, y] of poly) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y) }
    const step = Math.max(6 + sw, Math.sqrt(((x2 - x1) * (y2 - y1)) / 5000))
    const r = step * 0.24
    let row = 0
    for (let y = y1 + step / 2; y < y2; y += step * 0.87, row++) {
      for (let x = x1 + step / 2 + (row % 2 ? step / 2 : 0); x < x2; x += step) if (pointInPolygon(x, y, poly)) p.dot(x, y, r)
    }
  }

  /* ---------- geometry per element ---------- */

  const cache = new Map()

  function drawable(el) {
    const hit = cache.get(el.id)
    if (hit && hit.v === el.v) return hit.d
    const d = build(el)
    if (cache.size > 5000) cache.clear()
    cache.set(el.id, { v: el.v, d })
    return d
  }

  function build(el) {
    const rand = rng(el.seed || 1)
    const out = { fills: [], strokes: [] }
    const sw = el.width || 2
    const rough = el.rough ?? 1

    if (SHAPES.includes(el.type)) {
      const { x, y, w, h } = el
      const sp = new Path()
      let outline, curved = false
      if (el.type === 'ellipse') {
        const cx = x + w / 2, cy = y + h / 2, rx = Math.abs(w / 2), ry = Math.abs(h / 2)
        outline = ellipsePoints(cx, cy, rx, ry, 40)
        curved = true
        if (rough) markerLoop(sp, ellipsePoints(cx, cy, rx, ry, 12, rand() * Math.PI * 2, rand, 0.06 * rough), rough, rand)
        else curveThrough(sp, outline, true)
      } else {
        const verts = polygonFor(el)
        if (el.round) {
          const r = cornerRadius(el)
          outline = roundedPoints(verts, r)
          curved = true
          if (rough) markerLoop(sp, outline, rough, rand)
          else roundedPath(sp, verts, r)
        } else {
          outline = verts
          if (rough) {
            const over = Math.min(9, Math.min(Math.abs(w), Math.abs(h)) * 0.08) * rough * (el.type === 'diamond' ? 0.45 : 1)
            for (let i = 0; i < 4; i++) markerLine(sp, ...verts[i], ...verts[(i + 1) % 4], rough, rand, over)
          } else polyPath(sp, verts)
        }
      }
      if (el.bg && el.bg !== 'transparent') {
        const fp = new Path()
        if (el.fill === 'dots') {
          halftone(fp, outline, sw)
        } else {
          // "offset" prints the colour a few pixels off the outline; "solid" sits right inside it.
          const shift = el.fill === 'offset' ? 4 + sw * 1.5 : 0
          const pts = outline.map(([px, py]) => [px + shift, py + shift])
          if (curved) curveThrough(fp, pts, true)
          else polyPath(fp, pts)
        }
        out.fills.push({ d: String(fp), color: el.bg })
      }
      out.strokes.push({ d: String(sp), color: el.stroke, width: sw, dash: el.dash })
    } else if (el.type === 'line' || el.type === 'arrow') {
      const pts = el.points.map(([px, py]) => [el.x + px, el.y + py])
      const lp = new Path()
      for (let i = 0; i + 1 < pts.length; i++) markerLine(lp, ...pts[i], ...pts[i + 1], rough, rand)
      out.strokes.push({ d: String(lp), color: el.stroke, width: sw, dash: el.dash })
      if (el.type === 'arrow') {
        const heads = [[el.end, pts[pts.length - 1], pts[pts.length - 2]], [el.start, pts[0], pts[1]]]
        for (const [kind, tip, from] of heads) {
          if (!kind || kind === 'none' || !from) continue
          const len = Math.hypot(tip[0] - from[0], tip[1] - from[1])
          if (len < 1) continue
          const ang = Math.atan2(tip[1] - from[1], tip[0] - from[0])
          const hl = Math.min(len * 0.45, 10 + sw * 4)
          const hp = new Path()
          if (kind === 'dot') {
            hp.dot(tip[0], tip[1], 2.5 + sw)
            out.fills.push({ d: String(hp), color: el.stroke })
            continue
          }
          const wing = s => [tip[0] - hl * Math.cos(ang + s * 0.42), tip[1] - hl * Math.sin(ang + s * 0.42)]
          if (kind === 'triangle') {
            const back = [tip[0] - hl * 0.7 * Math.cos(ang), tip[1] - hl * 0.7 * Math.sin(ang)]
            hp.M(...tip); hp.L(...wing(1)); hp.Q(back[0], back[1], ...wing(-1)); hp.Z()
            out.fills.push({ d: String(hp), color: el.stroke })
          } else {
            const wp = new Path()
            markerLine(wp, ...wing(1), ...tip, rough, rand)
            markerLine(wp, ...wing(-1), ...tip, rough, rand)
            out.strokes.push({ d: String(wp), color: el.stroke, width: sw, dash: 'solid' })
          }
        }
      }
    } else if (el.type === 'draw') {
      const pts = el.points.map(([px, py]) => [el.x + px, el.y + py])
      const p = new Path()
      if (pts.length === 1) p.dot(pts[0][0], pts[0][1], Math.max(1.2, sw * 0.9))
      else penOutline(p, pts, sw * 1.9)
      out.fills.push({ d: String(p), color: el.stroke })
    } else if (el.type === 'mark') {
      const pts = el.points.map(([px, py]) => [el.x + px, el.y + py])
      const p = new Path()
      if (pts.length === 1) { p.M(pts[0][0] - 0.1, pts[0][1]); p.L(pts[0][0] + 0.1, pts[0][1]) }
      else smoothPolyline(p, pts)
      out.strokes.push({ d: String(p), color: el.stroke, width: markWidth(el), dash: 'solid', cap: 'square', alpha: 0.38 })
    }
    return out
  }

  const markWidth = el => 8 + (el.width || 2) * 5

  /* ---------- bounds and hit testing ---------- */

  function bounds(el) {
    if (el.points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [px, py] of el.points) { minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py) }
      return { x: el.x + minX, y: el.y + minY, w: maxX - minX, h: maxY - minY }
    }
    return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.abs(el.w), h: Math.abs(el.h) }
  }

  // Boxes, text and pictures turn with `angle` (radians, about their centre). Lines and strokes
  // never carry one: turning them turns their points.
  const centre = el => { const b = bounds(el); return [b.x + b.w / 2, b.y + b.h / 2] }

  /* A scene point in the element's own unturned frame. */
  function toLocal(el, x, y) {
    if (!el.angle) return [x, y]
    const [cx, cy] = centre(el)
    return rotate(x, y, cx, cy, -el.angle)
  }

  /* The upright box around the element as it sits on the page, turned or not. */
  function aabb(el) {
    const b = bounds(el)
    if (!el.angle) return b
    const cos = Math.abs(Math.cos(el.angle)), sin = Math.abs(Math.sin(el.angle))
    const w = b.w * cos + b.h * sin, h = b.w * sin + b.h * cos
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - h / 2, w, h }
  }

  function unionBounds(els) {
    if (!els.length) return null
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
    for (const el of els) {
      const b = aabb(el)
      const pad = el.type === 'mark' ? markWidth(el) / 2 : 0
      x1 = Math.min(x1, b.x - pad); y1 = Math.min(y1, b.y - pad); x2 = Math.max(x2, b.x + b.w + pad); y2 = Math.max(y2, b.y + b.h + pad)
    }
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  }

  const isFilled = el => SHAPES.includes(el.type) && el.bg && el.bg !== 'transparent'

  function hitTest(el, x, y, tol) {
    [x, y] = toLocal(el, x, y)
    const b = bounds(el)
    const sw = el.type === 'mark' ? markWidth(el) : el.type === 'draw' ? (el.width || 2) * 2 : el.width || 2
    const pad = tol + sw
    if (x < b.x - pad || x > b.x + b.w + pad || y < b.y - pad || y > b.y + b.h + pad) return false
    const reach = tol + sw / 2
    switch (el.type) {
      case 'text':
      case 'image':
        return true
      case 'ellipse': {
        const rx = b.w / 2 || 1, ry = b.h / 2 || 1
        const dist = Math.hypot((x - (b.x + rx)) / rx, (y - (b.y + ry)) / ry)
        if (isFilled(el) && dist <= 1) return true
        return Math.abs(dist - 1) * Math.min(rx, ry) <= reach
      }
      case 'rect':
      case 'diamond': {
        const box = { ...el, ...b }
        const poly = el.round ? roundedPoints(polygonFor(box), cornerRadius(box)) : polygonFor(box)
        if (isFilled(el) && pointInPolygon(x, y, poly)) return true
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i], c = poly[(i + 1) % poly.length]
          if (distToSegment(x, y, a[0], a[1], c[0], c[1]) <= reach) return true
        }
        return false
      }
      default: {
        const pts = el.points
        if (pts.length === 1) return Math.hypot(x - el.x - pts[0][0], y - el.y - pts[0][1]) <= reach + 2
        for (let i = 0; i + 1 < pts.length; i++) {
          if (distToSegment(x, y, el.x + pts[i][0], el.y + pts[i][1], el.x + pts[i + 1][0], el.y + pts[i + 1][1]) <= reach) return true
        }
        return false
      }
    }
  }

  /* ---------- text ---------- */

  let measureCtx = null
  function measureText(el) {
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d')
    measureCtx.font = fontCss(el)
    const lines = String(el.text || '').split('\n')
    const w = Math.max(...lines.map(l => measureCtx.measureText(l || ' ').width), el.fontSize * 0.5)
    return { w: Math.ceil(w), h: Math.ceil(lines.length * el.fontSize * LINE_HEIGHT) }
  }

  function textLines(el) {
    const lines = String(el.text || '').split('\n')
    const lh = el.fontSize * LINE_HEIGHT
    const x = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x
    return lines.map((line, i) => ({ line, x, y: el.y + i * lh + lh * 0.5 + el.fontSize * 0.34 }))
  }

  /* ---------- colour for the dark page ---------- */
  // Dark mode flips lightness and keeps hue, so a drawing reads the same on either paper.

  const themed = new Map()
  function ink(color, dark) {
    if (!dark || !color || color === 'transparent') return color
    if (themed.has(color)) return themed.get(color)
    let hex = color.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let hue = 0, sat = 0
    const l = (max + min) / 2
    if (max !== min) {
      const d = max - min
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      hue *= 60
    }
    const out = `hsl(${Math.round(hue)} ${Math.round(sat * 100)}% ${Math.round((0.08 + (1 - l) * 0.84) * 100)}%)`
    themed.set(color, out)
    return out
  }

  /* ---------- pictures ---------- */
  // The app tells the scene how to find a picture's pixels: { img, dataUrl } for a file id.
  let imageSource = () => null
  const setImageSource = fn => { imageSource = fn }
  const TAPE = '#ffe14a'

  /* A strip of torn masking tape holding the picture to the page. */
  function tapePath(el, b) {
    const rand = rng((el.seed || 1) ^ 0x9e3779b9)
    const w = Math.max(44, Math.min(120, b.w * 0.34)), h = 22
    const cx = b.x + b.w / 2 + (rand() - 0.5) * b.w * 0.12, cy = b.y + 2
    const ang = ((rand() - 0.5) * 9 * Math.PI) / 180
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2]]
    for (let i = 1; i < 5; i++) pts.push([w / 2 + (i % 2 ? 3 : -1) * (0.6 + rand()), -h / 2 + (h * i) / 5])
    pts.push([w / 2, h / 2], [-w / 2, h / 2])
    for (let i = 4; i > 0; i--) pts.push([-w / 2 + (i % 2 ? -3 : 1) * (0.6 + rand()), -h / 2 + (h * i) / 5])
    const cos = Math.cos(ang), sin = Math.sin(ang)
    const p = new Path()
    polyPath(p, pts.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]))
    return String(p)
  }

  /* ---------- canvas renderer ---------- */

  const pathCache = new Map()
  const path2d = d => { let p = pathCache.get(d); if (!p) { p = new Path2D(d); if (pathCache.size > 4000) pathCache.clear(); pathCache.set(d, p) } return p }

  function dashFor(dash, width) {
    if (dash === 'dashed') return [width * 4 + 5, width * 3 + 5]
    if (dash === 'dotted') return [0.1, width * 3 + 3]
    return []
  }

  function drawElement(ctx, el, dark) {
    ctx.save()
    if (el.opacity != null && el.opacity < 1) ctx.globalAlpha *= el.opacity
    if (el.angle) {
      const [cx, cy] = centre(el)
      ctx.translate(cx, cy)
      ctx.rotate(el.angle)
      ctx.translate(-cx, -cy)
    }
    if (el.type === 'text') {
      ctx.font = fontCss(el)
      ctx.fillStyle = ink(el.stroke, dark)
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = el.align || 'left'
      for (const t of textLines(el)) ctx.fillText(t.line, t.x, t.y)
      ctx.restore()
      return
    }
    if (el.type === 'image') {
      const b = bounds(el)
      const src = imageSource(el.fileId)
      if (src?.img?.complete && src.img.naturalWidth) ctx.drawImage(src.img, b.x, b.y, b.w, b.h)
      else { ctx.fillStyle = dark ? '#2e2e2a' : '#e6e4dc'; ctx.fillRect(b.x, b.y, b.w, b.h) }
      if (el.tape !== false) {
        ctx.globalAlpha *= 0.72
        ctx.fillStyle = TAPE
        ctx.fill(path2d(tapePath(el, b)))
      }
      ctx.restore()
      return
    }
    const d = drawable(el)
    ctx.lineJoin = 'round'
    for (const f of d.fills) { ctx.fillStyle = ink(f.color, dark); ctx.fill(path2d(f.d)) }
    for (const s of d.strokes) {
      ctx.save()
      if (s.alpha) { ctx.globalAlpha *= s.alpha; ctx.globalCompositeOperation = dark ? 'screen' : 'multiply' }
      ctx.lineCap = s.cap || 'round'
      ctx.strokeStyle = ink(s.color, dark)
      ctx.lineWidth = s.width
      ctx.setLineDash(dashFor(s.dash, s.width))
      ctx.stroke(path2d(s.d))
      ctx.restore()
    }
    ctx.restore()
  }

  /* ---------- export ---------- */

  const PAPER = { light: '#f7f6f1', dark: '#161614' }
  const FONT_IMPORT = 'https://fonts.googleapis.com/css2?family=Shantell+Sans:wght@400;600&family=Bricolage+Grotesque:opsz,wght@12..96,400..700&display=swap'

  function renderPNG(els, { padding = 32, background = true, dark = false, scale = 2 } = {}) {
    const b = unionBounds(els) || { x: 0, y: 0, w: 1, h: 1 }
    const w = Math.ceil(b.w + padding * 2), h = Math.ceil(b.h + padding * 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    ctx.scale(scale, scale)
    if (background) { ctx.fillStyle = dark ? PAPER.dark : PAPER.light; ctx.fillRect(0, 0, w, h) }
    ctx.translate(padding - b.x, padding - b.y)
    for (const el of els) drawElement(ctx, el, dark)
    return canvas
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

  function renderSVG(els, { padding = 32, background = true, dark = false, embedFonts = true, images = true } = {}) {
    const b = unionBounds(els) || { x: 0, y: 0, w: 1, h: 1 }
    const w = Math.ceil(b.w + padding * 2), h = Math.ceil(b.h + padding * 2)
    const vx = r2(b.x - padding), vy = r2(b.y - padding)
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vx} ${vy} ${w} ${h}">`]
    if (embedFonts && els.some(e => e.type === 'text')) out.push(`<defs><style>@import url('${esc(FONT_IMPORT)}');</style></defs>`)
    if (background) out.push(`<rect x="${vx}" y="${vy}" width="${w}" height="${h}" fill="${dark ? PAPER.dark : PAPER.light}"/>`)
    for (const el of els) {
      let op = el.opacity != null && el.opacity < 1 ? ` opacity="${el.opacity}"` : ''
      if (el.angle) { const [cx, cy] = centre(el); op += ` transform="rotate(${r2((el.angle * 180) / Math.PI)} ${r2(cx)} ${r2(cy)})"` }
      if (el.type === 'text') {
        const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start'
        out.push(`<g${op} font-family="${esc(fontFamily(el.font))}" font-size="${el.fontSize}" fill="${ink(el.stroke, dark)}" text-anchor="${anchor}">`)
        for (const t of textLines(el)) out.push(`<text x="${r2(t.x)}" y="${r2(t.y)}" xml:space="preserve">${esc(t.line)}</text>`)
        out.push('</g>')
        continue
      }
      if (el.type === 'image') {
        const b = bounds(el)
        const href = images ? imageSource(el.fileId)?.dataUrl : null
        out.push(`<g${op}>`)
        if (href) out.push(`<image href="${esc(href)}" x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}" preserveAspectRatio="none"/>`)
        else out.push(`<rect x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}" fill="${dark ? '#2e2e2a' : '#e6e4dc'}"/>`)
        if (el.tape !== false) out.push(`<path d="${tapePath(el, b)}" fill="${TAPE}" opacity="0.72"/>`)
        out.push('</g>')
        continue
      }
      const d = drawable(el)
      out.push(`<g${op} stroke-linejoin="round">`)
      for (const f of d.fills) out.push(`<path d="${f.d}" fill="${ink(f.color, dark)}"/>`)
      for (const s of d.strokes) {
        const dash = dashFor(s.dash, s.width)
        const blend = s.alpha ? ` opacity="${s.alpha}" style="mix-blend-mode:${dark ? 'screen' : 'multiply'}"` : ''
        out.push(`<path d="${s.d}" fill="none" stroke="${ink(s.color, dark)}" stroke-width="${s.width}" stroke-linecap="${s.cap || 'round'}"${dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : ''}${blend}/>`)
      }
      out.push('</g>')
    }
    out.push('</svg>')
    return out.join('')
  }

  /* ---------- validation for anything loaded from storage, files or the clipboard ---------- */

  const COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i
  const num = (v, d = 0) => (Number.isFinite(v) ? Math.max(-1e7, Math.min(1e7, v)) : d)
  const oneOf = (v, list, d) => (list.includes(v) ? v : d)

  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || !TYPES.includes(raw.type)) return null
    const el = {
      id: typeof raw.id === 'string' && raw.id.length <= 40 ? raw.id : uid(),
      type: raw.type,
      x: num(raw.x), y: num(raw.y), w: num(raw.w), h: num(raw.h),
      stroke: COLOR.test(raw.stroke) ? raw.stroke : '#1d1d1b',
      bg: raw.bg === 'transparent' || COLOR.test(raw.bg) ? raw.bg : 'transparent',
      fill: oneOf(raw.fill, ['offset', 'solid', 'dots'], 'offset'),
      width: oneOf(raw.width, [1, 2, 4], 2),
      dash: oneOf(raw.dash, ['solid', 'dashed', 'dotted'], 'solid'),
      rough: oneOf(raw.rough, [0, 1, 2], 1),
      round: raw.round === true,
      opacity: Number.isFinite(raw.opacity) ? Math.max(0.1, Math.min(1, raw.opacity)) : 1,
      seed: Number.isInteger(raw.seed) ? raw.seed >>> 0 : newSeed(),
      v: Math.random(),
    }
    const angle = Number.isFinite(raw.angle) ? ((raw.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) : 0
    if (angle && ['rect', 'diamond', 'ellipse', 'text', 'image'].includes(el.type)) el.angle = angle
    if (['line', 'arrow', 'draw', 'mark'].includes(el.type)) {
      if (!Array.isArray(raw.points) || !raw.points.length) return null
      el.points = raw.points.slice(0, 20000).filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(p => [num(p[0]), num(p[1])])
      if (!el.points.length || ((el.type === 'line' || el.type === 'arrow') && el.points.length < 2)) return null
      if (el.type === 'arrow') {
        el.start = oneOf(raw.start, HEADS, 'none')
        el.end = oneOf(raw.end, HEADS, 'triangle')
      }
    }
    if (el.type === 'image') {
      if (typeof raw.fileId !== 'string' || !/^[a-z0-9]{6,40}$/.test(raw.fileId)) return null
      el.fileId = raw.fileId
      el.tape = raw.tape !== false
    }
    if (el.type === 'text') {
      el.text = typeof raw.text === 'string' ? raw.text.slice(0, 20000) : ''
      if (!el.text.trim()) return null
      el.fontSize = Math.max(6, Math.min(400, num(raw.fontSize, 24)))
      el.font = oneOf(raw.font, ['hand', 'sans'], 'hand')
      el.align = oneOf(raw.align, ['left', 'center', 'right'], 'left')
    }
    return el
  }

  const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
  function uid(n = 12) { return Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPHABET[b % ALPHABET.length]).join('') }

  window.Scrawl = {
    TYPES, SHAPES, LINE_HEIGHT, PAPER,
    fontFamily, fontCss, newSeed, uid,
    bounds, aabb, unionBounds, hitTest, measureText, rotate, toLocal,
    drawElement, renderPNG, renderSVG, ink, sanitize, setImageSource,
  }
})()
