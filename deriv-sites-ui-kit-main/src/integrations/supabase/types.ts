export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_platform_sales: {
        Row: {
          created_at: string
          customer_email: string
          developer_cut: number
          id: string
          owner_earnings: number
          platform_id: string
          sale_amount: number
          sale_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email: string
          developer_cut: number
          id?: string
          owner_earnings: number
          platform_id: string
          sale_amount: number
          sale_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string
          developer_cut?: number
          id?: string
          owner_earnings?: number
          platform_id?: string
          sale_amount?: number
          sale_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_platform_sales_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "api_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      api_platforms: {
        Row: {
          commission_rate: number
          created_at: string
          developer_commission_rate: number
          developer_ownership_fee: number
          domain_name: string
          id: string
          owner_id: string
          ownership_price: number
          platform_name: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          developer_commission_rate?: number
          developer_ownership_fee?: number
          domain_name: string
          id?: string
          owner_id: string
          ownership_price?: number
          platform_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          developer_commission_rate?: number
          developer_ownership_fee?: number
          domain_name?: string
          id?: string
          owner_id?: string
          ownership_price?: number
          platform_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      commissions: {
        Row: {
          amount: number
          commission_fee: number
          created_at: string
          id: string
          net_amount: number
          period_end: string
          period_start: string
          site_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          commission_fee?: number
          created_at?: string
          id?: string
          net_amount?: number
          period_end: string
          period_start: string
          site_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          commission_fee?: number
          created_at?: string
          id?: string
          net_amount?: number
          period_end?: string
          period_start?: string
          site_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_purchases: {
        Row: {
          amount: number
          created_at: string
          domain_name: string
          email: string | null
          failure_reason: string | null
          id: string
          lipana_transaction_id: string | null
          mpesa_receipt_number: string | null
          payment_date: string | null
          phone_number: string
          status: string
          tracking_number: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          domain_name: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          lipana_transaction_id?: string | null
          mpesa_receipt_number?: string | null
          payment_date?: string | null
          phone_number: string
          status?: string
          tracking_number?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          domain_name?: string
          email?: string | null
          failure_reason?: string | null
          id?: string
          lipana_transaction_id?: string | null
          mpesa_receipt_number?: string | null
          payment_date?: string | null
          phone_number?: string
          status?: string
          tracking_number?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sites: {
        Row: {
          created_at: string
          deleted_bot_name: string | null
          deriv_affiliate_id: string | null
          domain_id: string | null
          id: string
          name: string
          pending_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_bot_name?: string | null
          deriv_affiliate_id?: string | null
          domain_id?: string | null
          id?: string
          name: string
          pending_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_bot_name?: string | null
          deriv_affiliate_id?: string | null
          domain_id?: string | null
          id?: string
          name?: string
          pending_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domain_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      site_bots_manifest: {
        Row: {
          bot_id: string | null
          category: string | null
          created_at: string
          description: string | null
          display_name: string
          display_order: number
          file_path: string | null
          id: string
          is_active: boolean
          site_id: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          bot_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          display_order?: number
          file_path?: string | null
          id?: string
          is_active?: boolean
          site_id: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          bot_id?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          display_order?: number
          file_path?: string | null
          id?: string
          is_active?: boolean
          site_id?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_bots_manifest_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_deriv_apps: {
        Row: {
          created_at: string
          deriv_app_id: string | null
          id: string
          include_legacy_app_id_in_oauth: boolean
          oauth_client_id: string | null
          redirect_uri: string | null
          site_id: string
          updated_at: string
          use_legacy_oauth_login: boolean
        }
        Insert: {
          created_at?: string
          deriv_app_id?: string | null
          id?: string
          include_legacy_app_id_in_oauth?: boolean
          oauth_client_id?: string | null
          redirect_uri?: string | null
          site_id: string
          updated_at?: string
          use_legacy_oauth_login?: boolean
        }
        Update: {
          created_at?: string
          deriv_app_id?: string | null
          id?: string
          include_legacy_app_id_in_oauth?: boolean
          oauth_client_id?: string | null
          redirect_uri?: string | null
          site_id?: string
          updated_at?: string
          use_legacy_oauth_login?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "site_deriv_apps_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_domains: {
        Row: {
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          is_verified: boolean
          site_id: string
          ssl_status: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          site_id: string
          ssl_status?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          site_id?: string
          ssl_status?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_domains_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_features: {
        Row: {
          auto_trades: boolean
          best_bots: boolean
          bot_ideas: boolean
          chart: boolean
          copy_trading: boolean
          created_at: string
          id: string
          manual_trading: boolean
          percentage_tool: boolean
          print_popups: boolean
          scanner: boolean
          site_id: string
          updated_at: string
        }
        Insert: {
          auto_trades?: boolean
          best_bots?: boolean
          bot_ideas?: boolean
          chart?: boolean
          copy_trading?: boolean
          created_at?: string
          id?: string
          manual_trading?: boolean
          percentage_tool?: boolean
          print_popups?: boolean
          scanner?: boolean
          site_id: string
          updated_at?: string
        }
        Update: {
          auto_trades?: boolean
          best_bots?: boolean
          bot_ideas?: boolean
          chart?: boolean
          copy_trading?: boolean
          created_at?: string
          id?: string
          manual_trading?: boolean
          percentage_tool?: boolean
          print_popups?: boolean
          scanner?: boolean
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_features_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          label: string | null
          page_key: string
          site_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          page_key: string
          site_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          label?: string | null
          page_key?: string
          site_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_publish_versions: {
        Row: {
          config_snapshot_json: Json
          created_at: string
          id: string
          published_at: string | null
          published_by: string | null
          site_id: string
          status: string
          version_number: number
        }
        Insert: {
          config_snapshot_json?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          site_id: string
          status?: string
          version_number: number
        }
        Update: {
          config_snapshot_json?: Json
          created_at?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          site_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_publish_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_publish_versions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      tools: {
        Row: {
          category: string
          configuration_schema: Json
          created_at: string
          current_version: string
          default_settings: Json
          description: string | null
          icon: string | null
          id: string
          key: string
          minimum_plan: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          configuration_schema?: Json
          current_version?: string
          default_settings?: Json
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          minimum_plan?: string
          name: string
          status?: string
        }
        Update: {
          category?: string
          configuration_schema?: Json
          current_version?: string
          default_settings?: Json
          description?: string | null
          icon?: string | null
          key?: string
          minimum_plan?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      site_deployments: {
        Row: {
          commit_message: string | null
          commit_sha: string | null
          commit_url: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          netlify_deploy_id: string | null
          netlify_deploy_url: string | null
          netlify_log_url: string | null
          deploy_context: string | null
          provider: string
          publish_version_id: string | null
          repository_branch: string | null
          repository_name: string | null
          repository_owner: string | null
          repository_path: string | null
          requested_by: string | null
          retry_of: string | null
          rollback_of: string | null
          site_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          commit_message?: string | null
          commit_sha?: string | null
          commit_url?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          netlify_deploy_id?: string | null
          netlify_deploy_url?: string | null
          netlify_log_url?: string | null
          deploy_context?: string | null
          provider?: string
          publish_version_id?: string | null
          repository_branch?: string | null
          repository_name?: string | null
          repository_owner?: string | null
          repository_path?: string | null
          requested_by?: string | null
          retry_of?: string | null
          rollback_of?: string | null
          site_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          commit_message?: string | null
          commit_sha?: string | null
          commit_url?: string | null
          completed_at?: string | null
          error_message?: string | null
          metadata?: Json
          netlify_deploy_id?: string | null
          netlify_deploy_url?: string | null
          netlify_log_url?: string | null
          deploy_context?: string | null
          repository_branch?: string | null
          repository_name?: string | null
          repository_owner?: string | null
          repository_path?: string | null
          retry_of?: string | null
          rollback_of?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_deployments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_deployments_publish_version_id_fkey"
            columns: ["publish_version_id"]
            isOneToOne: false
            referencedRelation: "site_publish_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_integrations: {
        Row: {
          created_at: string
          github_config_root: string
          github_default_branch: string
          github_installation_id: number | null
          github_repository_name: string | null
          github_repository_owner: string | null
          id: string
          last_error: string | null
          netlify_account_id: string | null
          netlify_admin_url: string | null
          netlify_build_hook_url: string | null
          netlify_site_id: string | null
          netlify_site_name: string | null
          netlify_site_url: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          github_config_root?: string
          github_default_branch?: string
          github_installation_id?: number | null
          github_repository_name?: string | null
          github_repository_owner?: string | null
          last_error?: string | null
          netlify_account_id?: string | null
          netlify_admin_url?: string | null
          netlify_build_hook_url?: string | null
          netlify_site_id?: string | null
          netlify_site_name?: string | null
          netlify_site_url?: string | null
          site_id: string
          status?: string
        }
        Update: {
          github_config_root?: string
          github_default_branch?: string
          github_installation_id?: number | null
          github_repository_name?: string | null
          github_repository_owner?: string | null
          last_error?: string | null
          netlify_account_id?: string | null
          netlify_admin_url?: string | null
          netlify_build_hook_url?: string | null
          netlify_site_id?: string | null
          netlify_site_name?: string | null
          netlify_site_url?: string | null
          status?: string
        }
        Relationships: []
      }
      site_tools: {
        Row: {
          created_at: string
          display_order: number
          enabled: boolean
          id: string
          settings_json: Json
          site_id: string
          tool_id: string
          updated_at: string
          version: string
        }
        Insert: {
          display_order?: number
          enabled?: boolean
          id?: string
          settings_json?: Json
          site_id: string
          tool_id: string
          version?: string
        }
        Update: {
          display_order?: number
          enabled?: boolean
          settings_json?: Json
          version?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_color: string | null
          brand_name: string | null
          created_at: string
          custom_css_vars_json: Json
          dark_mode_default: boolean
          favicon_url: string | null
          header_bg_color: string | null
          header_text_color: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          site_id: string
          site_name: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string
          custom_css_vars_json?: Json
          dark_mode_default?: boolean
          favicon_url?: string | null
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id: string
          site_name?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          brand_name?: string | null
          created_at?: string
          custom_css_vars_json?: Json
          dark_mode_default?: boolean
          favicon_url?: string | null
          header_bg_color?: string | null
          header_text_color?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          site_id?: string
          site_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          payment_id: string | null
          plan_type: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          payment_id?: string | null
          plan_type: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          payment_id?: string | null
          plan_type?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "domain_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      xml_bots: {
        Row: {
          created_at: string
          display_order: number
          file_name: string
          file_path: string
          id: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_name: string
          file_path: string
          id?: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          file_name?: string
          file_path?: string
          id?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xml_bots_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
