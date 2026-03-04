import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BrowserRouter, Routes, Route, Link,
  useLocation, useNavigate, useParams
} from "react-router-dom";
import {
  Building2, Users, Briefcase, Package, Wrench, Clock, DollarSign,
  PieChart, Plus, Image as ImageIcon, Search, LayoutDashboard,
  Settings as SettingsIcon, Trash2, SlidersHorizontal, X, Copy,
  ArrowLeft, User, Calendar, Tag, AlertTriangle, CheckCircle,
  Circle, PlayCircle, XCircle, Timer
} from "lucide-react";
import {
  collection, doc, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val || 0);
const n = (val: string | number) => Math.max(0, Number(val) || 0);

const DEFAULT_SETTINGS = {
  wages: 18000, rent: 3500, electric: 600, insurance: 800,
  equipment: 400, supplies: 300, phone: 150, other: 500,
  hoursPerDay: 8, daysPerMonth: 22, workers: 3,
};

const STATUSES = [
  { value: "quoted",      label: "Quoted",       bg: "bg-blue-100",    text: "text-blue-700",    Icon: Circle },
  { value: "won",         label: "Won",           bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle },
  { value: "in_progress", label: "In Progress",   bg: "bg-amber-100",   text: "text-amber-700",   Icon: PlayCircle },
  { value: "completed",   label: "Completed",     bg: "bg-zinc-100",    text: "text-zinc-600",    Icon: CheckCircle },
  { value: "lost",        label: "Lost",          bg: "bg-red-100",     text: "text-red-600",     Icon: XCircle },
];
const getStatus = (v: string) => STATUSES.find(s => s.value === v) ?? STATUSES[0];

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, action, className = "" }: any) {
  return (
    <div className={`bg-white rounded-[28px] p-6 md:p-8 shadow-sm border border-zinc-100 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100">
            <Icon size={18} className="text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, value, onChange, prefix, suffix, hint }: any) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 last:border-0 focus-within:bg-blue-50/40 transition-colors">
      <div>
        <div className="text-[14px] font-medium text-zinc-800">{label}</div>
        {hint && <div className="text-[12px] text-zinc-400 mt-0.5">{hint}</div>}
      </div>
      <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        {prefix && <span className="text-zinc-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 text-right text-[14px] font-semibold text-zinc-900 bg-transparent focus:outline-none"
        />
        {suffix && <span className="text-zinc-400 text-sm font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, prefix, suffix, icon: Icon, type = "number", placeholder }: any) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
        {Icon && <Icon size={12} />}{label}
      </label>
      <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-sm transition-all">
        {prefix && <span className="text-zinc-400 font-medium shrink-0">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          className="w-full text-[16px] font-semibold text-zinc-900 bg-transparent focus:outline-none"
        />
        {suffix && <span className="text-zinc-400 font-medium shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, green }: any) {
  return (
    <div className={`flex flex-col p-4 rounded-2xl border ${green ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/5 border-white/10"}`}>
      <span className="text-zinc-400 text-[12px] font-medium mb-1">{label}</span>
      <span className={`text-xl font-bold tracking-tight ${green ? "text-emerald-400" : "text-white"}`}>{value}</span>
      {sub && <span className="text-zinc-500 text-[11px] mt-1">{sub}</span>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = getStatus(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.bg} ${s.text}`}>
      <s.Icon size={10} />{s.label}
    </span>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-9 h-9 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [sort, setSort]               = useState("date-desc");
  const [statusFilter, setFilter]     = useState("all");
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [confirmDel, setConfirmDel]   = useState<string | null>(null);
  const [duping, setDuping]           = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      snap => { setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      err  => { console.error(err); setLoading(false); }
    );
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel(null), 3000);
      return;
    }
    setDeleting(id);
    try { await deleteDoc(doc(db, "jobs", id)); }
    catch (err) { console.error(err); }
    finally { setDeleting(null); setConfirmDel(null); }
  };

  const handleDupe = async (job: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuping(job.id);
    try {
      const { id: _id, createdAt: _ca, ...rest } = job;
      await addDoc(collection(db, "jobs"), {
        ...rest,
        name: `${rest.name || "Unnamed"} (Copy)`,
        status: "quoted",
        createdAt: new Date().toISOString(),
      });
    } catch (err) { console.error(err); }
    finally { setDuping(null); }
  };

  const visible = useMemo(() => {
    let r = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(j =>
        j.name?.toLowerCase().includes(q) ||
        j.partNumber?.toLowerCase().includes(q) ||
        j.customer?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter(j => (j.status || "quoted") === statusFilter);
    r.sort((a, b) => {
      if (sort === "date-desc")  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "date-asc")   return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sort === "price-desc") return (b.totalJobPrice || 0) - (a.totalJobPrice || 0);
      if (sort === "price-asc")  return (a.totalJobPrice || 0) - (b.totalJobPrice || 0);
      return 0;
    });
    return r;
  }, [jobs, search, sort, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Jobs & Quotes</h1>
          <p className="text-zinc-500 mt-1">Reference past work and pricing.</p>
        </div>
        <Link to="/new"
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold transition-colors shadow-sm whitespace-nowrap">
          <Plus size={18} /> New Quote
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search part number, name, or customer..."
            className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
          />
        </div>
        <select value={statusFilter} onChange={e => setFilter(e.target.value)}
          className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none shadow-sm cursor-pointer">
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none shadow-sm cursor-pointer">
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="price-desc">Highest Price</option>
          <option value="price-asc">Lowest Price</option>
        </select>
      </div>

      {/* List */}
      {loading ? <Spinner /> : jobs.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-zinc-100 p-16 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">No jobs yet</h3>
          <p className="text-zinc-500 mb-6">Create your first quote to start building your database.</p>
          <Link to="/new"
            className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full font-semibold transition-colors">
            Create Quote
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-zinc-100 p-16 text-center">
          <p className="text-zinc-500 mb-4">No quotes match your filters.</p>
          <button onClick={() => { setSearch(""); setFilter("all"); }}
            className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-5 py-2.5 rounded-full font-semibold transition-colors">
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map(job => {
            let photo = job.photoBase64;
            if (job.photos) { try { const p = JSON.parse(job.photos); if (p[0]) photo = p[0]; } catch {} }
            return (
              <div key={job.id} onClick={() => navigate(`/job/${job.id}`)}
                className="bg-white rounded-[22px] border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer">
                {/* Photo */}
                <div className="h-44 bg-zinc-100 relative overflow-hidden shrink-0">
                  {photo
                    ? <img src={photo} alt={job.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon size={40} className="text-zinc-300" />
                      </div>
                  }
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-zinc-800 shadow-sm">
                    {job.partNumber || "No PN"}
                  </div>
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={job.status || "quoted"} />
                  </div>
                </div>

                {/* Info */}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-zinc-900 text-[16px] truncate mb-0.5">{job.name || "Unnamed Job"}</h3>
                  {job.customer && (
                    <p className="text-[13px] text-zinc-400 mb-2 flex items-center gap-1">
                      <User size={11} />{job.customer}
                    </p>
                  )}
                  <div className="flex justify-between text-[13px] text-zinc-500 mb-4">
                    <span>{job.quantity} pcs{job.scrapRate > 0 ? ` · ${job.scrapRate}% scrap` : ""}</span>
                    {job.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />{new Date(job.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="pt-3 border-t border-zinc-100 flex justify-between mb-4">
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Total</div>
                      <div className="font-bold text-zinc-900">{fmt(job.totalJobPrice)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">Per Part</div>
                      <div className="font-bold text-emerald-600">{fmt(job.pricePerGoodPart)}</div>
                    </div>
                  </div>
                  {/* Buttons */}
                  <div className="pt-3 border-t border-zinc-100 flex gap-2">
                    <button onClick={e => { e.stopPropagation(); navigate(`/job/${job.id}`); }}
                      className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5">
                      <Wrench size={13} /> Edit
                    </button>
                    <button onClick={e => handleDupe(job, e)} disabled={duping === job.id}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40">
                      <Copy size={13} />{duping === job.id ? "..." : "Copy"}
                    </button>
                    <button onClick={e => handleDelete(job.id, e)} disabled={deleting === job.id}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 ${confirmDel === job.id ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"}`}>
                      <Trash2 size={13} />{confirmDel === job.id ? "Sure?" : "Del"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function Settings() {
  const [s, setS]       = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        setS(snap.exists() ? snap.data() : { ...DEFAULT_SETTINGS });
      } catch {
        setS({ ...DEFAULT_SETTINGS });
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "global"), s);
      setMsg("Saved!"); setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("Save failed — check connection"); }
    finally { setSaving(false); }
  };

  const upd = (k: string, v: string) => setS((prev: any) => ({ ...prev, [k]: v }));

  if (!s) return <Spinner />;

  const overhead = ["wages","rent","electric","insurance","equipment","supplies","phone","other"]
    .reduce((a, k) => a + n(s[k]), 0);
  const hours  = n(s.hoursPerDay) * n(s.daysPerMonth) * n(s.workers);
  const rate   = hours > 0 ? overhead / hours : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Overhead Settings</h1>
          <p className="text-zinc-500 mt-1">These values calculate your true hourly cost.</p>
        </div>
        <button onClick={save} disabled={saving}
          className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-sm">
          {msg || (saving ? "Saving..." : "Save Settings")}
        </button>
      </div>

      {/* Live summary */}
      <div className="bg-[#1d1d1f] rounded-[24px] p-6 grid grid-cols-3 gap-4 text-center text-white">
        <div>
          <div className="text-zinc-400 text-xs mb-1">Monthly Overhead</div>
          <div className="text-2xl font-bold">{fmt(overhead)}</div>
        </div>
        <div>
          <div className="text-zinc-400 text-xs mb-1">Monthly Hours</div>
          <div className="text-2xl font-bold">{hours.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-zinc-400 text-xs mb-1">True Cost / Hr</div>
          <div className="text-2xl font-bold text-emerald-400">{fmt(rate)}</div>
        </div>
      </div>

      <Card title="Monthly Overhead" icon={Building2}>
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <FieldRow label="Total Wages"      hint="All employee wages combined"        value={s.wages}     onChange={(v: string) => upd("wages", v)}     prefix="$" />
          <FieldRow label="Rent / Lease"                                                value={s.rent}      onChange={(v: string) => upd("rent", v)}      prefix="$" />
          <FieldRow label="Electricity"                                                 value={s.electric}  onChange={(v: string) => upd("electric", v)}  prefix="$" />
          <FieldRow label="Insurance"                                                   value={s.insurance} onChange={(v: string) => upd("insurance", v)} prefix="$" />
          <FieldRow label="Equipment"        hint="Leases, maintenance, depreciation"  value={s.equipment} onChange={(v: string) => upd("equipment", v)} prefix="$" />
          <FieldRow label="Supplies"                                                    value={s.supplies}  onChange={(v: string) => upd("supplies", v)}  prefix="$" />
          <FieldRow label="Phone / Internet"                                            value={s.phone}     onChange={(v: string) => upd("phone", v)}     prefix="$" />
          <FieldRow label="Other"                                                       value={s.other}     onChange={(v: string) => upd("other", v)}     prefix="$" />
        </div>
      </Card>

      <Card title="Labor Capacity" icon={Users}>
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <FieldRow label="Hours per Day"     hint="Productive hours, not clock-in time" value={s.hoursPerDay}  onChange={(v: string) => upd("hoursPerDay", v)}  suffix="hrs" />
          <FieldRow label="Days per Month"                                                value={s.daysPerMonth} onChange={(v: string) => upd("daysPerMonth", v)} suffix="days" />
          <FieldRow label="Number of Workers" hint="Floor workers only"                  value={s.workers}      onChange={(v: string) => upd("workers", v)}      suffix="ppl" />
        </div>
      </Card>
    </div>
  );
}

// ─── Job Editor ───────────────────────────────────────────────────────────────
function JobEditor() {
  const { id }      = useParams();
  const navigate    = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saveErr, setSaveErr]   = useState("");
  const [settings, setSettings] = useState<any>(null);

  // Form state
  const [partNumber,     setPartNumber]     = useState("");
  const [jobName,        setJobName]        = useState("");
  const [customer,       setCustomer]       = useState("");
  const [status,         setStatus]         = useState("quoted");
  const [dueDate,        setDueDate]        = useState("");
  const [quantity,       setQuantity]       = useState<string | number>(100);
  const [minsPerPart,    setMinsPerPart]    = useState<string | number>(5);
  const [setupMins,      setSetupMins]      = useState<string | number>(0);
  const [matCost,        setMatCost]        = useState<string | number>(2.5);
  const [scrapRate,      setScrapRate]      = useState<string | number>(0);
  const [margin,         setMargin]         = useState<string | number>(35);
  const [notes,          setNotes]          = useState("");
  const [photos,         setPhotos]         = useState<string[]>([]);

  // Load data once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Always load settings first (fall back to defaults if offline)
      let cfg = { ...DEFAULT_SETTINGS };
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        if (snap.exists()) cfg = snap.data() as any;
      } catch { /* use defaults */ }
      if (!cancelled) setSettings(cfg);

      // Load existing job if editing
      if (id) {
        try {
          const snap = await getDoc(doc(db, "jobs", id));
          if (snap.exists() && !cancelled) {
            const d = snap.data();
            setPartNumber(d.partNumber         || "");
            setJobName(d.name                  || "");
            setCustomer(d.customer             || "");
            setStatus(d.status                 || "quoted");
            setDueDate(d.dueDate               || "");
            setQuantity(d.quantity             ?? 100);
            setMinsPerPart(d.minutesPerPart    ?? 5);
            setSetupMins(d.setupMinutes        ?? 0);
            setMatCost(d.materialCostPerPart   ?? 0);
            setScrapRate(d.scrapRate           ?? 0);
            setMargin(d.profitMargin           ?? 35);
            setNotes(d.notes                   || "");
            let px: string[] = [];
            if (d.photos) { try { px = JSON.parse(d.photos); } catch {} }
            if (!px.length && d.photoBase64) px = [d.photoBase64];
            if (!cancelled) setPhotos(px);
          }
        } catch (e) { console.error("Job load failed:", e); }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Pure pricing calculation — no motion, no layout animation
  const calc = useMemo(() => {
    if (!settings) return null;
    const overhead =
      n(settings.wages) + n(settings.rent)      + n(settings.electric) +
      n(settings.insurance) + n(settings.equipment) + n(settings.supplies) +
      n(settings.phone) + n(settings.other);
    const totalHours = n(settings.hoursPerDay) * n(settings.daysPerMonth) * n(settings.workers);
    const ratePerHr  = totalHours > 0 ? overhead / totalHours : 0;
    const ratePerMin = ratePerHr / 60;

    const qty        = Math.max(1, n(quantity));
    const tpp        = n(minsPerPart);
    const setup      = n(setupMins);
    const mat        = n(matCost);
    const scrap      = Math.min(99, n(scrapRate));
    const prof       = Math.min(99, n(margin));

    const scrapMult  = scrap > 0 ? 1 / (1 - scrap / 100) : 1;
    const toMake     = Math.ceil(qty * scrapMult);
    const scrapCount = toMake - qty;

    const setupCost  = setup * ratePerMin;
    const laborCost  = toMake * tpp * ratePerMin + setupCost;
    const matCostTotal = toMake * mat;
    const rawTotal   = laborCost + matCostTotal;
    const rawPerGood = rawTotal / qty;
    const priceEach  = rawPerGood / (1 - prof / 100);
    const priceJob   = priceEach * qty;
    const profit     = priceJob - rawTotal;

    return { ratePerHr, toMake, scrapCount, setupCost, laborCost, matCostTotal, rawTotal, rawPerGood, priceEach, priceJob, profit };
  }, [settings, quantity, minsPerPart, setupMins, matCost, scrapRate, margin]);

  const addPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(f => {
      const r = new FileReader();
      r.onloadend = () => setPhotos(p => [...p, r.result as string]);
      r.readAsDataURL(f);
    });
  }, []);

  const save = async () => {
    if (!calc) return;
    setSaving(true); setSaveErr("");
    try {
      const uploaded = await Promise.all(photos.map(async ph => {
        if (!ph.startsWith("data:image")) return ph;
        try {
          const r = ref(storage, `jobs/${Date.now()}-${Math.random().toString(36).slice(2)}`);
          await uploadString(r, ph, "data_url");
          return await getDownloadURL(r);
        } catch { return ph; }
      }));

      const payload = {
        partNumber, name: jobName, customer, status, dueDate, notes,
        quantity: n(quantity), minutesPerPart: n(minsPerPart),
        setupMinutes: n(setupMins), materialCostPerPart: n(matCost),
        scrapRate: n(scrapRate), profitMargin: n(margin),
        photos: JSON.stringify(uploaded),
        photoBase64: uploaded[0] ?? null,
        totalJobPrice:    calc.priceJob,
        totalJobCost:     calc.rawTotal,
        pricePerGoodPart: calc.priceEach,
        partsToMake:      calc.toMake,
      };

      if (id) {
        await updateDoc(doc(db, "jobs", id), payload);
      } else {
        await addDoc(collection(db, "jobs"), { ...payload, createdAt: new Date().toISOString() });
      }
      navigate("/");
    } catch (err) {
      console.error(err);
      setSaveErr("Save failed — check your connection");
    } finally { setSaving(false); }
  };

  // Show spinner while loading — NEVER show blank or flicker
  if (loading) return <Spinner />;

  // Bar widths as plain percentages (CSS transition, no Framer Motion)
  const lPct = calc && calc.priceJob > 0 ? (calc.laborCost    / calc.priceJob) * 100 : 0;
  const mPct = calc && calc.priceJob > 0 ? (calc.matCostTotal / calc.priceJob) * 100 : 0;
  const pPct = calc && calc.priceJob > 0 ? (calc.profit       / calc.priceJob) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{id ? "Edit Job" : "New Quote"}</h1>
            <p className="text-zinc-500 mt-0.5 text-sm">
              {id ? "Edit inputs and adjust margin live." : "Calculate and save a new job."}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button onClick={save} disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-sm">
            {saving ? "Saving..." : "Save Job to Database"}
          </button>
          {saveErr && <span className="text-red-500 text-xs">{saveErr}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Left column ── */}
        <div className="lg:col-span-7 space-y-6">

          {/* Job Details */}
          <Card title="Job Details" icon={Briefcase}>
            {/* Photos */}
            <div className="mb-6">
              <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-2 block">Part Photos</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((ph, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 group">
                    <img src={ph} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="relative aspect-square bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center hover:bg-zinc-100 cursor-pointer transition-colors">
                  <input type="file" accept="image/*" multiple onChange={addPhotos} className="sr-only" />
                  <div className="text-center">
                    <Plus size={22} className="text-zinc-300 mx-auto mb-1" />
                    <span className="text-[11px] font-medium text-zinc-400">Add Photo</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Part Number"     type="text" value={partNumber} onChange={setPartNumber} placeholder="e.g. PN-10492"        icon={Tag} />
              <Field label="Job / Part Name" type="text" value={jobName}    onChange={setJobName}    placeholder="e.g. Titanium Bracket" icon={Briefcase} />
              <Field label="Customer"        type="text" value={customer}   onChange={setCustomer}   placeholder="e.g. ACME Corp"        icon={User} />

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Tag size={12} /> Status
                </label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[16px] font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} /> Due Date
                </label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[16px] font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all" />
              </div>
            </div>
          </Card>

          {/* Pricing Inputs */}
          <Card title="Pricing Inputs" icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Quantity (good parts needed)" value={quantity}    onChange={setQuantity}    suffix="pcs" icon={Package} />
              <Field label="Time per Part"                value={minsPerPart} onChange={setMinsPerPart} suffix="min" icon={Clock}   placeholder="e.g. 5" />
              <Field label="Setup / Fixture Time (once)"  value={setupMins}   onChange={setSetupMins}   suffix="min" icon={Timer}   placeholder="e.g. 30" />
              <Field label="Material Cost per Part"       value={matCost}     onChange={setMatCost}     prefix="$"   icon={DollarSign} placeholder="e.g. 2.50" />
              <Field label="Scrap / Rejection Rate"       value={scrapRate}   onChange={setScrapRate}   suffix="%"   icon={AlertTriangle} placeholder="e.g. 5" />
            </div>

            {n(scrapRate) > 0 && calc && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-amber-800 text-sm">
                  To deliver <strong>{n(quantity)} good parts</strong> you must make{" "}
                  <strong>{calc.toMake} parts</strong> ({calc.scrapCount} expected scrap).
                  Labor &amp; material already accounts for this.
                </p>
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card title="Job Notes" icon={Wrench}>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Special instructions, material specs, tolerances, finish requirements, client requests..."
              className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[15px] text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all min-h-[110px] resize-y"
            />
          </Card>
        </div>

        {/* ── Right column — Results panel ── */}
        <div className="lg:col-span-5">
          <div className="sticky top-8 bg-[#1d1d1f] rounded-[28px] p-8 text-white shadow-2xl overflow-hidden">

            {/* Glow blobs — purely decorative, no animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[28px]" aria-hidden>
              <div className="absolute -top-16 -left-8 w-56 h-56 bg-blue-600 rounded-full opacity-20 blur-[70px]" />
              <div className="absolute -bottom-16 -right-8 w-56 h-56 bg-emerald-500 rounded-full opacity-20 blur-[70px]" />
            </div>

            {calc ? (
              <div className="relative z-10">
                {/* Price */}
                <div className="mb-6">
                  <div className="text-zinc-400 text-sm font-medium mb-1">Total Price to Client</div>
                  <div className="text-5xl font-bold tracking-tighter leading-none mb-3">{fmt(calc.priceJob)}</div>
                  <div className="text-zinc-400 text-xs mb-0.5">Price per Part</div>
                  <div className="text-2xl font-semibold text-zinc-200">{fmt(calc.priceEach)}</div>
                </div>

                {/* Breakdown bar — CSS width transition, NO Framer Motion layout */}
                <div className="mb-6">
                  <div className="flex justify-between text-[11px] font-semibold mb-2">
                    <span className="text-blue-400">Labor {fmt(calc.laborCost)}</span>
                    <span className="text-purple-400">Mat. {fmt(calc.matCostTotal)}</span>
                    <span className="text-emerald-400">Profit {fmt(calc.profit)}</span>
                  </div>
                  <div className="h-3.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500   h-full transition-all duration-300 ease-out" style={{ width: `${lPct}%` }} />
                    <div className="bg-purple-500 h-full transition-all duration-300 ease-out" style={{ width: `${mPct}%` }} />
                    <div className="bg-emerald-500 h-full transition-all duration-300 ease-out" style={{ width: `${pPct}%` }} />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 pt-5 border-t border-zinc-800">
                  <Stat label="True Cost / Hr"  value={fmt(calc.ratePerHr)} />
                  <Stat label="Raw Cost / Part"  value={fmt(calc.rawPerGood)} />
                  <Stat label="Parts to Make"
                        value={String(calc.toMake)}
                        sub={calc.scrapCount > 0 ? `+${calc.scrapCount} for scrap` : "No scrap"} />
                  <Stat label="Total Cost"       value={fmt(calc.rawTotal)} />
                  {n(setupMins) > 0 && <Stat label="Setup Cost" value={fmt(calc.setupCost)} sub="One-time" />}
                  <Stat label="Gross Profit"     value={fmt(calc.profit)} green />
                </div>

                {/* Margin slider */}
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[14px] font-medium text-zinc-300 flex items-center gap-2">
                      <PieChart size={15} className="text-emerald-400" /> Profit Margin
                    </span>
                    <span className="bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-lg font-bold border border-emerald-500/20">
                      {margin}%
                    </span>
                  </div>
                  <input type="range" min="0" max="80" value={margin} onChange={e => setMargin(e.target.value)}
                    className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                  <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                    <span>0%</span><span>40%</span><span>80%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative z-10 text-center py-12 text-zinc-500">
                Enter job details to see pricing
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  const nav = [
    { path: "/",         label: "Jobs Database",    Icon: LayoutDashboard },
    { path: "/new",      label: "New Quote",         Icon: Plus },
    { path: "/settings", label: "Overhead Settings", Icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col md:flex-row">
      <aside className="w-full md:w-60 bg-white border-r border-zinc-200 md:min-h-screen p-5 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Briefcase size={15} className="text-white" />
          </div>
          <span className="font-bold text-[17px] text-zinc-900">Job Pricer Pro</span>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ path, label, Icon }) => {
            const active = pathname === path || (path === "/" && pathname.startsWith("/job/"));
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-[14px] transition-all ${active ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}>
                <Icon size={17} className={active ? "text-blue-600" : "text-zinc-400"} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 md:p-10 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/new"      element={<JobEditor />} />
          <Route path="/job/:id"  element={<JobEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}