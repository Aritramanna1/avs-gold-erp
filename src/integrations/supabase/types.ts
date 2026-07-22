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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      approval_requests: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          data: Json
          date: string
          firm_id: string | null
          hours: number | null
          id: string
          status: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          date: string
          firm_id?: string | null
          hours?: number | null
          id: string
          status: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          date?: string
          firm_id?: string | null
          hours?: number | null
          id?: string
          status?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      branch_settings: {
        Row: {
          address: string | null
          barcode_series: string | null
          branch_id: string
          data: Json
          default_karat: string | null
          email: string | null
          gold_rate_source: string | null
          gstin: string | null
          invoice_series: string | null
          invoice_template_id: string | null
          logo_storage_path: string | null
          logo_url: string | null
          phone: string | null
          receipt_series: string | null
          receipt_template_id: string | null
          smtp_from_email: string | null
          smtp_from_name: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: string | null
          smtp_user: string | null
          thermal_printer_ip: string | null
          thermal_printer_port: string | null
          updated_at: string
          wa_phone_number: string | null
        }
        Insert: {
          address?: string | null
          barcode_series?: string | null
          branch_id: string
          data?: Json
          default_karat?: string | null
          email?: string | null
          gold_rate_source?: string | null
          gstin?: string | null
          invoice_series?: string | null
          invoice_template_id?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          phone?: string | null
          receipt_series?: string | null
          receipt_template_id?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: string | null
          smtp_user?: string | null
          thermal_printer_ip?: string | null
          thermal_printer_port?: string | null
          updated_at?: string
          wa_phone_number?: string | null
        }
        Update: {
          address?: string | null
          barcode_series?: string | null
          branch_id?: string
          data?: Json
          default_karat?: string | null
          email?: string | null
          gold_rate_source?: string | null
          gstin?: string | null
          invoice_series?: string | null
          invoice_template_id?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          phone?: string | null
          receipt_series?: string | null
          receipt_template_id?: string | null
          smtp_from_email?: string | null
          smtp_from_name?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: string | null
          smtp_user?: string | null
          thermal_printer_ip?: string | null
          thermal_printer_port?: string | null
          updated_at?: string
          wa_phone_number?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          active: boolean
          address: string | null
          barcode_prefix: string | null
          branch_type: string | null
          city: string | null
          created_at: string
          data: Json
          email: string | null
          gstin: string | null
          id: string
          invoice_prefix: string | null
          logo_url: string | null
          name: string | null
          phone: string | null
          settings: Json
          short_name: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          barcode_prefix?: string | null
          branch_type?: string | null
          city?: string | null
          created_at?: string
          data?: Json
          email?: string | null
          gstin?: string | null
          id: string
          invoice_prefix?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          settings?: Json
          short_name?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          barcode_prefix?: string | null
          branch_type?: string | null
          city?: string | null
          created_at?: string
          data?: Json
          email?: string | null
          gstin?: string | null
          id?: string
          invoice_prefix?: string | null
          logo_url?: string | null
          name?: string | null
          phone?: string | null
          settings?: Json
          short_name?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_designs: {
        Row: {
          category: string | null
          created_at: string
          data: Json
          design_no: string | null
          firm_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data?: Json
          design_no?: string | null
          firm_id?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data?: Json
          design_no?: string | null
          firm_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      comm_provider_settings: {
        Row: {
          branch_id: string | null
          channel: string | null
          created_at: string
          data: Json
          id: string
          is_active: boolean
          priority: number
          provider_type: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          data?: Json
          id: string
          is_active?: boolean
          priority?: number
          provider_type?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          channel?: string | null
          created_at?: string
          data?: Json
          id?: string
          is_active?: boolean
          priority?: number
          provider_type?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comm_provider_settings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          body: string | null
          channel: string | null
          created_at: string
          data: Json
          direction: string | null
          id: string
          linked_id: string | null
          linked_table: string | null
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          channel?: string | null
          created_at?: string
          data?: Json
          direction?: string | null
          id: string
          linked_id?: string | null
          linked_table?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          channel?: string | null
          created_at?: string
          data?: Json
          direction?: string | null
          id?: string
          linked_id?: string | null
          linked_table?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_notes: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          data: Json
          id: string
          invoice_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id?: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_interactions: {
        Row: {
          body: string | null
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          opportunity_id: string | null
          person_id: string | null
          staff_email: string | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          opportunity_id?: string | null
          person_id?: string | null
          staff_email?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          opportunity_id?: string | null
          person_id?: string | null
          staff_email?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_leads_opportunities: {
        Row: {
          assigned_staff_email: string | null
          branch_id: string | null
          buyer_type: string
          created_at: string
          data: Json
          estimated_value_paise: number
          follow_up_date: string | null
          id: string
          last_contacted_at: string | null
          lead_name: string | null
          person_id: string | null
          priority: string | null
          remarks: string | null
          source: string
          stage: string | null
          target_gold_mg: number
          updated_at: string
        }
        Insert: {
          assigned_staff_email?: string | null
          branch_id?: string | null
          buyer_type?: string
          created_at?: string
          data?: Json
          estimated_value_paise?: number
          follow_up_date?: string | null
          id: string
          last_contacted_at?: string | null
          lead_name?: string | null
          person_id?: string | null
          priority?: string | null
          remarks?: string | null
          source?: string
          stage?: string | null
          target_gold_mg?: number
          updated_at?: string
        }
        Update: {
          assigned_staff_email?: string | null
          branch_id?: string | null
          buyer_type?: string
          created_at?: string
          data?: Json
          estimated_value_paise?: number
          follow_up_date?: string | null
          id?: string
          last_contacted_at?: string | null
          lead_name?: string | null
          person_id?: string | null
          priority?: string | null
          remarks?: string | null
          source?: string
          stage?: string | null
          target_gold_mg?: number
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks_meetings: {
        Row: {
          assigned_staff_email: string | null
          branch_id: string | null
          created_at: string
          data: Json
          description: string | null
          due_date: string | null
          id: string
          opportunity_id: string | null
          person_id: string | null
          priority: string | null
          status: string | null
          title: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          assigned_staff_email?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          description?: string | null
          due_date?: string | null
          id: string
          opportunity_id?: string | null
          person_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_staff_email?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          description?: string | null
          due_date?: string | null
          id?: string
          opportunity_id?: string | null
          person_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_ledger: {
        Row: {
          created_at: string
          credit_paise: number
          customer_id: string | null
          data: Json
          debit_paise: number
          description: string | null
          firm_id: string | null
          id: string
          kind: string
          ref: string | null
          ts: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_paise?: number
          customer_id?: string | null
          data?: Json
          debit_paise?: number
          description?: string | null
          firm_id?: string | null
          id: string
          kind: string
          ref?: string | null
          ts?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_paise?: number
          customer_id?: string | null
          data?: Json
          debit_paise?: number
          description?: string | null
          firm_id?: string | null
          id?: string
          kind?: string
          ref?: string | null
          ts?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_settlements: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      daily_close: {
        Row: {
          created_at: string
          data: Json
          date: string
          firm_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          date: string
          firm_id?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          date?: string
          firm_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      debit_notes: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          data: Json
          id: string
          invoice_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id?: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_challans: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          data: Json
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_sequences: {
        Row: {
          last_value: number
          prefix: string
          type: string
          updated_at: string
        }
        Insert: {
          last_value?: number
          prefix: string
          type: string
          updated_at?: string
        }
        Update: {
          last_value?: number
          prefix?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      dropdown_masters: {
        Row: {
          active: boolean
          created_at: string
          data: Json
          id: string
          master_key: string | null
          sort_order: number | null
          updated_at: string
          value: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          data?: Json
          id: string
          master_key?: string | null
          sort_order?: number | null
          updated_at?: string
          value?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          data?: Json
          id?: string
          master_key?: string | null
          sort_order?: number | null
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      erp_schema_meta: {
        Row: {
          applied_at: string
          deployment_model: string
          id: string
          metadata: Json
          product: string
          schema_version: number
        }
        Insert: {
          applied_at?: string
          deployment_model: string
          id: string
          metadata?: Json
          product: string
          schema_version: number
        }
        Update: {
          applied_at?: string
          deployment_model?: string
          id?: string
          metadata?: Json
          product?: string
          schema_version?: number
        }
        Relationships: []
      }
      erp_setup_guard: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          branch_id: string | null
          created_at: string
          customer_id: string | null
          data: Json
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          data?: Json
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_lock_periods: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          period: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          period?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          period?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gold_ledger: {
        Row: {
          bucket_deltas: Json
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          movement: string
          net_fine_mg: number
          note: string | null
          reference: string | null
          ts: string
          updated_at: string
        }
        Insert: {
          bucket_deltas?: Json
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          movement: string
          net_fine_mg: number
          note?: string | null
          reference?: string | null
          ts?: string
          updated_at?: string
        }
        Update: {
          bucket_deltas?: Json
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          movement?: string
          net_fine_mg?: number
          note?: string | null
          reference?: string | null
          ts?: string
          updated_at?: string
        }
        Relationships: []
      }
      gold_settlements: {
        Row: {
          amount_paise: number
          branch_id: string | null
          created_at: string
          data: Json
          firm_id: string | null
          gross_mg: number
          id: string
          net_mg: number
          notes: string | null
          party_id: string
          party_type: string
          payment_mode: string | null
          purity: number
          rate_per_gram_paise: number
          settlement_date: string
          settlement_type: string
          updated_at: string
          wastage_mg: number
        }
        Insert: {
          amount_paise?: number
          branch_id?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          gross_mg?: number
          id: string
          net_mg?: number
          notes?: string | null
          party_id: string
          party_type: string
          payment_mode?: string | null
          purity?: number
          rate_per_gram_paise?: number
          settlement_date?: string
          settlement_type: string
          updated_at?: string
          wastage_mg?: number
        }
        Update: {
          amount_paise?: number
          branch_id?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          gross_mg?: number
          id?: string
          net_mg?: number
          notes?: string | null
          party_id?: string
          party_type?: string
          payment_mode?: string | null
          purity?: number
          rate_per_gram_paise?: number
          settlement_date?: string
          settlement_type?: string
          updated_at?: string
          wastage_mg?: number
        }
        Relationships: []
      }
      hallmark_batches: {
        Row: {
          batch_number: string | null
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          data: Json
          firm_id: string | null
          gross_mg: number
          huid: string | null
          id: string
          item_code: string | null
          item_name: string
          location: string
          net_mg: number
          purity: number | null
          status: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          gross_mg?: number
          huid?: string | null
          id: string
          item_code?: string | null
          item_name: string
          location: string
          net_mg?: number
          purity?: number | null
          status: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          gross_mg?: number
          huid?: string | null
          id?: string
          item_code?: string | null
          item_name?: string
          location?: string
          net_mg?: number
          purity?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          adjustment_paise: number
          balance_paise: number
          cgst_paise: number
          created_at: string
          customer_id: string | null
          data: Json
          firm_id: string | null
          grand_total_paise: number
          gst: string
          gst_paise: number
          id: string
          invoice_no: string
          order_id: string | null
          paid_paise: number
          sgst_paise: number
          status: string
          subtotal_paise: number
          updated_at: string
        }
        Insert: {
          adjustment_paise?: number
          balance_paise?: number
          cgst_paise?: number
          created_at?: string
          customer_id?: string | null
          data?: Json
          firm_id?: string | null
          grand_total_paise?: number
          gst: string
          gst_paise?: number
          id: string
          invoice_no: string
          order_id?: string | null
          paid_paise?: number
          sgst_paise?: number
          status: string
          subtotal_paise?: number
          updated_at?: string
        }
        Update: {
          adjustment_paise?: number
          balance_paise?: number
          cgst_paise?: number
          created_at?: string
          customer_id?: string | null
          data?: Json
          firm_id?: string | null
          grand_total_paise?: number
          gst?: string
          gst_paise?: number
          id?: string
          invoice_no?: string
          order_id?: string | null
          paid_paise?: number
          sgst_paise?: number
          status?: string
          subtotal_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cards: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          job_no: string
          karigar_id: string | null
          order_id: string | null
          status: string
          template_key: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          job_no: string
          karigar_id?: string | null
          order_id?: string | null
          status: string
          template_key?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          job_no?: string
          karigar_id?: string | null
          order_id?: string | null
          status?: string
          template_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_cards_karigar_id_fkey"
            columns: ["karigar_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      licenses: {
        Row: {
          bound_device_id: string | null
          company_name: string | null
          created_at: string
          customer_name: string
          edition: string
          enabled_features: Json
          expiry: string | null
          expiry_date: string | null
          id: string
          issued_at: string
          license_id: string | null
          license_key_hash: string
          license_key_prefix: string
          maximum_devices: number
          offline_valid_days: number
          payload: string | null
          seats: number | null
          signature: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bound_device_id?: string | null
          company_name?: string | null
          created_at?: string
          customer_name: string
          edition: string
          enabled_features?: Json
          expiry?: string | null
          expiry_date?: string | null
          id?: string
          issued_at?: string
          license_id?: string | null
          license_key_hash: string
          license_key_prefix: string
          maximum_devices?: number
          offline_valid_days?: number
          payload?: string | null
          seats?: number | null
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bound_device_id?: string | null
          company_name?: string | null
          created_at?: string
          customer_name?: string
          edition?: string
          enabled_features?: Json
          expiry?: string | null
          expiry_date?: string | null
          id?: string
          issued_at?: string
          license_id?: string | null
          license_key_hash?: string
          license_key_prefix?: string
          maximum_devices?: number
          offline_valid_days?: number
          payload?: string | null
          seats?: number | null
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lot_batches: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      manufacturing_barcodes: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      manufacturing_bills: {
        Row: {
          actual_wastage_fine_mg: number | null
          actual_wastage_pct: number | null
          bhav_gold_mg: number | null
          bill_no: string | null
          branch_id: string | null
          cash_payment_paise: number | null
          category: string | null
          closing_balance_mg: number | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_invoice_id: string | null
          dust_fine_mg: number | null
          extra_data: Json
          filings_fine_mg: number | null
          filings_gross_mg: number | null
          filings_purity: number | null
          finalised_at: string | null
          finished_fine_mg: number | null
          finished_gross_mg: number | null
          finished_purity: number | null
          finished_stock_item_id: string | null
          gold_bhav_rate_paise: number | null
          gold_issue_slip_no: string | null
          gold_issued_fine_mg: number | null
          gold_issued_gross_mg: number | null
          gold_issued_purity: number | null
          hallmark_charges_paise: number | null
          id: string
          item_name: string | null
          job_card_id: string | null
          job_no: string | null
          karigar_id: string | null
          karigar_name: string | null
          labour_charges_paise: number | null
          making_charges_paise: number | null
          mp_entries: string | null
          net_mfg_cost_paise: number | null
          notes: string | null
          opening_balance_mg: number | null
          order_id: string | null
          order_no: string | null
          other_charges_paise: number | null
          p_entries: string | null
          pcs: number | null
          profit_margin_bps: number | null
          scrap_fine_mg: number | null
          scrap_gross_mg: number | null
          scrap_purity: number | null
          selling_price_paise: number | null
          status: string | null
          stone_charges_paise: number | null
          stone_setting_paise: number | null
          total_gold_issued_fine_mg: number | null
          total_gold_returned_fine_mg: number | null
          updated_at: string | null
        }
        Insert: {
          actual_wastage_fine_mg?: number | null
          actual_wastage_pct?: number | null
          bhav_gold_mg?: number | null
          bill_no?: string | null
          branch_id?: string | null
          cash_payment_paise?: number | null
          category?: string | null
          closing_balance_mg?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_invoice_id?: string | null
          dust_fine_mg?: number | null
          extra_data?: Json
          filings_fine_mg?: number | null
          filings_gross_mg?: number | null
          filings_purity?: number | null
          finalised_at?: string | null
          finished_fine_mg?: number | null
          finished_gross_mg?: number | null
          finished_purity?: number | null
          finished_stock_item_id?: string | null
          gold_bhav_rate_paise?: number | null
          gold_issue_slip_no?: string | null
          gold_issued_fine_mg?: number | null
          gold_issued_gross_mg?: number | null
          gold_issued_purity?: number | null
          hallmark_charges_paise?: number | null
          id: string
          item_name?: string | null
          job_card_id?: string | null
          job_no?: string | null
          karigar_id?: string | null
          karigar_name?: string | null
          labour_charges_paise?: number | null
          making_charges_paise?: number | null
          mp_entries?: string | null
          net_mfg_cost_paise?: number | null
          notes?: string | null
          opening_balance_mg?: number | null
          order_id?: string | null
          order_no?: string | null
          other_charges_paise?: number | null
          p_entries?: string | null
          pcs?: number | null
          profit_margin_bps?: number | null
          scrap_fine_mg?: number | null
          scrap_gross_mg?: number | null
          scrap_purity?: number | null
          selling_price_paise?: number | null
          status?: string | null
          stone_charges_paise?: number | null
          stone_setting_paise?: number | null
          total_gold_issued_fine_mg?: number | null
          total_gold_returned_fine_mg?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_wastage_fine_mg?: number | null
          actual_wastage_pct?: number | null
          bhav_gold_mg?: number | null
          bill_no?: string | null
          branch_id?: string | null
          cash_payment_paise?: number | null
          category?: string | null
          closing_balance_mg?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_invoice_id?: string | null
          dust_fine_mg?: number | null
          extra_data?: Json
          filings_fine_mg?: number | null
          filings_gross_mg?: number | null
          filings_purity?: number | null
          finalised_at?: string | null
          finished_fine_mg?: number | null
          finished_gross_mg?: number | null
          finished_purity?: number | null
          finished_stock_item_id?: string | null
          gold_bhav_rate_paise?: number | null
          gold_issue_slip_no?: string | null
          gold_issued_fine_mg?: number | null
          gold_issued_gross_mg?: number | null
          gold_issued_purity?: number | null
          hallmark_charges_paise?: number | null
          id?: string
          item_name?: string | null
          job_card_id?: string | null
          job_no?: string | null
          karigar_id?: string | null
          karigar_name?: string | null
          labour_charges_paise?: number | null
          making_charges_paise?: number | null
          mp_entries?: string | null
          net_mfg_cost_paise?: number | null
          notes?: string | null
          opening_balance_mg?: number | null
          order_id?: string | null
          order_no?: string | null
          other_charges_paise?: number | null
          p_entries?: string | null
          pcs?: number | null
          profit_margin_bps?: number | null
          scrap_fine_mg?: number | null
          scrap_gross_mg?: number | null
          scrap_purity?: number | null
          selling_price_paise?: number | null
          status?: string | null
          stone_charges_paise?: number | null
          stone_setting_paise?: number | null
          total_gold_issued_fine_mg?: number | null
          total_gold_returned_fine_mg?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      material_vault_movements: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      melt_jobs: {
        Row: {
          branch_id: string | null
          created_at: string | null
          data: Json
          date: string | null
          fine_gold_recovered_mg: number | null
          id: string
          job_no: string | null
          loss_fine_mg: number | null
          status: string | null
          total_input_fine_mg: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          fine_gold_recovered_mg?: number | null
          id: string
          job_no?: string | null
          loss_fine_mg?: number | null
          status?: string | null
          total_input_fine_mg?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          data?: Json
          date?: string | null
          fine_gold_recovered_mg?: number | null
          id?: string
          job_no?: string | null
          loss_fine_mg?: number | null
          status?: string | null
          total_input_fine_mg?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      module_states: {
        Row: {
          branch_id: string | null
          data: Json
          enabled: boolean
          id: string
          module_key: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          data?: Json
          enabled?: boolean
          id: string
          module_key?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          data?: Json
          enabled?: boolean
          id?: string
          module_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_issues: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string | null
          data: Json
          expected_delivery: string | null
          firm_id: string | null
          id: string
          karigar_id: string | null
          order_no: string
          priority: string
          source: string
          status: string
          type: string
          updated_at: string
          whatsapp_source_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          data?: Json
          expected_delivery?: string | null
          firm_id?: string | null
          id: string
          karigar_id?: string | null
          order_no: string
          priority?: string
          source?: string
          status: string
          type: string
          updated_at?: string
          whatsapp_source_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          data?: Json
          expected_delivery?: string | null
          firm_id?: string | null
          id?: string
          karigar_id?: string | null
          order_no?: string
          priority?: string
          source?: string
          status?: string
          type?: string
          updated_at?: string
          whatsapp_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_karigar_id_fkey"
            columns: ["karigar_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      outside_work_labour_charges: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      outside_work_payments: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      outside_work_transactions: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          invoice_id: string | null
          mode: string
          notes: string | null
          reference: string | null
          ts: string
          updated_at: string
        }
        Insert: {
          amount_paise?: number
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          invoice_id?: string | null
          mode: string
          notes?: string | null
          reference?: string | null
          ts?: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          invoice_id?: string | null
          mode?: string
          notes?: string | null
          reference?: string | null
          ts?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          aadhaar_masked: string | null
          active: boolean
          created_at: string
          current_address: string | null
          data: Json
          email: string | null
          firm_id: string | null
          full_name: string
          gstin: string | null
          id: string
          notes: string | null
          pan: string | null
          permanent_address: string | null
          phone: string | null
          salary_rule_id: string | null
          type: string
          updated_at: string
          village_city: string | null
          whatsapp: string | null
          work_type: string | null
        }
        Insert: {
          aadhaar_masked?: string | null
          active?: boolean
          created_at?: string
          current_address?: string | null
          data?: Json
          email?: string | null
          firm_id?: string | null
          full_name: string
          gstin?: string | null
          id: string
          notes?: string | null
          pan?: string | null
          permanent_address?: string | null
          phone?: string | null
          salary_rule_id?: string | null
          type: string
          updated_at?: string
          village_city?: string | null
          whatsapp?: string | null
          work_type?: string | null
        }
        Update: {
          aadhaar_masked?: string | null
          active?: boolean
          created_at?: string
          current_address?: string | null
          data?: Json
          email?: string | null
          firm_id?: string | null
          full_name?: string
          gstin?: string | null
          id?: string
          notes?: string | null
          pan?: string | null
          permanent_address?: string | null
          phone?: string | null
          salary_rule_id?: string | null
          type?: string
          updated_at?: string
          village_city?: string | null
          whatsapp?: string | null
          work_type?: string | null
        }
        Relationships: []
      }
      physical_stock_counts: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      polishing_transactions: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      print_logs: {
        Row: {
          created_at: string
          data: Json
          doc_number: string
          doc_type: string
          firm_id: string | null
          first_printed_at: string
          history: Json
          id: string
          last_printed_at: string
          linked_id: string | null
          linked_label: string | null
          printed_by: string | null
          reprint_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          doc_number: string
          doc_type: string
          firm_id?: string | null
          first_printed_at?: string
          history?: Json
          id: string
          last_printed_at?: string
          linked_id?: string | null
          linked_label?: string | null
          printed_by?: string | null
          reprint_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          doc_number?: string
          doc_type?: string
          firm_id?: string | null
          first_printed_at?: string
          history?: Json
          id?: string
          last_printed_at?: string
          linked_id?: string | null
          linked_label?: string | null
          printed_by?: string | null
          reprint_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_templates: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_cut_records: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          gold_rate_per_gram_paise: number
          id: string
          job_id: string | null
          karigar_id: string | null
          overloss_fine_mg: number
          penalty_paise: number
          rate_cut_no: string
          settlement_mode: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          gold_rate_per_gram_paise?: number
          id: string
          job_id?: string | null
          karigar_id?: string | null
          overloss_fine_mg?: number
          penalty_paise?: number
          rate_cut_no: string
          settlement_mode: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          gold_rate_per_gram_paise?: number
          id?: string
          job_id?: string | null
          karigar_id?: string | null
          overloss_fine_mg?: number
          penalty_paise?: number
          rate_cut_no?: string
          settlement_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_cut_records_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_cut_records_karigar_id_fkey"
            columns: ["karigar_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      repairs: {
        Row: {
          advance_paise: number
          created_at: string
          customer_id: string | null
          data: Json
          estimated_charge_paise: number
          firm_id: string | null
          id: string
          kind: string
          received_gross_mg: number
          repair_no: string
          status: string
          updated_at: string
        }
        Insert: {
          advance_paise?: number
          created_at?: string
          customer_id?: string | null
          data?: Json
          estimated_charge_paise?: number
          firm_id?: string | null
          id: string
          kind: string
          received_gross_mg?: number
          repair_no: string
          status: string
          updated_at?: string
        }
        Update: {
          advance_paise?: number
          created_at?: string
          customer_id?: string | null
          data?: Json
          estimated_charge_paise?: number
          firm_id?: string | null
          id?: string
          kind?: string
          received_gross_mg?: number
          repair_no?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repairs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_rules: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_filters: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_lots: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          lot_number: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          lot_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          lot_number?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          from_location: string | null
          id: string
          item_id: string | null
          kind: string
          note: string | null
          to_location: string | null
          ts: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          from_location?: string | null
          id: string
          item_id?: string | null
          kind: string
          note?: string | null
          to_location?: string | null
          ts?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          from_location?: string | null
          id?: string
          item_id?: string | null
          kind?: string
          note?: string | null
          to_location?: string | null
          ts?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_stones: {
        Row: {
          branch_id: string | null
          certificate_number: string | null
          created_at: string
          data: Json
          id: string
          item_id: string | null
          stone_type: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          certificate_number?: string | null
          created_at?: string
          data?: Json
          id: string
          item_id?: string | null
          stone_type?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          certificate_number?: string | null
          created_at?: string
          data?: Json
          id?: string
          item_id?: string | null
          stone_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stone_details: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_inbox: {
        Row: {
          converted_order_id: string | null
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          linked_person_id: string | null
          notes: string | null
          parsed: Json | null
          raw_text: string
          sender_name: string | null
          sender_phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          converted_order_id?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          linked_person_id?: string | null
          notes?: string | null
          parsed?: Json | null
          raw_text: string
          sender_name?: string | null
          sender_phone?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          converted_order_id?: string | null
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          linked_person_id?: string | null
          notes?: string | null
          parsed?: Json | null
          raw_text?: string
          sender_name?: string | null
          sender_phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_linked_person_id_fkey"
            columns: ["linked_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_returns: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          order_id: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          order_id: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          order_id?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      worker_settlements: {
        Row: {
          created_at: string
          data: Json
          firm_id: string | null
          id: string
          period_from: string | null
          period_to: string | null
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id: string
          period_from?: string | null
          period_to?: string | null
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          firm_id?: string | null
          id?: string
          period_from?: string | null
          period_to?: string | null
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      worker_transactions: {
        Row: {
          amount_paise: number
          created_at: string
          data: Json
          firm_id: string | null
          gold_mg: number
          id: string
          kind: string
          ts: string
          updated_at: string
          worker_id: string
        }
        Insert: {
          amount_paise?: number
          created_at?: string
          data?: Json
          firm_id?: string | null
          gold_mg?: number
          id: string
          kind: string
          ts?: string
          updated_at?: string
          worker_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          data?: Json
          firm_id?: string | null
          gold_mg?: number
          id?: string
          kind?: string
          ts?: string
          updated_at?: string
          worker_id?: string
        }
        Relationships: []
      }
      workshops: {
        Row: {
          branch_id: string | null
          created_at: string
          data: Json
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshops_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_gold_transaction: {
        Args: {
          p_actor_email: string
          p_actor_id: string
          p_branch_id: string
          p_category: string
          p_delta_mg: number
          p_gross_mg: number
          p_ledger_movement: string
          p_movement_type: string
          p_notes: string
          p_purity: number
          p_reference: string
          p_worker_entry?: Json
          p_worker_id?: string
        }
        Returns: Json
      }
      generate_sequential_number: {
        Args: { p_prefix: string; p_type: string }
        Returns: string
      }
      issue_license: {
        Args: {
          p_customer_name: string
          p_edition: string
          p_license_key: string
          p_maximum_devices?: number
          p_months?: number
        }
        Returns: string
      }
      validate_license: {
        Args: {
          p_deployment_mode: string
          p_device_id: string
          p_license_key: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
