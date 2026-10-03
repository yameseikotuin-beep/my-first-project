// データベースの型定義（supabase/migrations の内容に合わせて手で書いたもの）。
// Supabase CLI が使える環境では `supabase gen types typescript` の出力に置き換えてよい。

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'user' | 'staff' | 'admin';
export type PhotoAngle = 'front' | 'left' | 'right';
export type ConsentKind = 'photo_capture' | 'photo_storage' | 'ai_processing';
export type ConsentMethod = 'self_app' | 'salon_tablet';

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Insert, Update = Partial<Insert>, Rel extends Relationship[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Rel;
};

export type ProfileRow = {
  id: string;
  role: AppRole;
  display_name: string;
  is_active: boolean;
  adult_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  full_name: string;
  full_name_kana: string;
  phone: string;
  email: string;
  birth_year: number | null;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerAssignmentRow = {
  staff_id: string;
  customer_id: string;
  granted_by: string | null;
  granted_at: string;
};

export type ConsentDocumentRow = {
  id: string;
  kind: ConsentKind;
  version: string;
  title: string;
  body: string;
  published_at: string;
};

export type ConsentRow = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  document_id: string;
  kind: ConsentKind;
  method: ConsentMethod;
  recorded_by: string | null;
  granted_at: string;
  revoked_at: string | null;
};

export type PhotoSessionRow = {
  id: string;
  user_id: string | null;
  customer_id: string | null;
  captured_by: string | null;
  created_at: string;
};

export type PhotoRow = {
  id: string;
  session_id: string;
  angle: PhotoAngle;
  storage_path: string;
  width: number;
  height: number;
  quality: Json;
  quality_passed: boolean;
  device_class: 'phone' | 'tablet' | 'desktop';
  created_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_role: AppRole | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      // role・is_active の更新は管理用クライアント（service_role）だけが可能（列の権限で制限）
      profiles: Table<
        ProfileRow,
        Pick<ProfileRow, 'id'> & Partial<ProfileRow>,
        { display_name?: string; role?: AppRole; is_active?: boolean }
      >;
      customers: Table<
        CustomerRow,
        Pick<CustomerRow, 'full_name'> & Partial<CustomerRow>,
        Partial<Pick<CustomerRow, 'full_name' | 'full_name_kana' | 'phone' | 'email' | 'birth_year' | 'notes'>>
      >;
      customer_assignments: Table<
        CustomerAssignmentRow,
        Pick<CustomerAssignmentRow, 'staff_id' | 'customer_id'> & Partial<CustomerAssignmentRow>,
        never,
        [
          {
            foreignKeyName: 'customer_assignments_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_assignments_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ]
      >;
      consent_documents: Table<ConsentDocumentRow, ConsentDocumentRow, never>;
      consents: Table<
        ConsentRow,
        Pick<ConsentRow, 'document_id' | 'kind' | 'method'> & Partial<ConsentRow>,
        { revoked_at?: string }
      >;
      photo_sessions: Table<
        PhotoSessionRow,
        Partial<PhotoSessionRow>,
        never,
        [
          {
            foreignKeyName: 'photo_sessions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ]
      >;
      photos: Table<
        PhotoRow,
        Omit<PhotoRow, 'created_at' | 'quality'> & { quality?: Json; created_at?: string },
        never,
        [
          {
            foreignKeyName: 'photos_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'photo_sessions';
            referencedColumns: ['id'];
          },
        ]
      >;
      audit_logs: Table<AuditLogRow, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      app_current_role: { Args: Record<string, never>; Returns: AppRole | null };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_staff_or_admin: { Args: Record<string, never>; Returns: boolean };
      can_access_customer: { Args: { target: string }; Returns: boolean };
      write_audit_log: {
        Args: { p_action: string; p_target_type?: string; p_target_id?: string; p_metadata?: Json };
        Returns: undefined;
      };
      create_customer: {
        Args: {
          p_full_name: string;
          p_full_name_kana?: string;
          p_phone?: string;
          p_email?: string;
          p_birth_year?: number | null;
          p_notes?: string;
        };
        Returns: string;
      };
      admin_update_member: {
        Args: { p_target: string; p_role: AppRole; p_is_active: boolean };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      photo_angle: PhotoAngle;
      consent_kind: ConsentKind;
      consent_method: ConsentMethod;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
