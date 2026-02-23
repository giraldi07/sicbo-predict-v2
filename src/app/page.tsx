
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BrainCircuit, 
  Trash2, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  BarChart3,
  Wallet,
  Zap,
  History as HistoryIcon,
  Settings2,
  Trophy,
  Dices,
  ShieldCheck,
  Flame,
  Bomb,
  Activity,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { supabase } from '@/lib/supabase';

const MULTIPLIERS = [
  { level: 1, multiplier: 1, text: "Lvl 1" },
  { level: 2, multiplier: 3, text: "Lvl 2" },
  { level: 3, multiplier: 8, text: "Lvl 3" },
  { level: 4, multiplier: 24, text: "Lvl 4" },
  { level: 5, multiplier: 72, text: "Lvl 5" },
  { level: 6, multiplier: 216, text: "Lvl 6" }
];

const DEFAULT_CAPITAL = 1000000;
const DEFAULT_BET = 10000;

export default function SicboOracle() {
  const [initialCapital, setInitialCapital] = useState(DEFAULT_CAPITAL);
  const [balance, setBalance] = useState(DEFAULT_CAPITAL);
  const [baseBet, setBaseBet] = useState(DEFAULT_BET);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [currentRoll, setCurrentRoll] = useState<number[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const [prediction, setPrediction] = useState<PredictSicBoOutcomeOutput | null>(null);
  const [leopardStatus, setLeopardStatus] = useState<PredictLeopardOpportunityOutput | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('game_history')
        .select('*')
        .order('createdAt', { ascending: false })
        .limit(50);

      if (error) {
        if (error.message.includes("Forbidden")) {
          setConfigError("Kunci API yang Anda gunakan adalah 'Secret Key'. Harap ganti dengan 'Anon Public Key' di src/lib/supabase.ts agar dapat berjalan di browser.");
        }
        throw error;
      }
      
      const gameHistory = data || [];
      setHistory(gameHistory);
      setConfigError(null);
      
      if (gameHistory.length > 0) {
        setBalance(Number(gameHistory[0].currentBalance));
      } else {
        setBalance(initialCapital);
      }
    } catch (err: any) {
      console.error("Supabase Error:", err.message || err);
    } finally {
      setLoadingHistory(false);
    }
  }, [initialCapital]);

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel('game_history_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_history' },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHistory]);

  const stats = useMemo(() => {
    if (history.length === 0) return { winRate: 0, profit: 0, totalGames: 0 };
    const sizeWins = history.filter(h => h.isCorrectSize === true).length;
    return {
      winRate: Math.round((sizeWins / history.length) * 100),
      profit: balance - initialCapital,
      totalGames: history.length
    };
  }, [history, balance, initialCapital]);

  const currentLossStreak = useMemo(() => {
    let streak = 0;
    for (const roll of history) {
      if (roll.isCorrectSize === false && !roll.isLeopard) streak++;
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
      const formattedHistory = currentHistory.slice(0, 40).map(h => ({
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
      console.error("AI Failure:", error);
    } finally {
      setLoadingAI(false);
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) {
      updatePredictions(history);
    }
  }, [history.length, updatePredictions]);

  const processRoll = useCallback(async (roll: number[]) => {
    const total = roll.reduce((a, b) => a + b, 0);
    const isLeopard = roll[0] === roll[1] && roll[1] === roll[2];
    const isBig = !isLeopard && total >= 11;
    const isOdd = total % 2 !== 0;
    
    const predictedSize = prediction?.predictedSize;
    const predictedParity = prediction?.predictedParity;

    let isCorrectSize = false;
    let isCorrectParity = false;
    
    if (!isLeopard && predictedSize) {
      isCorrectSize = (isBig ? 'BIG' : 'SMALL') === predictedSize;
      isCorrectParity = (isOdd ? 'ODD' : 'EVEN') === (predictedParity || 'EVEN');
    }

    let newBalance = balance;
    if (predictedSize) {
      if (isCorrectSize) {
        newBalance += suggestedBet;
        toast({ title: `HIT! + Rp ${suggestedBet.toLocaleString()}`, className: "bg-accent text-white" });
      } else {
        newBalance -= suggestedBet;
        toast({ title: `MISS - Rp ${suggestedBet.toLocaleString()}`, variant: "destructive" });
      }
    }

    const newEntry = {
      dice: roll,
      total,
      isBig,
      isLeopard,
      isOdd,
      isCorrectSize: isLeopard ? false : isCorrectSize,
      isCorrectParity: isLeopard ? false : isCorrectParity,
      betAmount: suggestedBet,
      currentBalance: newBalance,
      predictionSize: predictedSize || null,
      predictionParity: predictedParity || null,
      createdAt: new Date().toISOString()
    };

    const { error } = await supabase.from('game_history').insert([newEntry]);
    
    if (error) {
      console.error("Supabase Insert Error:", error.message);
      toast({ title: "Gagal menyimpan ke Cloud. Pastikan RLS diizinkan dan tabel sudah ada.", variant: "destructive" });
    } else {
      setBalance(newBalance);
      setCurrentRoll([]);
    }
  }, [balance, suggestedBet, prediction]);

  const handleNumberClick = (num: number) => {
    if (currentRoll.length < 3) {
      const newRoll = [...currentRoll, num];
      setCurrentRoll(newRoll);
      if (newRoll.length === 3) processRoll(newRoll);
    }
  };

  const simulateRoll = () => {
    const dice = [0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1);
    processRoll(dice);
  };

  const resetAll = async () => {
    try {
      const { error } = await supabase.from('game_history').delete().neq('total', -1);
      
      if (error) throw error;

      setBalance(initialCapital);
      setPrediction(null);
      setLeopardStatus(null);
      setCurrentRoll([]);
      setHistory([]);
      setShowResetModal(false);
      toast({ title: "Supabase Cloud Berhasil Dibersihkan" });
    } catch (err: any) {
      console.error("Reset Error:", err.message);
      toast({ title: "Gagal menghapus data", variant: "destructive" });
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground">
      <header className="sticky top-0 z-[100] bg-[#050505]/90 backdrop-blur-2xl border-b border-white/5 py-3 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
              <BrainCircuit className="text-white" size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black tracking-tighter text-white uppercase italic leading-none">Oracle AI <span className="text-primary font-normal">Supabase</span></h1>
              <p className="text-[8px] text-muted-foreground font-black flex items-center gap-1 tracking-[0.2em] uppercase mt-0.5">
                <ShieldCheck size={10} className="text-accent" /> Cloud Storage Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
              <Wallet className="text-accent hidden xs:block" size={18} />
              <div className="text-right sm:text-left">
                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1">Live Bankroll</p>
                <p className="text-sm sm:text-base font-black text-white leading-none">{formatIDR(balance)}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setShowResetModal(true)} 
              className="border-destructive/30 hover:bg-destructive/10 rounded-xl w-10 h-10 shrink-0"
            >
              <Trash2 className="text-destructive" size={18} />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
        {configError && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 rounded-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Configuration Error</AlertTitle>
            <AlertDescription className="text-xs font-medium pt-1">
              {configError}
            </AlertDescription>
          </Alert>
        )}

        {loadingHistory && !configError && (
          <div className="flex items-center justify-center p-12 gap-3 text-primary">
            <Loader2 className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Cloud...</span>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Oracle Winrate', value: `${stats.winRate}%`, icon: Trophy, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Net Profit', value: formatIDR(stats.profit), icon: TrendingUp, color: stats.profit >= 0 ? 'text-accent' : 'text-destructive', bg: stats.profit >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
            { label: 'Total Games', value: `${stats.totalGames} Rounds`, icon: HistoryIcon, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Current Risk', value: currentLossStreak > 3 ? 'EXTREME' : 'STABLE', icon: Activity, color: currentLossStreak > 3 ? 'text-destructive' : 'text-accent', bg: currentLossStreak > 3 ? 'bg-destructive/10' : 'bg-accent/10' },
          ].map((stat, i) => (
            <Card key={i} className="border-white/5 bg-white/5 rounded-2xl">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2.5 rounded-lg shrink-0", stat.bg)}>
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">{stat.label}</p>
                  <p className="text-sm font-black text-white leading-none">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-primary/30 bg-gradient-to-br from-[#0a0a0a] to-[#000] overflow-hidden shadow-2xl relative rounded-3xl">
              {loadingAI && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center space-y-4">
                  <Zap className="text-primary animate-pulse" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">Neural AI Scanning Patterns...</p>
                </div>
              )}
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/2 px-6 py-4">
                <CardTitle className="text-[10px] font-black text-white uppercase flex items-center gap-2 tracking-[0.2em]">
                  <Target size={14} className="text-primary" /> Prediction Engine
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button onClick={simulateRoll} variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-primary">
                    AI Simulate
                  </Button>
                  <Badge className="bg-accent text-white text-[8px] px-2 py-0.5 font-black">ONLINE</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-10 space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="text-center md:text-left">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">Next Outcome</p>
                    <h2 className={cn("text-7xl sm:text-9xl font-black tracking-tighter italic transition-all duration-500", 
                      prediction?.predictedSize === 'BIG' ? 'text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]' : 
                      prediction?.predictedSize === 'SMALL' ? 'text-accent drop-shadow-[0_0_30px_rgba(13,148,136,0.3)]' : 'text-white/5'
                    )}>
                      {prediction?.predictedSize || '---'}
                    </h2>
                    <div className="flex items-center justify-center md:justify-start gap-3 mt-4">
                      <Badge variant="outline" className="border-white/10 text-white font-black uppercase px-3 py-0.5 text-[10px]">{prediction?.predictedParity || 'WAITING'}</Badge>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest">Conf: {prediction?.confidence || 0}%</span>
                    </div>
                  </div>

                  <div className="bg-white/5 p-6 sm:p-8 rounded-2xl border border-white/10 w-full md:w-auto text-center md:text-right">
                    <p className="text-[9px] font-black uppercase text-muted-foreground mb-1 tracking-widest">Suggested Bet</p>
                    <p className="text-3xl sm:text-4xl font-black text-white">{formatIDR(suggestedBet)}</p>
                    <div className="mt-3 flex items-center justify-center md:justify-end gap-2">
                       <Badge className="bg-primary/20 text-primary text-[9px] font-black px-2 uppercase tracking-tighter">Level {betLevel + 1}</Badge>
                       <Badge className="bg-white/10 text-white text-[9px] font-black px-2">X{MULTIPLIERS[betLevel].multiplier}</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white/2 rounded-xl p-5 border-l-4 border-primary relative overflow-hidden">
                  <p className="text-xs sm:text-sm text-white/80 font-medium italic leading-relaxed">
                    "{prediction?.reason || "Input minimal 3 data histori untuk mengaktifkan AI Oracle."}"
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
               <Card className={cn("border-2 rounded-2xl transition-all duration-700", 
                leopardStatus?.recommendation === 'STRONG_BUY' ? 'border-amber-500 bg-amber-500/10' : 
                leopardStatus?.recommendation === 'BET_HEAVY' ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-white/2')}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-lg text-white italic tracking-tight uppercase flex items-center gap-2">
                       <Dices size={20} className="text-amber-500" /> Leopard Opportunity
                    </h3>
                    {leopardStatus?.recommendation && (
                      <Badge className={cn("text-[9px] font-black", 
                        leopardStatus.recommendation === 'STRONG_BUY' ? 'bg-red-600 animate-bounce' : 'bg-amber-500 text-black'
                      )}>{leopardStatus.recommendation}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5 text-center">
                      <p className="text-[8px] text-muted-foreground font-black uppercase mb-1">Interval</p>
                      <p className="text-2xl font-black text-white">{leopardStatus?.rollsSinceLastLeopard ?? '0'}</p>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 border border-white/5 text-center flex flex-col justify-center">
                      <p className="text-[8px] text-muted-foreground font-black uppercase mb-1">Sleeper Status</p>
                      <p className={cn("text-[10px] font-black uppercase italic", leopardStatus?.isLeopardOpportunity ? 'text-amber-500 animate-pulse' : 'text-white/20')}>
                        {leopardStatus?.isLeopardOpportunity ? 'HOT' : 'COLD'}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-white/50 italic leading-snug">
                    {leopardStatus?.reasoning || "Menunggu data untuk analisis anomali triple..."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-white/2 rounded-2xl p-6">
                <h3 className="font-black text-lg text-white italic tracking-tight uppercase mb-4 flex items-center gap-2">
                  <Flame size={20} className="text-red-500" /> Hot Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground">SIZE PREDICTION</span>
                    <span className="text-white bg-primary/20 px-2 py-0.5 rounded-md">{prediction?.predictedSize || '---'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-muted-foreground">PARITY PREDICTION</span>
                    <span className="text-white bg-accent/20 px-2 py-0.5 rounded-md">{prediction?.predictedParity || '---'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold border-t border-white/5 pt-2">
                    <span className="text-primary uppercase">NEXT RECOVERY</span>
                    <span className="text-white font-black">{formatIDR(suggestedBet)}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-white/10 bg-[#0a0a0a] rounded-3xl overflow-hidden">
              <CardHeader className="bg-white/2 px-6 py-4">
                <CardTitle className="text-[9px] font-black uppercase text-white tracking-widest">
                  Manual Input Sensor
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black border transition-all duration-300", 
                      currentRoll[i] ? 'bg-primary border-primary text-white scale-110 shadow-lg' : 'bg-white/2 border-white/5 text-white/5'
                    )}>
                      {currentRoll[i] || '?'}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <Button 
                      key={n} 
                      onClick={() => handleNumberClick(n)} 
                      className="h-14 text-xl font-black bg-white/5 hover:bg-primary rounded-xl border border-white/5 transition-all"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0a0a0a] rounded-3xl">
              <CardHeader className="px-6 py-4 border-b border-white/5">
                <CardTitle className="text-[9px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <Settings2 size={14} /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                    <Wallet size={10}/> Initial Capital (IDR)
                  </label>
                  <Input 
                    type="number" 
                    value={initialCapital} 
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    disabled={history.length > 0}
                    className="bg-black border-white/10 font-black h-10 text-xs rounded-xl focus:ring-primary text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-1">
                    <Bomb size={10}/> Base Bet Unit (IDR)
                  </label>
                  <Input 
                    type="number" 
                    value={baseBet} 
                    onChange={(e) => setBaseBet(Number(e.target.value))}
                    className="bg-black border-white/10 font-black h-10 text-xs rounded-xl focus:ring-primary text-white"
                  />
                </div>
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[8px] font-black text-muted-foreground uppercase mb-3 tracking-widest text-center">Martingale Ladder</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MULTIPLIERS.map((m, i) => (
                      <div key={i} className={cn("p-2 rounded-lg flex flex-col items-center border transition-all", 
                        i === betLevel ? 'bg-primary border-primary text-white font-black' : 'bg-white/2 border-white/5 text-muted-foreground'
                      )}>
                        <span className="text-[7px] uppercase leading-none mb-1">{m.text}</span>
                        <span className="text-[10px] font-black leading-none">X{m.multiplier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {history.length > 0 && (
          <Card className="border-white/10 bg-[#0a0a0a] rounded-3xl overflow-hidden shadow-2xl">
            <CardHeader className="bg-white/2 p-5 border-b border-white/5">
              <CardTitle className="text-[9px] font-black uppercase text-white tracking-[0.3em] flex items-center gap-2">
                <BarChart3 size={16} /> Cloud Audit Log
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-black/40 text-[9px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                    <th className="p-4 text-left pl-8">Pattern</th>
                    <th className="p-4">Sum</th>
                    <th className="p-4">Result</th>
                    <th className="p-4">Oracle Check</th>
                    <th className="p-4 text-right pr-8">Bankroll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((row: any, i: number) => (
                    <tr key={row.id || i} className="hover:bg-white/2 transition-colors">
                      <td className="p-4 pl-8">
                        <div className="flex justify-start gap-1">
                          {row.dice.map((d: number, idx: number) => (
                            <span key={idx} className={cn("w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] border", 
                              row.isLeopard ? 'bg-amber-500 border-amber-600 text-black' : 'bg-white/10 border-white/20 text-white'
                            )}>{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 font-black text-white">{row.total}</td>
                      <td className="p-4">
                         <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-black px-3 py-1 rounded-full text-[9px] uppercase tracking-wider", 
                              row.isLeopard ? 'bg-amber-500 text-black' : 
                              row.isBig ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
                            )}>
                              {row.isLeopard ? 'TRIPLE' : row.isBig ? 'BIG' : 'SMALL'}
                            </span>
                         </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-3">
                            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black border", 
                                row.isCorrectSize ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-white/20'
                            )}>
                                {row.isCorrectSize ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                SIZE
                            </div>
                            <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black border", 
                                row.isCorrectParity ? 'bg-accent/20 border-accent/30 text-accent' : 'bg-white/5 border-white/10 text-white/20'
                            )}>
                                {row.isCorrectParity ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                PARITY
                            </div>
                        </div>
                      </td>
                      <td className="p-4 text-right pr-8">
                         <div className="flex flex-col items-end">
                            <span className="font-black text-white text-[12px]">{formatIDR(row.currentBalance)}</span>
                            <span className={cn("text-[8px] font-black mt-1", row.isCorrectSize ? 'text-accent' : 'text-destructive')}>
                               {row.isCorrectSize ? '+' : '-'}{formatIDR(row.betAmount)}
                            </span>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-destructive uppercase italic">Purge Cloud Data?</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-3 text-xs">
              Seluruh histori di Supabase akan dihapus permanen. Saldo akan kembali ke modal awal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 gap-2">
            <Button variant="secondary" onClick={() => setShowResetModal(false)} className="rounded-xl h-10 px-4 text-[10px] font-black uppercase">Cancel</Button>
            <Button variant="destructive" onClick={resetAll} className="rounded-xl h-10 px-4 text-[10px] font-black uppercase tracking-widest">Wipe Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
