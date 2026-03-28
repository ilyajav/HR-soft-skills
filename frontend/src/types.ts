export type ThemeMode = "light" | "dark";

export interface AuthResponse {
  token: string;
  username: string;
}

export interface AssessmentCard {
  id: number;
  text: string;
  criticality_level: number;
}

export interface AssessmentCardDraft {
  text: string;
  criticality_level: number;
}

export interface AssessmentFormState {
  title: string;
  calc_dsi: boolean;
  calc_sri: boolean;
  calc_tcei: boolean;
  cards: AssessmentCardDraft[];
}

export interface CreatedAssessmentResponse {
  id: number;
  title: string;
  calc_dsi: boolean;
  calc_sri: boolean;
  calc_tcei: boolean;
  cards: AssessmentCard[];
  session_token: string;
}

export interface CandidateSession {
  id: number;
  test_id: number;
  test_title: string;
  token: string;
  candidate_name: string;
  is_completed: boolean;
  calc_dsi: boolean;
  calc_sri: boolean;
  calc_tcei: boolean;
  final_dsi: number | null;
  final_sri: number | null;
  final_tcei: number | null;
}

export interface CandidateSessionCriticalityResult {
  card_id: number;
  card_text: string;
  expected_criticality_level: number;
  expected_criticality_label: string;
  assigned_criticality_level: number | null;
  assigned_criticality_label: string | null;
  is_correct: boolean | null;
}

export interface CandidateSessionDetail extends CandidateSession {
  criticality_total_count: number;
  criticality_correct_count: number;
  criticality_incorrect_count: number;
  criticality_missing_count: number;
  criticality_results: CandidateSessionCriticalityResult[];
}

export interface PublicTaskCard {
  id: number;
  text: string;
}

export interface PublicSession {
  token: string;
  title: string;
  candidate_name: string;
  is_completed: boolean;
  calc_sri: boolean;
  cards: PublicTaskCard[];
}

export interface TelemetryLog {
  card_id: number;
  time_spent_ms: number;
  drag_count: number;
  assigned_criticality_level: number;
  final_rank?: number;
}

export interface SubmitTelemetryResponse {
  detail: string;
  is_completed: boolean;
}

export interface StatisticsScatterPoint {
  candidate: string;
  dsi: number;
  sri: number;
  tcei: number | null;
}

export interface StatisticsCompletedSession {
  test_title: string;
  candidate_name: string;
  final_dsi: number | null;
  final_sri: number | null;
  final_tcei: number | null;
}

export interface TceiDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface StatisticsResponse {
  total_sessions: number;
  average_dsi: number | null;
  average_sri: number | null;
  average_tcei: number | null;
  completed_sessions: StatisticsCompletedSession[];
  scatter_data: StatisticsScatterPoint[];
  tcei_distribution: TceiDistribution;
}
