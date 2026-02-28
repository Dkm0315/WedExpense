import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BsSend,
  BsMicFill,
  BsXLg,
  BsRobot,
  BsPersonCircle,
  BsPaperclip,
  BsArrowLeft,
  BsStopCircle,
} from 'react-icons/bs';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';
import { getWedding, getCurrentUser, chatWithAI, parseDocument } from '../api/client';

declare const catalyst: any;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'Am I on track with my budget?',
  'Which category am I overspending on?',
  'Vendor negotiation tips',
  'Average catering cost for 500 guests',
  'Best wedding season for savings',
  'How to save on decoration?',
];

const AIAssistant: React.FC = () => {
  const { wid } = useParams<{ wid: string }>();
  const navigate = useNavigate();

  const [wedding, setWedding] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef<boolean>(false);
  const committedTranscriptRef = useRef<string>('');
  const preVoiceInputRef = useRef<string>('');

  useEffect(() => {
    if (!wid) return;
    Promise.all([getWedding(wid), getCurrentUser().catch(() => null)])
      .then(([w, u]) => {
        setWedding(w);
        if (u?.first_name) setUserName(u.first_name);
        // Welcome message
        setMessages([
          {
            id: '0',
            role: 'assistant',
            content: `Welcome! I'm your AI Wedding Assistant for **${w.wedding_name}**. Ask me anything about your budget, vendors, or Indian wedding planning!`,
            timestamp: new Date(),
          },
        ]);
      })
      .catch((err) => setError(err.message || 'Failed to load'))
      .finally(() => setPageLoading(false));
  }, [wid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLogout = () => {
    try {
      if (typeof catalyst !== 'undefined' && catalyst.auth) {
        catalyst.auth.signOut('/app/index.html');
      }
    } catch {
      window.location.href = '/app/index.html';
    }
  };

  const sendMessage = async (text: string, docText?: string) => {
    if (!wid || (!text.trim() && !docText)) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: docText ? `📄 [Document uploaded]\n\n${text}` : text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await chatWithAI(wid, text, docText);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'I could not process that request.',
        sources: data.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
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
    sendMessage(input);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !wid) return;

    setLoading(true);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `📄 Uploading document: ${file.name}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const parsed = await parseDocument(wid, file);
      if (parsed.text) {
        await sendMessage(
          `Analyze this vendor document and compare with my budget`,
          parsed.text
        );
      } else {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Could not extract text from the document. Try uploading a clearer image or PDF.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errMsg]);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Web Speech API for voice input — streams word-by-word, persists across auto-restarts
  const toggleVoice = () => {
    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input not supported in this browser');
      return;
    }

    preVoiceInputRef.current = input;
    committedTranscriptRef.current = '';

    const startRecognition = () => {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
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
        const base = preVoiceInputRef.current;
        const prefix = base ? base + ' ' : '';
        const committed = committedTranscriptRef.current;
        setInput(prefix + committed + sessionFinal + sessionInterim);
      };

      rec.onend = () => {
        if (!manualStopRef.current) {
          const base = preVoiceInputRef.current;
          const prefix = base ? base + ' ' : '';
          const el = inputRef.current;
          if (el) {
            const currentText = el.value;
            const voiceText = currentText.startsWith(prefix)
              ? currentText.slice(prefix.length)
              : currentText;
            committedTranscriptRef.current = voiceText;
          }
          try {
            const newRec = startRecognition();
            newRec.start();
            recognitionRef.current = newRec;
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
          manualStopRef.current = false;
          committedTranscriptRef.current = '';
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsListening(false);
          manualStopRef.current = false;
          committedTranscriptRef.current = '';
          setError('Microphone access denied. Please allow microphone access and try again.');
        }
      };

      return rec;
    };

    manualStopRef.current = false;
    const recognition = startRecognition();
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // Simple markdown rendering for AI messages
  const renderMarkdown = (text: string) => {
    return text
      .split('\n')
      .map((line, i) => {
        // Bold
        let rendered = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        rendered = rendered.replace(/_(.+?)_/g, '<em>$1</em>');
        // Currency highlighting
        rendered = rendered.replace(/(₹[\d,]+(?:\.\d{1,2})?[A-Za-z]*)/g, '<span class="text-primary-300 font-semibold">$1</span>');

        if (!rendered.trim()) return <br key={i} />;
        return (
          <p
            key={i}
            className="mb-1"
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        );
      });
  };

  const pageVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  if (pageLoading) {
    return (
      <Layout userName={userName} onLogout={handleLogout}>
        <LoadingSpinner message="Loading AI Assistant..." />
      </Layout>
    );
  }

  return (
    <Layout userName={userName} onLogout={handleLogout}>
      <motion.div
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.4 }}
        className="flex flex-col h-[calc(100vh-120px)]"
      >
        {/* Breadcrumb with back button */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-colors"
            title="Go back"
          >
            <BsArrowLeft className="text-lg" />
          </button>
          <div className="text-sm text-white/40">
            <Link to="/" className="hover:text-white/60 transition-colors">
              Weddings
            </Link>
            <span className="mx-2">/</span>
            <Link
              to={`/wedding/${wid}`}
              className="hover:text-white/60 transition-colors"
            >
              {wedding?.wedding_name || 'Wedding'}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-white/70">AI Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <BsRobot className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">AI Wedding Assistant</h1>
            <p className="text-xs text-white/40">Powered by WedExpense AI</p>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between"
            >
              {error}
              <button onClick={() => setError('')} className="ml-2 hover:text-red-300">
                <BsXLg />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  msg.role === 'user'
                    ? 'bg-primary/20'
                    : 'bg-gradient-to-br from-primary/30 to-accent/30'
                }`}
              >
                {msg.role === 'user' ? (
                  <BsPersonCircle className="text-primary-300 text-sm" />
                ) : (
                  <BsRobot className="text-white text-sm" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary/20 text-white border border-primary/20'
                    : 'bg-white/5 text-white/90 border border-white/10'
                }`}
              >
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/10 flex gap-2 flex-wrap">
                    {msg.sources.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40"
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
                <BsRobot className="text-white text-sm" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick questions (only show when few messages) */}
        {messages.length <= 2 && !loading && (
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*,.pdf"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
            title="Upload vendor quote or document"
          >
            <BsPaperclip />
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            className={`p-3 rounded-xl border transition-colors ${
              isListening
                ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse'
                : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10'
            }`}
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            {isListening ? <BsStopCircle /> : <BsMicFill />}
          </button>
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Ask about your wedding budget, vendors, tips...'}
              disabled={loading}
              className="flex-1 bg-transparent text-white placeholder-white/30 focus:outline-none text-sm"
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading || !input.trim()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-3 rounded-xl bg-gradient-to-r from-primary to-primary-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            <BsSend />
          </motion.button>
        </form>
      </motion.div>
    </Layout>
  );
};

export default AIAssistant;
