"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BrainCircuit, 
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
  ShieldCheck,
  AlertCircle,
  Flame,
  Bomb
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
  const [history, setHistory] = useState<any[]>([]);
  const [currentRoll, setCurrentRoll] = useState<number[]>([]);
  const [initialCapital, setInitialCapital] = useState(DEFAULT_CAPITAL);
  const [balance, setBalance] = useState(DEFAULT_CAPITAL);
  const [baseBet, setBaseBet] = useState(DEFAULT_BET);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [prediction, setPrediction] = useState<PredictSicBoOutcomeOutput | null>(null);
  const [leopardStatus, setLeopardStatus] = useState<PredictLeopardOpportunityOutput | null>(null);

  useEffect(() => {
    if (history.length === 0) setBalance(initialCapital);
  }, [initialCapital, history.length]);

  const stats = useMemo(() => {
    if (history.length === 0) return { winRate: 0, profit: 0, totalGames: 0 };
    const wins = history.filter(h => h.isCorrectSize === true).length;
    return {
      winRate: Math.round((wins / history.length) * 100),
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
    if (currentHistory.length < 1) return;
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

  const processRoll = useCallback((roll: number[]) => {
    const total = roll.reduce((a, b) => a + b, 0);
    const isLeopard = roll[0] === roll[1] && roll[1] === roll[2];
    
    // Di Sic Bo, jika Triple muncul, Big dan Small biasanya kalah
    const isBig = !isLeopard && total >= 11;
    const isOdd = total % 2 !== 0;
    
    const predictedSize = prediction?.predictedSize;
    let isCorrectSize = false;
    
    if (!isLeopard && predictedSize) {
      isCorrectSize = (isBig ? 'BIG' : 'SMALL') === predictedSize;
    }

    let newBalance = balance;
    if (predictedSize) {
      if (isCorrectSize) {
        newBalance += suggestedBet;
        toast({ title: "HIT! + " + suggestedBet.toLocaleString(), className: "bg-accent text-white" });
      } else {
        newBalance -= suggestedBet;
        toast({ title: "MISS - " + suggestedBet.toLocaleString(), variant: "destructive" });
      }
    }

    const newEntry = {
      id: Date.now(),
      num: history.length + 1,
      dice: roll,
      total,
      isBig,
      isLeopard,
      isOdd,
      isCorrectSize: isLeopard ? false : isCorrectSize,
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
      if (newRoll.length === 3) processRoll(newRoll);
    }
  };

  const simulateRoll = () => {
    const dice = [0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1);
    processRoll(dice);
  };

  const resetAll = () => {
    setHistory([]);
    setBalance(initialCapital);
    setPrediction(null);
    setLeopardStatus(null);
    setCurrentRoll([]);
    setShowResetModal(false);
    toast({ title: "System Reset Successful" });
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 rotate-3">
              <BrainCircuit className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">Oracle AI <span className="text-primary font-normal">X-100</span></h1>
              <p className="text-[10px] text-muted-foreground font-black flex items-center gap-2 tracking-[0.2em] uppercase mt-1">
                <ShieldCheck size={12} className="text-accent" /> Neural Pattern Analyzer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-3 flex items-center gap-4 backdrop-blur-md">
              <Wallet className="text-accent" size={22} />
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Available Balance</p>
                <p className="text-lg font-black text-white">{formatIDR(balance)}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowResetModal(true)} className="border-destructive/30 hover:bg-destructive/10 rounded-2xl w-12 h-12">
              <Trash2 className="text-destructive" size={20} />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Oracle Accuracy', value: `${stats.winRate}%`, icon: Trophy, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Total Net P/L', value: formatIDR(stats.profit), icon: TrendingUp, color: stats.profit >= 0 ? 'text-accent' : 'text-destructive', bg: stats.profit >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
            { label: 'Cycle Count', value: stats.totalGames, icon: HistoryIcon, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Risk Factor', value: currentLossStreak > 3 ? 'HIGH' : 'SAFE', icon: AlertTriangle, color: currentLossStreak > 3 ? 'text-destructive' : 'text-accent', bg: currentLossStreak > 3 ? 'bg-destructive/10' : 'bg-accent/10' },
          ].map((stat, i) => (
            <Card key={i} className="border-white/5 bg-white/5 backdrop-blur-sm rounded-2xl">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("p-3 rounded-xl", stat.bg)}>
                  <stat.icon size={20} className={stat.color} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{stat.label}</p>
                  <p className="text-base font-black text-white">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-primary/30 bg-gradient-to-br from-[#0a0a0a] to-[#000] overflow-hidden shadow-2xl relative rounded-3xl min-h-[400px]">
              {loadingAI && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center space-y-4">
                  <div className="relative">
                    <Zap className="text-primary animate-ping absolute inset-0" size={48} />
                    <Zap className="text-primary relative z-10" size={48} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-black uppercase tracking-[0.5em] text-primary">Scanning Neural Network</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Correlating 40+ history points...</p>
                  </div>
                </div>
              )}
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/2 px-8 py-6">
                <CardTitle className="text-[12px] font-black text-white uppercase flex items-center gap-3 tracking-widest">
                  <Target size={18} className="text-primary" /> Active Prediction Engine
                </CardTitle>
                <div className="flex items-center gap-3">
                   <Button onClick={simulateRoll} variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary transition-all">
                    Generate Data
                  </Button>
                  <Badge className={cn("text-[10px] px-3 py-1 font-black rounded-full", loadingAI ? "animate-pulse" : "bg-accent text-white")}>
                    {loadingAI ? "SYNCING" : "LIVE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-10 space-y-10">
                <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                  <div className="text-center md:text-left">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4">Market Prediction</p>
                    <h2 className={cn("text-8xl md:text-9xl font-black tracking-tighter transition-all italic", 
                      prediction?.predictedSize === 'BIG' ? 'text-primary drop-shadow-[0_0_30px_rgba(124,58,237,0.5)]' : 
                      prediction?.predictedSize === 'SMALL' ? 'text-accent drop-shadow-[0_0_30px_rgba(0,128,128,0.5)]' : 'text-white/5'
                    )}>
                      {prediction?.predictedSize || '---'}
                    </h2>
                    <div className="flex items-center justify-center md:justify-start gap-4 mt-6">
                      <Badge variant="outline" className="border-white/10 text-white font-black uppercase px-4 py-1 tracking-widest">{prediction?.predictedParity || 'WAITING'}</Badge>
                      <span className="text-[11px] font-black text-primary uppercase tracking-widest">Confidence: {prediction?.confidence || 0}%</span>
                    </div>
                  </div>

                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 w-full md:w-auto text-center md:text-right shadow-inner">
                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Aggressive Allocation</p>
                    <p className="text-4xl font-black text-white">{formatIDR(suggestedBet)}</p>
                    <div className="mt-4 flex items-center justify-center md:justify-end gap-2">
                       <Badge className="bg-primary/20 text-primary border-none text-[10px] font-black px-3">LEVEL {betLevel + 1}</Badge>
                       <Badge className="bg-white/10 text-white border-none text-[10px] font-black px-3">X{MULTIPLIERS[betLevel].multiplier}</Badge>
                    </div>
                  </div>
                </div>

                <div className="bg-white/2 rounded-2xl p-6 border-l-8 border-primary relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-10">
                      <BrainCircuit size={40} />
                   </div>
                  <p className="text-sm text-white/80 font-medium italic leading-relaxed relative z-10">
                    "{prediction?.reason || "Kumpulkan minimal 1 data historis untuk mengkalibrasi sensor Oracle."}"
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
               <Card className={cn("border-2 transition-all rounded-3xl relative overflow-hidden", 
                leopardStatus?.recommendation === 'STRONG_BUY' ? 'border-amber-500 bg-amber-500/10' : 
                leopardStatus?.recommendation === 'BET_HEAVY' ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-white/2')}>
                <CardContent className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn("p-3 rounded-2xl", leopardStatus?.recommendation === 'STRONG_BUY' ? 'bg-amber-500 text-black' : 'bg-white/5 text-muted-foreground')}>
                        <Dices size={24} className={leopardStatus?.isLeopardOpportunity ? 'animate-bounce' : ''} />
                      </div>
                      <h3 className="font-black text-xl text-white tracking-tighter italic">ANY TRIPLE ORACLE</h3>
                    </div>
                    {leopardStatus?.recommendation && (
                      <Badge className={cn("font-black text-[10px] px-3 py-1 animate-pulse", 
                        leopardStatus.recommendation === 'STRONG_BUY' ? 'bg-red-600' : 'bg-amber-500 text-black'
                      )}>
                        {leopardStatus.recommendation}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-black/60 rounded-2xl p-5 border border-white/5 text-center">
                      <p className="text-[10px] text-muted-foreground font-black uppercase mb-2 tracking-widest">Sleeper Interval</p>
                      <p className="text-3xl font-black text-white">{leopardStatus?.rollsSinceLastLeopard ?? '0'}</p>
                    </div>
                    <div className="bg-black/60 rounded-2xl p-5 border border-white/5 text-center">
                      <p className="text-[10px] text-muted-foreground font-black uppercase mb-2 tracking-widest">AI Status</p>
                      <p className={cn("text-lg font-black uppercase italic", leopardStatus?.isLeopardOpportunity ? 'text-amber-500' : 'text-white/20')}>
                        {leopardStatus?.isLeopardOpportunity ? 'DANGER' : 'STANDBY'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-black/40 p-4 rounded-xl flex items-start gap-4">
                    <AlertCircle size={20} className="text-amber-500 mt-1 shrink-0" />
                    <p className="text-xs text-white/60 font-bold leading-relaxed">
                      {leopardStatus?.reasoning || "Memantau pola Triple... Secara matematis Triple (Leopard) muncul setiap 36-40 roll dengan payout 30:1."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/5 bg-white/2 rounded-3xl p-8 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-6">
                   <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                      <Flame size={24} />
                   </div>
                   <h3 className="font-black text-xl text-white tracking-tighter italic uppercase">Quick Decision</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[11px] font-black uppercase text-muted-foreground">Bet Size</span>
                    <span className="text-sm font-black text-white">{prediction?.predictedSize || '---'}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-[11px] font-black uppercase text-muted-foreground">Bet Leopard</span>
                    <span className={cn("text-sm font-black", leopardStatus?.isLeopardOpportunity ? 'text-amber-500' : 'text-white/20')}>
                      {leopardStatus?.isLeopardOpportunity ? 'YES (LIGHT)' : 'NO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-primary/20 rounded-2xl border border-primary/20">
                    <span className="text-[11px] font-black uppercase text-primary">Total Recommendation</span>
                    <span className="text-sm font-black text-white">{formatIDR(suggestedBet + (leopardStatus?.isLeopardOpportunity ? baseBet : 0))}</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-white/10 bg-[#0a0a0a] rounded-3xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 bg-white/2 px-6 py-4">
                <CardTitle className="text-[11px] font-black uppercase text-white tracking-[0.2em]">Input Manual Sensor</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setHistory(h => h.slice(1))} className="h-8 text-[10px] font-black text-white/40">
                  REVERT LAST
                </Button>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                <div className="flex justify-center gap-4">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black border-2 transition-all duration-300", 
                      currentRoll[i] ? 'bg-primary border-primary text-white scale-110 shadow-[0_0_20px_rgba(124,58,237,0.4)]' : 'bg-white/5 border-white/10 text-white/10'
                    )}>
                      {currentRoll[i] || '?'}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <Button 
                      key={n} 
                      onClick={() => handleNumberClick(n)} 
                      className="h-16 text-2xl font-black bg-white/5 hover:bg-primary hover:scale-105 active:scale-95 transition-all rounded-2xl border border-white/5"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#0a0a0a] rounded-3xl">
              <CardHeader className="px-6 py-4 border-b border-white/5">
                <CardTitle className="text-[11px] font-black uppercase text-white tracking-[0.2em] flex items-center gap-2">
                  <Settings2 size={16} /> Oracle Config
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Wallet size={12}/> Initial Bankroll (IDR)
                  </label>
                  <Input 
                    type="number" 
                    value={initialCapital} 
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    disabled={history.length > 0}
                    className="bg-black border-white/10 font-black h-12 rounded-xl focus:ring-primary text-white"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Bomb size={12}/> Base Bet Unit (IDR)
                  </label>
                  <Input 
                    type="number" 
                    value={baseBet} 
                    onChange={(e) => setBaseBet(Number(e.target.value))}
                    className="bg-black border-white/10 font-black h-12 rounded-xl focus:ring-primary text-white"
                  />
                </div>
                <div className="pt-6 border-t border-white/5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-4 tracking-widest">Recovery Ladder (Martingale)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {MULTIPLIERS.map((m, i) => (
                      <div key={i} className={cn("text-[9px] p-3 rounded-xl flex flex-col items-center border transition-all", 
                        i === betLevel ? 'bg-primary border-primary text-white font-black scale-105 shadow-lg' : 'bg-white/5 border-white/5 text-muted-foreground'
                      )}>
                        <span className="font-black uppercase">{m.text}</span>
                        <span className="text-xs font-black">X{m.multiplier}</span>
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
            <CardHeader className="bg-white/2 p-6 border-b border-white/5">
              <CardTitle className="text-[11px] font-black uppercase text-white tracking-[0.3em] flex items-center gap-3">
                <BarChart3 size={18} /> Neural Audit Log
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-[12px]">
                <thead>
                  <tr className="bg-black/40 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-white/5">
                    <th className="p-5">Cycle</th>
                    <th className="p-5">Dadu</th>
                    <th className="p-5">Total</th>
                    <th className="p-5">Hasil</th>
                    <th className="p-5">Status Oracle</th>
                    <th className="p-5 text-right pr-10">Bankroll Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((row) => (
                    <tr key={row.id} className="hover:bg-white/2 transition-colors">
                      <td className="p-5 text-muted-foreground font-black tracking-widest">#{row.num}</td>
                      <td className="p-5">
                        <div className="flex justify-center gap-2">
                          {row.dice.map((d: number, idx: number) => (
                            <span key={idx} className={cn("w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs border shadow-inner", 
                              row.isLeopard ? 'bg-amber-500 border-amber-600 text-black' : 'bg-white/10 border-white/20 text-white'
                            )}>{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-5 font-black text-white text-sm">{row.total}</td>
                      <td className="p-5">
                         <div className="flex flex-col items-center gap-1">
                            <span className={cn("font-black px-3 py-0.5 rounded-full text-[10px]", row.isLeopard ? 'bg-amber-500 text-black' : row.isBig ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent')}>
                              {row.isLeopard ? 'TRIPLE' : row.isBig ? 'BIG' : 'SMALL'}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-black uppercase">{row.isOdd ? 'ODD' : 'EVEN'}</span>
                         </div>
                      </td>
                      <td className="p-5">
                        {row.isCorrectSize !== null ? (
                          row.isCorrectSize ? 
                          <div className="flex items-center justify-center gap-2 text-accent font-black tracking-widest"><CheckCircle2 size={16}/> HIT</div> : 
                          <div className="flex items-center justify-center gap-2 text-destructive font-black tracking-widest"><XCircle size={16}/> MISS</div>
                        ) : 'STANDBY'}
                      </td>
                      <td className="p-5 text-right pr-10">
                         <div className="flex flex-col items-end">
                            <span className="font-black text-white">{formatIDR(row.currentBalance)}</span>
                            <span className={cn("text-[9px] font-black", row.isCorrectSize ? 'text-accent' : 'text-destructive')}>
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
      </div>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-[#0a0a0a] border-white/10 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-destructive uppercase italic tracking-tighter">Emergency Reset?</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-4 font-medium leading-relaxed">
              Seluruh histori algoritma akan dihapus secara permanen. Saldo akan dikembalikan ke modal awal {formatIDR(initialCapital)}. Gunakan hanya jika strategi mengalami deviasi fatal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 gap-3">
            <Button variant="secondary" onClick={() => setShowResetModal(false)} className="rounded-2xl h-12 px-6 text-xs font-black uppercase">Abort</Button>
            <Button variant="destructive" onClick={resetAll} className="rounded-2xl h-12 px-6 text-xs font-black uppercase tracking-widest shadow-2xl shadow-destructive/20">Wipe All Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
