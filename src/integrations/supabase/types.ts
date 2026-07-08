export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
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
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          file_name: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          kind: string;
          linked_id: string;
          linked_table: string;
          mime_type: string | null;
          size_bytes: number | null;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          kind: string;
          linked_id: string;
          linked_table: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          kind?: string;
          linked_id?: string;
          linked_table?: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance: {
        Row: {
          created_at: string;
          data: Json;
          date: string;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          hours: number | null;
          id: string;
          is_deleted: boolean;
          status: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          date: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          hours?: number | null;
          id: string;
          is_deleted?: boolean;
          status: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          date?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          hours?: number | null;
          id?: string;
          is_deleted?: boolean;
          status?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          firm_id: string | null;
          id: number;
          ip_address: unknown;
          new_data: Json | null;
          old_data: Json | null;
          record_id: string;
          table_name: string;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          firm_id?: string | null;
          id?: never;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id: string;
          table_name: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          firm_id?: string | null;
          id?: never;
          ip_address?: unknown;
          new_data?: Json | null;
          old_data?: Json | null;
          record_id?: string;
          table_name?: string;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      branch_settings: {
        Row: {
          address: string | null;
          barcode_series: string | null;
          branch_id: string;
          comm_provider_settings: Json | null;
          default_karat: number | null;
          email: string | null;
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
          wa_automations: Json | null;
          wa_config: Json | null;
          wa_phone_number: string | null;
        };
        Insert: {
          address?: string | null;
          barcode_series?: string | null;
          branch_id: string;
          comm_provider_settings?: Json | null;
          default_karat?: number | null;
          email?: string | null;
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
          wa_automations?: Json | null;
          wa_config?: Json | null;
          wa_phone_number?: string | null;
        };
        Update: {
          address?: string | null;
          barcode_series?: string | null;
          branch_id?: string;
          comm_provider_settings?: Json | null;
          default_karat?: number | null;
          email?: string | null;
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
          wa_automations?: Json | null;
          wa_config?: Json | null;
          wa_phone_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branch_settings_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: true;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          active: boolean;
          address: string;
          code: string;
          created_at: string;
          gstin: string | null;
          id: string;
          is_default: boolean;
          manager_name: string;
          name: string;
          notes: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          address?: string;
          code: string;
          created_at?: string;
          gstin?: string | null;
          id: string;
          is_default?: boolean;
          manager_name?: string;
          name: string;
          notes?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          address?: string;
          code?: string;
          created_at?: string;
          gstin?: string | null;
          id?: string;
          is_default?: boolean;
          manager_name?: string;
          name?: string;
          notes?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_designs: {
        Row: {
          category: string | null;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          design_no: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          design_no?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          design_no?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      communication_logs: {
        Row: {
          body: string | null;
          channel: string;
          created_at: string;
          data: Json;
          direction: string;
          firm_id: string | null;
          id: string;
          linked_id: string | null;
          linked_table: string | null;
          person_id: string | null;
          phone: string | null;
          status: string;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          body?: string | null;
          channel: string;
          created_at?: string;
          data?: Json;
          direction: string;
          firm_id?: string | null;
          id: string;
          linked_id?: string | null;
          linked_table?: string | null;
          person_id?: string | null;
          phone?: string | null;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string | null;
          channel?: string;
          created_at?: string;
          data?: Json;
          direction?: string;
          firm_id?: string | null;
          id?: string;
          linked_id?: string | null;
          linked_table?: string | null;
          person_id?: string | null;
          phone?: string | null;
          status?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "communication_logs_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crm_interactions: {
        Row: {
          body: string | null;
          branch_id: string;
          created_at: string;
          data: Json;
          id: string;
          opportunity_id: string | null;
          person_id: string | null;
          staff_email: string | null;
          title: string;
          type: string;
        };
        Insert: {
          body?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          id: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          staff_email?: string | null;
          title?: string;
          type?: string;
        };
        Update: {
          body?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          id?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          staff_email?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_crmint_opp";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "crm_leads_opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_crmint_person";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_leads_opportunities: {
        Row: {
          assigned_staff_email: string | null;
          branch_id: string;
          created_at: string;
          data: Json;
          estimated_value_paise: number;
          follow_up_date: string | null;
          id: string;
          last_contacted_at: string | null;
          lead_name: string;
          person_id: string | null;
          priority: string;
          remarks: string | null;
          stage: string;
          target_gold_mg: number;
          updated_at: string;
        };
        Insert: {
          assigned_staff_email?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          estimated_value_paise?: number;
          follow_up_date?: string | null;
          id: string;
          last_contacted_at?: string | null;
          lead_name?: string;
          person_id?: string | null;
          priority?: string;
          remarks?: string | null;
          stage?: string;
          target_gold_mg?: number;
          updated_at?: string;
        };
        Update: {
          assigned_staff_email?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          estimated_value_paise?: number;
          follow_up_date?: string | null;
          id?: string;
          last_contacted_at?: string | null;
          lead_name?: string;
          person_id?: string | null;
          priority?: string;
          remarks?: string | null;
          stage?: string;
          target_gold_mg?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_crmopp_person";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      crm_tasks_meetings: {
        Row: {
          assigned_staff_email: string | null;
          branch_id: string;
          created_at: string;
          data: Json;
          description: string | null;
          due_date: string | null;
          id: string;
          opportunity_id: string | null;
          person_id: string | null;
          priority: string;
          status: string;
          title: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          assigned_staff_email?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          description?: string | null;
          due_date?: string | null;
          id: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          priority?: string;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          assigned_staff_email?: string | null;
          branch_id?: string;
          created_at?: string;
          data?: Json;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          priority?: string;
          status?: string;
          title?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_crmtask_opp";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "crm_leads_opportunities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_crmtask_person";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
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
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
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
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      delivery_challans: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      document_sequences: {
        Row: {
          doc_type: string;
          firm_id: string;
          id: string;
          last_number: number;
          pad_length: number;
          prefix: string;
          updated_at: string;
        };
        Insert: {
          doc_type: string;
          firm_id: string;
          id?: string;
          last_number?: number;
          pad_length?: number;
          prefix?: string;
          updated_at?: string;
        };
        Update: {
          doc_type?: string;
          firm_id?: string;
          id?: string;
          last_number?: number;
          pad_length?: number;
          prefix?: string;
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
        };
        Relationships: [];
      };
      dropdown_masters: {
        Row: {
          active: boolean;
          created_at: string;
          firm_id: string | null;
          id: string;
          master_key: string;
          sort_order: number;
          updated_at: string;
          value: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          firm_id?: string | null;
          id: string;
          master_key: string;
          sort_order?: number;
          updated_at?: string;
          value: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          firm_id?: string | null;
          id?: string;
          master_key?: string;
          sort_order?: number;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      estimates: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          attendance: boolean;
          barcode: boolean;
          billing: boolean;
          crm: boolean;
          firm_id: string;
          gold_ledger: boolean;
          id: string;
          orders: boolean;
          payroll: boolean;
          repairs: boolean;
          reports: boolean;
          saas_panel: boolean;
          stock: boolean;
          updated_at: string;
          updated_by: string | null;
          whatsapp: boolean;
          workshop: boolean;
        };
        Insert: {
          attendance?: boolean;
          barcode?: boolean;
          billing?: boolean;
          crm?: boolean;
          firm_id: string;
          gold_ledger?: boolean;
          id?: string;
          orders?: boolean;
          payroll?: boolean;
          repairs?: boolean;
          reports?: boolean;
          saas_panel?: boolean;
          stock?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: boolean;
          workshop?: boolean;
        };
        Update: {
          attendance?: boolean;
          barcode?: boolean;
          billing?: boolean;
          crm?: boolean;
          firm_id?: string;
          gold_ledger?: boolean;
          id?: string;
          orders?: boolean;
          payroll?: boolean;
          repairs?: boolean;
          reports?: boolean;
          saas_panel?: boolean;
          stock?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          whatsapp?: boolean;
          workshop?: boolean;
        };
        Relationships: [];
      };
      financial_lock_periods: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gold_issue_register: {
        Row: {
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          fine_mg: number | null;
          firm_id: string;
          gross_mg: number;
          id: string;
          is_deleted: boolean;
          issue_no: string;
          issued_at: string;
          issued_by: string;
          notes: string | null;
          particular: string;
          purity_ppt: number | null;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fine_mg?: number | null;
          firm_id: string;
          gross_mg: number;
          id?: string;
          is_deleted?: boolean;
          issue_no: string;
          issued_at?: string;
          issued_by: string;
          notes?: string | null;
          particular: string;
          purity_ppt?: number | null;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fine_mg?: number | null;
          firm_id?: string;
          gross_mg?: number;
          id?: string;
          is_deleted?: boolean;
          issue_no?: string;
          issued_at?: string;
          issued_by?: string;
          notes?: string | null;
          particular?: string;
          purity_ppt?: number | null;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      gold_ledger: {
        Row: {
          bucket_deltas: Json;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          movement: string;
          net_fine_mg: number;
          note: string | null;
          reference: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          bucket_deltas?: Json;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          movement: string;
          net_fine_mg: number;
          note?: string | null;
          reference?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Update: {
          bucket_deltas?: Json;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          movement?: string;
          net_fine_mg?: number;
          note?: string | null;
          reference?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gold_receive_register: {
        Row: {
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          fine_mg: number | null;
          firm_id: string;
          gross_mg: number;
          id: string;
          is_deleted: boolean;
          notes: string | null;
          particular: string;
          purity_ppt: number | null;
          receive_no: string;
          received_at: string;
          received_by: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fine_mg?: number | null;
          firm_id: string;
          gross_mg: number;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          particular: string;
          purity_ppt?: number | null;
          receive_no: string;
          received_at?: string;
          received_by: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          fine_mg?: number | null;
          firm_id?: string;
          gross_mg?: number;
          id?: string;
          is_deleted?: boolean;
          notes?: string | null;
          particular?: string;
          purity_ppt?: number | null;
          receive_no?: string;
          received_at?: string;
          received_by?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      gold_settlements: {
        Row: {
          amount_paise: number | null;
          attachment_url: string | null;
          branch_id: string | null;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          gross_mg: number | null;
          id: string;
          is_deleted: boolean;
          net_mg: number | null;
          notes: string | null;
          party_id: string | null;
          party_type: string | null;
          payment_mode: string | null;
          purity: number | null;
          rate_per_gram_paise: number | null;
          settlement_date: string;
          settlement_type: string | null;
          updated_at: string;
          wastage_mg: number | null;
        };
        Insert: {
          amount_paise?: number | null;
          attachment_url?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          gross_mg?: number | null;
          id: string;
          is_deleted?: boolean;
          net_mg?: number | null;
          notes?: string | null;
          party_id?: string | null;
          party_type?: string | null;
          payment_mode?: string | null;
          purity?: number | null;
          rate_per_gram_paise?: number | null;
          settlement_date?: string;
          settlement_type?: string | null;
          updated_at?: string;
          wastage_mg?: number | null;
        };
        Update: {
          amount_paise?: number | null;
          attachment_url?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          gross_mg?: number | null;
          id?: string;
          is_deleted?: boolean;
          net_mg?: number | null;
          notes?: string | null;
          party_id?: string | null;
          party_type?: string | null;
          payment_mode?: string | null;
          purity?: number | null;
          rate_per_gram_paise?: number | null;
          settlement_date?: string;
          settlement_type?: string | null;
          updated_at?: string;
          wastage_mg?: number | null;
        };
        Relationships: [];
      };
      inventory: {
        Row: {
          barcode: string | null;
          category: string | null;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          gross_mg: number;
          huid: string | null;
          id: string;
          is_deleted: boolean;
          item_code: string | null;
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
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          gross_mg?: number;
          huid?: string | null;
          id: string;
          is_deleted?: boolean;
          item_code?: string | null;
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
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          gross_mg?: number;
          huid?: string | null;
          id?: string;
          is_deleted?: boolean;
          item_code?: string | null;
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
          branch_id: string | null;
          code: string;
          created_at: string;
          email: string;
          expires_at: string | null;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          workshop_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          code: string;
          created_at?: string;
          email: string;
          expires_at?: string | null;
          id: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          workshop_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          code?: string;
          created_at?: string;
          email?: string;
          expires_at?: string | null;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          workshop_id?: string | null;
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
            foreignKeyName: "invitations_workshop_id_fkey";
            columns: ["workshop_id"];
            isOneToOne: false;
            referencedRelation: "workshops";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          adjustment_paise: number;
          balance_paise: number;
          branch_id: string | null;
          cgst_paise: number;
          created_at: string;
          customer_id: string | null;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          grand_total_paise: number;
          gst: string;
          gst_paise: number;
          id: string;
          invoice_no: string;
          is_deleted: boolean;
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
          branch_id?: string | null;
          cgst_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          grand_total_paise?: number;
          gst: string;
          gst_paise?: number;
          id: string;
          invoice_no: string;
          is_deleted?: boolean;
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
          branch_id?: string | null;
          cgst_paise?: number;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          grand_total_paise?: number;
          gst?: string;
          gst_paise?: number;
          id?: string;
          invoice_no?: string;
          is_deleted?: boolean;
          order_id?: string | null;
          paid_paise?: number;
          sgst_paise?: number;
          status?: string;
          subtotal_paise?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
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
          branch_id: string | null;
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          job_no: string;
          karigar_id: string | null;
          order_id: string | null;
          status: string;
          template_key: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          job_no: string;
          karigar_id?: string | null;
          order_id?: string | null;
          status: string;
          template_key?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          job_no?: string;
          karigar_id?: string | null;
          order_id?: string | null;
          status?: string;
          template_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_cards_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
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

      kyc_documents: {
        Row: {
          created_at: string;
          data_url: string | null;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          kind: string;
          notes: string | null;
          person_id: string;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data_url?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          kind: string;
          notes?: string | null;
          person_id: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data_url?: string | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          kind?: string;
          notes?: string | null;
          person_id?: string;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "kyc_documents_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      login_history: {
        Row: {
          created_at: string;
          device_info: Json | null;
          event: string;
          firm_id: string | null;
          id: number;
          ip_address: unknown;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_info?: Json | null;
          event: string;
          firm_id?: string | null;
          id?: never;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_info?: Json | null;
          event?: string;
          firm_id?: string | null;
          id?: never;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      lot_batches: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      manufacturing_barcodes: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
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
            foreignKeyName: "fk_mfgbill_customer";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_mfgbill_jobcard";
            columns: ["job_card_id"];
            isOneToOne: false;
            referencedRelation: "job_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fk_mfgbill_order";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      material_vault_movements: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
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
      melt_jobs: {
        Row: {
          branch_id: string | null;
          created_at: string | null;
          data: Json;
          date: string | null;
          fine_gold_recovered_mg: number | null;
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
          id?: string;
          job_no?: string | null;
          loss_fine_mg?: number | null;
          status?: string | null;
          total_input_fine_mg?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      module_states: {
        Row: {
          branch_id: string;
          created_at: string | null;
          enabled: boolean;
          id: string;
          module_key: string;
          updated_at: string | null;
        };
        Insert: {
          branch_id: string;
          created_at?: string | null;
          enabled?: boolean;
          id: string;
          module_key: string;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string;
          created_at?: string | null;
          enabled?: boolean;
          id?: string;
          module_key?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      order_issues: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data: Json;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          expected_delivery: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
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
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          expected_delivery?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
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
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          expected_delivery?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
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
            foreignKeyName: "orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
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
      organizations: {
        Row: {
          address: string | null;
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
          phone: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
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
          phone?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
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
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      outside_work_payments: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      outside_work_transactions: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          order_id: string | null;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string | null;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
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
          branch_id: string | null;
          created_at: string;
          current_address: string | null;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          email: string | null;
          firm_id: string | null;
          full_name: string;
          gstin: string | null;
          id: string;
          is_deleted: boolean;
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
          branch_id?: string | null;
          created_at?: string;
          current_address?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          firm_id?: string | null;
          full_name: string;
          gstin?: string | null;
          id: string;
          is_deleted?: boolean;
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
          branch_id?: string | null;
          created_at?: string;
          current_address?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          email?: string | null;
          firm_id?: string | null;
          full_name?: string;
          gstin?: string | null;
          id?: string;
          is_deleted?: boolean;
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
        Relationships: [
          {
            foreignKeyName: "people_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      polishing_transactions: {
        Row: {
          created_at: string;
          data: Json;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data: Json;
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
      repairs: {
        Row: {
          advance_paise: number;
          branch_id: string | null;
          created_at: string;
          customer_id: string | null;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          estimated_charge_paise: number;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          kind: string;
          received_gross_mg: number;
          repair_no: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          advance_paise?: number;
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          estimated_charge_paise?: number;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          kind: string;
          received_gross_mg?: number;
          repair_no: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          advance_paise?: number;
          branch_id?: string | null;
          created_at?: string;
          customer_id?: string | null;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          estimated_charge_paise?: number;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          kind?: string;
          received_gross_mg?: number;
          repair_no?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "repairs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
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
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_filters: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
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
      stone_details: {
        Row: {
          created_at: string;
          data: Json | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          data?: Json | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          data?: Json | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          active: boolean;
          auth_id: string;
          avatar_url: string | null;
          branch_id: string | null;
          created_at: string;
          data: Json;
          department: string | null;
          firm_id: string | null;
          full_name: string;
          id: string;
          is_super_owner: boolean;
          last_login: string | null;
          permissions: Json;
          phone: string | null;
          reporting_manager_id: string | null;
          role: string | null;
          status: string;
          updated_at: string;
          workshop_id: string | null;
        };
        Insert: {
          active?: boolean;
          auth_id: string;
          avatar_url?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          department?: string | null;
          firm_id?: string | null;
          full_name: string;
          id?: string;
          is_super_owner?: boolean;
          last_login?: string | null;
          permissions?: Json;
          phone?: string | null;
          reporting_manager_id?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          workshop_id?: string | null;
        };
        Update: {
          active?: boolean;
          auth_id?: string;
          avatar_url?: string | null;
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          department?: string | null;
          firm_id?: string | null;
          full_name?: string;
          id?: string;
          is_super_owner?: boolean;
          last_login?: string | null;
          permissions?: Json;
          phone?: string | null;
          reporting_manager_id?: string | null;
          role?: string | null;
          status?: string;
          updated_at?: string;
          workshop_id?: string | null;
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
      whatsapp_templates: {
        Row: {
          active: boolean;
          body: string;
          created_at: string;
          data: Json;
          firm_id: string | null;
          id: string;
          key: string;
          label: string;
          placeholders: Json;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id: string;
          key: string;
          label: string;
          placeholders?: Json;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          created_at?: string;
          data?: Json;
          firm_id?: string | null;
          id?: string;
          key?: string;
          label?: string;
          placeholders?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      worker_returns: {
        Row: {
          branch_id: string | null;
          created_at: string;
          data: Json;
          id: string;
          order_id: string;
          updated_at: string;
          worker_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id: string;
          order_id: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          data?: Json;
          id?: string;
          order_id?: string;
          updated_at?: string;
          worker_id?: string | null;
        };
        Relationships: [];
      };
      worker_settlements: {
        Row: {
          created_at: string;
          data: Json;
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          id: string;
          is_deleted: boolean;
          period_from: string | null;
          period_to: string | null;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id: string;
          is_deleted?: boolean;
          period_from?: string | null;
          period_to?: string | null;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          id?: string;
          is_deleted?: boolean;
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
          deleted_at: string | null;
          deleted_by: string | null;
          firm_id: string | null;
          gold_mg: number;
          id: string;
          is_deleted: boolean;
          kind: string;
          ts: string;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          gold_mg?: number;
          id: string;
          is_deleted?: boolean;
          kind: string;
          ts?: string;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          amount_paise?: number;
          created_at?: string;
          data?: Json;
          deleted_at?: string | null;
          deleted_by?: string | null;
          firm_id?: string | null;
          gold_mg?: number;
          id?: string;
          is_deleted?: boolean;
          kind?: string;
          ts?: string;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      workshops: {
        Row: {
          active: boolean;
          branch_id: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          type: string;
        };
        Insert: {
          active?: boolean;
          branch_id?: string | null;
          created_at?: string;
          description?: string | null;
          id: string;
          name: string;
          type: string;
        };
        Update: {
          active?: boolean;
          branch_id?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workshops_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      worker_gold_balance: {
        Row: {
          balance_fine_mg: number | null;
          balance_mg: number | null;
          firm_id: string | null;
          total_issued_fine_mg: number | null;
          total_issued_mg: number | null;
          total_received_fine_mg: number | null;
          total_received_mg: number | null;
          worker_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      log_audit: {
        Args: {
          p_action: string;
          p_firm_id: string;
          p_new?: Json;
          p_old?: Json;
          p_record_id: string;
          p_table: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      my_firm_id: { Args: never; Returns: string };
      my_role: { Args: never; Returns: string };
      next_doc_number: {
        Args: { p_doc_type: string; p_firm_id: string };
        Returns: string;
      };
      next_document_number: {
        Args: { p_key: string; p_pad_length?: number; p_prefix?: string };
        Returns: string;
      };
      restore_deleted: {
        Args: { p_id: string; p_table: string };
        Returns: undefined;
      };
      soft_delete: {
        Args: { p_id: string; p_table: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "billing"
        | "vault"
        | "workshop"
        | "accountant"
        | "viewer"
        | "ceo"
        | "admin"
        | "saas_admin";
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
        "owner",
        "manager",
        "billing",
        "vault",
        "workshop",
        "accountant",
        "viewer",
        "ceo",
        "admin",
        "saas_admin",
      ],
    },
  },
} as const;
