import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import api from "@/utils/api";

type Ing = {
  id: string; name: string; unit: string;
  stock: number | null; minStock: number | null;
  need: number; toOrder: number | null;
  status: "out" | "low" | "reorder" | "ok" | "unknown";
  lowDate: string | null; outDate: string | null; unitMismatch: boolean;
};
type Resp = { dates: string[]; dailyCups: number[]; buffer: number; missingRecipes: string[]; ingredients: Ing[] };

const STATUS = {
  out: { label: "Sẽ hết", cls: "bg-red-50 text-red-700 ring-red-300" },
  low: { label: "Dưới mức tối thiểu", cls: "bg-orange-50 text-orange-700 ring-orange-300" },
  reorder: { label: "Nên nhập thêm", cls: "bg-amber-50 text-amber-700 ring-amber-300" },
  ok: { label: "Đủ dùng", cls: "bg-emerald-50 text-emerald-700 ring-emerald-300" },
  unknown: { label: "Chưa có trong kho", cls: "bg-slate-100 text-slate-600 ring-slate-300" },
} as const;

const num = (n: number | null) => (n == null ? "–" : n.toLocaleString("vi-VN", { maximumFractionDigits: 2 }));
const d = (iso: string | null) => (iso ? format(parseISO(iso), "dd/MM") : "");

export default function IngredientForecast({ branchId }: { branchId?: string }) {
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    setError(false);
    api
      .get<Resp>("/ai/forecast/ingredients", { params: { branchId, days: 7 } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) { setData(null); setError(true); } });
    return () => { cancelled = true; };
  }, [branchId]);

  if (!branchId) return null;
  if (error) return <p className="mt-4 text-sm text-slate-500">Không tải được dự báo nguyên liệu.</p>;
  if (!data) return <p className="mt-4 text-sm text-slate-500">Đang tính dự báo nguyên liệu...</p>;

  const warn = data.ingredients.filter((i) => i.status === "out" || i.status === "low");
  const first = data.dates[0];
  const last = data.dates[data.dates.length - 1];

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">Nguyên liệu cần cho 7 ngày tới</h3>
      <p className="mb-3 mt-1 text-sm text-slate-500">
        {format(parseISO(first), "dd/MM")} – {format(parseISO(last), "dd/MM")} · khoảng {Math.round(data.dailyCups.reduce((a, b) => a + b, 0)).toLocaleString("vi-VN")} ly · dự phòng {Math.round(data.buffer * 100)}%
      </p>

      {warn.length > 0 && (
        <div className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          {warn.map((i) => (
            <div key={i.id}>
              <b>{i.name}</b>
              {i.lowDate ? ` xuống dưới mức tối thiểu ngày ${d(i.lowDate)}` : ""}
              {i.outDate ? `, dự kiến hết ngày ${d(i.outDate)}` : ""}
              {i.toOrder ? `. Nên nhập thêm ${num(i.toOrder)} ${i.unit}.` : "."}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-2 pr-3">Nguyên liệu</th>
              <th className="py-2 pr-3">Tồn kho</th>
              <th className="py-2 pr-3">Cần 7 ngày</th>
              <th className="py-2 pr-3">Nên nhập</th>
              <th className="py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {data.ingredients.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 font-medium">{i.name}</td>
                <td className="py-2 pr-3">{num(i.stock)} {i.unit}</td>
                <td className="py-2 pr-3">{num(i.need)} {i.unit}</td>
                <td className="py-2 pr-3 font-semibold">{i.toOrder ? `${num(i.toOrder)} ${i.unit}` : "–"}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
                  {i.unitMismatch && <span className="ml-2 text-xs text-red-600">lệch đơn vị</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.missingRecipes.length > 0 && (
        <p className="mt-2 text-xs text-red-600">Món chưa có công thức (bị tính thiếu): {data.missingRecipes.join(", ")}</p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Ước tính từ số ly trung bình cùng thứ trong 12 tuần gần nhất nhân với định lượng công thức. Chỉ chính xác khi kho được trừ theo từng đơn và cập nhật khi nhập hàng.
      </p>
    </section>
  );
}
