"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  CheckCircle2,
  Calendar,
  MapPin,
  Zap,
  TrendingUp,
} from "lucide-react";
import { PLAN_TIERS } from "@/lib/constants";

export default function PolicyPage() {
  const currentPlan = PLAN_TIERS[1]; // Standard
  const daysRemaining = 12;
  const totalDays = 30;
  const usagePercent = ((totalDays - daysRemaining) / totalDays) * 100;

  return (
    <div className="space-y-6">
      {/* Active Policy Card */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-slate-50 to-transparent" />
        <CardContent className="relative p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold">{currentPlan.name}</h2>
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {currentPlan.description}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Expires Mar 28, 2026</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    <span>Andheri, Mumbai</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Auto-renew ON</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <p className="text-3xl font-bold text-teal-600">
                  ₹{currentPlan.weeklyPremium}
                </p>
                <p className="text-xs text-muted-foreground">per week</p>
              </div>
              <p className="text-sm">
                Max payout:{" "}
                <span className="font-semibold text-emerald-600">
                  ₹{currentPlan.maxPayout}/event
                </span>
              </p>
            </div>
          </div>

          {/* Coverage period progress */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Coverage Period</span>
              <span>{daysRemaining} days remaining</span>
            </div>
            <Progress value={usagePercent} />
          </div>
        </CardContent>
      </Card>

      {/* Plan features + Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentPlan.features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Coverage stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coverage Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">₹3,110</p>
                <p className="text-xs text-muted-foreground mt-1">Total Claims Paid</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">7</p>
                <p className="text-xs text-muted-foreground mt-1">Claims Filed</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-teal-600">5</p>
                <p className="text-xs text-muted-foreground mt-1">Auto-Triggered</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">1.4x</p>
                <p className="text-xs text-muted-foreground mt-1">Risk Multiplier</p>
              </div>
            </div>

            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium">ROI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You&apos;ve paid <span className="text-foreground font-medium">₹75</span> in premiums and received{" "}
                <span className="text-emerald-600 font-medium">₹3,110</span> in payouts.
                That&apos;s a <span className="text-emerald-600 font-bold">41.5x</span> return.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upgrade Your Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_TIERS.map((plan) => {
              const isCurrent = plan.id === "standard";
              return (
                <div
                  key={plan.id}
                  className={`bg-white border border-slate-200 rounded-xl p-4 ${
                    isCurrent ? "border-teal-300 ring-1 ring-teal-200" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{plan.name}</h3>
                    {isCurrent && (
                      <Badge variant="default" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold mb-1">₹{plan.weeklyPremium}<span className="text-sm text-muted-foreground font-normal">/wk</span></p>
                  <p className="text-xs text-muted-foreground mb-4">Up to ₹{plan.maxPayout}/event</p>
                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    disabled={isCurrent}
                  >
                    {isCurrent ? "Current Plan" : "Upgrade"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
