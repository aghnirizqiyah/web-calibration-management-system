from fastapi import FastAPI, HTTPException, Query, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,  field_validator
from typing import List, Optional
from database import get_connection, get_cursor
from datetime import date
from fastapi import Header, Depends, Body
import numpy as np
from enum import Enum
from sqlalchemy import text
import re
import math
import statistics
import pdfkit
from fastapi.responses import Response
import pdfkit
from fastapi.responses import Response

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "x-role"],  
)

class MachineType(str, Enum):
    baking = "Baking"
    packaging = "Packaging"

class Plant(str, Enum):
    PGA = "PGA"
    PSPD = "PSPD"
    PDP = "PDP"
    PGMJ = "PGMJ"

# ===============================
# 📌 SCHEMA INPUT
# ===============================
class TitikKalibrasi(BaseModel):
    suhu_standar: float
    readings: List[float]  

class KalibrasiInput(BaseModel):
    jadwal_id: int

    suhu1: float
    suhu2: float
    suhu3: float
    suhu4: float
    suhu5: float

    r1_1: float; r1_2: float; r1_3: float; r1_4: float; r1_5: float
    r2_1: float; r2_2: float; r2_3: float; r2_4: float; r2_5: float
    r3_1: float; r3_2: float; r3_3: float; r3_4: float; r3_5: float
    r4_1: float; r4_2: float; r4_3: float; r4_4: float; r4_5: float
    r5_1: float; r5_2: float; r5_3: float; r5_4: float; r5_5: float
    
    hasil_kalibrasi: str

class JadwalInput(BaseModel):
    nama_alat: str
    machine_type: MachineType   

    parameter_suhu: Optional[str] = None
    mesin: Optional[str] = None
    plant: Optional[str] = None
    no_mesin: Optional[str] = None

    metode_kalibrasi: Optional[str] = None
    alat_standar: Optional[str] = None
    ketidakpastian_alat_ukur: Optional[str] = None

    tanggal_plan: Optional[date] = None
    tanggal_exp: Optional[date] = None
    tanggal_realisasi: Optional[date] = None

    @field_validator("*", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

class Role(str, Enum):
    admin = "admin"
    user = "user"

class SertifikatInput(BaseModel):
    nomor_sertifikat: str

class TanggalRealisasiInput(BaseModel):
    id_jadwal: int
    tanggal_realisasi: date

# ===============================
# 🔐 ROLE SYSTEM
# ===============================
def get_current_role(x_role: Role = Header(...)):
    return x_role

def admin_only(role: str = Depends(get_current_role)):
    if role != "admin":
        raise HTTPException(403, "Hanya admin yang boleh akses")
    return role

def user_or_admin(role: str = Depends(get_current_role)):
    return role

# ===============================
# 📌 GET JADWAL
# ===============================
@app.get("/jadwal")
def get_jadwal(
    machine_type: Optional[MachineType] = None,
    plant: Optional[Plant] = None,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = None,
    status: Optional[str] = None,
    search: str = "",
    role: str = Depends(user_or_admin)
):
    conn, cur = get_cursor()
    try:
        query = """
            SELECT *,
                   CASE
                       WHEN tanggal_realisasi IS NOT NULL
                            THEN 'Calibrated'
            
                       WHEN tanggal_realisasi IS NULL
                            AND tanggal_plan < CURRENT_DATE
                            THEN 'Overdue'
            
                       ELSE 'Not Yet'
                   END AS status
            FROM jadwal_kalibrasi
            WHERE 1=1
            """
        params = []
        
        if machine_type:
            query += " AND machine_type = %s"
            params.append(machine_type.value)

        if plant:
            query += " AND plant = %s"
            params.append(plant.value)

        if month:
            query += " AND EXTRACT(MONTH FROM tanggal_plan) = %s"
            params.append(month)

        if year:
            query += " AND EXTRACT(YEAR FROM tanggal_plan) = %s"
            params.append(year)

        if status:
            query += """
                AND (
                    CASE
                        WHEN tanggal_realisasi IS NOT NULL
                            THEN 'Calibrated'
                        WHEN tanggal_realisasi IS NULL
                            AND tanggal_plan < CURRENT_DATE
                            THEN 'Overdue'
                        ELSE 'Not Yet'
                    END
                ) = %s
            """
            params.append(status)

        if search:
            query += " AND nama_alat ILIKE %s"
            params.append(f"%{search}%")

        cur.execute(query, params)
        return cur.fetchall()

    finally:
        cur.close()
        conn.close()

@app.post("/jadwal")
def tambah_alat(
    data: JadwalInput,
    role: str = Depends(admin_only)
):
    conn, cur = get_cursor()
    try:
        # 🔥 FORMAT SUHU
        formatted_suhu = None
        if data.parameter_suhu:
            try:
                min_temp, max_temp = data.parameter_suhu.split("-")
                formatted_suhu = f"{min_temp.strip()}°C - {max_temp.strip()}°C"
            except ValueError:
                return {"error": "Format suhu harus seperti 90-130"}

        query = """
            INSERT INTO jadwal_kalibrasi
            (nama_alat, machine_type, parameter_suhu,
             mesin, plant, no_mesin,
             metode_kalibrasi, alat_standar, ketidakpastian_alat_ukur,
             tanggal_plan, tanggal_exp, tanggal_realisasi)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id_jadwal
        """

        cur.execute(query, (
            data.nama_alat,
            data.machine_type.value,
            formatted_suhu,
            data.mesin,
            data.plant,
            data.no_mesin,
            data.metode_kalibrasi,
            data.alat_standar,
            data.ketidakpastian_alat_ukur,
            data.tanggal_plan,
            data.tanggal_exp,
            data.tanggal_realisasi,
        ))

        new_id = cur.fetchone()["id_jadwal"]
        conn.commit()

        return {"message": "Alat berhasil ditambahkan", "id_jadwal": new_id}

    finally:
        cur.close()
        conn.close()

@app.delete("/jadwal/{id_jadwal}")
def delete_jadwal(
    id_jadwal: int,
    role: str = Depends(user_or_admin)
):
    conn, cur = get_cursor()
    try:
        # cek apakah data ada
        cur.execute(
            "SELECT id_jadwal FROM jadwal_kalibrasi WHERE id_jadwal = %s",
            (id_jadwal,)
        )
        data = cur.fetchone()

        if not data:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")

        # delete data
        cur.execute(
            "DELETE FROM jadwal_kalibrasi WHERE id_jadwal = %s",
            (id_jadwal,)
        )

        conn.commit()

        return {"message": "Data berhasil dihapus"}

    finally:
        cur.close()
        conn.close()

@app.put("/jadwal/{id_jadwal}")
def update_jadwal(
    id_jadwal: int,
    data: JadwalInput,
    role: str = Depends(admin_only)
):
    conn, cur = get_cursor()

    try:
        # cek data ada atau tidak
        cur.execute("""
            SELECT id_jadwal
            FROM jadwal_kalibrasi
            WHERE id_jadwal = %s
        """, (id_jadwal,))

        existing = cur.fetchone()

        if not existing:
            raise HTTPException(404, "Data tidak ditemukan")

        # format suhu
        formatted_suhu = None

        if data.parameter_suhu:
            try:
                min_temp, max_temp = data.parameter_suhu.split("-")
                formatted_suhu = f"{min_temp.strip()}°C - {max_temp.strip()}°C"
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Format suhu harus seperti 90-130"
                )

        # update
        cur.execute("""
            UPDATE jadwal_kalibrasi
            SET
                nama_alat = %s,
                machine_type = %s,
                parameter_suhu = %s,
                mesin = %s,
                plant = %s,
                no_mesin = %s,
                metode_kalibrasi = %s,
                alat_standar = %s,
                ketidakpastian_alat_ukur = %s,
                tanggal_plan = %s,
                tanggal_exp = %s
            WHERE id_jadwal = %s
        """, (
            data.nama_alat,
            data.machine_type.value,
            formatted_suhu,
            data.mesin,
            data.plant,
            data.no_mesin,
            data.metode_kalibrasi,
            data.alat_standar,
            data.ketidakpastian_alat_ukur,
            data.tanggal_plan,
            data.tanggal_exp,
            id_jadwal
        ))

        conn.commit()

        return {"message": "Data berhasil diupdate"}

    finally:
        cur.close()
        conn.close()

# ===============================
# 📌 POST KALIBRASI
# ===============================
@app.get("/jadwal/{id_jadwal}/titik")
def generate_titik_suhu(id_jadwal: int):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT parameter_suhu, machine_type
            FROM jadwal_kalibrasi
            WHERE id_jadwal = %s
        """, (id_jadwal,))

        result = cur.fetchone()

        if not result or not result["parameter_suhu"]:
            raise HTTPException(404, "Parameter suhu tidak ditemukan")

        param = result["parameter_suhu"]

        numbers = re.findall(r"\d+\.?\d*", param)
        if len(numbers) != 2:
            raise HTTPException(400, "Format parameter_suhu tidak valid")

        start, end = map(int, numbers)
        step = (end - start) / 4
        titik = [int(round(start + i * step)) for i in range(5)]

        return {
            "id_jadwal": id_jadwal,
            "machine_type": result["machine_type"],  # 🔥 ganti ini
            "parameter_suhu": param,
            "titik_pengujian": titik
        }

    finally:
        cur.close()
        conn.close()

# ===============================
# Endpoint post kalibrasi
# ===============================
@app.post("/kalibrasi")
def post_kalibrasi(
    data: KalibrasiInput,
    role: str = Depends(user_or_admin)
):
    conn, cur = get_cursor()
    try:
        cur.execute("""
                    SELECT machine_type, parameter_suhu
                    FROM jadwal_kalibrasi
                    WHERE id_jadwal = %s
                    """, (data.jadwal_id,))
        
        jadwal = cur.fetchone()
        if not jadwal:
            raise HTTPException(404, "Jadwal tidak ditemukan")
        
        jenis = jadwal["machine_type"]
        param = jadwal["parameter_suhu"]

        # 🔥 ambil hasil kalibrasi dari frontend
        hasil_kalibrasi = data.hasil_kalibrasi
        
        suhu_list = [data.suhu1, data.suhu2, data.suhu3, data.suhu4, data.suhu5]
        
        # ambil range dari parameter_suhu
        numbers = re.findall(r"\d+\.?\d*", param)
        start, end = map(int, numbers)
        
        # generate titik valid
        step = (end - start) / 4
        titik_valid = [int(round(start + i * step)) for i in range(5)]
        
        #VALIDASI
        for s in suhu_list:
            if s not in titik_valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Suhu harus sesuai titik: {titik_valid}")
        # Matrix pembacaan
        readings_matrix = [[getattr(data, f"r{i}_{j}") for j in range(1, 6)] for i in range(1, 6)]

        hasil = []

        for i in range(5):
            readings = [round(x, 2) for x in readings_matrix[i]]
            suhu_standar = int(suhu_list[i])

            rata_rata = sum(readings) / 5
            stdev = statistics.stdev(readings)
            ur = stdev / math.sqrt(5)
            us = (3 / 1000) / 2
            ures = 0.5 / (2 * math.sqrt(6))
            u_ksrgm = (max(readings) - min(readings)) / math.sqrt(3)
            correction = suhu_standar - rata_rata
            uc = math.sqrt(ur**2 + us**2 + ures**2 + u_ksrgm**2)
            U = uc * 2

            # Rounding
            rata_rata_r = round(rata_rata, 2)
            correction_r = round(correction, 2)
            stdev_r = round(stdev, 6)
            ur_r = round(ur, 6)
            us_r = round(us, 4)
            ures_r = round(ures, 6)
            u_ksrgm_r = round(u_ksrgm, 6)
            uc_r = round(uc, 7)
            U_r = round(U, 3)

            hasil.append({
                "detail_perhitungan": {
                    "r1": readings[0],
                    "r2": readings[1],
                    "r3": readings[2],
                    "r4": readings[3],
                    "r5": readings[4],
                    "rata_rata": rata_rata_r,
                    "stdev": stdev_r,
                    "ur": ur_r,
                    "us": us_r,
                    "ures": ures_r,
                    "u_ksrgm": u_ksrgm_r,
                    "uc": uc_r,
                    "U (k=2)": U_r
                },
                "standard_reading": suhu_standar,
                "instrument_reading": rata_rata_r,
                "correction": correction_r,
                "uncertainty": U_r
            })

            # Insert ke detail
            cur.execute("""
                INSERT INTO hasil_kalibrasi_detail
                (
                    id_jadwal,
                    jenis,
                    suhu_standar,
                    r1, r2, r3, r4, r5,
                    rata_rata,
                    correction,
                    stdev,
                    ur,
                    us,
                    ures,
                    u_ksrgm,
                    uc,
                    u
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                data.jadwal_id,
                jenis,
                suhu_standar,
                readings[0],
                readings[1],
                readings[2],
                readings[3],
                readings[4],
                rata_rata_r,
                correction_r,
                stdev_r,
                ur_r,
                us_r,
                ures_r,
                u_ksrgm_r,
                uc_r,
                U_r
            ))

        # 🔥 SIMPAN HASIL AKHIR (OK / NOT OK)
        cur.execute("""
            UPDATE jadwal_kalibrasi
            SET hasil_kalibrasi = %s
            WHERE id_jadwal = %s
        """, (hasil_kalibrasi, data.jadwal_id))

        conn.commit()

        return {
            "message": "Data kalibrasi berhasil disimpan",
            "jenis": jenis,
            "total_titik": 5,
            "hasil_kalibrasi": hasil_kalibrasi,  
            "hasil_per_titik": hasil
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        cur.close()
        conn.close()

@app.post("/jadwal/realisasi")
def input_tanggal_realisasi(
    data: TanggalRealisasiInput,
    role: str = Depends(user_or_admin)
):
    conn, cur = get_cursor()
    try:
        # cek jadwal
        cur.execute("""
            SELECT id_jadwal
            FROM jadwal_kalibrasi
            WHERE id_jadwal = %s
        """, (data.id_jadwal,))
        jadwal = cur.fetchone()
        if not jadwal:
            raise HTTPException(404, "Jadwal tidak ditemukan")
        
        # update tanggal_realisasi saja
        cur.execute("""
            UPDATE jadwal_kalibrasi
            SET tanggal_realisasi = %s
            WHERE id_jadwal = %s
        """, (data.tanggal_realisasi, data.id_jadwal))

        conn.commit()
        return {"message": "Tanggal realisasi berhasil diinput"}

    finally:
        cur.close()
        conn.close()

# ===============================
# 📊 DASHBOARD SUMMARY
# ===============================
@app.get("/dashboard/summary")
def dashboard_summary(
    machine_type: Optional[MachineType] = None,
    plant: Optional[Plant] = None,
    month: Optional[int] = Query(None, ge=1, le=12),
    year: Optional[int] = None,
    status: Optional[str] = None,
    role: str = Depends(user_or_admin)
):
    
    conn, cur = get_cursor()

    filter_query = "WHERE 1=1"
    params = []

    if machine_type:
        filter_query += " AND machine_type = %s"
        params.append(machine_type.value)

    if plant:
        filter_query += " AND plant = %s"
        params.append(plant.value)

    if month:
        filter_query += " AND EXTRACT(MONTH FROM tanggal_plan) = %s"
        params.append(month)

    if year:
        filter_query += " AND EXTRACT(YEAR FROM tanggal_plan) = %s"
        params.append(year)

    if status == "Calibrated":
        filter_query += " AND tanggal_realisasi IS NOT NULL"
    
    elif status == "Not Yet":
        filter_query += """
            AND tanggal_realisasi IS NULL
            AND tanggal_plan >= CURRENT_DATE
        """
    
    elif status == "Overdue":
        filter_query += """
            AND tanggal_realisasi IS NULL
            AND tanggal_plan < CURRENT_DATE
        """

    try:
        # 🔹 TOTAL ALAT
        cur.execute(f"""
            SELECT COUNT(*) 
            FROM jadwal_kalibrasi
            {filter_query}
        """, params)
        total = cur.fetchone()["count"]

        # 🔹 SUDAH KALIBRASI
        cur.execute(f"""
            SELECT COUNT(*) 
            FROM jadwal_kalibrasi 
            {filter_query}
            AND tanggal_realisasi IS NOT NULL
        """, params)
        calibrated = cur.fetchone()["count"]

        # 🔹 BELUM KALIBRASI
        cur.execute(f"""
            SELECT COUNT(*)
            FROM jadwal_kalibrasi
            {filter_query}
            AND tanggal_realisasi IS NULL
            AND tanggal_plan >= CURRENT_DATE
        """, params)
        
        not_yet = cur.fetchone()["count"]

        # 🔹 TERLAMBAT (OVERDUE)
        cur.execute(f"""
            SELECT COUNT(*)
            FROM jadwal_kalibrasi
            {filter_query}
            AND tanggal_realisasi IS NULL
            AND tanggal_plan < CURRENT_DATE
        """, params)

        overdue = cur.fetchone()["count"]

        return {
            "total_instruments": total,
            "calibrated": calibrated,
            "not_yet": not_yet,
            "overdue": overdue
        }

    finally:
        cur.close()
        conn.close()

# ===============================
# 🧾 UPDATE CERTIFICATE
# ===============================
@app.post("/sertifikat")
def tambah_sertifikat(
    data: SertifikatInput,
    role: str = Depends(admin_only)
):
    conn, cur = get_cursor()
    try:
        cur.execute("""
            INSERT INTO nomor_sertifikat (nomor_sertifikat)
            VALUES (%s)
        """, (data.nomor_sertifikat,))

        conn.commit()

        return {"message": "Nomor sertifikat berhasil ditambahkan"}

    finally:
        cur.close()
        conn.close()

@app.get("/sertifikat")
def get_sertifikat():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT nomor_sertifikat
            FROM nomor_sertifikat
            ORDER BY created_at DESC
            LIMIT 1
        """)

        result = cur.fetchone()

        if not result:
            return {"nomor_sertifikat": None}

        # akses dengan key, bukan index
        return {"nomor_sertifikat": result["nomor_sertifikat"]}

    finally:
        cur.close()
        conn.close()

@app.get("/sertifikat/all")
def get_all_sertifikat():
    conn, cur = get_cursor()
    try:
        cur.execute("""
            SELECT nomor_sertifikat
            FROM nomor_sertifikat
            ORDER BY created_at DESC
        """)

        results = cur.fetchall()

        return [{"nomor_sertifikat": r["nomor_sertifikat"]} for r in results]

    finally:
        cur.close()
        conn.close()

@app.get("/certificate/{id_jadwal}")
def download_certificate(
    id_jadwal: int,
    role: str = Depends(user_or_admin)
):
    conn, cur = get_cursor()
    try:
        # =========================
        # 🔹 1. HEADER
        # =========================
        cur.execute("""
            SELECT 
                j.nama_alat,
                j.parameter_suhu,
                j.mesin,
                j.plant,
                j.no_mesin,
                j.metode_kalibrasi,
                j.alat_standar,
                j.tanggal_realisasi,
                j.hasil_kalibrasi,
                j.ketidakpastian_alat_ukur,
                j.mesin,
                s.nomor_sertifikat
            FROM jadwal_kalibrasi j
            LEFT JOIN nomor_sertifikat s ON TRUE
            WHERE j.id_jadwal = %s
            ORDER BY s.created_at DESC
            LIMIT 1
        """, (id_jadwal,))
        header = cur.fetchone()

        if not header:
            raise HTTPException(404, "Data tidak ditemukan")

        # =========================
        # 🔹 2. DETAIL
        # =========================
        cur.execute("""
            SELECT *
            FROM hasil_kalibrasi_detail
            WHERE id_jadwal = %s
            ORDER BY suhu_standar
        """, (id_jadwal,))
        details = cur.fetchall()

        # =========================
        # 🔹 3. LOAD HTML
        # =========================
        with open("TemplateLaporan.html", "r", encoding="utf-8") as f:
            html = f.read()

        def safe(val):
            return str(val) if val else "-"

        # =========================
        # 🔹 4. REPLACE HEADER
        # =========================
        html = html.replace("{{nama_alat}}", safe(header["nama_alat"]))
        html = html.replace("{{identitas}}", safe(header["no_mesin"]))
        html = html.replace("{{range_pengukuran}}", safe(header["parameter_suhu"]))
        html = html.replace("{{metode_kalibrasi}}", safe(header["metode_kalibrasi"]))
        html = html.replace("{{tanggal_realisasi}}", safe(header["tanggal_realisasi"]))
        html = html.replace("{{nomor_sertifikat}}", safe(header["nomor_sertifikat"]))
        html = html.replace("{{plant}}", safe(header["plant"]))
        html = html.replace("{{alat_standar}}", safe(header["alat_standar"]))
        html = html.replace("{{mesin}}", safe(header["mesin"]))
        html = html.replace("{{ketidakpastian_alat_ukur}}", safe(header["ketidakpastian_alat_ukur"]))
        html = html.replace("{{hasil_kalibrasi}}", safe(header["hasil_kalibrasi"]))

        # =========================
        # 🔹 5. GENERATE TABLE
        # =========================
        detail_rows = ""
        summary_rows = ""

        max_u = float("-inf")
        min_u = float("inf")

        for d in details:
            detail_rows += f"""
            <tr>
                <td>{d['suhu_standar']}</td>
                <td>{d['r1']}</td>
                <td>{d['r2']}</td>
                <td>{d['r3']}</td>
                <td>{d['r4']}</td>
                <td>{d['r5']}</td>
                <td>{d['rata_rata']}</td>
                <td>{d['correction']}</td>
                <td>{d['stdev']}</td>
                <td>{d['ur']}</td>
                <td>{d['us']}</td>
                <td>{d['ures']}</td>
                <td>{d['u_ksrgm']}</td>
                <td>{d['uc']}</td>
                <td>{d['u']}</td>
                <td>°C</td>
            </tr>
            """

            summary_rows += f"""
            <tr>
                <td>{d['suhu_standar']}</td>
                <td>{d['rata_rata']}</td>
                <td>{d['correction']}</td>
                <td>{d['u']}</td>
            </tr>
            """

            if d["u"] > max_u:
                max_u = d["u"]
            if d["u"] < min_u:
                min_u = d["u"]

        # tambahan row
        detail_rows += f"""
        <tr>
            <td colspan="12" style="text-align:right">Nilai besar - nilai terkecil</td>
            <td>{round(max_u - min_u, 3)}</td>
            <td colspan="3"></td>
        </tr>
        """

        # =========================
        # 🔹 6. INJECT HTML (FIX)
        # =========================
        html = re.sub(
            r'<tbody id="detail-rows">.*?</tbody>',
            f'<tbody id="detail-rows">{detail_rows}</tbody>',
            html,
            flags=re.DOTALL
        )

        html = re.sub(
            r'<tbody id="summary-rows">.*?</tbody>',
            f'<tbody id="summary-rows">{summary_rows}</tbody>',
            html,
            flags=re.DOTALL
        )

        # =========================
        # 🔹 7. PDFKIT CONFIG
        # =========================
        config = pdfkit.configuration(
            wkhtmltopdf=r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
        )

        options = {
            "enable-local-file-access": None
        }

        pdf = pdfkit.from_string(
            html,
            False,
            configuration=config,
            options=options
        )

        # =========================
        # 🔹 8. RETURN
        # =========================
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=certificate-{id_jadwal}.pdf"
            }
        )

    except Exception as e:
        raise HTTPException(500, str(e))

    finally:
        cur.close()
        conn.close()