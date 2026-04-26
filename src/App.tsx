import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Link as LinkIcon, 
  Search, 
  Download, 
  Copy, 
  Eye, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  Database,
  Trash2,
  ExternalLink,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { parseCSV, preprocessCSV, ProcessedPlayer, RawCSVRow } from './lib/csvProcessor';
import { extractTextFromPDF } from './lib/pdfExtractor';
import { extractPlayerNames, ExtractedPlayer } from './services/geminiService';
import { matchPlayers, MatchResult } from './lib/matcher';
import { cleanArticleText } from './lib/textCleaner';

export default function App() {
  // State
  const [url, setUrl] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<ProcessedPlayer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ matched: MatchResult[]; possible: MatchResult[] } | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [articlePreview, setArticlePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [matchSearch, setMatchSearch] = useState('');
  const [possibleSearch, setPossibleSearch] = useState('');
  const [csvSearchQuery, setCsvSearchQuery] = useState('');
  const [isCsvPreviewOpen, setIsCsvPreviewOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewCopySuccess, setPreviewCopySuccess] = useState(false);
  const [articleCsvRows, setArticleCsvRows] = useState<RawCSVRow[]>([]);
  const [isCsvArticle, setIsCsvArticle] = useState(false);
  const [hasRunMatch, setHasRunMatch] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    try {
      const rawRows = await parseCSV(file);
      const processed = preprocessCSV(rawRows);
      
      if (processed.length === 0 && rawRows.length > 0) {
        throw new Error('No player names were found. Please check that your CSV has a column for "Players" or "Name".');
      }
      
      setCsvRows(processed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file. Please ensure it has the correct columns (Players, Position, Team).');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPdfFile(file);
    setUrl('');
    setError(null);
    setResults(null);
    extractPreview(file);
  };

  const extractPreview = async (file: File | string) => {
    setIsExtracting(true);
    setError(null);
    setResults(null);
    setArticlePreview(null);
    setArticleCsvRows([]);
    setIsCsvArticle(false);
    setHasRunMatch(false);
    
    try {
      let text = '';
      if (typeof file === 'string') {
        // URL
        const proxyResponse = await fetch(`/api/proxy?url=${encodeURIComponent(file)}`);
        if (!proxyResponse.ok) {
          const errorData = await proxyResponse.json();
          throw new Error(errorData.error || `Proxy fetch failed: ${proxyResponse.statusText}`);
        }
        text = await proxyResponse.text();
      } else {
        // File
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') {
          text = await extractTextFromPDF(file);
        } else if (extension === 'csv') {
          const rows = await parseCSV(file);
          setArticleCsvRows(rows);
          setIsCsvArticle(true);
          text = await file.text();
        } else {
          text = await file.text();
        }
      }

      if (!text || text.trim().length < 10) {
        throw new Error('The source appears to be empty or contains no readable text.');
      }

      // Skip aggressive cleaning for CSV to keep structure for AI extraction
      const extension = typeof file !== 'string' ? file.name.split('.').pop()?.toLowerCase() : null;
      const cleaned = (extension === 'csv') ? text.trim().substring(0, 50000) : cleanArticleText(text);
      setArticlePreview(cleaned);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to extract text from the source.');
    } finally {
      setIsExtracting(false);
    }
  };

  const renderStats = (player: MatchResult) => {
    if (!player.stats) return null;
    
    const isPitcher = player.positions.includes('P') || player.role === 'SP' || player.role === 'RP';

    const formatAvg = (val: string | undefined) => {
      if (!val) return '.000';
      const num = parseFloat(val.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return val;
      return num.toFixed(3).replace(/^0/, '');
    };

    const formatDecimal = (val: string | undefined, places: number = 2) => {
      if (!val) return '0.' + '0'.repeat(places);
      const num = parseFloat(val.replace(/[^\d.]/g, ''));
      if (isNaN(num)) return val;
      return num.toFixed(places);
    };
    
    if (isPitcher) {
      const { w, sv, k, era, whip } = player.stats;
      if (!w && !sv && !k && !era && !whip) return null;
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 py-1 px-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">W</span><span className="text-xs font-mono font-bold text-slate-700">{w || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">SV</span><span className="text-xs font-mono font-bold text-slate-700">{sv || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">K</span><span className="text-xs font-mono font-bold text-slate-700">{k || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">ERA</span><span className="text-xs font-mono font-bold text-emerald-600">{formatDecimal(era, 2)}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">WHIP</span><span className="text-xs font-mono font-bold text-emerald-600">{formatDecimal(whip, 2)}</span></div>
        </div>
      );
    } else {
      const { r, hr, rbi, sb, avg } = player.stats;
      if (!r && !hr && !rbi && !sb && !avg) return null;
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 py-1 px-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">R</span><span className="text-xs font-mono font-bold text-slate-700">{r || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">HR</span><span className="text-xs font-mono font-bold text-slate-700">{hr || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">RBI</span><span className="text-xs font-mono font-bold text-slate-700">{rbi || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">SB</span><span className="text-xs font-mono font-bold text-slate-700">{sb || '0'}</span></div>
          <div className="flex gap-1.5 items-center"><span className="text-[10px] font-bold text-slate-400 uppercase">AVG</span><span className="text-xs font-mono font-bold text-indigo-600">{formatAvg(avg)}</span></div>
        </div>
      );
    }
  };

  const runMatch = async () => {
    if (!csvRows.length) {
      setError('Please upload a CSV file of free agents first.');
      return;
    }
    if (isExtracting) {
      setError('Extraction in progress. Please wait.');
      return;
    }
    if (!articlePreview) {
      setError('Please provide an article URL or upload a file and wait for extraction.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResults(null);

    try {
      const { players } = await extractPlayerNames({ text: articlePreview });

      if (players.length === 0) {
        setError('No player names found in the article. Please check the extracted text preview to ensure the content was imported correctly.');
        setIsProcessing(false);
        return;
      }

      const matchResults = matchPlayers(players, csvRows);
      setResults(matchResults);
      setHasRunMatch(true);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An error occurred during processing. Please try again.';
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyPreviewText = () => {
    if (!articlePreview) return;
    navigator.clipboard.writeText(articlePreview);
    setPreviewCopySuccess(true);
    setTimeout(() => setPreviewCopySuccess(false), 2000);
  };

  const groupPlayersByPosition = (players: MatchResult[]) => {
    const groups: Record<string, MatchResult[]> = {};
    players.forEach(player => {
      // Get primary position (first one listed)
      let primaryPos = player.positions.split(',')[0].trim() || 'Unknown';
      
      // If position is generically 'P', check if our AI extracted a specific role (SP/RP)
      if ((primaryPos === 'P' || primaryPos === 'Pitcher') && player.role) {
        primaryPos = player.role;
      }
      
      if (!groups[primaryPos]) {
        groups[primaryPos] = [];
      }
      groups[primaryPos].push(player);
    });
    
    // Predefined order for baseball positions
    const posOrder = ['SP', 'RP', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'OF', 'DH'];
    
    return Object.keys(groups)
      .sort((a, b) => {
        const indexA = posOrder.indexOf(a);
        const indexB = posOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(pos => ({ pos, players: groups[pos] }));
  };

  const togglePositionExpansion = (pos: string) => {
    const newExpanded = new Set(expandedPositions);
    if (newExpanded.has(pos)) {
      newExpanded.delete(pos);
    } else {
      newExpanded.add(pos);
    }
    setExpandedPositions(newExpanded);
  };

  const expandAllMatches = (filteredPositions: string[]) => {
    setExpandedPositions(new Set(filteredPositions));
  };

  const collapseAllMatches = () => {
    setExpandedPositions(new Set());
  };

  const copyJson = () => {
    if (!results) return;
    const confirmedJson = results.matched.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      positions: p.positions,
      role: p.role,
      bid: p.bid,
      injury: p.injury,
      context: p.context,
      stats: p.stats
    }));
    navigator.clipboard.writeText(JSON.stringify(confirmedJson, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadJson = () => {
    if (!results) return;
    const confirmedJson = results.matched.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      positions: p.positions,
      role: p.role,
      bid: p.bid,
      injury: p.injury,
      context: p.context,
      stats: p.stats
    }));
    const blob = new Blob([JSON.stringify(confirmedJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'matched_players.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Search className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-display font-bold text-slate-900 tracking-tight">
              Free Agent Finder
            </h1>
          </div>
          {results && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setResults(null);
                  setPdfFile(null);
                  setUrl('');
                }}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Step 1: CSV Upload */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">1. Free Agent CSV</h2>
                <p className="text-sm text-slate-500">Upload your league's available players</p>
              </div>
            </div>
            {csvRows.length > 0 && (
              <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {csvRows.length} Players Loaded
              </div>
            )}
          </div>
          
          <div className="p-6">
            {!csvFile ? (
              <div 
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={csvInputRef} 
                  onChange={handleCsvUpload} 
                  accept=".csv" 
                  className="hidden" 
                />
                <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3 group-hover:text-indigo-500 transition-colors" />
                <p className="text-slate-600 font-medium">Click to upload CSV</p>
                <p className="text-xs text-slate-400 mt-1">Must include: Players, id, Injury, Pos, Team</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-700 truncate max-w-[200px]">
                      {csvFile.name}
                    </span>
                  </div>
                  <button 
                    onClick={() => {
                      setCsvFile(null);
                      setCsvRows([]);
                      setResults(null);
                      setHasRunMatch(false);
                    }}
                    className="text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setIsCsvPreviewOpen(!isCsvPreviewOpen)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                        Database Preview
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {isCsvPreviewOpen ? 'Hide' : 'View Top 100'}
                      </span>
                      <ChevronRight className={cn(
                        "w-4 h-4 text-slate-300 transition-transform",
                        isCsvPreviewOpen && "rotate-90"
                      )} />
                    </div>
                  </button>

                  <AnimatePresence>
                    {isCsvPreviewOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={csvSearchQuery}
                              onChange={(e) => setCsvSearchQuery(e.target.value)}
                              placeholder="Filter database..."
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                            />
                            {csvSearchQuery && (
                              <button 
                                onClick={() => setCsvSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-left text-[11px] border-collapse">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                  <tr>
                                    <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Name</th>
                                    <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Team</th>
                                    <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Pos</th>
                                    <th className="px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Injury</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                  {csvRows
                                    .filter(p => !csvSearchQuery || 
                                      p.name.toLowerCase().includes(csvSearchQuery.toLowerCase()) ||
                                      p.team.toLowerCase().includes(csvSearchQuery.toLowerCase()) ||
                                      p.positions.toLowerCase().includes(csvSearchQuery.toLowerCase())
                                    )
                                    .slice(0, 100)
                                    .map((p) => (
                                      <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-3 py-2 text-slate-700 font-medium">{p.name}</td>
                                        <td className="px-3 py-2 text-slate-500 text-center font-mono">{p.team}</td>
                                        <td className="px-3 py-2 text-slate-500 text-center">
                                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-600 uppercase">
                                            {p.positions}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                          {p.injury ? (
                                            <span className="inline-block px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-medium border border-red-100">
                                              {p.injury}
                                            </span>
                                          ) : (
                                            <span className="text-slate-300">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex justify-between items-center">
                              <span className="text-[10px] text-slate-400 font-medium">
                                Showing top {Math.min(csvRows.length, 100)} of {csvRows.length} players
                              </span>
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Step 2: Article Input */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">2. Article Source</h2>
                <p className="text-sm text-slate-500">Paste a URL or upload a PDF</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Article URL</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://example.com/fantasy-baseball-sleepers"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      setPdfFile(null);
                      setArticlePreview(null);
                      setResults(null);
                      setHasRunMatch(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && url) {
                        extractPreview(url);
                      }
                    }}
                  />
                </div>
                <button
                  onClick={() => extractPreview(url)}
                  disabled={!url || isExtracting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium">Or upload file (PDF, HTML, MHTML, CSV)</span>
              </div>
            </div>

            {!pdfFile ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".pdf,.html,.mhtml,.htm,.txt,.mthl,.csv" 
                  className="hidden" 
                />
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2 group-hover:text-indigo-500 transition-colors" />
                <p className="text-sm text-slate-600 font-medium">Upload Article File</p>
                <p className="text-[10px] text-slate-400 mt-1">Supports PDF, HTML, MHTML, TXT, CSV</p>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-700 truncate max-w-[200px]">
                    {pdfFile.name}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setPdfFile(null);
                    setArticlePreview(null);
                    setResults(null);
                    setHasRunMatch(false);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                >
                  Change
                </button>
              </div>
            )}

            {/* Article Preview Toggle */}
            {(articlePreview || isExtracting) && (
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    disabled={isExtracting}
                    className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {isExtracting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Extracting Content...
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        {showPreview ? 'Hide Extracted Text' : 'View Extracted Text'}
                      </>
                    )}
                  </button>
                  
                  {articlePreview && !isExtracting && (
                    <button
                      onClick={copyPreviewText}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                      {previewCopySuccess ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy Text
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                <AnimatePresence>
                  {showPreview && articlePreview && !isExtracting && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-4 bg-slate-50 border border-slate-100 rounded-xl max-h-60 overflow-y-auto text-[11px] text-slate-600 font-mono leading-relaxed relative group">
                        {isCsvArticle && articleCsvRows.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-full">
                              <thead className="bg-slate-100 sticky top-0 z-10">
                                <tr>
                                  {Object.keys(articleCsvRows[0]).map((header) => (
                                    <th key={header} className="px-2 py-1.5 font-bold uppercase border-b border-slate-200 whitespace-nowrap">{header}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {articleCsvRows.slice(0, 100).map((row, idx) => {
                                  const headers = Object.keys(articleCsvRows[0]);
                                  return (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                      {headers.map((h, hIdx) => (
                                        <td key={hIdx} className="px-2 py-1.5 border-b border-slate-50">{row[h]}</td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {articleCsvRows.length > 100 && (
                              <div className="p-2 text-center text-slate-400 italic">
                                ... and {articleCsvRows.length - 100} more rows
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{articlePreview}</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={runMatch}
              disabled={isProcessing || isExtracting || (!url && !pdfFile) || csvRows.length === 0 || hasRunMatch}
              className={cn(
                "w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2",
                isProcessing || isExtracting || (!url && !pdfFile) || csvRows.length === 0 || hasRunMatch
                  ? "bg-slate-300 cursor-not-allowed shadow-none"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Finding Free Agents...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Run Match
                </>
              )}
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 mt-4"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 leading-relaxed">{error}</p>
              </motion.div>
            )}

            {hasRunMatch && (
              <button
                onClick={() => {
                  setResults(null);
                  setHasRunMatch(false);
                }}
                className="w-full mt-2 py-2 text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3 h-3" />
                Clear Results & Run Again
              </button>
            )}
          </div>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {results && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Matched Players */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-600 text-white gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <h2 className="text-lg font-bold">Matched Players</h2>
                      <p className="text-xs text-indigo-100">High confidence matches found in your CSV</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white/20 rounded-lg p-1 mr-2">
                      <button
                        onClick={() => {
                          const filtered = results.matched.filter(p => 
                            p.name.toLowerCase().includes(matchSearch.toLowerCase()) ||
                            p.team.toLowerCase().includes(matchSearch.toLowerCase()) ||
                            p.positions.toLowerCase().includes(matchSearch.toLowerCase())
                          );
                          const groups = groupPlayersByPosition(filtered);
                          expandAllMatches(groups.map(g => g.pos));
                        }}
                        className="px-2 py-1 text-[10px] font-bold hover:bg-white/10 rounded transition-colors"
                      >
                        Expand All
                      </button>
                      <div className="w-[1px] h-3 bg-white/20 mx-1"></div>
                      <button
                        onClick={collapseAllMatches}
                        className="px-2 py-1 text-[10px] font-bold hover:bg-white/10 rounded transition-colors"
                      >
                        Collapse All
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-300" />
                      <input
                        type="text"
                        placeholder="Search matches..."
                        value={matchSearch}
                        onChange={(e) => setMatchSearch(e.target.value)}
                        className="bg-white/10 border border-white/20 rounded-lg pl-9 pr-9 py-1.5 text-sm text-white placeholder:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all w-full sm:w-48"
                      />
                      {matchSearch && (
                        <button 
                          onClick={() => setMatchSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-indigo-300 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold shrink-0">
                      {results.matched.length}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {results.matched.length > 0 ? (
                    (() => {
                      const filtered = results.matched.filter(p => 
                        p.name.toLowerCase().includes(matchSearch.toLowerCase()) ||
                        p.team.toLowerCase().includes(matchSearch.toLowerCase()) ||
                        p.positions.toLowerCase().includes(matchSearch.toLowerCase())
                      );
                      
                      if (filtered.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400">
                            No matches found for "{matchSearch}"
                          </div>
                        );
                      }

                      return groupPlayersByPosition(filtered).map(({ pos, players }) => {
                      const isExpanded = expandedPositions.has(pos);
                      return (
                        <div key={pos} className="bg-white">
                          <button
                            onClick={() => togglePositionExpansion(pos)}
                            className="w-full px-6 py-3 bg-slate-50 border-y border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                                <Database className="w-4 h-4" />
                              </div>
                              <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">
                                {pos} <span className="ml-1 text-slate-400 font-bold">({players.length})</span>
                              </h3>
                            </div>
                            <ChevronRight className={cn(
                              "w-5 h-5 text-slate-400 transition-transform duration-200",
                              isExpanded && "rotate-90 text-indigo-500"
                            )} />
                          </button>
                          
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="divide-y divide-slate-100">
                                  {players.map((player) => (
                                    <div key={player.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                          <h3 className="font-bold text-slate-900 text-lg">{player.name}</h3>
                                          <div className="flex flex-wrap gap-2 items-center">
                                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                                              {player.team}
                                            </span>
                                            <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                              {player.positions}
                                            </span>
                                            {player.bid && (
                                              <span className="text-xs font-black px-2 py-0.5 bg-emerald-600 text-white rounded flex items-center gap-1 shadow-sm">
                                                <Database className="w-3 h-3" />
                                                BID: {player.bid}
                                              </span>
                                            )}
                                            {player.injury && (
                                              <span className="text-xs font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {player.injury}
                                              </span>
                                            )}
                                          </div>
                                          {renderStats(player)}
                                          {player.context && (
                                            <p className="text-sm text-slate-600 mt-2 italic leading-relaxed border-l-2 border-slate-200 pl-3">
                                              "{player.context}"
                                            </p>
                                          )}
                                        </div>
                                        <div className="text-right">
                                          <span className={cn(
                                            "text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-full",
                                            player.matchType === 'exact' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                          )}>
                                            {player.matchType}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    });
                  })()
                  ) : (
                    <div className="p-12 text-center text-slate-400">
                      No high-confidence matches found.
                    </div>
                  )}
                </div>

                {results.matched.length > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 justify-center sm:justify-end">
                    <button 
                      onClick={() => setShowJson(!showJson)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      {showJson ? 'Hide JSON' : 'View JSON'}
                    </button>
                    <button 
                      onClick={copyJson}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                    >
                      {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copySuccess ? 'Copied!' : 'Copy JSON'}
                    </button>
                    <button 
                      onClick={downloadJson}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                    >
                      <Download className="w-4 h-4" />
                      Download JSON
                    </button>
                  </div>
                )}
              </section>

              {/* JSON Viewer */}
              {showJson && results.matched.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-slate-900 rounded-2xl p-6 overflow-hidden"
                >
                  <pre className="text-indigo-300 text-xs font-mono overflow-x-auto">
                    {JSON.stringify(results.matched.map(p => ({
                      id: p.id,
                      name: p.name,
                      team: p.team,
                      positions: p.positions,
                      role: p.role,
                      bid: p.bid,
                      injury: p.injury,
                      context: p.context,
                      stats: p.stats
                    })), null, 2)}
                  </pre>
                </motion.div>
              )}

              {/* Possible Matches */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Possible Matches</h2>
                      <p className="text-sm text-slate-500">Lower confidence fuzzy matches</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search possible..."
                        value={possibleSearch}
                        onChange={(e) => setPossibleSearch(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all w-full sm:w-48"
                      />
                      {possibleSearch && (
                        <button 
                          onClick={() => setPossibleSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold shrink-0">
                      {results.possible.length}
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {results.possible.length > 0 ? (
                    (() => {
                      const filtered = results.possible.filter(p => 
                        p.name.toLowerCase().includes(possibleSearch.toLowerCase()) ||
                        p.team.toLowerCase().includes(possibleSearch.toLowerCase()) ||
                        p.positions.toLowerCase().includes(possibleSearch.toLowerCase())
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="p-12 text-center text-slate-400">
                            No possible matches found for "{possibleSearch}"
                          </div>
                        );
                      }

                      return filtered.map((player) => (
                        <div key={player.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <h3 className="font-bold text-slate-900">{player.name}</h3>
                              <div className="flex gap-2 items-center flex-wrap">
                                <span className="text-xs font-medium text-slate-500">
                                  {player.team} • {player.positions}
                                </span>
                                {player.bid && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-600 text-white rounded flex items-center gap-1">
                                    BID: {player.bid}
                                  </span>
                                )}
                              </div>
                              {renderStats(player)}
                              {player.context && (
                                <p className="text-xs text-slate-500 mt-2 italic leading-relaxed border-l-2 border-slate-100 pl-2">
                                  "{player.context}"
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-amber-400" 
                                  style={{ width: `${Math.max(10, (1 - (player.score || 0)) * 100)}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400">
                                {Math.round((1 - (player.score || 0)) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="p-12 text-center text-slate-400">
                      No ambiguous matches to show.
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Free Agent Finder uses Gemini AI to extract player names from text. 
          Matching is performed locally against your uploaded CSV.
        </p>
        <div className="flex justify-center gap-6">
          <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors">
            <span className="sr-only">GitHub</span>
            <Database className="w-5 h-5" />
          </a>
        </div>
      </footer>
    </div>
  );
}
