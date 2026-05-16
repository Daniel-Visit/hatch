# Hatch — Plan de Mejoras y Correcciones

> Plan ejecutable de mejoras para la app Hatch. Complementa `SPEC.md` (qué se construye) y `README.md` (cómo correrlo).
> Priorizado por impacto en primera impresión y conversión.

---

## 1. 🎯 Card UI Cleanup — Primera Impresión Profesional

> **Este es el cambio visual de mayor impacto.** Los cards son el 80% de lo que un usuario ve al llegar. Si el primer vistazo no comunica "plataforma seria para builders", perdemos conversión antes de que lean nada.

### 1.1 — Diagnóstico: Actual vs Objetivo

#### Actual (BentoCard)
- Arte procedural **full-bleed** con gradientes saturados como fondo completo
- **Emojis gigantes** (🍣🔥🪩🎤) como glyph central — se siente "juguetón"
- **Gradient overlay** oscuro sobre la parte inferior para texto blanco
- Título y descripción **flotando sobre la imagen**
- Likes en **pill frosted** (`backdrop-filter: blur`) flotante
- Tags en pills frosted sobre el overlay
- Category badge posicionada **floating** sobre la esquina superior
- **Aspecto ratio 4:5** (vertical alto) — ocupa mucho espacio visual
- **Sin separación clara** entre zona de preview y zona de información

#### Objetivo (CleanCard — estilo gallery profesional)
- **Fondo blanco/surface** limpio con borde sutil
- Preview/screenshot **contenido dentro** de un área con padding y border-radius interno
- **Separación clara**: zona de imagen ARRIBA → zona de texto ABAJO
- Título + autor en texto oscuro sobre fondo claro, **no sobre la imagen**
- Stats discretos y `--muted`, no en pills prominentes
- Category badge como **pill sutil abajo**, no overlay flotante
- **Aspecto ratio más horizontal** (16:10 o 3:2) — más eficiente en el grid
- **Más whitespace** — respira, se siente premium

### 1.2 — Estructura Propuesta del Card

```
┌──────────────────────────────┐
│  ┌────────────────────────┐  │  ← padding: 8-10px
│  │                        │  │
│  │   App Art (procedural) │  │  ← border-radius interno, contained
│  │   Glyph centrado       │  │     aspect-ratio: 16/10
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  App Name              ♥ 2.2k│  ← título + stats en la misma línea
│  Author Name                 │  ← avatar + display_name
│                              │
│  One-line description text   │  ← tagline truncada, color muted
│                              │
│  ┌─────────┐ ┌────────────┐  │
│  │ Tag1    │ │ Tag2       │  │  ← tags sutiles, sin frosted
│  └─────────┘ └────────────┘  │
│                              │
│  ⊙ Category                  │  ← badge muted abajo
└──────────────────────────────┘
```

### 1.3 — Cambios CSS (`prototype-cards.css`)

| Propiedad | Actual (Bento) | Propuesto (Clean) |
|-----------|---------------|-------------------|
| `.card` border-radius | `20px` | `var(--r-lg)` (18px) |
| `.card` aspect-ratio | `4/5` (vertical) | **Eliminar** — contenido dicta la altura |
| Preview container | Absoluto full-bleed | **Relative con padding** (`8px`) + `border-radius: var(--r-md)` interno |
| Gradient overlay | `linear-gradient(to top, rgba(0,0,0,0.75)...)` | **Eliminar** |
| Title color | `#fff` (sobre overlay) | `var(--text)` (sobre surface) |
| Tagline color | `rgba(255,255,255,0.88)` | `var(--muted)` |
| Likes pill | Frosted pill flotante | Inline con título: `♥ 2.2k` en `--muted`, `var(--mono)` |
| Tags | `tag-frost` (vidrio) | `.tag` estándar (surface-2 bg, border, muted) |
| Category badge | Absoluta top-left sobre imagen | Abajo del card, inline, discreto |
| Author | Sobre overlay, blanco | Debajo del título, `var(--text-2)`, avatar pequeño |
| Card body padding | `18px` | `14px 16px` |

### 1.4 — Cambios en Componentes

```diff
  // ANTES (BentoCard) — cards.tsx:
- <div className="card card-bento">
-   <div className="bento-art"><AppArt /></div>
-   <div className="bento-cat"><CategoryBadge /></div>
-   <div className="bento-overlay">          ← gradient overlay
-     <h3 className="card-title">{title}</h3> ← blanco sobre oscuro
-     <span className="bento-likes">♥ 2.2k</span>
-     <p className="card-tagline">{tagline}</p>
-     <button className="card-author">{author}</button>
-   </div>
- </div>

  // DESPUÉS (CleanCard):
+ <div className="card card-clean">
+   <div className="card-preview-wrap">      ← contenedor con padding
+     <AppArt />                             ← arte contenido
+   </div>
+   <div className="card-body">              ← fondo claro, texto oscuro
+     <div className="card-title-row">
+       <h3 className="card-title">{title}</h3>
+       <span className="card-stats">♥ {likes}</span>
+     </div>
+     <button className="card-author">
+       <Avatar size={20} /> {author}
+     </button>
+     <p className="card-tagline">{tagline}</p>
+     <div className="card-tags">{tags}</div>
+     <CategoryBadge />
+   </div>
+ </div>
```

### 1.5 — Ajustes al Arte Procedural

El arte procedural es un **diferenciador** de Hatch — NO se elimina. Se ajusta la presentación:

1. **Contener** dentro de recuadro con `border-radius: var(--r-md)` y margen `8px`
2. **Reducir glyph size** de `78px` a `48-56px`
3. **Opacity del glyph** → `0.85` para ser más sutil
4. **Aspect ratio** de `4:5` a `16:10` — más apaisado, más "screenshot-like"
5. El arte es placeholder — las apps subirán screenshots reales vía cover upload

### 1.6 — Grid

```css
/* Propuesto — cards más anchas, más breathing room */
.grid {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
```

### 1.7 — Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `app/_components/cards.tsx` | Crear `CleanCard` o refactorear `BentoCard` |
| `app/styles/prototype-cards.css` | Agregar `.card-clean` o modificar `.card-bento` |
| `app/_components/gallery-grid.tsx` | Cambiar `<BentoCard>` → `<CleanCard>` |
| `app/_components/app-art.tsx` | Sin cambios — arte se mantiene, solo se contiene |

### 1.8 — Lo que NO cambia

- ✅ Design tokens (colores, radii, shadows, fonts)
- ✅ Arte procedural (se contiene, no se elimina)
- ✅ Hover effect (translateY + shadow)
- ✅ Hero section (FeaturedHero main + 2 minis)
- ✅ Shell / topbar / sidebar
- ✅ Dark/light theme
- ✅ Detail, profile, publish, messages screens

---

## 2. Inconsistencias Detectadas

### 2.1 — Arquitectura vs Implementación

| Issue | Detalle | Prioridad |
|-------|---------|-----------|
| SPEC menciona Resend/Email (§10) | Fase 8 fue cortada — no hay email. Web Push absorbe ese rol. SPEC aún documenta email templates | P2 — actualizar SPEC |
| SPEC layout vs actual | SPEC dice `(marketing)/` y `(app)/`. Real usa `(auth)/` y `(shell)/` | P3 — doc |
| 5 card variants en código | SPEC dice "production ships classic card". Gallery usa BentoCard | P0 — resolver con CleanCard |
| bcryptjs dependency | Presente en web y mcp package.json, pero no se usa (API keys usan SHA-256) | P1 — eliminar |
| globals.css vs prototype-base.css | globals.css define tokens mínimos, prototype-base.css redefine todo. globals.css es dead code | P1 — limpiar |
| Tailwind v4 instalado | `@tailwindcss/postcss` v4 está instalado pero CSS es 100% vanilla prototype classes | P1 — evaluar |
| 6 Google Fonts cargadas | Solo Geist + Geist Mono se usan. Space Grotesk, Inter, JetBrains Mono, IBM Plex Mono = peso muerto (~200KB+) | P1 — eliminar |

### 2.2 — Datos Hardcoded

| Issue | Ubicación | Fix |
|-------|-----------|-----|
| Search count "248 apps" | `shell.tsx` topbar placeholder | Query dinámico count |
| Publish defaults "Slow Forge" | `publish-screen.tsx` | Vaciar defaults |
| Contact modal "slope.fund" | `contact-modal.tsx` | Usar datos reales del viewer |
| views_count siempre 0 | DB column existe pero no hay tracking | Implementar view tracking o remover stat |

---

## 3. Mejoras Técnicas

### Performance
- [ ] Eliminar 4 fonts no usadas de `fonts.ts` (Space Grotesk, Inter, JetBrains Mono, IBM Plex Mono)
- [ ] Eliminar `bcryptjs` de ambos package.json
- [ ] Limpiar `globals.css` (dead code)
- [ ] Evaluar eliminar Tailwind dependency (no se usa)
- [ ] Consolidar 5 CSS files (84KB+) → considerar merge o tree-shaking
- [ ] Lazy load: ContactModal, PublishScreen, NotificationsBell → `React.lazy()`
- [ ] Usar `<Image>` de Next.js en cards/art

### Code Quality
- [ ] Eliminar `as any` en layout.tsx
- [ ] Eliminar `as unknown as number` en publish-screen.tsx
- [ ] Cards: agregar `role="link"` + `tabIndex` (accessibility)
- [ ] Publish form: mostrar errores al usuario si `publishApp` falla

---

## 4. Mejoras UI/UX

### Experiencia General
- [ ] Sort tabs (Hot/New/Most loved) en gallery toolbar — SPEC las define, sidebar las tiene como links
- [ ] Onboarding sheet para completar perfil — mencionado en SPEC, no implementado
- [ ] Empty states consistentes en todas las páginas
- [ ] Usar sonner (toasts) para feedback visual en acciones (like, save, follow)
- [ ] Staggered fade-in animation para cards en el grid

### Flujo de Conversión
- [ ] Sign-in más prominente (no solo ghost link en topbar)
- [ ] Social proof — stats globales (total builders, total apps, conexiones)
- [ ] CTA "Publicar app" → explicar qué obtiene el usuario al registrarse

---

## 5. Mejoras para Móviles

### Issues Detectados
1. **Hero card muy alto** — ocupa todo el viewport, no se ven cards
2. **Category chips overflow** — wrappean a 3 líneas, demasiado espacio vertical
3. **No hay bottom navigation** — todo depende del hamburger menu
4. **Theme / locale toggle ocultos** — sin acceso en móvil
5. **Search oculta** — no hay forma de buscar en móvil

### Recomendaciones
- [ ] Hero compacto en móvil — stack vertical más corto, single featured card
- [ ] Category chips → horizontal scroll (no wrap multi-línea)
- [ ] Bottom tab bar — Discover / Search / Publish / Notifications / Profile
- [ ] Floating search button
- [ ] Modal sheets para notifications en móvil (en vez de dropdown)

---

## 6. SEO (Fase 13 pendiente)

- [ ] Sitemap dinámico
- [ ] robots.txt
- [ ] OG images con `@vercel/og`
- [ ] JSON-LD para apps (`SoftwareApplication`) — SPEC §15.4
- [ ] Meta descriptions dinámicas por ruta

---

## 7. Checklist Priorizado

### P0 — Primera Impresión (hacer primero)
- [ ] 🎯 **Card UI Cleanup** — Migrar BentoCard → CleanCard (Sección 1)
  - [ ] CSS `.card-clean` con preview contenido + body separado
  - [ ] Componente `CleanCard` en `cards.tsx`
  - [ ] `gallery-grid.tsx` usa `CleanCard`
  - [ ] Glyph reducido, arte contenido, overlay eliminado
- [ ] Limpiar publish form defaults (Slow Forge)
- [ ] Limpiar contact modal "slope.fund"
- [ ] Search count dinámico

### P1 — Limpieza Técnica
- [ ] Eliminar 4 fonts no usadas
- [ ] Eliminar bcryptjs
- [ ] Limpiar globals.css
- [ ] Evaluar eliminar Tailwind

### P2 — UX Polish
- [ ] Fase 13 (skeletons, error boundaries, OG images)
- [ ] Staggered card entry animations
- [ ] Mobile hero compacto
- [ ] Category chips horizontal scroll
- [ ] Mobile bottom nav

### P3 — SEO & Docs
- [ ] Sitemap + robots.txt
- [ ] OG images dinámicas
- [ ] JSON-LD structured data
- [ ] Actualizar SPEC.md (eliminar refs a email/Resend, corregir route groups)
