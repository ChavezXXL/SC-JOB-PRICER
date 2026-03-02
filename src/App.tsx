import { useState, useMemo, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { Building2, Users, Briefcase, Package, AlertCircle, Wrench, Clock, DollarSign, PieChart, Plus, Image as ImageIcon, Search, ChevronRight, LayoutDashboard, Settings as SettingsIcon, Trash2, SlidersHorizontal, X } from "lucide-react";
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val || 0);

const p = (val: string | number) => Math.max(0, Number(val) || 0);

// --- UI Components ---

function AppleCard({ title, icon: Icon, children, className = "", action }: any) {
  return (
    <div className={`bg-white rounded-[32px] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100/80 ${className}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-2xl border border-blue-100/50">
            <Icon size={20} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h2>
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsList({ children }: any) {
  return <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">{children}</div>;
}

function SettingsRow({ label, value, onChange, prefix, suffix, hint }: any) {
  return (
    <div className="flex items-center justify-between p-3.5 border-b border-zinc-100 last:border-0 bg-white transition-colors focus-within:bg-blue-50/50">
      <div className="flex flex-col">
        <span className="text-[15px] font-medium text-zinc-800">{label}</span>
        {hint && <span className="text-[12px] text-zinc-400">{hint}</span>}
      </div>
      <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
        {prefix && <span className="text-zinc-400 text-[15px]">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 text-right text-[15px] font-semibold text-zinc-900 focus:outline-none bg-transparent"
          placeholder="0"
        />
        {suffix && <span className="text-zinc-400 text-[15px] font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function JobInput({ label, value, onChange, prefix, suffix, icon: Icon, type = "number", placeholder }: any) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium text-zinc-500 flex items-center gap-1.5">
        {Icon && <Icon size={14} />}
        {label}
      </label>
      <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-zinc-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all shadow-sm">
        {prefix && <span className="text-zinc-400 font-medium">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-[17px] font-semibold text-zinc-900 focus:outline-none bg-transparent"
          placeholder={placeholder || "0"}
        />
        {suffix && <span className="text-zinc-400 font-medium">{suffix}</span>}
      </div>
    </div>
  );
}

function StatBox({ label, value, subtext }: any) {
  return (
    <div className="flex flex-col p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
      <span className="text-zinc-400 text-[13px] font-medium mb-1">{label}</span>
      <span className="text-xl font-semibold text-white tracking-tight">{value}</span>
      {subtext && <span className="text-zinc-500 text-[11px] mt-1">{subtext}</span>}
    </div>
  );
}

// --- Pages ---

function Dashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setJobs(jobsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, e: any) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    
    setIsDeleting(id);
    try {
      await deleteDoc(doc(db, "jobs", id));
    } catch (err) {
      console.error("Failed to delete job", err);
    } finally {
      setIsDeleting(null);
      setConfirmDeleteId(null);
    }
  };

  const filteredJobs = useMemo(() => {
    let result = [...jobs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(j => 
        (j.name && j.name.toLowerCase().includes(q)) || 
        (j.partNumber && j.partNumber.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'date-asc') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'price-desc') return b.totalJobPrice - a.totalJobPrice;
      if (sortBy === 'price-asc') return a.totalJobPrice - b.totalJobPrice;
      return 0;
    });
    return result;
  }, [jobs, searchQuery, sortBy]);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Jobs & Quotes</h1>
          <p className="text-zinc-500 font-medium mt-1">Reference past work and pricing.</p>
        </div>
        <Link to="/new" className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium transition-colors shadow-sm whitespace-nowrap">
          <Plus size={18} />
          New Quote
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by part number or name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-2xl pl-11 pr-4 py-3 text-[15px] font-medium text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-auto">
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)}
              className="w-full md:w-auto appearance-none bg-white border border-zinc-200 rounded-2xl pl-4 pr-10 py-3 text-[15px] font-medium text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="price-desc">Highest Price</option>
              <option value="price-asc">Lowest Price</option>
            </select>
            <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-500">Loading jobs...</div>
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-zinc-200 p-12 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">No jobs yet</h3>
          <p className="text-zinc-500 mb-6">Create your first quote to start building your database.</p>
          <Link to="/new" className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full font-medium transition-colors">
            Create Quote
          </Link>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-zinc-200 p-12 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-zinc-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">No results found</h3>
          <p className="text-zinc-500 mb-6">We couldn't find any quotes matching "{searchQuery}".</p>
          <button onClick={() => setSearchQuery("")} className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-5 py-2.5 rounded-full font-medium transition-colors">
            Clear Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <div 
              key={job.id} 
              onClick={() => navigate(`/job/${job.id}`)}
              className="bg-white rounded-[24px] border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col cursor-pointer group"
            >
              <div className="h-48 bg-zinc-100 relative overflow-hidden shrink-0">
                {(() => {
                  let displayPhoto = job.photoBase64;
                  if (job.photos) {
                    try {
                      const parsed = JSON.parse(job.photos);
                      if (parsed.length > 0) displayPhoto = parsed[0];
                    } catch(e) {}
                  }
                  return displayPhoto ? (
                    <img src={displayPhoto} alt={job.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon size={48} />
                    </div>
                  );
                })()}
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-zinc-800 shadow-sm">
                  {job.partNumber || "No PN"}
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h3 className="font-semibold text-lg text-zinc-900 mb-1 truncate">{job.name || "Unnamed Job"}</h3>
                <div className="flex items-center justify-between text-sm text-zinc-500 mb-4">
                  <span>{job.quantity} pcs</span>
                  <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="pt-4 border-t border-zinc-100 flex items-center justify-between mb-4">
                  <div>
                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Total Price</div>
                    <div className="font-bold text-zinc-900">{formatCurrency(job.totalJobPrice)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Per Part</div>
                    <div className="font-bold text-emerald-600">{formatCurrency(job.pricePerGoodPart)}</div>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-zinc-100 flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/job/${job.id}`); }}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Wrench size={16} /> View / Edit
                  </button>
                  <button 
                    onClick={(e) => handleDelete(job.id, e)}
                    disabled={isDeleting === job.id}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${confirmDeleteId === job.id ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100'} disabled:opacity-50`}
                  >
                    <Trash2 size={16} /> {confirmDeleteId === job.id ? 'Confirm?' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({
          wages: 18000, rent: 3500, electric: 600, insurance: 800, equipment: 400,
          supplies: 300, phone: 150, other: 500, hoursPerDay: 8, daysPerMonth: 22, workers: 3
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, "settings", "global"), settings);
    setSaving(false);
  };

  if (!settings) return <div>Loading...</div>;

  const update = (key: string, val: string) => setSettings({ ...settings, [key]: val });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Overhead Settings</h1>
          <p className="text-zinc-500 font-medium mt-1">These values are used to calculate your true hourly cost.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-sm"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <AppleCard title="Monthly Overhead" icon={Building2}>
        <SettingsList>
          <SettingsRow label="Total Wages" value={settings.wages} onChange={(v: string) => update("wages", v)} prefix="$" />
          <SettingsRow label="Rent / Lease" value={settings.rent} onChange={(v: string) => update("rent", v)} prefix="$" />
          <SettingsRow label="Electricity" value={settings.electric} onChange={(v: string) => update("electric", v)} prefix="$" />
          <SettingsRow label="Insurance" value={settings.insurance} onChange={(v: string) => update("insurance", v)} prefix="$" />
          <SettingsRow label="Equipment" value={settings.equipment} onChange={(v: string) => update("equipment", v)} prefix="$" />
          <SettingsRow label="Supplies" value={settings.supplies} onChange={(v: string) => update("supplies", v)} prefix="$" />
          <SettingsRow label="Phone / Internet" value={settings.phone} onChange={(v: string) => update("phone", v)} prefix="$" />
          <SettingsRow label="Other" value={settings.other} onChange={(v: string) => update("other", v)} prefix="$" />
        </SettingsList>
      </AppleCard>

      <AppleCard title="Labor Capacity" icon={Users}>
        <SettingsList>
          <SettingsRow label="Hours per Day" value={settings.hoursPerDay} onChange={(v: string) => update("hoursPerDay", v)} suffix="hrs" />
          <SettingsRow label="Days per Month" value={settings.daysPerMonth} onChange={(v: string) => update("daysPerMonth", v)} suffix="days" />
          <SettingsRow label="Number of Workers" value={settings.workers} onChange={(v: string) => update("workers", v)} suffix="ppl" />
        </SettingsList>
      </AppleCard>
    </div>
  );
}

function JobEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Job State
  const [partNumber, setPartNumber] = useState("");
  const [jobName, setJobName] = useState("");
  const [quantity, setQuantity] = useState<string | number>(100);
  const [minutesPerPart, setMinutesPerPart] = useState<string | number>(5);
  const [materialCostPerPart, setMaterialCostPerPart] = useState<string | number>(2.50);
  const [profitMargin, setProfitMargin] = useState<string | number>(35);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, "settings", "global");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({
          wages: 18000, rent: 3500, electric: 600, insurance: 800, equipment: 400,
          supplies: 300, phone: 150, other: 500, hoursPerDay: 8, daysPerMonth: 22, workers: 3
        });
      }
    };
    fetchSettings();
      
    if (id) {
      const fetchJob = async () => {
        try {
          const docRef = doc(db, "jobs", id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPartNumber(data.partNumber || "");
            setJobName(data.name || "");
            setQuantity(data.quantity || 100);
            setMinutesPerPart(data.minutesPerPart || 5);
            setMaterialCostPerPart(data.materialCostPerPart || 0);
            setProfitMargin(data.profitMargin || 35);
            setNotes(data.notes || "");
            
            let loadedPhotos: string[] = [];
            if (data.photos) {
              try { 
                const parsed = typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos;
                if (Array.isArray(parsed) && parsed.length > 0) {
                  loadedPhotos = parsed;
                }
              } catch(e) {}
            }
            if (loadedPhotos.length === 0 && data.photoBase64) {
              loadedPhotos = [data.photoBase64];
            }
            setPhotos(loadedPhotos);
          }
        } catch (err) {
          console.error("Failed to load job", err);
        }
      };
      fetchJob();
    }
  }, [id]);

  const handlePhotoUpload = (e: any) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file as File);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const calc = useMemo(() => {
    if (!settings) return null;
    
    const totalMonthlyOverhead = p(settings.wages) + p(settings.rent) + p(settings.electric) + p(settings.insurance) + p(settings.equipment) + p(settings.supplies) + p(settings.phone) + p(settings.other);
    const totalMonthlyHours = p(settings.hoursPerDay) * p(settings.daysPerMonth) * p(settings.workers);
    const costPerHour = totalMonthlyHours > 0 ? totalMonthlyOverhead / totalMonthlyHours : 0;
    const costPerMinute = costPerHour / 60;

    const vQuantity = p(quantity);
    const calcQuantity = vQuantity > 0 ? vQuantity : 1;
    const vTimePerPart = p(minutesPerPart);
    const vMaterialCost = p(materialCostPerPart);
    const vProfitMargin = Math.min(99, p(profitMargin));

    const partsToMake = calcQuantity;
    const totalLaborCost = (partsToMake * vTimePerPart * costPerMinute);
    const totalMaterialCost = partsToMake * vMaterialCost;
    const totalRawCost = totalLaborCost + totalMaterialCost;

    const rawCostPerGoodPart = totalRawCost / calcQuantity;
    const pricePerGoodPart = rawCostPerGoodPart / (1 - vProfitMargin / 100);

    const totalJobPrice = vQuantity > 0 ? pricePerGoodPart * vQuantity : 0;
    const totalJobCost = vQuantity > 0 ? totalRawCost : 0;
    const grossProfit = totalJobPrice - totalJobCost;

    return { costPerHour, partsToMake, totalLaborCost, totalMaterialCost, totalRawCost, rawCostPerGoodPart, pricePerGoodPart, totalJobPrice, totalJobCost, grossProfit };
  }, [settings, quantity, minutesPerPart, materialCostPerPart, profitMargin]);

  const handleSave = async () => {
    if (!calc) return;
    setSaving(true);
    
    try {
      // Upload any new base64 photos to Firebase Storage
      const uploadedPhotos = await Promise.all(photos.map(async (photo) => {
        if (photo.startsWith("data:image")) {
          try {
            const photoRef = ref(storage, `jobs/${Date.now()}-${Math.random().toString(36).slice(2)}`);
            await uploadString(photoRef, photo, 'data_url');
            return await getDownloadURL(photoRef);
          } catch (uploadErr) {
            console.warn("Storage upload failed, falling back to base64", uploadErr);
            return photo; // Fallback to base64 if storage is not configured
          }
        }
        return photo; // Already a URL
      }));

      const payload = {
        partNumber, name: jobName, quantity: p(quantity),
        minutesPerPart: p(minutesPerPart), materialCostPerPart: p(materialCostPerPart),
        profitMargin: p(profitMargin), notes, 
        photos: JSON.stringify(uploadedPhotos), 
        photoBase64: uploadedPhotos.length > 0 ? uploadedPhotos[0] : null,
        totalJobPrice: calc.totalJobPrice, totalJobCost: calc.totalJobCost, pricePerGoodPart: calc.pricePerGoodPart
      };
      
      if (id) {
        await updateDoc(doc(db, "jobs", id), payload);
      } else {
        await addDoc(collection(db, "jobs"), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      navigate("/");
    } catch (err) {
      console.error("Failed to save job", err);
      setSaving(false);
    }
  };

  if (!settings || !calc) return <div>Loading calculator...</div>;

  const laborPct = calc.totalJobPrice > 0 ? (calc.totalLaborCost / calc.totalJobPrice) * 100 : 0;
  const materialPct = calc.totalJobPrice > 0 ? (calc.totalMaterialCost / calc.totalJobPrice) * 100 : 0;
  const profitPct = calc.totalJobPrice > 0 ? (calc.grossProfit / calc.totalJobPrice) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">{id ? "Job Details" : "New Quote"}</h1>
          <p className="text-zinc-500 font-medium mt-1">{id ? "View details, edit inputs, and adjust your profit margin live." : "Calculate and save a new job to the database."}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-full font-medium transition-colors shadow-sm"
        >
          {saving ? "Saving..." : "Save Job to Database"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 space-y-8">
          <AppleCard title="Job Details" icon={Briefcase}>
            {/* Photos Upload */}
            <div className="mb-8">
              <label className="text-[13px] font-medium text-zinc-500 mb-2 block">Part Photos</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-zinc-200 group">
                    <img src={photo} alt={`Part ${i+1}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removePhoto(i)}
                      className="absolute top-2 right-2 bg-black/50 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="relative aspect-square bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-2xl overflow-hidden hover:bg-zinc-100 transition-colors flex items-center justify-center group cursor-pointer">
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                  <div className="text-center">
                    <Plus size={24} className="text-zinc-300 mx-auto mb-1 group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs font-medium text-zinc-500">Add Photo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              <JobInput label="Part Number" type="text" value={partNumber} onChange={setPartNumber} placeholder="e.g. PN-10492" icon={Search} />
              <JobInput label="Job / Part Name" type="text" value={jobName} onChange={setJobName} placeholder="e.g. Titanium Bracket" icon={Briefcase} />
              <JobInput label="Quantity" value={quantity} onChange={setQuantity} suffix="pcs" icon={Package} />
              <JobInput label="Time per Part" value={minutesPerPart} onChange={setMinutesPerPart} suffix="min" icon={Clock} />
              <JobInput label="Material Cost / Part" value={materialCostPerPart} onChange={setMaterialCostPerPart} prefix="$" icon={DollarSign} />
            </div>

            {/* Notes */}
            <div className="mb-2">
              <label className="text-[13px] font-medium text-zinc-500 mb-2 block">Job Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add any special instructions, material details, or client requests here..."
                className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-[15px] font-medium text-zinc-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm min-h-[100px] resize-y"
              />
            </div>
          </AppleCard>
        </div>

        {/* Results Card */}
        <div className="lg:col-span-5">
          <div className="sticky top-8">
            <motion.div layout className="bg-[#1d1d1f] rounded-[32px] p-8 md:p-10 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-lg opacity-40 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-72 h-72 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-72 h-72 bg-emerald-500 rounded-full mix-blend-screen filter blur-[100px]" />
              </div>

              <div className="relative z-10">
                <div className="mb-8">
                  <h3 className="text-zinc-400 font-medium mb-2">Total Price to Client</h3>
                  <div className="text-5xl md:text-6xl font-semibold tracking-tighter text-white mb-4">
                    {formatCurrency(calc.totalJobPrice)}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-zinc-400 text-sm font-medium mb-1">Price per Part</h3>
                      <div className="text-2xl font-medium text-zinc-200">{formatCurrency(calc.pricePerGoodPart)}</div>
                    </div>
                  </div>
                </div>

                {/* Breakdown Bar */}
                <div className="mb-8">
                  <div className="flex justify-between text-[13px] font-medium mb-3">
                    <span className="text-blue-400">Labor ({formatCurrency(calc.totalLaborCost)})</span>
                    <span className="text-purple-400">Mat. ({formatCurrency(calc.totalMaterialCost)})</span>
                    <span className="text-emerald-400">Profit ({formatCurrency(calc.grossProfit)})</span>
                  </div>
                  <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex gap-0.5">
                    <motion.div initial={false} animate={{ width: `${laborPct}%` }} className="bg-blue-500 h-full" />
                    <motion.div initial={false} animate={{ width: `${materialPct}%` }} className="bg-purple-500 h-full" />
                    <motion.div initial={false} animate={{ width: `${profitPct}%` }} className="bg-emerald-500 h-full" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-zinc-800/50">
                  <StatBox label="True Cost / Hr" value={formatCurrency(calc.costPerHour)} />
                  <StatBox label="Raw Cost / Part" value={formatCurrency(calc.rawCostPerGoodPart)} />
                  <StatBox label="Parts to Make" value={calc.partsToMake} />
                  <StatBox label="Total Cost" value={formatCurrency(calc.totalJobCost)} />
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-800/50">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[15px] font-medium text-zinc-300 flex items-center gap-2">
                      <PieChart size={18} className="text-emerald-400" />
                      Adjust Profit Margin
                    </label>
                    <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg font-bold text-lg border border-emerald-500/20">
                      {profitMargin}%
                    </div>
                  </div>
                  <input
                    type="range" min="0" max="80" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)}
                    className="w-full h-2.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Layout & App ---

function Layout({ children }: any) {
  const location = useLocation();
  
  const nav = [
    { path: "/", label: "Jobs Database", icon: LayoutDashboard },
    { path: "/new", label: "New Quote", icon: Plus },
    { path: "/settings", label: "Overhead Settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#f5f5f7] font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-zinc-200/80 md:min-h-screen p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight text-zinc-900">Job Pricer Pro</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          {nav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  active ? "bg-blue-50 text-blue-700" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                }`}
              >
                <item.icon size={18} className={active ? "text-blue-600" : "text-zinc-400"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<JobEditor />} />
          <Route path="/job/:id" element={<JobEditor />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
