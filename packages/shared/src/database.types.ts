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
      businesses: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          report_cutoff_time: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          report_cutoff_time?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          report_cutoff_time?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      business_memberships: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'employee';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'employee';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: 'owner' | 'employee';
          is_active?: boolean;
          created_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          code: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          code: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          code?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shop_memberships: {
        Row: {
          id: string;
          shop_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          sku: string;
          category: string;
          description: string | null;
          unit_of_measure: string;
          min_stock_threshold: number;
          unit_price: number;
          cost_price: number | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          sku: string;
          category: string;
          description?: string | null;
          unit_of_measure?: string;
          min_stock_threshold?: number;
          unit_price?: number;
          cost_price?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          sku?: string;
          category?: string;
          description?: string | null;
          unit_of_measure?: string;
          min_stock_threshold?: number;
          unit_price?: number;
          cost_price?: number | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      deliveries: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          delivery_date: string;
          delivery_number: string | null;
          status: 'pending' | 'delivered' | 'cancelled';
          total_amount: number;
          amount_paid: number;
          outstanding_amount: number;
          payment_status: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          delivery_date: string;
          delivery_number?: string | null;
          status?: 'pending' | 'delivered' | 'cancelled';
          total_amount?: number;
          amount_paid?: number;
          payment_status?: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          delivery_date?: string;
          delivery_number?: string | null;
          status?: 'pending' | 'delivered' | 'cancelled';
          total_amount?: number;
          amount_paid?: number;
          payment_status?: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      delivery_items: {
        Row: {
          id: string;
          delivery_id: string;
          product_id: string;
          quantity: number;
          unit_cost: number | null;
          unit_price: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          product_id: string;
          quantity: number;
          unit_cost?: number | null;
          unit_price?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          delivery_id?: string;
          product_id?: string;
          quantity?: number;
          unit_cost?: number | null;
          unit_price?: number | null;
          notes?: string | null;
        };
      };
      daily_reports: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          report_date: string;
          is_zero_sales: boolean;
          status: 'submitted' | 'approved' | 'rejected';
          notes: string | null;
          submitted_by: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          report_date: string;
          is_zero_sales?: boolean;
          status?: 'submitted' | 'approved' | 'rejected';
          notes?: string | null;
          submitted_by: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          report_date?: string;
          is_zero_sales?: boolean;
          status?: 'submitted' | 'approved' | 'rejected';
          notes?: string | null;
          submitted_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      daily_report_items: {
        Row: {
          id: string;
          report_id: string;
          product_id: string;
          quantity_sold: number;
          unit_price: number | null;
          unit_cost: number | null;
          physical_count: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          report_id: string;
          product_id: string;
          quantity_sold: number;
          unit_price?: number | null;
          unit_cost?: number | null;
          physical_count?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          report_id?: string;
          product_id?: string;
          quantity_sold?: number;
          unit_price?: number | null;
          unit_cost?: number | null;
          physical_count?: number | null;
          notes?: string | null;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          movement_type: string;
          quantity: number;
          reference_id: string | null;
          is_provisional: boolean;
          reason: string;
          actor_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          movement_type: string;
          quantity: number;
          reference_id?: string | null;
          is_provisional?: boolean;
          reason: string;
          actor_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          product_id?: string;
          movement_type?: string;
          quantity?: number;
          reference_id?: string | null;
          is_provisional?: boolean;
          reason?: string;
          actor_id?: string;
          created_at?: string;
        };
      };
      stock_counts: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          counted_quantity: number;
          expected_quantity: number;
          variance: number;
          counted_by: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          counted_quantity: number;
          expected_quantity: number;
          counted_by: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          product_id?: string;
          counted_quantity?: number;
          expected_quantity?: number;
          counted_by?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      stock_transfers: {
        Row: {
          id: string;
          business_id: string;
          from_shop_id: string;
          to_shop_id: string;
          product_id: string;
          quantity: number;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          from_shop_id: string;
          to_shop_id: string;
          product_id: string;
          quantity: number;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          from_shop_id?: string;
          to_shop_id?: string;
          product_id?: string;
          quantity?: number;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      stock_adjustments: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          adjustment_quantity: number;
          reason: string;
          notes: string | null;
          authorized_by: string;
          stock_count_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          product_id: string;
          adjustment_quantity: number;
          reason: string;
          notes?: string | null;
          authorized_by: string;
          stock_count_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          product_id?: string;
          adjustment_quantity?: number;
          reason?: string;
          notes?: string | null;
          authorized_by?: string;
          stock_count_id?: string | null;
          created_at?: string;
        };
      };
      invoices: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          delivery_id: string | null;
          invoice_number: string;
          invoice_date: string;
          total_amount: number;
          amount_paid: number;
          outstanding_amount: number;
          status: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          delivery_id?: string | null;
          invoice_number: string;
          invoice_date: string;
          total_amount: number;
          amount_paid?: number;
          status?: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          delivery_id?: string | null;
          invoice_number?: string;
          invoice_date?: string;
          total_amount?: number;
          amount_paid?: number;
          status?: 'unpaid' | 'partially_paid' | 'fully_paid';
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          shop_id: string;
          invoice_id: string | null;
          delivery_id: string | null;
          payment_date: string;
          amount: number;
          payment_method: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
          payment_reference: string | null;
          status: 'COMPLETED' | 'REVERSED' | 'REFUNDED';
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          shop_id: string;
          invoice_id?: string | null;
          delivery_id?: string | null;
          payment_date: string;
          amount: number;
          payment_method?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
          payment_reference?: string | null;
          status?: 'COMPLETED' | 'REVERSED' | 'REFUNDED';
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          shop_id?: string;
          invoice_id?: string | null;
          delivery_id?: string | null;
          payment_date?: string;
          amount?: number;
          payment_method?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
          payment_reference?: string | null;
          status?: 'COMPLETED' | 'REVERSED' | 'REFUNDED';
          notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          business_id: string;
          actor_id: string;
          action: string;
          target_entity: string;
          target_id: string;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          actor_id: string;
          action: string;
          target_entity: string;
          target_id: string;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          actor_id?: string;
          action?: string;
          target_entity?: string;
          target_id?: string;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
      idempotency_records: {
        Row: {
          id: string;
          business_id: string;
          idempotency_key: string;
          endpoint: string;
          response_code: number;
          response_body: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          idempotency_key: string;
          endpoint: string;
          response_code: number;
          response_body: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          idempotency_key?: string;
          endpoint?: string;
          response_code?: number;
          response_body?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      v_shop_inventory_balances: {
        Row: {
          shop_id: string;
          shop_name: string;
          shop_code: string;
          product_id: string;
          product_name: string;
          product_sku: string;
          category: string;
          min_stock_threshold: number;
          total_delivered: number;
          confirmed_sold: number;
          provisional_sold: number;
          total_transferred_in: number;
          total_transferred_out: number;
          total_returned: number;
          total_damaged: number;
          expected_stock: number;
        };
      };
      v_shop_payment_balances: {
        Row: {
          shop_id: string;
          shop_name: string;
          shop_code: string;
          total_invoiced: number;
          total_paid: number;
          outstanding_balance: number;
          status: 'unpaid' | 'partially_paid' | 'fully_paid';
          badge_color: 'green' | 'yellow' | 'grey';
          last_payment_date: string | null;
          payment_count: number;
        };
      };
    };
    Functions: {
      calculate_shop_stock: {
        Args: { target_shop_id: string; target_product_id: string };
        Returns: number;
      };
      get_auth_business_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_business_owner: {
        Args: { target_business_id: string };
        Returns: boolean;
      };
      is_assigned_to_shop: {
        Args: { target_shop_id: string };
        Returns: boolean;
      };
    };
  };
}
