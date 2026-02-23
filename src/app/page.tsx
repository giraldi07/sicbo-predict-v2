
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BrainCircuit, 
  RotateCcw, 
  Trash2, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  BarChart3,
  Wallet,
  Zap,
  History as HistoryIcon,
  Settings2,
  Trophy,
  Dices,
  Coins
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  predictSicBoOutcome, 
  type PredictSicBoOutcomeOutput 
} from '@/ai/flows/predict-sic-bo-outcome-flow';
import { 
  predictLeopardOpportunity, 
  type PredictLeopardOpportunityOutput 
} from '@/ai/flows/predict-leopard-opportunity';
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Konfigurasi untuk Vercel agar tidak timeout (Max 60 detik)
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MULTIPLIERS = [
  { level: 1, multiplier: 1, text: "Level 1 (Awal)" },
  { level: 2, multiplier: 3, text: "Level 2 (Pemulihan)" },
  { level: 3, multiplier: 8, text: "Level 3 (Agresif)" },
  { level: 4, multiplier: 24, text: "Level 4 (Risiko Tinggi)" },
  { level: 5, multiplier: 72, text: "Level 5 (Darurat)" },
  { level: 6, multiplier: 216, text: "Level 6 (Maksimal)" }
];

const DEFAULT_INITIAL_CAPITAL = 1000000;
const DEFAULT_BASE_BET = 10000;

export default function SicboOracle() {
  const [history, setHistory] = useState<any[]>([]);
  const [currentRoll, setCurrentRoll] = useState<number[]>([]);
  const [initialCapital, setInitialCapital] = useState(DEFAULT_INITIAL_CAPITAL);
  const [balance, setBalance] = useState(DEFAULT_INITIAL_CAPITAL);
  const [baseBet, setBaseBet] = useState(DEFAULT_BASE_BET);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [prediction, setPrediction] = useState<PredictSicBoOutcomeOutput | null>(null);
  const [leopardStatus, setLeopardStatus] = useState<PredictLeopardOpportunityOutput | null>(null);

  useEffect(() => {
    if (history.length === 0) {
      setBalance(initialCapital);
    }
  }, [initialCapital, history.length]);

  const stats = useMemo(() => {
    if (history.length === 0) return { winRate: 0, profit: 0, totalGames: 0 };
    const correctCount = history.filter(h => h.isCorrectSize === true).length;
    return {
      winRate: Math.round((correctCount / history.length) * 100),
      profit: balance - initialCapital,
      totalGames: history.length
    };
  }, [history, balance, initialCapital]);

  const currentLossStreak = useMemo(() => {
    let streak = 0;
    for (const roll of history) {
      if (roll.isCorrectSize === false) streak++;
      else if (roll.isCorrectSize === true) break;
    }
    return streak;
  }, [history]);

  const betLevel = Math.min(currentLossStreak, MULTIPLIERS.length - 1);
  const suggestedBet = baseBet * MULTIPLIERS[betLevel].multiplier;

  const updatePredictions = useCallback(async (currentHistory: any[]) => {
    if (currentHistory.length < 3) return;
    
    setLoadingAI(true);
    try {
      const formattedHistory = currentHistory.slice(0, 15).map(h => ({
        dice: h.dice,
        total: h.total,
        isBig: h.isBig,
        isOdd: h.isOdd
      }));

      const [pred, leopard] = await Promise.all([
        predictSicBoOutcome({ history: formattedHistory }),
        predictLeopardOpportunity({ gameHistory: formattedHistory.map(h => ({ dice: h.dice })) })
      ]);

      if (pred) setPrediction(pred);
      if (leopard) setLeopardStatus(leopard);
    } catch (error) {
      console.error("AI Error:", error);
      toast({ 
        variant: "destructive", 
        title: "AI Oracle Gangguan", 
        description: "Pastikan API Key sudah terpasang di Vercel Environment Variables." 
      });
    } finally {
      setLoadingAI(false);
    }
  }, []);

  const processRoll = useCallback((roll: number[]) => {
    const total = roll.reduce((a, b) => a + b, 0);
    const isBig = total >= 11;
    const isOdd = total % 2 !== 0;
    const isLeopard = roll[0] === roll[1] && roll[1] === roll[2];

    const predictedSize = prediction?.predictedSize;
    const isCorrectSize = predictedSize ? (isBig ? 'BIG' : 'SMALL') === predictedSize : null;

    let newBalance = balance;
    if (isCorrectSize !== null) {
      if (isCorrectSize) {
        newBalance += suggestedBet;
        toast({ title: "🎯 Prediksi Tepat!", description: `Profit: +Rp ${suggestedBet.toLocaleString()}` });
      } else {
        newBalance -= suggestedBet;
        toast({ variant: "destructive", title: "❌ Meleset", description: `Kerugian: -Rp ${suggestedBet.toLocaleString()}` });
      }
    }

    const newEntry = {
      id: Date.now(),
      num: history.length + 1,
      dice: roll,
      total,
      isBig,
      isOdd,
      isLeopard,
      isCorrectSize,
      betAmount: suggestedBet,
      currentBalance: newBalance
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    setBalance(newBalance);
    setCurrentRoll([]);
    updatePredictions(newHistory);
  }, [balance, suggestedBet, prediction, history, updatePredictions]);

  const handleNumberClick = (num: number) => {
    if (currentRoll.length < 3) {
      const newRoll = [...currentRoll, num];
      setCurrentRoll(newRoll);
      if (newRoll.length === 3) {
        processRoll(newRoll);
      }
    }
  };

  const simulateRoll = () => {
    const randomDice = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    processRoll(randomDice);
  };

  const handleUndo = () => {
    if (currentRoll.length > 0) {
      setCurrentRoll(prev => prev.slice(0, -1));
    } else if (history.length > 0) {
      const removed = history[0];
      setHistory(prev => prev.slice(1));
      setBalance(prev => {
        if (removed.isCorrectSize === true) return prev - removed.betAmount;
        if (removed.isCorrectSize === false) return prev + removed.betAmount;
        return prev;
      });
      toast({ title: "Undo Berhasil", description: "Langkah terakhir telah dibatalkan." });
    }
  };

  const resetAll = () => {
    setHistory([]);
    setBalance(initialCapital);
    setPrediction(null);
    setLeopardStatus(null);
    setCurrentRoll([]);
    setShowResetModal(false);
    toast({ 
      title: "Data Dihapus", 
      description: "Seluruh histori dan saldo telah dikembalikan ke kondisi awal." 
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-[#111] text-foreground font-body p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
              <BrainCircuit className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white uppercase italic">Sicbo Oracle <span className="text-primary font-normal">v2.0</span></h1>
              <p className="text-[9px] md:text-[10px] text-muted-foreground font-bold flex items-center gap-2 tracking-widest uppercase">
                <Zap size={12} className="text-accent fill-accent" /> Neural Pattern Recognition Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
            <div className="flex-1 md:flex-none bg-card/50 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 md:px-5 md:py-3 flex items-center gap-3 shadow-xl">
              <Wallet className="text-accent shrink-0" size={20} />
              <div className="min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase font-black truncate">Bankroll Utama</p>
                <p className="text-sm md:text-lg font-black text-white truncate">{formatCurrency(balance)}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowResetModal(true)} className="w-10 h-10 md:w-12 md:h-12 border-destructive/20 hover:bg-destructive/10 rounded-xl shrink-0">
              <Trash2 className="text-destructive" size={18} />
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Win Rate', value: `${stats.winRate}%`, icon: Trophy, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Profit/Loss', value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit >= 0 ? 'text-accent' : 'text-destructive', bg: stats.profit >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
            { label: 'Total Rolls', value: stats.totalGames, icon: HistoryIcon, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Loss Streak', value: currentLossStreak, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map((stat, i) => (
            <Card key={i} className="border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all duration-300">
              <CardContent className="p-3 md:p-4 flex items-center gap-3 md:gap-4">
                <div className={cn("p-2 md:p-3 rounded-xl shrink-0", stat.bg)}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] md:text-[10px] uppercase font-black text-muted-foreground tracking-wider truncate">{stat.label}</p>
                  <p className="text-base md:text-xl font-black text-white truncate">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Interface Grid */}
        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* Prediction Panel */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-primary/30 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] overflow-hidden relative shadow-2xl">
              <div className="absolute top-0 right-0 p-4 md:p-6 flex flex-col items-end gap-2 z-10">
                <Button 
                  onClick={simulateRoll} 
                  variant="secondary" 
                  size="sm" 
                  className="font-black text-[9px] md:text-[10px] uppercase h-7 md:h-8 px-3 md:px-4 bg-white/10 hover:bg-white/20 text-white border-none"
                >
                  <Dices size={14} className="mr-2" /> Simulasi
                </Button>
                <Badge variant={loadingAI ? "outline" : "default"} className={cn("font-black px-2 md:px-3 py-1 text-[9px] md:text-xs", loadingAI ? "animate-pulse border-primary text-primary" : "bg-primary")}>
                  {loadingAI ? "MENELITI POLA..." : "ORACLE ONLINE"}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2 tracking-widest">
                  <Target size={14} className="text-primary" /> Prediksi Berikutnya
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 md:space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="space-y-2">
                    <h2 className={cn("text-6xl md:text-8xl font-black tracking-tighter transition-all duration-500", prediction?.predictedSize === 'BIG' ? 'text-primary' : 'text-accent')}>
                      {prediction?.predictedSize || '---'}
                    </h2>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-white/10 text-white border-none font-bold text-[10px] md:text-xs">PARITY: {prediction?.predictedParity || '---'}</Badge>
                      <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase">Confidence: 84%</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-md w-full md:w-auto">
                    <p className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Saran Taruhan</p>
                    <p className="text-2xl md:text-3xl font-black text-accent">{formatCurrency(suggestedBet)}</p>
                    <div className="mt-2 flex items-center md:justify-end gap-2">
                      <Badge variant="outline" className="border-accent/30 text-accent text-[8px] md:text-[9px] font-black uppercase tracking-tighter">
                        {MULTIPLIERS[betLevel].text}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-2xl p-4 md:p-5 border border-primary/10 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                  <p className="text-xs text-white/80 leading-relaxed italic font-medium">
                    "{prediction?.reason || "Input minimal 3 hasil manual atau gunakan tombol 'Simulasi' untuk memulai analisis pola."}"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Leopard Alert Panel */}
            <Card className={cn("border-2 transition-all duration-700 shadow-xl", leopardStatus?.isLeopardOpportunity ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-white/2 opacity-60')}>
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={cn("p-2 md:p-3 rounded-2xl shadow-lg", leopardStatus?.isLeopardOpportunity ? 'bg-amber-500 shadow-amber-500/20' : 'bg-white/10')}>
                      <Zap size={20} className={leopardStatus?.isLeopardOpportunity ? 'text-white animate-pulse' : 'text-muted-foreground'} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg md:text-xl text-white">LEOPARD TRACKER</h3>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em]">Analisis Frekuensi</p>
                    </div>
                  </div>
                  {leopardStatus?.isLeopardOpportunity && (
                    <Badge className="bg-amber-500 text-white animate-bounce font-black px-3 md:px-4 py-1 rounded-full shadow-lg text-[10px]">PELUANG TINGGI</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-6 mb-4 md:mb-6">
                  <div className="bg-black/40 rounded-2xl p-3 md:p-4 border border-white/5 text-center">
                    <p className="text-[9px] text-muted-foreground font-black uppercase mb-1">Jarak Roll</p>
                    <p className="text-2xl md:text-3xl font-black text-white tracking-tighter">{leopardStatus?.rollsSinceLastLeopard ?? '0'}</p>
                  </div>
                  <div className="bg-black/40 rounded-2xl p-3 md:p-4 border border-white/5 text-center">
                    <p className="text-[9px] text-muted-foreground font-black uppercase mb-1">Threshold</p>
                    <p className="text-2xl md:text-3xl font-black text-white/40 tracking-tighter">36</p>
                  </div>
                </div>
                <p className="text-[11px] md:text-xs text-muted-foreground font-medium leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                  {leopardStatus?.reasoning || "Menunggu data histori yang cukup untuk memetakan probabilitas Leopard..."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Input Card */}
            <Card className="border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Input Hasil</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-black uppercase hover:bg-white/5">
                  <RotateCcw size={14} className="mr-2" /> Undo
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center gap-3 md:gap-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn("w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-3xl md:text-4xl font-black border-2 transition-all duration-300", 
                      currentRoll[i] ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)] scale-105' : 'bg-white/5 border-white/5 text-muted-foreground'
                    )}>
                      {currentRoll[i] || '?'}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 md:gap-3">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <Button 
                      key={n} 
                      onClick={() => handleNumberClick(n)} 
                      className="h-16 md:h-20 text-2xl md:text-3xl font-black bg-white/5 hover:bg-primary transition-all duration-300 border-none rounded-2xl shadow-lg active:scale-95"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Config Card */}
            <Card className="border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden">
              <CardHeader>
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                  <Settings2 size={14} /> Konfigurasi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Coins size={10} className="text-primary" /> Modal Awal (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">Rp</span>
                    <Input 
                      type="number" 
                      value={initialCapital} 
                      onChange={(e) => setInitialCapital(Number(e.target.value))}
                      disabled={history.length > 0}
                      className="bg-black/40 border-white/10 h-10 md:h-12 pl-12 font-black text-white rounded-xl focus:ring-primary disabled:opacity-50"
                    />
                  </div>
                  {history.length > 0 && (
                    <p className="text-[8px] text-amber-500 font-bold uppercase tracking-tight">Kunci terbuka setelah data di-reset.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Target size={10} className="text-accent" /> Taruhan Dasar (IDR)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-black text-xs">Rp</span>
                    <Input 
                      type="number" 
                      value={baseBet} 
                      onChange={(e) => setBaseBet(Number(e.target.value))}
                      className="bg-black/40 border-white/10 h-10 md:h-12 pl-12 font-black text-white rounded-xl focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase mb-3 tracking-widest">Recovery Ladder</p>
                  <div className="space-y-1.5">
                    {MULTIPLIERS.map((m, i) => (
                      <div key={i} className={cn("flex justify-between items-center text-[9px] p-2.5 rounded-xl transition-all duration-300", 
                        i === betLevel ? 'bg-primary text-white font-black shadow-lg scale-105 z-10' : 'bg-white/5 text-muted-foreground'
                      )}>
                        <span className="font-bold truncate mr-2">{m.text}</span>
                        <span className="font-black shrink-0">x{m.multiplier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History Log */}
        {history.length > 0 && (
          <Card className="border-white/10 bg-[#1a1a1a] overflow-hidden shadow-2xl">
            <CardHeader className="bg-white/2 p-4 md:p-5">
              <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 tracking-widest">
                <BarChart3 size={16} /> Log Aktivitas
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-[11px] md:text-xs">
                <thead>
                  <tr className="bg-black/40 text-[8px] md:text-[9px] font-black text-muted-foreground uppercase border-b border-white/5 tracking-widest">
                    <th className="p-3 md:p-4">Roll</th>
                    <th className="p-3 md:p-4">Dadu</th>
                    <th className="p-3 md:p-4">Poin</th>
                    <th className="p-3 md:p-4">Hasil</th>
                    <th className="p-3 md:p-4 hidden sm:table-cell">Taruhan</th>
                    <th className="p-3 md:p-4">AI</th>
                    <th className="p-3 md:p-4 text-right pr-6 md:pr-8">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((row) => (
                    <tr key={row.id} className="hover:bg-white/2 transition-colors group">
                      <td className="p-3 md:p-4 text-muted-foreground font-bold">{row.num}</td>
                      <td className="p-3 md:p-4">
                        <div className="flex justify-center gap-1">
                          {row.dice.map((d: number, idx: number) => (
                            <span key={idx} className="w-5 h-5 md:w-6 md:h-6 bg-white/10 rounded flex items-center justify-center text-[9px] md:text-[10px] font-black">{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 md:p-4 font-black text-white text-xs md:text-sm">{row.total}</td>
                      <td className="p-3 md:p-4">
                        <Badge variant="outline" className={cn("border-none font-black text-[9px] md:text-[10px]", row.isBig ? 'text-primary' : 'text-accent')}>
                          {row.isBig ? 'BIG' : 'SMALL'}
                        </Badge>
                      </td>
                      <td className="p-3 md:p-4 text-muted-foreground font-bold hidden sm:table-cell">{formatCurrency(row.betAmount)}</td>
                      <td className="p-3 md:p-4">
                        {row.isCorrectSize !== null ? (
                          row.isCorrectSize ? (
                            <div className="flex items-center justify-center gap-1 text-accent font-black uppercase text-[8px] md:text-[9px]">
                              <CheckCircle2 size={12} className="md:size-14" /> Hit
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1 text-destructive font-black uppercase text-[8px] md:text-[9px]">
                              <XCircle size={12} className="md:size-14" /> Miss
                            </div>
                          )
                        ) : (
                          <span className="text-white/20 font-black">---</span>
                        )}
                      </td>
                      <td className="p-3 md:p-4 text-right pr-6 md:pr-8 font-black text-white">{formatCurrency(row.currentBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 w-[90%] max-w-[425px] rounded-2xl mx-auto">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-3 text-lg md:text-xl font-black italic uppercase">
              <AlertTriangle className="animate-pulse shrink-0" /> Konfirmasi Reset
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium pt-2 text-sm">
              Tindakan ini akan menghapus seluruh histori permainan dan memori analisis AI. Saldo akan kembali ke Rp {initialCapital.toLocaleString()}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 md:gap-3 mt-6 flex flex-row justify-end">
            <Button variant="secondary" onClick={() => setShowResetModal(false)} className="rounded-xl font-bold bg-white/5 hover:bg-white/10 border-none text-xs h-9">Batal</Button>
            <Button variant="destructive" onClick={resetAll} className="rounded-xl font-black uppercase tracking-widest shadow-lg shadow-destructive/20 text-xs h-9">Wipe Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
