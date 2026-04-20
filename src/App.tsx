/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  where
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { format } from 'date-fns';
import { 
  Calendar as CalendarIcon, 
  Send, 
  Save, 
  Plus, 
  History, 
  BookOpen, 
  Users, 
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Trash2,
  LogIn,
  LogOut,
  Settings2,
  LayoutDashboard,
  CheckCircle2,
  Sparkles,
  Search,
  MoreVertical,
  Filter,
  GraduationCap,
  FileUp,
  ArrowRight,
  Zap,
  FilePlus,
  RefreshCcw,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Constants
const SUBJECT_PI = "Pendidikan Islam";
const SUB_SUBJECT_PI = ["Al-Quran", "Ulum", "Jawi", "Tasmik"];
const DEFAULT_SUBJECTS = ["Bahasa Melayu", "Bahasa Inggeris", "Matematik", "Sains", "Pendidikan Islam", "Pendidikan Moral", "Sejarah", "RBT", "PJPK", "Muzik", "Seni Visual"];
const YEARS = ["Pra", "Tahun 1", "Tahun 2", "Tahun 3", "Tahun 4", "Tahun 5", "Tahun 6"];

const YEAR_CLASSES: { [key: string]: string[] } = {
  "Pra": ["Anggerik", "Mawar"],
  "Tahun 1": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
  "Tahun 2": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
  "Tahun 3": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
  "Tahun 4": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
  "Tahun 5": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
  "Tahun 6": ["Semarak", "Kenanga", "Siantan", "Bakawali", "Dahlia"],
};

const ALL_CLASS_NAMES = Array.from(new Set(Object.values(YEAR_CLASSES).flat()));
const CLASS_NAMES = ALL_CLASS_NAMES;
const DEFAULT_CLASSES = ALL_CLASS_NAMES;

// Mock student list for the prompt
const studentList = [
  "Ahmad Ali bin Abu", "Siti Nurhaliza binti Bakar", "Chong Wei Ming", "Muthu Arumugam", 
  "Adam Zarif bin Zainal", "Nurul Izzah binti Anwar", "Haziq Iskandar", "Puteri Balqis",
  "Muhammad Amar", "Sofiya Jannah", "Rayyan Mikael", "Zara Eryna", "Irfan Hakim", "Maya Qaisara"
];

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AIResult {
  formal_diary: string;
  detected_students: string[];
}

interface PdPRecord {
  id: string;
  date: string;
  subject: string;
  subSubject?: string;
  year: string;
  className: string;
  raw_note: string;
  formal_diary: string;
  students_involved: string[];
  timestamp: any;
  userId: string;
  userEmail: string;
}

interface Student {
  id: string;
  name: string;
  year: string;
  className: string;
  userId: string;
}

interface TimetableItem {
  id: string;
  day: string;
  year: string;
  startTime: string;
  endTime: string;
  subject: string;
  subSubject?: string;
  className: string;
  userId: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Form State
  const [date, setDate] = useState<Date>(new Date());
  const [subject, setSubject] = useState("");
  const [subSubject, setSubSubject] = useState("");
  const [year, setYear] = useState("Tahun 1");
  const [className, setClassName] = useState("");
  const [rawNote, setRawNote] = useState("");
  
  // Records & Settings
  const [records, setRecords] = useState<PdPRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [timetable, setTimetable] = useState<TimetableItem[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<AIResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Student Feature State
  const [selectedYearForStudents, setSelectedYearForStudents] = useState("Tahun 1");
  const [selectedClassForStudents, setSelectedClassForStudents] = useState(DEFAULT_CLASSES[0]);
  const [selectedStudentForDashboardMurid, setSelectedStudentForDashboardMurid] = useState<string | null>(null);
  const [showAllStudentsView, setShowAllStudentsView] = useState(false);
  const [showActiveClassesView, setShowActiveClassesView] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [bulkStudentInput, setBulkStudentInput] = useState("");
  
  // Timetable Feature State
  const [newTimetableItem, setNewTimetableItem] = useState<Partial<TimetableItem>>({
    day: "Isnin",
    year: "Tahun 1",
    startTime: "08:00",
    endTime: "09:00",
    subject: DEFAULT_SUBJECTS[0]
  });

  // Dashboard State
  const [selectedYearForDashboard, setSelectedYearForDashboard] = useState<string>("Semua");
  const [selectedClassForDashboard, setSelectedClassForDashboard] = useState<string>("Semua");
  const [selectedStudentForJourney, setSelectedStudentForJourney] = useState<string | null>(null);

  // File Upload State
  const [isImporting, setIsImporting] = useState(false);

  // AI Configuration
  const modelName = "gemini-3-flash-preview";

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch history & Settings from Firestore
  useEffect(() => {
    if (!user) {
      setRecords([]);
      return;
    }

    // Sync data (Removed settings listener)
    const unsubscribeRecords = onSnapshot(query(collection(db, "pdp_impacts"), where("userId", "==", user.uid)), (snapshot) => {
      const fetchedRecords = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as PdPRecord))
        .filter(r => r.userId === user.uid)
        .sort((a: any, b: any) => {
          const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
          const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
          return timeB - timeA;
        });
      setRecords(fetchedRecords);
    }, (error) => {
      console.error("Records Listener Error:", error);
    });

    const unsubscribeStudents = onSnapshot(query(collection(db, "students"), where("userId", "==", user.uid)), (snapshot) => {
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Student)));
    });

    const unsubscribeTimetable = onSnapshot(query(collection(db, "timetables"), where("userId", "==", user.uid)), (snapshot) => {
      setTimetable(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimetableItem)));
    });

    return () => {
      unsubscribeRecords();
      unsubscribeStudents();
      unsubscribeTimetable();
    };
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success("Selamat datang kembali!");
    } catch (error: any) {
      console.error("Login Error:", error);
      let errorMsg = "Gagal log masuk.";
      if (error.code === 'auth/unauthorized-domain') {
        errorMsg = "Domain tidak dibenarkan. Sila semak Authorized Domains.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMsg = "Google Auth tidak diaktifkan di Firebase Console.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMsg = "Popup disekat oleh pelayar anda.";
      }
      toast.error(`${errorMsg} (${error.code})`);
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); toast.info("Log keluar berjaya."); } catch (e) {}
  };

  const handleFirestoreError = (error: any, operation: string, path: string | null = null) => {
    console.error(`Firestore Error (${operation}):`, error);
    let message = "Ralat pangkalan data.";
    if (error.code === 'permission-denied') {
      message = "Tiada kebenaran untuk akses/simpan data.";
    } else if (error.code === 'failed-precondition') {
      message = "Indeks diperlukan. Sila hubungi pembangun.";
    } else if (error.message?.includes('offline')) {
      message = "Anda sedang luar talian. Sila periksa internet.";
    }
    toast.error(message);
    const info = {
      error: error.message,
      code: error.code,
      operationType: operation,
      path: path,
      authInfo: user ? { userId: user.uid, email: user.email } : 'Not Authenticated'
    };
    console.log("Firestore Diagnosis:", info);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmStep, setResetConfirmStep] = useState(0);

  // Sync classes when year changes
  useEffect(() => {
    const available = YEAR_CLASSES[year] || [];
    if (!available.includes(className)) {
      setClassName(available[0] || "");
    }
  }, [year]);

  useEffect(() => {
    const available = YEAR_CLASSES[selectedYearForStudents] || [];
    if (!available.includes(selectedClassForStudents)) {
      setSelectedClassForStudents(available[0] || "");
    }
  }, [selectedYearForStudents]);

  useEffect(() => {
    const available = YEAR_CLASSES[newTimetableItem.year || ""] || [];
    if (newTimetableItem.year && !available.includes(newTimetableItem.className || "")) {
      setNewTimetableItem(prev => ({ ...prev, className: available[0] || "" }));
    }
  }, [newTimetableItem.year]);

  const handleResetData = async () => {
    if (resetConfirmStep === 0) {
      setResetConfirmStep(1);
      toast.warning("Klik sekali lagi butang Reset untuk mengesahkan pemadaman kekal.");
      setTimeout(() => setResetConfirmStep(0), 5000); // Reset after 5s
      return;
    }

    if (!user) return;
    setIsResetting(true);
    const toastId = toast.loading("Sedang mengosongkan pangkalan data...");
    
    try {
      // Chunked deletion to avoid overwhelming Firestore/Browser
      const allToDelete = [
        ...students.map(s => ({ coll: "students", id: s.id })),
        ...records.map(r => ({ coll: "pdp_impacts", id: r.id }))
      ];

      for (let i = 0; i < allToDelete.length; i += 20) {
        const chunk = allToDelete.slice(i, i + 20);
        await Promise.all(chunk.map(item => deleteDoc(doc(db, item.coll, item.id))));
      }
      
      toast.success("Semua data telah dikosongkan secara selamat.", { id: toastId });
      setResetConfirmStep(0);
    } catch (e: any) {
      console.error("Reset Error:", e);
      toast.error("Gagal melakukan reset penuh. Sila cuba sebentar lagi.", { id: toastId });
    } finally {
      setIsResetting(false);
    }
  };

  const handleProcessAI = async () => {
    if (!rawNote || !subject || !className) {
      return toast.error("Sila isi semua maklumat butiran PdP.");
    }
    
    setIsProcessing(true);

    try {
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: `
          Anda adalah seorang pembantu sistem pintar untuk guru di Malaysia.
          Tugas utama: Memproses nota PdP harian guru menjadi laporan refleksi rasmi yang profesional.

          Konteks PdP:
          - Mata Pelajaran: ${subject} ${subSubject ? `(${subSubject})` : ''}
          - Tahun: ${year}
          - Kelas: ${className}
          - Senarai Nama Murid Rasmi (Kelas Ini Sahaja): ${students.filter(s => s.className === className && s.year === year).map(s => s.name).join(', ') || "Tiada data murid."}

          Nota asal guru: "${rawNote}"

          Arahan Matching & Analisis Pintar (MANDATORI):
          1. PROSES PADANAN: Gunakan strategi "Fuzzy Matching" untuk memadankan nama pendek dalam nota guru dengan "Senarai Nama Murid Rasmi".
             * CONTOH: Jika nota tulis "Ali", dan senarai ada "MUHAMMAD ALI BIN ABU", output MESTI "MUHAMMAD ALI BIN ABU".
             * CONTOH: Jika nota tulis "Nurul", dan senarai ada "NURUL IZZAH BINTI ANWAR", output MESTI "NURUL IZZAH BINTI ANWAR".
          2. HIERARKI PENGERTIAN: Fokus HANYA pada nama murid yang wujud dalam senarai rasmi bagi Tahun ${year} dan Kelas ${className} yang telah diberikan.
          3. VALIDASI: Jika nama dikesan tetapi TIADA dalam senarai rasmi kelas tersebut, JANGAN masukkan dalam 'detected_students' (kecuali jika anda yakin itu adalah murid baru yang tiada dalam rekod).
          4. REFLEKSI RASMI: Bina perenggan refleksi mengikut laras bahasa formal KPM yang profesional.
          5. OUTPUT NAMA: 'detected_students' MESTI dalam bentuk Array yang mengandungi NAMA PENUH murid seperti dalam pangkalan data.

          Hasilkan output JSON sahaja:
          { "formal_diary": "...", "detected_students": ["Nama Penuh 1", "Nama Penuh 2"] }
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            // @ts-ignore
            type: Type.OBJECT,
            properties: {
              // @ts-ignore
              formal_diary: { type: Type.STRING },
              // @ts-ignore
              detected_students: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["formal_diary", "detected_students"]
          }
        }
      });

      if (!response.text) throw new Error("Tiada respon dari AI");
      setResult(JSON.parse(response.text));
      toast.success("AI berjaya menjana refleksi.");
    } catch (error) {
      console.error("AI Error:", error);
      toast.error("Gagal memproses AI. Sila cuba lagi.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRecord = async () => {
    if (!result || !user) return;
    try {
      await addDoc(collection(db, "pdp_impacts"), {
        date: date.toISOString(),
        subject,
        subSubject: subject === SUBJECT_PI ? subSubject : null,
        year,
        className,
        raw_note: rawNote,
        formal_diary: result.formal_diary,
        students_involved: result.detected_students,
        timestamp: serverTimestamp(),
        userId: user.uid,
        userEmail: user.email || ""
      });
      toast.success("Rekod berjaya disimpan.");
      setRawNote("");
      setResult(null);
      setActiveTab('history');
    } catch (e: any) {
      handleFirestoreError(e, 'save_record', 'pdp_impacts');
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, "pdp_impacts", id));
      toast.info("Rekod dipadam.");
    } catch (e) {
      toast.error("Gagal memadam rekod.");
    }
  };

  const handleAddStudent = async () => {
    if (!user || !newStudentName.trim()) return;
    try {
      await addDoc(collection(db, "students"), {
        name: newStudentName.trim(),
        year: selectedYearForStudents,
        className: selectedClassForStudents,
        userId: user.uid
      });
      setNewStudentName("");
      toast.success("Murid ditambah.");
    } catch (e: any) {
      handleFirestoreError(e, 'add_student', 'students');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await deleteDoc(doc(db, "students", id));
      toast.info("Murid dipadam.");
    } catch (e) {
      toast.error("Gagal memadam murid.");
    }
  };

  const handleBulkAddStudents = async () => {
    if (!user || !bulkStudentInput.trim()) return;
    const names = bulkStudentInput.split('\n').map(n => n.trim()).filter(n => n !== "");
    if (names.length === 0) return;

    const toastId = toast.loading(`Menambah ${names.length} murid...`);
    try {
      const batch = names.map(name => addDoc(collection(db, "students"), {
        name,
        year: selectedYearForStudents,
        className: selectedClassForStudents,
        userId: user.uid
      }));
      await Promise.all(batch);
      setBulkStudentInput("");
      toast.success(`Berjaya menambah ${names.length} murid.`, { id: toastId });
    } catch (e: any) {
      handleFirestoreError(e, 'bulk_add_students', 'students');
    }
  };

  const handleAddTimetable = async () => {
    if (!user || !newTimetableItem.className) return;
    try {
      await addDoc(collection(db, "timetables"), {
        day: newTimetableItem.day || "Isnin",
        year: newTimetableItem.year || "Tahun 1",
        startTime: newTimetableItem.startTime || "08:00",
        endTime: newTimetableItem.endTime || "09:00",
        subject: newTimetableItem.subject || DEFAULT_SUBJECTS[0],
        className: newTimetableItem.className,
        userId: user.uid
      });
      toast.success("Slot jadual ditambah.");
    } catch (e: any) {
      handleFirestoreError(e, 'add_timetable', 'timetables');
    }
  };

  const handleDeleteTimetable = async (id: string) => {
    try {
      await deleteDoc(doc(db, "timetables", id));
      toast.info("Slot jadual dipadam.");
    } catch (e) {
      toast.error("Gagal memadam slot.");
    }
  };

  const handleFileUpload = async (file: File, type: 'students' | 'timetable') => {
    if (!user) return;
    setIsImporting(true);
    const toastId = toast.loading(`Sedang memproses fail ${file.name}...`);

    try {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel' ||
                    file.name.endsWith('.xlsx') || 
                    file.name.endsWith('.xls') ||
                    file.name.endsWith('.csv');

      const prompt = type === 'students' 
        ? `Tugas Utama: Ekstrak pangkalan data murid dari dokumen ini secara sistematik.
           
           PERATURAN EKSTRAKSI (WAJIB):
           1. Kenalpasti Nama Penuh, Tahun dan Nama Kelas dari kandungan dokumen.
           2. TAHUN MESTI merupakan salah satu dari senarai ini: ${YEARS.join(', ')}.
           3. KELAS MESTI sepadan dengan Tahun yang dikesan berdasarkan pemetaan ini:
              ${Object.entries(YEAR_CLASSES).map(([y, classes]) => `${y}: ${classes.join(', ')}`).join('\n              ')}
           4. Jika Tahun/Kelas tidak ditemui dalam dokumen, gunakan Default yang diberikan oleh sistem: Tahun: "${selectedYearForStudents}", Kelas: "${selectedClassForStudents}".
           5. Pastikan Nama Murid dalam HURUF BESAR (ALL CAPS).
           
           Hasilkan output JSON array of objects sahaja:
           [{"name": "MUHAMMAD BIN AHMAD", "year": "Tahun 1", "className": "Semarak"}]`
        : `Extract teaching timetable from this document. Output ONLY a JSON array of objects with "day" (Isnin-Jumaat), "year" (Tahun 1-6), "startTime" (HH:mm), "endTime" (HH:mm), "subject" (from list: Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Pendidikan Islam), and "className". If year is not clear, use "${selectedYearForStudents}". Example: [{"day": "Isnin", "year": "Tahun 1", "startTime": "08:00", "endTime": "09:00", "subject": "Bahasa Melayu", "className": "Semarak"}]`;

      let aiParts: any[] = [];

      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        aiParts = [{ text: `Maklumat dari Spreadsheet (Format CSV):\n${csvData}\n\n${prompt}` }];
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        aiParts = [
          { inlineData: { data: base64Data, mimeType: file.type } },
          { text: prompt }
        ];
      }

      const response = await genAI.models.generateContent({
        model: modelName,
        contents: {
          parts: aiParts
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      if (!response.text) throw new Error("Tiada respon dari AI");
      const data = JSON.parse(response.text);

      if (type === 'students') {
        const batch = data.map((s: any) => addDoc(collection(db, "students"), {
          name: s.name,
          year: s.year || selectedYearForStudents,
          className: s.className || selectedClassForStudents,
          userId: user.uid
        }));
        await Promise.all(batch);
        toast.success(`Pangkalan data berjaya dikemaskini. ${data.length} murid telah diimport.`, { id: toastId });
        setActiveTab('students'); // Switch to student tab for immediate verification
      } else {
        const batch = data.map((t: any) => addDoc(collection(db, "timetables"), {
          day: t.day,
          year: t.year || "Tahun 1",
          startTime: t.startTime,
          endTime: t.endTime,
          subject: t.subject,
          className: t.className,
          userId: user.uid
        }));
        await Promise.all(batch);
        toast.success(`Berjaya import ${data.length} slot jadual.`, { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal memproses fail. Pastikan format fail disokong.", { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredRecords = records.filter(r => 
    r.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.formal_diary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (!user) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full max-w-sm">
        <div className="text-center mb-12">
          <div className="inline-block p-4 bg-slate-900 rounded-3xl shadow-2xl mb-6">
            <BookOpen className="w-12 h-12 text-blue-400" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900">E-Impak <span className="text-blue-600">Guru</span></h1>
          <p className="text-slate-500 font-medium text-sm mt-2">Pintasan Refleksi PdP Berasaskan AI</p>
        </div>

        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-slate-200">
          <CardContent className="p-8">
            <Button onClick={handleLogin} className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg group transition-all">
              Mula Rekod <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold">Khas untuk Semua Guru Malaysia</p>
          </CardContent>
        </Card>
      </motion.div>
      <Toaster position="bottom-center" richColors />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-xl">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight text-slate-900 leading-none">E-Impak</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex bg-slate-100 p-1 rounded-full mr-2 overflow-x-auto max-w-[300px] md:max-w-none no-scrollbar">
              <button onClick={() => setActiveTab('dashboard')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0", activeTab === 'dashboard' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <LayoutDashboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button onClick={() => setActiveTab('create')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0", activeTab === 'create' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Baru</span>
              </button>
              <button onClick={() => setActiveTab('history')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0", activeTab === 'history' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <History className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sejarah</span>
              </button>
              <button onClick={() => setActiveTab('timetable')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0", activeTab === 'timetable' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <CalendarIcon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Jadual</span>
              </button>
              <button onClick={() => setActiveTab('students')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 shrink-0", activeTab === 'students' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                <Users className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Dashboard Murid</span>
              </button>
            </nav>

            <Popover>
              <PopoverTrigger render={<button className="h-9 w-9 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center shrink-0" />}>
                {user.photoURL ? <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" /> : <Users className="w-5 h-5" />}
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="p-3 border-b mb-1">
                  <p className="text-xs font-bold truncate text-slate-900">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-xs font-bold text-red-500 h-9">
                  <LogOut className="w-3.5 h-3.5 mr-2" /> Log Keluar
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence>
          {isImporting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-white text-center"
            >
              <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full border border-slate-100">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                  <FileUp className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900">Sedang Memproses...</h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">Pintasan AI sedang mengekstrak maklumat daripada dokumen anda. Sila tunggu sebentar.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-8 bg-blue-600 rounded-full" />
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Mission <span className="text-blue-600">Control</span></h2>
                  </div>
                  <p className="text-sm text-slate-500 font-bold font-mono tracking-widest uppercase opacity-70">Sistem Analisis Strategik PdP & Potensi Murid</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 bg-slate-100/80 p-2 rounded-2xl backdrop-blur-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-xl shadow-sm">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Tapis:</span>
                  </div>
                  <Select value={selectedYearForDashboard} onValueChange={setSelectedYearForDashboard}>
                    <SelectTrigger className="w-[140px] h-9 rounded-xl border-none shadow-none bg-transparent font-bold text-xs">
                      <SelectValue placeholder="Tahun" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Semua">Semua Tahun</SelectItem>
                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Separator orientation="vertical" className="h-4" />
                  <Select value={selectedClassForDashboard} onValueChange={setSelectedClassForDashboard}>
                    <SelectTrigger className="w-[140px] h-9 rounded-xl border-none shadow-none bg-transparent font-bold text-xs">
                      <SelectValue placeholder="Kelas" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Semua">Semua Kelas</SelectItem>
                      {DEFAULT_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Strategic Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: "Impak Keseluruhan", value: records.length, icon: Sparkles, color: "bg-blue-600" },
                  { label: "Murid Aktif", value: new Set(records.flatMap(r => r.students_involved)).size, icon: Users, color: "bg-indigo-600" },
                  { label: "Kelas Dipantau", value: new Set(records.map(r => r.className)).size, icon: LayoutDashboard, color: "bg-violet-600" },
                  { label: "Sesi Hari Ini", value: records.filter(r => isToday(new Date(r.date))).length, icon: CalendarIcon, color: "bg-emerald-600" },
                ].map((stat, i) => (
                  <Card key={i} className="border-none shadow-xl bg-white rounded-[2rem] p-6 hover:shadow-2xl transition-all group overflow-hidden relative">
                    <div className={`absolute top-0 right-0 w-24 h-24 ${stat.color} opacity-[0.03] -mr-8 -mt-8 rounded-full group-hover:scale-150 transition-transform`} />
                    <div className="flex flex-col gap-4 relative z-10">
                      <div className={`w-10 h-10 ${stat.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform`}>
                        <stat.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] mb-1">{stat.label}</p>
                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{stat.value}</h4>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-8">
                <Card className="border-none shadow-2xl bg-white rounded-[2.5rem] overflow-hidden">
                  <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Trend Impak Mengikut Kelas</h3>
                      <p className="text-[10px] font-medium text-slate-400 mt-1 italic">Taburan laporan PdP yang dijana sepanjang tempoh aktif</p>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] font-black bg-slate-50/50">DATA SAHIH</Badge>
                  </div>
                  <CardContent className="h-[360px] pt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={DEFAULT_CLASSES.map(c => ({ 
                        name: c, 
                        count: records.filter(r => r.className === c).length 
                      }))}>
                        <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800, fill: '#94a3b8' }} />
                        <RechartsTooltip 
                           cursor={{ fill: '#f8fafc' }} 
                           contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }} 
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={45}>
                          {DEFAULT_CLASSES.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={['#2563eb', '#4f46e5', '#7c3aed', '#c026d3', '#db2777'][index % 5]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'create' && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: Form */}
              <div className="lg:col-span-7 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-md bg-blue-50 text-blue-700 border-blue-200 px-2">Langkah 1</Badge>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Maklumat Sesi</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Tarikh</Label>
                      <Popover>
                        <PopoverTrigger render={<Button variant="outline" className="w-full justify-start h-11 rounded-xl text-left font-semibold border-slate-300" />}>
                          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                          {format(date, "d MMM yyyy")}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start">
                          <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Subjek</Label>
                      <Select value={subject} onValueChange={(v) => { setSubject(v); if(v !== SUBJECT_PI) setSubSubject(""); }}>
                        <SelectTrigger className="h-11 rounded-xl border-slate-300 font-semibold">
                          <SelectValue placeholder="Pilih subjek" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl mt-1">
                          {DEFAULT_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Tahun</Label>
                      <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="h-11 rounded-xl border-slate-300 font-semibold">
                          <SelectValue placeholder="Pilih tahun" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl mt-1">
                          {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Kelas</Label>
                      <Select value={className} onValueChange={setClassName}>
                        <SelectTrigger className="h-11 rounded-xl border-slate-300 font-semibold">
                          <SelectValue placeholder="Pilih kelas" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl mt-1 max-h-[300px]">
                          {(YEAR_CLASSES[year] || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    </div>
                  </div>

                  {subject === SUBJECT_PI && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-500">Pecahan Pendidikan Islam</Label>
                      <div className="flex flex-wrap gap-2">
                        {SUB_SUBJECT_PI.map(sub => (
                          <button key={sub} onClick={() => setSubSubject(sub)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all border", subSubject === sub ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-300 hover:border-slate-400 hover:bg-slate-50")}>
                            {sub}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </section>

                <section className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="rounded-md bg-green-50 text-green-700 border-green-200 px-2">Langkah 2</Badge>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Dapatan PdP</h2>
                  </div>
                  <div className="relative group">
                    <Textarea 
                      placeholder="Apa yang berlaku hari ini? (Ali tasmik lancar, semua faham tajuk solat...)"
                      className="min-h-[220px] rounded-3xl p-6 text-base border-slate-300 focus:ring-slate-900 bg-white transition-all resize-none shadow-sm"
                      value={rawNote}
                      onChange={(e) => setRawNote(e.target.value)}
                    />
                    <div className="absolute bottom-4 right-4">
                      <Button onClick={handleProcessAI} disabled={isProcessing || !rawNote} className="rounded-2xl h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-100 transition-all active:scale-95">
                        {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Menjana...</> : <><Sparkles className="w-4 h-4 mr-2" /> Proses Pintar</>}
                      </Button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column: AI Output */}
              <div className="lg:col-span-5 space-y-6">
                <AnimatePresence mode="wait">
                  {result ? (
                    <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                      <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-slate-100 flex flex-col h-full min-h-[460px]">
                        <div className="bg-slate-900 px-8 py-6 text-white shrink-0">
                          <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-blue-500/20 text-blue-300 border-none text-[10px] uppercase tracking-widest font-black">AI Generated</Badge>
                            <span className="text-[10px] font-bold text-slate-400" suppressHydrationWarning>{format(new Date(), "PPpp")}</span>
                          </div>
                          <h3 className="text-2xl font-bold tracking-tight">Refleksi Rasmi</h3>
                        </div>
                        <CardContent className="p-8 space-y-8 flex-1 overflow-y-auto">
                          <div className="space-y-4">
                            <p className="text-lg leading-relaxed text-slate-700 font-medium italic font-serif">
                              "{result.formal_diary}"
                            </p>
                          </div>
                          
                          <Separator className="bg-slate-100" />

                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Murid Dikesan ({result.detected_students.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.detected_students.length > 0 ? (
                                result.detected_students.map((s, i) => (
                                  <Badge key={i} variant="secondary" className="rounded-xl px-3 py-1 bg-slate-50 text-slate-600 border border-slate-200">
                                    {s}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 italic font-medium">Tiada murid dikesan khas.</span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="p-6 bg-slate-50 border-t shrink-0">
                          <Button onClick={handleSaveRecord} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-lg transition-transform active:scale-95 shadow-xl shadow-green-100">
                            <Save className="w-5 h-5 mr-3" /> Rekod Sesi PdP
                          </Button>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full min-h-[460px] flex flex-col items-center justify-center text-center p-8 bg-white/50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                      <div className="p-6 bg-slate-100 rounded-3xl mb-4">
                        <Sparkles className="w-10 h-10 text-slate-300" />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2">Sedia Untuk Menjana</h3>
                      <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed italic font-medium">Lengkapkan butiran PdP dan tekan butang "Proses Pintar" untuk melihat refleksi AI anda di sini.</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Sejarah Rekod</h2>
                  <p className="text-sm text-slate-500 font-medium tracking-tight">Menyimpan {records.length} rekod PdP anda secara selamat.</p>
                </div>
                <div className="relative group max-w-xs w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                  <Input placeholder="Cari rekod, kelas atau subjek..." className="h-11 pl-11 pr-4 rounded-2xl border-slate-200 bg-white focus:ring-slate-900 transition-all font-medium" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>

              {filteredRecords.length === 0 ? (
                <div className="text-center py-32 bg-white rounded-[2.5rem] border shadow-sm">
                  <div className="inline-flex p-6 bg-slate-50 rounded-full mb-6">
                    <History className="w-12 h-12 text-slate-200" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Tiada rekod ditemui</h3>
                  <p className="text-slate-400 mt-2 max-w-xs mx-auto text-sm font-medium">Beralih ke tab 'Baru' untuk mula menjana impak PdP pertama anda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredRecords.map((rec) => (
                    <motion.div key={rec.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card className="group border-none shadow-xl hover:shadow-2xl transition-all duration-300 rounded-[2rem] overflow-hidden bg-white ring-1 ring-slate-100">
                        <div className="p-8 space-y-6">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="flex flex-col items-center justify-center min-w-[3.5rem] h-14 bg-slate-900 rounded-2xl text-white">
                                <span className="text-lg font-black leading-none">{format(new Date(rec.date), "dd")}</span>
                                <span className="text-[10px] font-bold uppercase underline tracking-widest leading-none mt-1">{format(new Date(rec.date), "MMM")}</span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="outline" className="rounded-lg h-5 text-[9px] uppercase tracking-widest font-black border-blue-200 text-blue-700 bg-blue-50/50">{rec.subject}</Badge>
                                  {rec.subSubject && <Badge variant="outline" className="rounded-lg h-5 text-[9px] uppercase tracking-widest font-black border-slate-200 text-slate-600 bg-slate-100/50">{rec.subSubject}</Badge>}
                                  <Badge variant="outline" className="rounded-lg h-5 text-[9px] uppercase tracking-widest font-black border-indigo-200 text-indigo-700 bg-indigo-50/50">{rec.className}</Badge>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Disimpan pada {format(new Date(rec.timestamp?.toDate?.() || rec.timestamp), "d MMM, h:mm a")}</p>
                              </div>
                            </div>
                            <Popover>
                              <PopoverTrigger render={<Button variant="ghost" size="icon" className="rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />}>
                                <MoreVertical className="w-5 h-5" />
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-2" align="end">
                                <Button variant="ghost" className="w-full justify-start text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 h-9" onClick={() => deleteRecord(rec.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Padam Rekod
                                </Button>
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 underline underline-offset-4 decoration-slate-200">Refleksi</h4>
                            <p className="text-sm font-medium leading-relaxed text-slate-700 line-clamp-4 group-hover:line-clamp-none transition-all italic font-serif">
                              "{rec.formal_diary}"
                            </p>
                          </div>

                          {rec.students_involved.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity pt-2">
                              {rec.students_involved.map((s, i) => (
                                <span key={i} className="text-[9px] font-bold text-slate-500 bg-slate-100/50 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'timetable' && (
            <motion.div key="timetable" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Jadual Waktu</h2>
                  <p className="text-sm text-slate-500 font-medium tracking-tight">Atur sesi pengajaran anda secara sistematik.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    id="timetable-upload"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'timetable')}
                  />
                  <Button
                    variant="outline"
                    className="h-11 rounded-2xl font-bold border-slate-200"
                    onClick={() => document.getElementById('timetable-upload')?.click()}
                    disabled={isImporting}
                  >
                    <FileUp className="w-4 h-4 mr-2" /> Import Fail
                  </Button>
                  <Dialog>
                    <DialogTrigger render={<Button className="h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold px-6 shadow-xl shadow-blue-100" />}>
                      <Plus className="w-4 h-4 mr-2" /> Tambah Slot
                    </DialogTrigger>
                  <DialogContent className="max-w-md rounded-[2.5rem]">
                    <DialogHeader>
                      <DialogTitle>Tambah Slot Jadual</DialogTitle>
                      <DialogDescription>Masukkan butiran waktu dan subjek mengikut hari.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500 uppercase">Hari</Label>
                          <Select value={newTimetableItem.day} onValueChange={(v) => setNewTimetableItem({ ...newTimetableItem, day: v })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Tahun</Label>
                      <Select value={newTimetableItem.year} onValueChange={(v) => setNewTimetableItem({ ...newTimetableItem, year: v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-slate-500 uppercase">Kelas</Label>
                      <Select value={newTimetableItem.className} onValueChange={(v) => setNewTimetableItem({ ...newTimetableItem, className: v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl overflow-y-auto max-h-[200px]">
                          {DEFAULT_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500 uppercase">Mula</Label>
                          <Input type="time" value={newTimetableItem.startTime} onChange={(e) => setNewTimetableItem({ ...newTimetableItem, startTime: e.target.value })} className="rounded-xl" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-500 uppercase">Tamat</Label>
                          <Input type="time" value={newTimetableItem.endTime} onChange={(e) => setNewTimetableItem({ ...newTimetableItem, endTime: e.target.value })} className="rounded-xl" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase">Subjek</Label>
                        <Select value={newTimetableItem.subject} onValueChange={(v) => setNewTimetableItem({ ...newTimetableItem, subject: v })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {DEFAULT_SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddTimetable} className="w-full h-12 bg-slate-900 rounded-xl font-bold">Simpan Slot</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat"].map((day) => (
                  <div key={day} className="space-y-4">
                    <div className="bg-slate-900 py-3 px-4 rounded-2xl text-center">
                      <span className="text-xs font-black uppercase tracking-widest text-white">{day}</span>
                    </div>
                    <div className="space-y-3 min-h-[400px] p-2 bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-200">
                      {timetable.filter(t => t.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime)).map((item) => (
                        <div key={item.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 group relative">
                          <p className="text-[9px] font-black text-blue-600 mb-1">{item.startTime} - {item.endTime}</p>
                          <p className="text-xs font-bold text-slate-900 truncate">{item.subject}</p>
                          <p className="text-[10px] font-medium text-slate-400">{item.className}</p>
                          <button onClick={() => handleDeleteTimetable(item.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500 transition-opacity">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'students' && (
            <motion.div key="students" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl ring-1 ring-slate-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-blue-600 rounded-2xl">
                      <GraduationCap className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Hub <span className="text-blue-600">Strategik</span></h2>
                  </div>
                  <p className="text-sm text-slate-500 font-bold font-mono tracking-widest uppercase opacity-70">Pengurusan Profil & Analisis Perjalanan Murid</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                   <div className="relative group min-w-[240px]">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                      <Input 
                        placeholder="Cari nama murid..." 
                        className="h-12 pl-12 pr-4 rounded-2xl border-none bg-slate-100 focus-visible:ring-blue-600 font-bold text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                   </div>
                </div>
              </div>

              {/* Stats Summary Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Populasi Murid", value: students.length, icon: Users, color: "text-blue-600", bg: "bg-blue-50", onClick: () => setShowAllStudentsView(true) },
                  { label: "Kelas Strategik", value: new Set(students.map(s => s.className)).size, icon: LayoutDashboard, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "Aktif Rekod", value: new Set(records.map(r => r.className)).size, icon: Zap, color: "text-violet-600", bg: "bg-violet-50", onClick: () => setShowActiveClassesView(true) },
                  { label: "Sesi Terkini", value: records.length, icon: History, color: "text-emerald-600", bg: "bg-emerald-50" },
                ].map((stat, i) => (
                  <Card 
                    key={i} 
                    onClick={stat.onClick}
                    className={cn(
                      "border-none shadow-sm p-8 rounded-[2rem] transition-all group overflow-hidden relative",
                      stat.bg,
                      stat.onClick ? "cursor-pointer hover:shadow-xl hover:-translate-y-1" : ""
                    )}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={cn("p-4 rounded-2xl bg-white shadow-sm group-hover:scale-110 transition-transform", stat.color)}>
                        <stat.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{stat.label}</p>
                        <h4 className="text-3xl font-black text-slate-900 leading-tight">{stat.value}</h4>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Side Control: Filter & Import */}
                <div className="lg:col-span-4 space-y-6">
                   <Card className="border-none shadow-2xl bg-slate-900 text-white rounded-[2.5rem] p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                        <FileUp className="w-20 h-20" />
                      </div>
                      <div className="relative z-10 space-y-8">
                        <div className="space-y-4">
                           <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">Pusat Kawalan Hub</p>
                              <Badge className="bg-blue-600/20 text-blue-300 border-none">SMART AI</Badge>
                           </div>
                           
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tahun</Label>
                                <Select value={selectedYearForStudents} onValueChange={setSelectedYearForStudents}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white/5 border-white/10 text-white font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kelas</Label>
                                <Select value={selectedClassForStudents} onValueChange={setSelectedClassForStudents}>
                                  <SelectTrigger className="h-10 rounded-xl bg-white/5 border-white/10 text-white font-bold"><SelectValue /></SelectTrigger>
                                  <SelectContent className="rounded-xl overflow-y-auto max-h-[300px]">
                                    {(YEAR_CLASSES[selectedYearForStudents] || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                           </div>

                           <Button 
                              onClick={() => document.getElementById('student-upload-new')?.click()}
                              disabled={isImporting}
                              className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-95"
                            >
                              {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FilePlus className="w-4 h-4 mr-2" />} 
                              Import Senarai
                           </Button>
                           <input type="file" id="student-upload-new" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'students')} />
                        </div>

                        <Separator className="bg-white/10" />

                        <div className="space-y-4">
                           <Label className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Kemasukan Pukal</Label>
                           <Textarea 
                              placeholder="Masukkan nama murid setiap baris..." 
                              value={bulkStudentInput} 
                              onChange={(e) => setBulkStudentInput(e.target.value)}
                              className="rounded-2xl min-h-[140px] bg-white/5 border-white/10 text-white text-xs font-medium placeholder:text-slate-600 focus:ring-blue-600"
                           />
                           <Button onClick={handleBulkAddStudents} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px]">
                              Sahkan Senarai
                           </Button>
                        </div>

                        <Separator className="bg-white/10" />

                        <div className="pt-4">
                           <Button 
                              variant={resetConfirmStep === 1 ? "destructive" : "outline"} 
                              onClick={handleResetData}
                              disabled={isResetting}
                              className={cn(
                                "w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-300",
                                resetConfirmStep === 1 
                                  ? "bg-red-600 text-white animate-pulse" 
                                  : "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white"
                              )}
                           >
                              {isResetting ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : resetConfirmStep === 1 ? (
                                <RotateCcw className="w-4 h-4 mr-2" />
                              ) : (
                                <RotateCcw className="w-4 h-4 mr-2" />
                              )}
                              {isResetting ? "Membersihkan..." : resetConfirmStep === 1 ? "Sahkan Pemadaman" : "Reset Sistem"}
                           </Button>
                           <p className="text-[9px] text-slate-500 mt-2 text-center italic">
                              {resetConfirmStep === 1 ? "AWAS: Tindakan ini tidak boleh diundur!" : "Berhati-hati: Memadam semua data!"}
                           </p>
                        </div>
                      </div>
                   </Card>
                </div>

                {/* Main Content: Student Explorer / Profile */}
                <div className="lg:col-span-8 space-y-6">
                  {selectedStudentForDashboardMurid ? (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                       <Card className="border-none shadow-2xl bg-white rounded-[3rem] p-8 overflow-hidden relative">
                          <div className="absolute top-0 right-0 p-12 opacity-5 -mr-8 -mt-8">
                             <GraduationCap className="w-40 h-40 text-slate-900" />
                          </div>
                          
                          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-100">
                             <div className="space-y-4">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedStudentForDashboardMurid(null)} className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
                                   <ChevronLeft className="w-3 h-3 mr-1" /> Kembali ke Senarai
                                </Button>
                                <div>
                                   <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-4xl font-black tracking-tighter text-slate-900">{selectedStudentForDashboardMurid}</h3>
                                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <Badge className="bg-blue-100 text-blue-700 border-none rounded-lg text-[9px] font-black">
                                         {students.find(s => s.name === selectedStudentForDashboardMurid)?.year || "TIADA TAHUN"}
                                      </Badge>
                                      <Badge className="bg-slate-100 text-slate-600 border-none rounded-lg text-[9px] font-black">
                                         {students.find(s => s.name === selectedStudentForDashboardMurid)?.className || "TIADA KELAS"}
                                      </Badge>
                                   </div>
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                <div className="text-right">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Laporan</p>
                                   <p className="text-2xl font-black text-slate-900">{records.filter(r => r.students_involved.includes(selectedStudentForDashboardMurid!)).length}</p>
                                </div>
                                <div className="text-right">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Impak</p>
                                   <Badge className="bg-emerald-100 text-emerald-700 border-none rounded-lg text-[9px] font-black">KONSTISTEN</Badge>
                                </div>
                             </div>
                          </div>

                          <div className="mt-10 space-y-8">
                             <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">Perjalanan PdP</span>
                                <Separator className="flex-1" />
                             </div>
                             
                             <div className="space-y-6 relative before:absolute before:left-[19px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100 before:content-['']">
                                {records.filter(r => r.students_involved.includes(selectedStudentForDashboardMurid!)).length > 0 ? (
                                  records
                                    .filter(r => r.students_involved.includes(selectedStudentForDashboardMurid!))
                                    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                    .map((rec, i) => (
                                      <motion.div 
                                        key={i} 
                                        initial={{ opacity: 0, x: -10 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        transition={{ delay: i * 0.1 }}
                                        className="relative pl-12 group"
                                      >
                                        <div className="absolute left-0 top-1 w-10 h-10 bg-white border-2 border-slate-100 rounded-2xl flex items-center justify-center z-10 group-hover:border-blue-500 group-hover:scale-110 transition-all shadow-sm">
                                           <div className="w-2 h-2 bg-slate-300 rounded-full group-hover:bg-blue-600 transition-colors" />
                                        </div>
                                        <Card className="p-6 border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] bg-white group-hover:shadow-xl transition-all">
                                           <div className="flex justify-between items-center mb-4">
                                              <div className="flex flex-col">
                                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(rec.date), "dd MMMM yyyy")}</span>
                                                 <span className="text-sm font-black text-slate-900">{rec.subject}</span>
                                              </div>
                                              <Badge className="bg-blue-600 text-white rounded-lg text-[9px] font-black tracking-widest">{rec.className}</Badge>
                                           </div>
                                           <p className="text-sm text-slate-600 font-serif italic leading-relaxed">"{rec.formal_diary}"</p>
                                        </Card>
                                      </motion.div>
                                    ))
                                ) : (
                                  <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem]">
                                     <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tiada Rekod Linkage</p>
                                  </div>
                                )}
                             </div>
                          </div>
                       </Card>
                    </motion.div>
                  ) : (
                    <div className="space-y-12">
                       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-4 bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                          <div className="space-y-1">
                             <h4 className="text-2xl font-black text-slate-900 tracking-tight underline decoration-blue-500 decoration-4 underline-offset-8">Eksplorasi Profil Murid</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sila pilih Tahun & Kelas untuk memaparkan senarai</p>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm ring-1 ring-slate-100">
                             <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Pilih Tahun</Label>
                                <Select value={selectedYearForStudents} onValueChange={setSelectedYearForStudents}>
                                   <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl">
                                      {YEARS.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             </div>
                             <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase text-slate-400 ml-1">Pilih Kelas</Label>
                                <Select value={selectedClassForStudents} onValueChange={setSelectedClassForStudents}>
                                   <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs"><SelectValue /></SelectTrigger>
                                   <SelectContent className="rounded-xl max-h-[200px]">
                                      {(YEAR_CLASSES[selectedYearForStudents] || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                   </SelectContent>
                                </Select>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-12">
                          {(() => {
                             const filteredStudents = students.filter(s => 
                                s.year === selectedYearForStudents && 
                                s.className === selectedClassForStudents && 
                                (searchQuery === "" || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                             );

                             if (!selectedYearForStudents || !selectedClassForStudents) return null;

                             return (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                                   <div className="flex items-center justify-between px-2">
                                      <div className="flex items-center gap-3">
                                         <Badge className="bg-slate-900 text-white rounded-lg px-4 py-1.5 font-black text-xs uppercase tracking-widest">{selectedYearForStudents}</Badge>
                                         <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 rounded-lg px-4 py-1.5 font-black text-xs uppercase tracking-widest">{selectedClassForStudents}</Badge>
                                      </div>
                                      <div className="text-right">
                                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Murid</p>
                                         <p className="text-2xl font-black text-slate-900">{filteredStudents.length}</p>
                                      </div>
                                   </div>

                                   {filteredStudents.length > 0 ? (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                                         {filteredStudents.sort((a,b) => a.name.localeCompare(b.name)).map((s, idx) => (
                                            <Card 
                                               key={s.id} 
                                               onClick={() => setSelectedStudentForDashboardMurid(s.name)}
                                               className="group p-5 bg-white border-none shadow-sm ring-1 ring-slate-100 rounded-[2rem] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex items-center justify-between"
                                            >
                                               <div className="flex items-center gap-4">
                                                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all text-xs">
                                                     {idx + 1}
                                                  </div>
                                                  <div className="min-w-0">
                                                     <h5 className="font-black text-slate-900 text-[11px] uppercase truncate tracking-tight">{s.name}</h5>
                                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {records.filter(r => r.students_involved.includes(s.name)).length} Rekod Impak
                                                     </p>
                                                  </div>
                                               </div>
                                               <div className="flex items-center gap-2">
                                                  <Button 
                                                     variant="ghost" 
                                                     size="icon" 
                                                     className="w-8 h-8 rounded-lg text-slate-200 hover:text-red-500 hover:bg-red-50"
                                                     onClick={(e) => { e.stopPropagation(); if(confirm("Padam data murid ini?")) handleDeleteStudent(s.id); }}
                                                  >
                                                     <Trash2 className="w-3.5 h-3.5" />
                                                  </Button>
                                                  <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                                               </div>
                                            </Card>
                                         ))}
                                      </div>
                                   ) : (
                                      <div className="py-32 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
                                         <Users className="w-12 h-12 text-slate-200 mx-auto mb-4 opacity-40" />
                                         <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Tiada Rekod Ditemui Untuk Unit Ini</p>
                                         {students.length === 0 && (
                                            <p className="text-[10px] text-slate-400 mt-2 italic font-medium">Sila muat naik pangkalan data anda di panel sebelah kiri.</p>
                                         )}
                                      </div>
                                   )}
                                </motion.div>
                             );
                          })()}
                       </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-6 py-8 text-center bg-slate-50 border-t border-slate-100 mt-20 rounded-t-[3rem]">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">E-Impak &copy; {new Date().getFullYear()}</p>
        <p className="text-slate-900 text-sm font-black mt-2 tracking-tight">by Zubair Sofian</p>
      </footer>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
