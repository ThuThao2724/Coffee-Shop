import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import api from "@/utils/api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from "recharts";

export type DaySlots = { morning: number; noon: number; evening: number };
export type ForecastPoint = {
  date: string; // "YYYY-MM-DD"
  forecast: number;
  low: number;
  high: number;
  slots?: DaySlots;
};

type TopProduct = { id: string; name: string; qty: number };
type TopSession = { key: string; topProducts: TopProduct[]; totalQty: number };
type TopProductsResponse = { daysUsed: number; sessions: TopSession[] };
type HourRow = { dow: number; h: number; revenue: number; orders: number; days: number };
type HourStat = { h: number; rev: number; ord: number };
type WxDay = { date: string; mm: number | null; prob: number | null; isRain: boolean | null };
type WxStats = { rainyDays: number; dryDays: number; rainFactor: number | null; dryFactor: number | null };

const DEFAULT_SPLIT: DaySlots = { morning: 0.3, noon: 0.4, evening: 0.3 };
const SLOTS = [
  { key: "morning", label: "Sáng", hours: "06:00 – 11:00", from: 6, to: 11, color: "#f97316" },
  { key: "noon", label: "Trưa", hours: "11:00 – 17:00", from: 11, to: 17, color: "#16a34a" },
  { key: "evening", label: "Tối", hours: "17:00 – 23:00", from: 17, to: 23, color: "#7c3aed" },
] as const;

const MIN_DAYS = 3;
const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const fmtDate = (iso: string) => format(parseISO(iso), "dd/MM/yyyy");

// Khung 2 giờ liên tiếp có doanh thu cao nhất trong [from, to)
function bestWindow(stats: HourStat[], from: number, to: number) {
  let best: { start: number; rev: number; ord: number } | null = null;
  for (let h = from; h + 1 < to; h++) {
    const a = stats.find((s) => s.h === h);
    const b = stats.find((s) => s.h === h + 1);
    const rev = (a?.rev ?? 0) + (b?.rev ?? 0);
    const ord = (a?.ord ?? 0) + (b?.ord ?? 0);
    if (!best || rev > best.rev) best = { start: h, rev, ord };
  }
  return best;
}

export default function ForecastDayDetail({ data, branchId }: { data: ForecastPoint[]; branchId?: string }) {
  const [selected, setSelected] = useState(data[0]?.date ?? "");
  const day = data.find((d) => d.date === selected) ?? data[0];

  const [top, setTop] = useState<TopProductsResponse | null>(null);
  const [topLoading, setTopLoading] = useState(false);
  const [topError, setTopError] = useState(false);
  const [profile, setProfile] = useState<HourRow[]>([]);
  const [weather, setWeather] = useState<{ days: WxDay[]; stats: WxStats } | null>(null);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    api
      .get<{ days: WxDay[]; stats: WxStats }>("/ai/forecast/weather", { params: { branchId }, timeout: 30000 })
      .then((res) => { if (!cancelled) setWeather(res.data); })
      .catch(() => { if (!cancelled) setWeather(null); });
    return () => { cancelled = true; };
  }, [branchId]);

  const wxOf = (iso: string) => weather?.days.find((d) => d.date === iso);
  const wx = day ? wxOf(day.date) : undefined;
  const wxReliable = !!weather && weather.stats.rainyDays >= 15 && weather.stats.dryDays >= 15;

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    api
      .get<{ profile: HourRow[] }>("/ai/forecast/hourly-profile", { params: { branchId, weeks: 12 } })
      .then((res) => { if (!cancelled) setProfile(res.data.profile ?? []); })
      .catch(() => { if (!cancelled) setProfile([]); });
    return () => { cancelled = true; };
  }, [branchId]);

  useEffect(() => {
    if (!branchId || !day?.date) return;
    let cancelled = false;
    setTopLoading(true);
    setTopError(false);
    api
      .get<TopProductsResponse>("/ai/forecast/top-products", {
        params: { branchId, date: day.date, weeks: 20 },
      })
      .then((res) => { if (!cancelled) setTop(res.data); })
      .catch(() => { if (!cancelled) { setTop(null); setTopError(true); } })
      .finally(() => { if (!cancelled) setTopLoading(false); });
    return () => { cancelled = true; };
  }, [branchId, day?.date]);

  // Hồ sơ theo giờ của một ngày: trung bình mỗi giờ, theo đúng thứ trong tuần
  const statsFor = (iso: string): HourStat[] | null => {
    const dow = parseISO(iso).getDay();
    const rows = profile.filter((r) => r.dow === dow);
    if (!rows.length || rows[0].days < MIN_DAYS) return null;
    const out: HourStat[] = [];
    for (let h = 6; h <= 22; h++) {
      const r = rows.find((x) => x.h === h);
      out.push({ h, rev: r ? r.revenue / r.days : 0, ord: r ? r.orders / r.days : 0 });
    }
    return out;
  };

  const sharesFor = (p: ForecastPoint): { shares: DaySlots; real: boolean } => {
    if (p.slots && p.forecast) {
      return {
        shares: { morning: p.slots.morning / p.forecast, noon: p.slots.noon / p.forecast, evening: p.slots.evening / p.forecast },
        real: true,
      };
    }
    const stats = statsFor(p.date);
    if (!stats) return { shares: DEFAULT_SPLIT, real: false };
    const sum = (a: number, b: number) => stats.filter((s) => s.h >= a && s.h < b).reduce((t, s) => t + s.rev, 0);
    const m = sum(6, 11), n = sum(11, 17), e = sum(17, 23);
    const total = m + n + e;
    if (!total) return { shares: DEFAULT_SPLIT, real: false };
    return { shares: { morning: m / total, noon: n / total, evening: e / total }, real: true };
  };

  const chartData = useMemo(
    () =>
      data.map((p) => {
        const { shares } = sharesFor(p);
        return {
          ...p,
          morning: p.forecast * shares.morning,
          noon: p.forecast * shares.noon,
          evening: p.forecast * shares.evening,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, profile],
  );

  const dayStats = useMemo(() => (day ? statsFor(day.date) : null), [day, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!day) return [];
    const { shares, real } = sharesFor(day);
    return SLOTS.map((s) => {
      const value = day.forecast * shares[s.key];
      const win = dayStats ? bestWindow(dayStats, s.from, s.to) : null;
      const sessionRev = dayStats ? dayStats.filter((x) => x.h >= s.from && x.h < s.to).reduce((t, x) => t + x.rev, 0) : 0;
      return {
        ...s,
        value,
        pct: day.forecast ? (value / day.forecast) * 100 : 0,
        estimated: !real,
        win,
        winPct: win && sessionRev ? (win.rev / sessionRev) * 100 : 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, dayStats]);

  if (!day) return null;
  const best = rows.reduce((a, b) => (b.value > a.value ? b : a));
  const enoughTop = !!top && top.daysUsed >= MIN_DAYS;
  const dayPeak = dayStats ? bestWindow(dayStats, 6, 23) : null;

  return (
    <div className="grid gap-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        Xem ngày dự báo:
        <input
          type="date"
          value={day.date}
          min={data[0].date}
          max={data[data.length - 1].date}
          onChange={(e) => data.some((d) => d.date === e.target.value) && setSelected(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-800"
        />
      </label>

      <div className="h-72 rounded-2xl border border-sky-100 bg-white p-3">
        <ResponsiveContainer>
          <LineChart data={chartData} onClick={(e: { activeLabel?: string } | null) => e?.activeLabel && setSelected(e.activeLabel)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tickFormatter={fmtDate} />
            <YAxis tickFormatter={(v: number) => `${(v / 1e6).toFixed(0)}tr`} />
            <Tooltip labelFormatter={fmtDate} formatter={(v: number) => vnd(v)} />
            <Legend />
            {chartData.map((p) => {
              const w = wxOf(p.date);
              if (!w || w.isRain === null) return null;
              return (
                <ReferenceDot
                  key={p.date}
                  x={p.date}
                  y={p.forecast}
                  r={9}
                  fill={w.isRain ? "#0ea5e9" : "#facc15"}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={{ value: w.isRain ? "Mưa" : "Nắng", position: "top", fontSize: 11 }}
                />
              );
            })}
            <ReferenceLine x={day.date} stroke="#0f4c81" strokeDasharray="4 4" />
            <Line dataKey="forecast" name="Dự báo ngày" stroke="#0f4c81" strokeWidth={4} dot={{ r: 4 }} />
            <Line dataKey="morning" name="Sáng" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line dataKey="noon" name="Trưa" stroke="#16a34a" strokeWidth={2.5} strokeDasharray="6 3" dot={{ r: 3 }} />
            <Line dataKey="evening" name="Tối" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="2 3" dot={{ r: 3 }} />
            <Line dataKey="low" name="Tin cậy thấp" stroke="#cbd5e1" strokeDasharray="4 4" strokeWidth={1} dot={false} />
            <Line dataKey="high" name="Tin cậy cao" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {weather && (
        <div className="flex flex-wrap gap-2">
          {data.map((p) => {
            const w = wxOf(p.date);
            if (!w || w.isRain === null) return null;
            const on = p.date === day.date;
            return (
              <button
                key={p.date}
                type="button"
                onClick={() => setSelected(p.date)}
                className={`rounded-full px-3 py-1 text-xs ring-1 ${
                  w.isRain ? "bg-sky-50 text-sky-800 ring-sky-300" : "bg-amber-50 text-amber-800 ring-amber-300"
                } ${on ? "font-bold ring-2" : ""}`}
              >
                {format(parseISO(p.date), "dd/MM")} · {w.isRain ? "Ngày mưa" : "Ngày không mưa"}
                {w.mm != null ? ` · ${w.mm.toFixed(1)}mm` : ""}
              </button>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold text-slate-900">Dự báo ngày {fmtDate(day.date)}</h3>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Tổng {vnd(day.forecast)} · khoảng tin cậy {vnd(day.low)} – {vnd(day.high)}
        </p>

        {wx && wx.isRain !== null && (
          <p className="mb-3 text-sm">
            Thời tiết dự báo: <b>{wx.isRain ? "Ngày mưa" : "Ngày không mưa"}</b>
            {wx.mm != null ? ` (${wx.mm.toFixed(1)} mm` : ""}
            {wx.prob != null ? `, khả năng mưa ${wx.prob}%` : ""}
            {wx.mm != null ? ")" : ""}
          </p>
        )}
        {wxReliable && weather && weather.stats.rainFactor && weather.stats.dryFactor && (
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-sky-50 p-3 ring-1 ring-sky-300">
              <div className="text-xs text-slate-500">Nếu ngày mưa</div>
              <div className="text-lg font-bold">{vnd(day.forecast * weather.stats.rainFactor)}</div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-300">
              <div className="text-xs text-slate-500">Nếu ngày không mưa</div>
              <div className="text-lg font-bold">{vnd(day.forecast * weather.stats.dryFactor)}</div>
            </div>
          </div>
        )}
        {weather && !wxReliable && (
          <p className="mb-3 text-xs text-slate-500">
            Chưa đủ ngày không mưa trong lịch sử ({weather.stats.dryDays} ngày, cần ít nhất 15) để so sánh doanh thu mưa và không mưa.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {rows.map((r) => {
            const session = top?.sessions.find((s) => s.key === r.key);
            return (
              <div key={r.key} className="rounded-xl bg-slate-50 p-3" style={{ borderLeft: `4px solid ${r.color}` }}>
                <div className="font-semibold">{r.label}</div>
                <div className="text-xs text-slate-500">{r.hours}</div>
                <div className="my-1.5 text-xl font-bold">{vnd(r.value)}</div>
                <div className="h-1.5 rounded bg-slate-200">
                  <div className="h-full rounded" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
                <div className="mt-1 text-xs text-slate-600">{r.pct.toFixed(0)}% doanh thu ngày</div>

                {r.win && (
                  <div className="mt-3 rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200">
                    <div className="font-semibold text-slate-700">Khung giờ bán chạy nhất</div>
                    <div className="mt-0.5 text-base font-bold" style={{ color: r.color }}>
                      {pad(r.win.start)} – {pad(r.win.start + 2)}
                    </div>
                    <div className="text-slate-500">
                      ~{Math.round(r.win.ord)} đơn · {r.winPct.toFixed(0)}% doanh thu buổi
                    </div>
                  </div>
                )}

                {branchId && (
                  <div className="mt-3 border-t border-slate-200 pt-2">
                    <div className="mb-1 text-xs font-semibold text-slate-700">Món bán chạy dự kiến</div>
                    {topLoading && <div className="text-xs text-slate-400">Đang tải...</div>}
                    {!topLoading && topError && <div className="text-xs text-slate-400">Không tải được dữ liệu món.</div>}
                    {!topLoading && !topError && top && !enoughTop && (
                      <div className="text-xs text-slate-400">Chưa đủ dữ liệu</div>
                    )}
                    {!topLoading && !topError && enoughTop && session && session.topProducts.length === 0 && (
                      <div className="text-xs text-slate-400">Chưa có dữ liệu buổi này</div>
                    )}
                    {!topLoading && !topError && enoughTop && session && session.topProducts.length > 0 && (
                      <>
                        <ol className="grid gap-0.5 text-sm">
                          {session.topProducts.slice(0, 3).map((p, i) => (
                            <li key={p.id} className="flex justify-between gap-2">
                              <span className="truncate">{i + 1}. {p.name}</span>
                              <span className="shrink-0 font-semibold" style={{ color: r.color }}>~{p.qty}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-1 text-xs text-slate-500">Cả buổi ~{session.totalQty} món</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-sm">
          Buổi cao nhất: <b>{best.label}</b>.
          {dayPeak && (
            <span> Khung giờ đông nhất cả ngày: <b>{pad(dayPeak.start)} – {pad(dayPeak.start + 2)}</b>.</span>
          )}
          {rows[0].estimated && (
            <span className="text-slate-500"> Chưa đủ dữ liệu theo giờ, đang chia theo tỉ lệ mặc định 30/40/30.</span>
          )}
        </p>
        {!rows[0].estimated && (
          <p className="mt-1 text-xs text-slate-500">
            Tỉ lệ buổi và khung giờ được tính từ giờ đơn thực tế của 12 tuần gần nhất, cùng thứ trong tuần.
          </p>
        )}
        {enoughTop && top && (
          <p className="mt-1 text-xs text-slate-500">
            Món bán chạy là ước tính trung bình theo {top.daysUsed} ngày cùng thứ trong quá khứ.
          </p>
        )}
      </section>
    </div>
  );
}