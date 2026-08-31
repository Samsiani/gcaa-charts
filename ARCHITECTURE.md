# LiteStats Pro — Architecture & Code Map

A code-focused reference. Read this **before** changing menu labels, page slugs, asset enqueues, the save flow, or anything that touches `wp_localize_script`. Most "dumb bugs" in this plugin come from one of the gotchas listed at the end of this file.

---

## 1. File map

```
litestats-pro.php             Plugin bootstrap. Singleton, constants, dependency loading.
includes/
  class-activator.php         (de)activation hooks, table creation, CPT migration.
  class-admin.php             Admin menu + asset enqueue + editor page render.
  class-ajax.php              4 admin-ajax handlers: save / load / delete / get_charts.
  class-data-handler.php      DB CRUD + sanitize_config / sanitize_settings.
  class-shortcode.php         Frontend [litestats id="..." view="..."] rendering.
  class-updater.php           GitHub release polling auto-updater (24h cache).
templates/
  admin-charts-list.php       Admin "All Charts" page markup.
  admin-dashboard.php         Editor markup (toolbar, grid, preview, config panel).
assets/css/
  admin-style.css             Admin editor styling.
  frontend-style.css          Public chart wrapper styling.
assets/js/
  admin-app.js                Main admin app (state + grid + save/load + chart preview).
  frontend-app.js             Public Chart.js render + table view.
  modules/
    state.js                  Undo/redo stack helper.
    math-engine.js            Formula evaluator (=A+B, =SUM(B), IF, etc).
    grid-ui.js                Table grid render + column drag/drop.
    csv-wizard.js             3-step CSV import modal.
    conditional-format.js     Cell colorization rules.
.github/workflows/release.yml Tag-driven release: zips plugin and attaches to GH release.
```

---

## 2. Bootstrap

- `litestats-pro.php` declares constants and singleton `LiteStatsPro`.
- Singleton hooks `plugins_loaded` → `init_components()`:
  1. DB version check → `Activator::create_table()` / `migrate_from_cpt()` if stale.
  2. Always: `new DataHandler()`, `new Shortcode($data_handler)`.
  3. Admin only (`is_admin()`): `new Admin()`, `new Ajax($data_handler)`.
- `Updater` is instantiated unconditionally at the bottom of the bootstrap file.

```
LiteStatsPro::get_instance()
├── DataHandler   (always)
├── Shortcode     (always)
├── Admin         (admin only)
└── Ajax          (admin only)
```

---

## 3. Menu + asset enqueue (the trap zone)

`Admin::register_admin_menu()` registers:

| Slug                       | Parent           | Hook suffix shape (WP-derived)                  |
|----------------------------|------------------|-------------------------------------------------|
| `litestats-pro`            | top-level        | `toplevel_page_litestats-pro`                   |
| `litestats-pro` (submenu)  | `litestats-pro`  | `<sanitize_title(menu_title)>_page_litestats-pro` |
| `litestats-pro-new`        | `litestats-pro`  | `<sanitize_title(menu_title)>_page_litestats-pro-new` |
| `litestats-pro-edit`       | `null` (hidden)  | `admin_page_litestats-pro-edit`                 |

> ⚠ **GOTCHA — submenu hook prefix is derived from the parent menu's *title***, not the slug. Renaming `add_menu_page()`'s title from "LiteStats Pro" to "GCAA Charts" silently changes hooks from `litestats-pro_page_*` to `gcaa-charts_page_*`. Hard-coded prefix checks in `enqueue_admin_assets()` then skip → editor renders unstyled (this exact bug shipped in v6.5.2 and was fixed in v6.5.3).

### How we avoid it now

```php
// Capture every page hook returned by add_(menu|submenu)_page().
$this->page_hooks[] = add_menu_page(...);
$this->page_hooks[] = add_submenu_page(...);
// In enqueue_admin_assets():
if ( ! in_array( $hook_suffix, $this->page_hooks, true ) ) return;
```

For editor-only assets (Chart.js, modules) we additionally narrow by `?page=` slug, **not** hook suffix:

```php
$current_page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
$editor_slugs = [ self::PAGE_SLUG . '-new', self::PAGE_SLUG . '-edit' ];
if ( in_array( $current_page, $editor_slugs, true ) ) { /* enqueue chart.js etc */ }
```

This is immune to future menu-title changes.

### CDN scripts

`script_loader_tag` filter injects an SRI hash on the `chartjs` handle. If you bump Chart.js version, **regenerate the hash** at `Admin::add_script_integrity()` or browsers will refuse the script.

---

## 4. Data flow — from CSV import to public render

### Shape

```
DB row (table: {prefix}litestats_charts)
{
  id, title,
  config:   JSON  { cols: [{id,name,type,formula,width,props}], rows: [[..cells..]] }
  settings: JSON  { chartType, theme, stacked, view, chartLabelCol, chartDataCols,
                    xAxisLabel, yAxisLabel, showLegend, showDataLabels,
                    seriesColors, tableRowsPerPage, tableShowSearch,
                    tableShowExport, tableStriped, conditionalRules,
                    fillArea, lineTension, beginAtZero, pieMaxWidth, groupByCol }
  created_at, updated_at, author_id
}
```

### Save (admin)

```
admin-app.js  saveChart()
   │  $.ajax POST → admin-ajax.php
   ▼
Ajax::save_chart()                      [verify_request(): nonce + caps]
   ├── chart_id == 0 → DataHandler::create_chart()
   └── chart_id  > 0 → DataHandler::update_chart()
   ▼
DataHandler::sanitize_config()  →  wp_json_encode  →  $wpdb->insert/update
   ▼
JSON response { success: true, data: { chart_id, nonce } }
   ▼
admin-app.js: setTimeout 600ms → window.location.replace(reloadUrl + '&_ts=...')
   ▼
PHP renders editor for the new URL → enqueue_admin_assets() →
   DataHandler::get_chart(chart_id) → wp_localize_script('liteStatsProAdmin', ['chartData' => $row])
   ▼
admin-app.js initState():
   if (liteStatsProAdmin.chartData?.config) → app.cols/rows ← chartData.config
   else                                      → app.cols/rows ← getDefaultCols/Rows  (the demo data!)
```

> ⚠ **GOTCHA — Save → reload → demo data = caching.** `wp_localize_script` embeds the chart payload directly in the rendered HTML. Any layer that caches the editor page (LiteSpeed Cache, Cloudflare, browser bf-cache) will re-deliver an old snapshot where `chartData` was `null`, and the JS falls back to the **Laptop/Phone/Tablet demo rows**. Symptoms: "I just saved but the table is back to defaults; after a few minutes / multiple refreshes my data appears."
>
> **Mitigations now in place** (v6.5.5+):
> - `Admin::render_editor_page()` calls `nocache_headers()` and emits `X-LiteSpeed-Cache-Control: no-cache`.
> - `admin-app.js saveChart()` appends `&_ts=Date.now()` to the reload URL and uses `window.location.replace()` (not `href = href`, which can be a no-op or hit bf-cache).
>
> **Don't ever** assume that `wp_localize_script` is "fresh per request" without confirming there's no full-page cache in front.

> ⚠ **GOTCHA — `update_chart()` truthy ≠ row changed.** `$wpdb->update()` returns `0` for "no rows changed" and `false` for SQL error. The current code does `false !== $result`, which is correct, but: if you ever start branching on "the row was modified", remember `0` is success-but-no-change.

> ⚠ **GOTCHA — numeric-looking strings are identifiers, not quantities.** `sanitize_config()` used to
> do `if ( is_numeric( $cell ) ) return $cell + 0;`. PHP says `is_numeric("000001")` is true, so a
> certificate / registration number saved as `000001` was permanently rewritten to the integer `1`
> **in the database** — same for `007`, `+5`, `1e3`, `01.50` and integers wider than PHP can hold.
> Since v6.5.6 `DataHandler::sanitize_cell()` only folds a numeric string into a number when the round
> trip is lossless (`(string)($s + 0) === trim($s)`); everything else keeps its text.
>
> The display layer had the same defect twice over: both `formatValue()` implementations called
> `parseFloat()`, which happily returns `1` for `"000001"` and `4` for `"4D"`. Both now parse with a
> strict `Number(trimmed)` and fall back to the verbatim text when the value is not a clean finite
> number, or when the number cannot round-trip back to the same text. Columns that explicitly ask for
> formatting (`currency`, `percentage`, or an explicit `props.precision`) still format.
>
> **The two `formatValue()` copies must stay in sync** — `assets/js/frontend-app.js` (escapes its
> output) and `assets/js/modules/grid-ui.js` (does not; `renderGrid()` escapes at the call site).
> `csv-wizard.js` mirrors the same rule at import time in `toNumberOrText()` and refuses to type a
> leading-zero column as `number`.

> ⚠ **GOTCHA — the admin grid input holds two different values.** `renderGrid()` writes the *formatted*
> value into `<input value="…">` and the change handler wrote `this.value` straight back as the cell
> data, so tabbing through a currency or date cell stored `"$1,200.00"` / `"03/12/2021"` as the value.
> Since v6.5.6 the raw value lives in `data-raw`; `focus` swaps it in, `change` updates `data-raw`, and
> `blur` swaps the formatted value back.

> ⚠ **GOTCHA — `! empty($config)`.** `update_chart()` only writes the `config` column if `! empty( $config )`. An incoming empty-array config would silently leave the old config in the DB while the save still returns success. Currently fine because the JS always sends a populated object; revisit if you add a "clear data" feature.

### Render (frontend)

```
[litestats id="42" view="chart"]   (Shortcode::render)
   ▼
DataHandler::get_chart(42)
   ▼
HTML wrapper + canvas + JSON data attribute
   ▼
frontend-app.js reads data-* → new Chart(ctx, {...})
```

### Tooltip — Chart.js v4 quirk

> ⚠ **GOTCHA — pie/doughnut tooltip title is empty by default in Chart.js v4.** The slice label (e.g. country name) does **not** appear unless we provide a `title` callback. Both `admin-app.js` and `frontend-app.js` set:
>
> ```js
> tooltip: { callbacks: {
>   title: items => items[0].label || '',
>   label: ctx => /* value (pct%) for pie, "name: value" otherwise */
> } }
> ```
>
> If the title is missing in a tooltip after a Chart.js bump, check this callback first.

---

## 5. AJAX endpoints (`admin-ajax.php`)

All require `manage_options` + nonce `litestats_pro_nonce`. Defined in `Ajax::init_hooks()`.

| Action                       | Handler                  | Inputs                                     | Returns                              |
|------------------------------|--------------------------|--------------------------------------------|--------------------------------------|
| `litestats_save_chart`       | `Ajax::save_chart`       | chart_id, title, config(JSON), settings(JSON) | `{ chart_id, nonce }`                |
| `litestats_load_chart`       | `Ajax::load_chart`       | chart_id                                   | full chart row                       |
| `litestats_delete_chart`     | `Ajax::delete_chart`     | chart_id                                   | `{ success }`                        |
| `litestats_get_charts`       | `Ajax::get_charts`       | (none)                                     | array of charts                      |

`verify_request()` checks both nonce and `current_user_can('manage_options')`. Any new endpoint **must** call it.

---

## 6. Admin app state (admin-app.js)

```
LiteStatsApp = {
  app: { cols: [...], rows: [[...]], settings: {...}, selectedCol: int|null },
  chart: <Chart.js instance>,
  themes: { default, modern, pastel, dark }
}
```

Top-level lifecycle:

```
LiteStatsApp.init()
├── initState()                ← reads liteStatsProAdmin.chartData OR getDefaultCols/Rows
├── LiteStatsMathEngine.recalcAll(app)
├── LiteStatsState.saveState(app)
├── renderGrid()               ← delegates to LiteStatsGridUI
├── bindEvents()               ← toolbar, grid, formula bar, preview controls, save
├── updateStatus()
├── selectColumn(1)
├── updateChartConfigUI()
├── syncTableSettingsUI()
├── syncChartPolishUI()
└── renderCondRules()
```

### Default state seed

```js
getDefaultCols(): Product, 2023 Sales, 2024 Sales, Growth(formula)
getDefaultRows(): Laptop/Phone/Tablet
```

These three rows are the canary for the "save not loading" cache bug — if the user reports "Laptop/Phone/Tablet appearing after I saved my CSV", it's the cache symptom from §4.

### State / undo / redo (`modules/state.js`)

`LiteStatsState.saveState(app)` snapshots `cols + rows + settings` onto a stack; undo/redo pop/push. Triggered after every mutating user action.

### Math engine (`modules/math-engine.js`)

Evaluates formulas referenced by **column letter** (A, B, C…) and **cell ref** (A1, B3). Functions: SUM, AVG, MIN, MAX, IF, ABS, ROUND, COUNT.

> ⚠ **GOTCHA — formula migration.** Earlier versions stored formulas with `{column-id}` tokens. `migrateOldFormulas()` rewrites those to letters on init by walking `cols[].formula`. If you change column ID format, re-test this migration path.

### Grid (`modules/grid-ui.js`)

Pure-DOM table render with column drag/drop, type-change dropdown, per-cell input. Calls back into `LiteStatsApp` via `onCellChange`, `onMoveCol`, etc. — **all mutations go through admin-app.js** so undo/redo and formula recalc stay consistent.

### CSV import (`modules/csv-wizard.js`)

3-step modal: file → preview & type-map → confirm. `readFile()` uses `FileReader.readAsText()` and detects `,` `;` `\t` delimiters. Output: `{ cols, rows }` callback into the host app.

> ⚠ **GOTCHA — only CSV/TSV/TXT today.** xlsx/ods support is not implemented. Adding it would require a client-side parser (SheetJS) loaded from CDN with SRI. If you wire that up, also widen the `accept=` attributes on `#csvInput` and `#csvWizardFile` and route xlsx into `XLSX.read → AOA → existing parsedRows pipeline` (skip delimiter detection).

---

## 7. Frontend (`frontend-app.js`)

- Walks every `.litestats-chart-wrapper` in the page.
- Reads `data-config` / `data-settings` JSON.
- For chart view: instantiates Chart.js with the same tooltip / scale / legend logic mirrored from admin (keep the two in sync).
- For table view: paginated table, optional search, optional CSV export.

> ⚠ **GOTCHA — only `.litestats-table-scroll` may scroll sideways.** The table markup is
> `.litestats-table-wrapper` (card) → `.litestats-table-toolbar` + `.litestats-table-viewport` >
> `.litestats-table-scroll` > `<table>` + `.litestats-pagination`. Up to v6.5.5 the table was a direct
> child of the wrapper and the wrapper was `overflow: visible` (only becoming `overflow-x: auto` under
> `max-width: 768px`), so on desktop a wide table simply spilled out past the card while the toolbar and
> pagination stayed at the card's width — the "table body is wider than the top and bottom" report.
> If you add anything to the table view, put it **outside** the scroll box or it will scroll away.
>
> - The scroll box is created by `Shortcode::render_shortcode()` **and**, defensively, by
>   `setupTableScroll()` in `frontend-app.js` — a page served from LiteSpeed / Cloudflare cache can
>   still be pre-6.5.6 HTML in which the divs are absent.
> - `th` is `white-space: normal` (was `nowrap`): ten nowrap Georgian headers alone forced the live
>   gcaa.ge table to ~2040px.
> - Every `td` paints its own `background`, and striping/hover target `td` rather than `tr`. This is
>   what keeps the sticky first column opaque; `background: inherit` on a `<td>` does **not** work.
>   Conditional formatting writes inline styles, so it still wins.
> - `.litestats-pagination:empty { display: none }` — otherwise a single-page table kept a floating
>   `border-top` under itself.

> ⚠ **GOTCHA — admin and frontend Chart.js configs drift.** Tooltip callbacks, scale config, and legend options are duplicated in both `admin-app.js` and `frontend-app.js`. If you add a tooltip feature, edit **both**. The pie-tooltip-title fix (v6.5.4) had to ship in both.

---

## 8. Updater (`class-updater.php`)

- Polls `https://api.github.com/repos/Samsiani/gcaa-charts/releases/latest` (24h transient cache).
- Compares `tag_name` (without `v`) against `LITESTATS_PRO_VERSION` via `version_compare`.
- If newer: injects a row into `pre_set_site_transient_update_plugins` so the WP core "Update available" UI works.

> ⚠ **GOTCHA — bump version in TWO places** in `litestats-pro.php`:
> 1. `* Version: X.Y.Z` (header comment — what WordPress shows)
> 2. `define( 'LITESTATS_PRO_VERSION', 'X.Y.Z' );` (what the updater compares against)
>
> Forgetting #2 → the site never sees an update is available even after a tag is pushed.

> ⚠ **GOTCHA — release ZIP folder name.** `release.yml` stages into `staging/litestats-pro/` and zips that. The folder name inside the ZIP **must remain `litestats-pro/`** because that's the plugin slug WP uses to find the plugin. Renaming the staging folder will break in-place auto-updates.

---

## 9. Activator + DB schema (`class-activator.php`)

```sql
CREATE TABLE {prefix}litestats_charts (
  id           BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(255),
  config       LONGTEXT,             -- JSON
  settings     LONGTEXT,             -- JSON
  author_id    BIGINT(20) UNSIGNED,
  created_at   DATETIME,
  updated_at   DATETIME,
  KEY author_id (author_id)
);
```

`DB_VERSION` constant + `litestats_pro_db_version` option drive upgrades. CPT-era charts (`litestats_chart` post type) are migrated once on first run.

---

## 10. Shortcode

```
[litestats id="42" view="chart"]   ← Chart.js render
[litestats id="42" view="table"]   ← Paginated HTML table
```

`Shortcode::render()`:
- `current_user_can('read')` not required (public render).
- Loads chart by ID via `DataHandler::get_chart()`.
- Caps query count via `did_action('wp_enqueue_scripts')` to enqueue the frontend bundle once.
- Outputs a `<div data-config data-settings>` consumed by `frontend-app.js`.

---

## 11. Release process (binding)

See `CLAUDE.md` for the user-facing rules. Key constraints:

- **Tag triggers release.** Push `vX.Y.Z` → `release.yml` zips and uploads automatically. Never run `gh release create` manually.
- **ZIP folder name** must stay `litestats-pro/`.
- Auto-updater needs the published release to be **non-draft, non-prerelease**.
- Bump version in **both places** (§8).

---

## 12. Cheatsheet — symptoms → first place to look

| Symptom                                                             | Likely cause                                                | File / line                              |
|---------------------------------------------------------------------|-------------------------------------------------------------|------------------------------------------|
| Editor renders unstyled, no JS behavior                             | Hook-suffix mismatch after menu rename                      | `class-admin.php enqueue_admin_assets()` |
| Save succeeds, refresh shows demo data, eventually shows real data  | Page cache (LSCache / CF) caching wp_localize_script payload| `class-admin.php render_editor_page()` + `admin-app.js saveChart()` |
| Pie/doughnut tooltip missing slice label                            | Chart.js v4 default — needs explicit `title` callback       | `admin-app.js` + `frontend-app.js` tooltip block |
| "Update available" never shows in WP                                | Forgot to bump `LITESTATS_PRO_VERSION` define               | `litestats-pro.php`                      |
| Chart preview broken in admin but public render fine                | admin/frontend Chart.js configs drifted                     | `admin-app.js` vs `frontend-app.js`      |
| Chart.js fails to load (browser blocks integrity)                   | SRI hash stale after CDN bump                               | `class-admin.php add_script_integrity()` |
| `litestats-pro-edit` page asset missing                             | Tried to gate by hook prefix; hidden submenus use `admin_page_*` regardless of parent title — gate by `?page=` slug instead | `class-admin.php`                        |
| Leading zeros vanish (`000001` saves as `1`)                          | `sanitize_config()` folded numeric strings with `$cell + 0`  | `class-data-handler.php sanitize_cell()`  |
| A value like `4D` or `1,234` renders as `4` / `1`                    | `parseFloat()` in `formatValue()` truncates at the first non-numeric character | `frontend-app.js` + `grid-ui.js formatValue()` |
| Editing a currency/date cell stores the formatted text as data       | Grid input showed the formatted value and wrote it back      | `grid-ui.js attachGridEvents()` (data-raw)|
| Table is wider than the toolbar/pagination and spills past the card  | Table not inside `.litestats-table-scroll`                   | `class-shortcode.php` + `frontend-style.css` |
| Sticky first column is see-through while scrolling                   | Background painted on `tr`, not `td`                         | `frontend-style.css .litestats-table td`  |
| Table-view inside editor overlaps `.chart-controls`                 | `.chart-wrapper` has fixed `height: 320px`; #tablePreviewBox needs to scroll inside it | `assets/css/admin-style.css`             |
| Save reload doesn't reload (browser bf-cache, same-URL no-op)       | `window.location.href = href` is unreliable                 | `admin-app.js` — use `replace()` + `_ts` |

---

## 13. When in doubt

1. **Don't trust hook suffixes.** Capture them or match by `?page=` slug.
2. **Don't trust caches.** Anything embedded by `wp_localize_script` lives in the rendered HTML and inherits whatever cache headers that HTML response has. Send `nocache_headers()` on dynamic editor pages.
3. **Don't change a Chart.js option in one file.** Mirror to admin and frontend.
4. **Don't bump version in one place.** Two places, every release.
5. **Don't merge admin and frontend conventions.** Admin requires capability checks + nonces; frontend is public.
