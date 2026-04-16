"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  User,
  MapPin,
  Bike,
  CheckCircle,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { CITIES, PLATFORMS, PLAN_TIERS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const steps = [
  { label: "Personal", icon: User },
  { label: "Platform", icon: Bike },
  { label: "Location", icon: MapPin },
  { label: "Plan", icon: Shield },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => { setDirection(1); setStep((s) => s + 1); };
  const goBack = () => { setDirection(-1); setStep((s) => s - 1); };
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    platform: "",
    city: "",
    zone: "",
    plan: "standard",
  });

  const selectedCity = CITIES.find((c) => c.name === formData.city);

  const canContinue = [
    formData.name.trim().length > 1 && formData.phone.trim().length === 10,
    Boolean(formData.platform),
    Boolean(formData.city && formData.zone),
    true,
  ][step] ?? false;

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const email = formData.email || `${formData.phone}@gigcover.demo`;

    const { error: authError } = await supabase.auth.signUp({
      email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          phone: formData.phone,
          platform: formData.platform,
          city: formData.city,
          zone: formData.zone,
          plan: formData.plan,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative">
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">GigCover</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">
            Get income protection in under 2 minutes
          </p>
        </div>

        {/* Segmented Progress Bar */}
        <div className="mb-6">
          <div className="flex gap-1.5 mb-2">
            {steps.map((_, i) => (
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
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <s.icon className={`w-3 h-3 ${i <= step ? "text-teal-600" : "text-slate-300"}`} />
                <span className={`text-[10px] font-medium ${i === step ? "text-teal-700" : i < step ? "text-emerald-600" : "text-slate-400"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="shadow-xl border-0 glass-card">
          <CardContent className="p-6">
            <AnimatePresence mode="wait" custom={direction}>
              {/* Step 0: Personal */}
              {step === 0 && (
                <motion.div
                  key="personal"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-1">Personal Details</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Tell us a bit about yourself
                  </p>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Ravi Patel"
                        value={formData.name}
                        onChange={(e) => update("name", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Phone</label>
                    <div className="flex gap-2">
                      <div className="w-16 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-sm font-medium text-muted-foreground">
                        +91
                      </div>
                      <Input
                        type="tel"
                        placeholder="9876543210"
                        value={formData.phone}
                        onChange={(e) => update("phone", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="ravi@example.com"
                        value={formData.email}
                        onChange={(e) => update("email", e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) => update("password", e.target.value)}
                        className="pl-10 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Platform */}
              {step === 1 && (
                <motion.div
                  key="platform"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-1">Select Platform</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Which platform do you primarily deliver for?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {PLATFORMS.map((platform) => (
                      <button
                        key={platform.name}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.platform === platform.name
                            ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        onClick={() => update("platform", platform.name)}
                      >
                        <div className="text-2xl mb-2">{platform.icon}</div>
                        <p className="text-sm font-medium text-foreground">{platform.name}</p>
                        {formData.platform === platform.name && (
                          <CheckCircle className="w-4 h-4 text-teal-600 mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Location */}
              {step === 2 && (
                <motion.div
                  key="location"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-1">Your Location</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select your city and delivery zone for accurate risk assessment
                  </p>

                  <div>
                    <label className="text-xs font-medium text-foreground mb-1.5 block">City</label>
                    <div className="grid grid-cols-1 gap-2">
                      {CITIES.map((city) => (
                        <button
                          key={city.name}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            formData.city === city.name
                              ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            update("city", city.name);
                            update("zone", "");
                          }}
                        >
                          <MapPin className={`w-4 h-4 ${formData.city === city.name ? "text-teal-600" : "text-muted-foreground"}`} />
                          <span className="text-sm text-foreground">{city.name}</span>
                          <Badge variant="secondary" className="text-[10px] ml-auto">
                            {city.zones.length} zones
                          </Badge>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedCity && (
                    <div>
                      <label className="text-xs font-medium text-foreground mb-1.5 block">
                        Delivery Zone
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedCity.zones.map((zone) => (
                          <button
                            key={zone.id}
                            className={`p-2.5 rounded-lg border text-sm text-left transition-all ${
                              formData.zone === zone.name
                                ? "border-teal-300 bg-teal-50 text-teal-700"
                                : "border-slate-200 bg-white text-muted-foreground hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            onClick={() => update("zone", zone.name)}
                          >
                            {zone.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Plan */}
              {step === 3 && (
                <motion.div
                  key="plan"
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <h3 className="text-lg font-semibold text-foreground mb-1">Choose Your Plan</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select the coverage that fits your needs
                  </p>

                  <div className="space-y-3">
                    {PLAN_TIERS.map((plan) => (
                      <button
                        key={plan.id}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          formData.plan === plan.id
                            ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        } ${plan.popular ? "ring-1 ring-teal-200" : ""}`}
                        onClick={() => update("plan", plan.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">{plan.name}</span>
                            {plan.popular && (
                              <Badge variant="default" className="text-[9px]">
                                Recommended
                              </Badge>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-bold text-foreground">{formatCurrency(plan.weeklyPremium)}</span>
                            <span className="text-xs text-muted-foreground">/week</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          Max payout: {formatCurrency(plan.maxPayout)}/event
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {plan.features.slice(0, 3).map((f) => (
                            <span
                              key={f}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-muted-foreground"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                        {formData.plan === plan.id && (
                          <CheckCircle className="w-4 h-4 text-teal-600 mt-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={goBack}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <Button size="sm" onClick={goNext} disabled={!canContinue}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Complete Registration
                    </>
                  )}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Already have an account?{" "}
              <Link href="/login" className="text-teal-600 hover:text-teal-700 font-medium">
                Sign in
              </Link>
            </p>

            <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">15,000+</p>
                <p className="text-[10px] text-muted-foreground">Workers covered</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">₹4.5Cr+</p>
                <p className="text-[10px] text-muted-foreground">Paid out</p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">&lt; 2 min</p>
                <p className="text-[10px] text-muted-foreground">Avg payout time</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
