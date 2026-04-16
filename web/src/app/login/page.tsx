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
  Loader2,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("phone");
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const email =
      loginMethod === "phone"
        ? `${formData.phone}@gigcover.demo`
        : formData.email;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: formData.password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-mesh relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-teal-400/8 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-emerald-400/8 blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg"
            >
              <Shield className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-2xl font-bold text-foreground">GigCover</span>
          </Link>
          <p className="text-sm text-muted-foreground mt-2">
            Welcome back! Sign in to your account
          </p>
        </div>

        <Card className="shadow-xl border-0 glass-card">
          <CardContent className="p-6">
            {/* Login Method Toggle */}
            <div className="flex p-1 rounded-lg bg-slate-100 mb-6">
              <button
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMethod === "phone"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setLoginMethod("phone")}
              >
                <Smartphone className="w-3.5 h-3.5 inline mr-1.5" />
                Phone
              </button>
              <button
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                  loginMethod === "email"
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setLoginMethod("email")}
              >
                <Mail className="w-3.5 h-3.5 inline mr-1.5" />
                Email
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {loginMethod === "phone" ? (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    <div className="w-16 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-sm font-medium text-muted-foreground">
                      +91
                    </div>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="flex-1"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="worker@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, password: e.target.value }))
                    }
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300" />
                  <span className="text-muted-foreground">Remember me</span>
                </label>
                <Link href="#" className="text-teal-600 hover:text-teal-700 font-medium">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="text-teal-600 hover:text-teal-700 font-medium"
                >
                  Register now
                </Link>
              </p>
            </div>

            {/* Quick Access */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-muted-foreground text-center mb-3 uppercase tracking-wider font-medium">
                Quick Demo Access
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => router.push("/dashboard")}
                >
                  Worker Demo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => router.push("/admin")}
                >
                  Admin Demo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
