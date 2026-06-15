import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import CalibrationModal, { Instrument } from "@/components/CalibrationModal";
import StatusBadge from "@/components/StatusBadge";
import { Download, Pencil, ChevronDown, ChevronUp, Search, Gauge, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const machineTypes = ["Baking", "Packaging"];
const plantsList = ["PGA", "PSPD", "PDP", "PGMJ"];

const summaryCards = [
  { key: "total" as const, label: "Total Instruments", icon: Gauge, colorClass: "text-primary" },
  { key: "notYet" as const, label: "Not Yet", icon: Clock, colorClass: "text-warning" },
  { key: "calibrated" as const, label: "Calibrated", icon: CheckCircle2, colorClass: "text-success" },
  { key: "overdue" as const, label: "Overdue", icon: AlertTriangle, colorClass: "text-overdue" },
];

const Dashboard: React.FC = () => {
  const [instruments, setInstruments] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    notYet: 0,
    calibrated: 0,
    overdue: 0,
  });

  const { role } = useAuth();
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [expandedId, setExpandedId] = useState<Number | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Debounce search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  // Ambil summary statistik dashboard
  useEffect(() => {
    if (!role) return; 
    api.get("/dashboard/summary", {
      params: {
        machine_type: filterMachine || undefined,
        plant: filterPlant || undefined,
        month: filterMonth || undefined,
        year: filterYear || undefined
      }
    })
    .then(res => {
      setSummary({
        total: res.data.total_instruments,
        calibrated: res.data.calibrated,
        notYet: res.data.not_yet,
        overdue: res.data.overdue,
      });
    })
    .catch(err => console.error(err));
  
  }, [role, filterMachine, filterPlant, filterMonth, filterYear]);

  // Ambil data jadwal dari backend
  const fetchJadwal = () => {
      if (!role) return;
      api.get("/jadwal", {
        params: {
          machine_type: filterMachine || undefined,
          plant: filterPlant || undefined,
          month: filterMonth || undefined,
          year: filterYear || undefined,
          status: filterStatus || undefined,
          search: debouncedSearch || undefined
        }
      })
      .then(res => {
        const mapped = res.data.map((item: any) => {
          return {
            id: item.id_jadwal,
            no: item.id_jadwal,
            name: item.nama_alat,
            tempParameter: item.parameter_suhu,
            machine: item.machine_type,
            plant: item.plant,
            machineNo: item.no_mesin,
            planDate: item.tanggal_plan?.slice(0, 10),
            expDate: item.tanggal_exp?.slice(0, 10),
            realizationDate:
              item.tanggal_realisasi?.slice(0, 10) || item.tanggal_realisasi,
            createdAt: item.created_at,
          
            // gunakan status dari backend
            status: item.status,
          
            uncertainty: item.ketidakpastian_alat_ukur,
          };
        })
          .sort((a, b) => a.no - b.no);
        
        setInstruments(mapped);
      })
      .catch(err => console.error(err));
    };

  useEffect(() => {
    fetchJadwal();
  }, [role, filterMachine, filterPlant, filterMonth, filterYear, filterStatus, debouncedSearch]);

  const handleDownload = async (inst: Instrument) => {
    try {
      const response = await api.get(`/certificate/${inst.id}`, {
        responseType: "blob", 
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `certificate-${inst.id}.pdf`);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Download berhasil");
    } catch (err) {
      console.error(err);
      toast.error("Gagal download sertifikat");
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground text-center" style={{ fontVariationSettings: "'GRAD' 50" }}>
          Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(card => (
            <div
              key={card.key}
              className="rounded-xl border border-border bg-card px-4 py-3 text-center"
            >
              <span className="text-[11px] text-muted-foreground">
                {card.label}
              </span>
              <p className="text-2xl font-bold font-mono text-foreground leading-tight">
                {summary[card.key]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
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

        <select value={filterMachine} onChange={e => setFilterMachine(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
          <option value="">Machine Type</option>
          {machineTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterYear}
          onChange={e => setFilterYear(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Year</option>
          <option value="2026">2026</option>
          <option value="2027">2027</option>
          <option value="2028">2028</option>
          <option value="2029">2029</option>
        </select>        

        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Month</option>
          <option value="1">January</option>
          <option value="2">February</option>
          <option value="3">March</option>
          <option value="4">April</option>
          <option value="5">May</option>
          <option value="6">June</option>
          <option value="7">July</option>
          <option value="8">August</option>
          <option value="9">September</option>
          <option value="10">October</option>
          <option value="11">November</option>
          <option value="12">December</option>
        </select>

        <select value={filterPlant} onChange={e => setFilterPlant(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none">
          <option value="">Plant</option>
          {plantsList.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        >
          <option value="">Status</option>
          <option value="Calibrated">Calibrated</option>
          <option value="Not Yet">Not Yet</option>
          <option value="Overdue">Overdue</option>
        </select>
      </div>

      {/* Table Title */}
      <h3 className="text-sm font-bold text-foreground" style={{ fontVariationSettings: "'GRAD' 50" }}>
        Calibration Schedule
      </h3>

      {/* Desktop Version */}
      <div className="hidden lg:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>

          <thead className="bg-surface-1">
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[11px] text-center uppercase text-muted-foreground">No</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Nama Alat</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Parameter</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Machine</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Plant</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Machine No</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Exp</th>
              <th className="px-4 py-3 text-[11px] text-center uppercase text-muted-foreground">Real</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-[11px] uppercase text-muted-foreground">Option</th>
            </tr>
          </thead>
        </table>

        <div
          className="max-h-[400px] overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>

            <tbody>
              {instruments.map(inst => (
                <tr key={inst.id} className="border-b border-border hover:bg-surface-1/50 align-top">
                  <td className="px-4 py-3 text-[11px] text-center font-mono">{inst.no}</td>
                  <td className="px-4 py-3 break-words whitespace-normal">{inst.name}</td>
                  <td className="px-4 py-3 break-words whitespace-normal">{inst.tempParameter}</td>
                  <td className="px-4 py-3">{inst.machine}</td>
                  <td className="px-4 py-3">{inst.plant}</td>
                  <td className="px-4 py-3 break-words whitespace-normal">{inst.machineNo}</td>
                  <td className="px-4 py-3 text-xs">{inst.planDate}</td>
                  <td className="px-4 py-3 text-xs">{inst.expDate}</td>
                  <td className="px-4 py-3 text-xs text-center whitespace-nowrap">
                    {inst.realizationDate || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={inst.status} />
                      {/* Penyesuaian pengecekan dari "Finish" ke "Calibrated" */}
                      {inst.status === "Calibrated" && inst.createdAt && (() => {
                        const dateObj = new Date(inst.createdAt);

                        const date = dateObj.toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                      
                        const time = dateObj.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                      
                        return (
                          <span className="text-[10px] text-muted-foreground leading-tight flex flex-col items-center text-center">
                            <span>{date}</span>
                            <span>{time}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2 flex-wrap">
                      {/* Penyesuaian tombol aksi berdasarkan status real */}
                      {inst.status !== "Calibrated" ? (
                        <button
                          onClick={() => setSelectedInstrument(inst)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                        >
                          <Pencil size={12}/> Input
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(inst)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
                        >
                          <Download size={12}/> Download
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Version */}
      <div className="lg:hidden space-y-2 -mt-6 border border-border rounded-b-xl overflow-hidden">
        {instruments.map(inst => {
          const isExpanded = expandedId === inst.id;
          return (
            <div key={inst.id} className="border-b border-border last:border-0">
              <button onClick={() => setExpandedId(isExpanded ? null : inst.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-surface-1/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground w-6 shrink-0">{inst.no}</span>
                  <span className="text-sm font-medium text-foreground truncate">{inst.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>
              
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-2 text-sm">
                  <div>
                    <strong>Parameter:</strong> {inst.tempParameter}
                  </div>
                            
                  <div>
                    <strong>Machine:</strong> {inst.machine}
                  </div>
                            
                  <div>
                    <strong>Plant:</strong> {inst.plant}
                  </div>
                            
                  <div>
                    <strong>Machine No:</strong> {inst.machineNo}
                  </div>
                            
                  <div>
                    <strong>Plan:</strong> {inst.planDate}
                  </div>
                            
                  <div>
                    <strong>Exp:</strong> {inst.expDate}
                  </div>
                            
                  <div>
                    <strong>Real:</strong> {inst.realizationDate || "-"}
                  </div>
                            
                  <StatusBadge status={inst.status} />
                            
                  <div className="pt-2">
                    {inst.status !== "Calibrated" ? (
                      <button
                        onClick={() => setSelectedInstrument(inst)}
                        className="w-full rounded-lg border border-border px-3 py-2"
                      >
                        Input
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDownload(inst)}
                        className="w-full rounded-lg border border-border px-3 py-2"
                      >
                        Download
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Modal Render */}
      {selectedInstrument && (
        <CalibrationModal 
          instrument={selectedInstrument} 
          onClose={() => setSelectedInstrument(null)} 
          onSuccess={() => {
            setSelectedInstrument(null);
            fetchJadwal();
          }}
        />
      )}
    </div>
  );
};

export default Dashboard;