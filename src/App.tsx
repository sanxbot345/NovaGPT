import { useState, useRef, useEffect } from 'react';
import { cn } from './lib/utils';
import type { Message } from './types';
import { Typewriter } from './components/Typewriter';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Cloud, ShieldCheck, History, Sparkles, X, ExternalLink, AlertCircle, Mail, Lock, Eye, EyeOff, User, ArrowLeft } from 'lucide-react';
import { CyberBackground } from './components/CyberBackground';
import { CyberLogo, CyberLogoDefs } from './components/CyberLogo';

// Firebase imports
import { auth, googleProvider, handleFirestoreError, OperationType, db } from './lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signInAnonymously
} from 'firebase/auth';
import { doc, setDoc, deleteDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function App() {
  // Load initial sessions from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem('novagpt_sessions');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse sessions', e);
      return [];
    }
  });

  // Firebase User & Authentication State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoginMenuOpen, setIsLoginMenuOpen] = useState(false);

  // Loading Screen simulation state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingState, setShowLoadingState] = useState(true);

  // Email/Password login inputs & form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [authFormMode, setAuthFormMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  // Helper functions to save / delete from Firestore
  const saveSessionToFirestore = async (userId: string, session: ChatSession) => {
    try {
      const sessionRef = doc(db, 'users', userId, 'sessions', session.id);
      await setDoc(sessionRef, session);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${userId}/sessions/${session.id}`);
    }
  };

  const deleteSessionFromFirestore = async (userId: string, sessionId: string) => {
    try {
      const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
      await deleteDoc(sessionRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}/sessions/${sessionId}`);
    }
  };

  // Auth handler: Login
  const handleLogin = async () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const loggedUser = result.user;
      
      // Save User metadata to database
      const userRef = doc(db, 'users', loggedUser.uid);
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName,
        photoURL: loggedUser.photoURL,
        createdAt: new Date().toISOString()
      }, { merge: true });
    } catch (error: any) {
      console.error('Login error:', error);
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('popup-closed-by-user')) {
        setAuthError(
          '⚠️ Jendela login ditutup atau diblokir oleh browser Anda.\n\nTips: Karena aplikasi berjalan di dalam frame pratinjau (iframe), beberapa peramban memblokir popup autentikasi Google. Silakan klik tombol "Buka aplikasi di tab baru" (ikon panah keluar di kanan atas preview) dan coba login lagi di tab baru tersebut.'
        );
      } else {
        setAuthError(
          `⚠️ Gagal masuk: ${error?.message || 'Kesalahan tidak diketahui.'}\n\nSaran: Cobalah buka aplikasi di tab baru di pojok kanan atas preview lalu masuk kembali.`
        );
      }
    }
  };

  // Guest bypass login using Firebase Anonymous Auth with an automated fallback
  const handleGuestLogin = async () => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthSubmitting(true);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.warn('Anonymous login error, falling back to local simulation:', error);
      // Fallback: If anonymous auth is disabled/failed, simulate a Guest user locally in state
      const mockUser = {
        uid: 'guest_' + Math.random().toString(36).substring(2, 11),
        email: 'guest@gamenovaid.com',
        displayName: 'Operator Guest',
        isMock: true,
        photoURL: null
      };
      setUser(mockUser);
      setAuthLoading(false);
      setIsLoginMenuOpen(false);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Auth handler: Email/Password Login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAuthError('Silakan masukkan email dan password.');
      return;
    }
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthSubmitting(true);
    try {
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const loggedUser = result.user;
      
      // Save metadata to Firestore
      const userRef = doc(db, 'users', loggedUser.uid);
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: loggedUser.displayName || 'Pengguna Nova',
        photoURL: loggedUser.photoURL || null,
        createdAt: new Date().toISOString()
      }, { merge: true });
      
      setIsLoginMenuOpen(false);
      // Reset inputs
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      console.error('Email login error:', error);
      let msg = 'Gagal masuk. ';
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        msg += 'Email atau password yang Anda masukkan salah.';
      } else if (error?.code === 'auth/invalid-email') {
        msg += 'Format email tidak valid.';
      } else {
        msg += error?.message || 'Terjadi kesalahan sistem.';
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Auth handler: Email/Password Registration
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setAuthError('Silakan isi email dan password.');
      return;
    }
    if (loginPassword.length < 6) {
      setAuthError('Password minimal harus terdiri dari 6 karakter.');
      return;
    }
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthSubmitting(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
      const loggedUser = result.user;
      
      // Set display name in profile
      const nameToSet = loginName.trim() || 'Pengguna Nova';
      await updateProfile(loggedUser, {
        displayName: nameToSet
      });
      
      // Save metadata to Firestore
      const userRef = doc(db, 'users', loggedUser.uid);
      await setDoc(userRef, {
        uid: loggedUser.uid,
        email: loggedUser.email,
        displayName: nameToSet,
        photoURL: null,
        createdAt: new Date().toISOString()
      }, { merge: true });
      
      setIsLoginMenuOpen(false);
      setLoginEmail('');
      setLoginPassword('');
      setLoginName('');
    } catch (error: any) {
      console.error('Email registration error:', error);
      let msg = 'Gagal mendaftar. ';
      if (error?.code === 'auth/email-already-in-use') {
        msg += 'Alamat email ini sudah terdaftar.';
      } else if (error?.code === 'auth/invalid-email') {
        msg += 'Format email tidak valid.';
      } else if (error?.code === 'auth/weak-password') {
        msg += 'Password terlalu lemah (minimal 6 karakter).';
      } else {
        msg += error?.message || 'Terjadi kesalahan sistem.';
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Auth handler: Reset Password Email
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) {
      setAuthError('Silakan masukkan email Anda.');
      return;
    }
    setAuthError(null);
    setAuthSuccessMessage(null);
    setAuthSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      setAuthSuccessMessage('Tautan setel ulang password telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam.');
    } catch (error: any) {
      console.error('Reset password error:', error);
      let msg = 'Gagal mengirim email reset password. ';
      if (error?.code === 'auth/user-not-found') {
        msg += 'Alamat email tidak terdaftar.';
      } else if (error?.code === 'auth/invalid-email') {
        msg += 'Format email tidak valid.';
      } else {
        msg += error?.message || 'Terjadi kesalahan sistem.';
      }
      setAuthError(msg);
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Helper action to clear/reset authentication overlay form mode
  const openLoginOverlay = (mode: 'login' | 'register' = 'login') => {
    setAuthError(null);
    setAuthSuccessMessage(null);
    setLoginEmail('');
    setLoginPassword('');
    setLoginName('');
    setAuthFormMode(mode);
    setIsLoginMenuOpen(true);
  };

  // Auth handler: Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setActiveSessionId(null);
      setMessages([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Effect: Simulated Loading Screen Progress
  useEffect(() => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      if (currentProgress < 99) {
        let increment = 1;
        if (currentProgress < 40) {
          // Initial warm-up load is slightly faster
          increment = Math.floor(Math.random() * 3) + 2; // 2 to 4 %
        } else if (currentProgress < 75) {
          // Mid-stage slows down slightly
          increment = Math.floor(Math.random() * 2) + 1; // 1 to 2 %
        } else {
          // Late stages are highly granular and smooth
          increment = Math.random() > 0.4 ? 1 : 0; // 0 to 1 %
        }
        currentProgress = Math.min(currentProgress + increment, 99);
        setLoadingProgress(currentProgress);
      } else if (!authLoading) {
        currentProgress = 100;
        setLoadingProgress(currentProgress);
        clearInterval(interval);
        const timer = setTimeout(() => {
          setShowLoadingState(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }, 110);

    return () => clearInterval(interval);
  }, [authLoading]);

  // Effect: Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        setIsLoginMenuOpen(false);
      }
    });
    return unsubscribe;
  }, []);

  // Effect: Real-time Firestore sync of chat sessions when logged in
  useEffect(() => {
    if (!user || user.isMock) return;
    
    const sessionsRef = collection(db, 'users', user.uid, 'sessions');
    const q = query(sessionsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbSessions: ChatSession[] = [];
      snapshot.forEach((docSnap) => {
        dbSessions.push(docSnap.data() as ChatSession);
      });
      setSessions(dbSessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/sessions`);
    });
    
    return unsubscribe;
  }, [user]);

  // Effect: Load local guest sessions when logged out
  useEffect(() => {
    if (!user || user.isMock) {
      try {
        const stored = localStorage.getItem('novagpt_sessions');
        setSessions(stored ? JSON.parse(stored) : []);
      } catch (e) {
        console.error('Failed to parse sessions', e);
        setSessions([]);
      }
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [user]);

  // activeSessionId represents currently selected chat ID (null if unsaved brand new chat)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Server Status State for Node.js Express Backend
  const [serverStatus, setServerStatus] = useState<{
    status: string;
    runtime: string;
    framework: string;
    uptime: number;
    memoryUsage: string;
    engine: string;
  } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setServerStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch server status:', err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 25000); // refresh every 25s
    return () => clearInterval(interval);
  }, []);

  // File Upload State & Ref
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isThinkingMode, setIsThinkingMode] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Auto-close plus menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // States for tracking AI message typing events and feedback reactions
  const [completedTypingMsgIds, setCompletedTypingMsgIds] = useState<Record<string, boolean>>({});
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike' | null>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      (window as any).__allowProgrammaticCopy = true;
      await navigator.clipboard.writeText(content);
      (window as any).__allowProgrammaticCopy = false;
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Gagal menyalin pesan:', err);
      (window as any).__allowProgrammaticCopy = false;
    }
  };

  const handleLikeMessage = (messageId: string) => {
    setMessageFeedback(prev => {
      const current = prev[messageId];
      return { ...prev, [messageId]: current === 'like' ? null : 'like' };
    });
  };

  const handleDislikeMessage = (messageId: string) => {
    setMessageFeedback(prev => {
      const current = prev[messageId];
      return { ...prev, [messageId]: current === 'dislike' ? null : 'dislike' };
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef<number>(0);

  // Sync current active session's messages when activeSessionId or sessions change
  useEffect(() => {
    if (activeSessionId) {
      const currentSession = sessions.find(s => s.id === activeSessionId);
      if (currentSession) {
        setMessages(currentSession.messages);
      }
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Persist sessions to localStorage whenever sessions state updates
  useEffect(() => {
    if (!user) {
      localStorage.setItem('novagpt_sessions', JSON.stringify(sessions));
    }
  }, [sessions, user]);

  const scrollToBottom = (force = false) => {
    const now = Date.now();
    if (force || now - lastScrollTime.current > 100) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
      lastScrollTime.current = now;
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isLoading]);

  // Prevent copying or dragging of text globally except in inputs/textareas
  useEffect(() => {
    const handleGlobalCopy = (e: ClipboardEvent) => {
      if ((window as any).__allowProgrammaticCopy) {
        return;
      }
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
    };

    const handleGlobalSelection = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
    };

    document.addEventListener('copy', handleGlobalCopy);
    document.addEventListener('selectstart', handleGlobalSelection);
    document.addEventListener('dragstart', handleGlobalSelection);

    return () => {
      document.removeEventListener('copy', handleGlobalCopy);
      document.removeEventListener('selectstart', handleGlobalSelection);
      document.removeEventListener('dragstart', handleGlobalSelection);
    };
  }, []);

  const handleSubmit = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || input;
    if ((!promptToSend.trim() && selectedFiles.length === 0) || isLoading) return;

    setIsLoading(true);

    let fileAttachments: any[] = [];
    try {
      const attachmentPromises = selectedFiles.map(async file => {
        const dataUrl = await fileToBase64(file);
        const parts = dataUrl.split(';base64,');
        const base64 = parts[1] || parts[0];
        return {
          name: file.name,
          size: formatFileSize(file.size),
          type: file.type || 'application/octet-stream',
          base64: base64
        };
      });
      fileAttachments = await Promise.all(attachmentPromises);
    } catch (err) {
      console.error('Error converting files to base64:', err);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: promptToSend.trim(),
      attachments: fileAttachments
    };

    // Determine updated sessions block
    let updatedSessions = [...sessions];
    let currentSessionId = activeSessionId;

    // Auto-detect & create session if it's the very first message
    if (!currentSessionId) {
      const newSessionId = Date.now().toString();
      const detectedTitle = promptToSend.trim()
        ? (promptToSend.length > 25 ? promptToSend.substring(0, 25) + '...' : promptToSend)
        : (selectedFiles.length > 0 ? selectedFiles[0].name : "Obrolan Baru");

      const newSession: ChatSession = {
        id: newSessionId,
        title: detectedTitle,
        messages: [userMessage],
        createdAt: Date.now(),
      };

      if (user && !user.isMock) {
        await saveSessionToFirestore(user.uid, newSession);
        // also push to parent payload for currentMessage mapping below
        updatedSessions = [newSession, ...updatedSessions];
      } else {
        updatedSessions = [newSession, ...updatedSessions];
        setSessions(updatedSessions);
      }
      setActiveSessionId(newSessionId);
      currentSessionId = newSessionId;
      setMessages([userMessage]);
    } else {
      // Append message to existing session
      if (user && !user.isMock) {
        const existingSession = sessions.find(s => s.id === currentSessionId);
        if (existingSession) {
          const updatedSession = { ...existingSession, messages: [...existingSession.messages, userMessage] };
          await saveSessionToFirestore(user.uid, updatedSession);
          updatedSessions = sessions.map(s => s.id === currentSessionId ? updatedSession : s);
        }
      } else {
        updatedSessions = sessions.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, messages: [...s.messages, userMessage] };
          }
          return s;
        });
        setSessions(updatedSessions);
      }
      setMessages(prev => [...prev, userMessage]);
    }

    if (!customPrompt) {
      setInput('');
    }

    // Reset selected files list
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    try {
      const currentMessages = updatedSessions.find(s => s.id === currentSessionId)?.messages || [userMessage];

      // Keep snapshot of active modes for this specific transition turn
      const usedSearchMode = isSearchMode;
      const usedThinkingMode = isThinkingMode;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: currentMessages.map((m) => {
            return {
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            };
          }),
          isSearchMode: usedSearchMode,
          isThinkingMode: usedThinkingMode,
        }),
      });

      if (!response.ok) {
        let errMessage = 'Gagal berkomunikasi dengan server.';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errMessage = errData.error;
          }
        } catch (_) {}
        throw new Error(errMessage);
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
        groundingMetadata: data.groundingMetadata,
        isSearchModeUsed: usedSearchMode,
        isThinkingModeUsed: usedThinkingMode,
      };

      // Set state and sync with local sessions list
      if (user && !user.isMock) {
        const existingSession = sessions.find(s => s.id === currentSessionId);
        if (existingSession) {
          const updatedSession = { ...existingSession, messages: [...existingSession.messages, assistantMessage] };
          await saveSessionToFirestore(user.uid, updatedSession);
        }
      } else {
        setSessions((prevSessions) => prevSessions.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, messages: [...s.messages, assistantMessage] };
          }
          return s;
        }));
      }

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.message || 'Maaf, terjadi kesalahan saat menyambung ke server. Harap periksa koneksi internet Anda atau coba lagi.',
      };

      if (user && !user.isMock) {
        const existingSession = sessions.find(s => s.id === currentSessionId);
        if (existingSession) {
          const updatedSession = { ...existingSession, messages: [...existingSession.messages, errorMessage] };
          await saveSessionToFirestore(user.uid, updatedSession);
        }
      } else {
        setSessions((prevSessions) => prevSessions.map(s => {
          if (s.id === currentSessionId) {
            return { ...s, messages: [...s.messages, errorMessage] };
          }
          return s;
        }));
      }

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const selectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setIsSidebarOpen(false);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user && !user.isMock) {
      await deleteSessionFromFirestore(user.uid, sessionId);
    } else {
      const updated = sessions.filter(s => s.id !== sessionId);
      setSessions(updated);
    }
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#09090B] text-zinc-100 font-sans overflow-hidden relative">
      <CyberLogoDefs />

      {/* Loading Screen Overlay - Premium, modern and highly aesthetic design */}
      <AnimatePresence>
        {showLoadingState && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#070913] overflow-hidden"
            id="app-initial-loading-screen"
          >
            {/* Ambient Animated Blurred Orbs for Cosmic Depth */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
              <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-indigo-600/10 blur-[130px] animate-pulse" style={{ animationDuration: '8s' }}></div>
              <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[150px] animate-pulse" style={{ animationDuration: '12s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full bg-emerald-500/5 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }}></div>
            </div>

            {/* Main Premium Glass Container */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
              className="relative z-10 flex flex-col items-center p-8 sm:p-10 rounded-3xl bg-zinc-950/40 backdrop-blur-xl border border-zinc-900/60 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] w-[90%] max-w-[380px] text-center"
            >
              {/* Center rotating glowing design */}
              <div className="relative flex items-center justify-center mb-7 h-40 w-40 select-none">
                
                {/* Outer delicate ring */}
                <div className="absolute inset-0 rounded-full border border-zinc-800/50"></div>
                
                {/* Mid spinning glowing ring */}
                <div 
                  className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-[#5a52e6] border-r-[#5a52e6]/30 animate-spin" 
                  style={{ animationDuration: '1.5s' }}
                ></div>
                
                {/* Outer pulsing glow */}
                <div className="absolute inset-4 rounded-full bg-[#5a52e6]/10 blur-md animate-pulse"></div>
                
                {/* Inner counter-rotating ring */}
                <div 
                  className="absolute inset-3.5 rounded-full border-2 border-transparent border-b-indigo-400/40 border-l-indigo-400/10 animate-spin" 
                  style={{ animationDuration: '2.5s', animationDirection: 'reverse' }}
                ></div>

                {/* Inner Brand Circle with Deep Black Finish & subtle rim */}
                <div className="absolute inset-6 rounded-full bg-[#05060a] flex items-center justify-center border border-zinc-800 shadow-2xl z-10 p-3.5">
                  <img 
                    src="/img/10201-removebg-preview.png" 
                    alt="NovaGPT Logo" 
                    className="w-14 h-14 object-contain filter drop-shadow-[0_0_12px_rgba(90,82,230,0.4)]"
                    onError={(e) => {
                      e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Status Label with elegant layout */}
              <div className="h-6 flex items-center justify-center mb-1 overflow-hidden">
                <span className="text-zinc-400 text-[11px] sm:text-xs font-semibold tracking-wider uppercase font-mono animate-pulse">
                  {loadingProgress < 20 && "Menginisialisasi Sistem..."}
                  {loadingProgress >= 20 && loadingProgress < 45 && "Menghubungkan Otorisasi..."}
                  {loadingProgress >= 45 && loadingProgress < 70 && "Sinkronisasi Cloud Firestore..."}
                  {loadingProgress >= 70 && loadingProgress < 90 && "Menyiapkan NovaGPT AI..."}
                  {loadingProgress >= 90 && "Sistem Siap Digunakan!"}
                </span>
              </div>

              {/* Huge elegant Percentage Loader */}
              <div className="text-4xl font-black text-white tracking-tight leading-none mb-6 font-sans">
                {loadingProgress}<span className="text-indigo-400 text-2xl font-bold ml-0.5">%</span>
              </div>

              {/* Premium Progress Track Line */}
              <div className="w-full h-3 bg-zinc-950 border border-zinc-800/80 rounded-[20px] overflow-hidden relative">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 via-[#5a52e6] to-[#818cf8] rounded-[20px] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(90,82,230,0.8)]"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>

              {/* Small fine print brand detail */}
              <div className="mt-5 text-[9px] text-zinc-600 font-medium font-mono uppercase tracking-widest select-none">
                Nova Engine v2.0
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Conditionally render main dashboard if user is authenticated, else render Cyberpunk login page */}
      {!showLoadingState && (
        user ? (
          <>
            {/* Sidebar - starts CLOSED with smooth transition classes */}
            <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 256 : 0,
          x: isSidebarOpen ? 0 : (isMobile ? -256 : 0),
        }}
        transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-[#121214]/90 backdrop-blur-md h-full overflow-hidden md:relative",
          isSidebarOpen ? "border-r border-zinc-800/80" : "border-r-0 border-transparent"
        )}
      >
        <div className={cn(
          "flex flex-col h-full p-5 pt-[calc(1.25rem_+_max(env(safe-area-inset-top),_0rem))] w-64 shrink-0 transition-opacity duration-200",
          !isSidebarOpen && "opacity-0 pointer-events-none"
        )}>
          
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 flex items-center justify-center">
              <img src="/img/10201-removebg-preview.png" alt="NovaGPT Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-300 bg-clip-text text-transparent">NovaGPT</span>
          </div>

          {/* New Chat Button */}
          <button
            onClick={startNewChat}
            className="flex items-center justify-between w-full px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/60 text-zinc-100 rounded-lg text-sm font-medium transition-colors cursor-pointer group"
          >
            <span>Obrolan Baru</span>
            <i className="fa-solid fa-plus text-zinc-400 group-hover:text-zinc-100 transition-colors"></i>
          </button>

          {/* Sesi Utama / Chat History Container */}
          <div className="mt-6 flex-1 overflow-y-auto">

            {/* Simulated / Registered Chat History Sessions */}
            {sessions.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3 px-2">
                  Riwayat Obrolan
                </h3>
                <div className="space-y-1 max-h-[250px] overflow-y-auto pr-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => selectSession(sess.id)}
                      className={cn(
                        "group flex items-center justify-between w-full px-3 py-2 text-sm rounded-md text-left transition-all font-medium cursor-pointer border",
                        activeSessionId === sess.id
                          ? "bg-zinc-800 text-zinc-100 border-zinc-700"
                          : "bg-transparent text-zinc-400 border-transparent hover:bg-zinc-800/40 hover:text-zinc-250"
                      )}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <i className="fa-regular fa-message text-xs text-zinc-500 group-hover:text-zinc-400"></i>
                        <span className="truncate">{sess.title}</span>
                      </div>
                      <button
                        onClick={(e) => deleteSession(sess.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-505 hover:text-red-420 hover:bg-zinc-700/50 rounded transition-all"
                        title="Hapus Obrolan"
                      >
                        <i className="fa-regular fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>



          {/* Profile Area */}
          <div className="pt-4 pb-[max(env(safe-area-inset-bottom),_0.5rem)] border-t border-zinc-800/80">
            {authLoading ? (
              <div className="flex items-center gap-3 p-2 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-zinc-850" />
                <div className="flex flex-col gap-1.5 flex-1 text-left">
                  <div className="h-3 bg-zinc-850 rounded-md w-2/3" />
                  <div className="h-2 bg-zinc-850 rounded-md w-1/3" />
                </div>
              </div>
            ) : user ? (
              <div className="group flex items-center justify-between p-2 rounded-xl hover:bg-zinc-850 border border-transparent hover:border-zinc-800 transition-all select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#121214]/60 border border-zinc-700/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    <img 
                      src="/img/10201-removebg-preview.png" 
                      alt={user.displayName || 'Avatar'} 
                      className="w-7 h-7 object-contain"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        if (user.photoURL) {
                          e.currentTarget.src = user.photoURL;
                        } else {
                          e.currentTarget.src = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-xs font-semibold text-zinc-200 truncate leading-tight">
                      {user.displayName || 'Pengguna Nova'}
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate leading-none mt-1">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition-all cursor-pointer shrink-0"
                  title="Keluar"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => openLoginOverlay('login')}
                  className="flex items-center gap-3 w-full px-4 py-3 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-500/30 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-950/20 active:scale-[0.98]"
                  id="open-login-sidebar-btn"
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white/10 shrink-0 shadow-sm text-indigo-200">
                    <LogIn className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate flex-1 text-left font-sans tracking-wide">Masuk ke Akun</span>
                </button>
                <p className="text-[10px] text-zinc-500 leading-normal px-2 select-none text-left">
                  Simpan riwayat obrolan Anda secara otomatis ke Cloud Database.
                </p>
              </div>
            )}
          </div>

        </div>
      </motion.aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full min-h-0 max-w-full bg-transparent relative z-10">
        
        {/* Header with Close / Open toggle, borderless and with stronger blur effect */}
        <header className="pt-[max(env(safe-area-inset-top),_0rem)] h-[calc(4rem_+_max(env(safe-area-inset-top),_0rem))] flex items-center justify-between px-4 sm:px-6 bg-[#09090B]/30 backdrop-blur-xl z-10 select-none">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-md transition-colors cursor-pointer"
              title="Toggle Sidebar"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 border border-zinc-700/85 rounded-full text-xs font-semibold text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>NovaGPT v3.5</span>
            </div>
          </div>

          <div>
            {/* Connected indicator removed */}
          </div>
        </header>

        {/* Chat / Conversation Container */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full px-3 sm:px-4 scroll-smooth">
          <div className="max-w-2xl mx-auto w-full py-6 sm:py-8 space-y-6">
            
            {/* Show Welcome screen if no messages have been sent */}
            {messages.length === 0 && (
              <div className="text-center pt-8 sm:pt-20 pb-6 px-4 flex flex-col items-center">
                <div className="w-16 h-16 flex items-center justify-center mb-5 animate-pulse">
                  <img src="/img/10201-removebg-preview.png" alt="NovaGPT Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2 text-zinc-100">NovaGPT</h1>
                <p className="text-zinc-500 text-xs sm:text-sm max-w-md leading-relaxed mb-1">
                  Asisten cerdas interaktif bertenaga AI. Ketik pesan Anda di bawah dan mulai berkonsultasi secara instan.
                </p>
              </div>
            )}

             {/* Render conversation messages */}
            {messages.map((message, index) => {
              if (message.role === 'user') {
                const hasAttachments = message.attachmentName || (message.attachments && message.attachments.length > 0);
                
                return (
                  <div
                    key={message.id}
                    className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 bg-zinc-800 border border-zinc-700/65 text-zinc-100 text-sm sm:text-[15px] leading-relaxed shadow-md flex flex-col gap-2 select-none">
                      {message.content && <div className="whitespace-pre-wrap">{message.content}</div>}
                      
                      {hasAttachments && (
                        <div className="flex flex-col gap-1.5 mt-1 self-start select-none w-full">
                          {/* Legacy file attachment indicator */}
                          {message.attachmentName && !message.attachments && (
                            <div className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-700/60 rounded-xl p-2.5 transition-all hover:bg-zinc-950/80 max-w-full">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 shrink-0">
                                <i className="fa-regular fa-file-lines text-xs"></i>
                              </div>
                              <div className="flex flex-col text-left min-w-0">
                                <span className="text-xs font-semibold text-zinc-200 truncate max-w-[160px] sm:max-w-[220px]" title={message.attachmentName}>
                                  {message.attachmentName}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                  {message.attachmentSize}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* Modern multi-file attachments indicator */}
                          {message.attachments && message.attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center gap-2.5 bg-zinc-950/60 border border-zinc-700/60 rounded-xl p-2.5 transition-all hover:bg-zinc-950/80 max-w-full">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 shrink-0">
                                {att.type.startsWith('image/') ? (
                                  <i className="fa-regular fa-image text-xs"></i>
                                ) : att.type.startsWith('video/') ? (
                                  <i className="fa-regular fa-circle-play text-xs"></i>
                                ) : (
                                  <i className="fa-regular fa-file-lines text-xs"></i>
                                )}
                              </div>
                              <div className="flex flex-col text-left min-w-0">
                                <span className="text-xs font-semibold text-zinc-200 truncate max-w-[160px] sm:max-w-[220px]" title={att.name}>
                                  {att.name}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                                  {att.size}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else {
                // Assistant message: No avatar, transparent background, borderless, and full width span
                const isLatestAssistant = index === messages.length - 1;
                const isFinished = !isLatestAssistant || completedTypingMsgIds[message.id];
                return (
                  <div
                    key={message.id}
                    className="w-full text-left py-2 border-none bg-transparent shadow-none animate-in fade-in duration-300 group/msg select-none"
                  >
                    {/* Active Modes Flags on Response */}
                    {(message.isSearchModeUsed || message.isThinkingModeUsed) && (
                      <div className="flex flex-wrap gap-2 mb-2 select-none">
                        {message.isThinkingModeUsed && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold tracking-wide uppercase">
                            <i className="fa-solid fa-brain"></i>
                            <span>Berpikir Mendalam</span>
                          </div>
                        )}
                        {message.isSearchModeUsed && (
                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold tracking-wide uppercase">
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <span>Google Search</span>
                          </div>
                        )}
                      </div>
                    )}

                    {isLatestAssistant ? (
                      <Typewriter 
                        text={message.content} 
                        onType={scrollToBottom}
                        onComplete={() => setCompletedTypingMsgIds((prev) => ({ ...prev, [message.id]: true }))}
                      />
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none text-zinc-200 leading-relaxed text-sm sm:text-[15px]">
                        <MarkdownRenderer content={message.content} />
                      </div>
                    )}

                    {/* Rendering Search sources / Grounding Metadata if present */}
                    {message.groundingMetadata?.groundingChunks && message.groundingMetadata.groundingChunks.length > 0 && (
                      <div className="mt-3.5 pt-3.5 border-t border-zinc-850 select-none animate-in fade-in duration-300">
                        <div className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
                          <i className="fa-solid fa-earth-americas text-zinc-650"></i>
                          <span>Sumber Referensi</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {message.groundingMetadata.groundingChunks.map((chunk, cIdx) => {
                            if (!chunk.web) return null;
                            return (
                              <a
                                key={cIdx}
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-700/60 hover:border-zinc-700/80 transition-all text-[11px] font-semibold text-indigo-400 max-w-[240px]"
                                title={chunk.web.title || chunk.web.uri}
                              >
                                <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                                <i className="fa-solid fa-arrow-up-right-from-square text-[9px] text-zinc-500"></i>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Action buttons bar visible once typing finishes */}
                    {isFinished && (
                      <div className="flex items-center gap-2 mt-3.5 pl-1 text-zinc-500 animate-in fade-in slide-in-from-bottom-1 duration-300 select-none">
                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopyMessage(message.id, message.content)}
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors cursor-pointer",
                            copiedMessageId === message.id ? "text-emerald-400 bg-zinc-800/40" : ""
                          )}
                          title="Salin Tanggapan"
                        >
                          {copiedMessageId === message.id ? (
                            <i className="fa-solid fa-check text-xs animate-in zoom-in duration-200"></i>
                          ) : (
                            <i className="fa-regular fa-copy text-xs"></i>
                          )}
                        </button>

                        {/* Thumbs Up Button (Like) */}
                        <button
                          onClick={() => handleLikeMessage(message.id)}
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors cursor-pointer",
                            messageFeedback[message.id] === 'like' ? "text-emerald-500 bg-zinc-800/40" : ""
                          )}
                          title="Suka Jawaban"
                        >
                          <i className={cn(
                            "text-xs",
                            messageFeedback[message.id] === 'like' ? "fa-solid fa-thumbs-up" : "fa-regular fa-thumbs-up"
                          )}></i>
                        </button>

                        {/* Thumbs Down Button (Dislike) */}
                        <button
                          onClick={() => handleDislikeMessage(message.id)}
                          className={cn(
                            "flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors cursor-pointer",
                            messageFeedback[message.id] === 'dislike' ? "text-rose-505 bg-rose-500/10 text-rose-500" : ""
                          )}
                          title="Kurang Suka Jawaban"
                        >
                          <i className={cn(
                            "text-xs",
                            messageFeedback[message.id] === 'dislike' ? "fa-solid fa-thumbs-down" : "fa-regular fa-thumbs-down"
                          )}></i>
                        </button>
                      </div>
                    )}
                  </div>
                );
              }
            })}
            
            {/* Thinking / Loader Indicator */}
            {isLoading && (
              <div className="w-full text-left py-4 flex items-center gap-1.5 pl-1.5">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="p-4 pb-[calc(1rem_+_max(env(safe-area-inset-bottom),_0rem))] sm:p-6 bg-transparent">
          <div className="max-w-2xl mx-auto">
            
            {/* Visual preview of currently queued/attached files */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto w-full select-none">
                {selectedFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between gap-3 bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-2 max-w-[240px] w-fit animate-in fade-in slide-in-from-bottom-2 duration-200 shrink-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                        {file.type.startsWith('image/') ? (
                          <i className="fa-regular fa-image text-xs"></i>
                        ) : file.type.startsWith('video/') ? (
                          <i className="fa-regular fa-circle-play text-xs"></i>
                        ) : (
                          <i className="fa-regular fa-file-alt text-xs"></i>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 text-left">
                        <span className="text-zinc-200 text-xs font-semibold truncate leading-none mb-1 w-[120px]" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-semibold leading-none">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="w-5 h-5 hover:bg-zinc-800/80 hover:text-zinc-100 text-zinc-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      style={{ borderRadius: '50%' }}
                      title="Batalkan Lampiran"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Active Mode Badges */}
            {(isThinkingMode || isSearchMode) && (
              <div className="flex flex-wrap gap-2 mb-3.5 animate-in fade-in slide-in-from-bottom-1 duration-200 select-none">
                {isThinkingMode && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-[10px] font-bold tracking-wide uppercase shadow-md">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                    <i className="fa-solid fa-brain text-[10px] ml-0.5"></i>
                    <span>BERPIKIR</span>
                    <button 
                      type="button" 
                      onClick={() => setIsThinkingMode(false)}
                      className="hover:text-indigo-200 ml-1.5 p-0.5 transition-colors cursor-pointer"
                      title="Matikan Mode Berpikir"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                )}
                {isSearchMode && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold tracking-wide uppercase shadow-md">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <i className="fa-solid fa-magnifying-glass text-[10px] ml-0.5"></i>
                    <span>SEARCH</span>
                    <button 
                      type="button" 
                      onClick={() => setIsSearchMode(false)}
                      className="hover:text-emerald-200 ml-1.5 p-0.5 transition-colors cursor-pointer"
                      title="Matikan Mode Pencarian"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => handleSubmit(e)}
              className="flex items-center gap-2 bg-[#121214] border border-zinc-700/80 hover:border-zinc-600 rounded-full p-2 pl-3 pr-2 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all relative"
            >
              {/* Invisible native file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                id="file-element-uploader"
                multiple
              />

              {/* Plus Button with relative options popup */}
              <div className="relative shrink-0" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  className={cn(
                    "flex items-center justify-center w-11 h-11 bg-zinc-800/60 border text-zinc-400 hover:text-zinc-100 transition-all cursor-pointer shrink-0",
                    showPlusMenu ? "border-indigo-500 text-indigo-400 rotate-45" : "border-zinc-700/20 hover:border-zinc-700"
                  )}
                  style={{ borderRadius: '50%' }}
                  id="open-file-button"
                  title="Opsi Tambahan"
                >
                  <i className="fa-solid fa-plus text-[15px]"></i>
                </button>

                {/* Dropdown Options Popup */}
                {showPlusMenu && (
                  <div className="absolute bottom-14 left-0 w-56 bg-[#121214] border border-zinc-700/90 rounded-2xl shadow-2xl p-2.5 z-50 flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <div className="text-[10px] font-bold text-zinc-550 text-zinc-500 px-2 pt-1 pb-1 mb-1 border-b border-zinc-800 flex items-center justify-between">
                      <span>OPSI TAMBAHAN</span>
                      <button 
                        type="button" 
                        onClick={() => setShowPlusMenu(false)}
                        className="text-zinc-500 hover:text-zinc-300 p-0.5"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    {/* File Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPlusMenu(false);
                        handleFileButtonClick();
                      }}
                      className="flex items-center gap-2.5 w-full p-2 rounded-xl hover:bg-zinc-800/50 text-zinc-300 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <i className="fa-regular fa-file text-sm"></i>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-zinc-200 text-xs">File</span>
                        <span className="text-[9px] text-zinc-500 truncate leading-none mt-0.5">Unggah berkas</span>
                      </div>
                    </button>

                    {/* Berpikir Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsThinkingMode(!isThinkingMode);
                        setShowPlusMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 w-full p-2 rounded-xl text-left transition-all cursor-pointer",
                        isThinkingMode ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-300" : "hover:bg-zinc-800/50 border border-transparent text-zinc-300 hover:text-white"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                        isThinkingMode ? "bg-indigo-500/20 border-indigo-500/35 text-indigo-400" : "bg-zinc-850 border-zinc-800/50 text-zinc-400"
                      )}>
                        <i className="fa-solid fa-brain text-xs"></i>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-zinc-200 text-xs text-indigo-400">BERPIKIR</span>
                        <span className="text-[9px] text-zinc-500 truncate leading-none mt-0.5">Analisis penalaran mendalam</span>
                      </div>
                      {isThinkingMode && (
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"></div>
                      )}
                    </button>

                    {/* Mencari Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchMode(!isSearchMode);
                        setShowPlusMenu(false);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 w-full p-2 rounded-xl text-left transition-all cursor-pointer",
                        isSearchMode ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" : "hover:bg-zinc-800/50 border border-transparent text-zinc-300 hover:text-white"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                        isSearchMode ? "bg-emerald-500/20 border-emerald-500/35 text-emerald-400" : "bg-zinc-850 border-zinc-800/50 text-zinc-400"
                      )}>
                        <i className="fa-solid fa-magnifying-glass text-xs"></i>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-semibold text-zinc-200 text-xs text-emerald-400">SEARCH</span>
                        <span className="text-[9px] text-zinc-500 truncate leading-none mt-0.5">Pencarian Web & Browser</span>
                      </div>
                      {isSearchMode && (
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if ((input.trim() || selectedFiles.length > 0) && !isLoading) {
                      handleSubmit();
                    }
                  }
                }}
                placeholder="Tanya NovaGPT..."
                className="flex-1 max-h-40 min-h-[44px] resize-none overflow-y-auto bg-transparent border-0 focus:ring-0 py-2.5 px-1 text-sm sm:text-[15px] placeholder-zinc-500 text-zinc-150 focus:outline-none"
                rows={1}
              />
              <button
                type="submit"
                disabled={(!input.trim() && selectedFiles.length === 0) || isLoading}
                className="flex items-center justify-center w-11 h-11 bg-indigo-600 hover:bg-indigo-550 text-white rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <i className="fa-solid fa-paper-plane text-sm"></i>
              </button>
            </form>
          </div>
        </div>

      </main>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          /* Render Fullscreen Cyberpunk Login/Registration System directly as entry point */
          <div className="absolute inset-0 z-30 flex items-center justify-center p-3 sm:p-4 bg-black/98 backdrop-blur-xl overflow-y-auto" id="login-landing-screen">
            {/* Dynamic particles and drop rain background */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <CyberBackground />
            </div>

            {/* Modal Box - Custom Cyberpunk Glowing Card */}
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
              className="relative w-full max-w-[430px] bg-[#0c0612]/92 text-white rounded-3xl p-6 sm:p-8 border border-[#ff003c]/25 backdrop-blur-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(255,0,60,0.15)] z-10 flex flex-col items-center my-auto"
              id="login-portal-card"
            >
              {/* Premium Corner Neon Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-[#00F7FF] rounded-tl-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-[#FF003C] rounded-br-3xl pointer-events-none" />

              {/* Header section with Custom Cyber Logo & Float Animation */}
              <div className="flex flex-col items-center text-center mt-2 mb-6 select-none w-full">
                <div className="relative w-20 h-20 mb-3 select-none animate-float-logo">
                  <CyberLogo className="w-20 h-20" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-[#ff003c] to-[#00f7ff] tracking-widest font-cyber uppercase">
                  {authFormMode === 'login' ? 'NovaGPTX' : authFormMode === 'register' ? 'Otorisasi Node' : 'Setel Ulang'}
                </h3>
                <p className="text-[9px] text-[#a5a5b5] font-mono tracking-[1.5px] uppercase mt-1">
                  {authFormMode === 'login' ? 'Secure AI Authentication System' : authFormMode === 'register' ? 'Registrasi Identitas Kognitif Baru' : 'Sandi Pemulihan Komputasi'}
                </p>
              </div>

              {/* Dynamic Authentication Form (Email/Password) */}
              <form 
                onSubmit={
                  authFormMode === 'login' 
                    ? handleEmailLogin 
                    : authFormMode === 'register' 
                      ? handleEmailRegister 
                      : handleForgotPassword
                } 
                className="w-full flex flex-col gap-4"
              >
                {/* Full name input for signup */}
                {authFormMode === 'register' && (
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#FF003C] tracking-widest uppercase font-cyber font-semibold">Nama Lengkap</label>
                    <div className="relative flex items-center group">
                      <User className="absolute left-3.5 w-4 h-4 text-[#755565] transition-colors group-focus-within:text-[#00F7FF]" />
                      <input
                        type="text"
                        required
                        value={loginName}
                        onChange={(e) => setLoginName(e.target.value)}
                        placeholder="Nama Lengkap Operator"
                        className="w-full pl-10 pr-4 py-3 bg-[#040206]/95 border border-[#ff003c]/20 hover:border-[#ff003c]/40 focus:border-[#00F7FF] focus:ring-1 focus:ring-[#00f7ff]/30 rounded-xl text-white text-xs placeholder-[#755565] outline-none transition-all font-mono tracking-wider"
                      />
                    </div>
                  </div>
                )}

                {/* Email Address Input */}
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-[10px] font-bold text-[#FF003C] tracking-widest uppercase font-cyber font-semibold">Alamat Email</label>
                  <div className="relative flex items-center group">
                    <Mail className="absolute left-3.5 w-4 h-4 text-[#755565] transition-colors group-focus-within:text-[#00F7FF]" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@novagptx.ai"
                      className="w-full pl-10 pr-4 py-3 bg-[#040206]/95 border border-[#ff003c]/20 hover:border-[#ff003c]/40 focus:border-[#00F7FF] focus:ring-1 focus:ring-[#00f7ff]/30 rounded-xl text-white text-xs placeholder-[#755565] outline-none transition-all font-mono tracking-wider"
                    />
                  </div>
                </div>

                {/* Password Input (for Login / Signup) */}
                {authFormMode !== 'forgot' && (
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] font-bold text-[#FF003C] tracking-widest uppercase font-cyber font-semibold">Kata Sandi</label>
                    <div className="relative flex items-center group">
                      <Lock className="absolute left-3.5 w-4 h-4 text-[#755565] transition-colors group-focus-within:text-[#00F7FF]" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-3 bg-[#040206]/95 border border-[#ff003c]/20 hover:border-[#ff003c]/40 focus:border-[#00F7FF] focus:ring-1 focus:ring-[#00f7ff]/30 rounded-xl text-white text-xs placeholder-[#755565] outline-none transition-all font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 p-1 text-[#755565] hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Additional Option line (Remember me + forgot password link) only on sign in */}
                {authFormMode === 'login' && (
                  <div className="flex items-center justify-between text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 font-semibold">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-[#ff003c]/35 bg-black text-[#ff003c]/85 focus:ring-[#ff003c]/50 accent-[#ff003c]"
                      />
                      Remember Me
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setAuthSuccessMessage(null);
                        setAuthFormMode('forgot');
                      }}
                      className="text-[#00F7FF] hover:text-white font-mono tracking-wider transition-all hover:text-shadow-[0_0_8px_#00F7FF]"
                    >
                      Lupa Password?
                    </button>
                  </div>
                )}

                {/* Accept Terms for Signup */}
                {authFormMode === 'register' && (
                  <div className="flex items-center gap-2.5 text-left mb-1">
                    <input
                      type="checkbox"
                      id="regTermsConsent"
                      required
                      className="w-4 h-4 rounded border-[#ff003c]/30 bg-black text-[#ff003c]/80 focus:ring-[#ff003c]/55 accent-[#ff003c] cursor-pointer"
                    />
                    <label htmlFor="regTermsConsent" className="text-[10px] text-zinc-400 font-mono cursor-pointer select-none">
                      Setuju dengan Ketentuan Node Kuantum
                    </label>
                  </div>
                )}

                {/* Dynamic status/error alerting */}
                {authError && (
                  <div className="bg-[#ff003c]/10 border border-[#ff003c]/35 text-[#ff4f76] text-[10px] rounded-xl p-3 text-left font-mono leading-relaxed select-none">
                    {authError}
                  </div>
                )}
                {authSuccessMessage && (
                  <div className="bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-[10px] rounded-xl p-3 text-left font-mono leading-relaxed select-none">
                    {authSuccessMessage}
                  </div>
                )}

                {/* Cyber Action Button */}
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full mt-2.5 py-3 bg-transparent border border-[#ff003c] hover:bg-[#ff003c]/12 text-white font-cyber font-bold rounded-xl text-xs sm:text-xs tracking-widest uppercase transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(255,0,60,0.15)] hover:shadow-[0_0_25px_rgba(255,0,60,0.35)] active:scale-[0.98] disabled:opacity-50 font-semibold"
                >
                  {authSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>{authFormMode === 'login' ? 'Otorisasi Akses' : authFormMode === 'register' ? 'Daftarkan Node' : 'Reset Password'}</span>
                    </>
                  )}
                </button>

                {/* Masuk Instan (Tamu / Bypass) */}
                {authFormMode === 'login' && (
                  <button
                    type="button"
                    onClick={handleGuestLogin}
                    disabled={authSubmitting}
                    className="w-full mt-2.5 py-3 bg-[#00F7FF]/10 hover:bg-[#00F7FF]/22 border border-[#00F7FF]/35 hover:border-[#00F7FF]/65 text-[#00F7FF] font-cyber font-bold rounded-xl text-xs sm:text-xs tracking-widest uppercase transition-all duration-300 relative overflow-hidden flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,247,255,0.1)] hover:shadow-[0_0_25px_rgba(0,247,255,0.3)] active:scale-[0.98] disabled:opacity-50 font-semibold"
                  >
                    <Sparkles className="w-4 h-4 text-[#00F7FF] animate-pulse" />
                    <span>Masuk Instan (Akun Tamu / Bypass)</span>
                  </button>
                )}
              </form>

              {/* Social Login SSO integration */}
              {authFormMode === 'login' && (
                <>
                  <div className="flex items-center my-4 w-full select-none justify-center gap-3">
                    <div className="flex-1 border-b border-dashed border-[#ff003c]/15"></div>
                    <span className="text-[10px] text-[#755565] font-mono tracking-wider">OR CONTINUE WITH</span>
                    <div className="flex-1 border-b border-dashed border-[#ff003c]/15"></div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 w-full">
                    <button
                      type="button"
                      onClick={handleLogin}
                      className="flex items-center justify-center py-2.5 bg-[#0c040c]/70 border border-[#ff003c]/10 hover:border-[#ff003c]/35 rounded-xl cursor-pointer text-[#755565] hover:text-[#ea4335] transition-all hover:text-shadow-[0_0_8px_rgba(234,67,53,0.3)] hover:bg-[#ff003c]/12"
                      title="Masuk via Google"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.986 0-.743-.08-1.3-.176-1.854H12.24z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('OAuth GitHub Node dapat diaktifkan di Firebase Console Anda.');
                      }}
                      className="flex items-center justify-center py-2.5 bg-[#0c040c]/70 border border-[#ff003c]/10 hover:border-[#ff003c]/35 rounded-xl cursor-pointer text-[#755565] hover:text-white transition-all hover:text-shadow-[0_0_8px_white] hover:bg-[#ff003c]/12"
                      title="Masuk via GitHub"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError('OAuth Discord Node dapat diaktifkan di Firebase Console Anda.');
                      }}
                      className="flex items-center justify-center py-2.5 bg-[#0c040c]/70 border border-[#ff003c]/10 hover:border-[#ff003c]/35 rounded-xl cursor-pointer text-[#755565] hover:text-[#5865f2] transition-all hover:text-shadow-[0_0_8px_rgba(88,101,242,0.3)] hover:bg-[#ff003c]/12"
                      title="Masuk via Discord"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.094 13.094 0 0 1-1.873-.894.077.077 0 0 1-.008-.128c.126-.093.252-.19.372-.287a.075.075 0 0 1 .077-.011c3.92 1.793 8.18 1.793 12.061 0a.073.073 0 0 1 .078.009c.12.099.246.195.373.289a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.156 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.156-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.156 2.418z"/>
                      </svg>
                    </button>
                  </div>
                </>
              )}

              {/* Bottom toggle state switch link logic */}
              <div className="mt-6 text-xs text-zinc-400 font-sans select-none">
                {authFormMode === 'login' ? (
                  <p>
                    Belum memiliki akses?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setAuthSuccessMessage(null);
                        setAuthFormMode('register');
                      }}
                      className="text-[#00F7FF] hover:text-white font-bold cursor-pointer transition-colors"
                    >
                      Registrasi Node Baru
                    </button>
                  </p>
                ) : authFormMode === 'register' ? (
                  <p>
                    Sudah terdaftar?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setAuthSuccessMessage(null);
                        setAuthFormMode('login');
                      }}
                      className="text-[#00F7FF] hover:text-white font-bold cursor-pointer transition-colors"
                    >
                      Masuk Frame Kerja
                    </button>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthError(null);
                      setAuthSuccessMessage(null);
                      setAuthFormMode('login');
                    }}
                    className="flex items-center gap-1.5 text-[#00F7FF] hover:text-white font-bold cursor-pointer mx-auto transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Kembali ke Login</span>
                  </button>
                )}
              </div>

              {/* Friendly notification info about popup blocker issues inside iframes */}
              {authFormMode === 'login' && (
                <div className="bg-zinc-950/60 border border-[#ff003c]/15 rounded-xl p-3 flex items-start gap-2.5 mt-5 text-left select-none">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-550 shrink-0 mt-0.5" />
                  <p className="text-[9px] leading-normal text-zinc-400 font-mono">
                    <strong className="text-[#00F7FF]">IFRAME PROTOCOL:</strong> Jika pop-up Google terblokir browser, klik tombol <strong className="text-white">panah kanan atas</strong> untuk meluncurkan di tab mandiri.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )
      )}

      {/* Auth Error Guidance Prompt Modal */}
      <AnimatePresence>
        {authError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="auth-error-popup">
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthError(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-pointer"
              id="auth-error-backdrop"
            />

            {/* Modal Body Container */}
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-md bg-[#121214] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col p-6 text-zinc-200"
              id="auth-error-card"
            >
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                  <i className="fa-solid fa-triangle-exclamation text-lg"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 tracking-tight">Koneksi Autentikasi Terhambat</h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">Sistem pratinjau (iframe) mendeteksi batasan peramban.</p>
                </div>
              </div>

              {/* Message Details */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 mb-5">
                <p className="text-xs text-zinc-350 leading-relaxed font-mono whitespace-pre-wrap">{authError}</p>
              </div>

              {/* Action Guides */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setAuthError(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-md text-center"
                  id="auth-error-close-btn"
                >
                  Saya Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login modal removed in favor of direct fullscreen login landing screen */}
    </div>
  );
}
