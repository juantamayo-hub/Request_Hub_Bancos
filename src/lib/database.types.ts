// ============================================================
// Request Hub Bancos — Database Types
// Manually maintained to mirror supabase/migrations/001_initial_schema.sql
// Run `npx supabase gen types typescript` to regenerate from a live project.
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type TicketStatus    = 'new' | 'in_progress' | 'waiting_on_employee' | 'resolved' | 'closed'
export type TicketPriority  = 'low' | 'medium' | 'high'
export type UserRole        = 'employee' | 'admin'
export type CommentVisibility = 'public' | 'internal'
export type AuditAction     = 'created' | 'status_changed' | 'assigned' | 'priority_changed' | 'comment_added' | 'updated'

// ─── Table row types ──────────────────────────────────────────

export interface Profile {
  id:           string
  email:        string
  first_name:   string | null
  last_name:    string | null
  role:         UserRole
  department:   string | null
  avatar_url:   string | null
  is_available: boolean
  created_at:   string
  updated_at:   string
}

export interface Category {
  id:          string
  name:        string
  description: string | null
  is_active:   boolean
  created_at:  string
}

export interface RoutingRule {
  id:                 string
  category_id:        string
  owner_email:        string
  backup_owner_email: string | null
  default_priority:   TicketPriority
  sla_hours:          number
  created_at:         string
  updated_at:         string
}

export interface Ticket {
  id:           string
  display_id:   string
  created_by:   string
  assignee_id:  string | null
  category_id:  string
  subcategory:  string | null
  subject:      string
  description:  string
  priority:     TicketPriority
  status:       TicketStatus
  sla_hours:    number | null
  sla_deadline: string | null
  tags:         string[] | null
  bank_name:         string | null
  bank_email:        string | null
  client_name:       string | null
  pipedrive_deal_id: number | null
  created_at:        string
  updated_at:   string
  resolved_at:  string | null
}

export interface TicketComment {
  id:         string
  ticket_id:  string
  author_id:  string
  body:       string
  visibility: CommentVisibility
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id:         string
  ticket_id:  string
  actor_id:   string
  action:     AuditAction
  from_value: string | null
  to_value:   string | null
  metadata:   Json | null
  created_at: string
}

export interface TicketStatusHistory {
  id:         string
  ticket_id:  string
  status:     TicketStatus
  changed_by: string
  changed_at: string
}

// ─── Joined types (from Supabase select with nested relations) ─

export type ProfileSummary = Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name' | 'avatar_url'>

export interface TicketWithRelations extends Ticket {
  categories: Pick<Category, 'id' | 'name'>
  profiles:   ProfileSummary                  // creator
  assignee:   ProfileSummary | null
}

export interface CommentAttachment {
  id:         string
  comment_id: string
  ticket_id:  string
  file_name:  string
  file_path:  string
  file_size:  number
  mime_type:  string
  uploaded_by: string
  created_at: string
  signedUrl?: string  // populated server-side before passing to components
}

export interface TicketFeedback {
  id:              string
  ticket_id:       string
  requester_email: string
  satisfied:       boolean
  comment:         string | null
  created_at:      string
}

export interface TicketCommentWithAuthor extends TicketComment {
  profiles:    ProfileSummary
  attachments?: CommentAttachment[]
}

export interface AuditLogWithActor extends AuditLog {
  profiles: Pick<Profile, 'id' | 'email' | 'first_name' | 'last_name'>
}

// ─── Dashboard ────────────────────────────────────────────────

export interface AtRiskTicket {
  id:        string
  displayId: string
  subject:   string
  category:  string
  deadline:  string
  status:    'breaching' | 'at-risk'
}

export interface VelocityDay {
  date:   string
  opened: number
  closed: number
}

export interface DashboardMetrics {
  // Existing
  totalTickets:      number
  openTickets:       number
  newCount:          number
  inProgressCount:   number
  waitingCount:      number
  resolvedCount:     number
  closedCount:       number
  slaBreaching:      number
  agingTickets:      number   // open > 7 days
  avgResolutionDays: number
  // New
  ticketsByCategory:     { categoryId: string; name: string; count: number }[]
  ticketsByPriority:     { priority: TicketPriority; count: number }[]
  ageDistribution:       { bucket: '1-3d' | '3-7d' | '7d+'; count: number }[]
  atRiskTickets:         AtRiskTicket[]
  velocityLast7Days:     VelocityDay[]
  prevWeekOpen:          number
  prevWeekSlaBreaching:  number
  prevWeekAvgResolution: number
}

// ─── API request/response shapes ─────────────────────────────

export interface CreateTicketInput {
  category_id:   string
  subcategory?:  string
  subject:       string
  description:   string
  priority?:     TicketPriority
  tags?:         string[]
  bank_name?:         string
  bank_email?:        string
  client_name?:       string
  pipedrive_deal_id?: number
}

export interface UpdateTicketInput {
  status?:        TicketStatus
  priority?:      TicketPriority
  assignee_id?:   string | null
  cancel_reason?: string
}

export interface AddCommentInput {
  body:        string
  visibility?: CommentVisibility
}
