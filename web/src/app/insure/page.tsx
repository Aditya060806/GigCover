"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  Bike,
  MapPin,
  Brain,
  CreditCard,
  CheckCircle,
  Loader2,
  Zap,
  CloudRain,
  Thermometer,
  Wind,
  AlertTriangle,
  IndianRupee,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { CITIES, PLATFORMS, PLAN_TIERS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { calculatePremium as apiCalculatePremium } from "@/lib/api";

const insureSteps = [
  { label: "Platform", icon: Bike },
  { label: "Zone", icon: MapPin },
  { label: "AI Premium", icon: Brain },
  { label: "Payment", icon: CreditCard },
];

export default function InsurePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const goTo = (n: number) => { setDirection(n > step ? 1 : -1); setStep(n); };
  const [isCalculating, setIsCalculating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [paymentResult, setPaymentResult] = useState<{
    gateway: string;
    orderId: string;
    paymentId: string;
    status: "captured";
  } | null>(null);
  const [premiumData, setPremiumData] = useState<{
    basePremium: number;
    riskMultiplier: number;
    finalPremium: number;
    riskLevel: string;
    factors: { name: string; impact: string; value: string }[];
  } | null>(null);

  const [formData, setFormData] = useState({
    platform: "",
    city: "",
    zone: "",
    plan: "standard",
  });

  const selectedCity = CITIES.find((c) => c.name === formData.city);
  const selectedPlan = PLAN_TIERS.find((p) => p.id === formData.plan);

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculatePremium = async () => {
    setIsCalculating(true);
    try {
      const res = await apiCalculatePremium({
        city: formData.city,
        zone: formData.zone,
        platform: formData.platform,
        plan: formData.plan,
      });
      setPremiumData({
        basePremium: res.base_premium,
        riskMultiplier: res.risk_multiplier,
        finalPremium: res.final_premium,
        riskLevel: res.risk_level,
        factors: res.factors.map((f) => ({
          name: f.name,
          impact: f.impact,
          value: f.value,
        })),
      });
      setIsCalculating(false);
      setStep(2);
    } catch {
      // Fallback to local estimate if ML API is unavailable
      const basePremium = selectedPlan?.weeklyPremium || 25;
      const riskMultiplier = 0.8 + Math.random() * 0.6;
      const finalPremium = Math.round(basePremium * riskMultiplier);
      setPremiumData({
        basePremium,
        riskMultiplier,
        finalPremium,
        riskLevel: riskMultiplier > 1.1 ? "High" : riskMultiplier > 0.9 ? "Medium" : "Low",
        factors: [
          { name: "Zone Weather History", impact: riskMultiplier > 1 ? "Increases" : "Decreases", value: `${formData.city} - ${formData.zone}` },
          { name: "Monsoon Season Risk", impact: "Increases", value: "Active season" },
          { name: "Platform Density", impact: "Neutral", value: `${formData.platform} — Standard coverage zone` },
          { name: "Historical Claims", impact: riskMultiplier > 1.1 ? "Increases" : "Decreases", value: `${Math.floor(Math.random() * 50 + 10)} claims/month in zone` },
          { name: "AQI Baseline", impact: formData.city === "Delhi" ? "Increases" : "Neutral", value: formData.city === "Delhi" ? "Consistently high" : "Within limits" },
        ],
      });
      setIsCalculating(false);
      setStep(2);
    }
  };

  const handlePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const result = {
        gateway: paymentMethod === "razorpay" ? "Razorpay Sandbox" : "GigCover Mock Gateway",
        orderId: `order_${ts.toString(36)}`,
        paymentId: `pay_${rand}`,
        status: "captured",
      } as const;
      const paidAmount = premiumData?.finalPremium ?? selectedPlan?.weeklyPremium ?? 25;

      setPaymentResult(result);

      try {
        localStorage.setItem(
          "gigcover_latest_payment",
          JSON.stringify({
            id: ts,
            type: "premium_payment",
            amount: -paidAmount,
            description: `Weekly Premium — ${selectedPlan?.name ?? "Standard"} Shield (${result.gateway})`,
            date: new Date(ts).toLocaleString("en-IN", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            ref: result.paymentId.toUpperCase(),
          })
        );
      } catch {
        // Ignore storage failures in private/incognito contexts
      }

      setStep(4); // success
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen p-4 lg:p-8 relative gradient-mesh">
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-20" />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-teal-400/8 blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-md">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">GigCover</span>
          </Link>
          <h1 className="text-2xl font-bold mb-1">Get Covered in Minutes</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered premium calculation based on your zone&apos;s real risk
          </p>
        </div>

        {/* Segmented Progress Bar */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex gap-1.5 mb-2">
              {insureSteps.map((_, i) => (
                <div key={i} className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: i <= step ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={i < step ? "h-full bg-emerald-400" : i === step ? "h-full bg-teal-500" : "h-full bg-transparent"}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              {insureSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-1">
                  <s.icon className={`w-3 h-3 ${i <= step ? "text-teal-600" : "text-slate-300"}`} />
                  <span className={`text-[10px] font-medium ${i === step ? "text-teal-700" : i < step ? "text-emerald-600" : "text-slate-400"}`}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait" custom={direction}>
          {/* Step 0: Platform Selection */}
          {step === 0 && (
            <motion.div key="s0" custom={direction} initial={{ opacity: 0, x: direction * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -40 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <Card className="shadow-xl border-0 glass-card">
                <CardHeader>
                  <CardTitle>Which platform do you deliver for?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.name}
                        className={`p-5 rounded-xl border text-center transition-all ${
                          formData.platform === p.name
                            ? "border-teal-300 bg-teal-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() => update("platform", p.name)}
                      >
                        <div className="text-3xl mb-2">{p.icon}</div>
                        <p className="text-sm font-medium">{p.name}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-end mt-6">
                    <Button
                      variant="default"
                      onClick={() => goTo(1)}
                      disabled={!formData.platform}
                    >
                      Continue <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 1: Zone Selection */}
          {step === 1 && (
            <motion.div key="s1" custom={direction} initial={{ opacity: 0, x: direction * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -40 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <Card className="shadow-xl border-0 glass-card">
                <CardHeader>
                  <CardTitle>Select your delivery zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CITIES.map((city) => (
                      <button
                        key={city.name}
                        className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                          formData.city === city.name
                            ? "border-teal-300 bg-teal-50"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                        onClick={() => { update("city", city.name); update("zone", ""); }}
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{city.name}</span>
                      </button>
                    ))}
                  </div>

                  {selectedCity && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Select your zone in {formData.city}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCity.zones.map((zone) => (
                          <button
                            key={zone.id}
                            className={`p-2.5 rounded-lg border text-sm transition-all ${
                              formData.zone === zone.name
                                ? "border-teal-300 bg-teal-50"
                                : "border-slate-200 bg-white hover:bg-slate-50 text-muted-foreground"
                            }`}
                            onClick={() => update("zone", zone.name)}
                          >
                            {zone.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan Selection */}
                  {formData.zone && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Choose coverage plan</p>
                      <div className="grid grid-cols-3 gap-2">
                        {PLAN_TIERS.map((plan) => (
                          <button
                            key={plan.id}
                            className={`p-3 rounded-xl border text-center transition-all ${
                              formData.plan === plan.id
                                ? "border-teal-300 bg-teal-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            } ${plan.popular ? "ring-1 ring-teal-200" : ""}`}
                            onClick={() => update("plan", plan.id)}
                          >
                            <p className="text-sm font-bold">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ₹{plan.weeklyPremium}/wk
                            </p>
                            {plan.popular && (
                              <Badge variant="default" className="text-[8px] mt-1">
                                Best
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between mt-4">
                    <Button variant="ghost" onClick={() => goTo(0)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      variant="default"
                      onClick={calculatePremium}
                      disabled={!formData.zone || isCalculating}
                    >
                      {isCalculating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          AI Calculating...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Calculate Premium
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Loading Animation */}
              {isCalculating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-6"
                >
                  <Card className="border-teal-200">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 rounded-full bg-teal-100 mx-auto mb-4 flex items-center justify-center animate-pulse">
                        <Brain className="w-8 h-8 text-teal-600" />
                      </div>
                      <p className="font-medium mb-2">AI Risk Engine Processing</p>
                      <p className="text-xs text-muted-foreground">
                        Analyzing weather patterns, historical claims, zone density...
                      </p>
                      <div className="flex justify-center gap-1 mt-4">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-teal-500 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 2: AI Premium Result */}
          {step === 2 && premiumData && (
            <motion.div key="s2" custom={direction} initial={{ opacity: 0, x: direction * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -40 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <Card className="shadow-xl border-0 glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-teal-600" />
                    AI Premium Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Premium Display */}
                  <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-200">
                    <p className="text-xs text-muted-foreground mb-1">Your Weekly Premium</p>
                    <p className="text-4xl font-bold text-teal-600">
                      {formatCurrency(premiumData.finalPremium)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">/week</p>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <Badge
                        variant={
                          premiumData.riskLevel === "High"
                            ? "destructive"
                            : premiumData.riskLevel === "Medium"
                            ? "warning"
                            : "success"
                        }
                      >
                        {premiumData.riskLevel} Risk Zone
                      </Badge>
                      <Badge variant="outline">
                        {premiumData.riskMultiplier.toFixed(2)}x multiplier
                      </Badge>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Plan</p>
                      <p className="text-sm font-bold">{selectedPlan?.name}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Max Payout</p>
                      <p className="text-sm font-bold">{formatCurrency(selectedPlan?.maxPayout || 0)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Zone</p>
                      <p className="text-sm font-bold">{formData.zone}</p>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  <div>
                    <p className="text-sm font-medium mb-3">AI Risk Factors</p>
                    <div className="space-y-2">
                      {premiumData.factors.map((factor) => (
                        <div
                          key={factor.name}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-sm"
                        >
                          <span className="text-muted-foreground">{factor.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{factor.value}</span>
                            <Badge
                              variant={
                                factor.impact === "Increases"
                                  ? "destructive"
                                  : factor.impact === "Decreases"
                                  ? "success"
                                  : "secondary"
                              }
                              className="text-[10px]"
                            >
                              {factor.impact}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Covered Events */}
                  <div>
                    <p className="text-sm font-medium mb-3">Covered Parametric Events</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: CloudRain, label: "Heavy Rain", desc: ">30mm/hr" },
                        { icon: CloudRain, label: "Flood", desc: ">100mm/hr" },
                        { icon: Thermometer, label: "Heatwave", desc: ">45°C" },
                        { icon: Wind, label: "AQI Spike", desc: ">300 AQI" },
                        { icon: Wind, label: "Storm", desc: ">60km/h" },
                        { icon: AlertTriangle, label: "Curfew", desc: "Govt order" },
                      ].map((event) => (
                        <div
                          key={event.label}
                          className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-center"
                        >
                          <event.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[10px] font-medium">{event.label}</p>
                          <p className="text-[9px] text-muted-foreground">{event.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => goTo(1)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Recalculate
                    </Button>
                    <Button variant="default" onClick={() => goTo(3)}>
                      Proceed to Pay <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && premiumData && (
            <motion.div key="s3" custom={direction} initial={{ opacity: 0, x: direction * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -40 }} transition={{ duration: 0.25, ease: "easeOut" }}>
              <Card className="shadow-xl border-0 glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-teal-600" />
                    Complete Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Order Summary */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                    <p className="text-sm font-medium">Order Summary</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span>{selectedPlan?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform</span>
                        <span>{formData.platform}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Zone</span>
                        <span>{formData.city} — {formData.zone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Payout/Event</span>
                        <span>{formatCurrency(selectedPlan?.maxPayout || 0)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold">
                        <span>Weekly Premium</span>
                        <span className="text-teal-600 text-lg">
                          {formatCurrency(premiumData.finalPremium)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <p className="text-sm font-medium mb-3">Payment Method</p>
                    <div className="space-y-2">
                      {[
                        { id: "razorpay", label: "Razorpay Sandbox", desc: "Cards, UPI, Wallets (test mode)" },
                        { id: "upi", label: "UPI", desc: "PhonePe, GPay, Paytm" },
                        { id: "wallet", label: "GigCover Wallet", desc: "Balance: ₹2,450" },
                        { id: "auto", label: "Auto-debit from earnings", desc: "Deducted weekly" },
                      ].map((method) => (
                        <button
                          key={method.id}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            paymentMethod === method.id
                              ? "border-teal-300 bg-teal-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          onClick={() => setPaymentMethod(method.id)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                            <IndianRupee className="w-4 h-4 text-teal-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{method.label}</p>
                            <p className="text-xs text-muted-foreground">{method.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-slate-50">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {paymentMethod === "razorpay"
                        ? "Checkout runs on Razorpay sandbox in demo mode. No real money is charged."
                        : "Payment is secure and encrypted. Cancel anytime."}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="ghost" onClick={() => goTo(2)}>
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button
                      variant="default"
                      size="lg"
                      onClick={handlePayment}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing {paymentMethod === "razorpay" ? "via Razorpay..." : "..."}
                        </>
                      ) : (
                        <>
                          Pay {formatCurrency(premiumData.finalPremium)}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: "backOut" }}>
              <Card className="border-0 shadow-2xl glass-card overflow-hidden relative">
                {/* Confetti orbs */}
                {["#5eead4","#34d399","#fbbf24","#60a5fa","#a78bfa"].map((c, i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{ background: c, width: 12 + i * 6, height: 12 + i * 6, top: `${10 + i * 8}%`, left: `${8 + i * 18}%`, opacity: 0.6 }}
                    initial={{ y: 0, opacity: 0 }}
                    animate={{ y: [-20, 40, -10], opacity: [0, 0.7, 0] }}
                    transition={{ duration: 1.2, delay: i * 0.12, ease: "easeOut" }}
                  />
                ))}
                <CardContent className="p-8 text-center relative z-10">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-6 shadow-lg"
                  >
                    <CheckCircle className="w-10 h-10 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">You&apos;re Covered! 🎉</h2>
                  <p className="text-muted-foreground mb-6">
                    Your {selectedPlan?.name} plan is now active for {formData.zone}, {formData.city}
                  </p>

                  {paymentResult && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 text-left">
                      <p className="text-sm font-medium mb-2">Payment Confirmation</p>
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <p>Gateway: <span className="text-foreground font-medium">{paymentResult.gateway}</span></p>
                        <p>Order ID: <span className="font-mono text-foreground">{paymentResult.orderId}</span></p>
                        <p>Payment ID: <span className="font-mono text-foreground">{paymentResult.paymentId}</span></p>
                        <p>Status: <span className="text-emerald-600 font-medium uppercase">{paymentResult.status}</span></p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Policy ID</p>
                      <p className="text-sm font-mono font-bold">POL-2025-{Math.floor(Math.random() * 9000 + 1000)}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Coverage Starts</p>
                      <p className="text-sm font-bold">Immediately</p>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-50">
                      <p className="text-xs text-muted-foreground">Auto-Trigger</p>
                      <p className="text-sm font-bold text-emerald-600">Active</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 mb-6 text-left">
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      How it works
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li>• Weather sensors continuously monitor your zone</li>
                      <li>• When thresholds are breached, payouts trigger automatically</li>
                      <li>• Money hits your wallet in under 2 minutes</li>
                      <li>• No claims needed — it&apos;s fully parametric</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button variant="default" onClick={() => router.push("/dashboard")}>
                      Go to Dashboard
                    </Button>
                    <Button variant="outline" onClick={() => router.push("/dashboard/map")}>
                      View Risk Map
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
