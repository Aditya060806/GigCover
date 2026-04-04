export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      weather_events: {
        Row: {
          id: string;
          city: string;
          zone: string;
          rainfall_mm: number;
          temp_c: number;
          aqi: number;
          wind_speed_kmh: number;
          humidity: number | null;
          triggers_fired: string[];
          is_extreme: boolean;
          severity: string;
          lat: number | null;
          lng: number | null;
          source: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          city: string;
          zone: string;
          rainfall_mm?: number;
          temp_c?: number;
          aqi?: number;
          wind_speed_kmh?: number;
          humidity?: number | null;
          triggers_fired?: string[];
          is_extreme?: boolean;
          lat?: number | null;
          lng?: number | null;
          source?: string;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          city?: string;
          zone?: string;
          rainfall_mm?: number;
          temp_c?: number;
          aqi?: number;
          wind_speed_kmh?: number;
          humidity?: number | null;
          triggers_fired?: string[];
          is_extreme?: boolean;
          lat?: number | null;
          lng?: number | null;
          source?: string;
          recorded_at?: string;
        };
        Relationships: [];
      };
      zones: {
        Row: {
          id: string;
          city: string;
          zone_name: string;
          lat: number;
          lng: number;
          risk_level: string;
          flood_prone: boolean;
          density: string;
          current_rainfall: number;
          current_aqi: number;
          current_temp: number;
          current_wind: number;
          active_workers: number;
          active_policies: number;
          total_claims: number;
          total_payouts: number;
          last_updated: string;
        };
        Insert: {
          id?: string;
          city: string;
          zone_name: string;
          lat: number;
          lng: number;
          risk_level?: string;
          flood_prone?: boolean;
          density?: string;
          current_rainfall?: number;
          current_aqi?: number;
          current_temp?: number;
          current_wind?: number;
          active_workers?: number;
          active_policies?: number;
          total_claims?: number;
          total_payouts?: number;
          last_updated?: string;
        };
        Update: {
          id?: string;
          city?: string;
          zone_name?: string;
          lat?: number;
          lng?: number;
          risk_level?: string;
          flood_prone?: boolean;
          density?: string;
          current_rainfall?: number;
          current_aqi?: number;
          current_temp?: number;
          current_wind?: number;
          active_workers?: number;
          active_policies?: number;
          total_claims?: number;
          total_payouts?: number;
          last_updated?: string;
        };
        Relationships: [];
      };
      gig_workers: {
        Row: {
          id: string;
          worker_id: string;
          name: string;
          phone: string;
          email: string | null;
          platform: string;
          city: string;
          zone: string;
          plan: string;
          weekly_premium: number;
          max_payout: number;
          status: string;
          lat: number | null;
          lng: number | null;
          avg_daily_earnings: number;
          total_earnings: number;
          total_claims: number;
          total_payouts: number;
          fraud_flags: number;
          risk_score: number;
          auth_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          name: string;
          phone: string;
          email?: string | null;
          platform: string;
          city: string;
          zone: string;
          plan?: string;
          weekly_premium?: number;
          max_payout?: number;
          status?: string;
          lat?: number | null;
          lng?: number | null;
          avg_daily_earnings?: number;
          total_earnings?: number;
          total_claims?: number;
          total_payouts?: number;
          fraud_flags?: number;
          risk_score?: number;
          auth_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          name?: string;
          phone?: string;
          email?: string | null;
          platform?: string;
          city?: string;
          zone?: string;
          plan?: string;
          weekly_premium?: number;
          max_payout?: number;
          status?: string;
          lat?: number | null;
          lng?: number | null;
          avg_daily_earnings?: number;
          total_earnings?: number;
          total_claims?: number;
          total_payouts?: number;
          fraud_flags?: number;
          risk_score?: number;
          auth_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      policies: {
        Row: {
          id: string;
          policy_id: string;
          worker_id: string;
          plan: string;
          weekly_premium: number;
          max_payout: number;
          status: string;
          coverage_start: string;
          coverage_end: string | null;
          auto_renew: boolean;
          renewal_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          policy_id: string;
          worker_id: string;
          plan: string;
          weekly_premium: number;
          max_payout: number;
          status?: string;
          coverage_start?: string;
          coverage_end?: string | null;
          auto_renew?: boolean;
          renewal_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          policy_id?: string;
          worker_id?: string;
          plan?: string;
          weekly_premium?: number;
          max_payout?: number;
          status?: string;
          coverage_start?: string;
          coverage_end?: string | null;
          auto_renew?: boolean;
          renewal_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      claims: {
        Row: {
          id: string;
          claim_id: string;
          worker_id: string;
          policy_id: string | null;
          trigger_type: string;
          weather_event_id: string | null;
          city: string;
          zone: string;
          amount: number;
          status: string;
          auto_triggered: boolean;
          fraud_score: number;
          process_time: string | null;
          payout_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          claim_id: string;
          worker_id: string;
          policy_id?: string | null;
          trigger_type: string;
          weather_event_id?: string | null;
          city: string;
          zone: string;
          amount: number;
          status?: string;
          auto_triggered?: boolean;
          fraud_score?: number;
          process_time?: string | null;
          payout_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          claim_id?: string;
          worker_id?: string;
          policy_id?: string | null;
          trigger_type?: string;
          weather_event_id?: string | null;
          city?: string;
          zone?: string;
          amount?: number;
          status?: string;
          auto_triggered?: boolean;
          fraud_score?: number;
          process_time?: string | null;
          payout_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          worker_id: string;
          type: string;
          amount: number;
          description: string | null;
          claim_id: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          type: string;
          amount: number;
          description?: string | null;
          claim_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          type?: string;
          amount?: number;
          description?: string | null;
          claim_id?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      fraud_logs: {
        Row: {
          id: string;
          worker_id: string | null;
          claim_id: string | null;
          fraud_score: number;
          risk_level: string;
          reason: string | null;
          shap_values: Json | null;
          model_version: string;
          status: string;
          resolved_by: string | null;
          resolved_at: string | null;
          detected_at: string;
        };
        Insert: {
          id?: string;
          worker_id?: string | null;
          claim_id?: string | null;
          fraud_score: number;
          risk_level: string;
          reason?: string | null;
          shap_values?: Json | null;
          model_version?: string;
          status?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
          detected_at?: string;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          claim_id?: string | null;
          fraud_score?: number;
          risk_level?: string;
          reason?: string | null;
          shap_values?: Json | null;
          model_version?: string;
          status?: string;
          resolved_by?: string | null;
          resolved_at?: string | null;
          detected_at?: string;
        };
        Relationships: [];
      };
      trigger_events: {
        Row: {
          id: string;
          trigger_type: string;
          city: string;
          zone: string;
          measured_value: number;
          threshold_value: number;
          workers_affected: number;
          total_payout: number;
          status: string;
          is_manual: boolean;
          weather_event_id: string | null;
          triggered_at: string;
        };
        Insert: {
          id?: string;
          trigger_type: string;
          city: string;
          zone: string;
          measured_value: number;
          threshold_value: number;
          workers_affected?: number;
          total_payout?: number;
          status?: string;
          is_manual?: boolean;
          weather_event_id?: string | null;
          triggered_at?: string;
        };
        Update: {
          id?: string;
          trigger_type?: string;
          city?: string;
          zone?: string;
          measured_value?: number;
          threshold_value?: number;
          workers_affected?: number;
          total_payout?: number;
          status?: string;
          is_manual?: boolean;
          weather_event_id?: string | null;
          triggered_at?: string;
        };
        Relationships: [];
      };
      incident_runs: {
        Row: {
          id: string;
          city: string;
          zone: string;
          trigger_type: string;
          mode: string;
          workers_affected: number;
          total_estimated_payout: number;
          avg_payout_per_worker: number;
          threshold_value: number;
          measured_value: number;
          trigger_event_id: string | null;
          started_at: string;
          completed_at: string | null;
          duration_ms: number | null;
        };
        Insert: {
          id?: string;
          city: string;
          zone: string;
          trigger_type: string;
          mode?: string;
          workers_affected?: number;
          total_estimated_payout?: number;
          avg_payout_per_worker?: number;
          threshold_value?: number;
          measured_value?: number;
          trigger_event_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          duration_ms?: number | null;
        };
        Update: {
          id?: string;
          city?: string;
          zone?: string;
          trigger_type?: string;
          mode?: string;
          workers_affected?: number;
          total_estimated_payout?: number;
          avg_payout_per_worker?: number;
          threshold_value?: number;
          measured_value?: number;
          trigger_event_id?: string | null;
          started_at?: string;
          completed_at?: string | null;
          duration_ms?: number | null;
        };
        Relationships: [];
      };
      claim_appeals: {
        Row: {
          id: string;
          claim_public_id: string;
          claim_row_id: string;
          worker_id: string;
          reason: string;
          status: string;
          reviewer: string | null;
          resolution_note: string | null;
          submitted_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          claim_public_id: string;
          claim_row_id: string;
          worker_id: string;
          reason: string;
          status?: string;
          reviewer?: string | null;
          resolution_note?: string | null;
          submitted_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          claim_public_id?: string;
          claim_row_id?: string;
          worker_id?: string;
          reason?: string;
          status?: string;
          reviewer?: string | null;
          resolution_note?: string | null;
          submitted_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          table_name: string;
          record_id: string;
          action: string;
          old_data: Json | null;
          new_data: Json | null;
          changed_by: string;
          changed_at: string;
        };
        Insert: {
          id?: string;
          table_name: string;
          record_id: string;
          action: string;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_by?: string;
          changed_at?: string;
        };
        Update: {
          id?: string;
          table_name?: string;
          record_id?: string;
          action?: string;
          old_data?: Json | null;
          new_data?: Json | null;
          changed_by?: string;
          changed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_dashboard_kpis: {
        Row: {
          active_workers: number;
          active_policies: number;
          total_claims: number;
          paid_claims: number;
          total_payouts: number;
          flagged_claims: number;
          auto_payouts: number;
          avg_fraud_score: number;
          extreme_events: number;
        };
        Relationships: [];
      };
      v_recent_claims: {
        Row: {
          id: string;
          claim_id: string;
          city: string;
          zone: string;
          trigger_type: string;
          amount: number;
          status: string;
          auto_triggered: boolean;
          fraud_score: number;
          process_time: string | null;
          created_at: string;
          worker_gw_id: string;
          worker_name: string;
          platform: string;
          plan: string;
        };
        Relationships: [];
      };
      v_zone_heatmap: {
        Row: {
          city: string;
          zone_name: string;
          lat: number;
          lng: number;
          risk_level: string;
          flood_prone: boolean;
          density: string;
          current_rainfall: number;
          current_aqi: number;
          current_temp: number;
          current_wind: number;
          active_workers: number;
          active_policies: number;
          total_claims: number;
          total_payouts: number;
          extreme_event_count: number;
          last_updated: string;
        };
        Relationships: [];
      };
      v_fraud_queue: {
        Row: {
          id: string;
          fraud_score: number;
          risk_level: string;
          reason: string | null;
          shap_values: Json | null;
          investigation_status: string;
          detected_at: string;
          claim_id: string;
          trigger_type: string;
          claim_amount: number;
          city: string;
          zone: string;
          worker_gw_id: string;
          worker_name: string;
          platform: string;
          fraud_flags: number;
          worker_total_claims: number;
        };
        Relationships: [];
      };
      v_worker_risk: {
        Row: {
          id: string;
          worker_id: string;
          name: string;
          platform: string;
          city: string;
          zone: string;
          plan: string;
          risk_score: number;
          fraud_flags: number;
          total_claims: number;
          total_payouts: number;
          status: string;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// Convenience types
export type WeatherEvent = Database["public"]["Tables"]["weather_events"]["Row"];
export type Zone = Database["public"]["Tables"]["zones"]["Row"];
export type GigWorker = Database["public"]["Tables"]["gig_workers"]["Row"];
export type Policy = Database["public"]["Tables"]["policies"]["Row"];
export type Claim = Database["public"]["Tables"]["claims"]["Row"];
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
export type FraudLog = Database["public"]["Tables"]["fraud_logs"]["Row"];
export type TriggerEvent = Database["public"]["Tables"]["trigger_events"]["Row"];
export type IncidentRun = Database["public"]["Tables"]["incident_runs"]["Row"];
export type ClaimAppeal = Database["public"]["Tables"]["claim_appeals"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"];

// View types
export type DashboardKPIs = Database["public"]["Views"]["v_dashboard_kpis"]["Row"];
export type RecentClaim = Database["public"]["Views"]["v_recent_claims"]["Row"];
export type ZoneHeatmap = Database["public"]["Views"]["v_zone_heatmap"]["Row"];
export type FraudQueueItem = Database["public"]["Views"]["v_fraud_queue"]["Row"];
export type WorkerRisk = Database["public"]["Views"]["v_worker_risk"]["Row"];
