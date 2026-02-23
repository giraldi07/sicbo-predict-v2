
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
  ShieldCheck,
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

  // Sync balance with initial capital when reset
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
      // Ambil 30 data terakhir untuk akurasi maksimal
      const formattedHistory = currentHistory.slice(0, 30).map(h => ({
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
      console.error("AI Update Failed:", error);
      toast({
        variant: "destructive",
        title: "Koneksi Oracle Terganggu",
        description: "Memasuki mode analisis lokal otomatis."
      });
    } finally {
      setLoadingAI(false);
    }
  }, []);

  const processRoll = useCallback((roll: number[]) => {
    const total = roll.reduce((a, b) => a + b, 0);
    const isBig = total >= 11;
    const isOdd = total % 2 !== 0;
    
    // Hasil seri/triple biasanya bandar menang (aturan umum), tapi kita hitung berdasarkan prediksi
    const predictedSize = prediction?.predictedSize;
    const isCorrectSize = predictedSize ? (isBig ? 'BIG' : 'SMALL') === predictedSize : null;

    let newBalance = balance;
    if (isCorrectSize !== null) {
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
      isOdd,
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
      if (newRoll.length === 3) processRoll(newRoll);
    }
  };

  const simulateRoll = () => {
    const dice = [1, 1, 1].map(() => Math.floor(Math.random() * 6) + 1);
    processRoll(dice);
  };

  const resetAll = () => {
    setHistory([]);
    setBalance(initialCapital);
    setPrediction(null);
    setLeopardStatus(null);
    setCurrentRoll([]);
    setShowResetModal(false);
    toast({ title: "Oracle Reset", description: "Seluruh data telah dibersihkan." });
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground font-body p-4 md:p-8 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <BrainCircuit className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">Sicbo Oracle <span className="text-primary font-normal">v2.0</span></h1>
              <p className="text-[10px] text-muted-foreground font-bold flex items-center gap-2 tracking-widest uppercase">
                <ShieldCheck size={12} className="text-accent" /> High-Accuracy Neural Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-3">
              <Wallet className="text-accent" size={18} />
              <div>
                <p className="text-[8px] text-muted-foreground uppercase font-black">Bankroll</p>
                <p className="text-sm font-black text-white">{formatIDR(balance)}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowResetModal(true)} className="border-destructive/20 hover:bg-destructive/10 rounded-xl">
              <Trash2 className="text-destructive" size={16} />
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Accuracy', value: `${stats.winRate}%`, icon: Trophy, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Profit/Loss', value: formatIDR(stats.profit), icon: TrendingUp, color: stats.profit >= 0 ? 'text-accent' : 'text-destructive', bg: stats.profit >= 0 ? 'bg-accent/10' : 'bg-destructive/10' },
            { label: 'Total Rolls', value: stats.totalGames, icon: HistoryIcon, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Loss Streak', value: currentLossStreak, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          ].map((stat, i) => (
            <Card key={i} className="border-white/5 bg-white/5 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", stat.bg)}>
                  <stat.icon size={16} className={stat.color} />
                </div>
                <div>
                  <p className="text-[9px] uppercase font-black text-muted-foreground tracking-wider">{stat.label}</p>
                  <p className="text-sm font-black text-white">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-[#111] to-[#050505] overflow-hidden shadow-2xl relative">
              {loadingAI && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center space-y-3">
                  <Zap className="text-primary animate-pulse" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Scanning Patterns...</p>
                </div>
              )}
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2">
                  <Target size={14} className="text-primary" /> Active Prediction
                </CardTitle>
                <div className="flex items-center gap-2">
                   <Button onClick={simulateRoll} variant="ghost" size="sm" className="h-7 text-[9px] uppercase font-bold text-white/50 hover:text-white">
                    Simulate Roll
                  </Button>
                  <Badge className={cn("text-[9px] px-2", loadingAI ? "animate-pulse" : "bg-accent/20 text-accent border-none")}>
                    {loadingAI ? "CALCULATING..." : "STABLE"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                  <div>
                    <h2 className={cn("text-7xl md:text-8xl font-black tracking-tighter transition-all", 
                      prediction?.predictedSize === 'BIG' ? 'text-primary' : 
                      prediction?.predictedSize === 'SMALL' ? 'text-accent' : 'text-white/10'
                    )}>
                      {prediction?.predictedSize || 'WAIT'}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline" className="border-white/10 text-white font-bold uppercase">{prediction?.predictedParity || '---'}</Badge>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Confidence: {prediction?.confidence || 0}%</span>
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 w-full md:w-auto text-right">
                    <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Recommended Bet</p>
                    <p className="text-2xl font-black text-accent">{formatIDR(suggestedBet)}</p>
                    <Badge className="mt-2 bg-primary/20 text-primary border-none text-[8px] uppercase">Martingale {MULTIPLIERS[betLevel].text}</Badge>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border-l-4 border-primary">
                  <p className="text-xs text-white/70 italic leading-relaxed">
                    "{prediction?.reason || "Input minimal 1 histori untuk mengaktifkan mesin prediksi Oracle."}"
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className={cn("border-2 transition-all", leopardStatus?.isLeopardOpportunity ? 'border-amber-500/50 bg-amber-500/5' : 'border-white/5 bg-white/2')}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Dices size={20} className={leopardStatus?.isLeopardOpportunity ? 'text-amber-500 animate-bounce' : 'text-muted-foreground'} />
                    <h3 className="font-black text-lg text-white">ANY TRIPLE TRACKER</h3>
                  </div>
                  {leopardStatus?.isLeopardOpportunity && (
                    <Badge className="bg-amber-500 text-white animate-pulse font-black text-[10px]">PROBABILITY HIGH</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5 text-center">
                    <p className="text-[9px] text-muted-foreground font-black uppercase mb-1">Interval Since Last</p>
                    <p className="text-2xl font-black text-white">{leopardStatus?.rollsSinceLastLeopard ?? '0'}</p>
                  </div>
                  <div className="bg-black/40 rounded-xl p-4 border border-white/5 text-center">
                    <p className="text-[9px] text-muted-foreground font-black uppercase mb-1">Target Interval</p>
                    <p className="text-2xl font-black text-white/30">36</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground bg-white/5 p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  {leopardStatus?.reasoning || "Memantau siklus kemunculan Triple untuk peluang keuntungan besar (1:180)."}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <Card className="border-white/10 bg-[#111]">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Live Input</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setHistory(h => h.slice(1))} className="h-8 text-[9px] font-black">
                  <RotateCcw size={12} className="mr-1" /> UNDO
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={cn("w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black border-2", 
                      currentRoll[i] ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/5 border-white/5 text-muted-foreground'
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
                      className="h-14 text-xl font-black bg-white/5 hover:bg-primary transition-all rounded-xl"
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-[#111]">
              <CardHeader>
                <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                  <Settings2 size={12} /> Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-muted-foreground uppercase">Initial Capital (IDR)</label>
                  <Input 
                    type="number" 
                    value={initialCapital} 
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    disabled={history.length > 0}
                    className="bg-black/40 border-white/10 font-black h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-muted-foreground uppercase">Base Bet (IDR)</label>
                  <Input 
                    type="number" 
                    value={baseBet} 
                    onChange={(e) => setBaseBet(Number(e.target.value))}
                    className="bg-black/40 border-white/10 font-black h-10"
                  />
                </div>
                <div className="pt-4 border-t border-white/5">
                  <p className="text-[9px] font-black text-muted-foreground uppercase mb-3">Recovery Ladder</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MULTIPLIERS.map((m, i) => (
                      <div key={i} className={cn("text-[8px] p-2 rounded-lg flex flex-col items-center", 
                        i === betLevel ? 'bg-primary text-white font-black' : 'bg-white/5 text-muted-foreground'
                      )}>
                        <span>{m.text}</span>
                        <span className="font-bold">x{m.multiplier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {history.length > 0 && (
          <Card className="border-white/10 bg-[#111] overflow-hidden">
            <CardHeader className="bg-white/2 p-4">
              <CardTitle className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                <BarChart3 size={14} /> Activity Log
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-[11px]">
                <thead>
                  <tr className="bg-black text-[9px] font-black text-muted-foreground uppercase border-b border-white/5">
                    <th className="p-4">Roll #</th>
                    <th className="p-4">Dice</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Result</th>
                    <th className="p-4">Oracle</th>
                    <th className="p-4 text-right pr-8">New Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((row) => (
                    <tr key={row.id} className="hover:bg-white/2 transition-colors">
                      <td className="p-4 text-muted-foreground font-bold">{row.num}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-1">
                          {row.dice.map((d: number, idx: number) => (
                            <span key={idx} className="w-5 h-5 bg-white/10 rounded flex items-center justify-center font-black text-[10px]">{d}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 font-black">{row.total}</td>
                      <td className="p-4 font-black">
                        <span className={row.isBig ? 'text-primary' : 'text-accent'}>{row.isBig ? 'BIG' : 'SMALL'}</span>
                      </td>
                      <td className="p-4">
                        {row.isCorrectSize !== null ? (
                          row.isCorrectSize ? 
                          <div className="flex items-center justify-center gap-1 text-accent font-black"><CheckCircle2 size={12}/> HIT</div> : 
                          <div className="flex items-center justify-center gap-1 text-destructive font-black"><XCircle size={12}/> MISS</div>
                        ) : '---'}
                      </td>
                      <td className="p-4 text-right pr-8 font-black">{formatIDR(row.currentBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent className="bg-[#111] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-destructive font-black uppercase italic">Reset System?</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              Tindakan ini akan menghapus seluruh histori pola dan mengembalikan saldo ke {formatIDR(initialCapital)}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="secondary" onClick={() => setShowResetModal(false)} className="rounded-xl h-9 text-xs">Cancel</Button>
            <Button variant="destructive" onClick={resetAll} className="rounded-xl h-9 text-xs font-black uppercase">Wipe Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
