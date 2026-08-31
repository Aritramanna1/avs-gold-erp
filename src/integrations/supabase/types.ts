export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      item_masters: {
        Row: {
          allowed_wastage_pct: number;
          category: string;
          collection_name: string | null;
          created_at: string;
          default_making_rate_paise: number;
          default_touch_pct: number;
          design_code: string | null;
          fine_calculation_mode: string;
          firm_id: string | null;
          hsn_code: string;
          huid_applicable: boolean;
          id: string;
          is_active: boolean;
          item_code: string;
          item_group: string | null;
          item_group_id: string | null;
          item_name: string;
          labour_basis: string;
          metadata: Json;
          metal_type: string;
          min_making_charge_paise: number;
          purity_stamp: string;
          stock_method: string;
          tag_weight_deduction_mg: number;
          updated_at: string;
        };
        Insert: {
          allowed_wastage_pct?: number;
          category: string;
          collection_name?: string | null;
          created_at?: string;
          default_making_rate_paise?: number;
          default_touch_pct?: number;
          design_code?: string | null;
          fine_calculation_mode?: string;
          firm_id?: string | null;
          hsn_code?: string;
          huid_applicable?: boolean;
          id?: string;
          is_active?: boolean;
          item_code: string;
          item_group?: string | null;
          item_group_id?: string | null;
          item_name: string;
          labour_basis?: string;
          metadata?: Json;
          metal_type?: string;
          min_making_charge_paise?: number;
          purity_stamp?: string;
          stock_method?: string;
          tag_weight_deduction_mg?: number;
          updated_at?: string;
        };
        Update: {
          allowed_wastage_pct?: number;
          category?: string;
          collection_name?: string | null;
          created_at?: string;
          default_making_rate_paise?: number;
          default_touch_pct?: number;
          design_code?: string | null;
          fine_calculation_mode?: string;
          firm_id?: string | null;
          hsn_code?: string;
          huid_applicable?: boolean;
          id?: string;
          is_active?: boolean;
          item_code?: string;
          item_group?: string | null;
          item_group_id?: string | null;
          item_name?: string;
          labour_basis?: string;
          metadata?: Json;
          metal_type?: string;
          min_making_charge_paise?: number;
          purity_stamp?: string;
          stock_method?: string;
          tag_weight_deduction_mg?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      item_groups: {
        Row: {
          created_at: string;
          description: string | null;
          firm_id: string;
          group_code: string;
          group_name: string;
          id: string;
          is_active: boolean;
          metadata: Json;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          firm_id: string;
          group_code: string;
          group_name: string;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          firm_id?: string;
          group_code?: string;
          group_name?: string;
          id?: string;
          is_active?: boolean;
          metadata?: Json;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      migration_batches: {
        Row: {
          as_of_date: string;
          batch_number: string;
          checksum_sha256: string | null;
          created_at: string;
          dry_run_simulation: Json;
          firm_id: string | null;
          frozen_at: string | null;
          frozen_by: string | null;
          id: string;
          metadata: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          as_of_date: string;
          batch_number: string;
          checksum_sha256?: string | null;
          created_at?: string;
          dry_run_simulation?: Json;
          firm_id?: string | null;
          frozen_at?: string | null;
          frozen_by?: string | null;
          id: string;
          metadata?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          as_of_date?: string;
          batch_number?: string;
          checksum_sha256?: string | null;
          created_at?: string;
          dry_run_simulation?: Json;
          firm_id?: string | null;
          frozen_at?: string | null;
          frozen_by?: string | null;
          id?: string;
          metadata?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      party_bank_accounts: {
        Row: {
          account_holder_name: string;
          account_number: string;
          account_type: string;
          bank_name: string;
          branch_name: string | null;
          created_at: string;
          firm_id: string;
          id: string;
          ifsc_code: string;
          is_primary: boolean;
          is_verified: boolean;
          metadata: Json;
          party_id: string;
          updated_at: string;
          upi_id: string | null;
        };
        Insert: {
          account_holder_name: string;
          account_number: string;
          account_type?: string;
          bank_name: string;
          branch_name?: string | null;
          created_at?: string;
          firm_id: string;
          id?: string;
          ifsc_code: string;
          is_primary?: boolean;
          is_verified?: boolean;
          metadata?: Json;
          party_id: string;
          updated_at?: string;
          upi_id?: string | null;
        };
        Update: {
          account_holder_name?: string;
          account_number?: string;
          account_type?: string;
          bank_name?: string;
          branch_name?: string | null;
          created_at?: string;
          firm_id?: string;
          id?: string;
          ifsc_code?: string;
          is_primary?: boolean;
          is_verified?: boolean;
          metadata?: Json;
          party_id?: string;
          updated_at?: string;
          upi_id?: string | null;
        };
        Relationships: [];
      };
      party_opening_balances: {
        Row: {
          as_of_date: string;
          cash_credit_paise: number;
          cash_debit_paise: number;
          created_at: string;
          diamond_carats: number;
          diamond_pieces: number;
          fine_gold_credit_mg: number;
          fine_gold_debit_mg: number;
          firm_id: string;
          id: string;
          metadata: Json;
          migration_batch_id: string | null;
          notes: string | null;
          party_id: string;
          silver_credit_mg: number;
          silver_debit_mg: number;
          updated_at: string;
        };
        Insert: {
          as_of_date: string;
          cash_credit_paise?: number;
          cash_debit_paise?: number;
          created_at?: string;
          diamond_carats?: number;
          diamond_pieces?: number;
          fine_gold_credit_mg?: number;
          fine_gold_debit_mg?: number;
          firm_id: string;
          id?: string;
          metadata?: Json;
          migration_batch_id?: string | null;
          notes?: string | null;
          party_id: string;
          silver_credit_mg?: number;
          silver_debit_mg?: number;
          updated_at?: string;
        };
        Update: {
          as_of_date?: string;
          cash_credit_paise?: number;
          cash_debit_paise?: number;
          created_at?: string;
          diamond_carats?: number;
          diamond_pieces?: number;
          fine_gold_credit_mg?: number;
          fine_gold_debit_mg?: number;
          firm_id?: string;
          id?: string;
          metadata?: Json;
          migration_batch_id?: string | null;
          notes?: string | null;
          party_id?: string;
          silver_credit_mg?: number;
          silver_debit_mg?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      party_role_profiles: {
        Row: {
          allowed_wastage_pct: number;
          created_at: string;
          credit_days: number;
          credit_limit_paise: number;
          firm_id: string;
          id: string;
          is_active: boolean;
          making_charge_type: string;
          making_rate_paise: number;
          metal_limit_mg: number;
          party_id: string;
          role_type: string;
          settings: Json;
          stop_billing_date: string | null;
          updated_at: string;
        };
        Insert: {
          allowed_wastage_pct?: number;
          created_at?: string;
          credit_days?: number;
          credit_limit_paise?: number;
          firm_id: string;
          id?: string;
          is_active?: boolean;
          making_charge_type?: string;
          making_rate_paise?: number;
          metal_limit_mg?: number;
          party_id: string;
          role_type: string;
          settings?: Json;
          stop_billing_date?: string | null;
          updated_at?: string;
        };
        Update: {
          allowed_wastage_pct?: number;
          created_at?: string;
          credit_days?: number;
          credit_limit_paise?: number;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          making_charge_type?: string;
          making_rate_paise?: number;
          metal_limit_mg?: number;
          party_id?: string;
          role_type?: string;
          settings?: Json;
          stop_billing_date?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_book_history: {
        Row: {
          approved_by_user_id: string | null;
          branch_id: string | null;
          buy_rate_per_gram_paise: number;
          created_at: string;
          day_high_rate_paise: number | null;
          day_low_rate_paise: number | null;
          effective_from: string;
          entered_by_user_id: string | null;
          firm_id: string | null;
          id: string;
          metadata: Json;
          metal_type: string;
          purity_id: string | null;
          purity_label: string | null;
          reference_rate_paise: number | null;
          sell_rate_per_gram_paise: number;
          source_type: string;
          status: string;
          touch_pct: number;
        };
        Insert: {
          approved_by_user_id?: string | null;
          branch_id?: string | null;
          buy_rate_per_gram_paise?: number;
          created_at?: string;
          day_high_rate_paise?: number | null;
          day_low_rate_paise?: number | null;
          effective_from?: string;
          entered_by_user_id?: string | null;
          firm_id?: string | null;
          id?: string;
          metadata?: Json;
          metal_type?: string;
          purity_id?: string | null;
          purity_label?: string | null;
          reference_rate_paise?: number | null;
          sell_rate_per_gram_paise?: number;
          source_type?: string;
          status?: string;
          touch_pct?: number;
        };
        Update: {
          approved_by_user_id?: string | null;
          branch_id?: string | null;
          buy_rate_per_gram_paise?: number;
          created_at?: string;
          day_high_rate_paise?: number | null;
          day_low_rate_paise?: number | null;
          effective_from?: string;
          entered_by_user_id?: string | null;
          firm_id?: string | null;
          id?: string;
          metadata?: Json;
          metal_type?: string;
          purity_id?: string | null;
          purity_label?: string | null;
          reference_rate_paise?: number | null;
          sell_rate_per_gram_paise?: number;
          source_type?: string;
          status?: string;
          touch_pct?: number;
        };
        Relationships: [];
      };
      tenant_backups: {
        Row: {
          archive_version: string;
          backup_name: string;
          created_at: string;
          created_by_user_id: string | null;
          download_url: string | null;
          download_url_expires_at: string | null;
          encryption_algorithm: string;
          firm_id: string;
          id: string;
          included_modules: Json;
          metadata: Json;
          record_counts: Json;
          schema_version: string;
          sha256_checksum: string;
          size_bytes: number;
          status: string;
          storage_path: string | null;
        };
        Insert: {
          archive_version?: string;
          backup_name: string;
          created_at?: string;
          created_by_user_id?: string | null;
          download_url?: string | null;
          download_url_expires_at?: string | null;
          encryption_algorithm?: string;
          firm_id: string;
          id?: string;
          included_modules?: Json;
          metadata?: Json;
          record_counts?: Json;
          schema_version?: string;
          sha256_checksum: string;
          size_bytes?: number;
          status?: string;
          storage_path?: string | null;
        };
        Update: {
          archive_version?: string;
          backup_name?: string;
          created_at?: string;
          created_by_user_id?: string | null;
          download_url?: string | null;
          download_url_expires_at?: string | null;
          encryption_algorithm?: string;
          firm_id?: string;
          id?: string;
          included_modules?: Json;
          metadata?: Json;
          record_counts?: Json;
          schema_version?: string;
          sha256_checksum?: string;
          size_bytes?: number;
          status?: string;
          storage_path?: string | null;
        };
        Relationships: [];
      };
      tenant_restore_audit: {
        Row: {
          archive_checksum: string;
          backup_id: string | null;
          completed_at: string | null;
          current_phase: number;
          diff_summary: Json;
          dual_ledger_reconciliation: Json;
          error_message: string | null;
          firm_id: string;
          id: string;
          initiated_at: string;
          initiated_by_user_id: string | null;
          metadata: Json;
          phase_results: Json;
          pre_restore_snapshot_id: string | null;
          status: string;
        };
        Insert: {
          archive_checksum: string;
          backup_id?: string | null;
          completed_at?: string | null;
          current_phase?: number;
          diff_summary?: Json;
          dual_ledger_reconciliation?: Json;
          error_message?: string | null;
          firm_id: string;
          id?: string;
          initiated_at?: string;
          initiated_by_user_id?: string | null;
          metadata?: Json;
          phase_results?: Json;
          pre_restore_snapshot_id?: string | null;
          status?: string;
        };
        Update: {
          archive_checksum?: string;
          backup_id?: string | null;
          completed_at?: string | null;
          current_phase?: number;
          diff_summary?: Json;
          dual_ledger_reconciliation?: Json;
          error_message?: string | null;
          firm_id?: string;
          id?: string;
          initiated_at?: string;
          initiated_by_user_id?: string | null;
          metadata?: Json;
          phase_results?: Json;
          pre_restore_snapshot_id?: string | null;
          status?: string;
        };
        Relationships: [];
      };

      ai_provider_configs: {
        Row: {
          created_at: string;
          firm_id: string;
          id: string;
          is_enabled: boolean;
          max_monthly_tokens: number;
          model_name: string;
          provider: string;
          tokens_used_this_month: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          firm_id: string;
          id?: string;
          is_enabled?: boolean;
          max_monthly_tokens?: number;
          model_name: string;
          provider: string;
          tokens_used_this_month?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          firm_id?: string;
          id?: string;
          is_enabled?: boolean;
          max_monthly_tokens?: number;
          model_name?: string;
          provider?: string;
          tokens_used_this_month?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          scope: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          scope?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          scope?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      approval_requests: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_requests_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_action_audit: {
        Row: {
          action_key: string;
          action_type: string;
          actor_id: string | null;
          confirmed_at: string | null;
          conversation_id: string | null;
          created_at: string;
          error_message: string | null;
          executed_at: string | null;
          firm_id: string;
          id: string;
          message_id: string | null;
          request_payload: Json;
          requires_confirmation: boolean;
          result_payload: Json;
          status: string;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action_key: string;
          action_type?: string;
          actor_id?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          executed_at?: string | null;
          firm_id?: string;
          id?: string;
          message_id?: string | null;
          request_payload?: Json;
          requires_confirmation?: boolean;
          result_payload?: Json;
          status?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action_key?: string;
          action_type?: string;
          actor_id?: string | null;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          executed_at?: string | null;
          firm_id?: string;
          id?: string;
          message_id?: string | null;
          request_payload?: Json;
          requires_confirmation?: boolean;
          result_payload?: Json;
          status?: string;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_action_audit_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      assistant_conversations: {
        Row: {
          created_at: string;
          firm_id: string;
          id: string;
          is_pinned: boolean;
          model: string;
          provider: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          firm_id: string;
          id?: string;
          is_pinned?: boolean;
          model?: string;
          provider?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          firm_id?: string;
          id?: string;
          is_pinned?: boolean;
          model?: string;
          provider?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      assistant_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          erp_card: Json | null;
          firm_id: string;
          id: string;
          role: string;
          tokens_used: number;
          tool_calls: Json;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          erp_card?: Json | null;
          firm_id: string;
          id?: string;
          role?: string;
          tokens_used?: number;
          tool_calls?: Json;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          erp_card?: Json | null;
          firm_id?: string;
          id?: string;
          role?: string;
          tokens_used?: number;
          tool_calls?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "assistant_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "assistant_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          file_name: string | null;
          file_path: string | null;
          file_size: number | null;
          file_url: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          kind: string;
          linked_id: string;
          linked_table: string;
          mime_type: string | null;
          notes: string | null;
          original_file_name: string | null;
          related_module: string | null;
          related_record_id: string | null;
          related_table: string | null;
          size_bytes: number | null;
          storage_path: string | null;
          storage_provider: string | null;
          updated_at: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          file_url?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          kind: string;
          linked_id: string;
          linked_table: string;
          mime_type?: string | null;
          notes?: string | null;
          original_file_name?: string | null;
          related_module?: string | null;
          related_record_id?: string | null;
          related_table?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          storage_provider?: string | null;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          file_name?: string | null;
          file_path?: string | null;
          file_size?: number | null;
          file_url?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          kind?: string;
          linked_id?: string;
          linked_table?: string;
          mime_type?: string | null;
          notes?: string | null;
          original_file_name?: string | null;
          related_module?: string | null;
          related_record_id?: string | null;
          related_table?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          storage_provider?: string | null;
          updated_at?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          created_at: string;
          data: Json;
          date: string;
          firm_id: string | null;
          hours: number | null;
          id: string;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          date: string;
          firm_id?: string | null;
          hours?: number | null;
          id: string;
          status: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          date?: string;
          firm_id?: string | null;
          hours?: number | null;
          id?: string;
          status?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor_email: string | null;
          actor_id: string | null;
          after_json: string | null;
          before_json: string | null;
          created_at: string;
          device_id: string | null;
          entity_id: string | null;
          entity_type: string;
          hash: string;
          id: string;
          prev_hash: string;
          seq: number;
          signature: string;
          ts: string;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          actor_id?: string | null;
          after_json?: string | null;
          before_json?: string | null;
          created_at?: string;
          device_id?: string | null;
          entity_id?: string | null;
          entity_type: string;
          hash: string;
          id: string;
          prev_hash: string;
          seq?: number;
          signature: string;
          ts?: string;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          actor_id?: string | null;
          after_json?: string | null;
          before_json?: string | null;
          created_at?: string;
          device_id?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          hash?: string;
          id?: string;
          prev_hash?: string;
          seq?: number;
          signature?: string;
          ts?: string;
        };
        Relationships: [];
      };
      bis_hallmark_registry: {
        Row: {
          article_type: string;
          assay_centre_code: string | null;
          assay_centre_name: string | null;
          assaying_date: string | null;
          bis_registration_number: string | null;
          created_at: string;
          firm_id: string;
          hallmark_date: string | null;
          huid: string;
          id: string;
          linked_job_card_id: string | null;
          linked_stock_item_id: string | null;
          metadata: Json;
          purity_fineness: number | null;
          purity_karat: number;
          status: string;
          updated_at: string;
          weight_grams: number | null;
        };
        Insert: {
          article_type: string;
          assay_centre_code?: string | null;
          assay_centre_name?: string | null;
          assaying_date?: string | null;
          bis_registration_number?: string | null;
          created_at?: string;
          firm_id?: string;
          hallmark_date?: string | null;
          huid: string;
          id?: string;
          linked_job_card_id?: string | null;
          linked_stock_item_id?: string | null;
          metadata?: Json;
          purity_fineness?: number | null;
          purity_karat: number;
          status?: string;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Update: {
          article_type?: string;
          assay_centre_code?: string | null;
          assay_centre_name?: string | null;
          assaying_date?: string | null;
          bis_registration_number?: string | null;
          created_at?: string;
          firm_id?: string;
          hallmark_date?: string | null;
          huid?: string;
          id?: string;
          linked_job_card_id?: string | null;
          linked_stock_item_id?: string | null;
          metadata?: Json;
          purity_fineness?: number | null;
          purity_karat?: number;
          status?: string;
          updated_at?: string;
          weight_grams?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bis_hallmark_registry_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      branch_settings: {
        Row: {
          address: string | null;
          barcode_series: string | null;
          branch_id: string;
          data: Json;
          default_karat: string | null;
          email: string | null;
          firm_id: string | null;
          gold_rate_source: string | null;
          gstin: string | null;
          invoice_series: string | null;
          invoice_template_id: string | null;
          logo_storage_path: string | null;
          logo_url: string | null;
          phone: string | null;
          receipt_series: string | null;
          receipt_template_id: string | null;
          smtp_from_email: string | null;
          smtp_from_name: string | null;
          smtp_host: string | null;
          smtp_password: string | null;
          smtp_port: string | null;
          smtp_user: string | null;
          thermal_printer_ip: string | null;
          thermal_printer_port: string | null;
          updated_at: string;
          wa_phone_number: string | null;
        };
        Insert: {
          address?: string | null;
          barcode_series?: string | null;
          branch_id: string;
          data?: Json;
          default_karat?: string | null;
          email?: string | null;
          firm_id?: string | null;
          gold_rate_source?: string | null;
          gstin?: string | null;
          invoice_series?: string | null;
          invoice_template_id?: string | null;
          logo_storage_path?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          receipt_series?: string | null;
          receipt_template_id?: string | null;
          smtp_from_email?: string | null;
          smtp_from_name?: string | null;
          smtp_host?: string | null;
          smtp_password?: string | null;
          smtp_port?: string | null;
          smtp_user?: string | null;
          thermal_printer_ip?: string | null;
          thermal_printer_port?: string | null;
          updated_at?: string;
          wa_phone_number?: string | null;
        };
        Update: {
          address?: string | null;
          barcode_series?: string | null;
          branch_id?: string;
          data?: Json;
          default_karat?: string | null;
          email?: string | null;
          firm_id?: string | null;
          gold_rate_source?: string | null;
          gstin?: string | null;
          invoice_series?: string | null;
          invoice_template_id?: string | null;
          logo_storage_path?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          receipt_series?: string | null;
          receipt_template_id?: string | null;
          smtp_from_email?: string | null;
          smtp_from_name?: string | null;
          smtp_host?: string | null;
          smtp_password?: string | null;
          smtp_port?: string | null;
          smtp_user?: string | null;
          thermal_printer_ip?: string | null;
          thermal_printer_port?: string | null;
          updated_at?: string;
          wa_phone_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branch_settings_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean;
          address: string | null;
          barcode_prefix: string | null;
          branch_type: string | null;
          city: string | null;
          created_at: string;
          data: Json;
          email: string | null;
          firm_id: string | null;
          gstin: string | null;
          id: string;
          invoice_prefix: string | null;
          logo_url: string | null;
          name: string | null;
          phone: string | null;
          settings: Json;
          short_name: string | null;
          state: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string | null;
          barcode_prefix?: string | null;
          branch_type?: string | null;
          city?: string | null;
          created_at?: string;
          data?: Json;
          email?: string | null;
          firm_id?: string | null;
          gstin?: string | null;
          id: string;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          name?: string | null;
          phone?: string | null;
          settings?: Json;
          short_name?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string | null;
          barcode_prefix?: string | null;
          branch_type?: string | null;
          city?: string | null;
          created_at?: string;
          data?: Json;
          email?: string | null;
          firm_id?: string | null;
          gstin?: string | null;
          id?: string;
          invoice_prefix?: string | null;
          logo_url?: string | null;
          name?: string | null;
          phone?: string | null;
          settings?: Json;
          short_name?: string | null;
          state?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "branches_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_designs: {
        Row: {
          category: string | null;
          created_at: string;
          data: Json;
          design_no: string | null;
          firm_id: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          data?: Json;
          design_no?: string | null;
          firm_id?: string | null;
          id: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          data?: Json;
          design_no?: string | null;
          firm_id?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      central_activity_events: {
        Row: {
          actor_id: string | null;
          branch_id: string | null;
          created_at: string;
          description: string | null;
          entity_id: string;
          entity_type: string;
          event_type: string;
          firm_id: string;
          id: string;
          metadata: Json;
          occurred_at: string;
          related_document_id: string | null;
          related_party_id: string | null;
          related_transaction_id: string | null;
          severity: string;
          title: string;
        };
        Insert: {
          actor_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          description?: string | null;
          entity_id: string;
          entity_type: string;
          event_type: string;
          firm_id?: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          related_document_id?: string | null;
          related_party_id?: string | null;
          related_transaction_id?: string | null;
          severity?: string;
          title: string;
        };
        Update: {
          actor_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          description?: string | null;
          entity_id?: string;
          entity_type?: string;
          event_type?: string;
          firm_id?: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          related_document_id?: string | null;
          related_party_id?: string | null;
          related_transaction_id?: string | null;
          severity?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_activity_events_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_activity_events_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_activity_events_related_party_id_fkey";
            columns: ["related_party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      central_message_attachments: {
        Row: {
          checksum_sha256: string | null;
          created_at: string;
          file_name: string;
          firm_id: string;
          id: string;
          message_id: string;
          metadata: Json;
          mime_type: string | null;
          size_bytes: number | null;
          storage_bucket: string;
          storage_path: string;
        };
        Insert: {
          checksum_sha256?: string | null;
          created_at?: string;
          file_name: string;
          firm_id?: string;
          id?: string;
          message_id: string;
          metadata?: Json;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_bucket: string;
          storage_path: string;
        };
        Update: {
          checksum_sha256?: string | null;
          created_at?: string;
          file_name?: string;
          firm_id?: string;
          id?: string;
          message_id?: string;
          metadata?: Json;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_bucket?: string;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_message_attachments_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "central_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      central_message_read_receipts: {
        Row: {
          firm_id: string;
          id: string;
          message_id: string;
          metadata: Json;
          read_at: string;
          reader_party_id: string | null;
          reader_user_id: string | null;
        };
        Insert: {
          firm_id?: string;
          id?: string;
          message_id: string;
          metadata?: Json;
          read_at?: string;
          reader_party_id?: string | null;
          reader_user_id?: string | null;
        };
        Update: {
          firm_id?: string;
          id?: string;
          message_id?: string;
          metadata?: Json;
          read_at?: string;
          reader_party_id?: string | null;
          reader_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "central_message_read_receipts_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_message_read_receipts_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "central_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_message_read_receipts_reader_party_id_fkey";
            columns: ["reader_party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      central_message_threads: {
        Row: {
          assigned_to: string | null;
          branch_id: string | null;
          channel: string;
          created_at: string;
          created_by: string | null;
          firm_id: string;
          id: string;
          last_message_at: string | null;
          last_read_at: string | null;
          linked_entity_id: string | null;
          linked_entity_type: string | null;
          metadata: Json;
          party_id: string | null;
          priority: string;
          status: string;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          branch_id?: string | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          firm_id?: string;
          id?: string;
          last_message_at?: string | null;
          last_read_at?: string | null;
          linked_entity_id?: string | null;
          linked_entity_type?: string | null;
          metadata?: Json;
          party_id?: string | null;
          priority?: string;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          branch_id?: string | null;
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          firm_id?: string;
          id?: string;
          last_message_at?: string | null;
          last_read_at?: string | null;
          linked_entity_id?: string | null;
          linked_entity_type?: string | null;
          metadata?: Json;
          party_id?: string | null;
          priority?: string;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_message_threads_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_message_threads_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_message_threads_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      central_messages: {
        Row: {
          body: string | null;
          created_at: string;
          delivered_at: string | null;
          direction: string;
          firm_id: string;
          id: string;
          imported_from: string | null;
          message_type: string;
          metadata: Json;
          provider: string | null;
          provider_message_id: string | null;
          read_at: string | null;
          sender_party_id: string | null;
          sender_user_id: string | null;
          sent_at: string | null;
          thread_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          direction?: string;
          firm_id?: string;
          id?: string;
          imported_from?: string | null;
          message_type?: string;
          metadata?: Json;
          provider?: string | null;
          provider_message_id?: string | null;
          read_at?: string | null;
          sender_party_id?: string | null;
          sender_user_id?: string | null;
          sent_at?: string | null;
          thread_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          direction?: string;
          firm_id?: string;
          id?: string;
          imported_from?: string | null;
          message_type?: string;
          metadata?: Json;
          provider?: string | null;
          provider_message_id?: string | null;
          read_at?: string | null;
          sender_party_id?: string | null;
          sender_user_id?: string | null;
          sent_at?: string | null;
          thread_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_messages_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_messages_sender_party_id_fkey";
            columns: ["sender_party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "central_message_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      central_parties: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string | null;
          default_branch_id: string | null;
          display_name: string;
          firm_id: string;
          gstin: string | null;
          id: string;
          legal_name: string | null;
          metadata: Json;
          opening_cash_balance_paise: number;
          opening_fine_gold_mg: number;
          pan: string | null;
          party_code: string | null;
          party_kind: string;
          primary_email: string | null;
          primary_phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_branch_id?: string | null;
          display_name: string;
          firm_id?: string;
          gstin?: string | null;
          id?: string;
          legal_name?: string | null;
          metadata?: Json;
          opening_cash_balance_paise?: number;
          opening_fine_gold_mg?: number;
          pan?: string | null;
          party_code?: string | null;
          party_kind?: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_branch_id?: string | null;
          display_name?: string;
          firm_id?: string;
          gstin?: string | null;
          id?: string;
          legal_name?: string | null;
          metadata?: Json;
          opening_cash_balance_paise?: number;
          opening_fine_gold_mg?: number;
          pan?: string | null;
          party_code?: string | null;
          party_kind?: string;
          primary_email?: string | null;
          primary_phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_parties_default_branch_id_fkey";
            columns: ["default_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_parties_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      central_party_contacts: {
        Row: {
          contact_type: string;
          created_at: string;
          firm_id: string;
          id: string;
          is_primary: boolean;
          label: string | null;
          metadata: Json;
          party_id: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          contact_type?: string;
          created_at?: string;
          firm_id?: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          metadata?: Json;
          party_id: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          contact_type?: string;
          created_at?: string;
          firm_id?: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          metadata?: Json;
          party_id?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_party_contacts_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_party_contacts_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      central_party_roles: {
        Row: {
          created_at: string;
          firm_id: string;
          party_id: string;
          role: string;
          role_data: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          firm_id?: string;
          party_id: string;
          role: string;
          role_data?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          firm_id?: string;
          party_id?: string;
          role?: string;
          role_data?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "central_party_roles_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "central_party_roles_party_id_fkey";
            columns: ["party_id"];
            isOneToOne: false;
            referencedRelation: "central_parties";
            referencedColumns: ["id"];
          },
        ];
      };
      chatwoot_conversation_links: {
        Row: {
          chatwoot_conversation_id: number;
          chatwoot_inbox_id: number | null;
          created_at: string;
          firm_id: string;
          id: string;
          last_webhook_at: string | null;
          metadata: Json;
          sync_status: string;
          ticket_id: string | null;
          updated_at: string;
        };
        Insert: {
          chatwoot_conversation_id: number;
          chatwoot_inbox_id?: number | null;
          created_at?: string;
          firm_id: string;
          id?: string;
          last_webhook_at?: string | null;
          metadata?: Json;
          sync_status?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Update: {
          chatwoot_conversation_id?: number;
          chatwoot_inbox_id?: number | null;
          created_at?: string;
          firm_id?: string;
          id?: string;
          last_webhook_at?: string | null;
          metadata?: Json;
          sync_status?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chatwoot_conversation_links_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chatwoot_conversation_links_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: true;
            referencedRelation: "platform_support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      chatwoot_firm_mappings: {
        Row: {
          chatwoot_account_id: number | null;
          chatwoot_contact_id: number | null;
          created_at: string;
          firm_id: string;
          id: string;
          last_synced_at: string | null;
          metadata: Json;
          sync_status: string;
          updated_at: string;
        };
        Insert: {
          chatwoot_account_id?: number | null;
          chatwoot_contact_id?: number | null;
          created_at?: string;
          firm_id: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          sync_status?: string;
          updated_at?: string;
        };
        Update: {
          chatwoot_account_id?: number | null;
          chatwoot_contact_id?: number | null;
          created_at?: string;
          firm_id?: string;
          id?: string;
          last_synced_at?: string | null;
          metadata?: Json;
          sync_status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chatwoot_firm_mappings_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      comm_provider_secrets: {
        Row: {
          branch_id: string;
          created_at: string;
          id: string;
          provider_type: string;
          secret_data: Json;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          id?: string;
          provider_type: string;
          secret_data?: Json;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          id?: string;
          provider_type?: string;
          secret_data?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comm_provider_secrets_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      comm_provider_settings: {
        Row: {
          branch_id: string | null;
          channel: string | null;
          created_at: string;
          data: Json;
          id: string;
          is_active: boolean;
          priority: number;
          provider_type: string | null;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          channel?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          is_active?: boolean;
          priority?: number;
          provider_type?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          channel?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          is_active?: boolean;
          priority?: number;
          provider_type?: string | null;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comm_provider_settings_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      communication_logs: {
        Row: {
          body: string | null;
          channel: string | null;
          created_at: string;
          data: Json;
          direction: string | null;
          id: string;
          linked_id: string | null;
          linked_table: string | null;
          phone: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          channel?: string | null;
          created_at?: string;
          data?: Json;
          direction?: string | null;
          id: string;
          linked_id?: string | null;
          linked_table?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          channel?: string | null;
          created_at?: string;
          data?: Json;
          direction?: string | null;
          id?: string;
          linked_id?: string | null;
          linked_table?: string | null;
          phone?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      compliance_exceptions: {
        Row: {
          auto_detected: boolean;
          created_at: string;
          description: string;
          entity_id: string;
          entity_type: string;
          exception_type: string;
          firm_id: string;
          id: string;
          resolution_notes: string | null;
          resolution_status: string;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          updated_at: string;
        };
        Insert: {
          auto_detected?: boolean;
          created_at?: string;
          description: string;
          entity_id: string;
          entity_type: string;
          exception_type: string;
          firm_id?: string;
          id?: string;
          resolution_notes?: string | null;
          resolution_status?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          updated_at?: string;
        };
        Update: {
          auto_detected?: boolean;
          created_at?: string;
          description?: string;
          entity_id?: string;
          entity_type?: string;
          exception_type?: string;
          firm_id?: string;
          id?: string;
          resolution_notes?: string | null;
          resolution_status?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_exceptions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_rule_versions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          effective_from: string;
          effective_to: string | null;
          firm_id: string;
          id: string;
          notes: string | null;
          parameters: Json;
          rule_id: string;
          status: string;
          version_number: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          effective_from: string;
          effective_to?: string | null;
          firm_id?: string;
          id?: string;
          notes?: string | null;
          parameters?: Json;
          rule_id: string;
          status?: string;
          version_number?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          effective_from?: string;
          effective_to?: string | null;
          firm_id?: string;
          id?: string;
          notes?: string | null;
          parameters?: Json;
          rule_id?: string;
          status?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_rule_versions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "compliance_rule_versions_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "compliance_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      compliance_rules: {
        Row: {
          authority: string;
          category: string;
          created_at: string;
          description: string | null;
          firm_id: string;
          id: string;
          is_active: boolean;
          is_system: boolean;
          rule_code: string;
          rule_data: Json;
          rule_name: string;
          threshold_unit: string | null;
          threshold_value: number | null;
          updated_at: string;
        };
        Insert: {
          authority?: string;
          category?: string;
          created_at?: string;
          description?: string | null;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          rule_code: string;
          rule_data?: Json;
          rule_name: string;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          updated_at?: string;
        };
        Update: {
          authority?: string;
          category?: string;
          created_at?: string;
          description?: string | null;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          rule_code?: string;
          rule_data?: Json;
          rule_name?: string;
          threshold_unit?: string | null;
          threshold_value?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "compliance_rules_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          firm_id: string | null;
          id: string;
          invoice_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id: string;
          invoice_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          invoice_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_interactions: {
        Row: {
          body: string | null;
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          opportunity_id: string | null;
          person_id: string | null;
          staff_email: string | null;
          title: string | null;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          staff_email?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          staff_email?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_interactions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_leads_opportunities: {
        Row: {
          assigned_staff_email: string | null;
          branch_id: string | null;
          buyer_type: string;
          created_at: string;
          data: Json;
          estimated_value_paise: number;
          firm_id: string | null;
          follow_up_date: string | null;
          id: string;
          last_contacted_at: string | null;
          lead_name: string | null;
          person_id: string | null;
          priority: string | null;
          remarks: string | null;
          source: string;
          stage: string | null;
          target_gold_mg: number;
          updated_at: string;
        };
        Insert: {
          assigned_staff_email?: string | null;
          branch_id?: string | null;
          buyer_type?: string;
          created_at?: string;
          data?: Json;
          estimated_value_paise?: number;
          firm_id?: string | null;
          follow_up_date?: string | null;
          id: string;
          last_contacted_at?: string | null;
          lead_name?: string | null;
          person_id?: string | null;
          priority?: string | null;
          remarks?: string | null;
          source?: string;
          stage?: string | null;
          target_gold_mg?: number;
          updated_at?: string;
        };
        Update: {
          assigned_staff_email?: string | null;
          branch_id?: string | null;
          buyer_type?: string;
          created_at?: string;
          data?: Json;
          estimated_value_paise?: number;
          firm_id?: string | null;
          follow_up_date?: string | null;
          id?: string;
          last_contacted_at?: string | null;
          lead_name?: string | null;
          person_id?: string | null;
          priority?: string | null;
          remarks?: string | null;
          source?: string;
          stage?: string | null;
          target_gold_mg?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_leads_opportunities_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_tasks_meetings: {
        Row: {
          assigned_staff_email: string | null;
          branch_id: string | null;
          created_at: string;
          data: Json;
          description: string | null;
          due_date: string | null;
          firm_id: string | null;
          id: string;
          opportunity_id: string | null;
          person_id: string | null;
          priority: string | null;
          status: string | null;
          title: string | null;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_staff_email?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          description?: string | null;
          due_date?: string | null;
          firm_id?: string | null;
          id: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          priority?: string | null;
          status?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_staff_email?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          description?: string | null;
          due_date?: string | null;
          firm_id?: string | null;
          id?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          priority?: string | null;
          status?: string | null;
          title?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crm_tasks_meetings_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_field_definitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          default_value: string | null;
          display_order: number;
          entity_type: string;
          field_code: string;
          field_label: string;
          field_type: string;
          firm_id: string;
          help_text: string | null;
          id: string;
          is_active: boolean;
          is_required: boolean;
          is_searchable: boolean;
          options: Json | null;
          section_label: string | null;
          updated_at: string;
          validation_rules: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          default_value?: string | null;
          display_order?: number;
          entity_type: string;
          field_code: string;
          field_label: string;
          field_type?: string;
          firm_id?: string;
          help_text?: string | null;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          is_searchable?: boolean;
          options?: Json | null;
          section_label?: string | null;
          updated_at?: string;
          validation_rules?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          default_value?: string | null;
          display_order?: number;
          entity_type?: string;
          field_code?: string;
          field_label?: string;
          field_type?: string;
          firm_id?: string;
          help_text?: string | null;
          id?: string;
          is_active?: boolean;
          is_required?: boolean;
          is_searchable?: boolean;
          options?: Json | null;
          section_label?: string | null;
          updated_at?: string;
          validation_rules?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_field_values: {
        Row: {
          created_at: string;
          entity_id: string;
          entity_type: string;
          field_definition_id: string;
          field_value: string | null;
          field_value_json: Json | null;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          entity_id: string;
          entity_type: string;
          field_definition_id: string;
          field_value?: string | null;
          field_value_json?: Json | null;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          field_definition_id?: string;
          field_value?: string | null;
          field_value_json?: Json | null;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "custom_field_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_field_values_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_gold_deposits: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_gold_deposits_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_gold_deposits_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_ledger: {
        Row: {
          created_at: string;
          credit_paise: number;
          customer_id: string | null;
          data: Json;
          debit_paise: number;
          description: string | null;
          firm_id: string | null;
          id: string;
          kind: string;
          ref: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          credit_paise?: number;
          customer_id?: string | null;
          data?: Json;
          debit_paise?: number;
          description?: string | null;
          firm_id?: string | null;
          id: string;
          kind: string;
          ref?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          credit_paise?: number;
          customer_id?: string | null;
          data?: Json;
          debit_paise?: number;
          description?: string | null;
          firm_id?: string | null;
          id?: string;
          kind?: string;
          ref?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_ledger_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_settlements: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customer_settlements_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_close: {
        Row: {
          created_at: string;
          data: Json;
          date: string;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          date: string;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          date?: string;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      debit_notes: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          firm_id: string | null;
          id: string;
          invoice_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id: string;
          invoice_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          invoice_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "debit_notes_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_challans: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          firm_id: string | null;
          id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_challans_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      device_registry: {
        Row: {
          device_id: string;
          firm_id: string;
          first_seen_at: string;
          label: string;
          last_seen_at: string;
          platform: string | null;
          trusted: boolean;
        };
        Insert: {
          device_id: string;
          firm_id?: string;
          first_seen_at?: string;
          label: string;
          last_seen_at?: string;
          platform?: string | null;
          trusted?: boolean;
        };
        Update: {
          device_id?: string;
          firm_id?: string;
          first_seen_at?: string;
          label?: string;
          last_seen_at?: string;
          platform?: string | null;
          trusted?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "device_registry_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_sequences: {
        Row: {
          last_value: number;
          prefix: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          last_value?: number;
          prefix: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          last_value?: number;
          prefix?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_shares: {
        Row: {
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          document_id: string;
          document_snapshot: Json;
          document_type: string;
          expires_at: string;
          firm_snapshot: Json;
          id: string;
          last_accessed_at: string | null;
          max_views: number | null;
          revoked_at: string | null;
          token_hash: string;
          view_count: number;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id: string;
          document_snapshot?: Json;
          document_type: string;
          expires_at?: string;
          firm_snapshot?: Json;
          id?: string;
          last_accessed_at?: string | null;
          max_views?: number | null;
          revoked_at?: string | null;
          token_hash: string;
          view_count?: number;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          document_id?: string;
          document_snapshot?: Json;
          document_type?: string;
          expires_at?: string;
          firm_snapshot?: Json;
          id?: string;
          last_accessed_at?: string | null;
          max_views?: number | null;
          revoked_at?: string | null;
          token_hash?: string;
          view_count?: number;
        };
        Relationships: [];
      };
      dropdown_masters: {
        Row: {
          active: boolean;
          created_at: string;
          data: Json;
          id: string;
          master_key: string | null;
          sort_order: number | null;
          updated_at: string;
          value: string | null;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          data?: Json;
          id: string;
          master_key?: string | null;
          sort_order?: number | null;
          updated_at?: string;
          value?: string | null;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          data?: Json;
          id?: string;
          master_key?: string | null;
          sort_order?: number | null;
          updated_at?: string;
          value?: string | null;
        };
        Relationships: [];
      };
      einvoice_records: {
        Row: {
          ack_date: string | null;
          ack_number: string | null;
          api_response: Json | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          created_at: string;
          error_details: Json | null;
          firm_id: string;
          id: string;
          invoice_id: string;
          irn: string | null;
          signed_invoice_data: Json | null;
          signed_qr_code: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          ack_date?: string | null;
          ack_number?: string | null;
          api_response?: Json | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          error_details?: Json | null;
          firm_id?: string;
          id?: string;
          invoice_id: string;
          irn?: string | null;
          signed_invoice_data?: Json | null;
          signed_qr_code?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          ack_date?: string | null;
          ack_number?: string | null;
          api_response?: Json | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          error_details?: Json | null;
          firm_id?: string;
          id?: string;
          invoice_id?: string;
          irn?: string | null;
          signed_invoice_data?: Json | null;
          signed_qr_code?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "einvoice_records_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      erp_schema_meta: {
        Row: {
          applied_at: string;
          deployment_model: string;
          id: string;
          metadata: Json;
          product: string;
          schema_version: number;
        };
        Insert: {
          applied_at?: string;
          deployment_model: string;
          id: string;
          metadata?: Json;
          product: string;
          schema_version: number;
        };
        Update: {
          applied_at?: string;
          deployment_model?: string;
          id?: string;
          metadata?: Json;
          product?: string;
          schema_version?: number;
        };
        Relationships: [];
      };
      erp_setup_guard: {
        Row: {
          created_at: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      escalation_state: {
        Row: {
          entity_id: string;
          entity_type: string;
          firm_id: string;
          first_flagged_at: string;
          last_sent_at: string | null;
          last_tier_index: number;
          updated_at: string;
        };
        Insert: {
          entity_id: string;
          entity_type: string;
          firm_id?: string;
          first_flagged_at: string;
          last_sent_at?: string | null;
          last_tier_index?: number;
          updated_at?: string;
        };
        Update: {
          entity_id?: string;
          entity_type?: string;
          firm_id?: string;
          first_flagged_at?: string;
          last_sent_at?: string | null;
          last_tier_index?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "escalation_state_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          firm_id: string | null;
          id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      eway_bill_records: {
        Row: {
          api_response: Json | null;
          created_at: string;
          distance_km: number | null;
          eway_bill_number: string | null;
          firm_id: string;
          from_place: string | null;
          from_state_code: string | null;
          generated_at: string | null;
          id: string;
          linked_document_id: string;
          linked_document_type: string;
          metadata: Json;
          status: string;
          to_place: string | null;
          to_state_code: string | null;
          total_value_paise: number;
          total_weight_grams: number | null;
          transport_mode: string | null;
          transporter_id: string | null;
          transporter_name: string | null;
          updated_at: string;
          valid_from: string | null;
          valid_until: string | null;
          vehicle_number: string | null;
        };
        Insert: {
          api_response?: Json | null;
          created_at?: string;
          distance_km?: number | null;
          eway_bill_number?: string | null;
          firm_id?: string;
          from_place?: string | null;
          from_state_code?: string | null;
          generated_at?: string | null;
          id?: string;
          linked_document_id: string;
          linked_document_type: string;
          metadata?: Json;
          status?: string;
          to_place?: string | null;
          to_state_code?: string | null;
          total_value_paise?: number;
          total_weight_grams?: number | null;
          transport_mode?: string | null;
          transporter_id?: string | null;
          transporter_name?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_number?: string | null;
        };
        Update: {
          api_response?: Json | null;
          created_at?: string;
          distance_km?: number | null;
          eway_bill_number?: string | null;
          firm_id?: string;
          from_place?: string | null;
          from_state_code?: string | null;
          generated_at?: string | null;
          id?: string;
          linked_document_id?: string;
          linked_document_type?: string;
          metadata?: Json;
          status?: string;
          to_place?: string | null;
          to_state_code?: string | null;
          total_value_paise?: number;
          total_weight_grams?: number | null;
          transport_mode?: string | null;
          transporter_id?: string | null;
          transporter_name?: string | null;
          updated_at?: string;
          valid_from?: string | null;
          valid_until?: string | null;
          vehicle_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eway_bill_records_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_lock_periods: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          period: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          period?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          period?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_lock_periods_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      formula_definitions: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          expression: string;
          firm_id: string;
          formula_code: string;
          formula_name: string;
          id: string;
          input_variables: Json;
          is_active: boolean;
          is_system: boolean;
          output_unit: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expression: string;
          firm_id?: string;
          formula_code: string;
          formula_name: string;
          id?: string;
          input_variables?: Json;
          is_active?: boolean;
          is_system?: boolean;
          output_unit?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          expression?: string;
          firm_id?: string;
          formula_code?: string;
          formula_name?: string;
          id?: string;
          input_variables?: Json;
          is_active?: boolean;
          is_system?: boolean;
          output_unit?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "formula_definitions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      formula_rule_sets: {
        Row: {
          applies_to: string;
          applies_to_id: string | null;
          conditions: Json;
          created_at: string;
          created_by: string | null;
          description: string | null;
          effective_from: string;
          effective_to: string | null;
          firm_id: string;
          formula_id: string | null;
          id: string;
          is_active: boolean;
          priority: number;
          rule_set_name: string;
          updated_at: string;
        };
        Insert: {
          applies_to?: string;
          applies_to_id?: string | null;
          conditions?: Json;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          firm_id?: string;
          formula_id?: string | null;
          id?: string;
          is_active?: boolean;
          priority?: number;
          rule_set_name: string;
          updated_at?: string;
        };
        Update: {
          applies_to?: string;
          applies_to_id?: string | null;
          conditions?: Json;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          firm_id?: string;
          formula_id?: string | null;
          id?: string;
          is_active?: boolean;
          priority?: number;
          rule_set_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "formula_rule_sets_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "formula_rule_sets_formula_id_fkey";
            columns: ["formula_id"];
            isOneToOne: false;
            referencedRelation: "formula_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      gold_ledger: {
        Row: {
          bucket_deltas: Json;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          movement: string;
          net_fine_mg: number;
          note: string | null;
          reference: string | null;
          responsible_person_id: string | null;
          responsible_person_name: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          bucket_deltas?: Json;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          movement: string;
          net_fine_mg: number;
          note?: string | null;
          reference?: string | null;
          responsible_person_id?: string | null;
          responsible_person_name?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Update: {
          bucket_deltas?: Json;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          movement?: string;
          net_fine_mg?: number;
          note?: string | null;
          reference?: string | null;
          responsible_person_id?: string | null;
          responsible_person_name?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gold_reconciliation_reports: {
        Row: {
          branch_id: string | null;
          exception_count: number;
          firm_id: string;
          generated_at: string;
          id: string;
          report_json: Json;
          total_checked: number;
        };
        Insert: {
          branch_id?: string | null;
          exception_count?: number;
          firm_id?: string;
          generated_at?: string;
          id: string;
          report_json: Json;
          total_checked?: number;
        };
        Update: {
          branch_id?: string | null;
          exception_count?: number;
          firm_id?: string;
          generated_at?: string;
          id?: string;
          report_json?: Json;
          total_checked?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gold_reconciliation_reports_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      gold_settlements: {
        Row: {
          amount_paise: number;
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          gross_mg: number;
          id: string;
          net_mg: number;
          notes: string | null;
          party_id: string;
          party_type: string;
          payment_mode: string | null;
          purity: number;
          rate_per_gram_paise: number;
          settlement_date: string;
          settlement_type: string;
          updated_at: string;
          wastage_mg: number;
        };
        Insert: {
          amount_paise?: number;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gross_mg?: number;
          id: string;
          net_mg?: number;
          notes?: string | null;
          party_id: string;
          party_type: string;
          payment_mode?: string | null;
          purity?: number;
          rate_per_gram_paise?: number;
          settlement_date?: string;
          settlement_type: string;
          updated_at?: string;
          wastage_mg?: number;
        };
        Update: {
          amount_paise?: number;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gross_mg?: number;
          id?: string;
          net_mg?: number;
          notes?: string | null;
          party_id?: string;
          party_type?: string;
          payment_mode?: string | null;
          purity?: number;
          rate_per_gram_paise?: number;
          settlement_date?: string;
          settlement_type?: string;
          updated_at?: string;
          wastage_mg?: number;
        };
        Relationships: [];
      };
      gst_invoice_snapshots: {
        Row: {
          cess_amount_paise: number;
          cess_rate: number;
          cgst_amount_paise: number;
          cgst_rate: number;
          created_at: string;
          firm_id: string;
          hsn_code: string | null;
          id: string;
          igst_amount_paise: number;
          igst_rate: number;
          invoice_id: string;
          line_items: Json;
          metadata: Json;
          party_gstin: string | null;
          party_state_code: string | null;
          place_of_supply: string;
          reverse_charge: boolean;
          round_off_paise: number;
          rule_version_id: string | null;
          sgst_amount_paise: number;
          sgst_rate: number;
          snapshot_date: string;
          supply_type: string;
          taxable_value_paise: number;
          total_invoice_paise: number;
        };
        Insert: {
          cess_amount_paise?: number;
          cess_rate?: number;
          cgst_amount_paise?: number;
          cgst_rate?: number;
          created_at?: string;
          firm_id?: string;
          hsn_code?: string | null;
          id?: string;
          igst_amount_paise?: number;
          igst_rate?: number;
          invoice_id: string;
          line_items?: Json;
          metadata?: Json;
          party_gstin?: string | null;
          party_state_code?: string | null;
          place_of_supply: string;
          reverse_charge?: boolean;
          round_off_paise?: number;
          rule_version_id?: string | null;
          sgst_amount_paise?: number;
          sgst_rate?: number;
          snapshot_date?: string;
          supply_type?: string;
          taxable_value_paise?: number;
          total_invoice_paise?: number;
        };
        Update: {
          cess_amount_paise?: number;
          cess_rate?: number;
          cgst_amount_paise?: number;
          cgst_rate?: number;
          created_at?: string;
          firm_id?: string;
          hsn_code?: string | null;
          id?: string;
          igst_amount_paise?: number;
          igst_rate?: number;
          invoice_id?: string;
          line_items?: Json;
          metadata?: Json;
          party_gstin?: string | null;
          party_state_code?: string | null;
          place_of_supply?: string;
          reverse_charge?: boolean;
          round_off_paise?: number;
          rule_version_id?: string | null;
          sgst_amount_paise?: number;
          sgst_rate?: number;
          snapshot_date?: string;
          supply_type?: string;
          taxable_value_paise?: number;
          total_invoice_paise?: number;
        };
        Relationships: [
          {
            foreignKeyName: "gst_invoice_snapshots_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gst_invoice_snapshots_rule_version_id_fkey";
            columns: ["rule_version_id"];
            isOneToOne: false;
            referencedRelation: "compliance_rule_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      gst_party_profiles: {
        Row: {
          billing_address: Json;
          created_at: string;
          firm_id: string;
          gstin: string | null;
          id: string;
          metadata: Json;
          pan: string | null;
          party_id: string;
          place_of_supply: string | null;
          registration_type: string;
          reverse_charge_applicable: boolean;
          shipping_address: Json;
          state_code: string | null;
          tcs_applicable: boolean;
          tds_applicable: boolean;
          updated_at: string;
        };
        Insert: {
          billing_address?: Json;
          created_at?: string;
          firm_id?: string;
          gstin?: string | null;
          id?: string;
          metadata?: Json;
          pan?: string | null;
          party_id: string;
          place_of_supply?: string | null;
          registration_type?: string;
          reverse_charge_applicable?: boolean;
          shipping_address?: Json;
          state_code?: string | null;
          tcs_applicable?: boolean;
          tds_applicable?: boolean;
          updated_at?: string;
        };
        Update: {
          billing_address?: Json;
          created_at?: string;
          firm_id?: string;
          gstin?: string | null;
          id?: string;
          metadata?: Json;
          pan?: string | null;
          party_id?: string;
          place_of_supply?: string | null;
          registration_type?: string;
          reverse_charge_applicable?: boolean;
          shipping_address?: Json;
          state_code?: string | null;
          tcs_applicable?: boolean;
          tds_applicable?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gst_party_profiles_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      gst_return_outbox: {
        Row: {
          created_at: string;
          exceptions: Json;
          export_payload: Json | null;
          exported_at: string | null;
          filed_at: string | null;
          filing_reference: string | null;
          firm_id: string;
          id: string;
          line_items: Json;
          notes: string | null;
          period_month: number;
          period_year: number;
          return_type: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          summary_data: Json;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          exceptions?: Json;
          export_payload?: Json | null;
          exported_at?: string | null;
          filed_at?: string | null;
          filing_reference?: string | null;
          firm_id?: string;
          id?: string;
          line_items?: Json;
          notes?: string | null;
          period_month: number;
          period_year: number;
          return_type: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          summary_data?: Json;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          exceptions?: Json;
          export_payload?: Json | null;
          exported_at?: string | null;
          filed_at?: string | null;
          filing_reference?: string | null;
          firm_id?: string;
          id?: string;
          line_items?: Json;
          notes?: string | null;
          period_month?: number;
          period_year?: number;
          return_type?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          summary_data?: Json;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "gst_return_outbox_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      hallmark_batches: {
        Row: {
          batch_number: string | null;
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          batch_number?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          batch_number?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      hsn_sac_codes: {
        Row: {
          category: string | null;
          code: string;
          code_type: string;
          created_at: string;
          default_gst_rate: number;
          description: string;
          effective_from: string;
          effective_to: string | null;
          firm_id: string;
          id: string;
          is_active: boolean;
          linked_rule_id: string | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          code: string;
          code_type?: string;
          created_at?: string;
          default_gst_rate?: number;
          description: string;
          effective_from?: string;
          effective_to?: string | null;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          linked_rule_id?: string | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          code?: string;
          code_type?: string;
          created_at?: string;
          default_gst_rate?: number;
          description?: string;
          effective_from?: string;
          effective_to?: string | null;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          linked_rule_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hsn_sac_codes_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hsn_sac_codes_linked_rule_id_fkey";
            columns: ["linked_rule_id"];
            isOneToOne: false;
            referencedRelation: "compliance_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: {
          barcode: string | null;
          category: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          gross_mg: number;
          huid: string | null;
          id: string;
          item_code: string | null;
          item_master_id: string | null;
          item_name: string;
          location: string;
          net_mg: number;
          purity: number | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          barcode?: string | null;
          category?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gross_mg?: number;
          huid?: string | null;
          id: string;
          item_code?: string | null;
          item_master_id?: string | null;
          item_name: string;
          location: string;
          net_mg?: number;
          purity?: number | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          category?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gross_mg?: number;
          huid?: string | null;
          id?: string;
          item_code?: string | null;
          item_master_id?: string | null;
          item_name?: string;
          location?: string;
          net_mg?: number;
          purity?: number | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          branch_id: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          firm_id: string | null;
          id: string;
          invited_by: string | null;
          role: Database["public"]["Enums"]["app_role"];
          status: string;
          token_hash: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string;
          email: string;
          expires_at?: string;
          firm_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: string;
          token_hash?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          firm_id?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          status?: string;
          token_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          adjustment_paise: number;
          balance_paise: number;
          cgst_paise: number;
          created_at: string;
          customer_id: string | null;
          data: Json;
          firm_id: string | null;
          grand_total_paise: number;
          gst: string;
          gst_paise: number;
          id: string;
          invoice_no: string;
          order_id: string | null;
          paid_paise: number;
          sgst_paise: number;
          status: string;
          subtotal_paise: number;
          updated_at: string;
        };
        Insert: {
          adjustment_paise?: number;
          balance_paise?: number;
          cgst_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          grand_total_paise?: number;
          gst: string;
          gst_paise?: number;
          id: string;
          invoice_no: string;
          order_id?: string | null;
          paid_paise?: number;
          sgst_paise?: number;
          status: string;
          subtotal_paise?: number;
          updated_at?: string;
        };
        Update: {
          adjustment_paise?: number;
          balance_paise?: number;
          cgst_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          grand_total_paise?: number;
          gst?: string;
          gst_paise?: number;
          id?: string;
          invoice_no?: string;
          order_id?: string | null;
          paid_paise?: number;
          sgst_paise?: number;
          status?: string;
          subtotal_paise?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      job_cards: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          job_no: string;
          karigar_id: string | null;
          order_id: string | null;
          status: string;
          template_key: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          job_no: string;
          karigar_id?: string | null;
          order_id?: string | null;
          status: string;
          template_key?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          job_no?: string;
          karigar_id?: string | null;
          order_id?: string | null;
          status?: string;
          template_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_cards_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_cards_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      job_process_steps: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          job_id: string;
          name: string;
          ordinal: number;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          job_id: string;
          name: string;
          ordinal: number;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          job_id?: string;
          name?: string;
          ordinal?: number;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_process_steps_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      licenses: {
        Row: {
          company_name: string;
          created_at: string;
          customer_name: string;
          edition: string;
          expiry_date: string | null;
          id: string;
          license_id: string;
          organization_id: string | null;
          payload: string;
          seats: number;
          signature: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          company_name: string;
          created_at?: string;
          customer_name: string;
          edition: string;
          expiry_date?: string | null;
          id?: string;
          license_id: string;
          organization_id?: string | null;
          payload?: string;
          seats?: number;
          signature?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          company_name?: string;
          created_at?: string;
          customer_name?: string;
          edition?: string;
          expiry_date?: string | null;
          id?: string;
          license_id?: string;
          organization_id?: string | null;
          payload?: string;
          seats?: number;
          signature?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "licenses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      lot_batches: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lot_batches_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      manufacturing_barcodes: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manufacturing_barcodes_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      manufacturing_bills: {
        Row: {
          actual_wastage_fine_mg: number | null;
          actual_wastage_pct: number | null;
          bhav_gold_mg: number | null;
          bill_no: string | null;
          branch_id: string | null;
          cash_payment_paise: number | null;
          category: string | null;
          closing_balance_mg: number | null;
          created_at: string | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          delivery_invoice_id: string | null;
          dust_fine_mg: number | null;
          extra_data: Json;
          filings_fine_mg: number | null;
          filings_gross_mg: number | null;
          filings_purity: number | null;
          finalised_at: string | null;
          finished_fine_mg: number | null;
          finished_gross_mg: number | null;
          finished_purity: number | null;
          finished_stock_item_id: string | null;
          firm_id: string | null;
          gold_bhav_rate_paise: number | null;
          gold_issue_slip_no: string | null;
          gold_issued_fine_mg: number | null;
          gold_issued_gross_mg: number | null;
          gold_issued_purity: number | null;
          hallmark_charges_paise: number | null;
          id: string;
          item_name: string | null;
          job_card_id: string | null;
          job_no: string | null;
          karigar_id: string | null;
          karigar_name: string | null;
          labour_charges_paise: number | null;
          making_charges_paise: number | null;
          mp_entries: string | null;
          net_mfg_cost_paise: number | null;
          notes: string | null;
          opening_balance_mg: number | null;
          order_id: string | null;
          order_no: string | null;
          other_charges_paise: number | null;
          p_entries: string | null;
          pcs: number | null;
          profit_margin_bps: number | null;
          scrap_fine_mg: number | null;
          scrap_gross_mg: number | null;
          scrap_purity: number | null;
          selling_price_paise: number | null;
          status: string | null;
          stone_charges_paise: number | null;
          stone_setting_paise: number | null;
          total_gold_issued_fine_mg: number | null;
          total_gold_returned_fine_mg: number | null;
          updated_at: string | null;
        };
        Insert: {
          actual_wastage_fine_mg?: number | null;
          actual_wastage_pct?: number | null;
          bhav_gold_mg?: number | null;
          bill_no?: string | null;
          branch_id?: string | null;
          cash_payment_paise?: number | null;
          category?: string | null;
          closing_balance_mg?: number | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          delivery_invoice_id?: string | null;
          dust_fine_mg?: number | null;
          extra_data?: Json;
          filings_fine_mg?: number | null;
          filings_gross_mg?: number | null;
          filings_purity?: number | null;
          finalised_at?: string | null;
          finished_fine_mg?: number | null;
          finished_gross_mg?: number | null;
          finished_purity?: number | null;
          finished_stock_item_id?: string | null;
          firm_id?: string | null;
          gold_bhav_rate_paise?: number | null;
          gold_issue_slip_no?: string | null;
          gold_issued_fine_mg?: number | null;
          gold_issued_gross_mg?: number | null;
          gold_issued_purity?: number | null;
          hallmark_charges_paise?: number | null;
          id: string;
          item_name?: string | null;
          job_card_id?: string | null;
          job_no?: string | null;
          karigar_id?: string | null;
          karigar_name?: string | null;
          labour_charges_paise?: number | null;
          making_charges_paise?: number | null;
          mp_entries?: string | null;
          net_mfg_cost_paise?: number | null;
          notes?: string | null;
          opening_balance_mg?: number | null;
          order_id?: string | null;
          order_no?: string | null;
          other_charges_paise?: number | null;
          p_entries?: string | null;
          pcs?: number | null;
          profit_margin_bps?: number | null;
          scrap_fine_mg?: number | null;
          scrap_gross_mg?: number | null;
          scrap_purity?: number | null;
          selling_price_paise?: number | null;
          status?: string | null;
          stone_charges_paise?: number | null;
          stone_setting_paise?: number | null;
          total_gold_issued_fine_mg?: number | null;
          total_gold_returned_fine_mg?: number | null;
          updated_at?: string | null;
        };
        Update: {
          actual_wastage_fine_mg?: number | null;
          actual_wastage_pct?: number | null;
          bhav_gold_mg?: number | null;
          bill_no?: string | null;
          branch_id?: string | null;
          cash_payment_paise?: number | null;
          category?: string | null;
          closing_balance_mg?: number | null;
          created_at?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          delivery_invoice_id?: string | null;
          dust_fine_mg?: number | null;
          extra_data?: Json;
          filings_fine_mg?: number | null;
          filings_gross_mg?: number | null;
          filings_purity?: number | null;
          finalised_at?: string | null;
          finished_fine_mg?: number | null;
          finished_gross_mg?: number | null;
          finished_purity?: number | null;
          finished_stock_item_id?: string | null;
          firm_id?: string | null;
          gold_bhav_rate_paise?: number | null;
          gold_issue_slip_no?: string | null;
          gold_issued_fine_mg?: number | null;
          gold_issued_gross_mg?: number | null;
          gold_issued_purity?: number | null;
          hallmark_charges_paise?: number | null;
          id?: string;
          item_name?: string | null;
          job_card_id?: string | null;
          job_no?: string | null;
          karigar_id?: string | null;
          karigar_name?: string | null;
          labour_charges_paise?: number | null;
          making_charges_paise?: number | null;
          mp_entries?: string | null;
          net_mfg_cost_paise?: number | null;
          notes?: string | null;
          opening_balance_mg?: number | null;
          order_id?: string | null;
          order_no?: string | null;
          other_charges_paise?: number | null;
          p_entries?: string | null;
          pcs?: number | null;
          profit_margin_bps?: number | null;
          scrap_fine_mg?: number | null;
          scrap_gross_mg?: number | null;
          scrap_purity?: number | null;
          selling_price_paise?: number | null;
          status?: string | null;
          stone_charges_paise?: number | null;
          stone_setting_paise?: number | null;
          total_gold_issued_fine_mg?: number | null;
          total_gold_returned_fine_mg?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "manufacturing_bills_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      material_vault_movements: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "material_vault_movements_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      melt_jobs: {
        Row: {
          branch_id: string | null;
          created_at: string | null;
          data: Json;
          date: string | null;
          fine_gold_recovered_mg: number | null;
          firm_id: string | null;
          id: string;
          job_no: string | null;
          loss_fine_mg: number | null;
          status: string | null;
          total_input_fine_mg: number | null;
          updated_at: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string | null;
          data?: Json;
          date?: string | null;
          fine_gold_recovered_mg?: number | null;
          firm_id?: string | null;
          id: string;
          job_no?: string | null;
          loss_fine_mg?: number | null;
          status?: string | null;
          total_input_fine_mg?: number | null;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string | null;
          data?: Json;
          date?: string | null;
          fine_gold_recovered_mg?: number | null;
          firm_id?: string | null;
          id?: string;
          job_no?: string | null;
          loss_fine_mg?: number | null;
          status?: string | null;
          total_input_fine_mg?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "melt_jobs_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      metal_composition_formulas: {
        Row: {
          active: boolean;
          components: Json;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          expected_loss_pct: number;
          fine_metal_permille: number;
          firm_id: string;
          id: string;
          metal_id: string;
          remarks: string | null;
          target_purity_id: string;
          version: number;
        };
        Insert: {
          active?: boolean;
          components?: Json;
          created_at?: string;
          created_by?: string | null;
          effective_from: string;
          expected_loss_pct?: number;
          fine_metal_permille: number;
          firm_id: string;
          id?: string;
          metal_id: string;
          remarks?: string | null;
          target_purity_id: string;
          version: number;
        };
        Update: {
          active?: boolean;
          components?: Json;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          expected_loss_pct?: number;
          fine_metal_permille?: number;
          firm_id?: string;
          id?: string;
          metal_id?: string;
          remarks?: string | null;
          target_purity_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "metal_composition_formulas_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metal_composition_formulas_metal_id_fkey";
            columns: ["metal_id"];
            isOneToOne: false;
            referencedRelation: "precious_metals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metal_composition_formulas_target_purity_id_fkey";
            columns: ["target_purity_id"];
            isOneToOne: false;
            referencedRelation: "precious_metal_purities";
            referencedColumns: ["id"];
          },
        ];
      };
      metal_conversions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "metal_conversions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "metal_conversions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      module_states: {
        Row: {
          branch_id: string | null;
          data: Json;
          enabled: boolean;
          firm_id: string | null;
          id: string;
          module_key: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          data?: Json;
          enabled?: boolean;
          firm_id?: string | null;
          id: string;
          module_key?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          data?: Json;
          enabled?: boolean;
          firm_id?: string | null;
          id?: string;
          module_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "module_states_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      order_issues: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_issues_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          customer_id: string | null;
          data: Json;
          expected_delivery: string | null;
          firm_id: string | null;
          id: string;
          karigar_id: string | null;
          order_no: string;
          priority: string;
          source: string;
          status: string;
          type: string;
          updated_at: string;
          whatsapp_source_id: string | null;
        };
        Insert: {
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          expected_delivery?: string | null;
          firm_id?: string | null;
          id: string;
          karigar_id?: string | null;
          order_no: string;
          priority?: string;
          source?: string;
          status: string;
          type: string;
          updated_at?: string;
          whatsapp_source_id?: string | null;
        };
        Update: {
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          expected_delivery?: string | null;
          firm_id?: string | null;
          id?: string;
          karigar_id?: string | null;
          order_no?: string;
          priority?: string;
          source?: string;
          status?: string;
          type?: string;
          updated_at?: string;
          whatsapp_source_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_features: {
        Row: {
          enabled: boolean;
          feature_key: string;
          organization_id: string;
          source: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          feature_key: string;
          organization_id: string;
          source?: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          feature_key?: string;
          organization_id?: string;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_subscriptions: {
        Row: {
          billing_cycle: string | null;
          created_at: string;
          id: string;
          manual_payment_reference: string | null;
          notes: string | null;
          organization_id: string;
          plan_id: string;
          renews_at: string | null;
          starts_at: string | null;
          status: string;
          suspended_at: string | null;
          trial_ends_at: string | null;
          trial_started_at: string | null;
          updated_at: string;
        };
        Insert: {
          billing_cycle?: string | null;
          created_at?: string;
          id?: string;
          manual_payment_reference?: string | null;
          notes?: string | null;
          organization_id: string;
          plan_id: string;
          renews_at?: string | null;
          starts_at?: string | null;
          status?: string;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
        };
        Update: {
          billing_cycle?: string | null;
          created_at?: string;
          id?: string;
          manual_payment_reference?: string | null;
          notes?: string | null;
          organization_id?: string;
          plan_id?: string;
          renews_at?: string | null;
          starts_at?: string | null;
          status?: string;
          suspended_at?: string | null;
          trial_ends_at?: string | null;
          trial_started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "platform_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_usage_snapshots: {
        Row: {
          branch_count: number;
          captured_at: string;
          id: string;
          organization_id: string;
          storage_bytes: number;
          user_count: number;
        };
        Insert: {
          branch_count?: number;
          captured_at?: string;
          id?: string;
          organization_id: string;
          storage_bytes?: number;
          user_count?: number;
        };
        Update: {
          branch_count?: number;
          captured_at?: string;
          id?: string;
          organization_id?: string;
          storage_bytes?: number;
          user_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "organization_usage_snapshots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address: string | null;
          archived_at: string | null;
          created_at: string;
          data: Json;
          email: string | null;
          gstin: string | null;
          id: string;
          is_active: boolean;
          license_expires_at: string | null;
          license_type: string;
          logo_url: string | null;
          name: string;
          onboarding: Json;
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          data?: Json;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          license_expires_at?: string | null;
          license_type?: string;
          logo_url?: string | null;
          name: string;
          onboarding?: Json;
          phone?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          data?: Json;
          email?: string | null;
          gstin?: string | null;
          id?: string;
          is_active?: boolean;
          license_expires_at?: string | null;
          license_type?: string;
          logo_url?: string | null;
          name?: string;
          onboarding?: Json;
          phone?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outside_work_labour_charges: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outside_work_labour_charges_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      outside_work_payments: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outside_work_payments_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      outside_work_transactions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outside_work_transactions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_paise: number;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          invoice_id: string | null;
          mode: string;
          notes: string | null;
          reference: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          invoice_id?: string | null;
          mode: string;
          notes?: string | null;
          reference?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          invoice_id?: string | null;
          mode?: string;
          notes?: string | null;
          reference?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          aadhaar_masked: string | null;
          active: boolean;
          created_at: string;
          current_address: string | null;
          data: Json;
          email: string | null;
          firm_id: string | null;
          full_name: string;
          gstin: string | null;
          id: string;
          notes: string | null;
          pan: string | null;
          permanent_address: string | null;
          phone: string | null;
          salary_rule_id: string | null;
          type: string;
          updated_at: string;
          village_city: string | null;
          whatsapp: string | null;
          work_type: string | null;
        };
        Insert: {
          aadhaar_masked?: string | null;
          active?: boolean;
          created_at?: string;
          current_address?: string | null;
          data?: Json;
          email?: string | null;
          firm_id?: string | null;
          full_name: string;
          gstin?: string | null;
          id: string;
          notes?: string | null;
          pan?: string | null;
          permanent_address?: string | null;
          phone?: string | null;
          salary_rule_id?: string | null;
          type: string;
          updated_at?: string;
          village_city?: string | null;
          whatsapp?: string | null;
          work_type?: string | null;
        };
        Update: {
          aadhaar_masked?: string | null;
          active?: boolean;
          created_at?: string;
          current_address?: string | null;
          data?: Json;
          email?: string | null;
          firm_id?: string | null;
          full_name?: string;
          gstin?: string | null;
          id?: string;
          notes?: string | null;
          pan?: string | null;
          permanent_address?: string | null;
          phone?: string | null;
          salary_rule_id?: string | null;
          type?: string;
          updated_at?: string;
          village_city?: string | null;
          whatsapp?: string | null;
          work_type?: string | null;
        };
        Relationships: [];
      };
      physical_stock_counts: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_features: {
        Row: {
          created_at: string;
          enabled: boolean;
          feature_key: string;
          plan_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          feature_key: string;
          plan_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          feature_key?: string;
          plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "platform_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_alerts: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          alert_type: string;
          created_at: string;
          description: string | null;
          firm_id: string | null;
          id: string;
          severity: string;
          title: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_type: string;
          created_at?: string;
          description?: string | null;
          firm_id?: string | null;
          id?: string;
          severity: string;
          title: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_type?: string;
          created_at?: string;
          description?: string | null;
          firm_id?: string | null;
          id?: string;
          severity?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_alerts_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_api_key_registry: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          firm_id: string | null;
          id: string;
          key_label: string;
          last_test_at: string | null;
          last_test_status: string | null;
          metadata: Json;
          provider: string;
          revoked_at: string | null;
          rotated_at: string | null;
          scope: string;
          secret_fingerprint: string | null;
          secret_ref: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          firm_id?: string | null;
          id?: string;
          key_label: string;
          last_test_at?: string | null;
          last_test_status?: string | null;
          metadata?: Json;
          provider: string;
          revoked_at?: string | null;
          rotated_at?: string | null;
          scope?: string;
          secret_fingerprint?: string | null;
          secret_ref: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          firm_id?: string | null;
          id?: string;
          key_label?: string;
          last_test_at?: string | null;
          last_test_status?: string | null;
          metadata?: Json;
          provider?: string;
          revoked_at?: string | null;
          rotated_at?: string | null;
          scope?: string;
          secret_fingerprint?: string | null;
          secret_ref?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_api_key_registry_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_audit_events: {
        Row: {
          action: string;
          actor_id: string | null;
          after_value: Json | null;
          before_value: Json | null;
          created_at: string;
          id: string;
          organization_id: string | null;
          reason: string | null;
          target_id: string | null;
          target_type: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          id?: string;
          organization_id?: string | null;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          id?: string;
          organization_id?: string | null;
          reason?: string | null;
          target_id?: string | null;
          target_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_backup_runs: {
        Row: {
          backup_type: string;
          checksum: string | null;
          created_at: string;
          environment: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          location: string | null;
          started_at: string;
          status: string;
          verified_at: string | null;
        };
        Insert: {
          backup_type: string;
          checksum?: string | null;
          created_at?: string;
          environment: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          location?: string | null;
          started_at?: string;
          status: string;
          verified_at?: string | null;
        };
        Update: {
          backup_type?: string;
          checksum?: string | null;
          created_at?: string;
          environment?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          location?: string | null;
          started_at?: string;
          status?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      platform_billing_documents: {
        Row: {
          amount_minor: number;
          buyer_state_code: string | null;
          cgst_minor: number;
          created_at: string;
          created_by: string | null;
          data: Json;
          document_no: string;
          document_type: string;
          due_at: string | null;
          firm_id: string;
          gst_minor: number;
          id: string;
          igst_minor: number;
          issued_at: string | null;
          paid_minor: number;
          seller_state_code: string | null;
          sgst_minor: number;
          status: string;
          taxable_minor: number;
          updated_at: string;
        };
        Insert: {
          amount_minor?: number;
          buyer_state_code?: string | null;
          cgst_minor?: number;
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          document_no: string;
          document_type: string;
          due_at?: string | null;
          firm_id: string;
          gst_minor?: number;
          id?: string;
          igst_minor?: number;
          issued_at?: string | null;
          paid_minor?: number;
          seller_state_code?: string | null;
          sgst_minor?: number;
          status?: string;
          taxable_minor?: number;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          buyer_state_code?: string | null;
          cgst_minor?: number;
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          document_no?: string;
          document_type?: string;
          due_at?: string | null;
          firm_id?: string;
          gst_minor?: number;
          id?: string;
          igst_minor?: number;
          issued_at?: string | null;
          paid_minor?: number;
          seller_state_code?: string | null;
          sgst_minor?: number;
          status?: string;
          taxable_minor?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_billing_documents_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_billing_payments: {
        Row: {
          amount_minor: number;
          billing_document_id: string;
          created_at: string;
          created_by: string;
          firm_id: string;
          id: string;
          method: string;
          received_at: string;
          reference: string | null;
        };
        Insert: {
          amount_minor: number;
          billing_document_id: string;
          created_at?: string;
          created_by: string;
          firm_id: string;
          id?: string;
          method: string;
          received_at?: string;
          reference?: string | null;
        };
        Update: {
          amount_minor?: number;
          billing_document_id?: string;
          created_at?: string;
          created_by?: string;
          firm_id?: string;
          id?: string;
          method?: string;
          received_at?: string;
          reference?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_billing_payments_billing_document_id_fkey";
            columns: ["billing_document_id"];
            isOneToOne: false;
            referencedRelation: "platform_billing_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_billing_payments_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_billing_series: {
        Row: {
          document_type: string;
          last_seq: number;
          prefix: string;
          updated_at: string;
        };
        Insert: {
          document_type: string;
          last_seq?: number;
          prefix: string;
          updated_at?: string;
        };
        Update: {
          document_type?: string;
          last_seq?: number;
          prefix?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_conversation_messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string;
          status: string;
          visibility: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id: string;
          status?: string;
          visibility?: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string;
          status?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_conversation_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "platform_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_conversation_participants: {
        Row: {
          conversation_id: string;
          joined_at: string;
          last_read_at: string | null;
          participant_type: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          joined_at?: string;
          last_read_at?: string | null;
          participant_type?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          joined_at?: string;
          last_read_at?: string | null;
          participant_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "platform_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_conversations: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          firm_id: string | null;
          id: string;
          service_request_id: string | null;
          status: string;
          ticket_id: string | null;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          firm_id?: string | null;
          id?: string;
          service_request_id?: string | null;
          status?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          firm_id?: string | null;
          id?: string;
          service_request_id?: string | null;
          status?: string;
          ticket_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_conversations_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_conversations_service_request_id_fkey";
            columns: ["service_request_id"];
            isOneToOne: false;
            referencedRelation: "platform_service_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_conversations_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "platform_support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_credentials: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          key: string;
          metadata: Json;
          provider: string;
          revoked_at: string | null;
          rotated_at: string | null;
          secret_encrypted: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key: string;
          metadata?: Json;
          provider: string;
          revoked_at?: string | null;
          rotated_at?: string | null;
          secret_encrypted?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key?: string;
          metadata?: Json;
          provider?: string;
          revoked_at?: string | null;
          rotated_at?: string | null;
          secret_encrypted?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_crm_contacts: {
        Row: {
          contact_type: string;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_primary: boolean;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          contact_type: string;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          contact_type?: string;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_primary?: boolean;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_crm_contacts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_deployments: {
        Row: {
          commit_sha: string | null;
          created_at: string;
          deployed_by: string | null;
          environment: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          started_at: string | null;
          status: string;
          version: string;
        };
        Insert: {
          commit_sha?: string | null;
          created_at?: string;
          deployed_by?: string | null;
          environment: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          started_at?: string | null;
          status: string;
          version: string;
        };
        Update: {
          commit_sha?: string | null;
          created_at?: string;
          deployed_by?: string | null;
          environment?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          started_at?: string | null;
          status?: string;
          version?: string;
        };
        Relationships: [];
      };
      platform_error_events: {
        Row: {
          actor_id: string | null;
          category: string;
          context: string | null;
          created_at: string;
          firm_id: string | null;
          id: string;
          message: string;
          reference_id: string;
          severity: string;
          technical_message: string | null;
        };
        Insert: {
          actor_id?: string | null;
          category: string;
          context?: string | null;
          created_at?: string;
          firm_id?: string | null;
          id?: string;
          message: string;
          reference_id: string;
          severity: string;
          technical_message?: string | null;
        };
        Update: {
          actor_id?: string | null;
          category?: string;
          context?: string | null;
          created_at?: string;
          firm_id?: string | null;
          id?: string;
          message?: string;
          reference_id?: string;
          severity?: string;
          technical_message?: string | null;
        };
        Relationships: [];
      };
      platform_maintenance_windows: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          firm_id: string | null;
          id: string;
          message: string;
          metadata: Json;
          scope: string;
          severity: string;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          firm_id?: string | null;
          id?: string;
          message: string;
          metadata?: Json;
          scope?: string;
          severity?: string;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          firm_id?: string | null;
          id?: string;
          message?: string;
          metadata?: Json;
          scope?: string;
          severity?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_maintenance_windows_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_message_attachments: {
        Row: {
          bucket: string;
          created_at: string;
          file_name: string;
          firm_id: string | null;
          id: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          bucket: string;
          created_at?: string;
          file_name: string;
          firm_id?: string | null;
          id?: string;
          message_id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          file_name?: string;
          firm_id?: string | null;
          id?: string;
          message_id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_message_attachments_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_message_attachments_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "platform_conversation_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_notifications: {
        Row: {
          body: string | null;
          created_at: string;
          firm_id: string | null;
          href: string | null;
          id: string;
          kind: string;
          read_at: string | null;
          recipient_id: string;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          firm_id?: string | null;
          href?: string | null;
          id?: string;
          kind: string;
          read_at?: string | null;
          recipient_id: string;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          firm_id?: string | null;
          href?: string | null;
          id?: string;
          kind?: string;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_notifications_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_plans: {
        Row: {
          billing_cycle: string;
          branch_limit: number | null;
          code: string;
          commercial_config: Json;
          created_at: string;
          description: string | null;
          edition_code: string | null;
          feature_limits: Json;
          id: string;
          is_active: boolean;
          name: string;
          price_minor: number;
          storage_limit_bytes: number | null;
          updated_at: string;
          user_limit: number | null;
          workshop_limit: number | null;
        };
        Insert: {
          billing_cycle?: string;
          branch_limit?: number | null;
          code: string;
          commercial_config?: Json;
          created_at?: string;
          description?: string | null;
          edition_code?: string | null;
          feature_limits?: Json;
          id?: string;
          is_active?: boolean;
          name: string;
          price_minor?: number;
          storage_limit_bytes?: number | null;
          updated_at?: string;
          user_limit?: number | null;
          workshop_limit?: number | null;
        };
        Update: {
          billing_cycle?: string;
          branch_limit?: number | null;
          code?: string;
          commercial_config?: Json;
          created_at?: string;
          description?: string | null;
          edition_code?: string | null;
          feature_limits?: Json;
          id?: string;
          is_active?: boolean;
          name?: string;
          price_minor?: number;
          storage_limit_bytes?: number | null;
          updated_at?: string;
          user_limit?: number | null;
          workshop_limit?: number | null;
        };
        Relationships: [];
      };
      platform_service_requests: {
        Row: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          customer_reply: string | null;
          description: string;
          firm_id: string;
          id: string;
          internal_notes: string | null;
          priority: string;
          request_no: string;
          requester_id: string;
          resolution: string | null;
          sla_due_at: string | null;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          branch_id?: string | null;
          category: string;
          closed_at?: string | null;
          created_at?: string;
          customer_reply?: string | null;
          description: string;
          firm_id: string;
          id?: string;
          internal_notes?: string | null;
          priority?: string;
          request_no: string;
          requester_id: string;
          resolution?: string | null;
          sla_due_at?: string | null;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          branch_id?: string | null;
          category?: string;
          closed_at?: string | null;
          created_at?: string;
          customer_reply?: string | null;
          description?: string;
          firm_id?: string;
          id?: string;
          internal_notes?: string | null;
          priority?: string;
          request_no?: string;
          requester_id?: string;
          resolution?: string | null;
          sla_due_at?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_service_requests_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_service_requests_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_settings: {
        Row: {
          is_secret: boolean;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          is_secret?: boolean;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          is_secret?: boolean;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      platform_support_tickets: {
        Row: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          branch_id?: string | null;
          category: string;
          closed_at?: string | null;
          created_at?: string;
          description: string;
          firm_id: string;
          id?: string;
          module?: string | null;
          priority?: string;
          requester_id: string;
          resolution?: string | null;
          resolved_at?: string | null;
          severity?: string;
          sla_due_at?: string | null;
          status?: string;
          subject: string;
          ticket_no: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          branch_id?: string | null;
          category?: string;
          closed_at?: string | null;
          created_at?: string;
          description?: string;
          firm_id?: string;
          id?: string;
          module?: string | null;
          priority?: string;
          requester_id?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          severity?: string;
          sla_due_at?: string | null;
          status?: string;
          subject?: string;
          ticket_no?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_support_tickets_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_support_tickets_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      polishing_transactions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "polishing_transactions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      precious_metal_purities: {
        Row: {
          active: boolean;
          created_at: string;
          firm_id: string;
          id: string;
          label: string;
          metal_id: string;
          permille: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          firm_id: string;
          id?: string;
          label: string;
          metal_id: string;
          permille: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          firm_id?: string;
          id?: string;
          label?: string;
          metal_id?: string;
          permille?: number;
        };
        Relationships: [
          {
            foreignKeyName: "precious_metal_purities_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "precious_metal_purities_metal_id_fkey";
            columns: ["metal_id"];
            isOneToOne: false;
            referencedRelation: "precious_metals";
            referencedColumns: ["id"];
          },
        ];
      };
      precious_metals: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          firm_id: string;
          id: string;
          name: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          firm_id: string;
          id?: string;
          name: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          firm_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "precious_metals_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      print_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          doc_type: string;
          firm_id: string;
          id: string;
          last_error: string | null;
          pdf_file_name: string | null;
          status: string;
          title: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          doc_type: string;
          firm_id?: string;
          id: string;
          last_error?: string | null;
          pdf_file_name?: string | null;
          status: string;
          title: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          doc_type?: string;
          firm_id?: string;
          id?: string;
          last_error?: string | null;
          pdf_file_name?: string | null;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "print_jobs_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      print_logs: {
        Row: {
          created_at: string;
          data: Json;
          doc_number: string;
          doc_type: string;
          firm_id: string | null;
          first_printed_at: string;
          history: Json;
          id: string;
          last_printed_at: string;
          linked_id: string | null;
          linked_label: string | null;
          printed_by: string | null;
          reprint_count: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          doc_number: string;
          doc_type: string;
          firm_id?: string | null;
          first_printed_at?: string;
          history?: Json;
          id: string;
          last_printed_at?: string;
          linked_id?: string | null;
          linked_label?: string | null;
          printed_by?: string | null;
          reprint_count?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          doc_number?: string;
          doc_type?: string;
          firm_id?: string | null;
          first_printed_at?: string;
          history?: Json;
          id?: string;
          last_printed_at?: string;
          linked_id?: string | null;
          linked_label?: string | null;
          printed_by?: string | null;
          reprint_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      print_templates: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_cut_records: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          gold_rate_per_gram_paise: number;
          id: string;
          job_id: string | null;
          karigar_id: string | null;
          overloss_fine_mg: number;
          penalty_paise: number;
          rate_cut_no: string;
          settlement_mode: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gold_rate_per_gram_paise?: number;
          id: string;
          job_id?: string | null;
          karigar_id?: string | null;
          overloss_fine_mg?: number;
          penalty_paise?: number;
          rate_cut_no: string;
          settlement_mode: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gold_rate_per_gram_paise?: number;
          id?: string;
          job_id?: string | null;
          karigar_id?: string | null;
          overloss_fine_mg?: number;
          penalty_paise?: number;
          rate_cut_no?: string;
          settlement_mode?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_cut_records_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "job_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rate_cut_records_karigar_id_fkey";
            columns: ["karigar_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      reference_notes: {
        Row: {
          author: string;
          created_at: string;
          entity_id: string;
          entity_type: string;
          firm_id: string;
          id: string;
          note: string;
          updated_at: string;
        };
        Insert: {
          author?: string;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          firm_id: string;
          id: string;
          note: string;
          updated_at?: string;
        };
        Update: {
          author?: string;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          firm_id?: string;
          id?: string;
          note?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reference_notes_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      repairs: {
        Row: {
          advance_paise: number;
          created_at: string;
          customer_id: string | null;
          data: Json;
          estimated_charge_paise: number;
          firm_id: string | null;
          id: string;
          kind: string;
          received_gross_mg: number;
          repair_no: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          advance_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          estimated_charge_paise?: number;
          firm_id?: string | null;
          id: string;
          kind: string;
          received_gross_mg?: number;
          repair_no: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          advance_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          estimated_charge_paise?: number;
          firm_id?: string | null;
          id?: string;
          kind?: string;
          received_gross_mg?: number;
          repair_no?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      salary_rules: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_filters: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_filters_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_jobs: {
        Row: {
          cadence: string;
          firm_id: string;
          job_key: string;
          last_error: string | null;
          last_run_at: string | null;
          last_status: string | null;
          updated_at: string;
        };
        Insert: {
          cadence: string;
          firm_id?: string;
          job_key: string;
          last_error?: string | null;
          last_run_at?: string | null;
          last_status?: string | null;
          updated_at?: string;
        };
        Update: {
          cadence?: string;
          firm_id?: string;
          job_key?: string;
          last_error?: string | null;
          last_run_at?: string | null;
          last_status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheduled_jobs_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      security_operations: {
        Row: {
          actor_email: string | null;
          actor_id: string | null;
          created_at: string;
          details: Json;
          id: string;
          operation_type: string;
          status: string;
          summary: string | null;
          updated_at: string;
        };
        Insert: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id: string;
          operation_type: string;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Update: {
          actor_email?: string | null;
          actor_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
          operation_type?: string;
          status?: string;
          summary?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialist_payment_clearances: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialist_payment_clearances_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "specialist_payment_clearances_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      specialist_work_variances: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialist_work_variances_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "specialist_work_variances_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_lots: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          lot_number: string | null;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          lot_number?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          lot_number?: string | null;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          from_location: string | null;
          id: string;
          item_id: string | null;
          kind: string;
          note: string | null;
          to_location: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          from_location?: string | null;
          id: string;
          item_id?: string | null;
          kind: string;
          note?: string | null;
          to_location?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          from_location?: string | null;
          id?: string;
          item_id?: string | null;
          kind?: string;
          note?: string | null;
          to_location?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_stones: {
        Row: {
          branch_id: string | null;
          certificate_number: string | null;
          created_at: string;
          data: Json;
          id: string;
          item_id: string | null;
          stone_type: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          certificate_number?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          item_id?: string | null;
          stone_type?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          certificate_number?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          item_id?: string | null;
          stone_type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      stone_details: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stone_details_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      storage_file_metadata: {
        Row: {
          archived_at: string | null;
          branch_id: string | null;
          bucket_id: string;
          entity_id: string;
          entity_type: string;
          firm_id: string;
          id: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          visibility: string;
        };
        Insert: {
          archived_at?: string | null;
          branch_id?: string | null;
          bucket_id: string;
          entity_id: string;
          entity_type: string;
          firm_id: string;
          id?: string;
          mime_type: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
          visibility?: string;
        };
        Update: {
          archived_at?: string | null;
          branch_id?: string | null;
          bucket_id?: string;
          entity_id?: string;
          entity_type?: string;
          firm_id?: string;
          id?: string;
          mime_type?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "storage_file_metadata_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "storage_file_metadata_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_history: {
        Row: {
          action: string;
          actor_id: string | null;
          after_value: Json | null;
          before_value: Json | null;
          created_at: string;
          id: string;
          organization_id: string;
          reason: string | null;
          subscription_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          reason?: string | null;
          subscription_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_value?: Json | null;
          before_value?: Json | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          reason?: string | null;
          subscription_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_history_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_history_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "organization_subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_purchases: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          due_paise: number;
          fine_mg: number;
          firm_id: string;
          gold_paid_fine_mg: number;
          gross_mg: number;
          gst_paise: number;
          gst_rate_pct: number;
          id: string;
          invoice_date: string | null;
          invoice_no: string | null;
          metal: string;
          paid_paise: number;
          purchase_no: string;
          purity_permille: number | null;
          subtotal_paise: number;
          supplier_id: string;
          total_paise: number;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          due_paise?: number;
          fine_mg?: number;
          firm_id: string;
          gold_paid_fine_mg?: number;
          gross_mg?: number;
          gst_paise?: number;
          gst_rate_pct?: number;
          id: string;
          invoice_date?: string | null;
          invoice_no?: string | null;
          metal?: string;
          paid_paise?: number;
          purchase_no: string;
          purity_permille?: number | null;
          subtotal_paise?: number;
          supplier_id: string;
          total_paise?: number;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          due_paise?: number;
          fine_mg?: number;
          firm_id?: string;
          gold_paid_fine_mg?: number;
          gross_mg?: number;
          gst_paise?: number;
          gst_rate_pct?: number;
          id?: string;
          invoice_date?: string | null;
          invoice_no?: string | null;
          metal?: string;
          paid_paise?: number;
          purchase_no?: string;
          purity_permille?: number | null;
          subtotal_paise?: number;
          supplier_id?: string;
          total_paise?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "supplier_purchases_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      support_sessions: {
        Row: {
          actor_id: string;
          created_at: string;
          ended_at: string | null;
          expires_at: string;
          id: string;
          organization_id: string;
          reason: string;
          starts_at: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          ended_at?: string | null;
          expires_at: string;
          id?: string;
          organization_id: string;
          reason: string;
          starts_at?: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          organization_id?: string;
          reason?: string;
          starts_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      universal_ledger_entries: {
        Row: {
          branch_id: string | null;
          cash_credit_paise: number;
          cash_debit_paise: number;
          commitment_due_at: string | null;
          counterparty_id: string | null;
          counterparty_name: string | null;
          created_at: string;
          created_by: string | null;
          fine_gold_credit_mg: number;
          fine_gold_debit_mg: number;
          fine_silver_credit_mg: number;
          fine_silver_debit_mg: number;
          firm_id: string;
          gross_weight_mg: number;
          id: string;
          less_weight_mg: number;
          metadata: Json;
          net_weight_mg: number;
          pieces: number;
          reversal_ref_id: string | null;
          status: string;
          stone_carats: number;
          transaction_definition_id: string | null;
          voucher_date: string;
          voucher_number: string;
          waiting_on: string | null;
        };
        Insert: {
          branch_id?: string | null;
          cash_credit_paise?: number;
          cash_debit_paise?: number;
          commitment_due_at?: string | null;
          counterparty_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_gold_credit_mg?: number;
          fine_gold_debit_mg?: number;
          fine_silver_credit_mg?: number;
          fine_silver_debit_mg?: number;
          firm_id: string;
          gross_weight_mg?: number;
          id?: string;
          less_weight_mg?: number;
          metadata?: Json;
          net_weight_mg?: number;
          pieces?: number;
          reversal_ref_id?: string | null;
          status?: string;
          stone_carats?: number;
          transaction_definition_id?: string | null;
          voucher_date?: string;
          voucher_number: string;
          waiting_on?: string | null;
        };
        Update: {
          branch_id?: string | null;
          cash_credit_paise?: number;
          cash_debit_paise?: number;
          commitment_due_at?: string | null;
          counterparty_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          fine_gold_credit_mg?: number;
          fine_gold_debit_mg?: number;
          fine_silver_credit_mg?: number;
          fine_silver_debit_mg?: number;
          firm_id?: string;
          gross_weight_mg?: number;
          id?: string;
          less_weight_mg?: number;
          metadata?: Json;
          net_weight_mg?: number;
          pieces?: number;
          reversal_ref_id?: string | null;
          status?: string;
          stone_carats?: number;
          transaction_definition_id?: string | null;
          voucher_date?: string;
          voucher_number?: string;
          waiting_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "universal_ledger_entries_reversal_ref_id_fkey";
            columns: ["reversal_ref_id"];
            isOneToOne: false;
            referencedRelation: "universal_ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "universal_ledger_entries_transaction_definition_id_fkey";
            columns: ["transaction_definition_id"];
            isOneToOne: false;
            referencedRelation: "universal_transaction_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      universal_transaction_definitions: {
        Row: {
          category: string;
          code: string;
          counterparty_type: string;
          created_at: string;
          created_by: string | null;
          fields_schema: Json;
          firm_id: string | null;
          id: string;
          is_active: boolean;
          is_system: boolean;
          name: string;
          posting_rules: Json;
          updated_at: string;
        };
        Insert: {
          category?: string;
          code: string;
          counterparty_type?: string;
          created_at?: string;
          created_by?: string | null;
          fields_schema?: Json;
          firm_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          name: string;
          posting_rules?: Json;
          updated_at?: string;
        };
        Update: {
          category?: string;
          code?: string;
          counterparty_type?: string;
          created_at?: string;
          created_by?: string | null;
          fields_schema?: Json;
          firm_id?: string | null;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          name?: string;
          posting_rules?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          active: boolean;
          auth_id: string;
          branch_id: string | null;
          created_at: string;
          customer_person_id: string | null;
          data: Json;
          firm_id: string | null;
          full_name: string;
          id: string;
          last_login: string | null;
          permissions: Json;
          phone: string | null;
          role: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          auth_id: string;
          branch_id?: string | null;
          created_at?: string;
          customer_person_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          full_name: string;
          id?: string;
          last_login?: string | null;
          permissions?: Json;
          phone?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          auth_id?: string;
          branch_id?: string | null;
          created_at?: string;
          customer_person_id?: string | null;
          data?: Json;
          firm_id?: string | null;
          full_name?: string;
          id?: string;
          last_login?: string | null;
          permissions?: Json;
          phone?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_customer_person_id_fkey";
            columns: ["customer_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_profiles_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_inbox: {
        Row: {
          converted_order_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          linked_person_id: string | null;
          notes: string | null;
          parsed: Json | null;
          raw_text: string;
          sender_name: string | null;
          sender_phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          converted_order_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          linked_person_id?: string | null;
          notes?: string | null;
          parsed?: Json | null;
          raw_text: string;
          sender_name?: string | null;
          sender_phone?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          converted_order_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          linked_person_id?: string | null;
          notes?: string | null;
          parsed?: Json | null;
          raw_text?: string;
          sender_name?: string | null;
          sender_phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_converted_order_id_fkey";
            columns: ["converted_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_inbox_linked_person_id_fkey";
            columns: ["linked_person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_returns: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          order_id: string;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          order_id: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          order_id?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "worker_returns_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_settlements: {
        Row: {
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          period_from: string | null;
          period_to: string | null;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          period_from?: string | null;
          period_to?: string | null;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          period_from?: string | null;
          period_to?: string | null;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      worker_transactions: {
        Row: {
          amount_paise: number;
          created_at: string;
          data: Json;
          firm_id: string | null;
          gold_mg: number;
          id: string;
          kind: string;
          ts: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gold_mg?: number;
          id: string;
          kind: string;
          ts?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          gold_mg?: number;
          id?: string;
          kind?: string;
          ts?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      workflow_step_definitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity_type: string;
          firm_id: string;
          id: string;
          is_active: boolean;
          is_system: boolean;
          steps: Json;
          updated_at: string;
          workflow_code: string;
          workflow_name: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity_type: string;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          steps?: Json;
          updated_at?: string;
          workflow_code: string;
          workflow_name: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity_type?: string;
          firm_id?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          steps?: Json;
          updated_at?: string;
          workflow_code?: string;
          workflow_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_step_definitions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_step_instances: {
        Row: {
          completed_at: string | null;
          created_at: string;
          current_step_name: string | null;
          current_step_order: number;
          entity_id: string;
          entity_type: string;
          firm_id: string;
          id: string;
          started_at: string;
          status: string;
          step_history: Json;
          updated_at: string;
          workflow_definition_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          current_step_name?: string | null;
          current_step_order?: number;
          entity_id: string;
          entity_type: string;
          firm_id?: string;
          id?: string;
          started_at?: string;
          status?: string;
          step_history?: Json;
          updated_at?: string;
          workflow_definition_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          current_step_name?: string | null;
          current_step_order?: number;
          entity_id?: string;
          entity_type?: string;
          firm_id?: string;
          id?: string;
          started_at?: string;
          status?: string;
          step_history?: Json;
          updated_at?: string;
          workflow_definition_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_step_instances_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workflow_step_instances_workflow_definition_id_fkey";
            columns: ["workflow_definition_id"];
            isOneToOne: false;
            referencedRelation: "workflow_step_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      workshop_process_transactions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workshop_process_transactions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workshop_process_transactions_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      workshops: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          name: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          name?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workshops_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workshops_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_plan_entitlements: {
        Args: {
          p_organization_id: string;
          p_plan_id: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      assert_organization_limit: {
        Args: { p_resource: string };
        Returns: undefined;
      };
      assert_storage_limit: {
        Args: { p_additional_bytes?: number };
        Returns: undefined;
      };
      broadcast_platform_notifications: {
        Args: {
          p_body?: string;
          p_firm_id: string;
          p_href?: string;
          p_kind: string;
          p_title: string;
        };
        Returns: number;
      };
      central_track_activity: {
        Args: {
          p_branch_id?: string;
          p_description?: string;
          p_entity_id: string;
          p_entity_type: string;
          p_event_type: string;
          p_metadata?: Json;
          p_related_document_id?: string;
          p_related_party_id?: string;
          p_related_transaction_id?: string;
          p_severity?: string;
          p_title: string;
        };
        Returns: string;
      };
      check_organization_limit: {
        Args: { p_resource: string };
        Returns: boolean;
      };
      check_storage_limit: {
        Args: { p_additional_bytes?: number };
        Returns: boolean;
      };
      complete_firm_setup: {
        Args: {
          p_edition?: string;
          p_organization_id: string;
          p_plan_code?: string;
          p_reason?: string;
          p_seats?: number;
          p_trial_months?: number;
        };
        Returns: Json;
      };
      consolidate_duplicate_branches: {
        Args: { p_firm_id?: string };
        Returns: Json;
      };
      create_customer_support_ticket: {
        Args: {
          p_category?: string;
          p_description: string;
          p_priority?: string;
          p_subject: string;
        };
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_firm_support_ticket: {
        Args: {
          p_category?: string;
          p_description: string;
          p_diagnostics_consent?: boolean;
          p_module?: string;
          p_priority?: string;
          p_severity?: string;
          p_subject: string;
        };
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_staff_support_ticket: {
        Args: {
          p_category?: string;
          p_description: string;
          p_priority?: string;
          p_subject: string;
        };
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      evaluate_trial_expiry: { Args: never; Returns: number };
      export_entitlement_enabled: { Args: never; Returns: boolean };
      extend_platform_trial: {
        Args: { p_days: number; p_organization_id: string; p_reason: string };
        Returns: {
          billing_cycle: string | null;
          created_at: string;
          id: string;
          manual_payment_reference: string | null;
          notes: string | null;
          organization_id: string;
          plan_id: string;
          renews_at: string | null;
          starts_at: string | null;
          status: string;
          suspended_at: string | null;
          trial_ends_at: string | null;
          trial_started_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      generate_sequential_number: {
        Args: { p_prefix: string; p_type: string };
        Returns: string;
      };
      get_billing_outstanding_summary: {
        Args: { p_branch_id?: string };
        Returns: {
          amount_paise: number;
          customer_id: string;
          customer_name: string;
          latest_invoice_id: string;
          latest_invoice_no: string;
          oldest_created_at: string;
          phone: string;
        }[];
      };
      get_ceo_branch_kpis: {
        Args: { p_branch_id: string };
        Returns: {
          active_job_cards: number;
          invoice_count: number;
          outstanding_paise: number;
          pending_orders: number;
          pending_repairs: number;
          ready_job_cards: number;
          sales_this_month_paise: number;
          total_customers: number;
        }[];
      };
      get_ceo_gold_trend: {
        Args: { p_days?: number };
        Returns: {
          day: string;
          fine_mg: number;
        }[];
      };
      get_chatwoot_ticket_link: { Args: { p_ticket_id: string }; Returns: Json };
      get_firm_customer_support_thread: {
        Args: { p_ticket_id: string };
        Returns: Json;
      };
      get_home_dashboard_summary: {
        Args: never;
        Returns: {
          available_stock_count: number;
          customer_gold_mg: number;
          finished_gold_mg: number;
          jeweller_gold_mg: number;
          karigar_gold_mg: number;
          ledger_discrepancy_mg: number;
          open_orders: number;
          scrap_gold_mg: number;
          today_billing_paise: number;
          today_card_paise: number;
          today_cash_paise: number;
          today_gold_paid_paise: number;
          today_gold_sold_mg: number;
          today_invoice_count: number;
          today_outstanding_paise: number;
          today_upi_paise: number;
          total_invoice_count: number;
          total_orders: number;
          vault_gold_mg: number;
        }[];
      };
      get_karigar_portal: { Args: never; Returns: Json };
      get_login_destination: { Args: never; Returns: string };
      get_my_tenant_entitlements: { Args: never; Returns: Json };
      get_my_tenant_license_key: { Args: never; Returns: string };
      get_my_tenant_subscription_entitlement: { Args: never; Returns: Json };
      get_organization_plan_limits: {
        Args: { p_organization_id?: string };
        Returns: Json;
      };
      get_organization_storage_bytes: {
        Args: { p_organization_id?: string };
        Returns: number;
      };
      get_platform_firm_stats: {
        Args: never;
        Returns: {
          firm_id: string;
          invoice_value_minor: number;
          invoices: number;
          job_cards: number;
          open_orders: number;
          orders: number;
          platform_bills: number;
          users: number;
        }[];
      };
      get_platform_support_thread: {
        Args: { p_ticket_id: string };
        Returns: Json;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_customer_role: { Args: never; Returns: boolean };
      is_firm_ticket_staff: { Args: never; Returns: boolean };
      is_saas_admin: { Args: never; Returns: boolean };
      is_valid_feature_key: {
        Args: { p_feature_key: string };
        Returns: boolean;
      };
      issue_platform_billing_document: {
        Args: { p_document_id: string; p_reason?: string };
        Returns: {
          amount_minor: number;
          buyer_state_code: string | null;
          cgst_minor: number;
          created_at: string;
          created_by: string | null;
          data: Json;
          document_no: string;
          document_type: string;
          due_at: string | null;
          firm_id: string;
          gst_minor: number;
          id: string;
          igst_minor: number;
          issued_at: string | null;
          paid_minor: number;
          seller_state_code: string | null;
          sgst_minor: number;
          status: string;
          taxable_minor: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_billing_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      issue_platform_license: {
        Args: {
          p_company_name: string;
          p_customer_name: string;
          p_edition: string;
          p_expiry?: string;
          p_features?: Json;
          p_license_id: string;
          p_organization_id?: string;
          p_reason?: string;
          p_seats?: number;
        };
        Returns: {
          company_name: string;
          created_at: string;
          customer_name: string;
          edition: string;
          expiry_date: string | null;
          id: string;
          license_id: string;
          organization_id: string | null;
          payload: string;
          seats: number;
          signature: string;
          status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "licenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      list_customer_portal_support_tickets: {
        Args: { p_priority?: string; p_status?: string };
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_firm_support_tickets: {
        Args: never;
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      list_my_support_tickets: {
        Args: never;
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      my_customer_person_id: { Args: never; Returns: string };
      my_firm_id: { Args: never; Returns: string };
      my_role: { Args: never; Returns: string };
      next_document_number: {
        Args: { p_key: string; p_pad_length?: number; p_prefix: string };
        Returns: string;
      };
      next_platform_document_no: {
        Args: { p_document_type: string };
        Returns: string;
      };
      onboard_tenant: {
        Args: {
          p_auth_id: string;
          p_branch_address?: string;
          p_branch_code?: string;
          p_branch_name?: string;
          p_branch_phone?: string;
          p_firm_name: string;
          p_firm_slug: string;
          p_owner_full_name: string;
          p_plan_code?: string;
          p_trial_months?: number;
        };
        Returns: {
          branch_id: string;
          organization_id: string;
          subscription_id: string;
        }[];
      };
      organization_feature_enabled: {
        Args: { p_feature_key: string };
        Returns: boolean;
      };
      platform_health_ping: { Args: never; Returns: Json };
      post_gold_ledger_entries: { Args: { p_entries: Json }; Returns: Json };
      post_metal_conversion: { Args: { p_payload: Json }; Returns: Json };
      post_supplier_purchase: { Args: { p_payload: Json }; Returns: Json };
      provision_platform_firm: {
        Args: {
          p_customer_name?: string;
          p_edition?: string;
          p_firm_name: string;
          p_firm_slug: string;
          p_plan_code?: string;
          p_reason?: string;
          p_seats?: number;
          p_trial_months?: number;
        };
        Returns: Json;
      };
      reapply_all_organization_plan_entitlements: {
        Args: { p_reason?: string };
        Returns: Json;
      };
      record_platform_audit: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_organization_id?: string;
          p_reason?: string;
          p_target_id?: string;
          p_target_type?: string;
        };
        Returns: string;
      };
      record_platform_billing_payment: {
        Args: {
          p_amount_minor: number;
          p_document_id: string;
          p_method: string;
          p_reference?: string;
        };
        Returns: {
          amount_minor: number;
          buyer_state_code: string | null;
          cgst_minor: number;
          created_at: string;
          created_by: string | null;
          data: Json;
          document_no: string;
          document_type: string;
          due_at: string | null;
          firm_id: string;
          gst_minor: number;
          id: string;
          igst_minor: number;
          issued_at: string | null;
          paid_minor: number;
          seller_state_code: string | null;
          sgst_minor: number;
          status: string;
          taxable_minor: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_billing_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_platform_notification: {
        Args: {
          p_body?: string;
          p_firm_id?: string;
          p_href?: string;
          p_kind: string;
          p_recipient_id: string;
          p_title: string;
        };
        Returns: {
          body: string | null;
          created_at: string;
          firm_id: string | null;
          href: string | null;
          id: string;
          kind: string;
          read_at: string | null;
          recipient_id: string;
          title: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_notifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      renew_platform_license: {
        Args: { p_license_id: string; p_new_expiry: string; p_reason?: string };
        Returns: {
          company_name: string;
          created_at: string;
          customer_name: string;
          edition: string;
          expiry_date: string | null;
          id: string;
          license_id: string;
          organization_id: string | null;
          payload: string;
          seats: number;
          signature: string;
          status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "licenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reply_firm_customer_support_ticket: {
        Args: { p_body: string; p_ticket_id: string };
        Returns: Json;
      };
      reply_platform_support_ticket: {
        Args: { p_body: string; p_ticket_id: string };
        Returns: Json;
      };
      require_organization_feature: {
        Args: { p_feature_key: string };
        Returns: undefined;
      };
      resolve_document_share: { Args: { p_token: string }; Returns: Json };
      reverse_supplier_purchase: {
        Args: { p_purchase_id: string };
        Returns: Json;
      };
      revoke_platform_credential: {
        Args: { p_key: string; p_reason?: string };
        Returns: undefined;
      };
      rpc_post_universal_transaction: {
        Args: {
          p_branch_id: string;
          p_cash_credit_paise?: number;
          p_cash_debit_paise?: number;
          p_commitment_due_at?: string;
          p_counterparty_id?: string;
          p_counterparty_name?: string;
          p_fine_gold_credit_mg?: number;
          p_fine_gold_debit_mg?: number;
          p_firm_id: string;
          p_gross_weight_mg?: number;
          p_less_weight_mg?: number;
          p_metadata?: Json;
          p_net_weight_mg?: number;
          p_transaction_code: string;
          p_voucher_number: string;
          p_waiting_on?: string;
        };
        Returns: string;
      };
      set_organization_feature: {
        Args: {
          p_enabled: boolean;
          p_feature_key: string;
          p_organization_id: string;
          p_reason: string;
        };
        Returns: {
          enabled: boolean;
          feature_key: string;
          organization_id: string;
          source: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_features";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_platform_firm_active: {
        Args: { p_firm_id: string; p_is_active: boolean; p_reason: string };
        Returns: {
          address: string | null;
          archived_at: string | null;
          created_at: string;
          data: Json;
          email: string | null;
          gstin: string | null;
          id: string;
          is_active: boolean;
          license_expires_at: string | null;
          license_type: string;
          logo_url: string | null;
          name: string;
          onboarding: Json;
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_platform_setting:
        | {
            Args: { p_key: string; p_reason: string; p_value: Json };
            Returns: {
              is_secret: boolean;
              key: string;
              updated_at: string;
              updated_by: string | null;
              value: Json;
            };
            SetofOptions: {
              from: "*";
              to: "platform_settings";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              p_is_secret?: boolean;
              p_key: string;
              p_reason: string;
              p_value: Json;
            };
            Returns: {
              is_secret: boolean;
              key: string;
              updated_at: string;
              updated_by: string | null;
              value: Json;
            };
            SetofOptions: {
              from: "*";
              to: "platform_settings";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      suspend_platform_license: {
        Args: { p_license_id: string; p_reason?: string };
        Returns: {
          company_name: string;
          created_at: string;
          customer_name: string;
          edition: string;
          expiry_date: string | null;
          id: string;
          license_id: string;
          organization_id: string | null;
          payload: string;
          seats: number;
          signature: string;
          status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "licenses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      tenant_module_write_allowed: {
        Args: { p_feature_key: string };
        Returns: boolean;
      };
      transition_firm_customer_support_ticket: {
        Args: { p_status: string; p_ticket_id: string };
        Returns: {
          assigned_to: string | null;
          branch_id: string | null;
          category: string;
          closed_at: string | null;
          created_at: string;
          description: string;
          firm_id: string;
          id: string;
          module: string | null;
          priority: string;
          requester_id: string;
          resolution: string | null;
          resolved_at: string | null;
          severity: string;
          sla_due_at: string | null;
          status: string;
          subject: string;
          ticket_no: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "platform_support_tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_platform_subscription: {
        Args: {
          p_organization_id: string;
          p_plan_id?: string;
          p_reason?: string;
          p_status?: string;
        };
        Returns: {
          billing_cycle: string | null;
          created_at: string;
          id: string;
          manual_payment_reference: string | null;
          notes: string | null;
          organization_id: string;
          plan_id: string;
          renews_at: string | null;
          starts_at: string | null;
          status: string;
          suspended_at: string | null;
          trial_ends_at: string | null;
          trial_started_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organization_subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      upsert_platform_credential: {
        Args: {
          p_key: string;
          p_metadata?: Json;
          p_provider: string;
          p_reason?: string;
          p_secret: string;
        };
        Returns: Json;
      };
      validate_license: {
        Args: {
          p_deployment_mode?: string;
          p_device_id?: string;
          p_license_key?: string;
          p_client_type?: string;
          p_tenant_id?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role:
        | "saas_admin"
        | "owner"
        | "admin"
        | "ceo"
        | "manager"
        | "accountant"
        | "billing"
        | "vault"
        | "workshop"
        | "viewer";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "saas_admin",
        "owner",
        "admin",
        "ceo",
        "manager",
        "accountant",
        "billing",
        "vault",
        "workshop",
        "viewer",
      ],
    },
  },
} as const;
