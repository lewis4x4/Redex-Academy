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
  academy: {
    Tables: {
      assessment_items: {
        Row: {
          answer_key: Json | null
          competency_id: string
          course_version_id: string
          created_at: string
          difficulty: string | null
          id: string
          is_safety_item: boolean
          kind: Database["academy"]["Enums"]["assessment_kind"]
          locale_variants: Json
          mastery_weight: number
          options: Json | null
          prompt: Json
          updated_at: string
        }
        Insert: {
          answer_key?: Json | null
          competency_id: string
          course_version_id: string
          created_at?: string
          difficulty?: string | null
          id?: string
          is_safety_item?: boolean
          kind: Database["academy"]["Enums"]["assessment_kind"]
          locale_variants?: Json
          mastery_weight?: number
          options?: Json | null
          prompt: Json
          updated_at?: string
        }
        Update: {
          answer_key?: Json | null
          competency_id?: string
          course_version_id?: string
          created_at?: string
          difficulty?: string | null
          id?: string
          is_safety_item?: boolean
          kind?: Database["academy"]["Enums"]["assessment_kind"]
          locale_variants?: Json
          mastery_weight?: number
          options?: Json | null
          prompt?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_course_version_id_fkey"
            columns: ["course_version_id"]
            isOneToOne: false
            referencedRelation: "course_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          ai_grade_meta: Json | null
          assessment_item_id: string
          attempt: number
          client_event_uuid: string
          created_at: string
          enrollment_id: string | null
          graded_by: Database["academy"]["Enums"]["graded_by"] | null
          id: string
          org_id: string
          response: Json
          score: number | null
          ts: string
          user_id: string
        }
        Insert: {
          ai_grade_meta?: Json | null
          assessment_item_id: string
          attempt?: number
          client_event_uuid: string
          created_at?: string
          enrollment_id?: string | null
          graded_by?: Database["academy"]["Enums"]["graded_by"] | null
          id?: string
          org_id: string
          response: Json
          score?: number | null
          ts?: string
          user_id: string
        }
        Update: {
          ai_grade_meta?: Json | null
          assessment_item_id?: string
          attempt?: number
          client_event_uuid?: string
          created_at?: string
          enrollment_id?: string | null
          graded_by?: Database["academy"]["Enums"]["graded_by"] | null
          id?: string
          org_id?: string
          response?: Json
          score?: number | null
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_item_id_fkey"
            columns: ["assessment_item_id"]
            isOneToOne: false
            referencedRelation: "assessment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: Database["academy"]["Enums"]["audit_action"]
          actor_user_id: string | null
          created_at: string
          detail: Json
          id: string
          org_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: Database["academy"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: Database["academy"]["Enums"]["audit_action"]
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          org_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      badge_classes: {
        Row: {
          alignment: Json
          created_at: string
          criteria_url: string | null
          description: string | null
          id: string
          image_r2_key: string | null
          is_compliance: boolean
          key: string
          kind: Database["academy"]["Enums"]["badge_kind"]
          recert_months: number | null
          requires: Json
          title: string
          updated_at: string
        }
        Insert: {
          alignment?: Json
          created_at?: string
          criteria_url?: string | null
          description?: string | null
          id?: string
          image_r2_key?: string | null
          is_compliance?: boolean
          key: string
          kind: Database["academy"]["Enums"]["badge_kind"]
          recert_months?: number | null
          requires?: Json
          title: string
          updated_at?: string
        }
        Update: {
          alignment?: Json
          created_at?: string
          criteria_url?: string | null
          description?: string | null
          id?: string
          image_r2_key?: string | null
          is_compliance?: boolean
          key?: string
          kind?: Database["academy"]["Enums"]["badge_kind"]
          recert_months?: number | null
          requires?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      competencies: {
        Row: {
          code: string
          created_at: string
          description: string | null
          domain: Database["academy"]["Enums"]["domain"]
          id: string
          is_safety_critical: boolean
          mastery_threshold: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          domain: Database["academy"]["Enums"]["domain"]
          id?: string
          is_safety_critical?: boolean
          mastery_threshold?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          domain?: Database["academy"]["Enums"]["domain"]
          id?: string
          is_safety_critical?: boolean
          mastery_threshold?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      competency_state: {
        Row: {
          competency_id: string
          created_at: string
          id: string
          last_event_at: string | null
          org_id: string
          source: Database["academy"]["Enums"]["competency_source"]
          status: Database["academy"]["Enums"]["competency_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          competency_id: string
          created_at?: string
          id?: string
          last_event_at?: string | null
          org_id: string
          source?: Database["academy"]["Enums"]["competency_source"]
          status?: Database["academy"]["Enums"]["competency_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          competency_id?: string
          created_at?: string
          id?: string
          last_event_at?: string | null
          org_id?: string
          source?: Database["academy"]["Enums"]["competency_source"]
          status?: Database["academy"]["Enums"]["competency_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competency_state_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_state_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_platform_dependencies: {
        Row: {
          course_id: string
          max_version: string | null
          min_version: string | null
          platform_key: string
        }
        Insert: {
          course_id: string
          max_version?: string | null
          min_version?: string | null
          platform_key: string
        }
        Update: {
          course_id?: string
          max_version?: string | null
          min_version?: string | null
          platform_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_platform_dependencies_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_prerequisites: {
        Row: {
          course_id: string
          kind: Database["academy"]["Enums"]["prereq_kind"]
          requires_course_id: string
        }
        Insert: {
          course_id: string
          kind?: Database["academy"]["Enums"]["prereq_kind"]
          requires_course_id: string
        }
        Update: {
          course_id?: string
          kind?: Database["academy"]["Enums"]["prereq_kind"]
          requires_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_requires_course_id_fkey"
            columns: ["requires_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_versions: {
        Row: {
          authored_by: string | null
          changelog: string | null
          course_id: string
          created_at: string
          id: string
          platform_manifest: Json
          published_at: string | null
          semver: string
          status: Database["academy"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          authored_by?: string | null
          changelog?: string | null
          course_id: string
          created_at?: string
          id?: string
          platform_manifest?: Json
          published_at?: string | null
          semver: string
          status?: Database["academy"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          authored_by?: string | null
          changelog?: string | null
          course_id?: string
          created_at?: string
          id?: string
          platform_manifest?: Json
          published_at?: string | null
          semver?: string
          status?: Database["academy"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_versions_authored_by_fkey"
            columns: ["authored_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_versions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active_version_id: string | null
          code: string
          created_at: string
          domain: Database["academy"]["Enums"]["domain"]
          id: string
          personas: Database["academy"]["Enums"]["persona"][]
          status: Database["academy"]["Enums"]["publish_status"]
          tier: Database["academy"]["Enums"]["tier"]
          title: string
          updated_at: string
        }
        Insert: {
          active_version_id?: string | null
          code: string
          created_at?: string
          domain: Database["academy"]["Enums"]["domain"]
          id?: string
          personas?: Database["academy"]["Enums"]["persona"][]
          status?: Database["academy"]["Enums"]["publish_status"]
          tier: Database["academy"]["Enums"]["tier"]
          title: string
          updated_at?: string
        }
        Update: {
          active_version_id?: string | null
          code?: string
          created_at?: string
          domain?: Database["academy"]["Enums"]["domain"]
          id?: string
          personas?: Database["academy"]["Enums"]["persona"][]
          status?: Database["academy"]["Enums"]["publish_status"]
          tier?: Database["academy"]["Enums"]["tier"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_active_version_fk"
            columns: ["active_version_id"]
            isOneToOne: false
            referencedRelation: "course_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      credential_status_list: {
        Row: {
          credential_id: string | null
          id: string
          list_index: number
          reason: string | null
          revoked: boolean
          updated_at: string
        }
        Insert: {
          credential_id?: string | null
          id?: string
          list_index: number
          reason?: string | null
          revoked?: boolean
          updated_at?: string
        }
        Update: {
          credential_id?: string | null
          id?: string
          list_index?: number
          reason?: string | null
          revoked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credential_status_list_credential_id_fkey"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          badge_class_id: string
          created_at: string
          evidence_urls: string[]
          expires_at: string | null
          hosted_assertion_url: string | null
          id: string
          issued_at: string
          open_badge_json: Json | null
          org_id: string
          proof: Json | null
          recipient_user_id: string
          revocation_reason: string | null
          status: Database["academy"]["Enums"]["credential_status"]
          status_list_index: number | null
          updated_at: string
        }
        Insert: {
          badge_class_id: string
          created_at?: string
          evidence_urls?: string[]
          expires_at?: string | null
          hosted_assertion_url?: string | null
          id?: string
          issued_at?: string
          open_badge_json?: Json | null
          org_id: string
          proof?: Json | null
          recipient_user_id: string
          revocation_reason?: string | null
          status?: Database["academy"]["Enums"]["credential_status"]
          status_list_index?: number | null
          updated_at?: string
        }
        Update: {
          badge_class_id?: string
          created_at?: string
          evidence_urls?: string[]
          expires_at?: string | null
          hosted_assertion_url?: string | null
          id?: string
          issued_at?: string
          open_badge_json?: Json | null
          org_id?: string
          proof?: Json | null
          recipient_user_id?: string
          revocation_reason?: string | null
          status?: Database["academy"]["Enums"]["credential_status"]
          status_list_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_badge_class_id_fkey"
            columns: ["badge_class_id"]
            isOneToOne: false
            referencedRelation: "badge_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          course_version_id: string | null
          created_at: string
          enrolled_via: Database["academy"]["Enums"]["enrollment_via"]
          id: string
          org_id: string
          started_at: string | null
          status: Database["academy"]["Enums"]["enrollment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          course_version_id?: string | null
          created_at?: string
          enrolled_via?: Database["academy"]["Enums"]["enrollment_via"]
          id?: string
          org_id: string
          started_at?: string | null
          status?: Database["academy"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          course_version_id?: string | null
          created_at?: string
          enrolled_via?: Database["academy"]["Enums"]["enrollment_via"]
          id?: string
          org_id?: string
          started_at?: string | null
          status?: Database["academy"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_version_id_fkey"
            columns: ["course_version_id"]
            isOneToOne: false
            referencedRelation: "course_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluator_authorizations: {
        Row: {
          authorized_by: string | null
          calibration_kappa: number | null
          created_at: string
          domains: Database["academy"]["Enums"]["domain"][]
          expires_at: string | null
          id: string
          last_calibrated_at: string | null
          org_id: string
          source: Database["academy"]["Enums"]["eval_auth_source"]
          status: Database["academy"]["Enums"]["eval_auth_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          authorized_by?: string | null
          calibration_kappa?: number | null
          created_at?: string
          domains?: Database["academy"]["Enums"]["domain"][]
          expires_at?: string | null
          id?: string
          last_calibrated_at?: string | null
          org_id: string
          source: Database["academy"]["Enums"]["eval_auth_source"]
          status?: Database["academy"]["Enums"]["eval_auth_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          authorized_by?: string | null
          calibration_kappa?: number | null
          created_at?: string
          domains?: Database["academy"]["Enums"]["domain"][]
          expires_at?: string | null
          id?: string
          last_calibrated_at?: string | null
          org_id?: string
          source?: Database["academy"]["Enums"]["eval_auth_source"]
          status?: Database["academy"]["Enums"]["eval_auth_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluator_authorizations_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_authorizations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluator_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture_sets: {
        Row: {
          created_at: string
          id: string
          label: string
          r2_manifest_key: string
          sanitized: boolean
          source: Database["academy"]["Enums"]["fixture_source"]
          source_citation: string | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          r2_manifest_key: string
          sanitized?: boolean
          source: Database["academy"]["Enums"]["fixture_source"]
          source_citation?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          r2_manifest_key?: string
          sanitized?: boolean
          source?: Database["academy"]["Enums"]["fixture_source"]
          source_citation?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          locale_default: string
          name: string
          parent_org_id: string | null
          settings: Json
          status: Database["academy"]["Enums"]["user_status"]
          type: Database["academy"]["Enums"]["org_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale_default?: string
          name: string
          parent_org_id?: string | null
          settings?: Json
          status?: Database["academy"]["Enums"]["user_status"]
          type: Database["academy"]["Enums"]["org_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          locale_default?: string
          name?: string
          parent_org_id?: string | null
          settings?: Json
          status?: Database["academy"]["Enums"]["user_status"]
          type?: Database["academy"]["Enums"]["org_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgs_parent_org_id_fkey"
            columns: ["parent_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      recert_schedules: {
        Row: {
          created_at: string
          credential_id: string | null
          due_at: string
          id: string
          org_id: string
          reason: Database["academy"]["Enums"]["recert_reason"]
          site_scope: string[]
          status: Database["academy"]["Enums"]["recert_status"]
          triggered_by_event: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credential_id?: string | null
          due_at: string
          id?: string
          org_id: string
          reason: Database["academy"]["Enums"]["recert_reason"]
          site_scope?: string[]
          status?: Database["academy"]["Enums"]["recert_status"]
          triggered_by_event?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credential_id?: string | null
          due_at?: string
          id?: string
          org_id?: string
          reason?: Database["academy"]["Enums"]["recert_reason"]
          site_scope?: string[]
          status?: Database["academy"]["Enums"]["recert_status"]
          triggered_by_event?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recert_credential_fk"
            columns: ["credential_id"]
            isOneToOne: false
            referencedRelation: "credentials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recert_schedules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recert_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          key: Database["academy"]["Enums"]["role_key"]
          label: string
        }
        Insert: {
          id?: string
          key: Database["academy"]["Enums"]["role_key"]
          label: string
        }
        Update: {
          id?: string
          key?: Database["academy"]["Enums"]["role_key"]
          label?: string
        }
        Relationships: []
      }
      signoff_evidence: {
        Row: {
          captured_at: string | null
          created_at: string
          id: string
          kind: Database["academy"]["Enums"]["evidence_kind"]
          r2_key: string
          redacted: boolean
          signoff_id: string
          source: Database["academy"]["Enums"]["evidence_source"]
          work_os_ref: string | null
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          id?: string
          kind: Database["academy"]["Enums"]["evidence_kind"]
          r2_key: string
          redacted?: boolean
          signoff_id: string
          source: Database["academy"]["Enums"]["evidence_source"]
          work_os_ref?: string | null
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          id?: string
          kind?: Database["academy"]["Enums"]["evidence_kind"]
          r2_key?: string
          redacted?: boolean
          signoff_id?: string
          source?: Database["academy"]["Enums"]["evidence_source"]
          work_os_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signoff_evidence_signoff_id_fkey"
            columns: ["signoff_id"]
            isOneToOne: false
            referencedRelation: "signoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      signoff_line_item_templates: {
        Row: {
          competency_id: string | null
          course_id: string
          created_at: string
          dimension: Database["academy"]["Enums"]["signoff_dimension"]
          id: string
          is_critical_safety: boolean
          label: string
          line_item_key: string
          note: string | null
          ordinal: number
          updated_at: string
        }
        Insert: {
          competency_id?: string | null
          course_id: string
          created_at?: string
          dimension: Database["academy"]["Enums"]["signoff_dimension"]
          id?: string
          is_critical_safety?: boolean
          label: string
          line_item_key: string
          note?: string | null
          ordinal: number
          updated_at?: string
        }
        Update: {
          competency_id?: string | null
          course_id?: string
          created_at?: string
          dimension?: Database["academy"]["Enums"]["signoff_dimension"]
          id?: string
          is_critical_safety?: boolean
          label?: string
          line_item_key?: string
          note?: string | null
          ordinal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signoff_line_item_templates_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoff_line_item_templates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      signoff_line_items: {
        Row: {
          created_at: string
          dimension: Database["academy"]["Enums"]["signoff_dimension"]
          id: string
          is_critical_safety: boolean
          line_item_key: string
          note: string | null
          score: number
          signoff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimension: Database["academy"]["Enums"]["signoff_dimension"]
          id?: string
          is_critical_safety?: boolean
          line_item_key: string
          note?: string | null
          score: number
          signoff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimension?: Database["academy"]["Enums"]["signoff_dimension"]
          id?: string
          is_critical_safety?: boolean
          line_item_key?: string
          note?: string | null
          score?: number
          signoff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "signoff_line_items_signoff_id_fkey"
            columns: ["signoff_id"]
            isOneToOne: false
            referencedRelation: "signoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      signoffs: {
        Row: {
          candidate_user_id: string
          competency_id: string | null
          course_id: string | null
          created_at: string
          created_by: string | null
          evaluator_user_id: string
          id: string
          org_id: string
          outcome: Database["academy"]["Enums"]["signoff_outcome"] | null
          signed_at: string | null
          status: Database["academy"]["Enums"]["signoff_status"]
          superseded_by: string | null
          updated_at: string
          void_reason: string | null
          work_os_job_id: string | null
        }
        Insert: {
          candidate_user_id: string
          competency_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          evaluator_user_id: string
          id?: string
          org_id: string
          outcome?: Database["academy"]["Enums"]["signoff_outcome"] | null
          signed_at?: string | null
          status?: Database["academy"]["Enums"]["signoff_status"]
          superseded_by?: string | null
          updated_at?: string
          void_reason?: string | null
          work_os_job_id?: string | null
        }
        Update: {
          candidate_user_id?: string
          competency_id?: string | null
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          evaluator_user_id?: string
          id?: string
          org_id?: string
          outcome?: Database["academy"]["Enums"]["signoff_outcome"] | null
          signed_at?: string | null
          status?: Database["academy"]["Enums"]["signoff_status"]
          superseded_by?: string | null
          updated_at?: string
          void_reason?: string | null
          work_os_job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signoffs_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_evaluator_user_id_fkey"
            columns: ["evaluator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signoffs_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "signoffs"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_attempts: {
        Row: {
          client_event_uuid: string
          created_at: string
          device_meta: Json
          ended_at: string | null
          enrollment_id: string | null
          id: string
          offline_origin: boolean
          org_id: string
          outcome: Database["academy"]["Enums"]["sim_outcome"] | null
          safety_veto_triggered: boolean
          score: number | null
          sim_definition_id: string
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_event_uuid: string
          created_at?: string
          device_meta?: Json
          ended_at?: string | null
          enrollment_id?: string | null
          id?: string
          offline_origin?: boolean
          org_id: string
          outcome?: Database["academy"]["Enums"]["sim_outcome"] | null
          safety_veto_triggered?: boolean
          score?: number | null
          sim_definition_id: string
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_event_uuid?: string
          created_at?: string
          device_meta?: Json
          ended_at?: string | null
          enrollment_id?: string | null
          id?: string
          offline_origin?: boolean
          org_id?: string
          outcome?: Database["academy"]["Enums"]["sim_outcome"] | null
          safety_veto_triggered?: boolean
          score?: number | null
          sim_definition_id?: string
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_attempts_sim_definition_id_fkey"
            columns: ["sim_definition_id"]
            isOneToOne: false
            referencedRelation: "sim_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sim_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_definitions: {
        Row: {
          competency_ids: string[]
          created_at: string
          fixture_set_id: string | null
          id: string
          key: string
          kind: Database["academy"]["Enums"]["sim_kind"]
          source_citation: string | null
          spec: Json
          status: Database["academy"]["Enums"]["publish_status"]
          updated_at: string
          version: string
        }
        Insert: {
          competency_ids?: string[]
          created_at?: string
          fixture_set_id?: string | null
          id?: string
          key: string
          kind: Database["academy"]["Enums"]["sim_kind"]
          source_citation?: string | null
          spec: Json
          status?: Database["academy"]["Enums"]["publish_status"]
          updated_at?: string
          version: string
        }
        Update: {
          competency_ids?: string[]
          created_at?: string
          fixture_set_id?: string | null
          id?: string
          key?: string
          kind?: Database["academy"]["Enums"]["sim_kind"]
          source_citation?: string | null
          spec?: Json
          status?: Database["academy"]["Enums"]["publish_status"]
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_definitions_fixture_set_id_fkey"
            columns: ["fixture_set_id"]
            isOneToOne: false
            referencedRelation: "fixture_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      sim_telemetry_events: {
        Row: {
          client_event_uuid: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          sim_attempt_id: string
          ts: string
        }
        Insert: {
          client_event_uuid: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          sim_attempt_id: string
          ts?: string
        }
        Update: {
          client_event_uuid?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          sim_attempt_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "sim_telemetry_events_sim_attempt_id_fkey"
            columns: ["sim_attempt_id"]
            isOneToOne: false
            referencedRelation: "sim_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_competencies: {
        Row: {
          competency_id: string
          unit_id: string
        }
        Insert: {
          competency_id: string
          unit_id: string
        }
        Update: {
          competency_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_competencies_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_progress: {
        Row: {
          attempts: number
          created_at: string
          enrollment_id: string
          id: string
          last_attempt_at: string | null
          org_id: string
          score: number | null
          status: Database["academy"]["Enums"]["unit_progress_status"]
          synced_from_offline: boolean
          unit_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          enrollment_id: string
          id?: string
          last_attempt_at?: string | null
          org_id: string
          score?: number | null
          status?: Database["academy"]["Enums"]["unit_progress_status"]
          synced_from_offline?: boolean
          unit_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          enrollment_id?: string
          id?: string
          last_attempt_at?: string | null
          org_id?: string
          score?: number | null
          status?: Database["academy"]["Enums"]["unit_progress_status"]
          synced_from_offline?: boolean
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          competency_id: string | null
          content_ref: Json
          course_version_id: string
          created_at: string
          est_minutes: number | null
          id: string
          kind: Database["academy"]["Enums"]["unit_kind"]
          ordinal: number
          title: string
          updated_at: string
        }
        Insert: {
          competency_id?: string | null
          content_ref?: Json
          course_version_id: string
          created_at?: string
          est_minutes?: number | null
          id?: string
          kind: Database["academy"]["Enums"]["unit_kind"]
          ordinal: number
          title: string
          updated_at?: string
        }
        Update: {
          competency_id?: string | null
          content_ref?: Json
          course_version_id?: string
          created_at?: string
          est_minutes?: number | null
          id?: string
          kind?: Database["academy"]["Enums"]["unit_kind"]
          ordinal?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_course_version_id_fkey"
            columns: ["course_version_id"]
            isOneToOne: false
            referencedRelation: "course_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          org_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          org_id: string
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          org_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_active_at: string | null
          locale_pref: string | null
          org_id: string
          persona: Database["academy"]["Enums"]["persona"] | null
          status: Database["academy"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_active_at?: string | null
          locale_pref?: string | null
          org_id: string
          persona?: Database["academy"]["Enums"]["persona"] | null
          status?: Database["academy"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_active_at?: string | null
          locale_pref?: string | null
          org_id?: string
          persona?: Database["academy"]["Enums"]["persona"] | null
          status?: Database["academy"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_prereq_dag: {
        Args: never
        Returns: {
          course_id: string
          cycle_path: string[]
          requires_course_id: string
        }[]
      }
      current_org_id: { Args: never; Returns: string }
      current_user_id: { Args: never; Returns: string }
      jwt_has_role: { Args: { role_keys: string[] }; Returns: boolean }
      prereq_graph_is_dag: { Args: never; Returns: boolean }
    }
    Enums: {
      assessment_kind:
        | "mcq"
        | "multi_select"
        | "numeric"
        | "open_response"
        | "order"
        | "hotspot"
        | "scenario_branch"
      audit_action:
        | "credential_issued"
        | "credential_revoked"
        | "signoff_signed"
        | "signoff_voided"
        | "recert_triggered"
        | "evidence_accessed"
        | "role_changed"
        | "authorization_changed"
        | "competency_promoted"
        | "ai_graded"
      badge_kind: "skill" | "tier" | "role" | "evaluator"
      competency_source: "course" | "rpl" | "bootstrap"
      competency_status:
        | "none"
        | "in_progress"
        | "sim_passed"
        | "field_proven"
        | "expired"
      credential_status: "active" | "expired" | "revoked" | "recert_required"
      domain: "FND" | "INT" | "ADC" | "AC" | "VID" | "SEC"
      enrollment_status:
        | "not_started"
        | "in_progress"
        | "completed"
        | "recert_required"
        | "waived_rpl"
      enrollment_via: "self" | "assigned" | "jit_workos" | "rpl"
      eval_auth_source: "founding_bootstrap" | "int_410"
      eval_auth_status: "provisional" | "authorized" | "suspended"
      evidence_kind:
        | "photo"
        | "portal_screenshot"
        | "workos_doc"
        | "video"
        | "signature"
      evidence_source: "workos_job" | "uploaded"
      fixture_source:
        | "adc_portal"
        | "openeye"
        | "iq_panel"
        | "mercury"
        | "dragonfruit"
      graded_by: "auto" | "ai" | "sme"
      org_type: "redex" | "ccs_partner"
      persona: "nova" | "marco" | "priya" | "dana"
      prereq_kind: "hard_gate" | "soft"
      publish_status: "draft" | "published" | "deprecated" | "retired"
      recert_reason:
        | "time_based"
        | "platform_major"
        | "evaluator_annual"
        | "egress_12mo"
        | "compliance_12mo"
      recert_status:
        | "scheduled"
        | "notified"
        | "in_progress"
        | "completed"
        | "overdue"
      role_key:
        | "learner"
        | "evaluator"
        | "manager"
        | "author"
        | "curriculum_admin"
        | "org_admin"
        | "exec"
        | "support"
      signoff_dimension:
        | "safety_compliance"
        | "technical_execution"
        | "verification_documentation"
        | "independence_judgment"
      signoff_outcome: "pass" | "fail"
      signoff_status: "draft" | "submitted" | "signed" | "failed" | "void"
      sim_kind:
        | "branching_scenario"
        | "device_config"
        | "webgl_install"
        | "panel_state_machine"
        | "interaction_2d"
        | "calculator"
      sim_outcome: "pass" | "fail" | "abandoned"
      tier: "foundations" | "core" | "advanced" | "mastery"
      unit_kind:
        | "lesson"
        | "sim"
        | "scenario"
        | "knowledge_check"
        | "video"
        | "checklist"
        | "signoff_prep"
      unit_progress_status:
        | "locked"
        | "available"
        | "in_progress"
        | "passed"
        | "failed"
      user_status: "active" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  workos: {
    Tables: {
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          external_ref: string | null
          id: string
          org_id: string
          scheduled_at: string | null
          site_id: string | null
          status: Database["workos"]["Enums"]["job_status"]
          tech_user_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          org_id: string
          scheduled_at?: string | null
          site_id?: string | null
          status?: Database["workos"]["Enums"]["job_status"]
          tech_user_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          org_id?: string
          scheduled_at?: string | null
          site_id?: string | null
          status?: Database["workos"]["Enums"]["job_status"]
          tech_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status: "scheduled" | "in_progress" | "completed" | "cancelled"
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
  academy: {
    Enums: {
      assessment_kind: [
        "mcq",
        "multi_select",
        "numeric",
        "open_response",
        "order",
        "hotspot",
        "scenario_branch",
      ],
      audit_action: [
        "credential_issued",
        "credential_revoked",
        "signoff_signed",
        "signoff_voided",
        "recert_triggered",
        "evidence_accessed",
        "role_changed",
        "authorization_changed",
        "competency_promoted",
        "ai_graded",
      ],
      badge_kind: ["skill", "tier", "role", "evaluator"],
      competency_source: ["course", "rpl", "bootstrap"],
      competency_status: [
        "none",
        "in_progress",
        "sim_passed",
        "field_proven",
        "expired",
      ],
      credential_status: ["active", "expired", "revoked", "recert_required"],
      domain: ["FND", "INT", "ADC", "AC", "VID", "SEC"],
      enrollment_status: [
        "not_started",
        "in_progress",
        "completed",
        "recert_required",
        "waived_rpl",
      ],
      enrollment_via: ["self", "assigned", "jit_workos", "rpl"],
      eval_auth_source: ["founding_bootstrap", "int_410"],
      eval_auth_status: ["provisional", "authorized", "suspended"],
      evidence_kind: [
        "photo",
        "portal_screenshot",
        "workos_doc",
        "video",
        "signature",
      ],
      evidence_source: ["workos_job", "uploaded"],
      fixture_source: [
        "adc_portal",
        "openeye",
        "iq_panel",
        "mercury",
        "dragonfruit",
      ],
      graded_by: ["auto", "ai", "sme"],
      org_type: ["redex", "ccs_partner"],
      persona: ["nova", "marco", "priya", "dana"],
      prereq_kind: ["hard_gate", "soft"],
      publish_status: ["draft", "published", "deprecated", "retired"],
      recert_reason: [
        "time_based",
        "platform_major",
        "evaluator_annual",
        "egress_12mo",
        "compliance_12mo",
      ],
      recert_status: [
        "scheduled",
        "notified",
        "in_progress",
        "completed",
        "overdue",
      ],
      role_key: [
        "learner",
        "evaluator",
        "manager",
        "author",
        "curriculum_admin",
        "org_admin",
        "exec",
        "support",
      ],
      signoff_dimension: [
        "safety_compliance",
        "technical_execution",
        "verification_documentation",
        "independence_judgment",
      ],
      signoff_outcome: ["pass", "fail"],
      signoff_status: ["draft", "submitted", "signed", "failed", "void"],
      sim_kind: [
        "branching_scenario",
        "device_config",
        "webgl_install",
        "panel_state_machine",
        "interaction_2d",
        "calculator",
      ],
      sim_outcome: ["pass", "fail", "abandoned"],
      tier: ["foundations", "core", "advanced", "mastery"],
      unit_kind: [
        "lesson",
        "sim",
        "scenario",
        "knowledge_check",
        "video",
        "checklist",
        "signoff_prep",
      ],
      unit_progress_status: [
        "locked",
        "available",
        "in_progress",
        "passed",
        "failed",
      ],
      user_status: ["active", "suspended"],
    },
  },
  workos: {
    Enums: {
      job_status: ["scheduled", "in_progress", "completed", "cancelled"],
    },
  },
} as const
