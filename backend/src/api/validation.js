import { z } from 'zod';
import { HttpError } from './http.js';

export class RequestValidationError extends HttpError {
  constructor({ message, field, issues }) {
    super(400, message ?? 'Invalid request payload', message ?? 'Invalid request payload');
    this.name = 'RequestValidationError';
    this.code = 'validation_error';
    this.field = field ?? null;
    this.issues = Array.isArray(issues) ? issues : [];
  }
}

function toPath(path) {
  if (!Array.isArray(path) || !path.length) {
    return null;
  }
  return path
    .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
    .join('.')
    .replace('.[', '[');
}

function mapIssues(zodError) {
  return zodError.issues.map((issue) => ({
    field: toPath(issue.path),
    message: issue.message,
  }));
}

function parseOrThrow(schema, payload, fallbackMessage) {
  const parsed = schema.safeParse(payload ?? {});
  if (parsed.success) {
    return parsed.data;
  }

  const issues = mapIssues(parsed.error);
  throw new RequestValidationError({
    message: fallbackMessage,
    field: issues[0]?.field ?? null,
    issues,
  });
}

const emailSchema = z.string().trim().email('Adresse email invalide').max(120);
const passwordSchema = z.string().min(8, 'Mot de passe trop court (8 caracteres min)').max(128, 'Mot de passe trop long');

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2, 'Pseudo trop court').max(40, 'Pseudo trop long').optional(),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128, 'Mot de passe trop long'),
});

const participantSlotSchema = z.union([
  z.string().trim().min(1),
  z.object({
    userId: z.string().trim().min(1).optional(),
    kind: z.enum(['guest', 'user']).optional(),
    type: z.enum(['guest', 'user']).optional(),
    guest: z.boolean().optional(),
    guestId: z.string().trim().min(1).optional(),
    guestName: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(1).max(64).optional(),
    guestLevel: z.union([z.string(), z.number()]).optional(),
    level: z.union([z.string(), z.number()]).optional(),
  }).passthrough(),
]);

const matchSetSchema = z.object({
  a: z.coerce.number().int().min(0),
  b: z.coerce.number().int().min(0),
});

const watchMetricsSchema = z.object({
  distanceKm: z.coerce.number().min(0).max(200).optional(),
  calories: z.coerce.number().min(0).max(5000).optional(),
  intensityScore: z.coerce.number().min(0).max(1000).optional(),
  smashSpeedKmh: z.coerce.number().min(0).max(300).optional(),
  heartRateAvg: z.coerce.number().min(0).max(240).optional(),
  oxygenAvg: z.coerce.number().min(0).max(100).optional(),
}).partial();

const createMatchSchema = z.object({
  teamA: z.array(participantSlotSchema).length(2, 'L equipe A doit avoir 2 joueurs'),
  teamB: z.array(participantSlotSchema).length(2, 'L equipe B doit avoir 2 joueurs'),
  sets: z.array(matchSetSchema).min(1, 'Au moins un set est requis'),
  mode: z.enum(['ranked', 'friendly']).optional(),
  matchFormat: z.enum(['standard', 'club', 'marathon']).optional(),
  goldenPoints: z.object({
    teamA: z.coerce.number().int().min(0),
    teamB: z.coerce.number().int().min(0),
  }).optional(),
  validationMode: z.enum(['cross', 'friendly']).optional(),
  totalCostEur: z.coerce.number().min(0).max(2000).optional(),
  clubName: z.string().trim().min(1).max(80).optional(),
  liveMatchId: z.string().trim().min(1).max(120).optional(),
  watchByPlayer: z.record(z.string(), watchMetricsSchema).optional(),
}).passthrough();

const validateMatchSchema = z.object({
  accepted: z.boolean(),
});

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  weightKg: z.coerce.number().min(25).max(250).optional(),
  heightCm: z.coerce.number().min(120).max(240).optional(),
  dominantHand: z.enum(['left', 'right', 'ambi']).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  location: z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  }).optional(),
  watchEnabled: z.boolean().optional(),
  watchProvider: z.string().trim().min(2).max(40).optional(),
}).passthrough();

export function validateRegisterPayload(payload) {
  return parseOrThrow(registerSchema, payload, 'Validation impossible pour inscription');
}

export function validateLoginPayload(payload) {
  return parseOrThrow(loginSchema, payload, 'Validation impossible pour connexion');
}

export function validateCreateMatchPayload(payload) {
  return parseOrThrow(createMatchSchema, payload, 'Validation impossible pour creation de match');
}

export function validateMatchDecisionPayload(payload) {
  return parseOrThrow(validateMatchSchema, payload, 'Validation impossible pour decision de match');
}

export function validateUpdateProfilePayload(payload) {
  return parseOrThrow(updateProfileSchema, payload, 'Validation impossible pour profil');
}
