import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsSend,
  BsMicFill,
  BsXLg,
  BsRobot,
  BsPersonCircle,
  BsPaperclip,
  BsStopCircle,
  BsPlusCircle,
  BsGlobe2,
  BsCheckCircleFill,
  BsExclamationCircle,
} from 'react-icons/bs';
import { chatWithAI, parseDocument, parseVendorUrl, webSearch } from '../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
}

interface AttachedFile {
  name: string;
  status: 'parsing' | 'ready' | 'error';
  text?: string;
  errorMsg?: string;
}

const QUICK_QUESTIONS = [
  'Am I on track with my budget?',
  'Which category am I overspending on?',
  'Vendor negotiation tips',
  'Average catering cost for 500 guests',
  'Best wedding season for savings',
  'How to save on decoration?',
];

interface AIFloatingChatProps {
  weddingId?: string;
  weddingName?: string;
}

const AIFloatingChat: React.FC<AIFloatingChatProps> = ({ weddingId, weddingName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [vendorUrl, setVendorUrl] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const manualStopRef = useRef<boolean>(false);
  const committedTranscriptRef = useRef<string>('');
  const preVoiceInputRef = useRef<string>('');

  // Initialize: restore from localStorage or show welcome message
  useEffect(() => {
    if (isOpen && weddingId && !initialized) {
      const stored = localStorage.getItem(`wedexpense_chat_${weddingId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as any[];
          const restored = parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
          setMessages(restored);
        } catch {
          setMessages([]);
        }
      }
      if (!stored || stored === '[]') {
        setMessages([
          {
            id: '0',
            role: 'assistant',
            content: `Hi! I'm your AI Wedding Assistant${weddingName ? ` for **${weddingName}**` : ''}. Ask me anything about your budget, vendors, or Indian wedding planning!\n\nYou can also use the **+** button to upload documents or paste vendor URLs for analysis.`,
            timestamp: new Date(),
          },
        ]);
      }
      setInitialized(true);
    }
  }, [isOpen, weddingId, weddingName, initialized]);

  // Auto-save messages to localStorage
  useEffect(() => {
    if (!weddingId || !initialized || messages.length === 0) return;
    const toStore = messages.slice(-50);
    localStorage.setItem(`wedexpense_chat_${weddingId}`, JSON.stringify(toStore));
  }, [messages, weddingId, initialized]);

  // Reset state when wedding changes (but don't clear localStorage)
  useEffect(() => {
    setInitialized(false);
    setMessages([]);
    setAttachment(null);
  }, [weddingId]);

  const clearChat = () => {
    if (weddingId) localStorage.removeItem(`wedexpense_chat_${weddingId}`);
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content: `Hi! I'm your AI Wedding Assistant${weddingName ? ` for **${weddingName}**` : ''}. Ask me anything about your budget, vendors, or Indian wedding planning!\n\nYou can also use the **+** button to upload documents or paste vendor URLs for analysis.`,
        timestamp: new Date(),
      },
    ]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Clean up recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        manualStopRef.current = true;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      committedTranscriptRef.current = '';
      preVoiceInputRef.current = '';
    };
  }, []);

  // Close tools menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setToolsMenuOpen(false);
        setShowUrlInput(false);
      }
    };
    if (toolsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [toolsMenuOpen]);

  // ── Send message ──

  const sendMessage = async (text: string, docText?: string) => {
    if (!weddingId || (!text.trim() && !docText)) return;

    let displayContent = text;
    if (docText && attachment) {
      displayContent = `[${attachment.name}] ${text}`;
    } else if (docText) {
      displayContent = `[Document] ${text}`;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Build conversation history for context (last 6 messages, excluding welcome)
      const recentHistory = messages
        .filter(m => m.id !== '0')
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));
      const data = await chatWithAI(weddingId, text, docText, recentHistory);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'I could not process that request.',
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      let errorContent = 'Sorry, something went wrong. Please try again.';
      if (err.message) {
        if (err.message.includes('network') || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
          errorContent = 'Network error. Check your connection and try again.';
        } else if (err.message.includes('timeout') || err.message.includes('504')) {
          errorContent = 'Request timed out. Try a shorter question.';
        } else if (err.message.includes('401') || err.message.includes('auth')) {
          errorContent = 'Session may have expired. Please refresh the page.';
        } else {
          errorContent = `Error: ${err.message}`;
        }
      }
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (attachment?.status === 'ready' && attachment.text) {
      sendMessage(input || 'Analyze this document', attachment.text);
      setAttachment(null);
    } else {
      sendMessage(input);
    }
  };

  // ── File upload — Claude-style chip ──

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !weddingId) return;

    setToolsMenuOpen(false);
    setShowUrlInput(false);
    setAttachment({ name: file.name, status: 'parsing' });

    try {
      const parsed = await parseDocument(weddingId, file);
      if (parsed.text) {
        setAttachment({ name: file.name, status: 'ready', text: parsed.text });
      } else {
        setAttachment({
          name: file.name,
          status: 'error',
          errorMsg: 'Could not extract text. Try a clearer file.',
        });
      }
    } catch (err: any) {
      setAttachment({
        name: file.name,
        status: 'error',
        errorMsg: err.message || 'Upload failed.',
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    inputRef.current?.focus();
  };

  // ── Web search / Vendor URL handler ──

  const handleWebSearch = async () => {
    if (!vendorUrl.trim()) return;

    const input = vendorUrl.trim();
    setVendorUrl('');
    setShowUrlInput(false);
    setToolsMenuOpen(false);

    // Detect: URL (starts with http/https) vs plain text search query
    const isUrl = /^https?:\/\//i.test(input);
    const displayName = isUrl
      ? (() => { try { return new URL(input).hostname; } catch { return input.slice(0, 30); } })()
      : `🔍 ${input.slice(0, 25)}${input.length > 25 ? '...' : ''}`;

    setAttachment({ name: displayName, status: 'parsing' });

    try {
      const result = isUrl
        ? await parseVendorUrl(input)
        : await webSearch(input);

      if (result.text) {
        setAttachment({ name: displayName, status: 'ready', text: result.text });
      } else {
        setAttachment({
          name: displayName,
          status: 'error',
          errorMsg: isUrl ? 'Could not extract content from this URL.' : 'No search results found.',
        });
      }
    } catch (err: any) {
      setAttachment({
        name: displayName,
        status: 'error',
        errorMsg: err.message || (isUrl ? 'Failed to parse URL.' : 'Search failed.'),
      });
    }

    inputRef.current?.focus();
  };

  // ── Voice input — streams word-by-word, persists across auto-restarts ──

  const toggleVoice = useCallback(() => {
    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: 'Voice input is not supported in this browser. Try Chrome or Edge.',
        timestamp: new Date(),
      }]);
      return;
    }

    // Save whatever user has typed before starting voice
    preVoiceInputRef.current = input;
    committedTranscriptRef.current = '';

    const startRecognition = () => {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let sessionFinal = '';
        let sessionInterim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            sessionFinal += result[0].transcript;
          } else {
            sessionInterim += result[0].transcript;
          }
        }
        // Combine: pre-voice text + committed (from previous restarts) + this session's results
        const base = preVoiceInputRef.current;
        const prefix = base ? base + ' ' : '';
        const committed = committedTranscriptRef.current;
        setInput(prefix + committed + sessionFinal + sessionInterim);
      };

      recognition.onend = () => {
        if (!manualStopRef.current) {
          // Browser auto-stopped (silence timeout) — commit final text and restart
          // Extract what was finalized in this session by reading current input
          // and re-derive committed transcript
          const base = preVoiceInputRef.current;
          const prefix = base ? base + ' ' : '';
          // Get current input value to preserve all text
          const inputEl = inputRef.current;
          if (inputEl) {
            const currentText = inputEl.value;
            // Everything after the pre-voice prefix is voice transcript
            const voiceText = currentText.startsWith(prefix)
              ? currentText.slice(prefix.length)
              : currentText;
            committedTranscriptRef.current = voiceText;
          }
          try {
            const newRecognition = startRecognition();
            newRecognition.start();
            recognitionRef.current = newRecognition;
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
          manualStopRef.current = false;
          committedTranscriptRef.current = '';
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          manualStopRef.current = false;
          committedTranscriptRef.current = '';
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: 'assistant' as const,
            content: 'Microphone access was denied. Please allow microphone access and try again.',
            timestamp: new Date(),
          }]);
        }
        // 'no-speech' and 'aborted' → let onend handle restart
      };

      return recognition;
    };

    manualStopRef.current = false;
    const recognition = startRecognition();
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setToolsMenuOpen(false);
  }, [isListening, input]);

  // ── Markdown renderer with list support ──

  const inlineFormat = (line: string): string => {
    let rendered = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    rendered = rendered.replace(/_(.+?)_/g, '<em>$1</em>');
    rendered = rendered.replace(
      /(₹[\d,]+(?:\.\d{1,2})?[A-Za-z]*)/g,
      '<span class="text-primary-300 font-semibold">$1</span>'
    );
    return rendered;
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: { type: 'ul' | 'ol'; items: string[] } | null = null;

    const flushList = () => {
      if (!listItems) return;
      const Tag = listItems.type === 'ul' ? 'ul' : 'ol';
      const cls =
        listItems.type === 'ul'
          ? 'list-disc list-inside mb-2 space-y-0.5'
          : 'list-decimal list-inside mb-2 space-y-0.5';
      elements.push(
        <Tag key={`list-${elements.length}`} className={cls}>
          {listItems.items.map((item, j) => (
            <li
              key={j}
              className="text-xs leading-relaxed"
              dangerouslySetInnerHTML={{ __html: inlineFormat(item) }}
            />
          ))}
        </Tag>
      );
      listItems = null;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Unordered list
      const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (ulMatch) {
        if (listItems && listItems.type === 'ul') {
          listItems.items.push(ulMatch[1]);
        } else {
          flushList();
          listItems = { type: 'ul', items: [ulMatch[1]] };
        }
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
      if (olMatch) {
        if (listItems && listItems.type === 'ol') {
          listItems.items.push(olMatch[1]);
        } else {
          flushList();
          listItems = { type: 'ol', items: [olMatch[1]] };
        }
        continue;
      }

      flushList();

      if (!line.trim()) {
        elements.push(<br key={i} />);
      } else {
        elements.push(
          <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
        );
      }
    }

    flushList();
    return elements;
  };

  // Don't render if no wedding context
  if (!weddingId) return null;

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30"
          >
            <BsRobot className="text-white text-xl" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm sm:hidden"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-dark-200 border-l border-white/10 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <BsRobot className="text-white text-sm" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">AI Assistant</h3>
                    <p className="text-[10px] text-white/40">
                      {weddingName || 'Wedding Budget Helper'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={clearChat}
                    className="px-2 py-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 text-[10px] transition-colors"
                    title="Clear chat history"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  >
                    <BsXLg />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        msg.role === 'user'
                          ? 'bg-primary/20'
                          : 'bg-gradient-to-br from-primary/30 to-accent/30'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <BsPersonCircle className="text-primary-300 text-xs" />
                      ) : (
                        <BsRobot className="text-white text-xs" />
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-primary/20 text-white border border-primary/20'
                          : 'bg-white/5 text-white/90 border border-white/10'
                      }`}
                    >
                      {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1.5 pt-1.5 border-t border-white/10 flex gap-1 flex-wrap">
                          {msg.sources.map((s) => (
                            <span
                              key={s}
                              className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40"
                            >
                              {s.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                      <BsRobot className="text-white text-xs" />
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.1s]" />
                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick questions */}
              {messages.length <= 2 && !loading && (
                <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="px-4 py-3 border-t border-white/10 bg-white/5">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf"
                  className="hidden"
                />

                {/* Main input row — wrapped for click-outside detection */}
                <div ref={toolsMenuRef}>
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  {/* Tools "+" button + popover wrapper */}
                  <div className="relative flex-shrink-0">
                    {/* Popover */}
                    <AnimatePresence>
                      {toolsMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 mb-2 w-56 bg-dark-300 border border-white/15 rounded-xl shadow-xl overflow-hidden z-10"
                      >
                        {/* Vendor URL */}
                        <button
                          type="button"
                          onClick={() => setShowUrlInput(!showUrlInput)}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          <BsGlobe2 className="text-sm text-accent" />
                          Enable web search
                        </button>

                        <AnimatePresence>
                          {showUrlInput && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden border-t border-white/10"
                            >
                              <div className="flex items-center gap-1.5 px-3 py-2">
                                <input
                                  value={vendorUrl}
                                  onChange={(e) => setVendorUrl(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleWebSearch();
                                    }
                                  }}
                                  placeholder="Search or paste URL..."
                                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleWebSearch}
                                  disabled={!vendorUrl.trim()}
                                  className="p-1.5 rounded-lg bg-primary/20 text-primary-300 disabled:opacity-30 hover:bg-primary/30 transition-colors"
                                >
                                  <BsSend className="text-[10px]" />
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Upload document */}
                        <button
                          type="button"
                          onClick={() => {
                            fileInputRef.current?.click();
                            setToolsMenuOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors border-t border-white/10"
                        >
                          <BsPaperclip className="text-sm text-primary-300" />
                          Upload document
                        </button>

                        {/* Voice input */}
                        <button
                          type="button"
                          onClick={() => {
                            setToolsMenuOpen(false);
                            toggleVoice();
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors border-t border-white/10"
                        >
                          <BsMicFill className="text-sm text-green-400" />
                          Voice input
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                    {/* Tools "+" button */}
                    <button
                      type="button"
                      onClick={() => {
                        setToolsMenuOpen(!toolsMenuOpen);
                        if (showUrlInput) setShowUrlInput(false);
                      }}
                      className={`p-2 rounded-lg border transition-all ${
                        toolsMenuOpen
                          ? 'bg-primary/20 border-primary/30 text-primary-300'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
                      }`}
                      title="Tools"
                    >
                      <BsPlusCircle
                        className={`text-sm transition-transform ${toolsMenuOpen ? 'rotate-45' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Input container */}
                  <div className="flex-1 flex flex-col px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-colors min-h-[36px]">
                    {/* Attachment chip */}
                    {attachment && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            attachment.status === 'parsing'
                              ? 'bg-white/10 border-white/20 text-white/60'
                              : attachment.status === 'ready'
                              ? 'bg-green-500/10 border-green-500/20 text-green-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}
                        >
                          {attachment.status === 'parsing' && (
                            <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                          )}
                          {attachment.status === 'ready' && (
                            <BsCheckCircleFill className="text-[10px]" />
                          )}
                          {attachment.status === 'error' && (
                            <BsExclamationCircle className="text-[10px]" />
                          )}
                          <span className="max-w-[120px] truncate">{attachment.name}</span>
                          <button
                            type="button"
                            onClick={() => setAttachment(null)}
                            className="ml-0.5 hover:text-white transition-colors"
                          >
                            <BsXLg className="text-[8px]" />
                          </button>
                        </div>
                        {attachment.status === 'error' && attachment.errorMsg && (
                          <span className="text-[9px] text-red-400/70 truncate max-w-[140px]">
                            {attachment.errorMsg}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Text input row */}
                    <div className="flex items-center">
                      {isListening && (
                        <button
                          type="button"
                          onClick={toggleVoice}
                          className="mr-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 transition-colors"
                          title="Click to stop"
                        >
                          <BsStopCircle className="text-[10px]" />
                          <span className="text-[9px] font-medium">Stop</span>
                          <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                        </button>
                      )}
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                          isListening
                            ? 'Speak now... words appear here'
                            : attachment?.status === 'parsing'
                            ? 'Parsing file... type your question'
                            : attachment?.status === 'ready'
                            ? 'Ask about the attached file...'
                            : 'Ask anything...'
                        }
                        disabled={loading}
                        className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Send button */}
                  <motion.button
                    type="submit"
                    disabled={
                      loading ||
                      (!input.trim() && (!attachment || attachment.status !== 'ready')) ||
                      attachment?.status === 'parsing'
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-lg bg-gradient-to-r from-primary to-primary-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
                  >
                    <BsSend className="text-sm" />
                  </motion.button>
                </form>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIFloatingChat;
