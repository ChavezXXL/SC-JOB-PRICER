// App.tsx
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Building2,
  Users,
  Briefcase,
  DollarSign,
  Plus,
  Image as ImageIcon,
  Search,
  Trash2,
  X,
  Copy,
  ArrowLeft,
  User,
  Calendar,
  Tag,
  CheckCircle,
  Circle,
  PlayCircle,
  XCircle,
  Wrench,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(val || 0);

const n = (val: string | number) => Math.max(0, Number(val) || 0);

const DEFAULT_SETTINGS = {
  wages: 18000,
  rent: 3500,
  electric: 600,
  insurance: 800,
  equipment: 400,
  supplies: 300,
  phone: 150,
  other: 500,
  hoursPerDay: 8,
  daysPerMonth: 22,
  workers: 3,
};

const STATUSES = [
  { value: "quoted", label: "Quoted", bg: "bg-blue-100", text: "text-blue-700", Icon: Circle },
  { value: "won", label: "Won", bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle },
  { value: "in_progress", label: "In Progress", bg: "bg-amber-100", text: "text-amber-700", Icon: PlayCircle },
  { value: "completed", label: "Completed", bg: "bg-zinc-100", text: "text-zinc-600", Icon: CheckCircle },
  { value: "lost", label: "Lost", bg: "bg-red-100", text: "text-red-600", Icon: XCircle },
];

const getStatus = (v: string) => STATUSES.find((s) => s.value === v) ?? STATUSES[0];

function getCoverPhoto(job: any) {
  // NEW: coverPhoto
  if (job.coverPhoto) return job.coverPhoto;

  // NEW: photos array
  if (Array.isArray(job.photos) && job.photos[0]) return job.photos[0];

  // OLD: photos JSON string
  if (typeof job.photos === "string") {
    try {
      const arr = JSON.parse(job.photos);
      if (arr?.[0]) return arr[0];
    } catch {}
  }

  // OLD: base64
  if (job.photoBase64) return job.photoBase64;

  return null;
}

// ─── Shared UI ──────────────────────────────────────────────────────────────
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
          onChange={(e) => onChange(e.target.value)}
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
        {Icon && <Icon size={12} />}
        {label}
      </label>
      <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 shadow-sm transition-all">
        {prefix && <span className="text-zinc-400 font-medium shrink-0">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          className="w-full text-[16px] font-semibold text-zinc-900 bg-transparent focus:outline-none"
        />
        {suffix && <span className="text-zinc-400 font-medium shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = getStatus(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${s.bg} ${s.text}`}>
      <s.Icon size={10} />
      {s.label}
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

// ─── Dashboard ──────────────────────────────────────────────────────────────
function Dashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [statusFilter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [duping, setDuping] = useState<string | null>(null);

  useEffect(() => {
    // Limit helps if you have a lot of jobs
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"), limit(300));
    return onSnapshot(
      q,
      (snap) => {
        setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
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
    try {
      await deleteDoc(doc(db, "jobs", id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
      setConfirmDel(null);
    }
  };

  const handleDupe = async (job: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuping(job.id);
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = job;
      await addDoc(collection(db, "jobs"), {
        ...rest,
        name: `${rest.name || "Unnamed"} (Copy)`,
        status: "quoted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDuping(null);
    }
  };

  const visible = useMemo(() => {
    let r = [...jobs];
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(
        (j) =>
          j.name?.toLowerCase().includes(q) ||
          j.partNumber?.toLowerCase().includes(q) ||
          j.customer?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((j) => (j.status || "quoted") === statusFilter);

    r.sort((a, b) => {
      // Firestore Timestamp safe-ish: if it's a Timestamp, use .toDate()
      const aDate = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const bDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);

      if (sort === "date-desc") return bDate.getTime() - aDate.getTime();
      if (sort === "date-asc") return aDate.getTime() - bDate.getTime();
      if (sort === "price-desc") return (b.totalJobPrice || 0) - (a.totalJobPrice || 0);
      if (sort === "price-asc") return (a.totalJobPrice || 0) - (b.totalJobPrice || 0);
      return 0;
    });

    return r;
  }, [jobs, search, sort, statusFilter]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Jobs & Quotes</h1>
          <p className="text-zinc-500 mt-1">Reference past work and pricing.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 px-5 py-2.5 rounded-full font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            Settings
          </Link>
          <Link
            to="/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={18} /> New Quote
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search part number, name, or customer..."
            className="w-full bg-white border border-zinc-200 rounded-2xl pl-10 pr-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none shadow-sm cursor-pointer"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[14px] font-medium text-zinc-900 focus:outline-none shadow-sm cursor-pointer"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="price-desc">Highest Price</option>
          <option value="price-asc">Lowest Price</option>
        </select>
      </div>

      {loading ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-zinc-100 p-16 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">No jobs yet</h3>
          <p className="text-zinc-500 mb-6">Create your first quote to start building your database.</p>
          <Link to="/new" className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full font-semibold transition-colors">
            Create Quote
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-[28px] border border-zinc-100 p-16 text-center">
          <p className="text-zinc-500 mb-4">No quotes match your filters.</p>
          <button
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
            className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-5 py-2.5 rounded-full font-semibold transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((job) => {
            const photo = getCoverPhoto(job);
            const due = job.dueDate ? new Date(job.dueDate) : null;

            return (
              <div
                key={job.id}
                onClick={() => navigate(`/job/${job.id}`)}
                className="bg-white rounded-[22px] border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col cursor-pointer"
              >
                <div className="h-44 bg-zinc-100 relative overflow-hidden shrink-0">
                  {photo ? (
                    <img src={photo} alt={job.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={40} className="text-zinc-300" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[11px] font-bold text-zinc-800 shadow-sm">
                    {job.partNumber || "No PN"}
                  </div>
                  <div className="absolute top-3 right-3">
                    <StatusBadge status={job.status || "quoted"} />
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-bold text-zinc-900 text-[16px] truncate mb-0.5">{job.name || "Unnamed Job"}</h3>

                  {job.customer && (
                    <p className="text-[13px] text-zinc-400 mb-2 flex items-center gap-1">
                      <User size={11} />
                      {job.customer}
                    </p>
                  )}

                  <div className="flex justify-between text-[13px] text-zinc-500 mb-4">
                    <span>
                      {job.quantity} pcs{job.scrapRate > 0 ? ` · ${job.scrapRate}% scrap` : ""}
                    </span>
                    {due && (
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {due.toLocaleDateString()}
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

                  <div className="pt-3 border-t border-zinc-100 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/job/${job.id}`);
                      }}
                      className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Wrench size={13} /> Edit
                    </button>

                    <button
                      onClick={(e) => handleDupe(job, e)}
                      disabled={duping === job.id}
                      className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Copy size={13} />
                      {duping === job.id ? "..." : "Copy"}
                    </button>

                    <button
                      onClick={(e) => handleDelete(job.id, e)}
                      disabled={deleting === job.id}
                      className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 ${
                        confirmDel === job.id ? "bg-red-500 text-white" : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      <Trash2 size={13} />
                      {confirmDel === job.id ? "Sure?" : "Del"}
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

// ─── Settings ───────────────────────────────────────────────────────────────
function Settings() {
  const navigate = useNavigate();
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

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
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } catch {
      setMsg("Save failed — check connection");
    } finally {
      setSaving(false);
    }
  };

  const upd = (k: string, v: string) => setS((prev: any) => ({ ...prev, [k]: v }));
  if (!s) return <Spinner />;

  const overhead = ["wages", "rent", "electric", "insurance", "equipment", "supplies", "phone", "other"].reduce(
    (a, k) => a + n(s[k]),
    0
  );
  const hours = n(s.hoursPerDay) * n(s.daysPerMonth) * n(s.workers);
  const rate = hours > 0 ? overhead / hours : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Overhead Settings</h1>
            <p className="text-zinc-500 mt-1">These values calculate your true hourly cost.</p>
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-sm"
        >
          {msg || (saving ? "Saving..." : "Save Settings")}
        </button>
      </div>

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
          <FieldRow label="Total Wages" hint="All employee wages combined" value={s.wages} onChange={(v: string) => upd("wages", v)} prefix="$" />
          <FieldRow label="Rent / Lease" value={s.rent} onChange={(v: string) => upd("rent", v)} prefix="$" />
          <FieldRow label="Electricity" value={s.electric} onChange={(v: string) => upd("electric", v)} prefix="$" />
          <FieldRow label="Insurance" value={s.insurance} onChange={(v: string) => upd("insurance", v)} prefix="$" />
          <FieldRow label="Equipment" hint="Leases, maintenance, depreciation" value={s.equipment} onChange={(v: string) => upd("equipment", v)} prefix="$" />
          <FieldRow label="Supplies" value={s.supplies} onChange={(v: string) => upd("supplies", v)} prefix="$" />
          <FieldRow label="Phone / Internet" value={s.phone} onChange={(v: string) => upd("phone", v)} prefix="$" />
          <FieldRow label="Other" value={s.other} onChange={(v: string) => upd("other", v)} prefix="$" />
        </div>
      </Card>

      <Card title="Labor Capacity" icon={Users}>
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <FieldRow label="Hours per Day" hint="Productive hours, not clock-in time" value={s.hoursPerDay} onChange={(v: string) => upd("hoursPerDay", v)} suffix="hrs" />
          <FieldRow label="Days per Month" value={s.daysPerMonth} onChange={(v: string) => upd("daysPerMonth", v)} suffix="days" />
          <FieldRow label="Number of Workers" hint="Floor workers only" value={s.workers} onChange={(v: string) => upd("workers", v)} suffix="ppl" />
        </div>
      </Card>
    </div>
  );
}

// ─── Job Editor ─────────────────────────────────────────────────────────────
function JobEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [settings, setSettings] = useState<any>(null);

  // Form state
  const [partNumber, setPartNumber] = useState("");
  const [jobName, setJobName] = useState("");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("quoted");
  const [dueDate, setDueDate] = useState("");
  const [quantity, setQuantity] = useState<string | number>(100);
  const [minsPerPart, setMinsPerPart] = useState<string | number>(5);
  const [setupMins, setSetupMins] = useState<string | number>(0);
  const [matCost, setMatCost] = useState<string | number>(2.5);
  const [scrapRate, setScrapRate] = useState<string | number>(0);
  const [margin, setMargin] = useState<string | number>(35);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      let cfg = { ...DEFAULT_SETTINGS };
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        if (snap.exists()) cfg = snap.data() as any;
      } catch {}

      if (!cancelled) setSettings(cfg);

      if (id) {
        try {
          const snap = await getDoc(doc(db, "jobs", id));
          if (snap.exists() && !cancelled) {
            const d: any = snap.data();

            setPartNumber(d.partNumber || "");
            setJobName(d.name || "");
            setCustomer(d.customer || "");
            setStatus(d.status || "quoted");
            setDueDate(d.dueDate || "");
            setQuantity(d.quantity ?? 100);
            setMinsPerPart(d.minutesPerPart ?? 5);
            setSetupMins(d.setupMinutes ?? 0);
            setMatCost(d.materialCostPerPart ?? 0);
            setScrapRate(d.scrapRate ?? 0);
            setMargin(d.profitMargin ?? 35);
            setNotes(d.notes || "");

            let px: string[] = [];
            if (Array.isArray(d.photos)) px = d.photos;
            else if (typeof d.photos === "string") {
              try {
                px = JSON.parse(d.photos);
              } catch {}
            }

            if (!px.length && d.coverPhoto) px = [d.coverPhoto];
            if (!px.length && d.photoBase64) px = [d.photoBase64];

            setPhotos(px);
          }
        } catch (e) {
          console.error("Job load failed:", e);
        }
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const calc = useMemo(() => {
    if (!settings) return null;

    const overhead =
      n(settings.wages) +
      n(settings.rent) +
      n(settings.electric) +
      n(settings.insurance) +
      n(settings.equipment) +
      n(settings.supplies) +
      n(settings.phone) +
      n(settings.other);

    const totalHours = n(settings.hoursPerDay) * n(settings.daysPerMonth) * n(settings.workers);
    const ratePerHr = totalHours > 0 ? overhead / totalHours : 0;
    const ratePerMin = ratePerHr / 60;

    const qty = Math.max(1, n(quantity));
    const tpp = n(minsPerPart);
    const setup = n(setupMins);
    const mat = n(matCost);
    const scrap = Math.min(99, n(scrapRate));
    const prof = Math.min(99, n(margin));

    const scrapMult = scrap > 0 ? 1 / (1 - scrap / 100) : 1;
    const toMake = Math.ceil(qty * scrapMult);
    const scrapCount = toMake - qty;

    const setupCost = setup * ratePerMin;
    const laborCost = toMake * tpp * ratePerMin + setupCost;
    const matCostTotal = toMake * mat;
    const rawTotal = laborCost + matCostTotal;

    const rawPerGood = rawTotal / qty;
    const priceEach = rawPerGood / (1 - prof / 100);
    const priceJob = priceEach * qty;
    const profit = priceJob - rawTotal;

    return { ratePerHr, toMake, scrapCount, setupCost, laborCost, matCostTotal, rawTotal, rawPerGood, priceEach, priceJob, profit };
  }, [settings, quantity, minsPerPart, setupMins, matCost, scrapRate, margin]);

  // Faster image pipeline (decode/resize async)
  const addPhotos = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const compress = async (file: File): Promise<string> => {
      const MAX = 1200;
      const bitmap = await createImageBitmap(file);

      const ratio = Math.min(MAX / bitmap.width, MAX / bitmap.height, 1);
      const w = Math.round(bitmap.width * ratio);
      const h = Math.round(bitmap.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.72);
    };

    const compressed = await Promise.all(files.map(compress));
    setPhotos((p) => [...p, ...compressed.filter(Boolean)]);
  }, []);

  const save = async () => {
    if (!calc) return;
    setSaving(true);
    setSaveErr("");

    try {
      // Upload base64 photos -> URLs
      const uploadedPhotos: string[] = [];

      for (const ph of photos) {
        if (!ph) continue;

        if (!ph.startsWith("data:image")) {
          uploadedPhotos.push(ph);
          continue;
        }

        const r = ref(storage, `jobs/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        await uploadString(r, ph, "data_url");
        const url = await getDownloadURL(r);
        uploadedPhotos.push(url);
      }

      const payload: any = {
        partNumber,
        name: jobName,
        customer,
        status,
        dueDate,
        notes,

        quantity: n(quantity),
        minutesPerPart: n(minsPerPart),
        setupMinutes: n(setupMins),
        materialCostPerPart: n(matCost),
        scrapRate: n(scrapRate),
        profitMargin: n(margin),

        // NEW schema (fast)
        photos: uploadedPhotos,
        coverPhoto: uploadedPhotos[0] ?? null,

        totalJobPrice: calc.priceJob,
        totalJobCost: calc.rawTotal,
        pricePerGoodPart: calc.priceEach,
        partsToMake: calc.toMake,

        updatedAt: serverTimestamp(),
      };

      if (id) {
        await updateDoc(doc(db, "jobs", id), payload);
      } else {
        await addDoc(collection(db, "jobs"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      navigate("/");
    } catch (err) {
      console.error(err);
      setSaveErr("Save failed — check your connection");
      setSaving(false);
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{id ? "Edit Job" : "New Quote"}</h1>
            <p className="text-zinc-500 mt-0.5 text-sm">{id ? "Edit inputs and adjust margin live." : "Calculate and save a new job."}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-semibold transition-colors shadow-sm"
          >
            {saving ? "Saving..." : "Save Job to Database"}
          </button>
          {saveErr && <span className="text-red-500 text-xs">{saveErr}</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <Card title="Job Details" icon={Briefcase}>
            <div className="mb-6">
              <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide mb-2 block">Part Photos</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((ph, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 group">
                    <img src={ph} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <button
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-1.5 right-1.5 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
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
              <Field label="Part Number" type="text" value={partNumber} onChange={setPartNumber} placeholder="e.g. PN-10492" icon={Tag} />
              <Field label="Job / Part Name" type="text" value={jobName} onChange={setJobName} placeholder="e.g. Titanium Bracket" icon={Briefcase} />
              <Field label="Customer" type="text" value={customer} onChange={setCustomer} placeholder="e.g. ACME Corp" icon={User} />

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Tag size={12} /> Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[16px] font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[16px] font-semibold text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
                />
              </div>
            </div>
          </Card>

          <Card title="Pricing Inputs" icon={DollarSign}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Field label="Quantity (good parts needed)" value={quantity} onChange={setQuantity} suffix="pcs" />
              <Field label="Minutes per Part" value={minsPerPart} onChange={setMinsPerPart} suffix="mins" />
              <Field label="Setup Time" value={setupMins} onChange={setSetupMins} suffix="mins" />
              <Field label="Material Cost / Part" value={matCost} onChange={setMatCost} prefix="$" />
              <Field label="Scrap Rate" value={scrapRate} onChange={setScrapRate} suffix="%" />
              <Field label="Desired Profit Margin" value={margin} onChange={setMargin} suffix="%" />
            </div>

            <div className="flex flex-col gap-1.5 mt-4">
              <label className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wide">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any special instructions or details..."
                className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 text-[16px] font-medium text-zinc-900 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm transition-all"
              />
            </div>
          </Card>
        </div>

        {/* Breakdown Sidebar */}
        <div className="lg:col-span-5">
          {calc && (
            <div className="sticky top-6">
              <Card title="Price Breakdown" icon={DollarSign} className="bg-zinc-900 border-none !text-white">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-700 pb-2">
                    <span>Total Price</span>
                    <span className="text-2xl font-bold text-white">{fmt(calc.priceJob)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Price Per Part</span>
                    <span className="font-bold text-white">{fmt(calc.priceEach)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Total Cost</span>
                    <span className="font-bold text-white">{fmt(calc.rawTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-400">
                    <span>Projected Profit</span>
                    <span className="font-bold text-emerald-400">{fmt(calc.profit)}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main App Shell ─────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-12">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/new" element={<JobEditor />} />
          <Route path="/job/:id" element={<JobEditor />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}