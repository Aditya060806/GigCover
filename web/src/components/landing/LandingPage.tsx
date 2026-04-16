"use client";

import { useState, useEffect, useRef } from "react";
import { useInView } from "framer-motion";
import Link from "next/link";
import {
  Shield,
  ArrowRight,
  Zap,
  Brain,
  MapPin,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Clock,
  Users,
  IndianRupee,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_TIERS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Navbar ────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: "#docs" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="section-container flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">GigCover</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="rounded-full px-5">
              Get Started <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-slate-200"
          >
            <div className="section-container py-4 space-y-3">
              {links.map((l) => (
                <a key={l.href} href={l.href} className="block text-sm text-muted-foreground py-2" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </a>
              ))}
              <div className="flex gap-3 pt-2">
                <Link href="/login" className="flex-1"><Button variant="outline" className="w-full" size="sm">Sign In</Button></Link>
                <Link href="/register" className="flex-1"><Button className="w-full" size="sm">Get Started</Button></Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────
const PLATFORMS = ["Swiggy Riders", "Zomato Partners", "Blinkit Agents", "Zepto Runners", "Amazon Flex"];

function HeroSection() {
  const [platformIdx, setPlatformIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPlatformIdx((i) => (i + 1) % PLATFORMS.length), 2400);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative pt-32 pb-24 overflow-hidden gradient-mesh">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      {/* Floating orbs */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-emerald-400/10 blur-3xl pointer-events-none" />

      <div className="section-container relative">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Badge variant="outline" className="mb-6 py-1.5 px-4 text-xs font-medium bg-white/80 backdrop-blur shadow-sm border-teal-200 text-teal-700">
              <div className="h-1.5 w-1.5 rounded-full bg-teal-500 mr-2 animate-pulse" />
              AI-Powered Parametric Insurance · DEVTrails 2026
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-tight text-foreground leading-[1.08] mb-6"
          >
            Income Protection for{" "}
            <span className="relative inline-block">
              <AnimatePresence mode="wait">
                <motion.span
                  key={platformIdx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                  className="text-teal-600 block sm:inline"
                >
                  {PLATFORMS[platformIdx]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Automatically protect delivery partners from weather-driven income
            loss. AI monitors conditions, triggers fire instantly, payouts land
            in under 2 minutes — zero paperwork.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex items-center justify-center gap-3 mb-14 flex-wrap"
          >
            <Link href="/register">
              <Button size="lg" className="rounded-full px-8 shadow-lg glow-teal-sm hover:glow-teal transition-all">
                Start Free Trial <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline" size="lg" className="rounded-full px-8 bg-white/80 backdrop-blur">
                Live Demo <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="max-w-4xl mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "15,000+", label: "Workers Protected", icon: Users, color: "text-teal-600" },
              { value: "98%", label: "Auto-Processed", icon: Zap, color: "text-amber-500" },
              { value: "< 2 min", label: "Average Payout", icon: Clock, color: "text-sky-500" },
              { value: "99.2%", label: "Fraud Detection", icon: Shield, color: "text-emerald-600" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.08 }}
                className="text-center p-5 rounded-2xl bg-white/90 backdrop-blur border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <stat.icon className={`h-5 w-5 ${stat.color} mx-auto mb-2.5`} />
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Tech Logos (Infinite Marquee) ─────────────────────────────
function TechRow() {
  const techs = ["Supabase", "XGBoost", "OpenWeatherMap", "Leaflet Maps", "SHAP Explainability", "Isolation Forest", "FastAPI", "Next.js 14", "Framer Motion", "Recharts", "Tailwind CSS"];
  const doubled = [...techs, ...techs];
  return (
    <section className="py-8 border-y border-slate-100 overflow-hidden bg-white">
      <div className="marquee-track gap-10 px-10">
        {doubled.map((t, i) => (
          <span key={i} className="text-sm font-semibold text-slate-300 hover:text-teal-600 transition-colors cursor-default whitespace-nowrap px-6">{t}</span>
        ))}
      </div>
    </section>
  );
}

// ─── Live Payout Ticker ────────────────────────────────────────
const TICKER_EVENTS = [
  { city: "Mumbai", zone: "Andheri West", trigger: "Heavy Rain 🌧️", amount: 400, worker: "Ravi P." },
  { city: "Delhi", zone: "Connaught Place", trigger: "AQI Hazardous 😷", amount: 240, worker: "Priya S." },
  { city: "Chennai", zone: "T. Nagar", trigger: "Extreme Heat 🔥", amount: 320, worker: "Arjun K." },
  { city: "Hyderabad", zone: "Banjara Hills", trigger: "Severe Storm 🌪️", amount: 560, worker: "Vikram R." },
  { city: "Bangalore", zone: "Koramangala", trigger: "Flooding 🌊", amount: 1500, worker: "Sita M." },
  { city: "Mumbai", zone: "Dadar", trigger: "Heavy Rain 🌧️", amount: 400, worker: "Rohit T." },
  { city: "Delhi", zone: "Dwarka", trigger: "AQI Hazardous 😷", amount: 240, worker: "Meera D." },
];

function LivePayoutTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((prev) => (prev + 1) % TICKER_EVENTS.length);
        setVisible(true);
      }, 400);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const event = TICKER_EVENTS[idx];

  return (
    <section className="py-6 bg-slate-900 overflow-hidden">
      <div className="section-container">
        <div className="flex items-center gap-4 justify-center">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Live Payouts</span>
          </div>
          <div className="h-5 w-px bg-slate-700" />
          <AnimatePresence mode="wait">
            {visible && (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="text-slate-300">{event.worker}</span>
                <span className="text-slate-500">in</span>
                <span className="text-slate-300 font-medium">{event.city}, {event.zone}</span>
                <span className="text-slate-500">received</span>
                <span className="text-emerald-400 font-bold">₹{event.amount.toLocaleString("en-IN")}</span>
                <span className="text-slate-500">via</span>
                <span className="text-amber-400">{event.trigger}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

// ─── Interactive Demo ──────────────────────────────────────────
function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState<"trigger" | "payout">("trigger");

  return (
    <section className="section-padding bg-slate-50" id="demo">
      <div className="section-container">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 bg-white">Live Preview</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Weather triggers. Instant payouts.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            See how GigCover processes real-time weather data and automatically
            compensates affected workers — no claims needed.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>WEATHER EVENT</span>
                <span className="text-slate-300 mx-1">&middot;</span>
                <span className="text-slate-400">Mumbai, Andheri West</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setActiveTab("trigger")} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeTab === "trigger" ? "bg-teal-100 text-teal-700" : "text-muted-foreground hover:bg-slate-100"}`}>
                  1. Trigger
                </button>
                <button onClick={() => setActiveTab("payout")} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeTab === "payout" ? "bg-teal-100 text-teal-700" : "text-muted-foreground hover:bg-slate-100"}`}>
                  2. Payout
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 divide-x divide-slate-100">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeTab === "trigger" ? "WEATHER DATA" : "CLAIM RECORD"}
                  </span>
                </div>
                <div className="font-mono text-sm space-y-1 text-slate-700 bg-slate-50 rounded-lg p-4 border border-slate-100">
                  {activeTab === "trigger" ? (
                    <>
                      <p>{"{"}</p>
                      <p>{"  "}<span className="text-teal-600">&quot;source&quot;</span>: <span className="text-amber-600">&quot;OpenWeatherMap&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;city&quot;</span>: <span className="text-amber-600">&quot;Mumbai&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;zone&quot;</span>: <span className="text-amber-600">&quot;Andheri West&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;rainfall_mm&quot;</span>: <span className="text-blue-600">38.5</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;temp_c&quot;</span>: <span className="text-blue-600">29.2</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;aqi&quot;</span>: <span className="text-blue-600">156</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;wind_kmh&quot;</span>: <span className="text-blue-600">22.4</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;timestamp&quot;</span>: <span className="text-amber-600">&quot;2026-03-05T14:30Z&quot;</span></p>
                      <p>{"}"}</p>
                    </>
                  ) : (
                    <>
                      <p>{"{"}</p>
                      <p>{"  "}<span className="text-teal-600">&quot;claim_id&quot;</span>: <span className="text-amber-600">&quot;CLM-2026-4821&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;worker&quot;</span>: <span className="text-amber-600">&quot;Ravi Patel&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;trigger&quot;</span>: <span className="text-amber-600">&quot;heavy_rain&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;value&quot;</span>: <span className="text-blue-600">38.5</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;threshold&quot;</span>: <span className="text-blue-600">30.0</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;payout&quot;</span>: <span className="text-emerald-600">400</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;status&quot;</span>: <span className="text-amber-600">&quot;paid&quot;</span>,</p>
                      <p>{"  "}<span className="text-teal-600">&quot;time&quot;</span>: <span className="text-amber-600">&quot;1m 42s&quot;</span></p>
                      <p>{"}"}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-teal-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {activeTab === "trigger" ? "GIGCOVER RESPONSE" : "WORKER PAYOUT"}
                  </span>
                </div>
                {activeTab === "trigger" ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">Trigger Fired: Heavy Rain</span>
                      </div>
                      <p className="text-xs text-amber-700">
                        Rainfall 38.5mm/hr exceeds threshold of 30mm/hr in Andheri West.
                      </p>
                    </div>
                    <div className="space-y-3">
                      {[
                        ["Workers affected", "247"],
                        ["Payout per worker", "₹400"],
                        ["Total disbursed", "₹98,800"],
                        ["Fraud score", "0.03 (clean)"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs text-emerald-700 font-medium">All payouts processed in 1m 42s</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700">RP</div>
                      <div>
                        <p className="text-sm font-semibold">Ravi Patel</p>
                        <p className="text-xs text-muted-foreground">Swiggy · Andheri West</p>
                      </div>
                      <Badge variant="success" className="ml-auto text-[10px]">PAID</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["Trigger", "Heavy Rain"],
                        ["Payout", "₹400"],
                        ["Policy", "Standard Shield"],
                        ["Speed", "1m 42s"],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{label}</p>
                          <p className={`text-sm font-semibold ${label === "Payout" ? "text-teal-600" : ""}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-2">
                      <p className="text-xs text-emerald-700">
                        <span className="font-semibold">Done.</span> Payout credited via UPI. Worker notified by SMS.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Features ──────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, description, delay }: { icon: React.ElementType; title: string; description: string; delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="group p-6 rounded-2xl border border-slate-200 bg-white hover:border-teal-200 hover:shadow-lg transition-all duration-300 cursor-default"
    >
      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
        <Icon className="h-5 w-5 text-teal-600" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

function FeaturesSection() {
  const features = [
    { icon: Brain, title: "AI Risk Pricing", description: "XGBoost dynamically prices premiums per zone, platform, and season based on historical weather patterns." },
    { icon: Zap, title: "Parametric Auto-Triggers", description: "When rainfall > 30mm/hr or AQI > 300, payouts fire automatically. No claims, no waiting." },
    { icon: Shield, title: "SHAP Fraud Detection", description: "Isolation Forest anomaly detection with SHAP explainability. Full transparency on every decision." },
    { icon: MapPin, title: "Live Risk Map", description: "Interactive Leaflet map with real-time zone risk scores across 5 Indian cities." },
    { icon: IndianRupee, title: "Instant UPI Payouts", description: "Workers receive payouts in under 2 minutes via UPI. Avg processing: 1m 42s." },
    { icon: BarChart3, title: "Zone Analytics", description: "Deep analytics on triggers, payouts, loss ratios, and retention by city and zone." },
  ];

  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-40px" });

  return (
    <section className="section-padding" id="features">
      <div className="section-container">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 16 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <Badge variant="outline" className="mb-4 bg-white">Features</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Everything you need for parametric insurance</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">A complete platform for risk assessment, automated triggers, fraud detection, and instant payouts.</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.07} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ───────────────────────────────────────────────
const TESTIMONIALS = [
  { name: "Ravi Patel", platform: "Swiggy · Andheri West", initials: "RP", quote: "Rained heavily at 2pm, I couldn't deliver. Got ₹400 in my UPI within 2 minutes. No forms, nothing.", stars: 5 },
  { name: "Priya Sharma", platform: "Zomato · Koramangala", initials: "PS", quote: "Finally insurance that actually pays out fast. I've filed 3 claims and all 3 were approved automatically.", stars: 5 },
  { name: "Mohammed Farooq", platform: "Blinkit · Dwarka", initials: "MF", quote: "The AQI hit 310 last week. GigCover triggered a payout automatically before I even noticed the alert.", stars: 5 },
];

function TestimonialsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <section className="section-padding bg-gradient-to-b from-white to-slate-50">
      <div className="section-container">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 bg-white">Worker Stories</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Trusted by 15,000+ gig workers</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Real payouts. Real workers. Real protection.</p>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <span key={s} className="text-amber-400 text-base">★</span>
                ))}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-5">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">{t.initials}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.platform}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ───────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    { num: "01", title: "Register Workers", description: "Onboard delivery partners with city, zone, and platform. KYC in 2 minutes.", icon: Users },
    { num: "02", title: "AI Prices Coverage", description: "XGBoost calculates risk-adjusted premiums using zone weather history.", icon: Brain },
    { num: "03", title: "Real-Time Monitoring", description: "Weather APIs feed live rainfall, temperature, AQI, wind data 24/7.", icon: Activity },
    { num: "04", title: "Auto Payout", description: "Thresholds breach → payouts fire instantly to UPI. Zero intervention.", icon: Zap },
  ];

  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="section-padding bg-slate-50" id="how-it-works">
      <div className="section-container">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <Badge variant="outline" className="mb-4 bg-white">Process</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How GigCover works</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">From registration to payout in four simple steps.</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.num}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative text-center"
            >
              {i < steps.length - 1 && <div className="hidden md:block absolute top-10 left-[60%] right-[-40%] h-px bg-slate-200" />}
              <div className="relative z-10">
                <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-4 hover:border-teal-200 hover:shadow-md transition-all">
                  <s.icon className="h-8 w-8 text-teal-600" />
                </div>
                <span className="text-xs font-mono font-bold text-teal-600 mb-2 block">{s.num}</span>
                <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Triggers ──────────────────────────────────────────────────
function TriggersSection() {
  const triggers = [
    { icon: "🌧️", name: "Heavy Rain", threshold: "> 30mm/hr", payout: "50%" },
    { icon: "🌊", name: "Flooding", threshold: "> 100mm/24hr", payout: "100%" },
    { icon: "🌡️", name: "Extreme Heat", threshold: "> 45°C", payout: "25%" },
    { icon: "💨", name: "Hazardous AQI", threshold: "> 300 AQI", payout: "30%" },
    { icon: "🌪️", name: "Severe Storm", threshold: "> 60km/h", payout: "40%" },
    { icon: "🚫", name: "Curfew / Bandh", threshold: "Govt order", payout: "100%" },
  ];

  return (
    <section className="section-padding" id="docs">
      <div className="section-container">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 bg-white">Parametric Triggers</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Objective data. Automatic payouts.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">No loss assessment, no manual claims. Sensor data crosses thresholds, payouts fire instantly.</p>
        </div>
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Trigger</span><span>Threshold</span><span>Payout</span><span>Status</span>
            </div>
            {triggers.map((t) => {
              const pct = parseInt(t.payout);
              return (
                <div key={t.name} className="grid grid-cols-4 px-6 py-4 items-center border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <span className="text-sm font-medium">{t.name}</span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">{t.threshold}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[60px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                      />
                    </div>
                    <span className="text-sm font-semibold text-teal-600">{t.payout}</span>
                  </div>
                  <Badge variant="success" className="w-fit text-[10px]">Active</Badge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ───────────────────────────────────────────────────
function PricingSection() {
  return (
    <section className="section-padding bg-slate-50" id="pricing">
      <div className="section-container">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-4 bg-white">Pricing</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Start free. Upgrade when you&apos;re ready.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Simple per-worker weekly pricing. No hidden fees.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PLAN_TIERS.map((plan) => (
            <motion.div
              key={plan.id}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300 }}
              className={`relative p-6 rounded-2xl border bg-white transition-shadow ${plan.popular ? "border-teal-300 shadow-lg ring-2 ring-teal-200/60" : "border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md"}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-teal-600 text-white border-teal-600 text-[10px] shadow-sm">Most Popular</Badge>
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-3xl font-bold text-foreground">{formatCurrency(plan.weeklyPremium)}</span>
                <span className="text-sm text-muted-foreground">/week per worker</span>
              </div>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-teal-500 mt-0.5 flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button className="w-full rounded-full" variant={plan.popular ? "default" : "outline"}>Get Started</Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ───────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="section-padding">
      <div className="section-container">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 rounded-3xl p-10 md:p-14 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl" />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to protect your workers?</h2>
          <p className="text-slate-300 mb-8 max-w-lg mx-auto">Join 15,000+ gig workers already covered. Set up parametric insurance in under 5 minutes.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register">
              <Button size="lg" className="rounded-full px-8 bg-teal-500 hover:bg-teal-400 text-white">Start Free Trial <ArrowRight className="h-4 w-4 ml-1.5" /></Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="rounded-full px-8 border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">View Demo</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ────────────────────────────────────────────────────
function Footer() {
  const columns = [
    { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "How It Works", href: "#how-it-works" }, { label: "Pricing", href: "#pricing" }, { label: "Trigger Matrix", href: "#docs" }] },
    { title: "Explore", links: [{ label: "Live Demo", href: "#demo" }, { label: "Worker Dashboard", href: "/dashboard" }, { label: "Admin Overview", href: "/admin" }] },
    { title: "Get Started", links: [{ label: "Register", href: "/register" }, { label: "Login", href: "/login" }, { label: "Get Insured", href: "/insure" }] },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="section-container section-padding">
        <div className="grid md:grid-cols-5 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-foreground">GigCover</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">AI-powered parametric insurance protecting India&apos;s gig workers from weather-driven income loss.</p>
            <p className="text-xs text-muted-foreground">DEVTrails 2026 — Team Vandalizers</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-foreground mb-3">{col.title}</p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}><a href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="section-container py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">Data Privacy: We never use or sell your data to third parties.</p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} GigCover. Built for Guidewire DEVTrails 2026.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Sticky CTA ────────────────────────────────────────────────
function StickyBottomCTA() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
          <div className="section-container py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground hidden sm:block">Ready to protect your gig workers?</p>
            <div className="flex items-center gap-3 ml-auto">
              <Link href="/register">
                <Button size="sm" className="rounded-full px-5">Start Free Trial <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Export ───────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <LivePayoutTicker />
      <TechRow />
      <InteractiveDemo />
      <FeaturesSection />
      <TestimonialsSection />
      <HowItWorksSection />
      <TriggersSection />
      <PricingSection />
      <CTASection />
      <Footer />
      <StickyBottomCTA />
    </div>
  );
}

export default Navbar;
