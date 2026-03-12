import { useState, useRef, useEffect } from 'react';
import {
  useAiAnalysis, useAiAnalysisTypes, useRefreshAnalysis,
  useSmartNotifications, useAiChat, useGenerateTitles, useGenerateAllAnalyses,
} from '../hooks/useAiInsights';
import { SkeletonCard } from '../components/Skeleton';

/* ─── Icons ─── */
const ICONS = {
  pulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  rocket: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  dollar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  cpu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
};

const CARD_COLORS = [
  'from-blue-500/10 to-blue-600/5 border-blue-500/20',
  'from-emerald-500/10 to-emerald-600/5 border-emerald-500/20',
  'from-purple-500/10 to-purple-600/5 border-purple-500/20',
  'from-amber-500/10 to-amber-600/5 border-amber-500/20',
  'from-rose-500/10 to-rose-600/5 border-rose-500/20',
  'from-cyan-500/10 to-cyan-600/5 border-cyan-500/20',
  'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20',
  'from-teal-500/10 to-teal-600/5 border-teal-500/20',
  'from-orange-500/10 to-orange-600/5 border-orange-500/20',
  'from-pink-500/10 to-pink-600/5 border-pink-500/20',
  'from-violet-500/10 to-violet-600/5 border-violet-500/20',
  'from-lime-500/10 to-lime-600/5 border-lime-500/20',
];

const NOTIF_STYLES = {
  warning: 'bg-warning/10 border-warning/20 text-warning',
  danger: 'bg-danger/10 border-danger/20 text-danger',
  success: 'bg-success/10 border-success/20 text-success',
  info: 'bg-accent/10 border-accent/20 text-accent',
  milestone: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
};

/* ─── Markdown renderer ─── */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];

  const flush = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`l${elements.length}`} className="space-y-1 ml-4 list-disc list-outside text-xs text-gray-400">
          {listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: fmt(item) }} />)}
        </ul>
      );
      listItems = [];
    }
  };

  const fmt = (s) => s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-gray-200 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-gray-300">$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-surface-4 rounded text-[11px] text-accent font-mono">$1</code>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('### ')) { flush(); elements.push(<h4 key={i} className="text-xs font-bold text-gray-300 mt-4 mb-1" dangerouslySetInnerHTML={{ __html: fmt(line.slice(4)) }} />); continue; }
    if (line.startsWith('## ')) { flush(); elements.push(<h3 key={i} className="text-sm font-bold text-gray-200 mt-5 mb-2" dangerouslySetInnerHTML={{ __html: fmt(line.slice(3)) }} />); continue; }
    if (line.startsWith('# ')) { flush(); elements.push(<h2 key={i} className="text-base font-bold text-gray-100 mt-5 mb-2" dangerouslySetInnerHTML={{ __html: fmt(line.slice(2)) }} />); continue; }
    if (/^\d+\.\s/.test(line) || line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.replace(/^\d+\.\s/, '').replace(/^[-*]\s/, ''));
      continue;
    }
    flush();
    elements.push(<p key={i} className="text-xs text-gray-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(line) }} />);
  }
  flush();
  return <div className="space-y-2">{elements}</div>;
}

/* ─── Copy button ─── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className="text-[10px] px-2 py-1 rounded bg-surface-3 hover:bg-surface-4 text-gray-400 transition-colors">
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ─── Analysis Panel ─── */
function AnalysisPanel({ type, onClose }) {
  const { data, isLoading, error } = useAiAnalysis(type);
  const refresh = useRefreshAnalysis();

  return (
    <div className="card p-6 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-accent">{ICONS[data?.icon] || ICONS.chart}</div>
          <h3 className="text-sm font-bold text-gray-200">{data?.title || 'Loading...'}</h3>
        </div>
        <div className="flex items-center gap-2">
          {data?.generatedAt && <span className="text-[10px] text-gray-600">{new Date(data.generatedAt).toLocaleString()}</span>}
          {data?.content && <CopyButton text={data.content} />}
          <button onClick={() => refresh.mutate(type)} disabled={refresh.isPending}
            className="text-[10px] px-2 py-1 rounded bg-surface-3 hover:bg-surface-4 text-gray-400 transition-colors disabled:opacity-50">
            {refresh.isPending ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 ml-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            Analyzing your channel data with AI...
          </div>
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
          <p className="text-xs text-danger">Failed to generate analysis.</p>
        </div>
      ) : (
        <div>
          {renderMarkdown(data?.content)}
          {data?.tokensUsed > 0 && <p className="text-[10px] text-gray-600 mt-4 pt-3 border-t border-border">{data.tokensUsed.toLocaleString()} tokens / {data.model}</p>}
        </div>
      )}
    </div>
  );
}

/* ─── AI Chat ─── */
function AiChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const chat = useAiChat();
  const scrollRef = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = () => {
    if (!input.trim() || chat.isPending) return;
    const q = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    chat.mutate({ question: q, history: messages }, {
      onSuccess: (data) => {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, tokens: data.tokensUsed }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
      },
    });
  };

  return (
    <div className="card overflow-hidden animate-slide-up">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-accent"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <h3 className="text-sm font-semibold text-gray-200">Ask Your Data</h3>
        <span className="text-[10px] text-gray-600 ml-auto">AI answers based on your real channel analytics</span>
      </div>
      <div ref={scrollRef} className="h-[300px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">Ask anything about your channel...</p>
            <div className="flex flex-wrap gap-2 justify-center mt-3">
              {['What are my top traffic sources?', 'Why are views declining?', 'Should I make more Shorts?', 'What content should I focus on?'].map(q => (
                <button key={q} onClick={() => { setInput(q); }} className="text-[10px] px-3 py-1.5 rounded-full bg-surface-3 text-gray-400 hover:bg-surface-4 hover:text-gray-300 transition-colors">{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-accent/15 text-gray-200' : 'bg-surface-3 text-gray-300'}`}>
              {m.role === 'assistant' ? renderMarkdown(m.content) : <p className="text-xs">{m.content}</p>}
              {m.tokens && <p className="text-[9px] text-gray-600 mt-1">{m.tokens} tokens</p>}
            </div>
          </div>
        ))}
        {chat.isPending && (
          <div className="flex justify-start">
            <div className="bg-surface-3 rounded-lg px-3 py-2 flex items-center gap-2">
              <svg className="animate-spin h-3 w-3 text-gray-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              <span className="text-xs text-gray-500">Thinking...</span>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-border p-3 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about your channel analytics..."
          className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50" />
        <button onClick={send} disabled={!input.trim() || chat.isPending}
          className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  );
}

/* ─── Title Generator ─── */
function TitleGenerator() {
  const [topic, setTopic] = useState('');
  const gen = useGenerateTitles();

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-accent"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <h3 className="text-sm font-semibold text-gray-200">Video Title Generator</h3>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && gen.mutate(topic)}
          placeholder="Enter a topic (or leave empty for AI suggestions)..."
          className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-accent/50" />
        <button onClick={() => gen.mutate(topic)} disabled={gen.isPending}
          className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-xs font-medium transition-colors disabled:opacity-40">
          {gen.isPending ? 'Generating...' : 'Generate'}
        </button>
      </div>
      {gen.data && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-500">Topic: {gen.data.topic}</span>
            <CopyButton text={gen.data.titles} />
          </div>
          {renderMarkdown(gen.data.titles)}
          <p className="text-[10px] text-gray-600 mt-3">{gen.data.tokensUsed} tokens</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AiInsights() {
  const { data: typesData, isLoading: typesLoading } = useAiAnalysisTypes();
  const { data: notifData } = useSmartNotifications();
  const generateAll = useGenerateAllAnalyses();
  const [activeType, setActiveType] = useState(null);
  const [tab, setTab] = useState('analyses');

  const types = typesData?.types || [];
  const notifications = notifData?.notifications || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">AI Strategy Center</h2>
          <p className="text-xs text-gray-500 mt-0.5">GPT-powered analysis, chat, and content planning</p>
        </div>
        <button onClick={() => generateAll.mutate()} disabled={generateAll.isPending}
          className="px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-2">
          {generateAll.isPending ? (
            <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Generating all...</>
          ) : 'Generate All 12'}
        </button>
      </div>

      {/* Smart Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <div key={i} className={`border rounded-lg px-4 py-3 flex items-start gap-3 ${NOTIF_STYLES[n.type] || NOTIF_STYLES.info}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 shrink-0 mt-0.5">
                {n.type === 'danger' ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> :
                 n.type === 'success' ? <><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> :
                 n.type === 'milestone' ? <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></> :
                 <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>}
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold">{n.title}</p>
                <p className="text-[11px] opacity-80 mt-0.5">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate-all results */}
      {generateAll.data?.analyses && (
        <div className="card p-4 animate-slide-up">
          <p className="text-xs text-success font-medium mb-2">All {generateAll.data.count} analyses generated! Click any card below to view.</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface-2 p-1 rounded-lg w-fit">
        {[
          { id: 'analyses', label: 'Analyses' },
          { id: 'chat', label: 'Ask Data' },
          { id: 'titles', label: 'Title Generator' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.id ? 'bg-accent/20 text-accent' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'chat' && <AiChat />}
      {tab === 'titles' && <TitleGenerator />}

      {tab === 'analyses' && (
        <>
          {activeType && <AnalysisPanel type={activeType} onClose={() => setActiveType(null)} />}

          {typesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(12)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {types.map((t, i) => {
                const isActive = activeType === t.type;
                return (
                  <button key={t.type} onClick={() => setActiveType(isActive ? null : t.type)}
                    className={`text-left p-4 rounded-xl border transition-all duration-200 bg-gradient-to-br ${CARD_COLORS[i % CARD_COLORS.length]} ${
                      isActive ? 'ring-2 ring-accent/50 scale-[0.98]' : 'hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${isActive ? 'text-accent' : 'text-gray-400'}`}>{ICONS[t.icon] || ICONS.chart}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-200 leading-tight">{t.title}</h3>
                        <p className="text-[10px] text-gray-500 mt-1">{isActive ? 'Click to collapse' : 'Click to analyze'}</p>
                      </div>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${isActive ? 'rotate-90' : ''}`}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="bg-surface-2 border border-border rounded-lg p-4 flex items-start gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-accent shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <p className="text-xs text-gray-400">
          Powered by <strong className="text-gray-300">GPT-4o-mini</strong> using your real channel data. Analyses cached 30 min. Notifications refresh every 15 min.
        </p>
      </div>
    </div>
  );
}
