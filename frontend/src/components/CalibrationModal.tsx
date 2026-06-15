import React, { useState, useCallback, useMemo, useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";
import api from "@/lib/api";

export interface Instrument {
  id: string;
  name: string;
  identityNo: string;
  tempParameter: string;
  uncertainty?: string;
  status: "Calibrated" | "Not Yet" | "Overdue";
}

interface CalibrationModalProps {
  instrument: Instrument;
  onClose: () => void;
  onSuccess?: () => void;
}

const THERMO_COUNT = 5;

const CalibrationModal: React.FC<CalibrationModalProps> = ({ instrument, onClose, onSuccess }) => {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [realizationDate, setRealizationDate] = useState(new Date().toISOString().split("T")[0]);
  const [result, setResult] = useState("Performa Baik (OK) Layak Pakai");

  const [standardTemps, setStandardTemps] = useState<number[]>([0, 25, 50, 75, 100]);

  const [readings, setReadings] = useState<string[][]>(
    () => Array.from({ length: THERMO_COUNT }, () => Array(5).fill(""))
  );

  // AMBIL TITIK SUHU DARI BACKEND
  useEffect(() => {
    api.get(`/jadwal/${instrument.id}/titik`)
      .then(res => {
        setStandardTemps(res.data.titik_pengujian);
      })
      .catch(err => console.error(err));
  }, [instrument.id]);

  const minRange = standardTemps[0];
  const maxRange = standardTemps[standardTemps.length - 1];

  const updateReading = useCallback(
    (thermoIdx: number, tempIdx: number, value: string) => {
      setReadings(prev => {
        const next = prev.map(row => [...row]);
        next[thermoIdx][tempIdx] = value;
        return next;
      });

      const num = parseFloat(value);

      if (value === "") {
        setError(null);
        return;
      }

      if (!isNaN(num)) {
        if (num < minRange || num > maxRange) {
          setError(
            `Nilai ${num} di luar range (${minRange}°C - ${maxRange}°C)`
          );
        } else {
          setError(null);
        }
      }
    },
    [minRange, maxRange]
  );

  // Perhitungan tampilan Rata-rata & Koreksi
  const { averages, corrections } = useMemo(() => {
    const avgs = standardTemps.map((_, ti) => {
      const vals = readings.map(row => parseFloat(row[ti])).filter(v => !isNaN(v));
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const corrs = avgs.map((avg, i) => (avg !== null ? standardTemps[i] - avg : null));
    return { averages: avgs, corrections: corrs };
  }, [readings, standardTemps]);
  
  const handleSave = async () => {
    if (error) {
      alert("Masih ada nilai di luar range!");
      return;
    }

    const hasEmpty = readings.some(row =>
      row.some(val => val === "")
    );

    if (hasEmpty) {
      alert("Semua nilai harus diisi!");
      return;
    }

    try {
      // SIMPAN TANGGAL REALISASI
      await api.post("/jadwal/realisasi", {
        id_jadwal: instrument.id,
        tanggal_realisasi: realizationDate
      });

      // FORMAT DATA KE BACKEND
      const payload: any = {
        jadwal_id: instrument.id,
        suhu1: standardTemps[0],
        suhu2: standardTemps[1],
        suhu3: standardTemps[2],
        suhu4: standardTemps[3],
        suhu5: standardTemps[4],
        hasil_kalibrasi: result
      };

      // flatten readings jadi r1_1 dst
      standardTemps.forEach((_, ti) => {
        readings.forEach((row, thi) => {
          payload[`r${ti + 1}_${thi + 1}`] = parseFloat(row[ti]) || 0;
        });
      });

      // POST KALIBRASI
      await api.post("/kalibrasi", payload);

      if ((instrument as any).onSuccess) {
        (instrument as any).onSuccess();
      }

      if (onSuccess) onSuccess();
      setSaved(true);

    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan data");
    }
  };

  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-background/80" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <CheckCircle2 size={48} className="mx-auto text-success" />
          <h2 className="text-xl font-bold text-foreground" style={{ fontVariationSettings: "'GRAD' 50" }}>
            Data Berhasil Tersimpan
          </h2>
          <p className="text-sm text-muted-foreground">
            Calibration data for {instrument.name} has been saved successfully.
          </p>
          <button onClick={onClose}
            className="rounded-full bg-primary px-8 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 pt-8">
      <div className="absolute inset-0 bg-background/80" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-border bg-card mb-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-card rounded-t-2xl">
          <h2 className="text-base font-bold text-foreground" style={{ fontVariationSettings: "'GRAD' 50" }}>
            Input Hasil Kalibrasi
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-1 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Instrument info */}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-40 shrink-0">Nama Alat</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-foreground font-medium">{instrument.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-40 shrink-0">No. Identitas</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-foreground font-mono">{instrument.identityNo}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-40 shrink-0">Range Penggunaan Alat</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-foreground font-mono">{instrument.tempParameter}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-muted-foreground w-40 shrink-0">Tanggal Realisasi</span>
              <span className="text-muted-foreground">:</span>
              <input type="date" value={realizationDate} onChange={e => setRealizationDate(e.target.value)}
                className="rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm font-medium px-1">
              {error}
            </div>
          )}

          {/* Readings table */}
          <div className="overflow-auto -mx-5 px-5">
            <table className="w-full text-sm border-collapse border border-border">
              <thead>
                <tr className="bg-surface-1">
                  <th rowSpan={2} className="border border-border px-2 py-2 text-xs font-semibold text-muted-foreground">Penunjukkan Suhu<br />Standar</th>
                  <th colSpan={5} className="border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center">Penunjukkan Termometer (UUT)</th>
                  <th rowSpan={2} className="border border-border px-2 py-2 text-xs font-semibold text-muted-foreground text-center">X̄<br />(Rata-rata)</th>
                  <th rowSpan={2} className="border border-border px-2 py-2 text-xs font-semibold text-muted-foreground text-center">Correction</th>
                </tr>
                <tr className="bg-surface-1">
                  {Array.from({ length: THERMO_COUNT }, (_, i) => (
                    <th key={i} className="border border-border px-2 py-1.5 text-xs font-semibold text-muted-foreground text-center">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {standardTemps.map((temp, ti) => (
                  <tr key={ti}>
                    <td className="border border-border px-2 py-2 font-mono font-semibold text-foreground text-center bg-surface-1/50">{temp}</td>
                    {Array.from({ length: THERMO_COUNT }, (_, thi) => (
                      <td key={thi} className="border border-border p-1">
                        <input type="number" step="0.01" value={readings[thi][ti]}
                          onChange={e => updateReading(thi, ti, e.target.value)}
                          className="w-full min-w-[64px] rounded border border-border bg-surface-1 px-1.5 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                          placeholder="—" />
                      </td>
                    ))}
                    <td className="border border-border px-2 py-2 font-mono text-foreground text-center text-xs">
                      {averages[ti] !== null ? averages[ti]!.toFixed(2) : "—"}
                    </td>
                    <td className="border border-border px-2 py-2 font-mono text-foreground text-center text-xs">
                      {corrections[ti] !== null ? corrections[ti]!.toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Uncertainty & Result */}
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-56 shrink-0">Ketidakpastian Sertifikat Alat Ukur</span>
              <span className="text-muted-foreground">:</span>
              <span className="text-foreground font-mono">
                {instrument.uncertainty || "—"}
              </span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-muted-foreground w-56 shrink-0">Hasil Kalibrasi</span>
              <span className="text-muted-foreground">:</span>
              <select value={result} onChange={e => setResult(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none">
                <option value="Performa Baik (OK) Layak Pakai">Performa Baik (OK) Layak Pakai</option>
                <option value="Performa Buruk (NOT OK) Tidak Layak">Performa Buruk (NOT OK) Tidak Layak</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-center border-t border-border px-5 py-4">
          <button
            onClick={handleSave}
            disabled={!!error}
            className={`
              rounded-full px-8 py-2.5 text-sm font-bold text-primary-foreground
              ${error
                ? "bg-gray-500 cursor-not-allowed opacity-60"
                : "bg-primary hover:bg-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]"
              }
            `}
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalibrationModal;