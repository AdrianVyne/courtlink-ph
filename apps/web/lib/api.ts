export interface ApiErrorBody {
  code?: string;
  message?: string | string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

export interface VenueSummary {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  regionCode: string;
  provinceCode: string | null;
  cityMunicipality: string;
  barangay: string | null;
  streetAddress: string;
  timezone: string;
  approvedAt: string | null;
}

export interface CourtSummary {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  indoor: boolean;
  active: boolean;
  slotIncrementMin: number;
  minimumDurationMin: number;
  maximumDurationMin: number;
}

export interface CoachProfileSummary {
  id: string;
  userId: string;
  bio: string | null;
  experience: string | null;
  hourlyRate: number;
  verificationStatus: string;
  active: boolean;
}

export interface AvailabilitySlot {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  active: boolean;
}

export interface CoachMe {
  profile: CoachProfileSummary | null;
  availability: AvailabilitySlot[];
}

export interface OpenCoachJob {
  id: string;
  startsAt: string;
  endsAt: string;
  location: string;
  groupSize: number;
  skillLevel: string;
  goals: string | null;
  notes: string | null;
}

export interface CoachBookingListItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  amount: number;
  currency: string;
  player: { displayName: string };
  submission: { id: string; status: string; channel: string; transactionRef: string } | null;
}

export interface PlayerCoachRequest {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  location: string;
  groupSize: number;
  skillLevel: string;
  offers: Array<{
    id: string;
    coachId: string;
    amount: number;
    status: string;
    expiresAt: string;
    message: string | null;
  }>;
  booking: { id: string; status: string } | null;
}
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

export interface Quote {
  totalAmount: number;
  currency: string;
  ruleId: string;
  court: CourtSummary;
}

export interface BookingRecord {
  id: string;
  courtId: string;
  playerId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  quotedAmount: number;
  currency: string;
  proofDeadline: string;
  reviewDueAt: string | null;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export interface ReviewItem {
  id: string;
  authorId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface VenueReviews {
  rating: RatingSummary;
  items: ReviewItem[];
}

export interface ModerationCase {
  id: string;
  reporterId: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}

export interface FavoriteVenueSummary {
  id: string;
  name: string;
  slug: string;
  cityMunicipality: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface BookingListItem {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  quotedAmount: number;
  currency: string;
  proofDeadline: string | null;
  reviewDueAt: string | null;
  court: { id: string; name: string };
  venue: { id: string; name: string; slug: string };
  submission: {
    id: string;
    status: string;
    channel: string;
    transactionRef: string;
    proofObjectKey: string;
  } | null;
  refund: { id: string; status: string; amount: number } | null;
  reviewed: boolean;
}

type Query = Record<string, string | number | boolean | undefined>;

function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Query;
  cookie?: string;
  cache?: RequestCache;
}

function apiBaseUrl(): string {
  // On the server, call the API directly; in the browser use same-origin proxy.
  if (typeof window === "undefined") {
    return process.env.API_INTERNAL_URL ?? process.env.API_PROXY_TARGET ?? "http://localhost:3001";
  }
  return "";
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, cookie, cache } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers.cookie = cookie;

  const init: RequestInit = {
    method,
    headers,
    credentials: "include",
    cache: cache ?? "no-store",
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const response = await fetch(`${apiBaseUrl()}/api/v1${path}${buildQuery(query)}`, init);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    const errorBody = (parsed ?? {}) as ApiErrorBody;
    const message = Array.isArray(errorBody.message)
      ? errorBody.message.join(", ")
      : (errorBody.message ?? `Request failed with ${response.status}`);
    throw new ApiError(response.status, errorBody.code ?? "API_ERROR", message);
  }

  return parsed as T;
}
