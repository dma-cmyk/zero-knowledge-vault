import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Shield, 
  Key, 
  Trash2, 
  ChevronRight, 
  BrainCircuit, 
  Lock, 
  Unlock,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Moon,
  Sun,
  Sparkles,
  Wand2,
  ArrowLeft,
  Download,
  Upload,
  Settings,
  Sliders
} from 'lucide-react';

// Initialize Gemini
const defaultApiKey = process.env.GEMINI_API_KEY || '';
const defaultModel = "gemini-3-flash-preview";

type Question = string;
type Answer = 'yes' | 'no' | 'maybe' | 'probably' | 'probably_not';

interface VaultItem {
  id: number;
  title: string;
  questions: string[];
  theme: string;
  theme_label?: string;
  encrypted_password?: string;
  iv?: string;
  salt?: string;
  created_at: string;
}

const ANSWER_LABELS: Record<Answer, string> = {
  yes: 'はい',
  no: 'いいえ',
  maybe: 'わからない',
  probably: 'たぶんそう',
  probably_not: 'たぶん違う'
};

export default function App() {
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState<VaultItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<VaultItem | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [theme, setTheme] = useState<string | null>(null);
  const [targetName, setTargetName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [decryptedPassword, setDecryptedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [customTheme, setCustomTheme] = useState('');
  const [themeIcon, setThemeIcon] = useState('🔒');
  
  // Standalone mode detection (for GitHub Pages)
  const [isStandalone, setIsStandalone] = useState(false);
  
  // Crypto helpers (Web Crypto API)
  const cryptoHelpers = {
    async deriveKey(answers: string[], salt: string) {
      const password = answers.join("|");
      const enc = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        'raw', 
        enc.encode(password), 
        'PBKDF2', 
        false, 
        ['deriveKey']
      );
      return crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: enc.encode(salt),
          iterations: 600000,
          hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    },
    async encrypt(text: string, answers: string[]) {
      const salt = Math.random().toString(36).substring(2, 12);
      const iv = crypto.getRandomValues(new Uint8Array(16));
      const key = await this.deriveKey(answers, salt);
      const enc = new TextEncoder();
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        key,
        enc.encode(text)
      );
      return {
        encryptedData: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
        salt
      };
    },
    async decrypt(encryptedData: string, iv: string, salt: string, answers: string[]) {
      try {
        const key = await this.deriveKey(answers, salt);
        const encryptedBuffer = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
        const ivBuffer = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: ivBuffer },
          key,
          encryptedBuffer
        );
        return new TextDecoder().decode(decrypted);
      } catch (e) {
        return null;
      }
    }
  };
  
  // API Settings state
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('zk_vault_api_key') || defaultApiKey);
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('zk_vault_model') || defaultModel);
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    const saved = localStorage.getItem('zk_vault_available_models');
    return saved ? JSON.parse(saved) : [defaultModel];
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const THEMES = [
    { id: 'character', label: 'キャラクター', icon: '👤', description: 'アニメ、映画、歴史上の人物など' },
    { id: 'food', label: '食べ物', icon: '🍕', description: '好きな料理や飲み物' },
    { id: 'place', label: '場所', icon: '🗺️', description: '旅行先や思い出の場所' },
    { id: 'animal', label: '動物', icon: '🐾', description: 'ペット、野生動物、架空の生物' },
    { id: 'object', label: '身の回りの物', icon: '📦', description: '文房具、家電、宝物など' },
    { id: 'media', label: '映画・ドラマ', icon: '🎬', description: '作品名や印象的なシーン' },
    { id: 'game', label: 'ゲーム', icon: '🎮', description: 'ビデオゲーム、ボードゲーム' },
    { id: 'music', label: '音楽・楽器', icon: '🎸', description: 'アーティスト、曲名、楽器' },
    { id: 'sport', label: 'スポーツ', icon: '⚽', description: '競技名、チーム、選手' },
    { id: 'nature', label: '自然・宇宙', icon: '🌌', description: '星座、植物、自然現象' },
    { id: 'vehicle', label: '乗り物', icon: '🚀', description: '車、電車、飛行機、宇宙船' },
    { id: 'memory', label: '個人的な思い出', icon: '✨', description: '自分だけが知っている出来事' },
  ];

  useEffect(() => {
    checkModeAndFetch();
    if (userApiKey) {
      fetchModels(userApiKey);
    }
  }, []);

  const checkModeAndFetch = async () => {
    try {
      const res = await fetch('/api/vaults');
      if (res.ok) {
        setIsStandalone(false);
        const data = await res.json();
        setVaults(data);
      } else {
        throw new Error("API not available");
      }
    } catch (err) {
      console.log("Entering standalone mode (LocalStorage)");
      setIsStandalone(true);
      const saved = localStorage.getItem('zk_vault_data');
      if (saved) setVaults(JSON.parse(saved));
    }
  };

  const fetchModels = async (key: string) => {
    if (!key) {
      setModelFetchError("APIキーを入力してください。");
      return;
    }
    setIsTestingConnection(true);
    setModelFetchError(null);
    try {
      // Try v1beta as it often has more detailed model info for Gemini
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();
      
      if (data.error) {
        setModelFetchError(`APIエラー: ${data.error.message} (Code: ${data.error.code})`);
        return;
      }

      if (data.models) {
        const filtered = data.models
          .filter((m: any) => 
            m.supportedGenerationMethods.some((method: string) => method.includes('generateContent'))
          )
          .map((m: any) => m.name.replace('models/', ''));
        
        if (filtered.length > 0) {
          setAvailableModels(filtered);
          localStorage.setItem('zk_vault_available_models', JSON.stringify(filtered));
          
          if (!filtered.includes(selectedModel)) {
            const bestDefault = filtered.find((m: string) => m.includes('flash')) || filtered[0];
            setSelectedModel(bestDefault);
            localStorage.setItem('zk_vault_model', bestDefault);
          }
          alert("接続に成功しました！利用可能なモデルを読み込みました。");
        } else {
          setModelFetchError("利用可能なGeminiモデルが見つかりませんでした。");
        }
      }
    } catch (err) {
      console.error("Failed to fetch models", err);
      setModelFetchError("通信エラーが発生しました。APIキーが正しいか、ネットワークを確認してください。");
    } finally {
      setIsTestingConnection(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('zk_vault_api_key', userApiKey);
    localStorage.setItem('zk_vault_model', selectedModel);
    setIsSettingsOpen(false);
  };

  const fetchVaults = async () => {
    if (isStandalone) {
      const saved = localStorage.getItem('zk_vault_data');
      if (saved) setVaults(JSON.parse(saved));
      return;
    }
    const res = await fetch('/api/vaults');
    const data = await res.json();
    setVaults(data);
  };

  const generateQuestions = async (themeLabel: string, icon: string) => {
    if (!targetName) {
      setError("思い浮かべたものの名前を入力してください。");
      return;
    }
    setTheme(themeLabel);
    setThemeIcon(icon);
    setLoading(true);
    setError(null);
    try {
      const customAi = new GoogleGenAI({ apiKey: userApiKey || defaultApiKey });
      let q: string[] = [];
      
      try {
        // First attempt: Try with JSON mode (supported by Gemini 1.5+)
        const response = await customAi.models.generateContent({
          model: selectedModel,
          contents: `あなたは『ランプのお姉さん』です。ミステリアスでエレガントな口調（語尾は「〜かしら？」「〜だわ」など）で、テーマ「${themeLabel}」に関連する質問を20個作成してください。
          ユーザーが特定の何かを思い浮かべていると想定し、アキネーターのようにそれを当てるための質問をしてください。
          回答は「はい」「いいえ」「わからない」「たぶんそう」「たぶん違う」のいずれかになります。
          質問のみをJSON配列で返してください。`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        });
        q = JSON.parse(response.text || '[]');
      } catch (jsonErr) {
        console.warn("JSON mode failed, falling back to text mode", jsonErr);
        // Second attempt: Fallback to plain text for models like Gemma that don't support responseMimeType
        const response = await customAi.models.generateContent({
          model: selectedModel,
          contents: `あなたは『ランプのお姉さん』です。ミステリアスでエレガントな口調（語尾は「〜かしら？」「〜だわ」など）で、テーマ「${themeLabel}」に関連する質問を20個作成してください。
          ユーザーが特定の何かを思い浮かべていると想定し、アキネーターのようにそれを当てるための質問をしてください。
          回答は「はい」「いいえ」「わからない」「たぶんそう」「たぶん違う」のいずれかになります。
          結果は必ず次のフォーマット（JSON配列）で返してください。余計な説明や装飾は一切不要です。
          ["質問1", "質問2", ..., "質問20"]`,
        });
        
        const text = response.text || '';
        console.log("Raw fallback text:", text);
        
        // Multi-layered Robust Parsing
        try {
          // Layer 1: Clean and extract JSON array using regex/brackets
          let jsonStr = '';
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']');
          
          if (start !== -1 && end !== -1 && end > start) {
            jsonStr = text.substring(start, end + 1);
            
            // Layer 2: Normalize common JSON-like errors (heuristic)
            const normalized = jsonStr
              .replace(/'/g, '"') // Single to double quotes
              .replace(/,\s*]/g, ']') // Trailing commas
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Control characters
              .trim();
            
            try {
              q = JSON.parse(normalized);
            } catch (innerErr) {
              console.warn("JSON.parse failed even after normalization", innerErr);
              // If normalization failed, we'll fall through to Layer 3
            }
          }

          // Layer 3: Line-by-line fallback (if q is still empty)
          if (!q || q.length === 0) {
            console.log("Falling back to line-by-line extraction");
            // Limit text to 50KB to prevent processing infinite loops
            const safeText = text.substring(0, 50000);
            const lines = safeText.split('\n');
            const extracted: string[] = [];
            for (const line of lines) {
              // Remove JSON markers [ ], quotes ", and commas ,
              let cleaned = line.trim()
                .replace(/^[[\]\s,"']+/, '') // Remove leading [ ] , " '
                .replace(/[[\s,"']+$/, '');  // Remove trailing [ ] , " '
              
              if (cleaned.length < 5) continue;

              // Heuristic: Must end with a question mark or a common Japanese sentence ender
              // Or be a reasonably formatted question
              if (cleaned.match(/[?？]$|[わら]$|ね$|かな$/) || (cleaned.length > 10 && extracted.length < 20)) {
                extracted.push(cleaned);
              }
              
              if (extracted.length >= 20) break;
            }
            q = extracted;
          }
        } catch (parserErr) {
          console.error("Super robust parser failed", parserErr);
          throw new Error("AIの回答を読み取れませんでした。");
        }
      }

      if (q && q.length > 0) {
        setQuestions(q);
        setCurrentQuestionIndex(0);
        setAnswers([]);
      } else {
        throw new Error("質問が生成されませんでした。");
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError("質問の生成に失敗しました。APIキーやモデルの設定を確認してください。");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (answer: Answer) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Finished all questions
      // Add targetName to answers to include it in the key derivation
      const finalAnswersWithTarget = [...newAnswers, targetName];
      if (isAdding) {
        saveVault(finalAnswersWithTarget, themeIcon);
      } else if (isDecrypting) {
        decryptVault(finalAnswersWithTarget);
      }
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setAnswers(answers.slice(0, -1));
    }
  };

  const exportData = () => {
    const defaultName = `zero-knowledge-vault-backup-${new Date().toISOString().split('T')[0]}`;
    const fileName = prompt('バックアップファイル名を入力してください（拡張子 .json は自動で付与されます）', defaultName);
    
    if (fileName === null) return; // Cancelled

    const dataStr = JSON.stringify(vaults, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileName || defaultName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setLoading(true);
        const res = await fetch('/api/vaults/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vaults: json })
        });
        if (res.ok) {
          fetchVaults();
          alert('データの復元が完了しました。');
        } else {
          throw new Error('Restore failed');
        }
      } catch (err) {
        setError('データの読み込みに失敗しました。正しいバックアップファイルか確認してください。');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const saveVault = async (finalAnswers: string[], themeIcon: string) => {
    setLoading(true);
    try {
      if (isStandalone) {
        const { encryptedData, iv, salt } = await cryptoHelpers.encrypt(password, finalAnswers);
        const newItem: VaultItem = {
          id: Date.now(),
          title,
          encrypted_password: encryptedData,
          iv,
          salt,
          questions,
          theme: themeIcon,
          theme_label: theme || '',
          created_at: new Date().toISOString()
        };
        const updated = [newItem, ...vaults];
        setVaults(updated);
        localStorage.setItem('zk_vault_data', JSON.stringify(updated));
        setIsAdding(false);
        resetForm();
      } else {
        const res = await fetch('/api/vaults', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            password,
            questions,
            answers: finalAnswers,
            theme: themeIcon,
            theme_label: theme
          })
        });
        if (res.ok) {
          setIsAdding(false);
          resetForm();
          fetchVaults();
        }
      }
    } catch (err) {
      setError("保存に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const decryptVault = async (finalAnswers: string[]) => {
    setLoading(true);
    try {
      if (isStandalone && isDecrypting) {
        const decrypted = await cryptoHelpers.decrypt(
          isDecrypting.encrypted_password || '',
          isDecrypting.iv || '',
          isDecrypting.salt || '',
          finalAnswers
        );
        if (decrypted) {
          setDecryptedPassword(decrypted);
        } else {
          setError("復号に失敗しました。回答または対象の名前が間違っています。");
        }
      } else {
        const res = await fetch(`/api/vaults/${isDecrypting?.id}/decrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers: finalAnswers })
        });
        const data = await res.json();
        if (res.ok) {
          setDecryptedPassword(data.password);
        } else {
          setError(data.error || "復号に失敗しました。回答または対象の名前が間違っています。");
        }
      }
    } catch (err) {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const deleteVault = async (id: number) => {
    setLoading(true);
    try {
      if (isStandalone) {
        const updated = vaults.filter(v => v.id !== id);
        setVaults(updated);
        localStorage.setItem('zk_vault_data', JSON.stringify(updated));
      } else {
        await fetch(`/api/vaults/${id}`, { method: 'DELETE' });
      }
      setIsDeleting(null);
      setDeleteConfirmInput('');
      fetchVaults();
    } catch (err) {
      setError("削除に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPassword('');
    setTheme(null);
    setTargetName('');
    setIsReady(false);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setDecryptedPassword(null);
    setError(null);
    setDeleteConfirmInput('');
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
    setIsDecrypting(null);
    setIsDeleting(null);
  };

  const startDecrypting = (item: VaultItem) => {
    resetForm();
    setIsDecrypting(item);
    setQuestions(item.questions);
    // Use stored theme_label if available, otherwise fallback to icon lookup
    if (item.theme_label) {
      setTheme(item.theme_label);
    } else {
      const themeObj = THEMES.find(t => t.icon === item.theme);
      setTheme(themeObj ? themeObj.label : '秘密の対象');
    }
    setIsAdding(false);
    setIsDeleting(null);
  };

  const startDeleting = (item: VaultItem) => {
    resetForm();
    setIsDeleting(item);
    setIsAdding(false);
    setIsDecrypting(null);
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#1e1e2e] text-[#f8f8f2]' : 'bg-[#FFFBEC] text-[#2D3436]'} font-sans selection:bg-yellow-200`}>
      {/* Header */}
      <header className={`border-b-4 border-black transition-colors duration-500 ${isDarkMode ? 'bg-[#313244]' : 'bg-[#FFD93D]'} sticky top-0 z-10`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 border-4 border-black rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors ${isDarkMode ? 'bg-[#f5c2e7]' : 'bg-[#FF6B6B]'}`}>
              <Shield size={24} className={isDarkMode ? 'text-black' : 'text-white'} />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight uppercase line-clamp-1">ゼロ知識Vault</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Settings"
              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-4 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#94e2d5] text-black' : 'bg-white text-black'}`}
            >
              <Settings size={18} />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle dark mode"
              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-4 border-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#fab387] text-black' : 'bg-white text-black'}`}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={startAdding}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border-4 border-black font-bold hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all active:translate-y-[2px] active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#cba6f7] text-black' : 'bg-[#6C5CE7] text-white'}`}
            >
              <Plus size={18} />
              <span className="hidden xs:inline">新規作成</span>
              <span className="xs:hidden">追加</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Main Content Area */}
        <AnimatePresence mode="wait">
          {(!isAdding && !isDecrypting && !isDeleting) ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-6"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className={`text-lg font-black uppercase tracking-wider ${isDarkMode ? 'text-[#f5c2e7]' : 'text-[#2D3436]'}`}>保存された秘密</h2>
                <span className={`text-sm font-bold border-2 border-black px-3 py-1 rounded-full ${isDarkMode ? 'bg-[#94e2d5] text-black' : 'bg-[#A8E6CF] text-black'}`}>{vaults.length} 件</span>
              </div>
              
              {vaults.length === 0 ? (
                <div className={`border-4 border-black rounded-[2rem] p-8 sm:p-16 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-colors ${isDarkMode ? 'bg-[#313244]' : 'bg-white'}`}>
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-colors ${isDarkMode ? 'bg-[#f9e2af]' : 'bg-[#FAB1A0]'}`}>
                    <Key size={32} className={isDarkMode ? 'text-black' : 'text-white'} />
                  </div>
                  <p className="text-lg sm:text-xl font-bold mb-4">まだ秘密がありません</p>
                  <button 
                    onClick={startAdding} 
                    className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl border-4 border-black font-black hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${isDarkMode ? 'bg-[#89dceb] text-black' : 'bg-[#00CEC9] text-white'}`}
                  >
                    最初の秘密を作成する
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {vaults.map((item) => (
                    <motion.div 
                      key={item.id}
                      layoutId={`vault-${item.id}`}
                      className={`group border-4 border-black rounded-3xl p-5 flex flex-col gap-4 hover:translate-y-[-4px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#313244]' : 'bg-white'}`}
                      onClick={() => startDecrypting(item)}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`w-14 h-14 border-4 border-black rounded-2xl flex items-center justify-center text-3xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors ${isDarkMode ? 'bg-[#f2cdcd]' : 'bg-[#FDCB6E]'}`}>
                          {item.theme || '🔒'}
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); startDeleting(item); }}
                          className={`p-2 rounded-xl border-2 border-transparent hover:border-black transition-all ${isDarkMode ? 'text-[#f38ba8] hover:bg-[#f38ba8]/20' : 'text-zinc-400 hover:text-[#FF7675] hover:bg-[#FFEAA7]'}`}
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                      <div>
                        <h3 className="font-black text-xl mb-1 line-clamp-1">{item.title}</h3>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-bold ${isDarkMode ? 'text-[#a6adc8]' : 'text-zinc-500'}`}>
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                          {item.theme_label && (
                            <span className={`text-[10px] font-black uppercase tracking-tighter border-2 border-black px-2 py-0.5 rounded-lg ${isDarkMode ? 'bg-[#45475a] text-[#f5c2e7]' : 'bg-[#F1F2F6] text-zinc-600'}`}>
                              {item.theme_label}
                            </span>
                          )}
                          <div className={`flex items-center gap-1 font-bold text-xs ${isDarkMode ? 'text-[#cba6f7]' : 'text-[#6C5CE7]'}`}>
                            <span>解読する</span>
                            <ChevronRight size={14} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="interaction"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <div className={`rounded-[2rem] sm:rounded-[3rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden border-4 border-black transition-colors ${isDarkMode ? 'bg-[#1e1e2e]' : 'bg-white'}`}>
                {/* Interaction Header */}
                <div className={`p-6 sm:p-10 border-b-4 border-black relative overflow-hidden transition-colors duration-500 ${isDeleting ? (isDarkMode ? 'bg-[#f38ba8]' : 'bg-[#FF7675]') : (isDarkMode ? 'bg-[#a6e3a1]' : 'bg-[#55E6C1]')}`}>
                  <div className="absolute top-0 right-0 p-4 opacity-10 sm:opacity-20">
                    {isDeleting ? <Trash2 size={100} className="sm:w-[140px] sm:h-[140px]" /> : <Sparkles size={100} className="sm:w-[140px] sm:h-[140px]" />}
                  </div>
                  <button 
                    onClick={() => { setIsAdding(false); setIsDecrypting(null); setIsDeleting(null); resetForm(); }}
                    className={`absolute top-4 right-4 sm:top-6 sm:right-6 p-2 border-2 border-black rounded-full transition-colors z-20 ${isDarkMode ? 'bg-[#313244] text-white hover:bg-[#45475a]' : 'bg-white text-black hover:bg-zinc-100'}`}
                  >
                    <X size={20} />
                  </button>
                  <div className="relative z-10 text-black">
                    <h2 className="text-xl sm:text-3xl font-black mb-1 sm:mb-2 uppercase italic">
                      {isAdding ? '秘密を封印する' : isDeleting ? '秘密を消去' : `${isDecrypting?.title} を解読`}
                    </h2>
                    <p className="text-xs sm:text-base font-bold opacity-80">
                      {isAdding ? 'ランプのお姉さんの質問に答えて、あなただけの鍵を作ります' : isDeleting ? 'この操作は取り消せません！' : '記憶を呼び起こして、扉を開きましょう'}
                    </p>
                  </div>
                </div>

                <div className="p-6 sm:p-10">
                  {/* Deletion Confirmation Form */}
                  {isDeleting && (
                    <div className="space-y-8">
                      <div className={`border-4 border-black p-6 rounded-3xl text-black text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#f9e2af]' : 'bg-[#FFEAA7]'}`}>
                        <p className="font-black text-lg mb-2 flex items-center gap-2">
                          <AlertCircle size={24} />
                          最終確認！
                        </p>
                        <p className="font-bold">「{isDeleting.title}」を完全に削除します。確認のため、タイトルを正確に入力してください。</p>
                      </div>
                      <div className="space-y-3">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>タイトルを入力</label>
                        <input 
                          type="text" 
                          placeholder={isDeleting.title}
                          value={deleteConfirmInput}
                          onChange={(e) => setDeleteConfirmInput(e.target.value)}
                          className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => { setIsDeleting(null); resetForm(); }}
                          className={`py-4 border-4 border-black rounded-2xl font-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#313244] text-white hover:bg-[#45475a]' : 'bg-white text-black hover:bg-zinc-100'}`}
                        >
                          戻る
                        </button>
                        <button 
                          disabled={deleteConfirmInput !== isDeleting.title || loading}
                          onClick={() => deleteVault(isDeleting.id)}
                          className={`py-4 border-4 border-black rounded-2xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${isDarkMode ? 'bg-[#f38ba8] text-black' : 'bg-[#FF7675] text-white'}`}
                        >
                          {loading ? <RefreshCw className="animate-spin" size={24} /> : <Trash2 size={24} />}
                          <span>削除する</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Input Title & Password (Only for Adding) */}
                  {isAdding && !theme && (
                    <div className="space-y-8">
                      <div className="space-y-3">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>秘密のタイトル</label>
                        <input 
                          type="text" 
                          placeholder="例: Twitter, 秘密のメモ"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>隠したいパスワード</label>
                        <textarea 
                          placeholder="複数行の入力も可能です"
                          rows={4}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold resize-none ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>思い浮かべる対象の名前</label>
                        <input 
                          type="text" 
                          placeholder="例: 初恋の人の名前"
                          value={targetName}
                          onChange={(e) => setTargetName(e.target.value)}
                          className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                        />
                        <p className={`text-xs font-bold leading-tight p-3 border-2 border-black rounded-xl ${isDarkMode ? 'bg-[#89b4fa]/20 text-[#89b4fa]' : 'bg-[#E3F2FD] text-zinc-500'}`}>
                          💡 この名前は保存されません。復号時に正確に入力する必要があります。
                        </p>
                      </div>

                      <div className="space-y-3">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>カスタムテーマ（自由入力）</label>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                          <input 
                            type="text" 
                            placeholder="例: 宇宙, 魔法, 昭和レトロ"
                            value={customTheme}
                            onChange={(e) => setCustomTheme(e.target.value)}
                            className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                          />
                          <button
                            onClick={() => generateQuestions(customTheme, '✨')}
                            disabled={!title || !password || !customTheme || loading}
                            className={`w-full sm:w-auto px-8 py-4 border-4 border-black rounded-2xl font-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none disabled:opacity-50 ${isDarkMode ? 'bg-[#fab387] text-black' : 'bg-[#FFD93D] text-black'}`}
                          >
                            開始
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>またはプリセットから選択</label>
                        <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                          {THEMES.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => generateQuestions(t.label, t.icon)}
                              disabled={!title || !password || loading}
                              className={`p-3 sm:p-4 border-4 border-black rounded-2xl text-left transition-all flex flex-col gap-2 group disabled:opacity-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#313244] hover:bg-[#45475a]' : 'bg-white hover:bg-[#DFF9FB]'}`}
                            >
                              <span className="text-2xl sm:text-3xl">{t.icon}</span>
                              <p className="font-black text-xs sm:text-sm">{t.label}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Think of something message */}
                  {(isAdding || isDecrypting) && theme && questions.length > 0 && !isReady && !loading && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-10 py-6"
                    >
                      <div className={`text-8xl animate-bounce drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'text-[#f9e2af]' : ''}`}>💡</div>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-black italic uppercase">「{theme}」を<br/>1つ思い浮かべて...</h3>
                        <p className={`font-bold ${isDarkMode ? 'text-[#a6adc8]' : 'text-zinc-500'}`}>準備はいい？ランプのお姉さんがそれを当てるように質問するわ！</p>
                      </div>

                      {isDecrypting && (
                        <div className="max-w-xs mx-auto space-y-3 text-left">
                          <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>思い浮かべた対象の名前</label>
                          <input 
                            type="text" 
                            placeholder="保存時と同じ名前を入力"
                            value={targetName}
                            onChange={(e) => setTargetName(e.target.value)}
                            className={`w-full px-6 py-4 border-4 border-black rounded-2xl outline-none transition-all font-bold ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                          />
                        </div>
                      )}

                      <button 
                        disabled={isDecrypting && !targetName}
                        onClick={() => setIsReady(true)}
                        className={`px-12 py-5 rounded-2xl border-4 border-black font-black text-xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#cba6f7] text-black' : 'bg-[#6C5CE7] text-white'}`}
                      >
                        準備完了！
                      </button>
                    </motion.div>
                  )}

                  {/* Step 3: Questioning Flow */}
                  {questions.length > 0 && !decryptedPassword && !isDeleting && isReady && (isDecrypting || isAdding) && (
                    <div className="space-y-6 sm:space-y-10">
                      <div className="flex justify-between items-center">
                        <span className={`text-xs sm:text-sm font-black border-2 border-black px-3 sm:px-4 py-1 rounded-full ${isDarkMode ? 'bg-[#f9e2af] text-black' : 'bg-[#FFD93D] text-black'}`}>
                          質問 {currentQuestionIndex + 1} / {questions.length}
                        </span>
                        <div className="flex gap-1 sm:gap-1.5 overflow-x-auto max-w-[50%] no-scrollbar">
                          {questions.map((_, i) => (
                            <div key={i} className={`shrink-0 w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full border border-black ${i <= currentQuestionIndex ? (isDarkMode ? 'bg-[#cba6f7]' : 'bg-[#6C5CE7]') : 'bg-white'}`} />
                          ))}
                        </div>
                      </div>

                      <motion.div 
                        key={currentQuestionIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`min-h-[100px] sm:min-h-[140px] flex items-center justify-center border-4 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#313244]' : 'bg-[#F1F2F6]'}`}
                      >
                        <h3 className="text-lg sm:text-2xl font-black text-center leading-tight italic">
                          「{questions[currentQuestionIndex]}」
                        </h3>
                      </motion.div>

                      <div className="grid gap-3 sm:gap-4">
                        {(Object.keys(ANSWER_LABELS) as Answer[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => handleAnswer(key)}
                            disabled={loading}
                            className={`w-full py-3 sm:py-4 px-4 sm:px-8 border-4 border-black rounded-xl sm:rounded-2xl text-center font-black text-base sm:text-lg transition-all active:scale-[0.98] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] sm:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] sm:hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:shadow-none ${isDarkMode ? 'bg-[#313244] hover:bg-[#94e2d5] hover:text-black text-white' : 'bg-white hover:bg-[#55E6C1] text-black'}`}
                          >
                            {ANSWER_LABELS[key]}
                          </button>
                        ))}
                      </div>

                      {currentQuestionIndex > 0 && (
                        <button
                          onClick={handleBack}
                          className={`flex items-center justify-center gap-2 w-full py-3 border-4 border-black rounded-xl font-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#313244] text-[#a6adc8] hover:bg-[#45475a]' : 'bg-white text-zinc-500 hover:bg-zinc-50'}`}
                        >
                          <ArrowLeft size={18} />
                          <span>前の質問に戻る</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Step 3: Result */}
                  {decryptedPassword && !isDeleting && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-8 py-4"
                    >
                      <div className={`w-24 h-24 border-4 border-black rounded-full flex items-center justify-center mx-auto shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#a6e3a1]' : 'bg-[#55E6C1]'}`}>
                        <Unlock size={48} className="text-black" />
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-3xl font-black italic uppercase">解読成功！</h3>
                        <div className={`border-4 border-black p-6 rounded-3xl font-mono text-3xl tracking-wider break-all select-all cursor-pointer transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#313244] hover:bg-[#45475a]' : 'bg-[#F1F2F6] hover:bg-white'}`}>
                          {decryptedPassword}
                        </div>
                        <p className={`text-sm font-bold ${isDarkMode ? 'text-[#a6adc8]' : 'text-zinc-500'}`}>↑ クリックしてコピー ↑</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => { setIsDecrypting(null); resetForm(); }}
                          className={`py-4 border-4 border-black rounded-2xl font-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#313244] text-white hover:bg-[#45475a]' : 'bg-black text-white hover:bg-zinc-800'}`}
                        >
                          閉じる
                        </button>
                        <button 
                          onClick={() => { 
                            if (isDecrypting) {
                              startDeleting(isDecrypting);
                            }
                          }}
                          className={`py-4 border-4 border-black rounded-2xl font-black transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 ${isDarkMode ? 'bg-[#f38ba8] text-black hover:bg-[#f38ba8]/80' : 'bg-[#FF7675] text-white hover:bg-[#D63031]'}`}
                        >
                          <Trash2 size={24} />
                          <span>消去する</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Error State */}
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-8 p-6 border-4 border-black rounded-3xl flex items-start gap-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#f38ba8] text-black' : 'bg-[#FF7675] text-white'}`}
                    >
                      <AlertCircle size={28} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="text-lg font-black uppercase">エラー発生！</p>
                        <p className="font-bold opacity-90">{error}</p>
                        <button 
                          onClick={() => { setError(null); if (!isAdding && !isDecrypting && !isDeleting) fetchVaults(); else resetForm(); }}
                          className="mt-3 px-4 py-1 bg-white text-black border-2 border-black rounded-lg text-sm font-black hover:bg-zinc-100 transition-all"
                        >
                          やり直す
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {loading && !questions.length && !isDeleting && (
                    <div className="flex flex-col items-center justify-center py-16 space-y-6">
                      <RefreshCw className={`animate-spin ${isDarkMode ? 'text-[#cba6f7]' : 'text-[#6C5CE7]'}`} size={60} strokeWidth={3} />
                      <p className="text-xl font-black italic animate-pulse">ランプのお姉さんが考え中...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`w-full max-w-md border-4 border-black rounded-[2.5rem] p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] ${isDarkMode ? 'bg-[#1e1e2e]' : 'bg-white'}`}
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 border-2 border-black rounded-xl ${isDarkMode ? 'bg-[#94e2d5]' : 'bg-[#A8E6CF]'}`}>
                      <Sliders size={20} className="text-black" />
                    </div>
                    <h2 className="text-2xl font-black uppercase italic">AI設定</h2>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className={`p-2 rounded-xl border-2 border-transparent hover:border-black transition-all ${isDarkMode ? 'text-[#f38ba8]' : 'text-zinc-400'}`}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>Gemini API Key</label>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        placeholder="AI StudioのAPIキーを入力"
                        value={userApiKey}
                        onChange={(e) => setUserApiKey(e.target.value)}
                        className={`flex-1 px-4 py-3 border-4 border-black rounded-xl outline-none transition-all font-mono text-sm ${isDarkMode ? 'bg-[#313244] text-white focus:bg-[#45475a]' : 'bg-[#F1F2F6] text-black focus:bg-white'}`}
                      />
                      <button
                        onClick={() => fetchModels(userApiKey)}
                        disabled={isTestingConnection || !userApiKey}
                        className={`px-4 border-4 border-black rounded-xl font-bold text-xs transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none disabled:opacity-50 ${isDarkMode ? 'bg-[#94e2d5] text-black' : 'bg-[#A8E6CF] text-black'}`}
                      >
                        {isTestingConnection ? <RefreshCw size={14} className="animate-spin" /> : "テスト"}
                      </button>
                    </div>
                    <p className="text-[10px] font-bold opacity-60">※ 入力しない場合はデフォルトのキーを使用します</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-[#f5c2e7]' : 'text-black'}`}>使用するモデル</label>
                    </div>
                    <select 
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className={`w-full px-4 py-3 border-4 border-black rounded-xl outline-none transition-all font-bold appearance-none cursor-pointer ${isDarkMode ? 'bg-[#313244] text-white' : 'bg-[#F1F2F6] text-black'}`}
                    >
                      {availableModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {modelFetchError && (
                      <div className={`p-3 border-2 border-black rounded-xl text-[11px] font-bold flex items-start gap-2 ${isDarkMode ? 'bg-[#f38ba8]/20 text-[#f38ba8]' : 'bg-red-50 text-red-600'}`}>
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>{modelFetchError}</span>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={saveSettings}
                    className={`w-full py-4 border-4 border-black rounded-2xl font-black text-lg transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-[2px] active:shadow-none ${isDarkMode ? 'bg-[#a6e3a1] text-black' : 'bg-[#55E6C1] text-black'}`}
                  >
                    設定を保存
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Decoration */}
      <footer className={`max-w-4xl mx-auto px-6 py-12 text-center space-y-6`}>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={exportData}
            className={`flex items-center gap-2 px-4 py-2 border-2 border-black rounded-xl font-bold text-xs transition-all hover:translate-y-[-2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[0px] active:shadow-none ${isDarkMode ? 'bg-[#45475a] text-[#f5c2e7]' : 'bg-white text-zinc-600'}`}
          >
            <Download size={14} />
            バックアップを保存
          </button>
          <label className={`flex items-center gap-2 px-4 py-2 border-2 border-black rounded-xl font-bold text-xs cursor-pointer transition-all hover:translate-y-[-2px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[0px] active:shadow-none ${isDarkMode ? 'bg-[#45475a] text-[#f5c2e7]' : 'bg-white text-zinc-600'}`}>
            <Upload size={14} />
            復元（読み込み）
            <input type="file" accept=".json" onChange={importData} className="hidden" />
          </label>
        </div>
        <p className={`font-bold text-sm ${isDarkMode ? 'text-[#a6adc8]' : 'text-zinc-500'}`}>© 2026 ゼロ知識Vault - あなたの記憶が最強の鍵になる</p>
      </footer>
    </div>
  );
}
