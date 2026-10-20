import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, ComposedChart, Line,
  PieChart, Pie, Cell, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import "./App.css";

/* ------------------------------------------------------------------ */
/* Config + helpers                                                    */
/* ------------------------------------------------------------------ */
const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const COLORS = ["#2F5BEA", "#14213D", "#5B9BFF", "#0E8FB8", "#7A8CFF", "#1E3A8A", "#38BDF8", "#3B4F9E", "#93B4FF", "#0F6E94", "#5A67D8", "#A5C4FF"];
const REG = { NA_Sales: "#14213D", EU_Sales: "#2F5BEA", JP_Sales: "#5B9BFF", Other_Sales: "#A9C8FF" };
const REG_NAME = { NA_Sales: "North America", EU_Sales: "Europe", JP_Sales: "Japan", Other_Sales: "Other regions" };
const EMPTY = { genre: [], platform: [], publisher: [], year_from: "", year_to: "", rank_from: "", rank_to: "", min_sales: "", max_sales: "", q: "" };
const NOFMT = new Set(["Year", "Rank", "First", "Last", "Peak", "Lifespan"]);
const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

const query = (f, extra = {}) => {
  const p = new URLSearchParams();
  Object.entries({ ...f, ...extra }).forEach(([k, v]) => {
    const s = Array.isArray(v) ? v.join("|") : v;
    if (s !== "" && s != null) p.set(k, s);
  });
  return p.toString();
};

function useApi(path, f, extra = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const key = `${path}?${query(f, extra)}`;
  useEffect(() => {
    let off = false;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      fetch(API + key)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((data) => !off && setState({ data, loading: false, error: null }))
        .catch((e) => !off && setState({ data: null, loading: false, error: e.message }));
    }, 250);
    return () => { off = true; clearTimeout(t); };
  }, [key]);
  return state;
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */
function Panel({ title, note, state, children, span, actions }) {
  const { data, loading, error } = state || { data: true };
  const empty = Array.isArray(data) && data.length === 0;
  return (
    <section className={"panel" + (span ? " span" : "")}>
      <header>
        <h3>{title}</h3>
        {actions}
      </header>
      {note && <p className="note">{note}</p>}
      {error ? (
        <p className="msg err">This view could not load (error {error}). Check that the API address is correct and the server is awake.</p>
      ) : loading && !data ? (
        <div className="skeleton" />
      ) : empty ? (
        <p className="msg">No games match these filters. Widen a filter to see data.</p>
      ) : (
        <div className={loading ? "fade" : ""}>{children(data)}</div>
      )}
    </section>
  );
}

function Table({ rows, cols, onSort, sort }) {
  return (
    <div className="scroll">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map(([k, l]) => (
              <th key={k} className={onSort ? "sortable" : ""} onClick={onSort ? () => onSort(k) : undefined}>
                {l}{sort?.key === k ? (sort.dir === "desc" ? " ▼" : " ▲") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map(([k]) => (
                <td key={k}>{typeof r[k] === "number" && !NOFMT.has(k) ? fmt(r[k]) : r[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heat({ rows, rk, ck, vk, show = fmt }) {
  const rs = [...new Set(rows.map((r) => r[rk]))];
  const cs = [...new Set(rows.map((r) => r[ck]))];
  const map = {};
  rows.forEach((r) => (map[r[rk] + "|" + r[ck]] = r[vk]));
  const mx = Math.max(...rows.map((r) => Math.abs(r[vk])), 0.0001);
  return (
    <div className="scroll">
      <table className="heat">
        <thead><tr><th />{cs.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rs.map((r) => (
            <tr key={r}>
              <th>{r}</th>
              {cs.map((c) => {
                const v = map[r + "|" + c];
                const a = v == null ? 0 : Math.abs(v) / mx;
                return (
                  <td key={c} style={{ background: `rgba(47,91,234,${a.toFixed(2)})`, color: a > 0.5 ? "#fff" : "inherit" }}>
                    {v == null ? "" : show(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 600;
const labelWidth = (data) => {
  const longest = Math.max(...data.map((d) => String(d.Group ?? "").length), 4);
  return Math.min(isNarrow() ? 112 : 176, Math.max(56, longest * 7 + 8));
};
const YTick = ({ x, y, payload, chars }) => {
  const full = String(payload.value);
  const text = full.length > chars ? full.slice(0, chars - 1) + "…" : full;
  return (
    <text x={x - 6} y={y} dy={4} textAnchor="end" fontSize={12} fill="#51638A">
      {text}
      <title>{full}</title>
    </text>
  );
};
const chartHeight = (n) => Math.max(300, n * (isNarrow() ? 30 : 34) + 44);

const HBar = ({ data, k = "Global", color = "#2F5BEA" }) => {
  const w = labelWidth(data);
  return (
    <ResponsiveContainer width="100%" height={chartHeight(data.length)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 20, top: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="Group" width={w} interval={0} tickLine={false} tick={<YTick chars={Math.floor(w / 6.6)} />} />
        <Tooltip cursor={{ fill: "#2f5bea14" }} />
        <Bar dataKey={k} fill={color} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const RegionStack = ({ data, pct }) => {
  const w = labelWidth(data);
  return (
    <ResponsiveContainer width="100%" height={chartHeight(data.length) + 20}>
      <BarChart data={data} layout="vertical" stackOffset={pct ? "expand" : "none"} margin={{ left: 4, right: 20, top: 4 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={pct ? (v) => `${Math.round(v * 100)}%` : undefined} />
        <YAxis type="category" dataKey="Group" width={w} interval={0} tickLine={false} tick={<YTick chars={Math.floor(w / 6.6)} />} />
        <Tooltip cursor={{ fill: "#2f5bea14" }} />
        <Legend formatter={(v) => REG_NAME[v] || v} />
        {Object.keys(REG).map((k) => <Bar key={k} dataKey={k} stackId="a" fill={REG[k]} barSize={18} />)}
      </BarChart>
    </ResponsiveContainer>
  );
};

const PieShare = ({ data, k = "Global", name = "Group" }) => (
  <ResponsiveContainer width="100%" height={300}>
    <PieChart>
      <Pie data={data} dataKey={k} nameKey={name} innerRadius={55} outerRadius={105} paddingAngle={2}>
        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip /><Legend />
    </PieChart>
  </ResponsiveContainer>
);

function pivot(rows, key = "Year", series = "Series", val = "Global") {
  const m = {}; const names = new Set();
  rows.forEach((r) => { (m[r[key]] ||= { [key]: r[key] })[r[series]] = r[val]; names.add(r[series]); });
  return { data: Object.values(m).sort((a, b) => a[key] - b[key]), names: [...names] };
}

const GAME_TABLE = [["Rank", "Rank"], ["Name", "Game"], ["Platform", "Platform"], ["Year", "Year"], ["Genre", "Genre"], ["Publisher", "Publisher"], ["NA_Sales", "NA"], ["EU_Sales", "EU"], ["JP_Sales", "JP"], ["Other_Sales", "Other"], ["Global_Sales", "Global"]];

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */
function Chips({ options, value, onChange }) {
  const toggle = (o) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o} type="button" className={"chip" + (value.includes(o) ? " on" : "")} onClick={() => toggle(o)}>{o}</button>
      ))}
    </div>
  );
}

function PublisherPicker({ options, value, onChange }) {
  const [t, setT] = useState("");
  const hits = useMemo(
    () => (t ? options.filter((o) => o.toLowerCase().includes(t.toLowerCase()) && !value.includes(o)).slice(0, 8) : []),
    [t, options, value]
  );
  return (
    <div>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Search a publisher" />
      {hits.length > 0 && (
        <ul className="hits">
          {hits.map((h) => <li key={h}><button type="button" onClick={() => { onChange([...value, h]); setT(""); }}>{h}</button></li>)}
        </ul>
      )}
      <div className="chips">
        {value.map((v) => <button key={v} type="button" className="chip on" onClick={() => onChange(value.filter((x) => x !== v))}>{v} ✕</button>)}
      </div>
    </div>
  );
}

function Filters({ f, setF, meta }) {
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const m = meta || { genres: [], platforms: [], publishers: [] };
  const range = (a, b, pa, pb) => (
    <div className="pair">
      <input type="number" inputMode="numeric" placeholder={pa} value={f[a]} onChange={(e) => set(a, e.target.value)} />
      <span>to</span>
      <input type="number" inputMode="numeric" placeholder={pb} value={f[b]} onChange={(e) => set(b, e.target.value)} />
    </div>
  );
  return (
    <div className="filters">
      <fieldset><legend>Genre</legend><Chips options={m.genres} value={f.genre} onChange={(v) => set("genre", v)} /></fieldset>
      <fieldset><legend>Platform</legend><Chips options={m.platforms} value={f.platform} onChange={(v) => set("platform", v)} /></fieldset>
      <fieldset><legend>Publisher</legend><PublisherPicker options={m.publishers} value={f.publisher} onChange={(v) => set("publisher", v)} /></fieldset>
      <fieldset><legend>Release year</legend>{range("year_from", "year_to", m.year_min ?? "from", m.year_max ?? "to")}</fieldset>
      <fieldset><legend>Rank</legend>{range("rank_from", "rank_to", m.rank_min ?? "from", m.rank_max ?? "to")}</fieldset>
      <fieldset><legend>Global sales (millions)</legend>{range("min_sales", "max_sales", "min", m.sales_max ? Math.round(m.sales_max) : "max")}</fieldset>
      <button type="button" className="ghost" onClick={() => setF(EMPTY)}>Clear all filters</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */
function Kpis({ f }) {
  const st = useApi("/summary", f);
  const s = st.data || {};
  const items = [
    ["Games", s.games], ["Total sales (M)", s.total], ["Average per game (M)", s.avg],
    ["Games over 1M sales", s.blockbusters], ["Best seller", s.best], ["Peak year", s.peak_year],
  ];
  return (
    <div className="kpis">
      {items.map(([k, v]) => (
        <div className="kpi" key={k}>
          <span>{k}</span>
          <strong title={String(v ?? "")}>{v == null ? "…" : typeof v === "number" && k !== "Peak year" ? fmt(v) : v}</strong>
        </div>
      ))}
    </div>
  );
}

function Overview({ f }) {
  const genre = useApi("/by", f, { dim: "Genre", top: 12 });
  const year = useApi("/by", f, { dim: "Year" });
  const plat = useApi("/by", f, { dim: "Platform", top: 10 });
  const reg = useApi("/regions", f);
  const top = useApi("/top-games", f, { n: 10 });
  return (
    <div className="grid">
      <Panel title="Global sales by genre (M)" state={genre}>{(d) => <HBar data={d} />}</Panel>
      <Panel title="Sales and releases by year" state={year}>
        {(d) => (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={d}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="Group" /><YAxis yAxisId="l" /><YAxis yAxisId="r" orientation="right" />
              <Tooltip /><Legend />
              <Area yAxisId="l" dataKey="Global" name="Sales (M)" stroke="#2F5BEA" fill="#2F5BEA33" />
              <Line yAxisId="r" dataKey="Games" name="Games released" stroke="#14213D" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel title="Top platforms (M)" state={plat}>{(d) => <HBar data={d} color="#5B8DEF" />}</Panel>
      <Panel title="Sales by region" state={reg}>{(d) => <PieShare data={d} k="Sales" name="Region" />}</Panel>
      <Panel title="Top 10 best-selling games" state={top} span>
        {(d) => <Table rows={d} cols={GAME_TABLE} />}
      </Panel>
    </div>
  );
}

const METRICS = [["Global", "Global sales (M)"], ["Games", "Number of games"], ["Avg", "Average per game (M)"], ["Share", "Market share (%)"], ["NA_Sales", "North America (M)"], ["EU_Sales", "Europe (M)"], ["JP_Sales", "Japan (M)"], ["Other_Sales", "Other regions (M)"]];
const DIM_COLS = [["Group", "Name"], ["Games", "Games"], ["Global", "Global (M)"], ["Share", "Share %"], ["Avg", "Avg per game"], ["NA_Sales", "NA"], ["EU_Sales", "EU"], ["JP_Sales", "JP"], ["Other_Sales", "Other"], ["Best", "Best seller"]];

function Dimension({ dim, label, f, keepOrder }) {
  const [metric, setMetric] = useState("Global");
  const [top, setTop] = useState(15);
  const st = useApi("/by", f, { dim, top });
  const sorted = (d) => (keepOrder ? d : [...d].sort((a, b) => b[metric] - a[metric]));
  const controls = (
    <div className="ctl">
      <select value={metric} onChange={(e) => setMetric(e.target.value)} aria-label="Metric">
        {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {!keepOrder && (
        <select value={top} onChange={(e) => setTop(+e.target.value)} aria-label="How many">
          {[10, 15, 25, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </select>
      )}
    </div>
  );
  return (
    <div className="grid">
      <Panel span title={`${label}: ranking`} state={st} actions={controls}>{(d) => <HBar data={sorted(d)} k={metric} />}</Panel>
      <Panel title="Sales by region (M)" state={st}>{(d) => <RegionStack data={d} />}</Panel>
      <Panel title="Regional mix (100%)" state={st}>{(d) => <RegionStack data={d} pct />}</Panel>
      {!keepOrder && <Panel title="Market share (top 8)" state={st}>{(d) => <PieShare data={d.slice(0, 8)} />}</Panel>}
      {!keepOrder && (
        <Panel title="Games vs average sales" note="Bubble size is total sales. Top-right means many games that each sell well." state={st}>
          {(d) => (
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="Games" name="Games" /><YAxis type="number" dataKey="Avg" name="Avg" />
                <ZAxis dataKey="Global" range={[40, 400]} />
                <Tooltip content={({ payload }) => payload?.[0] && (
                  <div className="tip"><b>{payload[0].payload.Group}</b><br />{payload[0].payload.Games} games, avg {payload[0].payload.Avg}M</div>
                )} />
                <Scatter data={d} fill="#3B4F9E" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </Panel>
      )}
      <Panel span title="Full table" state={st}>{(d) => <Table rows={d} cols={DIM_COLS} />}</Panel>
    </div>
  );
}

function Timeline({ f }) {
  const [by, setBy] = useState("Genre");
  const year = useApi("/by", f, { dim: "Year" });
  const decade = useApi("/by", f, { dim: "Decade" });
  const trend = useApi("/trend", f, { by, top: 8 });
  const life = useApi("/lifecycle", f);
  return (
    <div className="grid">
      <Panel title="Year-over-year change in sales (%)" state={year}>
        {(d) => (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Group" /><YAxis /><Tooltip />
              <Bar dataKey="YoY">{d.map((r, i) => <Cell key={i} fill={(r.YoY ?? 0) >= 0 ? "#5B8DEF" : "#14213D"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel title="Regional sales by year (M)" state={year}>
        {(d) => (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={d}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Group" /><YAxis /><Tooltip />
              <Legend formatter={(v) => REG_NAME[v]} />
              {Object.keys(REG).map((k) => <Area key={k} dataKey={k} stackId="r" stroke={REG[k]} fill={REG[k]} />)}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel span title="Sales by year, split by" state={trend}
        actions={<select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Split by"><option>Genre</option><option>Platform</option><option>Publisher</option></select>}>
        {(d) => {
          const { data, names } = pivot(d);
          return (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Year" /><YAxis /><Tooltip /><Legend />
                {names.map((n, i) => <Area key={n} dataKey={n} stackId="t" stroke={COLORS[i % 12]} fill={COLORS[i % 12]} fillOpacity={0.8} />)}
              </AreaChart>
            </ResponsiveContainer>
          );
        }}
      </Panel>
      <Panel title="Sales by decade (M)" state={decade}>{(d) => <HBar data={d} color="#1E3A8A" w={64} />}</Panel>
      <Panel title="Platform lifecycle" note="First year, peak year and last year with games in the filtered data." state={life}>
        {(d) => {
          const lo = Math.min(...d.map((r) => r.First)); const hi = Math.max(...d.map((r) => r.Last));
          const pos = (y) => `${((y - lo) / Math.max(hi - lo, 1)) * 100}%`;
          return (
            <div className="life">
              {d.map((r) => (
                <div key={r.Platform} className="lrow">
                  <span className="lname">{r.Platform}</span>
                  <div className="ltrack" title={`${r.First}-${r.Last}, peak ${r.Peak}`}>
                    <i style={{ left: pos(r.First), width: `max(4px, calc(${pos(r.Last)} - ${pos(r.First)}))` }} />
                    <b style={{ left: pos(r.Peak) }} />
                  </div>
                  <span className="lyears">{r.First}-{r.Last}</span>
                </div>
              ))}
              <p className="note">Dot marks the peak sales year.</p>
            </div>
          );
        }}
      </Panel>
    </div>
  );
}

function Regions({ f }) {
  const [r, setR] = useState("JP_Sales");
  const reg = useApi("/regions", f);
  const genre = useApi("/by", f, { dim: "Genre", top: 12 });
  const top = useApi("/top-games", f, { n: 10, sort: r });
  return (
    <div className="grid">
      <Panel title="Region totals (M)" state={reg}>
        {(d) => (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Region" /><YAxis /><Tooltip />
              <Bar dataKey="Sales">{d.map((x, i) => <Cell key={i} fill={REG[x.Key]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel title="Share of global sales" state={reg}>{(d) => <PieShare data={d} k="Sales" name="Region" />}</Panel>
      <Panel span title="Which genres sell where (100%)" state={genre}>{(d) => <RegionStack data={d} pct />}</Panel>
      <Panel span title="Best sellers in one region" state={top}
        actions={<select value={r} onChange={(e) => setR(e.target.value)} aria-label="Region">{Object.entries(REG_NAME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}>
        {(d) => <Table rows={d} cols={GAME_TABLE} />}
      </Panel>
    </div>
  );
}

function Rankings({ f }) {
  const [sort, setSort] = useState("Global_Sales");
  const [n, setN] = useState(25);
  const top = useApi("/top-games", f, { n, sort });
  const gems = useApi("/hidden-gems", f, { n: 10 });
  return (
    <div className="grid">
      <Panel span title="Top games" state={top} actions={
        <div className="ctl">
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Rank by">
            <option value="Global_Sales">Global</option><option value="NA_Sales">North America</option>
            <option value="EU_Sales">Europe</option><option value="JP_Sales">Japan</option><option value="Other_Sales">Other</option>
          </select>
          <select value={n} onChange={(e) => setN(+e.target.value)} aria-label="How many">{[10, 25, 50, 100].map((x) => <option key={x} value={x}>Top {x}</option>)}</select>
        </div>}>
        {(d) => <Table rows={d} cols={GAME_TABLE} />}
      </Panel>
      <Dimension dim="RankBand" label="Rank band" f={f} keepOrder />
      <Panel span title="Sleeper hits" note="Games ranked below 300 that sold many times more than a typical game on their platform." state={gems}>
        {(d) => <Table rows={d} cols={[["Rank", "Rank"], ["Name", "Game"], ["Platform", "Platform"], ["Genre", "Genre"], ["Year", "Year"], ["Global_Sales", "Global (M)"], ["Ratio", "x platform median"]]} />}
      </Panel>
    </div>
  );
}

function Explorer({ f }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "Rank", dir: "asc" });
  const sig = JSON.stringify(f);
  useEffect(() => setPage(1), [sig]);
  const st = useApi("/games", f, { page, size: 15, sort: sort.key, dir: sort.dir });
  const onSort = (k) => { setSort((s) => ({ key: k, dir: s.key === k && s.dir === "asc" ? "desc" : "asc" })); setPage(1); };
  return (
    <div className="grid">
      <Panel span title="Game explorer" note="Click a column heading to sort. Use the filters to narrow the list." state={st}>
        {(d) => d.total === 0 ? <p className="msg">No games match these filters. Widen a filter to see data.</p> : (
          <>
            <Table rows={d.rows} cols={GAME_TABLE} onSort={onSort} sort={sort} />
            <div className="pager">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {Math.ceil(d.total / 15)} ({d.total} games)</span>
              <button disabled={page >= Math.ceil(d.total / 15)} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function Insights({ f }) {
  const dist = useApi("/distribution", f);
  const cor = useApi("/correlation", f);
  const cl = useApi("/clusters", f);
  const mat = useApi("/matrix", f);
  return (
    <div className="grid">
      <Panel title="How sales are distributed" note="Most games sell under half a million copies; a few sell tens of millions." state={dist}>
        {(d) => (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={d}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="Bin" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Bar dataKey="Games" fill="#3B4F9E" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
      <Panel title="Correlation matrix" note="Closer to 1 means the two columns rise together." state={cor}>
        {(d) => <Heat rows={d} rk="Var1" ck="Var2" vk="r" />}
      </Panel>
      <Panel span title="Market segments (k-means clustering)" note="Games grouped by how their sales split across regions. Axes use a square-root scale." state={cl}>
        {(d) => {
          const segs = [...new Set(d.points.map((p) => p.Segment))];
          return (
            <>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="NA_Sales" name="North America (M)" scale="sqrt" domain={[0, "auto"]} />
                  <YAxis type="number" dataKey="EU_Sales" name="Europe (M)" scale="sqrt" domain={[0, "auto"]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} /><Legend />
                  {segs.map((s, i) => <Scatter key={s} name={s} data={d.points.filter((p) => p.Segment === s)} fill={COLORS[i % 12]} fillOpacity={0.7} />)}
                </ScatterChart>
              </ResponsiveContainer>
              <Table rows={d.profile} cols={[["Segment", "Segment"], ["Games", "Games"], ["Total", "Total (M)"], ["Avg", "Avg (M)"], ["NA_Sales", "NA avg"], ["EU_Sales", "EU avg"], ["JP_Sales", "JP avg"], ["Other_Sales", "Other avg"]]} />
            </>
          );
        }}
      </Panel>
      <Panel span title="Genre by platform (sales in millions)" note="Darker cells mean higher sales. Shows the 12 biggest platforms." state={mat}>
        {(d) => <Heat rows={d} rk="Genre" ck="Platform" vk="Global" show={(v) => Math.round(v)} />}
      </Panel>
    </div>
  );
}

function Predict({ meta }) {
  const info = useApi("/model-info", EMPTY);
  const [form, setForm] = useState({ genre: "Action", platform: "PS4", publisher: "Electronic Arts", year: 2015 });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));
  const run = () =>
    fetch(`${API}/predict?${query({}, form)}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok ? (setRes(j), setErr("")) : (setRes(null), setErr(j.error || "Prediction failed"))))
      .catch(() => setErr("Could not reach the API."));
  const m = meta || { genres: [], platforms: [] };
  const pubs = info.data?.publishers || [];
  return (
    <div className="grid">
      <section className="panel span">
        <header><h3>Predict sales for a new game</h3></header>
        <p className="note">A regression model trained on every game in the dataset estimates global sales from genre, platform, publisher and release year.</p>
        <div className="form">
          <label>Genre<select value={form.genre} onChange={(e) => set("genre", e.target.value)}>{m.genres.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label>Platform<select value={form.platform} onChange={(e) => set("platform", e.target.value)}>{m.platforms.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label>Publisher<select value={form.publisher} onChange={(e) => set("publisher", e.target.value)}>{pubs.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label>Release year<input type="number" value={form.year} onChange={(e) => set("year", e.target.value)} /></label>
          <button className="primary" onClick={run}>Predict sales</button>
        </div>
        {err && <p className="msg err">{err}</p>}
        {res && (
          <div className="result">
            <strong>{res.predicted}M</strong> copies expected
            <span>80% range: {res.low}M to {res.high}M</span>
          </div>
        )}
      </section>
      <Panel title="Model quality" state={info}>
        {(d) => (
          <div className="stats">
            <div><span>R-squared</span><strong>{d.r2}</strong></div>
            <div><span>Adjusted R-squared</span><strong>{d.adj_r2}</strong></div>
            <div><span>Typical error (log scale)</span><strong>{d.rmse}</strong></div>
            <div><span>Games used</span><strong>{fmt(d.n)}</strong></div>
          </div>
        )}
      </Panel>
      <Panel title="Genre effect on sales (%)" note="Compared with the baseline genre, holding platform, publisher and year constant." state={info}>
        {(d) => <HBar data={d.genre_effects.map((r) => ({ Group: r.Term, Effect: r.Effect }))} k="Effect" color="#5B8DEF" />}
      </Panel>
      <Panel span title="Platform effect on sales (%)" state={info}>
        {(d) => <HBar data={d.platform_effects.map((r) => ({ Group: r.Term, Effect: r.Effect }))} k="Effect" color="#1E3A8A" />}
      </Panel>
    </div>
  );
}

function Recommend({ f }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState([]);
  const [game, setGame] = useState("");
  const [recs, setRecs] = useState(null);
  const [err, setErr] = useState("");
  const [region, setRegion] = useState("Global_Sales");
  const picks = useApi("/top-games", f, { n: 12, sort: region });

  useEffect(() => {
    if (q.length < 2 || q === game) return setOpts([]);
    const t = setTimeout(() => fetch(`${API}/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then(setOpts).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, game]);

  const pick = (name) => {
    setGame(name); setQ(name); setOpts([]); setErr("");
    fetch(`${API}/recommend?${query({ ...f, q: "" }, { game: name, n: 12 })}`)
      .then((r) => r.json())
      .then((j) => (Array.isArray(j) ? setRecs(j) : (setRecs([]), setErr(j.error || "No result"))))
      .catch(() => setErr("Could not reach the API."));
  };

  return (
    <div className="grid">
      <section className="panel span">
        <header><h3>Find games like one you enjoy</h3></header>
        <p className="note">Pick a game you like. Results are ranked by similarity in genre, platform, publisher, popularity and era, and respect the filters in the sidebar.</p>
        <input className="big" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a game title, e.g. Mario Kart" />
        {opts.length > 0 && <ul className="hits">{opts.map((o) => <li key={o.Name}><button onClick={() => pick(o.Name)}>{o.Name}</button></li>)}</ul>}
        {err && <p className="msg err">{err}</p>}
        {recs && recs.length === 0 && !err && <p className="msg">Nothing similar passes the current filters. Clear a filter to see more matches.</p>}
        {recs && recs.length > 0 && (
          <div className="cards">
            {recs.map((r) => (
              <article className="rec" key={r.Name}>
                <h4>{r.Name}</h4>
                <p>{r.Genre} on {r.Platform}, {r.Year}</p>
                <p className="pub">{r.Publisher}</p>
                <div className="bar"><i style={{ width: `${Math.max(r.Similarity, 0) * 100}%` }} /></div>
                <small>{Math.round(r.Similarity * 100)}% match, {r.Global_Sales}M sold</small>
              </article>
            ))}
          </div>
        )}
      </section>
      <Panel span title="Popular picks for the current filters" state={picks}
        actions={<select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="Global_Sales">Worldwide</option>{Object.entries(REG_NAME).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>}>
        {(d) => (
          <div className="cards">
            {d.map((r) => (
              <article className="rec" key={r.Name + r.Platform}>
                <h4>{r.Name}</h4>
                <p>{r.Genre} on {r.Platform}, {r.Year}</p>
                <p className="pub">{r.Publisher}</p>
                <small>{r[region]}M sold</small>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout, pages and routing                                           */
/* ------------------------------------------------------------------ */
const PAGES = [["home", "Home"], ["dashboard", "Analytics dashboard"], ["recommend", "Recommendations"], ["predict", "Sales predictor"]];
const TABS = [["overview", "Overview"], ["genre", "Genres"], ["platform", "Platforms"], ["publisher", "Publishers"], ["time", "Timeline"], ["region", "Regions"], ["rank", "Rankings"], ["games", "Game explorer"], ["insights", "Deep insights"]];

const countActive = (f) => Object.values(f).reduce((n, v) => n + (Array.isArray(v) ? v.length : v !== "" ? 1 : 0), 0);

function useRoute() {
  const read = () => (window.location.hash.replace(/^#\/?/, "") || "home").split("/")[0];
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const h = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return route;
}

function ApiBanner() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    let stop = false, tries = 0, timer;
    const ping = () => {
      fetch(`${API}/health`)
        .then((r) => { if (!r.ok) throw new Error(r.status); if (!stop) setStatus("ok"); })
        .catch(() => {
          if (stop) return;
          tries += 1;
          setStatus(tries > 1 ? "waking" : "checking");
          timer = setTimeout(ping, 5000);
        });
    };
    ping();
    return () => { stop = true; clearTimeout(timer); };
  }, []);
  if (!API) return ;
  if (status === "waking") return ;
  return null;
}

function PageHead({ title, text }) {
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  );
}

function FilterPanel({ f, setF, meta }) {
  const [open, setOpen] = useState(false);
  const active = countActive(f);
  return (
    <section className="filterpanel">
      <div className="fp-bar">
        <input className="quick" value={f.q} onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))} placeholder="Search a game name" aria-label="Search a game name" />
        <button className="btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide filters" : "More filters"}{active ? ` (${active} active)` : ""}
        </button>
        {active > 0 && <button className="btn ghost" onClick={() => setF(EMPTY)}>Clear all</button>}
      </div>
      {open && <Filters f={f} setF={setF} meta={meta} />}
    </section>
  );
}

function Home() {
  const sum = useApi("/summary", EMPTY);
  const genre = useApi("/by", EMPTY, { dim: "Genre", top: 8 });
  const top = useApi("/top-games", EMPTY, { n: 5 });
  const s = sum.data || {};
  const stats = [["Games analysed", s.games], ["Copies sold (M)", s.total], ["Platforms", s.platforms], ["Genres", s.genres]];
  const features = [
    ["dashboard", "Analytics dashboard", "Sales by genre, platform, publisher, year, region and rank, with filters on every column."],
    ["recommend", "Recommendations", "Pick a game you enjoyed and get similar titles, or browse the biggest hits for your taste."],
    ["predict", "Sales predictor", "Choose a genre, platform, publisher and year to estimate how well a new game could sell."],
  ];
  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div className="hero-text">
            <h1>What sold, where, and what to play next.</h1>
            <p>Explore decades of video game sales, compare genres, platforms and publishers, find games you will like, and estimate sales for a new release. Every figure is calculated live by an R server.</p>
            <div className="cta">
              <a className="btn primary" href="#/dashboard">Open the dashboard</a>
              <a className="btn light" href="#/recommend">Find a game</a>
            </div>
          </div>
          <div className="herostats">
            {stats.map(([k, v]) => (
              <div key={k}><strong>{v == null ? "…" : fmt(v)}</strong><span>{k}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2>Three ways to explore</h2>
        <div className="feat">
          {features.map(([k, t, d]) => (
            <a key={k} className="featcard" href={`#/${k}`}>
              <h3>{t}</h3>
              <p>{d}</p>
              <span>Open this page</span>
            </a>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <h2>A first look at the data</h2>
        <div className="grid">
          <Panel title="Global sales by genre (M)" state={genre}>{(d) => <HBar data={d} />}</Panel>
          <Panel title="Five best-selling games ever" state={top}>
            {(d) => (
              <ol className="toplist">
                {d.map((g) => (
                  <li key={g.Name + g.Platform}>
                    <div><b>{g.Name}</b><small>{g.Genre} on {g.Platform}, {g.Year}</small></div>
                    <strong>{fmt(g.Global_Sales)}M</strong>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </section>

      <section className="wrap section about">
        <h2>About the data</h2>
        <p>The figures come from the Kaggle Video Game Sales dataset, which lists more than 16,000 games released between 1980 and 2016. Sales are in millions of copies and are split into North America, Europe, Japan and other regions. The analysis and the recommender run in R and are served through an API.</p>
      </section>
    </>
  );
}

function DashboardPage({ f, setF, meta }) {
  const [tab, setTab] = useState("overview");
  const view = {
    overview: <Overview f={f} />,
    genre: <Dimension dim="Genre" label="Genre" f={f} />,
    platform: <Dimension dim="Platform" label="Platform" f={f} />,
    publisher: <Dimension dim="Publisher" label="Publisher" f={f} />,
    time: <Timeline f={f} />,
    region: <Regions f={f} />,
    rank: <Rankings f={f} />,
    games: <Explorer f={f} />,
    insights: <Insights f={f} />,
  }[tab];
  return (
    <div className="wrap page">
      <PageHead title="Analytics dashboard" text="Every chart and table below follows the filters you choose." />
      <FilterPanel f={f} setF={setF} meta={meta} />
      <Kpis f={f} />
      <nav className="tabs" aria-label="Dashboard views">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      {view}
    </div>
  );
}

export default function App() {
  const route = useRoute();
  const [f, setF] = useState(EMPTY);
  const [menu, setMenu] = useState(false);
  const meta = useApi("/meta", EMPTY).data;
  useEffect(() => setMenu(false), [route]);
  const page = PAGES.some(([k]) => k === route) ? route : "home";

  return (
    <div className="app">
      <header className="sitehead">
        <div className="wrap sitehead-in">
          <a className="brand" href="#/home"><i aria-hidden="true" />Game Sales Lab</a>
          <button className="burger" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Menu">{menu ? "Close" : "Menu"}</button>
          <nav className={"nav" + (menu ? " open" : "")} aria-label="Main">
            {PAGES.map(([k, l]) => <a key={k} href={`#/${k}`} className={page === k ? "on" : ""}>{l}</a>)}
          </nav>
        </div>
      </header>
      <ApiBanner />
      <main>
        {page === "home" && <Home />}
        {page === "dashboard" && <DashboardPage f={f} setF={setF} meta={meta} />}
        {page === "recommend" && (
          <div className="wrap page">
            <PageHead title="Game recommendations" text="Tell us a game you enjoyed and we will find similar ones." />
            <FilterPanel f={f} setF={setF} meta={meta} />
            <Recommend f={f} />
          </div>
        )}
        {page === "predict" && (
          <div className="wrap page">
            <PageHead title="Sales predictor" text="Estimate the global sales of a game that has not been released yet." />
            <Predict meta={meta} />
          </div>
        )}
      </main>
      <footer className="sitefoot">
        <div className="wrap">Data: Kaggle Video Game Sales (vgsales). Built with R, plumber and React.</div>
      </footer>
    </div>
  );
}