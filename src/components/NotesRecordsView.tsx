import React, { useState, useRef, useEffect, useMemo, memo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Mic,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  User,
  X,
  AlertCircle,
  FileAudio,
  CheckCircle2,
  Notebook,
  FolderOpen,
  Sparkles,
  Lock
} from "lucide-react";
import { NoteRecord, Client, FreelancerProfile } from "../types";

interface NotesRecordsViewProps {
  records: NoteRecord[];
  clients: Client[];
  profile: FreelancerProfile;
  initialClientIdFilter?: string;
  onAddRecord: (record: Omit<NoteRecord, "id" | "freelancerId" | "createdAt" | "updatedAt">) => void;
  onUpdateRecord: (id: string, record: Partial<NoteRecord>) => void;
  onDeleteRecord: (id: string) => void;
  onTriggerUpgrade?: (reason: string) => void;
}

// Custom Audio Player Component
function VoicePlayer({ src, fileName, durationSeconds }: { src?: string; fileName?: string; durationSeconds?: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (durationSeconds && durationSeconds > 0) {
      setDuration(durationSeconds);
    }
  }, [durationSeconds]);

  const togglePlay = () => {
    if (!audioRef.current || !src) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Playback error:", err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration && !isNaN(audioRef.current.duration)) {
      setDuration(Math.round(audioRef.current.duration));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  if (!src) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs flex items-center gap-2">
        <AlertCircle size={14} />
        <span>Audio file unavailable or corrupted.</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-inner space-y-2 select-none">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        preload="metadata"
      />

      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>

        {/* File Details and Progress */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
            <span className="truncate max-w-[180px] font-mono text-slate-200" title={fileName}>
              {fileName || "Audio Recording"}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Progress Bar */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none"
          />
        </div>

        {/* Volume Toggle */}
        <button
          type="button"
          onClick={toggleMute}
          className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
}

function NotesRecordsView({
  records,
  clients,
  profile,
  initialClientIdFilter,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  onTriggerUpgrade,
}: NotesRecordsViewProps) {
  const isPro =
    profile.premium === true ||
    profile.plan === "Pro" ||
    profile.plan === "Monthly" ||
    profile.plan === "Annual" ||
    profile.plan === "3 Months" ||
    (profile.plan !== undefined && profile.plan !== "Free");

  // Pro Upgrade Prompt state: "notes" | "voice" | "records" | null
  const [proPromptType, setProPromptType] = useState<"notes" | "voice" | "records" | null>(null);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "note" | "voice_recording">("All");
  const [clientFilter, setClientFilter] = useState<string>(initialClientIdFilter || "All");
  const [sortOrder, setSortOrder] = useState<"Newest" | "Oldest">("Newest");

  // Sync initialClientIdFilter if passed from navigation
  useEffect(() => {
    if (initialClientIdFilter) {
      setClientFilter(initialClientIdFilter);
    }
  }, [initialClientIdFilter]);

  // Modal triggers
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingVoice, setIsAddingVoice] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NoteRecord | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Form Fields - Note
  const [noteClientId, setNoteClientId] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // Form Fields - Voice Recording
  const [voiceClientId, setVoiceClientId] = useState("");
  const [voiceTitle, setVoiceTitle] = useState("");
  const [voiceDescription, setVoiceDescription] = useState("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [audioFileBase64, setAudioFileBase64] = useState<string>("");
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [isReadingAudio, setIsReadingAudio] = useState(false);

  // Helper map for client names
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  // Calculate real metrics
  const { totalRecordsCount, notesCount, voiceCount, clientsWithRecordsCount } = useMemo(() => {
    return {
      totalRecordsCount: records.length,
      notesCount: records.filter((r) => r.type === "note").length,
      voiceCount: records.filter((r) => r.type === "voice_recording").length,
      clientsWithRecordsCount: new Set(records.map((r) => r.clientId)).size,
    };
  }, [records]);

  // Filter & Search Logic
  const sortedRecords = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = records.filter((r) => {
      const client = clientMap.get(r.clientId);
      const clientName = client ? `${client.companyName} ${client.contactPerson}`.toLowerCase() : "";

      const matchesSearch =
        clientName.includes(term) ||
        (r.title || "").toLowerCase().includes(term) ||
        (r.content || "").toLowerCase().includes(term) ||
        (r.description || "").toLowerCase().includes(term);

      const matchesType = typeFilter === "All" || r.type === typeFilter;
      const matchesClient = clientFilter === "All" || r.clientId === clientFilter;

      return matchesSearch && matchesType && matchesClient;
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === "Newest" ? timeB - timeA : timeA - timeB;
    });
  }, [records, clientMap, searchTerm, typeFilter, clientFilter, sortOrder]);

  // Reset Note Form
  const resetNoteForm = () => {
    setNoteClientId(clients.length > 0 ? clients[0].id : "");
    setNoteTitle("");
    setNoteContent("");
  };

  // Reset Voice Form
  const resetVoiceForm = () => {
    setVoiceClientId(clients.length > 0 ? clients[0].id : "");
    setVoiceTitle("");
    setVoiceDescription("");
    setSelectedAudioFile(null);
    setAudioFileBase64("");
    setAudioDuration(0);
    setIsReadingAudio(false);
  };

  const handleOpenAddNote = () => {
    if (!isPro) {
      setProPromptType("notes");
      return;
    }
    resetNoteForm();
    setIsAddingNote(true);
  };

  const handleOpenAddVoice = () => {
    if (!isPro) {
      setProPromptType("voice");
      return;
    }
    resetVoiceForm();
    setIsAddingVoice(true);
  };

  // Handle Audio File Selection
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPro) {
      setProPromptType("voice");
      return;
    }
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Max size limit check e.g. 15MB
      if (file.size > 15 * 1024 * 1024) {
        alert("Please restrict audio files to 15MB maximum.");
        return;
      }

      setSelectedAudioFile(file);
      setIsReadingAudio(true);

      // Measure duration safely
      try {
        if (typeof window !== "undefined" && typeof Audio !== "undefined") {
          const audioObj = new Audio();
          const objectUrl = URL.createObjectURL(file);
          audioObj.src = objectUrl;
          audioObj.onloadedmetadata = () => {
            const dur = audioObj.duration;
            URL.revokeObjectURL(objectUrl);
            setAudioDuration(isNaN(dur) || !isFinite(dur) ? 0 : Math.round(dur));
          };
          audioObj.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            setAudioDuration(0);
          };
        }
      } catch (err) {
        console.warn("Audio duration calculation not supported in environment:", err);
      }

      // Read file to Base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setAudioFileBase64(result);
        }
        setIsReadingAudio(false);
      };
      reader.onerror = () => {
        alert("Failed to read audio file format.");
        setIsReadingAudio(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Add Note
  const handleSubmitAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPro) {
      setProPromptType("notes");
      return;
    }
    if (!noteClientId) {
      alert("Please select a client.");
      return;
    }
    if (!noteContent.trim()) {
      alert("Note content is required.");
      return;
    }

    onAddRecord({
      clientId: noteClientId,
      type: "note",
      title: noteTitle.trim() || undefined,
      content: noteContent.trim(),
    });

    setIsAddingNote(false);
    resetNoteForm();
  };

  // Submit Add Voice
  const handleSubmitAddVoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPro) {
      setProPromptType("voice");
      return;
    }
    if (!voiceClientId) {
      alert("Please select a client.");
      return;
    }
    if (!audioFileBase64 || !selectedAudioFile) {
      alert("Please select a valid audio file.");
      return;
    }

    const fileSizeStr = (selectedAudioFile.size / (1024 * 1024)).toFixed(2) + " MB";

    onAddRecord({
      clientId: voiceClientId,
      type: "voice_recording",
      title: voiceTitle.trim() || undefined,
      description: voiceDescription.trim() || undefined,
      audioFileName: selectedAudioFile.name,
      audioFileType: selectedAudioFile.type || "audio/mp3",
      audioFileSize: fileSizeStr,
      audioFileUrl: audioFileBase64,
      duration: audioDuration,
    });

    setIsAddingVoice(false);
    resetVoiceForm();
  };

  // Start Edit
  const handleStartEdit = (record: NoteRecord) => {
    if (!isPro) {
      setProPromptType("records");
      return;
    }
    setEditingRecord(record);
    if (record.type === "note") {
      setNoteClientId(record.clientId);
      setNoteTitle(record.title || "");
      setNoteContent(record.content || "");
    } else {
      setVoiceClientId(record.clientId);
      setVoiceTitle(record.title || "");
      setVoiceDescription(record.description || "");
      setSelectedAudioFile(null);
      setAudioFileBase64(record.audioFileUrl || "");
      setAudioDuration(record.duration || 0);
    }
  };

  // Submit Edit
  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPro) {
      setProPromptType("records");
      return;
    }
    if (!editingRecord) return;

    if (editingRecord.type === "note") {
      if (!noteClientId) return;
      if (!noteContent.trim()) {
        alert("Note content is required.");
        return;
      }
      onUpdateRecord(editingRecord.id, {
        clientId: noteClientId,
        title: noteTitle.trim() || undefined,
        content: noteContent.trim(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      if (!voiceClientId) return;
      onUpdateRecord(editingRecord.id, {
        clientId: voiceClientId,
        title: voiceTitle.trim() || undefined,
        description: voiceDescription.trim() || undefined,
        ...(audioFileBase64 ? { audioFileUrl: audioFileBase64 } : {}),
        ...(selectedAudioFile ? { audioFileName: selectedAudioFile.name, audioFileSize: (selectedAudioFile.size / (1024 * 1024)).toFixed(2) + " MB" } : {}),
        ...(audioDuration > 0 ? { duration: audioDuration } : {}),
        updatedAt: new Date().toISOString(),
      });
    }

    setEditingRecord(null);
  };

  // Delete Handler
  const handleStartDelete = (id: string) => {
    if (!isPro) {
      setProPromptType("records");
      return;
    }
    setDeletingRecordId(id);
  };

  const handleConfirmDelete = () => {
    if (!isPro) {
      setProPromptType("records");
      return;
    }
    if (deletingRecordId) {
      onDeleteRecord(deletingRecordId);
      setDeletingRecordId(null);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
        " • " +
        d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Notes & Records
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-md shadow-xs shadow-indigo-500/20">
              PRO
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Keep important client notes, conversations and records organized.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddNote}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Note</span>
            {!isPro && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-white/20 text-white rounded">
                PRO
              </span>
            )}
          </button>
          <button
            onClick={handleOpenAddVoice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/10 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Mic size={14} />
            <span>Add Voice Recording</span>
            {!isPro && (
              <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-white/20 text-white rounded">
                PRO
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Free Plan Pro Capabilities Overview Banner */}
      {!isPro && (
        <div className="p-4 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-slate-50 border border-indigo-100/90 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/20 shrink-0">
              <Notebook size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">Notes & Records — Pro Feature</h3>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white rounded-md">
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                Centralize your meeting discussions, audio recordings, project briefs, and key client insights in one accessible workspace.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] font-semibold text-slate-700">
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Client Notes
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Important Records
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Voice Recordings
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Client-linked Records
                </span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 size={13} className="text-emerald-600" /> Search & Filters
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setProPromptType("notes");
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/15 transition-all hover:scale-[1.02] active:scale-95 shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles size={13} />
            <span>Unlock Pro Access</span>
          </button>
        </div>
      )}

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 glass-panel rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Total Records</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Notebook size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{totalRecordsCount}</p>
        </div>

        <div className="p-4 glass-panel rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Notes</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <FileText size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{notesCount}</p>
        </div>

        <div className="p-4 glass-panel rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Voice Recordings</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Mic size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{voiceCount}</p>
        </div>

        <div className="p-4 glass-panel rounded-2xl border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Clients With Records</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <User size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900">{clientsWithRecordsCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 glass-panel rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by client, title, or record content..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs py-2 px-3 pl-9 glass-input rounded-xl focus:outline-none text-slate-800"
            />
          </div>

          {/* Filter controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl text-xs">
              {(["All", "note", "voice_recording"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    typeFilter === t
                      ? "bg-white text-indigo-650 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t === "All" ? "All" : t === "note" ? "Notes" : "Voice Recordings"}
                </button>
              ))}
            </div>

            {/* Client Filter */}
            <div className="relative">
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="text-xs py-1.5 px-3 glass-input rounded-xl focus:outline-none text-slate-800 font-semibold cursor-pointer pr-8"
              >
                <option value="All">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} ({c.contactPerson})
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="text-xs py-1.5 px-3 glass-input rounded-xl focus:outline-none text-slate-800 font-semibold cursor-pointer"
            >
              <option value="Newest">Newest First</option>
              <option value="Oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {/* Active Client Filter Pill if filtered */}
        {clientFilter !== "All" && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-medium">Filtered by client:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
              <span>{clientMap.get(clientFilter)?.companyName || "Selected Client"}</span>
              <button
                onClick={() => setClientFilter("All")}
                className="hover:text-indigo-950 p-0.5 rounded-full cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Empty State / No Records */}
      {totalRecordsCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 mb-3">
            <Notebook className="w-10 h-10" />
          </div>
          <h4 className="font-bold text-slate-800 text-base">No notes or recordings yet.</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Keep important client information and conversations organized in one place.
          </p>
          <div className="flex items-center gap-2.5 mt-5">
            <button
              onClick={handleOpenAddNote}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Note</span>
              {!isPro && (
                <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-white/20 text-white rounded">
                  PRO
                </span>
              )}
            </button>
            <button
              onClick={handleOpenAddVoice}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
            >
              <Mic size={14} />
              <span>Add Voice Recording</span>
              {!isPro && (
                <span className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-white/20 text-white rounded">
                  PRO
                </span>
              )}
            </button>
          </div>
        </div>
      ) : sortedRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 glass-panel rounded-2xl text-center">
          <Search className="w-10 h-10 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800">No records found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            No notes or recordings match your current search queries or filter selections.
          </p>
          <button
            onClick={() => {
              setSearchTerm("");
              setTypeFilter("All");
              setClientFilter("All");
            }}
            className="mt-4 px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Records List */
        <motion.div layout className="space-y-4">
          <AnimatePresence mode="popLayout">
            {sortedRecords.map((record) => {
              const client = clientMap.get(record.clientId);
              const clientDisplayName = client
                ? `${client.companyName} (${client.contactPerson})`
                : "Unknown Client";

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  key={record.id}
                  className="p-5 glass-panel glass-highlight rounded-2xl space-y-3 hover:border-indigo-300 transition-all border border-white/20"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-3">
                    <div className="flex items-center gap-2.5">
                      {record.type === "note" ? (
                        <span className="p-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-xs flex items-center gap-1 font-bold">
                          <FileText size={14} />
                          <span>Note</span>
                        </span>
                      ) : (
                        <span className="p-1.5 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg text-xs flex items-center gap-1 font-bold">
                          <Mic size={14} />
                          <span>Voice Recording</span>
                        </span>
                      )}

                      <h3 className="font-bold text-slate-800 text-sm">
                        {record.title || (record.type === "note" ? "Untitled Note" : "Voice Recording")}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock size={12} />
                        <span>{formatDate(record.createdAt)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Client Reference */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                    <User size={13} className="text-slate-400" />
                    <span>Client:</span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                      {clientDisplayName}
                    </span>
                  </div>

                  {/* Record Content / Audio Player */}
                  {record.type === "note" ? (
                    <div className="p-3.5 bg-slate-500/5 rounded-xl border border-slate-200/40">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {record.content}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {record.description && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          "{record.description}"
                        </p>
                      )}

                      {/* Metadata pills */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono">
                        {record.audioFileName && (
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md">File: {record.audioFileName}</span>
                        )}
                        {record.audioFileSize && (
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md">Size: {record.audioFileSize}</span>
                        )}
                      </div>

                      {/* Voice Audio Player */}
                      <VoicePlayer
                        src={record.audioFileUrl}
                        fileName={record.audioFileName}
                        durationSeconds={record.duration}
                      />
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-black/5">
                    <span className="text-[10px] text-slate-400">
                      {record.updatedAt ? `Updated: ${new Date(record.updatedAt).toLocaleDateString()}` : ""}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(record)}
                        className="p-1 px-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartDelete(record.id)}
                        className="p-1 px-2.5 border border-red-200 text-red-500 hover:text-white hover:bg-red-500 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add Note Modal */}
      <AnimatePresence>
        {isAddingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <FileText className="text-indigo-600" size={16} />
                  <span>Add New Client Note</span>
                </h3>
                <button
                  onClick={() => setIsAddingNote(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {clients.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-semibold">
                    No clients found. You need to add at least one client before creating notes.
                  </p>
                  <button
                    onClick={() => setIsAddingNote(false)}
                    className="py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitAddNote} className="p-5 space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Client *</label>
                    <select
                      required
                      value={noteClientId}
                      onChange={(e) => setNoteClientId(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.contactPerson})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Note Title (Optional)</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                      placeholder="e.g. Website Requirements Discussion"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Note Content *</label>
                    <textarea
                      required
                      rows={5}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none resize-none"
                      placeholder="Type important client notes, meeting points, preferences, or task ideas..."
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingNote(false)}
                      className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Voice Recording Modal */}
      <AnimatePresence>
        {isAddingVoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Mic className="text-emerald-600" size={16} />
                  <span>Upload Voice Recording</span>
                </h3>
                <button
                  onClick={() => setIsAddingVoice(false)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {clients.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="text-xs text-slate-600 font-semibold">
                    No clients found. You need to add at least one client before uploading recordings.
                  </p>
                  <button
                    onClick={() => setIsAddingVoice(false)}
                    className="py-2 px-4 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitAddVoice} className="p-5 space-y-4 text-sm">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Client *</label>
                    <select
                      required
                      value={voiceClientId}
                      onChange={(e) => setVoiceClientId(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none cursor-pointer"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} ({c.contactPerson})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Recording Title (Optional)</label>
                    <input
                      type="text"
                      value={voiceTitle}
                      onChange={(e) => setVoiceTitle(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                      placeholder="e.g. Call About Scope & Delivery Date"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Description (Optional)</label>
                    <textarea
                      rows={2}
                      value={voiceDescription}
                      onChange={(e) => setVoiceDescription(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none resize-none"
                      placeholder="Brief summary of what was discussed in the recording..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Audio File * (MP3, WAV, M4A, AAC, OGG)</label>
                    <input
                      type="file"
                      required
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                      onChange={handleAudioFileChange}
                      className="w-full text-xs py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                  </div>

                  {/* Audio File Preview Box */}
                  {selectedAudioFile && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="truncate">{selectedAudioFile.name}</span>
                      </div>
                      <div className="text-[10px] text-emerald-700 flex justify-between font-mono">
                        <span>Size: {(selectedAudioFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>Duration: {audioDuration > 0 ? `${Math.floor(audioDuration / 60)}m ${audioDuration % 60}s` : "Detecting..."}</span>
                      </div>
                    </div>
                  )}

                  {isReadingAudio && (
                    <p className="text-xs text-indigo-600 font-semibold text-center animate-pulse">
                      Processing audio file...
                    </p>
                  )}

                  <div className="flex gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingVoice(false)}
                      className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isReadingAudio || !audioFileBase64}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Save Recording
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Record Modal */}
      <AnimatePresence>
        {editingRecord && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md glass-modal rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Edit3 className="text-indigo-600" size={16} />
                  <span>Edit {editingRecord.type === "note" ? "Note" : "Voice Recording"}</span>
                </h3>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmitEdit} className="p-5 space-y-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Client *</label>
                  <select
                    required
                    value={editingRecord.type === "note" ? noteClientId : voiceClientId}
                    onChange={(e) =>
                      editingRecord.type === "note"
                        ? setNoteClientId(e.target.value)
                        : setVoiceClientId(e.target.value)
                    }
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName} ({c.contactPerson})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingRecord.type === "note" ? noteTitle : voiceTitle}
                    onChange={(e) =>
                      editingRecord.type === "note" ? setNoteTitle(e.target.value) : setVoiceTitle(e.target.value)
                    }
                    className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none"
                    placeholder="Title..."
                  />
                </div>

                {editingRecord.type === "note" ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Note Content *</label>
                    <textarea
                      required
                      rows={5}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none resize-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={voiceDescription}
                      onChange={(e) => setVoiceDescription(e.target.value)}
                      className="w-full py-2 px-3 glass-input rounded-xl text-slate-800 focus:outline-none resize-none"
                    />
                  </div>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingRecord(null)}
                    className="flex-1 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRecordId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-100 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 mx-auto flex items-center justify-center">
                <Trash2 size={24} />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900">Delete this record?</h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">This action cannot be undone.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setDeletingRecordId(null)}
                  className="flex-1 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pro Feature Gating Modal */}
      <AnimatePresence>
        {proPromptType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 14 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              {/* Header Banner */}
              <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 p-6 text-white text-center relative">
                <button
                  type="button"
                  onClick={() => setProPromptType(null)}
                  className="absolute top-4 right-4 p-1 text-white/75 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="w-12 h-12 bg-white/15 rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-inner">
                  {proPromptType === "voice" ? (
                    <Mic className="w-6 h-6 text-amber-300 animate-pulse" />
                  ) : (
                    <Notebook className="w-6 h-6 text-amber-300 animate-pulse" />
                  )}
                </div>
                <span className="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest bg-white/20 text-white rounded-full mb-1.5 border border-white/20">
                  PRO FEATURE
                </span>
                <h3 className="text-xl font-black text-white tracking-tight">
                  {proPromptType === "voice" ? "Voice Recording" : "Notes & Records"}
                </h3>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <p className="text-xs text-slate-600 leading-relaxed text-center font-medium">
                  {proPromptType === "voice"
                    ? "Voice Recording is a Pro feature. Upgrade to Pro to record and organize client conversations and notes."
                    : "Keep your client notes and important records organized in one place."}
                </p>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    With Freelancer CRM Pro you can:
                  </span>
                  <div className="space-y-2 text-xs font-semibold text-slate-700">
                    {proPromptType === "voice" ? (
                      <>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Record and upload audio notes</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Store meeting conversations</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Link voice memos to clients</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Access & playback recordings anytime</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Create client notes</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Store important records</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Organize notes by client</span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-700">
                          <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                          <span>Access your records easily</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const reason = proPromptType === "voice" ? "voice_recording" : "notes_records";
                      setProPromptType(null);
                      if (onTriggerUpgrade) {
                        onTriggerUpgrade(reason);
                      }
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.01] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>Upgrade to Pro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProPromptType(null)}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(NotesRecordsView);
