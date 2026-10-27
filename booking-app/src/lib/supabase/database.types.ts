// データベースの型定義（supabase/migrations の内容に合わせて手で書いたもの）。
// Supabase CLI が使える環境では `supabase gen types typescript` の出力に置き換えてよい。

export type BookingStatus = 'confirmed' | 'cancelled';
export type BookingSource = 'web' | 'admin';

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type AppSettingsRow = {
  id: number;
  shop_name: string;
  shop_phone: string;
  slot_interval_minutes: number;
  booking_window_days: number;
  min_lead_minutes: number;
  max_active_bookings_per_phone: number;
  use_practitioners: boolean;
  updated_at: string;
};

export type ServiceRow = {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RoomRow = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type RoomHourRow = { id: string; room_id: string; weekday: number; start_time: string; end_time: string };
export type ServiceRoomRow = { service_id: string; room_id: string };

export type PractitionerRow = RoomRow;
export type PractitionerServiceRow = { practitioner_id: string; service_id: string };
export type PractitionerShiftRow = {
  id: string;
  practitioner_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};
export type PractitionerDayOffRow = { practitioner_id: string; off_date: string; note: string };

export type BusinessHourRow = {
  weekday: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  last_start_time: string | null;
};

export type DateOverrideRow = {
  business_date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  last_start_time: string | null;
  note: string;
};

export type BreakRow = {
  id: string;
  weekday: number | null;
  break_date: string | null;
  start_time: string;
  end_time: string;
  label: string;
};

export type BookingRow = {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  service_id: string;
  service_name: string;
  price: number;
  start_at: string;
  end_at: string;
  room_id: string;
  practitioner_id: string | null;
  status: BookingStatus;
  source: BookingSource;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminBookingListRow = BookingRow & { room_name: string; practitioner_name: string | null };

export type SlotRow = { start_at: string; end_at: string };
export type PublicServiceRow = Pick<ServiceRow, 'id' | 'name' | 'description' | 'duration_minutes' | 'price'>;
export type PublicInfoRow = {
  shop_name: string;
  shop_phone: string;
  booking_window_days: number;
  min_lead_minutes: number;
  today: string;
};
export type CreatedBookingRow = {
  booking_number: string;
  service_name: string;
  price: number;
  start_at: string;
  end_at: string;
};

type Opt<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Database = {
  public: {
    Tables: {
      app_settings: Table<AppSettingsRow, Partial<AppSettingsRow>>;
      services: Table<ServiceRow, Opt<ServiceRow, 'id' | 'description' | 'is_active' | 'sort_order' | 'created_at' | 'updated_at'>>;
      rooms: Table<RoomRow, Opt<RoomRow, 'id' | 'is_active' | 'sort_order' | 'created_at' | 'updated_at'>>;
      room_hours: Table<RoomHourRow, Opt<RoomHourRow, 'id'>>;
      service_rooms: Table<ServiceRoomRow, ServiceRoomRow>;
      practitioners: Table<PractitionerRow, Opt<PractitionerRow, 'id' | 'is_active' | 'sort_order' | 'created_at' | 'updated_at'>>;
      practitioner_services: Table<PractitionerServiceRow, PractitionerServiceRow>;
      practitioner_shifts: Table<PractitionerShiftRow, Opt<PractitionerShiftRow, 'id'>>;
      practitioner_days_off: Table<PractitionerDayOffRow, Opt<PractitionerDayOffRow, 'note'>>;
      business_hours: Table<BusinessHourRow, BusinessHourRow>;
      business_date_overrides: Table<DateOverrideRow, Opt<DateOverrideRow, 'note' | 'open_time' | 'close_time' | 'last_start_time'>>;
      breaks: Table<BreakRow, Opt<BreakRow, 'id' | 'label' | 'weekday' | 'break_date'>>;
      bookings: Table<BookingRow, never, never>;
    };
    Views: {
      admin_booking_list: { Row: AdminBookingListRow; Relationships: [] };
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      get_public_info: { Args: Record<string, never>; Returns: PublicInfoRow[] };
      get_public_services: { Args: Record<string, never>; Returns: PublicServiceRow[] };
      get_public_open_days: { Args: { p_from: string; p_to: string }; Returns: { day: string; is_open: boolean }[] };
      get_available_slots: { Args: { p_service_id: string; p_date: string }; Returns: SlotRow[] };
      create_booking: {
        Args: {
          p_service_id: string;
          p_start_at: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_notes?: string;
        };
        Returns: CreatedBookingRow[];
      };
      admin_available_slots: {
        Args: { p_service_id: string; p_date: string; p_exclude_booking?: string | null };
        Returns: SlotRow[];
      };
      admin_save_booking: {
        Args: {
          p_booking_id: string | null;
          p_service_id: string;
          p_start_at: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_notes: string;
          p_room_id?: string | null;
          p_practitioner_id?: string | null;
          p_status?: BookingStatus;
        };
        Returns: string;
      };
      admin_cancel_booking: { Args: { p_booking_id: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
