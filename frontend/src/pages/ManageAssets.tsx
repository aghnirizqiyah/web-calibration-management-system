import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/api";
import { Plus, FileText, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import { Pencil } from "lucide-react";

type AssetView = "main" | "add" | "registerCert";
type MachineType = "Baking" | "Packaging";
type PlantType = "PGA" | "PGMJ" | "PDP" | "PSPD";
type CalibrationMethod = "WI-S1.7.6.00-01-11" | "WI-S1.7.6.00-01-25";

const PLANTS: PlantType[] = ["PGA", "PGMJ", "PDP", "PSPD"];
const machineTypes = ["Baking", "Packaging"];

const STANDARD_TOOL: Record<CalibrationMethod, string> = {
  "WI-S1.7.6.00-01-11": "Thermometer Digital Nux Hanyoung D55",
  "WI-S1.7.6.00-01-25": "Infrared Thermometer",
};

const UNCERTAINTY: Record<MachineType, string> = {
  Baking: "1 ± °C",
  Packaging: "3 ± °C",
};


/* ─── Normalize helpers ─── */
// "85°C - 120°C" / "85 °C - 125 °C" / "85 °C-125°C" → "85°C - 125°C"
const normalizeParamSuhu = (val: string | null | undefined): string => {
  if (!val) return "—";
  // Hapus semua spasi di sekitar °C, lalu normalisasi separator
  const cleaned = val
    .replace(/\s*°\s*[Cc](?:elcius|elsius)?/g, "°C")  // "° Celcius" / "° celsius" → "°C"
    .replace(/\s*-\s*/g, " - ")                         // normalize dash spacing
    .trim();
  return cleaned;
};

// "1 ± Celcius" / "1 ±°C" / "1 ± celcius" → "1 ± °C"
const normalizeUncertainty = (val: string | null | undefined): string => {
  if (!val) return "—";
  return val
    .replace(/\s*°?\s*[Cc]elcius/g, " °C")
    .replace(/\s*°?\s*[Cc]elsius/g, " °C")
    .replace(/±\s*°C/g, "± °C")
    .trim();
};

/* ─── Mobile Card ─── */
const InstrumentCard: React.FC<{
  inst: any;
  onDelete: (id: string) => void;
  onEdit: (inst: any) => void;
}> = ({ inst, onDelete, onEdit }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-1/30"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{inst.no}. {inst.name}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{inst.plant} • {inst.machine}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <StatusBadge status={inst.status} />
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-surface-1/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div><span className="text-muted-foreground">Machine Type:</span> <span className="font-mono text-foreground">{inst.machineType}</span></div>
            <div><span className="text-muted-foreground">No. Mesin:</span> <span className="font-mono text-foreground">{inst.machineNo}</span></div>
            <div><span className="text-muted-foreground">Metode:</span> <span className="font-mono text-foreground">{inst.calibrationMethod}</span></div>
            <div><span className="text-muted-foreground">Alat Standard:</span> <span className="font-mono text-foreground">{inst.standardTool}</span></div>
            <div><span className="text-muted-foreground">Ketidakpastian:</span> <span className="font-mono text-foreground">{inst.uncertainty}</span></div>
            <div><span className="text-muted-foreground">Parameter Suhu:</span> <span className="font-mono text-foreground">{inst.parameterSuhu || "—"}</span></div>
            <div><span className="text-muted-foreground">Plan:</span> <span className="font-mono text-foreground">{inst.planDate}</span></div>
            <div><span className="text-muted-foreground">Exp:</span> <span className="font-mono text-foreground">{inst.expDate}</span></div>
            <div><span className="text-muted-foreground">Realisasi:</span> <span className="font-mono text-foreground">{inst.realizationDate || "—"}</span></div>
            <div><span className="text-muted-foreground">Certificate:</span> <span className={`font-mono ${inst.certificateNo ? 'text-primary' : 'text-muted-foreground'}`}>{inst.certificateNo || "—"}</span></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onEdit(inst)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25"
            >
              <Pencil size={12} /> Edit
            </button>

            <button
              onClick={() => onDelete(inst.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/25"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main Component ─── */
const ManageAssets: React.FC = () => {

  const [editingId, setEditingId] = useState<string | null>(null);
  const [summary, setSummary] = useState({ total: 0 });
  const [certificates, setCertificates] = useState<string[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [view, setView] = useState<AssetView>("main");
  const [showSuccess, setShowSuccess] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    machineType: "Baking" as MachineType,
    plant: "PGA" as PlantType,
    name: "",
    machineNo: "",
    machine: machineTypes[0],
    calibrationMethod: "WI-S1.7.6.00-01-11" as CalibrationMethod,
    parameterSuhu: "",
    planDate: "",
    expDate: "",
    originalStandardTool: "",
    originalUncertainty: ""
  });

  const [certNo, setCertNo] = useState("");
  const [certError, setCertError] = useState("");
  const [lastCert, setLastCert] = useState("—");

  const lastRegisteredCert = useMemo(() => {
    if (certificates.length === 0) return "—";
    return certificates[0];
  }, [certificates]);

  /* ================= SUMMARY ================= */
  useEffect(() => {
    api.get("/dashboard/summary")
      .then(res => {
        setSummary({ total: res.data.total_instruments });
      })
      .catch(err => console.error(err));
  }, []);

  /* ================= CERTIFICATE ================= */
  useEffect(() => {
    api.get("/sertifikat/all")
      .then(res => {
        setCertificates(res.data.map((c: any) => c.nomor_sertifikat));
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    api.get("/sertifikat")
      .then(res => {
        setLastCert(res.data.nomor_sertifikat || "—");
      })
      .catch(err => console.error(err));
  }, []);

  /* ===== REGISTER CERTIFICATE ===== */
  const registerCertificate = async () => {
    if (!certNo.trim()) {
      toast.error("Certificate number cannot be empty");
      return;
    }
    try {
      const payload = { nomor_sertifikat: certNo.trim() };
      await api.post("/sertifikat", payload);
      toast.success("Certificate registered");
      const res = await api.get("/sertifikat/all");
      setCertificates(res.data.map((c: any) => c.nomor_sertifikat));
      setCertNo("");
    } catch (err: any) {
      console.error("Register certificate error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to register certificate");
    }
  };

  /* ================= FETCH JADWAL ================= */
  const fetchJadwal = async () => {
    try {
      const res = await api.get("/jadwal", {
        params: {
          machine_type: filterMachine || undefined,
          plant: filterPlant || undefined,
          status: filterStatus || undefined,
          search: search || undefined
        }
      });

      const mapped = res.data
        .sort((a: any, b: any) => a.id_jadwal - b.id_jadwal)
        .map((item: any, index: number) => ({
          id: item.id_jadwal,
          no: index + 1,
          name: item.nama_alat,
          machineType: item.machine_type,
          machine: item.mesin,
          plant: item.plant,
          machineNo: item.no_mesin,
          calibrationMethod: item.metode_kalibrasi,
          parameterSuhu: normalizeParamSuhu(item.parameter_suhu),
          standardTool: item.alat_standar,
          uncertainty: normalizeUncertainty(item.ketidakpastian_alat_ukur),
          planDate: item.tanggal_plan?.slice(0, 10),
          expDate: item.tanggal_exp?.slice(0, 10),
          realizationDate: item.tanggal_realisasi?.slice(0, 10),
          status: item.status,
          certificateNo: item.nomor_sertifikat
        }));

      setInstruments(mapped);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJadwal();
  }, [search, filterMachine, filterPlant, filterStatus]);

  /* ================= ADD / EDIT INSTRUMENT ================= */
  const saveInstrument = async () => {
    try {
      const payload = {
        nama_alat: form.name,
        machine_type: form.machineType,
        mesin: form.machine,
        plant: form.plant,
        no_mesin: form.machineNo,
        metode_kalibrasi: form.calibrationMethod,
        parameter_suhu: form.parameterSuhu,
        alat_standar: editingId && form.originalStandardTool
          ? form.originalStandardTool
          : STANDARD_TOOL[form.calibrationMethod],
        ketidakpastian_alat_ukur: editingId && form.originalUncertainty
          ? form.originalUncertainty
          : UNCERTAINTY[form.machineType],
        tanggal_plan: form.planDate,
        tanggal_exp: form.expDate
      };

      if (editingId) {
        await api.put(`/jadwal/${editingId}`, payload);
        toast.success("Instrument updated");
      } else {
        await api.post("/jadwal", payload);
        toast.success("Instrument added");
      }

      fetchJadwal();
    } catch (err) {
      console.error(err);
      toast.error(editingId ? "Failed to update instrument" : "Failed to add instrument");
    }
  };

  /* ================= DELETE ================= */
  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Apakah Anda yakin ingin menghapus data instrumen ini?");
    if (!confirmed) return;

    try {
      await api.delete(`/jadwal/${id}`);
      toast.success("Data Berhasil Dihapus");
      fetchJadwal();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  /* ================= VALIDATE ================= */
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Required";
    if (!form.machineNo.trim()) errors.machineNo = "Required";
    if (!form.planDate) errors.planDate = "Required";
    if (!form.expDate) errors.expDate = "Required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await saveInstrument();
    setForm({
      machineType: "Baking",
      plant: "PGA",
      name: "",
      machineNo: "",
      machine: machineTypes[0],
      calibrationMethod: "WI-S1.7.6.00-01-11",
      parameterSuhu: "",
      planDate: "",
      expDate: "",
      originalStandardTool: "",
      originalUncertainty: ""
    });
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setView("main");
    }, 1500);
  };

  /* ================= DERIVED ================= */
  const standardTool = STANDARD_TOOL[form.calibrationMethod];
  const uncertainty = UNCERTAINTY[form.machineType];

  const filtered = useMemo(() => {
    return instruments.filter(inst => {
      const matchSearch =
        !search ||
        inst.name.toLowerCase().includes(search.toLowerCase()) ||
        inst.machineNo.toLowerCase().includes(search.toLowerCase());
      const matchMachine = !filterMachine || inst.machineType === filterMachine;
      const matchPlant = !filterPlant || inst.plant === filterPlant;
      return matchSearch && matchMachine && matchPlant;
    });
  }, [instruments, search, filterMachine, filterPlant]);

  /* ─── Success overlay ─── */
  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <CheckCircle2 size={56} className="text-success" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontVariationSettings: "'GRAD' 50" }}>
          Data Berhasil Tersimpan
        </h2>
        <p className="text-sm text-muted-foreground">Your data has been saved successfully.</p>
      </div>
    );
  }

  /* ─── Add / Edit Instrument view ─── */
  if (view === "add") {
    return (
      <div className="space-y-6">
        <button onClick={() => setView("main")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold text-foreground">
          {editingId ? "Edit Instrument" : "Add Instrument"}
        </h1>

        <form onSubmit={handleAdd} className="max-w-md space-y-4">

          {/* Machine Type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Machine Type</label>
            <select
              value={form.machineType}
              onChange={e => setForm(f => ({ ...f, machineType: e.target.value as MachineType }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="Baking">Baking</option>
              <option value="Packaging">Packaging</option>
            </select>
          </div>

          {/* Plant */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Plant</label>
            <select
              value={form.plant}
              onChange={e => setForm(f => ({ ...f, plant: e.target.value as PlantType }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {PLANTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Nama Alat */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nama Alat</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
          </div>

          {/* No Mesin */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">No Mesin</label>
            <input
              value={form.machineNo}
              onChange={e => setForm(f => ({ ...f, machineNo: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {formErrors.machineNo && <p className="text-xs text-destructive">{formErrors.machineNo}</p>}
          </div>

          {/* Mesin */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Mesin</label>
            <input
              value={form.machine}
              onChange={e => setForm(f => ({ ...f, machine: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Metode Kalibrasi */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Metode Kalibrasi</label>
            <select
              value={form.calibrationMethod}
              onChange={e => setForm(f => ({ ...f, calibrationMethod: e.target.value as CalibrationMethod }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none"
            >
              <option value="WI-S1.7.6.00-01-11">WI-S1.7.6.00-01-11</option>
              <option value="WI-S1.7.6.00-01-25">WI-S1.7.6.00-01-25</option>
            </select>
          </div>

          {/* Alat Standard — auto */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Alat Standard</label>
            <div className="w-full rounded-lg border border-border bg-surface-1/40 px-3 py-2.5 text-sm font-mono text-muted-foreground cursor-not-allowed select-none">
              {standardTool}
            </div>
            <p className="text-xs text-muted-foreground">Otomatis berdasarkan metode kalibrasi</p>
          </div>

          {/* Ketidakpastian — auto */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Ketidakpastian Alat Ukur</label>
            <div className="w-full rounded-lg border border-border bg-surface-1/40 px-3 py-2.5 text-sm font-mono text-muted-foreground cursor-not-allowed select-none">
              {uncertainty}
            </div>
            <p className="text-xs text-muted-foreground">Otomatis berdasarkan machine type</p>
          </div>

          {/* Parameter Suhu */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Parameter Suhu</label>
            <input
              value={form.parameterSuhu}
              onChange={e => setForm(f => ({ ...f, parameterSuhu: e.target.value }))}
              placeholder="90-130"
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Format: 90-130</p>
          </div>

          {/* Tanggal Plan */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tanggal Plan</label>
            <input
              type="date"
              value={form.planDate}
              onChange={e => setForm(f => ({ ...f, planDate: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {formErrors.planDate && <p className="text-xs text-destructive">{formErrors.planDate}</p>}
          </div>

          {/* Tanggal Exp */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tanggal Exp</label>
            <input
              type="date"
              value={form.expDate}
              onChange={e => setForm(f => ({ ...f, expDate: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {formErrors.expDate && <p className="text-xs text-destructive">{formErrors.expDate}</p>}
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
          >
            {editingId ? "Update" : "Simpan"}
          </button>
        </form>
      </div>
    );
  }

  /* ─── Register Certificate Number view ─── */
  if (view === "registerCert") {
    return (
      <div className="space-y-6">
        <button onClick={() => setView("main")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold text-foreground" style={{ fontVariationSettings: "'GRAD' 50" }}>Register Certificate Number</h1>
        <p className="text-sm text-muted-foreground">Add new certificate numbers to the database pool for assignment to calibrated instruments.</p>

        <form onSubmit={(e) => { e.preventDefault(); registerCertificate(); }} className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Certificate Number</label>
            <input
              value={certNo}
              onChange={e => setCertNo(e.target.value)}
              placeholder="e.g. CERT-2026-004"
              className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {certError && <p className="text-xs text-destructive">{certError}</p>}
          </div>
          <button
            type="submit"
            className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
          >
            Register Certificate
          </button>
        </form>

        <div className="rounded-xl border border-border overflow-hidden max-w-md">
          <div className="bg-surface-1 px-4 py-3 border-b border-border">
            <h3 className="text-sm font-bold text-foreground">Certificate Pool ({certificates.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {certificates.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No certificates registered yet.</p>
            ) : (
              certificates.map((cert, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-mono text-foreground">{cert}</span>
                  <span className="text-xs text-muted-foreground">#{i + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ─── Main view ─── */
  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center transition-all hover:border-primary/40 hover:bg-surface-1">
          <span className="text-[11px] text-muted-foreground">Total Instruments</span>
          <p className="text-2xl font-bold font-mono text-foreground leading-tight">{instruments.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-center transition-all hover:border-primary/40 hover:bg-surface-1">
          <span className="text-[11px] text-muted-foreground">Certificates In Use</span>
          <p className="text-2xl font-bold font-mono text-foreground leading-tight truncate">{lastRegisteredCert}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            setEditingId(null);
            setForm({
              machineType: "Baking",
              plant: "PGA",
              name: "",
              machineNo: "",
              machine: machineTypes[0],
              calibrationMethod: "WI-S1.7.6.00-01-11",
              parameterSuhu: "",
              planDate: "",
              expDate: "",
              originalStandardTool: "",
              originalUncertainty: ""
            });
            setView("add");
          }}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
        >
          <Plus size={16} /> Add Instrument
        </button>
        <button
          onClick={() => setView("registerCert")}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-bold text-foreground hover:bg-surface-2 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]"
        >
          <FileText size={16} /> Register Certificate Number
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search instruments..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={filterMachine}
          onChange={e => setFilterMachine(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Machine Type</option>
          <option value="Baking">Baking</option>
          <option value="Packaging">Packaging</option>
        </select>
        <select
          value={filterPlant}
          onChange={e => setFilterPlant(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Plant</option>
          {PLANTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Status</option>
          <option value="Not Yet">Not Yet</option>
          <option value="Calibrated">Calibrated</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block rounded-xl border border-border overflow-hidden">

        {/* HEADER */}
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-surface-1">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[11px] text-center uppercase text-muted-foreground">No</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Nama Alat</th>
              {/* ✅ CHANGED: Machine Type → Parameter Suhu */}
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Param Suhu</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Plant</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Mesin</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">No Mesin</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Metode</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Standard</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Ket</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Exp</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Real</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground text-center">Option</th>
            </tr>
          </thead>
        </table>

        {/* BODY */}
        <div
          className="max-h-[400px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <tbody>
              {filtered.map(inst => (
                <tr key={inst.id} className="border-b border-border hover:bg-surface-1/50 align-top">
                  <td className="px-4 py-3 text-[11px] text-center font-mono">{inst.no}</td>
                  <td className="px-4 py-3 break-words whitespace-normal">{inst.name}</td>
                  {/* ✅ CHANGED: inst.machineType → inst.parameterSuhu */}
                  <td className="px-4 py-3 text-xs font-mono">{inst.parameterSuhu || "—"}</td>
                  <td className="px-4 py-3 text-xs">{inst.plant}</td>
                  <td className="px-4 py-3 text-xs break-words whitespace-normal">{inst.machine}</td>
                  <td className="px-4 py-3 text-xs font-mono break-words whitespace-normal">{inst.machineNo}</td>
                  <td className="px-4 py-3 text-xs font-mono break-words whitespace-normal">{inst.calibrationMethod}</td>
                  <td className="px-4 py-3 text-xs break-words whitespace-normal">{inst.standardTool}</td>
                  <td className="px-4 py-3 text-xs font-mono">{inst.uncertainty}</td>
                  <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">{inst.planDate}</td>
                  <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">{inst.expDate}</td>
                  <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">{inst.realizationDate || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={inst.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingId(inst.id);
                          setForm({
                            machineType: inst.machineType,
                            plant: inst.plant,
                            name: inst.name,
                            machineNo: inst.machineNo,
                            machine: inst.machine,
                            calibrationMethod: inst.calibrationMethod,
                            parameterSuhu: inst.parameterSuhu ?? "",
                            planDate: inst.planDate,
                            expDate: inst.expDate,
                            originalStandardTool: inst.standardTool ?? "",
                            originalUncertainty: inst.uncertainty ?? ""
                          });
                          setView("add");
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/25"
                      >
                        <Pencil size={12} />
                      </button>
                      
                      <button
                        onClick={() => handleDelete(inst.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive/15 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/25"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        <h3 className="text-sm font-bold text-foreground">Instrument Master List ({filtered.length})</h3>
        {filtered.map(inst => (
          <InstrumentCard
              key={inst.id}
              inst={inst}
              onDelete={handleDelete}
              onEdit={(inst) => {
                setEditingId(inst.id);
              
                setForm({
                  machineType: inst.machineType,
                  plant: inst.plant,
                  name: inst.name,
                  machineNo: inst.machineNo,
                  machine: inst.machine,
                  calibrationMethod: inst.calibrationMethod,
                  parameterSuhu: inst.parameterSuhu ?? "",
                  planDate: inst.planDate,
                  expDate: inst.expDate,
                  originalStandardTool: inst.standardTool ?? "",
                  originalUncertainty: inst.uncertainty ?? ""
                });
              
                setView("add");
              }}
            />
        ))}
      </div>
    </div>
  );
};

export default ManageAssets;