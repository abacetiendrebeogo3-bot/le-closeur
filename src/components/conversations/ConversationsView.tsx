import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  Send, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Tag, 
  DollarSign, 
  User, 
  Bot, 
  UserCheck, 
  Info, 
  ChevronLeft, 
  ChevronRight,
  Paperclip,
  Loader2,
  Mic,
  Square,
  Trash2
} from "lucide-react";
import { Conversation, Customer } from "../../types";
import { gsap } from "gsap";
import { supabase } from "../../lib/supabase/client";

interface ConversationsViewProps {
  conversations: Conversation[];
  setConversations?: React.Dispatch<React.SetStateAction<Conversation[]>>;
  customers?: Customer[];
  activeChatId: number | null;
  setActiveChatId: (id: number | null) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  toggleTakeover: () => void;
  triggerToast: (msg: string, type?: "success" | "warning" | "info") => void;
  ownerName?: string;
}

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  conversations,
  setConversations,
  customers = [],
  activeChatId,
  setActiveChatId,
  chatInput,
  setChatInput,
  handleSendMessage,
  toggleTakeover,
  triggerToast,
  ownerName
}) => {
  const activeChat = conversations.find(c => c.id === activeChatId);
  const [showCustomerSidebar, setShowCustomerSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recorderRef = useRef<any>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [engagementFilter, setEngagementFilter] = useState<string>("all");
  const [showDeleteConfirmChat, setShowDeleteConfirmChat] = useState<number | null>(null);

  const handleDeleteChat = async (id: number) => {
    try {
      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      if (setConversations) {
        setConversations(prev => prev.filter(c => c.id !== id));
      }
      if (activeChatId === id) {
        setActiveChatId(null);
      }
      triggerToast("La conversation a été supprimée.", "success");
    } catch (err: any) {
      triggerToast(`Erreur : ${err.message}`, "warning");
    } finally {
      setShowDeleteConfirmChat(null);
    }
  };

  useEffect(() => {
    import("mic-recorder-to-mp3").then((mod) => {
      const MicRecorder = mod.default || mod;
      recorderRef.current = new MicRecorder({ bitRate: 128 });
    }).catch(err => {
      console.error("Error initializing mic-recorder-to-mp3:", err);
    });
  }, []);

  const startRecording = async () => {
    if (!recorderRef.current) {
      try {
        const mod = await import("mic-recorder-to-mp3");
        const MicRecorder = mod.default || mod;
        recorderRef.current = new MicRecorder({ bitRate: 128 });
      } catch (err) {
        console.error("Error initializing mic-recorder-to-mp3 on-demand:", err);
        triggerToast("Le micro-enregistreur n'est pas initialisé", "warning");
        return;
      }
    }
    try {
      await recorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      triggerToast("Enregistrement démarré", "info");
    } catch (err: any) {
      console.error("Error starting microphone recording:", err);
      triggerToast("Impossible d'accéder au microphone", "warning");
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop().getMp3().then(async ([buffer, blob]: any) => {
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const file = new File(buffer, `${Date.now()}.mp3`, {
          type: blob.type,
          lastModified: Date.now()
        });

        await uploadAndSendAudioBlob(file);
      }).catch((e: any) => {
        console.error("Error stopping recording:", e);
        triggerToast("Erreur lors de l'enregistrement", "warning");
      });
    }
  };

  const cancelRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop().getMp3().then(() => {
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        triggerToast("Enregistrement annulé", "info");
      }).catch((e: any) => {
        console.error("Error cancelling recording:", e);
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const uploadAndSendAudioBlob = async (blob: Blob) => {
    if (activeChatId === null || !activeChat) return;
    setIsUploading(true);
    triggerToast("Envoi de la note vocale...", "info");

    try {
      const fileName = `${Date.now()}.mp3`;
      const filePath = `manual-uploads/${activeChat.customerPhone}/${fileName}`;

      const formData = new FormData();
      formData.append("file", blob, fileName);
      formData.append("path", filePath);

      const uploadRes = await fetch("/api/media/upload", {
        method: "POST",
        body: formData
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Failed to upload audio to server");
      }

      const { publicUrl } = await uploadRes.json();

      const messageText = `[Audio: ${publicUrl}]`;
      const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      // Send to WhatsApp API
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: activeChat.customerPhone,
          text: "",
          mediaUrl: publicUrl,
          mediaType: "audio",
          conversationId: activeChatId
        })
      });

      if (!res.ok) {
        triggerToast("Erreur lors de l'envoi de la note vocale via WhatsApp", "warning");
        return;
      }

      const resData = await res.json();
      const dbMessage = resData.message;

      if (setConversations) {
        setConversations(prev => prev.map(c => {
          if (c.id === activeChatId) {
            return {
              ...c,
              messages: [
                ...c.messages,
                dbMessage || {
                  id: `msg-${Date.now()}`,
                  sender: "human",
                  text: messageText,
                  time: timeStr
                }
              ]
            };
          }
          return c;
        }));
      }

      triggerToast("Note vocale envoyée !", "success");
    } catch (err: any) {
      console.error("Error sending voice note:", err);
      triggerToast(`Erreur d'envoi audio: ${err.message || err}`, "warning");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || activeChatId === null || !activeChat) return;

    setIsUploading(true);
    triggerToast(`Uploader ${files.length} fichier(s)...`, "info");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 1. Upload to Supabase Storage in 'product-images' bucket
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `manual-uploads/${activeChat.customerPhone}/${fileName}`;

        const formData = new FormData();
        formData.append("file", file, fileName);
        formData.append("path", filePath);

        const uploadRes = await fetch("/api/media/upload", {
          method: "POST",
          body: formData
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || "Failed to upload file to server");
        }

        const { publicUrl } = await uploadRes.json();

        // 3. Determine media type from file type
        let mediaType = "document";
        let prefix = "Fichier";

        const fileTypeLower = (file.type || "").toLowerCase();
        const fileNameLower = (file.name || "").toLowerCase();

        if (fileTypeLower.startsWith("image/")) {
          mediaType = "image";
          prefix = "Image";
        } else if (fileTypeLower.startsWith("video/")) {
          mediaType = "video";
          prefix = "Video";
        } else if (fileTypeLower.startsWith("audio/")) {
          mediaType = "audio";
          prefix = "Audio";
        } else {
          // Fallback check based on extension
          const isAudioExt = fileNameLower.endsWith(".mp3") ||
                             fileNameLower.endsWith(".m4a") ||
                             fileNameLower.endsWith(".ogg") ||
                             fileNameLower.endsWith(".wav") ||
                             fileNameLower.endsWith(".aac") ||
                             fileNameLower.endsWith(".webm") ||
                             fileNameLower.endsWith(".amr") ||
                             fileNameLower.endsWith(".opus");
          if (isAudioExt) {
            mediaType = "audio";
            prefix = "Audio";
          }
        }

        console.log(`Detected file details - Name: ${file.name}, MIME Type: ${file.type}, Resolved Type: ${mediaType}`);

        // 4. Send to WhatsApp and insert into messages table
        const messageText = `[${prefix}: ${publicUrl}]`;
        const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        // Send to WhatsApp API and save to DB
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: activeChat.customerPhone,
            text: "",
            mediaUrl: publicUrl,
            mediaType: mediaType,
            conversationId: activeChatId
          })
        });

        if (!res.ok) {
          triggerToast(`Erreur lors de l'envoi du fichier ${file.name} via WhatsApp`, "warning");
          continue;
        }

        const resData = await res.json();
        const dbMessage = resData.message;

        // Add to local state
        if (setConversations) {
          setConversations(prev => prev.map(c => {
            if (c.id === activeChatId) {
              return {
                ...c,
                messages: [
                  ...c.messages,
                  dbMessage || {
                    id: `msg-${Date.now()}-${i}`,
                    sender: "human",
                    text: messageText,
                    time: timeStr
                  }
                ]
              };
            }
            return c;
          }));
        }
      }

      triggerToast("Tous les fichiers ont été envoyés avec succès !", "success");
    } catch (err: any) {
      console.error("Error uploading / sending files:", err);
      triggerToast(`Erreur d'envoi de fichier: ${err.message || err}`, "warning");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const renderMessageContent = (text: string) => {
    // Detect media formats
    const imageRegex = /\[Image\s*(?:reçue|envoyée)?\s*:\s*([^\]\s]+)\]/i;
    const audioRegex = /\[Audio\s*(?:reçu|envoyé)?\s*:\s*([^\]\s]+)\]/i;
    const videoRegex = /\[Video\s*(?:reçue|envoyée)?\s*:\s*([^\]\s]+)\]/i;
    const documentRegex = /\[Fichier\s*(?:reçu|envoyé)?\s*:\s*([^\]\s]+)\]/i;

    // Check generic URLs in bracket fallback (from the webhook format `[Image envoyée : Kit Minceur] URL`)
    const webhookImageRegex = /\[Image\s*envoyée\s*:\s*[^\]]+\]\s*(https?:\/\/[^\s\]]+)/i;

    let match: RegExpMatchArray | null;

    if ((match = text.match(webhookImageRegex))) {
      const url = match[1].trim();
      const restText = text.replace(match[0], "").trim();
      return (
        <div className="flex flex-col gap-2">
          <img src={url} alt="Visuel" className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />
          {restText && <p className="mt-1">{restText}</p>}
        </div>
      );
    }

    if ((match = text.match(imageRegex))) {
      const url = match[1].trim();
      const restText = text.replace(match[0], "").trim();
      
      // If the matched URL is a base64 image, we render it directly
      const isBase64 = url.startsWith("data:image/");
      return (
        <div className="flex flex-col gap-2">
          <img src={url} alt="Visuel" className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />
          {restText && <p className="mt-1">{restText}</p>}
        </div>
      );
    }

    if ((match = text.match(audioRegex))) {
      const url = match[1].trim();
      const restText = text.replace(match[0], "").trim();
      return (
        <div className="flex flex-col gap-2 min-w-[200px] md:min-w-[260px]">
          <audio src={url} controls className="w-full h-10 rounded-lg bg-neige" />
          {restText && <p className="mt-1">{restText}</p>}
        </div>
      );
    }

    if ((match = text.match(videoRegex))) {
      const url = match[1].trim();
      const restText = text.replace(match[0], "").trim();
      return (
        <div className="flex flex-col gap-2">
          <video src={url} controls className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />
          {restText && <p className="mt-1">{restText}</p>}
        </div>
      );
    }

    if ((match = text.match(documentRegex))) {
      const url = match[1].trim();
      const restText = text.replace(match[0], "").trim();
      return (
        <div className="flex flex-col gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline font-bold text-xs flex items-center gap-1">
            📄 Télécharger le document / fichier
          </a>
          {restText && <p className="mt-1">{restText}</p>}
        </div>
      );
    }

    // Direct url checking
    const cleanText = text.trim();
    if (cleanText.startsWith("http://") || cleanText.startsWith("https://")) {
      const lower = cleanText.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp")) {
        return <img src={cleanText} alt="Image" className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />;
      }
      if (lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".m4a") || lower.endsWith(".oga") || lower.includes("audio")) {
        return <audio src={cleanText} controls className="w-full h-10 rounded-lg bg-neige" />;
      }
      if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
        return <video src={cleanText} controls className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />;
      }
    } else if (cleanText.startsWith("data:image/")) {
      // Split base64 image if there is additional text, or display directly
      return <img src={cleanText} alt="Image" className="max-w-full max-h-60 rounded-lg object-contain shadow-sm border border-graphite/10" />;
    }

    return <span>{text}</span>;
  };
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages or typing status changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages.length, isTyping]);

  // Find customer associated with the active chat
  const customerInfo = activeChat
    ? customers.find(
        c => {
          const cPhone = c?.phone ? c.phone.replace(/\s+/g, "") : "";
          const activePhone = activeChat?.customerPhone ? activeChat.customerPhone.replace(/\s+/g, "") : "";
          const cName = c?.name ? c.name.toLowerCase() : "";
          const activeName = activeChat?.customerName ? activeChat.customerName.toLowerCase() : "";
          
          return (activePhone && cPhone === activePhone) || (activeName && cName === activeName);
        }
      )
    : null;

  // Staggered entry for conversation list items on load
  useEffect(() => {
    gsap.fromTo(".conv-item", 
      { opacity: 0, x: -20 },
      { opacity: 1, x: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" }
    );
  }, []);

  // Staggered entry for messages when switching chat or receiving a message
  useEffect(() => {
    if (activeChatId) {
      gsap.fromTo(".chat-bubble", 
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power3.out" }
      );
    }
  }, [activeChatId, activeChat?.messages.length, isTyping]);

  // Animate the sidebar when it opens
  useEffect(() => {
    if (showCustomerSidebar && sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { x: 100, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [showCustomerSidebar, activeChatId]);

  // Simulation client removed

  // Filter conversations list by search query and engagement status
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEngagement = engagementFilter === "all" || (conv as any).engagementStatus === engagementFilter;
    return matchesSearch && matchesEngagement;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] lg:h-[calc(100vh-10rem)] min-h-0">
      
      {/* Left sidebar: ConversationList */}
      <div className={`w-full lg:w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shrink-0 shadow-sm ${activeChatId !== null ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-graphite/10 flex flex-col gap-2">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une discussion..." 
            className="w-full bg-neige border border-graphite/10 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-menthe font-semibold" 
          />
          <select
            value={engagementFilter}
            onChange={(e) => setEngagementFilter(e.target.value)}
            className="w-full bg-neige border border-graphite/10 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-menthe cursor-pointer text-encre"
          >
            <option value="all">Tous les statuts d&apos;engagement</option>
            <option value="nouveau">Nouveau</option>
            <option value="interesse">Intéressé</option>
            <option value="hesitant">Hésitant</option>
            <option value="chaud">Chaud</option>
            <option value="client">Client</option>
            <option value="client_fidele">Client Fidèle</option>
            <option value="moins_interesse">Moins Intéressé</option>
            <option value="froid">Froid</option>
            <option value="reclamation">Réclamation</option>
          </select>
        </div>
        
        <div className="flex-1 overflow-y-auto divide-y divide-graphite/5">
          {filteredConversations.length > 0 ? (
            filteredConversations.map(conv => {
              const lastMsg = conv.messages[conv.messages.length - 1];
              const badgeStyles = {
                ai_active: "bg-menthe/10 text-menthe border border-menthe/20",
                human_takeover: "bg-red-500/10 text-red-600 border border-red-500/20 animate-pulse",
                closed: "bg-graphite/10 text-graphite-light border border-graphite/20"
              };
              const badgeLabels = {
                ai_active: "IA active",
                human_takeover: "Action requise",
                closed: "Clôturée"
              };

              const engagementStyles: Record<string, string> = {
                nouveau: "bg-blue-100 text-blue-800 border-blue-200",
                interesse: "bg-purple-100 text-purple-800 border-purple-200",
                hesitant: "bg-amber-100 text-amber-800 border-amber-200",
                chaud: "bg-rose-100 text-rose-800 border-rose-200",
                client: "bg-emerald-100 text-emerald-800 border-emerald-200",
                client_fidele: "bg-teal-100 text-teal-800 border-teal-200 font-extrabold",
                moins_interesse: "bg-slate-100 text-slate-800 border-slate-200",
                froid: "bg-gray-100 text-gray-800 border-gray-200",
                reclamation: "bg-red-100 text-red-800 border-red-200"
              };
              
              const engagementLabels: Record<string, string> = {
                nouveau: "Nouveau",
                interesse: "Intéressé",
                hesitant: "Hésitant",
                chaud: "Chaud",
                client: "Client",
                client_fidele: "Client Fidèle",
                moins_interesse: "Moins Intéressé",
                froid: "Froid",
                reclamation: "Réclamation"
              };

              return (
                <button 
                  key={conv.id} 
                  onClick={() => {
                    setActiveChatId(conv.id);
                    setShowCustomerSidebar(true);
                  }} 
                  className={`conv-item w-full text-left p-4 flex flex-col gap-1.5 transition-all hover:bg-neige/60 ${
                    activeChatId === conv.id ? 'bg-neige-dark/40 border-l-4 border-menthe font-bold' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-encre">{conv.customerName}</span>
                    <span className="text-[9px] text-encre/40">{lastMsg ? lastMsg.time : ''}</span>
                  </div>
                  <p className="text-xs text-encre/60 truncate">{lastMsg ? lastMsg.text : ''}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold border ${badgeStyles[conv.status]}`}>
                        {badgeLabels[conv.status]}
                      </span>
                      <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded-full font-bold border ${engagementStyles[(conv as any).engagementStatus || "nouveau"]}`}>
                        {engagementLabels[(conv as any).engagementStatus || "nouveau"]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {conv.unread && <span className="w-2 h-2 bg-menthe rounded-full animate-pulse"></span>}
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirmChat(conv.id);
                        }}
                        className="p-1 text-encre/40 hover:text-red-500 rounded transition-colors cursor-pointer"
                        title="Supprimer la conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-encre/40 italic">Aucune discussion trouvée.</div>
          )}
        </div>
      </div>

      {/* Right side: Flex container holding Chat & Customer sidebar */}
      <div className={`flex-1 flex gap-4 min-h-0 relative ${activeChatId === null ? 'hidden lg:flex' : 'flex'}`}>
        
        {/* Chat Window */}
        <div className="flex-1 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 shadow-sm overflow-hidden">
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div 
                className="px-4 md:px-6 py-4 border-b border-graphite/10 flex items-center justify-between bg-neige/30"
              >
                <div className="flex items-center gap-2 md:gap-3">
                  {/* Back button on mobile */}
                  <button 
                    onClick={() => setActiveChatId(null)} 
                    className="lg:hidden p-1.5 hover:bg-neige rounded-lg border border-graphite/10 text-encre/60 hover:text-menthe transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div 
                    onClick={() => setShowCustomerSidebar(!showCustomerSidebar)}
                    className="w-9 h-9 rounded-full bg-encre text-neige font-bold flex items-center justify-center border border-menthe/30 text-xs shadow-sm cursor-pointer hover:scale-105 transition-transform"
                  >
                    {activeChat.avatar}
                  </div>
                  <div className="flex flex-col">
                    <div 
                      onClick={() => setShowCustomerSidebar(!showCustomerSidebar)}
                      className="flex items-center gap-1.5 cursor-pointer group"
                      title="Cliquez pour afficher/masquer les détails du client"
                    >
                      <span className="font-black text-xs text-encre group-hover:text-menthe transition-colors">
                        {activeChat.customerName}
                      </span>
                      {showCustomerSidebar ? (
                        <ChevronLeft className="w-3.5 h-3.5 text-menthe group-hover:scale-110 transition-transform" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-menthe group-hover:scale-110 transition-transform" />
                      )}
                    </div>
                    <span className="text-[10px] text-encre/40 font-semibold">{activeChat.customerPhone}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {activeChat.status === "human_takeover" ? (
                    <button 
                      onClick={toggleTakeover} 
                      className="magnetic-btn px-4 py-1.5 rounded-xl bg-menthe/10 hover:bg-menthe/20 text-menthe text-[10px] font-bold border border-menthe/20 shadow-sm transition-all"
                    >
                      Repasser en mode IA
                    </button>
                  ) : (
                    <button 
                      onClick={toggleTakeover} 
                      className="magnetic-btn px-4 py-1.5 rounded-xl bg-white border border-graphite/20 hover:border-menthe text-[10px] font-bold shadow-sm transition-all"
                    >
                      Prendre la main
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neige/10">
                {activeChat.messages.map((msg, idx) => {
                  const isCust = msg.sender === "customer";
                  const isAI = msg.sender === "ai";
                  
                  return (
                    <div key={idx} className={`flex w-full ${isCust ? 'justify-start' : 'justify-end'}`}>
                      <div className={`chat-bubble flex items-start gap-2.5 max-w-[70%] ${isCust ? 'flex-row' : 'flex-row-reverse'}`}>
                        
                        {/* Inline sender icons */}
                        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] border shadow-sm ${
                          isCust 
                            ? 'bg-neige border-graphite/10 text-encre/60' 
                            : isAI 
                              ? 'bg-encre border-graphite text-menthe' 
                              : 'bg-menthe border-menthe/20 text-white'
                        }`}>
                          {isCust ? <User className="w-3 h-3" /> : isAI ? <Bot className="w-3.5 h-3.5" /> : <UserCheck className="w-3 h-3" />}
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-encre/40 px-1">
                            {isCust 
                              ? 'Client' 
                              : isAI 
                                ? 'Assistant IA (Bot)' 
                                : ownerName 
                                  ? `${ownerName.split(" ")[0]} (Reprise)` 
                                  : 'Wilfried (Reprise)'}
                          </span>
                          <div 
                            className={`px-4 py-2.5 rounded-[1.2rem] text-xs leading-relaxed ${
                              isCust 
                                ? 'bg-white border border-graphite/10 text-encre shadow-sm rounded-tl-none' 
                                : isAI
                                  ? 'bg-encre text-neige shadow-sm rounded-tr-none border border-graphite'
                                  : 'bg-menthe text-white shadow-sm rounded-tr-none border border-menthe/20'
                            }`}
                            style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                          >
                            {renderMessageContent(msg.text)}
                          </div>
                          <span className="text-[8px] text-encre/30 px-1 text-right mt-0.5">{msg.time}</span>
                        </div>

                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="flex w-full justify-start">
                    <div className="flex items-start gap-2.5 max-w-[70%]">
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center bg-encre border border-graphite text-menthe shadow-sm">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] text-encre/40 px-1">L&apos;IA est en train d&apos;écrire...</span>
                        <div className="px-4 py-3 bg-encre border border-graphite text-neige rounded-[1.2rem] rounded-tl-none flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-1.5 h-1.5 bg-menthe rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-graphite/10 flex gap-3 bg-white items-center">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  multiple
                  accept="image/*,video/*,audio/*,application/pdf"
                />
                
                {isRecording ? (
                  // Active voice note recording interface
                  <div className="flex-1 flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2 animate-pulse">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span className="text-xs font-bold text-red-600">Enregistrement audio...</span>
                      <span className="text-xs font-mono text-encre/60 ml-2">{formatDuration(recordingDuration)}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={cancelRecording}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Annuler l'enregistrement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onClick={stopRecording}
                        className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 px-3"
                        title="Envoyer la note vocale"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span className="text-[10px] font-bold">Envoyer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Standard chat & media send interface
                  <>
                    <button 
                      type="button" 
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 bg-neige border border-graphite/10 text-encre/60 hover:text-menthe hover:border-menthe transition-colors rounded-xl flex items-center justify-center disabled:opacity-50"
                      title="Joindre des fichiers (Images, Vidéos, Audios, Documents)"
                    >
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button 
                      type="button" 
                      disabled={isUploading}
                      onClick={startRecording}
                      className="p-3 bg-neige border border-graphite/10 text-encre/60 hover:text-red-500 hover:border-red-500/30 transition-colors rounded-xl flex items-center justify-center disabled:opacity-50"
                      title="Faire un audio (Enregistrer un message vocal)"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>

                    <input 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      type="text" 
                      disabled={isUploading}
                      placeholder={isUploading ? "Uploader..." : "Écrire une réponse..."} 
                      className="flex-1 bg-neige border border-graphite/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-menthe transition-all font-semibold disabled:opacity-50" 
                    />
                    <button 
                      type="submit" 
                      disabled={isUploading}
                      className="magnetic-btn bg-encre text-neige px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center hover:bg-menthe hover:text-white transition-all shadow-sm disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </form>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-encre/30 text-xs gap-3">
              <MessageSquare className="w-10 h-10 text-menthe/60" />
              <span className="font-semibold text-center max-w-xs leading-relaxed">
                Choisissez une discussion dans la liste de gauche pour interagir et consulter l&apos;historique.
              </span>
            </div>
          )}
        </div>

        {/* Client details Right Sidebar */}
        {showCustomerSidebar && activeChat && (
          <div 
            ref={sidebarRef} 
            className="absolute lg:relative right-0 lg:right-auto top-0 lg:top-auto bottom-0 lg:bottom-auto h-full lg:h-auto w-full lg:w-80 bg-white rounded-[2rem] border border-graphite/10 flex flex-col min-h-0 p-6 shadow-xl lg:shadow-sm overflow-hidden z-20"
          >
            <div className="flex items-center justify-between border-b border-graphite/10 pb-3 mb-5">
              <div className="flex items-center gap-1.5">
                <Info className="w-4 h-4 text-menthe" />
                <span className="text-xs font-black uppercase text-encre tracking-wider">Fiche Client</span>
              </div>
              <button 
                onClick={() => setShowCustomerSidebar(false)}
                className="p-1 hover:bg-neige rounded-lg border border-graphite/5 text-encre/60 hover:text-encre transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {customerInfo ? (
              <div className="flex-1 overflow-y-auto flex flex-col gap-6">
                
                {/* Profile Center Avatar */}
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menthe/10 to-menthe/20 border-2 border-menthe flex items-center justify-center text-menthe text-xl font-black shadow-md">
                    {activeChat.avatar}
                  </div>
                  <span className="font-black text-sm text-encre text-center">{customerInfo.name}</span>
                  <div className="flex flex-wrap gap-1 justify-center mt-1">
                    {customerInfo.tags.map((t, idx) => (
                      <span key={idx} className="text-[9px] bg-menthe/10 text-menthe border border-menthe/20 px-2.5 py-0.5 rounded-full font-bold">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Details Section */}
                <div className="flex flex-col gap-4 text-xs">
                  
                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <Phone className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Téléphone WhatsApp</span>
                      <span className="font-extrabold text-encre">{customerInfo.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <Mail className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">E-mail</span>
                      <span className="font-extrabold text-encre truncate max-w-[180px]">{customerInfo.email || "Non renseigné"}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                    <MapPin className="w-4 h-4 text-menthe shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-[9px] text-encre/40 font-bold uppercase">Adresse de Livraison</span>
                      <span className="font-extrabold text-encre leading-normal">{customerInfo.address || "Non renseignée"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-start gap-2 p-3 bg-neige/50 rounded-xl border border-graphite/5">
                      <Calendar className="w-3.5 h-3.5 text-menthe shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-encre/40 font-bold uppercase">1er Contact</span>
                        <span className="font-extrabold text-[11px] text-encre">{customerInfo.firstContact}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-gradient-to-br from-menthe/5 to-transparent rounded-xl border border-menthe/10">
                      <DollarSign className="w-3.5 h-3.5 text-menthe shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-[8px] text-menthe font-bold uppercase font-black">Total Dépensé</span>
                        <span className="font-extrabold text-[11px] text-menthe">{(!customerInfo.totalSpent || customerInfo.totalSpent === 0) ? "0 FCFA" : `${Number(customerInfo.totalSpent).toLocaleString()} FCFA`}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-encre/30 text-xs p-4 gap-2">
                <User className="w-8 h-8 text-menthe/50" />
                <span>Aucune fiche client détaillée n&apos;a été trouvée pour ce numéro ou ce nom.</span>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Delete Chat Confirmation Modal */}
      {showDeleteConfirmChat !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2rem] border border-graphite/10 p-6 max-w-sm w-full shadow-lg flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-2">
              <span className="font-black text-sm text-encre">Supprimer la conversation ?</span>
              <p className="text-xs text-encre/60 leading-relaxed font-semibold">
                Cette action est irréversible. L&apos;historique complet des messages sera supprimé. Les commandes associées ne seront pas supprimées.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-2">
              <button
                onClick={() => setShowDeleteConfirmChat(null)}
                className="bg-neige hover:bg-neige-dark text-encre text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDeleteChat(showDeleteConfirmChat)}
                className="bg-red-500 hover:bg-red-600 text-neige text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
