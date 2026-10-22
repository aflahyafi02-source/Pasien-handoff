import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Activity, 
  Plus, 
  Search, 
  UserCheck, 
  Archive, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  RotateCcw, 
  Copy, 
  Check, 
  BedDouble, 
  Stethoscope, 
  FileText, 
  Clock, 
  Filter, 
  X, 
  Sparkles, 
  Wifi, 
  WifiOff,
  Keyboard,
  AlertCircle,
  Hash,
  Users
} from 'lucide-react';

// ==========================================
// 1. INISIALISASI FIREBASE (MANDATORY PATTERN)
// ==========================================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ward-handoff-tracker-app';

// Data Contoh (Sample Data) untuk pengetesan awal
const SAMPLE_PATIENTS = [
  {
    nama: 'Tn. Budi Santoso',
    noRm: '00-48-29-11',
    kamar: 'Melati 1 - Bed A',
    dpjp: 'dr. Hendra Wijaya, Sp.PD',
    diagnosis: 'Dengue Hemorrhagic Fever (DHF) Grade II + Trombositopenia (Trombosit terakhir: 42.000) + Observasi febris H-4',
    status: 'Aktif Rawat'
  },
  {
    nama: 'Ny. Siti Aminah',
    noRm: '00-91-04-55',
    kamar: 'Melati 2 - Bed C',
    dpjp: 'dr. Rina Kartika, Sp.JP',
    diagnosis: 'Congestive Heart Failure (CHF) NYHA Fc III + Edema Paru Akut (Perbaikan) + Hipertensi Stage II. Balance cairan target negatif -500cc/24 jam.',
    status: 'Aktif Rawat'
  },
  {
    nama: 'Tn. Agus Pratama',
    noRm: '00-73-18-90',
    kamar: 'ICU - Bed 2',
    dpjp: 'dr. Hendra Wijaya, Sp.PD',
    diagnosis: 'Sepsis ec Pneumonia Komunitas Berat + AKI Stage 2 + DM Tipe 2 tidak terkontrol. Terpasang HFNC 40 Lpm FiO2 50%.',
    status: 'Aktif Rawat'
  },
  {
    nama: 'An. Kevin Alvaro',
    noRm: '01-12-33-08',
    kamar: 'Anggrek Anak - Bed 1',
    dpjp: 'dr. Maya Putri, Sp.A',
    diagnosis: 'Gastroenteritis Akut (GEA) dengan Dehidrasi Ringan-Sedang (Rehidrasi tercapai, intake oral mulai baik). Rencana KRS sore.',
    status: 'Aktif Rawat'
  },
  {
    nama: 'Ny. Ratna Sari',
    noRm: '00-65-21-77',
    kamar: 'Bedah Flamboyan - Bed B',
    dpjp: 'dr. Lukman Hakim, Sp.B',
    diagnosis: 'Post Laparotomi Eksplorasi H+3 a/i Appendisitis Perforasi. Luka operasi kering, drain minimal serosa, sudah flatus.',
    status: 'KRS'
  }
];

const DEFAULT_ROOMS = [
  'Melati 1 - Bed A',
  'Melati 1 - Bed B',
  'Melati 2 - Bed A',
  'Melati 2 - Bed C',
  'Flamboyan 1 - Bed A',
  'Flamboyan 2 - Bed B',
  'Anggrek Anak - Bed 1',
  'ICU - Bed 1',
  'ICU - Bed 2',
  'HCU - Bed 3',
  'Isolasi - Bed 1'
];

const DEFAULT_DPJP = [
  'dr. Hendra Wijaya, Sp.PD',
  'dr. Rina Kartika, Sp.JP',
  'dr. Maya Putri, Sp.A',
  'dr. Lukman Hakim, Sp.B',
  'dr. Faisal Anwar, Sp.P',
  'dr. Nadia Utami, Sp.S'
];

export default function App() {
  // State Autentikasi & Koneksi
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connecting'); // 'connecting' | 'synced' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  // State Data Pasien
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Filter & Pencarian
  const [statusFilter, setStatusFilter] = useState('Aktif Rawat'); // 'Aktif Rawat' | 'KRS' | 'Semua'
  const [dpjpFilter, setDpjpFilter] = useState('Semua');
  const [wardFilter, setWardFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // State Modal Form (Tambah / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nama: '',
    noRm: '',
    kamar: '',
    dpjp: '',
    diagnosis: '',
    status: 'Aktif Rawat'
  });

  // State UI Interaktif (Konfirmasi Hapus Inline, Toast, Copy Summary)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [toast, setToast] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isHandoffModalOpen, setIsHandoffModalOpen] = useState(false);

  // Refs untuk navigasi keyboard
  const nameInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // Helper menampilkan pesan Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3000);
  };

  // ==========================================
  // 2. AUTENTIKASI FIREBASE (RULE 3)
  // ==========================================
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setSyncStatus('error');
        setErrorMessage('Gagal menginisialisasi sesi autentikasi.');
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // 3. REAL-TIME FIRESTORE LISTENER (RULE 1 & 2)
  // ==========================================
  useEffect(() => {
    if (!user) return;

    setSyncStatus('connecting');
    const patientsCollectionRef = collection(
      db,
      'artifacts',
      appId,
      'public',
      'data',
      'ward_patients'
    );

    const unsubscribe = onSnapshot(
      patientsCollectionRef,
      (snapshot) => {
        const loadedPatients = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));

        // Sortir di memori JavaScript: Urutkan berdasarkan Kamar/Bed secara alfabetis, lalu waktu update terbaru
        loadedPatients.sort((a, b) => {
          const roomComp = (a.kamar || '').localeCompare(b.kamar || '', undefined, { numeric: true });
          if (roomComp !== 0) return roomComp;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        setPatients(loadedPatients);
        setLoading(false);
        setSyncStatus('synced');
      },
      (error) => {
        console.error('Firestore listener error:', error);
        setSyncStatus('error');
        setErrorMessage('Koneksi sinkronisasi terputus.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ==========================================
  // 4. KEYBOARD SHORTCUTS (KOMPUTER BANGSAL)
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Shortcut 'Alt + N' atau huruf 'n' (saat tidak sedang mengetik di input) untuk Tambah Pasien
      if ((e.altKey && e.key.toLowerCase() === 'n') || (!isTyping && !isModalOpen && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        openAddModal();
      }

      // Shortcut '/' untuk langsung fokus ke kolom pencarian
      if (!isTyping && !isModalOpen && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // Shortcut 'Esc' untuk menutup modal
      if (e.key === 'Escape') {
        if (isModalOpen) closeModal();
        if (isHandoffModalOpen) setIsHandoffModalOpen(false);
        if (confirmDeleteId) setConfirmDeleteId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isHandoffModalOpen, confirmDeleteId]);

  // Auto-focus ke input Nama Pasien saat modal dibuka
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
    }
  }, [isModalOpen]);

  // ==========================================
  // 5. COMPUTED DATA & DAFTAR OPSI DINAMIS
  // ==========================================
  const stats = useMemo(() => {
    const aktif = patients.filter((p) => p.status === 'Aktif Rawat').length;
    const krs = patients.filter((p) => p.status === 'KRS').length;
    return { aktif, krs, total: patients.length };
  }, [patients]);

  // Daftar DPJP unik untuk filter dan saran autocomplete
  const uniqueDpjpList = useMemo(() => {
    const fromData = patients.map((p) => p.dpjp?.trim()).filter(Boolean);
    return Array.from(new Set([...fromData, ...DEFAULT_DPJP])).sort();
  }, [patients]);

  // Daftar DPJP yang aktif punya pasien saat ini untuk dropdown filter
  const activeFilterDpjpList = useMemo(() => {
    const fromData = patients.map((p) => p.dpjp?.trim()).filter(Boolean);
    return Array.from(new Set(fromData)).sort();
  }, [patients]);

  // Daftar Kamar/Bed unik untuk saran autocomplete
  const uniqueRoomList = useMemo(() => {
    const fromData = patients.map((p) => p.kamar?.trim()).filter(Boolean);
    return Array.from(new Set([...fromData, ...DEFAULT_ROOMS])).sort();
  }, [patients]);

  // Ekstrak nama bangsal utama (sebelum tanda '-') untuk filter cepat
  const uniqueWardPrefixes = useMemo(() => {
    const prefixes = patients
      .map((p) => {
        if (!p.kamar) return '';
        return p.kamar.split('-')[0].trim();
      })
      .filter(Boolean);
    return Array.from(new Set(prefixes)).sort();
  }, [patients]);

  // Filter daftar pasien berdasarkan tab status, DPJP, bangsal, dan keyword pencarian
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // 1. Filter Status
      if (statusFilter !== 'Semua' && p.status !== statusFilter) {
        return false;
      }
      // 2. Filter DPJP
      if (dpjpFilter !== 'Semua' && p.dpjp !== dpjpFilter) {
        return false;
      }
      // 3. Filter Bangsal/Kamar
      if (wardFilter !== 'Semua' && !(p.kamar || '').toLowerCase().startsWith(wardFilter.toLowerCase())) {
        return false;
      }
      // 4. Pencarian Teks (Nama, No. RM, Kamar, Diagnosis, DPJP)
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchNama = (p.nama || '').toLowerCase().includes(q);
        const matchRm = (p.noRm || '').toLowerCase().includes(q);
        const matchKamar = (p.kamar || '').toLowerCase().includes(q);
        const matchDx = (p.diagnosis || '').toLowerCase().includes(q);
        const matchDpjp = (p.dpjp || '').toLowerCase().includes(q);
        return matchNama || matchRm || matchKamar || matchDx || matchDpjp;
      }
      return true;
    });
  }, [patients, statusFilter, dpjpFilter, wardFilter, searchQuery]);

  // ==========================================
  // 6. HANDLERS CRUD FIRESTORE
  // ==========================================
  const openAddModal = () => {
    setEditingPatient(null);
    setFormData({
      nama: '',
      noRm: '',
      kamar: '',
      dpjp: dpjpFilter !== 'Semua' ? dpjpFilter : '',
      diagnosis: '',
      status: 'Aktif Rawat'
    });
    setIsModalOpen(true);
  };

  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setFormData({
      nama: patient.nama || '',
      noRm: patient.noRm || '',
      kamar: patient.kamar || '',
      dpjp: patient.dpjp || '',
      diagnosis: patient.diagnosis || '',
      status: patient.status || 'Aktif Rawat'
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPatient(null);
  };

  const handleSavePatient = async (e) => {
    if (e) e.preventDefault();
    if (!user) return;

    if (!formData.nama.trim() || !formData.noRm.trim() || !formData.kamar.trim()) {
      showToast('Mohon lengkapi Nama Pasien, No. RM, dan Kamar/Bed.', 'error');
      return;
    }

    setIsSaving(true);
    const now = Date.now();
    const payload = {
      nama: formData.nama.trim(),
      noRm: formData.noRm.trim(),
      kamar: formData.kamar.trim(),
      dpjp: formData.dpjp.trim() || 'DPJP Umum',
      diagnosis: formData.diagnosis.trim() || '-',
      status: formData.status,
      updatedAt: now
    };

    try {
      if (editingPatient) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ward_patients', editingPatient.id);
        await updateDoc(docRef, payload);
        showToast(`Data ${payload.nama} berhasil diperbarui.`);
      } else {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'ward_patients');
        await addDoc(colRef, {
          ...payload,
          createdAt: now
        });
        showToast(`Pasien ${payload.nama} ditambahkan ke daftar ${payload.status}.`);
      }
      closeModal();
    } catch (err) {
      console.error('Error saving patient:', err);
      showToast('Gagal menyimpan data pasien. Periksa koneksi Anda.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick 1-Click Status Toggle ("Aktif Rawat" <-> "KRS")
  const handleQuickToggleStatus = async (patient) => {
    if (!user) return;
    const newStatus = patient.status === 'Aktif Rawat' ? 'KRS' : 'Aktif Rawat';
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ward_patients', patient.id);
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: Date.now()
      });
      showToast(
        newStatus === 'KRS'
          ? `${patient.nama} ditandai KRS & dipindahkan ke Arsip KRS.`
          : `${patient.nama} dikembalikan ke daftar Aktif Rawat.`
      );
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('Gagal mengubah status pasien.', 'error');
    }
  };

  // Hapus Pasien
  const handleDeletePatient = async (patient) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'ward_patients', patient.id);
      await deleteDoc(docRef);
      setConfirmDeleteId(null);
      showToast(`Data pasien ${patient.nama} telah dihapus.`);
    } catch (err) {
      console.error('Error deleting patient:', err);
      showToast('Gagal menghapus data pasien.', 'error');
    }
  };

  // Muat Data Contoh (Sample Data)
  const handleLoadSampleData = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'ward_patients');
      const now = Date.now();
      for (let i = 0; i < SAMPLE_PATIENTS.length; i++) {
        await addDoc(colRef, {
          ...SAMPLE_PATIENTS[i],
          createdAt: now - i * 3600000,
          updatedAt: now - i * 1800000
        });
      }
      showToast('5 data pasien contoh berhasil dimuat!');
    } catch (err) {
      console.error('Error loading sample data:', err);
      showToast('Gagal memuat data contoh.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Format Waktu Relatif / Jam Singkat
  const formatTimestamp = (ts) => {
    if (!ts) return '-';
    const date = new Date(ts);
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Hari ini, ${timeStr}`;
    }
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${dateStr}, ${timeStr}`;
  };

  // Generate Teks Operan Jaga (Handoff Summary)
  const generateHandoffText = () => {
    const activeList = patients.filter((p) => p.status === 'Aktif Rawat');
    const dateNow = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const timeNow = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    if (activeList.length === 0) {
      return `*OPERAN JAGA BANGSAL (${dateNow} - ${timeNow})*\nBelum ada pasien Aktif Rawat saat ini.`;
    }

    let lines = [
      `*LAPORAN OPERAN JAGA RAWAT INAP*`,
      `📅 ${dateNow} | ⏰ Pukul ${timeNow}`,
      `📊 Total Aktif Rawat: *${activeList.length} Pasien*`,
      `----------------------------------------`
    ];

    activeList.forEach((p, idx) => {
      lines.push(
        `${idx + 1}. *[${p.kamar}]* *${p.nama}* (RM: \`${p.noRm}\`)\n   • DPJP: ${p.dpjp}\n   • Dx: ${p.diagnosis}`
      );
    });

    return lines.join('\n\n');
  };

  // Salin Teks Operan ke Clipboard
  const handleCopyHandoff = () => {
    const text = generateHandoffText();
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      setIsCopied(true);
      showToast('Ringkasan operan pasien aktif berhasil disalin ke clipboard!');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      showToast('Gagal menyalin teks secara otomatis.', 'error');
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* ==========================================
          TOAST NOTIFICATION
         ========================================== */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-bounce">
          <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-200 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* ==========================================
          HEADER UTAMA (STICKY)
         ========================================== */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3.5">
            {/* Brand & Indikator Live Sync */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shadow-emerald-600/20">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                      WardTracker
                    </h1>
                    {/* Live Sync Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        syncStatus === 'synced'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : syncStatus === 'connecting'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                      title="Sinkronisasi Real-Time Multi-Device"
                    >
                      {syncStatus === 'synced' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <Wifi className="w-3 h-3 hidden sm:inline" />
                          <span>Live Sync</span>
                        </>
                      ) : syncStatus === 'connecting' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                          <span>Menghubungkan...</span>
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3" />
                          <span>Offline</span>
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Tracking & Operan Jaga Pasien Rawat Inap Harian
                  </p>
                </div>
              </div>

              {/* Tombol Tambah Pasien di Mobile */}
              <button
                onClick={openAddModal}
                className="md:hidden inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm px-3.5 py-2 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Pasien</span>
              </button>
            </div>

            {/* Statistik Ringkas & Action Buttons */}
            <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
              {/* Counter Badges */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-medium">
                <button
                  onClick={() => setStatusFilter('Aktif Rawat')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'Aktif Rawat'
                      ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Aktif Rawat:</span>
                  <span className="font-bold text-slate-900">{stats.aktif}</span>
                </button>
                <div className="h-4 w-px bg-slate-300 mx-0.5" />
                <button
                  onClick={() => setStatusFilter('KRS')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === 'KRS'
                      ? 'bg-white text-slate-800 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>KRS:</span>
                  <span className="font-bold text-slate-900">{stats.krs}</span>
                </button>
              </div>

              {/* Tombol Salin Operan / Handoff */}
              <button
                onClick={() => setIsHandoffModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
                title="Lihat & Salin Ringkasan Operan Jaga"
              >
                {isCopied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
                <span>Salin Operan</span>
              </button>

              {/* Tombol Tambah Pasien di Desktop + Info Shortcut */}
              <button
                onClick={openAddModal}
                className="hidden md:inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm px-4 py-2 rounded-xl shadow-xs shadow-emerald-600/15 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pasien</span>
                <kbd className="hidden lg:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-emerald-700/80 text-emerald-100 rounded border border-emerald-500">
                  N
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ==========================================
          BAR FILTER & PENCARIAN CEPAT
         ========================================== */}
      <section className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Tab Filter Status */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
              <button
                onClick={() => setStatusFilter('Aktif Rawat')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer ${
                  statusFilter === 'Aktif Rawat'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Aktif Rawat</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs ${
                    statusFilter === 'Aktif Rawat'
                      ? 'bg-emerald-700 text-emerald-50'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {stats.aktif}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter('KRS')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer ${
                  statusFilter === 'KRS'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Archive className="w-4 h-4" />
                <span>Arsip KRS</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs ${
                    statusFilter === 'KRS'
                      ? 'bg-slate-700 text-slate-100'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {stats.krs}
                </span>
              </button>

              <button
                onClick={() => setStatusFilter('Semua')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition shrink-0 cursor-pointer ${
                  statusFilter === 'Semua'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Semua</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-xs ${
                    statusFilter === 'Semua'
                      ? 'bg-blue-700 text-blue-50'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {stats.total}
                </span>
              </button>
            </div>

            {/* Search Input & Filter Dropdown (Bangsal & DPJP) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 lg:max-w-2xl">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pasien, No. RM, kamar, atau diagnosis... (Tekan '/')"
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-sm rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-hidden transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Bersihkan pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Bangsal/Kamar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-40">
                  <BedDouble className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={wardFilter}
                    onChange={(e) => setWardFilter(e.target.value)}
                    className="w-full pl-8 pr-6 py-2 bg-slate-50 hover:bg-slate-100/70 text-xs sm:text-sm text-slate-700 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-hidden appearance-none truncate cursor-pointer"
                    title="Filter berdasarkan Bangsal / Ruang"
                  >
                    <option value="Semua">Semua Ruang</option>
                    {uniqueWardPrefixes.map((ward) => (
                      <option key={ward} value={ward}>
                        {ward}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter DPJP */}
                <div className="relative flex-1 sm:w-48">
                  <Stethoscope className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={dpjpFilter}
                    onChange={(e) => setDpjpFilter(e.target.value)}
                    className="w-full pl-8 pr-6 py-2 bg-slate-50 hover:bg-slate-100/70 text-xs sm:text-sm text-slate-700 rounded-xl border border-slate-200 focus:border-emerald-500 focus:outline-hidden appearance-none truncate cursor-pointer"
                    title="Filter berdasarkan DPJP"
                  >
                    <option value="Semua">Semua DPJP</option>
                    {activeFilterDpjpList.map((dpjp) => (
                      <option key={dpjp} value={dpjp}>
                        {dpjp}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reset Filter jika aktif */}
                {(dpjpFilter !== 'Semua' || wardFilter !== 'Semua' || searchQuery !== '') && (
                  <button
                    onClick={() => {
                      setDpjpFilter('Semua');
                      setWardFilter('Semua');
                      setSearchQuery('');
                    }}
                    className="p-2 text-xs text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-xl border border-slate-200 transition shrink-0 cursor-pointer"
                    title="Reset semua filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================
          DAFTAR KARTU PASIEN (MAIN CONTENT)
         ========================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          // Skeleton Loading
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs animate-pulse space-y-3"
              >
                <div className="flex justify-between">
                  <div className="h-6 bg-slate-200 rounded-lg w-1/3" />
                  <div className="h-6 bg-slate-200 rounded-full w-1/4" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-2/3" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
                <div className="h-16 bg-slate-100 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center max-w-xl mx-auto my-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <BedDouble className="w-6 h-6" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              {patients.length === 0
                ? 'Belum Ada Data Pasien di Bangsal'
                : `Tidak Ada Pasien pada Filter "${statusFilter}"`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              {patients.length === 0
                ? 'Mulai tambahkan pasien baru untuk memantau kamar/bed, DPJP, serta diagnosis harian secara real-time di semua perangkat.'
                : 'Coba ubah kata kunci pencarian, pilih tab status lain, atau reset filter DPJP/Ruang.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pasien Baru</span>
              </button>

              {patients.length === 0 && (
                <button
                  onClick={handleLoadSampleData}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl border border-slate-200 transition cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>{isSaving ? 'Memuat...' : 'Muat Data Contoh'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          // Grid Kartu Pasien
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => {
              const isAktif = patient.status === 'Aktif Rawat';
              const isDeleting = confirmDeleteId === patient.id;

              return (
                <article
                  key={patient.id}
                  className={`group relative rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                    isAktif
                      ? 'bg-white border-slate-200/90 hover:border-emerald-300 shadow-2xs hover:shadow-md'
                      : 'bg-slate-50/90 border-slate-200/70 opacity-90 hover:opacity-100'
                  }`}
                >
                  {/* Top Bar Accent */}
                  <div
                    className={`h-1.5 w-full ${
                      isAktif ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />

                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    {/* Baris 1: Kamar/Bed & Badge Status */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs sm:text-sm font-bold tracking-wide shadow-2xs">
                        <BedDouble className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate max-w-[190px]">{patient.kamar}</span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${
                          isAktif
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-200/70 text-slate-600 border-slate-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAktif ? 'bg-emerald-500' : 'bg-slate-500'
                          }`}
                        />
                        {patient.status}
                      </span>
                    </div>

                    {/* Baris 2: Nama Pasien & Nomor Rekam Medis (No. RM) */}
                    <div className="mb-3">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug wrap-break-word">
                        {patient.nama}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          <Hash className="w-3 h-3 text-slate-400" />
                          RM: {patient.noRm}
                        </span>

                        {/* Badge DPJP */}
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 max-w-full truncate">
                          <Stethoscope className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{patient.dpjp}</span>
                        </span>
                      </div>
                    </div>

                    {/* Baris 3: Kotak Diagnosis (Dx) */}
                    <div className="mt-1 mb-4 flex-1">
                      <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 h-full">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          <FileText className="w-3 h-3" />
                          <span>Diagnosis (Dx) & Catatan</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed wrap-break-word">
                          {patient.diagnosis || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Baris 4: Waktu Update Terakhir */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Update: {formatTimestamp(patient.updatedAt)}
                      </span>
                    </div>

                    {/* Baris 5: Tombol Aksi Cepat (1-Klik Toggle KRS & Edit/Hapus) */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isDeleting ? (
                        // Konfirmasi Hapus Inline (Tanpa window.confirm)
                        <div className="flex items-center justify-between w-full bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                          <span className="text-xs font-semibold text-red-700">
                            Hapus pasien ini?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDeletePatient(patient)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 text-xs font-medium rounded-lg border border-slate-200 transition cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Quick Status Toggle Button */}
                          {isAktif ? (
                            <button
                              onClick={() => handleQuickToggleStatus(patient)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 transition cursor-pointer"
                              title="Klik untuk langsung mengubah status menjadi KRS (Pulang)"
                            >
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Tandai KRS</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleQuickToggleStatus(patient)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-200/80 hover:bg-emerald-600 text-slate-700 hover:text-white transition cursor-pointer"
                              title="Kembalikan status pasien menjadi Aktif Rawat"
                            >
                              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                              <span>Aktifkan Kembali</span>
                            </button>
                          )}

                          {/* Edit & Delete Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(patient)}
                              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-transparent hover:border-blue-200 transition cursor-pointer"
                              title="Edit Data / Pindah Kamar / Update Diagnosis"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(patient.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition cursor-pointer"
                              title="Hapus Entri Pasien"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* ==========================================
          FOOTER INFO & PANDUAN SHORTCUT
         ========================================== */}
      <footer className="bg-white border-t border-slate-200/80 py-3 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Ward Patient Tracker & Handoff</span>
            <span>•</span>
            <span>Real-time Cloud Sync</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="w-3.5 h-3.5" />
              Shortcut Bangsal:
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-mono text-[10px]">
                N
              </kbd>{' '}
              Pasien Baru
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-mono text-[10px]">
                /
              </kbd>{' '}
              Cari Cepat
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-mono text-[10px]">
                Esc
              </kbd>{' '}
              Tutup Modal
            </span>
          </div>
        </div>
      </footer>

      {/* ==========================================
          MODAL QUICK ADD / EDIT PASIEN
         ========================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  {editingPatient ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingPatient ? 'Edit Data Pasien' : 'Input Pasien Rawat Inap Baru'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tekan <kbd className="font-mono">Tab</kbd> untuk pindah kolom,{' '}
                    <kbd className="font-mono">Ctrl+Enter</kbd> untuk simpan
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Input */}
            <form
              onSubmit={handleSavePatient}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  handleSavePatient(e);
                }
              }}
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Nama Pasien */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Nama Pasien <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                    placeholder="Misal: Tn. Budi Santoso"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* No. RM */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    No. RM <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.noRm}
                    onChange={(e) => setFormData({ ...formData, noRm: e.target.value })}
                    placeholder="00-12-34-56"
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Kamar / Bed (dengan datalist saran cepat) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Kamar / Bed <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    list="kamar-options"
                    value={formData.kamar}
                    onChange={(e) => setFormData({ ...formData, kamar: e.target.value })}
                    placeholder="Contoh: Melati 1 - Bed A"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <datalist id="kamar-options">
                    {uniqueRoomList.map((room) => (
                      <option key={room} value={room} />
                    ))}
                  </datalist>
                </div>

                {/* DPJP (dengan datalist autocomplete DPJP yang sudah ada) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    DPJP
                  </label>
                  <input
                    type="text"
                    list="dpjp-options"
                    value={formData.dpjp}
                    onChange={(e) => setFormData({ ...formData, dpjp: e.target.value })}
                    placeholder="Pilih / ketik nama dokter..."
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-hidden"
                  />
                  <datalist id="dpjp-options">
                    {uniqueDpjpList.map((docName) => (
                      <option key={docName} value={docName} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Diagnosis (Dx) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Diagnosis (Dx) & Catatan Penting
                  </label>
                  <span className="text-[11px] text-slate-400">Singkat & jelas untuk visite</span>
                </div>
                <textarea
                  rows={3}
                  value={formData.diagnosis}
                  onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  placeholder="Contoh: DHF Grade II + Trombositopenia (42.000) + Obs. Febris H-4. Rencana cek DL ulang besok pagi."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:border-emerald-600 focus:outline-hidden leading-relaxed"
                />
              </div>

              {/* Pilihan Status Pasien */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Status Pasien
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'Aktif Rawat' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                      formData.status === 'Aktif Rawat'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Aktif Rawat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'KRS' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                      formData.status === 'KRS'
                        ? 'bg-slate-800 border-slate-800 text-white shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span>KRS (Pulang)</span>
                  </button>
                </div>
              </div>

              {/* Tombol Simpan & Batal */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'Menyimpan...'
                      : editingPatient
                      ? 'Simpan Perubahan'
                      : 'Tambah Pasien'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL PREVIEW & SALIN OPERAN JAGA (HANDOFF)
         ========================================== */}
      {isHandoffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsHandoffModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Ringkasan Operan Jaga (Handoff Summary)
                </h2>
                <p className="text-xs text-slate-500">
                  Format siap tempel ke WhatsApp / Grup Jaga Bangsal ({stats.aktif} Pasien Aktif)
                </p>
              </div>
              <button
                onClick={() => setIsHandoffModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <pre className="w-full h-64 p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {generateHandoffText()}
              </pre>

              <div className="flex items-center justify-end gap-2.5 mt-4">
                <button
                  onClick={() => setIsHandoffModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={handleCopyHandoff}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer"
                >
                  {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Tersalin!' : 'Salin ke Clipboard'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}