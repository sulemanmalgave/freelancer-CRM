import React, { useState, useRef, useEffect } from "react";
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
  FolderOpen
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

export default function NotesRecordsView({
  records,
  clients,
  profile,
  initialClientIdFilter,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
}: NotesRecordsViewProps) {
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
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  // Calculate real metrics
  const totalRecordsCount = records.length;
  const notesCount = records.filter((r) => r.type === "note").length;
  const voiceCount = records.filter((r) => r.type === "voice_recording").length;
  const clientsWithRecordsCount = new Set(records.map((r) => r.clientId)).size;

  // Filter & Search Logic
  const filteredRecords = records.filter((r) => {
    const client = clientMap.get(r.clientId);
    const clientName = client ? `${client.companyName} ${client.contactPerson}`.toLowerCase() : "";

    const matchesSearch =
      clientName.includes(searchTerm.toLowerCase()) ||
      (r.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.content || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = typeFilter === "All" || r.type === typeFilter;
    const matchesClient = clientFilter === "All" || r.clientId === clientFilter;

    return matchesSearch && matchesType && matchesClient;
  });

  // Sort Logic
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortOrder === "Newest" ? timeB - timeA : timeA - timeB;
  });

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
    resetNoteForm();
    setIsAddingNote(true);
  };

  const handleOpenAddVoice = () => {
    resetVoiceForm();
    setIsAddingVoice(true);
  };

  // Handle Audio File Selection
  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Max size limit check e.g. 15MB
      if (file.size > 15 * 1024 * 1024) {
        alert("Please restrict audio files to 15MB maximum.");
        return;
      }

      setSelectedAudioFile(file);
      setIsReadingAudio(true);

      // Measure duration
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
  const handleConfirmDelete = () => {
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
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Notes & Records</span>
          </h2>
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
          </button>
          <button
            onClick={handleOpenAddVoice}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/10 transition-all hover:-translate-y-0.5 cursor-pointer"
          >
            <Mic size={14} />
            <span>Add Voice Recording</span>
          </button>
        </div>
      </div>

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
            </button>
            <button
              onClick={handleOpenAddVoice}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/10 transition-all cursor-pointer"
            >
              <Mic size={14} />
              <span>Add Voice Recording</span>
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
        <div className="space-y-4">
          {sortedRecords.map((record) => {
            const client = clientMap.get(record.clientId);
            const clientDisplayName = client
              ? `${client.companyName} (${client.contactPerson})`
              : "Unknown Client";

            return (
              <motion.div
                layout
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
                      onClick={() => setDeletingRecordId(record.id)}
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
        </div>
      )}

      {/* Add Note Modal */}
      <AnimatePresence>
        {isAddingNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
          </div>
        )}
      </AnimatePresence>

      {/* Add Voice Recording Modal */}
      <AnimatePresence>
        {isAddingVoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
          </div>
        )}
      </AnimatePresence>

      {/* Edit Record Modal */}
      <AnimatePresence>
        {editingRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRecordId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
