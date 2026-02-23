"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Trophy
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

const MULTIPLIERS = [
  { level: 1, multiplier: 1, text: "Level 1 (Base)" },
  { level: 2, multiplier: 3, text: "Level 2 (Recovery)" },
  { level: 3, multiplier: 8, text: "Level 3 (Aggressive)" },
  { level: 4, multiplier: 24, text: "Level 4 (High Risk)" },
  { level: 5, multiplier: 72, text: "Level 5 (Emergency)" },
  { level: 6, multiplier: 216, text: "Level 6 (Max Recovery)" }
];

const INITIAL_BALANCE = 1000000;
const INITIAL_BASE_BET = 10000;

export default function SicboOracle() {
  const [history, setHistory] = useState<any[]>([]);
  const [currentRoll, setCurrentRoll] = useState<number[]>([]);
  const [balance, setBalance] = useState(INITIAL_BALANCE);
  const [baseBet, setBaseBet] = useState(INITIAL_BASE_BET);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [prediction, setPrediction] = useState<PredictSicBoOutcomeOutput | null>(null);
  const [leopardStatus, setLeopardStatus] = useState<PredictLeopardOpportunityOutput | null>(null);

  // Statistics
  const stats = useMemo(() => {
    if (history.length === 0) return { winRate: 0, profit: 0, totalGames: 0 };
    const correctCount = history.filter(h => h.isCorrectSize).length;
    return {
      winRate: Math.round((correctCount / history.length) * 100),
      profit: balance - INITIAL_BALANCE,
      totalGames: history.length
    };
  }, [history, balance]);

  // Determine betting level
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

  // AI Prediction Trigger
  const updatePredictions = async (newHistory: any[]) => {
    setLoadingAI(true);
    try {
      const formattedHistory = newHistory.slice(0, 10).map(h => ({
        dice: h.dice,
        total: h.total,
        isBig: h.isBig,
        isOdd: h.isOdd
      }));

      const [pred, leopard] = await Promise.all([
        predictSicBoOutcome({ history: formattedHistory }),
        predictLeopardOpportunity({ gameHistory: formattedHistory.map(h => ({ dice: h.dice })) })
      ]);

      setPrediction(pred);
      setLeopardStatus(leopard);
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleNumberClick = (num: number) => {
    if (currentRoll.length < 3) {
      const newRoll = [...currentRoll, num];
      setCurrentRoll(newRoll);
      if (newRoll.length === 3) {
        processRoll(newRoll);
      }
    }
  };

  const processRoll = (roll: number[]) => {
    const total = roll.reduce((a, b) => a + b, 0);
    const isBig = total >= 11;
    const isOdd = total % 2 !== 0;
    const isLeopard = roll[0] === roll[1] && roll[1] === roll[2];

    const predictedSize = prediction?.predictedSize;
    const predictedParity = prediction?.predictedParity;
    
    const isCorrectSize = predictedSize ? (isBig ? 'BIG' : 'SMALL') === predictedSize : null;
    const isCorrectParity = predictedParity ? (isOdd ? 'ODD' : 'EVEN') === predictedParity : null;

    // Financial update
    let newBalance = balance;
    if (isCorrectSize !== null) {
      if (isCorrectSize) newBalance += suggestedBet;
      else newBalance -= suggestedBet;
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
      isCorrectParity,
      betAmount: suggestedBet
    };

    const newHistory = [newEntry, ...history];
    setHistory(newHistory);
    setBalance(newBalance);
    setCurrentRoll([]);
    updatePredictions(newHistory);
  };

  const handleUndo = () => {
    if (currentRoll.length > 0) {
      setCurrentRoll(prev => prev.slice(0, -1));
    } else if (history.length > 0) {
      const removed = history[0];
      setHistory(prev => prev.slice(1));
      // Refund/Recover balance on undo
      if (removed.isCorrectSize !== null) {
        setBalance(prev => removed.isCorrectSize ? prev - removed.betAmount : prev + removed.betAmount);
      }
    }
  };

  const resetAll = () => {
    setHistory([]);
    setBalance(INITIAL_BALANCE);
    setPrediction(null);
    setLeopardStatus(null);
    setShowResetModal(false);
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
    <div className="min-h-screen bg-[#1a1a1a] text-foreground font-body p-4 pb-20 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <BrainCircuit className="text-primary-foreground" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">Sicbo Oracle</h1>
              <p className="text-xs text-muted-foreground font-semibold flex items-center gap-2">
                <Zap size={12} className="text-accent" /> AI-DRIVEN PREDICTION ENGINE
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-card border border-border rounded-lg px-4 py-2 flex items-center gap-3 shadow-sm">
              <Wallet className="text-accent" size={18} />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo</p>
                <p className="text-sm font-black text-white">{formatCurrency(balance)}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowResetModal(true)} className="border-destructive/20 hover:bg-destructive/10">
              <Trash2 className="text-destructive" size={18} />
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Win Rate', value: `${stats.winRate}%`, icon: Trophy, color: 'text-accent' },
            { label: 'Profit', value: formatCurrency(stats.profit), icon: TrendingUp, color: stats.profit >= 0 ? 'text-accent' : 'text-destructive' },
            { label: 'Total Rolls', value: stats.totalGames, icon: HistoryIcon, color: 'text-primary' },
            { label: 'Loss Streak', value: currentLossStreak, icon: AlertTriangle, color: 'text-destructive' },
          ].map((stat, i) => (
            <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-secondary rounded-lg">
                  <stat.icon size={18} className={stat.color} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-black">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Interface Grid */}
        <div className="grid lg:grid-cols-5 gap-6">
          
          {/* Prediction Panel (Left/Top) */}
          <div className="lg:col-span-3 space-y-6">
            <Card className="border-primary/20 bg-gradient-to-br from-card to-background overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4">
                <Badge variant={loadingAI ? "outline" : "default"} className={loadingAI ? "animate-pulse" : "bg-primary"}>
                  {loadingAI ? "AI ANALYZING..." : "LIVE ORACLE"}
                </Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground uppercase flex items-center gap-2">
                  <Target size={14} className="text-primary" /> Next Result Prediction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className={`text-7xl font-black tracking-tighter ${prediction?.predictedSize === 'BIG' ? 'text-primary' : 'text-accent'}`}>
                      {prediction?.predictedSize || '---'}
                    </h2>
                    <p className="text-sm font-bold text-muted-foreground mt-2">PARITY: <span className="text-white">{prediction?.predictedParity || '---'}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Rekomendasi Bet</p>
                    <p className="text-2xl font-black text-accent">{formatCurrency(suggestedBet)}</p>
                    <Badge variant="outline" className="mt-1 border-accent/20 text-accent text-[10px]">
                      {MULTIPLIERS[betLevel].text}
                    </Badge>
                  </div>
                </div>

                <div className="bg-secondary/50 rounded-xl p-4 border border-border">
                  <p className="text-xs text-muted-foreground leading-relaxed italic">
                    "{prediction?.reason || "Input data to activate AI pattern recognition and receive strategy insights."}"
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Leopard Alert Panel */}
            <Card className={`border-2 transition-all duration-500 ${leopardStatus?.isLeopardOpportunity ? 'border-amber-500 bg-amber-500/5' : 'border-border/50 opacity-60'}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${leopardStatus?.isLeopardOpportunity ? 'bg-amber-500' : 'bg-muted'}`}>
                      <Zap size={20} className={leopardStatus?.isLeopardOpportunity ? 'text-white animate-bounce' : 'text-muted-foreground'} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg">ANY (LEOPARD) TRACKER</h3>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Statistical Opportunity Alert</p>
                    </div>
                  </div>
                  {leopardStatus?.isLeopardOpportunity && (
                    <Badge className="bg-amber-500 animate-pulse font-black px-3 py-1">OPPORTUNE MOMENT</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 text-center mb-4">
                  <div className="bg-background/40 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Rolls Since Last</p>
                    <p className="text-xl font-black text-white">{leopardStatus?.rollsSinceLastLeopard ?? '0'}</p>
                  </div>
                  <div className="bg-background/40 rounded-lg p-2 border border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Threshold</p>
                    <p className="text-xl font-black text-white">36</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {leopardStatus?.reasoning || "Tracking statistical gaps to find high-probability leopard windows..."}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Input & Settings Panel (Right/Bottom) */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Entry Pad</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleUndo} className="h-8 text-[10px] font-black uppercase">
                  <RotateCcw size={14} className="mr-1" /> Undo
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2].map(i => (
                    <div key={i} className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-black border-2 transition-all duration-300 ${
                      currentRoll[i] ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-secondary border-border text-muted-foreground'
                    }`}>
                      {currentRoll[i] || '?'}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <Button key={n} onClick={() => handleNumberClick(n)} className="h-16 text-2xl font-black bg-secondary hover:bg-primary transition-colors border-none">
                      {n}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Settings2 size={14} /> Bet Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Base Bet Amount</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-bold">Rp</span>
                    <Input 
                      type="number" 
                      value={baseBet} 
                      onChange={(e) => setBaseBet(Number(e.target.value))}
                      className="bg-secondary border-none font-black"
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">This amount will be multiplied based on your recovery level.</p>
                </div>
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Strategy: Martingale Hybrid</p>
                  <div className="space-y-1">
                    {MULTIPLIERS.map((m, i) => (
                      <div key={i} className={`flex justify-between text-[10px] p-1 rounded ${i === betLevel ? 'bg-primary/20 text-primary font-black' : 'text-muted-foreground'}`}>
                        <span>{m.text}</span>
                        <span>x{m.multiplier}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* History Table */}
        {history.length > 0 && (
          <Card className="border-border overflow-hidden">
            <CardHeader className="bg-secondary/30 p-4">
              <CardTitle className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2">
                <BarChart3 size={14} /> Historical Data & AI Performance
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="bg-secondary/10 text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
                    <th className="p-3">#</th>
                    <th className="p-3">DICE</th>
                    <th className="p-3">PTS</th>
                    <th className="p-3">SIZE</th>
                    <th className="p-3">PARITY</th>
                    <th className="p-3">BET</th>
                    <th className="p-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((row) => (
                    <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-muted-foreground">{row.num}</td>
                      <td className="p-3 font-black tracking-widest">{row.dice.join('')}</td>
                      <td className="p-3 font-bold text-white">{row.total}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`border-none ${row.isBig ? 'text-primary' : 'text-accent'}`}>
                          {row.isBig ? 'BIG' : 'SMALL'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className={row.isOdd ? 'text-purple-400' : 'text-teal-400'}>{row.isOdd ? 'Odd' : 'Even'}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatCurrency(row.betAmount)}</td>
                      <td className="p-3">
                        {row.isCorrectSize !== null ? (
                          row.isCorrectSize ? (
                            <CheckCircle2 size={18} className="mx-auto text-accent" />
                          ) : (
                            <XCircle size={18} className="mx-auto text-destructive" />
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
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
        <DialogContent className="bg-card border-border sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle /> WARNING: System Reset
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will clear all game history, reset your bankroll to {formatCurrency(INITIAL_BALANCE)}, and wipe the AI's current pattern training. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="secondary" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={resetAll}>Wipe Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
