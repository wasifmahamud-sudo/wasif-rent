export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          role: 'admin' | 'tenant'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          role?: 'admin' | 'tenant'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          role?: 'admin' | 'tenant'
          updated_at?: string
        }
      }
      houses: {
        Row: {
          id: string
          name: string
          address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          address?: string | null
        }
      }
      rooms: {
        Row: {
          id: string
          house_id: string
          room_number: string
          floor: string | null
          monthly_rent: number
          status: 'occupied' | 'vacant' | 'maintenance'
          created_at: string
        }
        Insert: {
          id?: string
          house_id: string
          room_number: string
          floor?: string | null
          monthly_rent?: number
          status?: 'occupied' | 'vacant' | 'maintenance'
          created_at?: string
        }
        Update: {
          house_id?: string
          room_number?: string
          floor?: string | null
          monthly_rent?: number
          status?: 'occupied' | 'vacant' | 'maintenance'
        }
      }
      tenants: {
        Row: {
          id: string
          user_id: string | null
          room_id: string | null
          full_name: string
          phone: string | null
          move_in_date: string | null
          active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          room_id?: string | null
          full_name: string
          phone?: string | null
          move_in_date?: string | null
          active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string | null
          room_id?: string | null
          full_name?: string
          phone?: string | null
          move_in_date?: string | null
          active?: boolean
          notes?: string | null
          updated_at?: string
        }
      }
      electricity_rates: {
        Row: {
          id: string
          rate_per_unit: number
          effective_from: string
          active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          rate_per_unit: number
          effective_from?: string
          active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          rate_per_unit?: number
          effective_from?: string
          active?: boolean
          created_by?: string | null
        }
      }
      meter_readings: {
        Row: {
          id: string
          room_id: string
          billing_month: string
          previous_reading: number
          current_reading: number
          units_used: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          room_id: string
          billing_month: string
          previous_reading?: number
          current_reading?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          previous_reading?: number
          current_reading?: number
          created_by?: string | null
        }
      }
      bills: {
        Row: {
          id: string
          tenant_id: string
          room_id: string
          billing_month: string
          rent_amount: number
          electricity_units: number
          electricity_rate: number
          electricity_amount: number
          previous_due: number
          other_charge: number
          discount: number
          total_bill: number
          amount_paid: number
          remaining_due: number
          status: 'unpaid' | 'partial' | 'paid' | 'overpaid'
          notes: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          room_id: string
          billing_month: string
          rent_amount?: number
          electricity_units?: number
          electricity_rate?: number
          electricity_amount?: number
          previous_due?: number
          other_charge?: number
          discount?: number
          total_bill?: number
          amount_paid?: number
          remaining_due?: number
          status?: 'unpaid' | 'partial' | 'paid' | 'overpaid'
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          rent_amount?: number
          electricity_units?: number
          electricity_rate?: number
          previous_due?: number
          other_charge?: number
          discount?: number
          amount_paid?: number
          notes?: string | null
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          tenant_id: string
          bill_id: string | null
          amount: number
          payment_date: string
          payment_method: 'Cash' | 'bKash' | 'Nagad' | 'Bank' | 'Other'
          transaction_reference: string | null
          note: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          bill_id?: string | null
          amount: number
          payment_date?: string
          payment_method?: 'Cash' | 'bKash' | 'Nagad' | 'Bank' | 'Other'
          transaction_reference?: string | null
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          amount?: number
          payment_date?: string
          payment_method?: 'Cash' | 'bKash' | 'Nagad' | 'Bank' | 'Other'
          transaction_reference?: string | null
          note?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          table_name: string
          record_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          table_name: string
          record_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: never
      }
      settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type House = Database['public']['Tables']['houses']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type Tenant = Database['public']['Tables']['tenants']['Row']
export type Bill = Database['public']['Tables']['bills']['Row']
export type Payment = Database['public']['Tables']['payments']['Row']
export type MeterReading = Database['public']['Tables']['meter_readings']['Row']
export type ElectricityRate = Database['public']['Tables']['electricity_rates']['Row']
