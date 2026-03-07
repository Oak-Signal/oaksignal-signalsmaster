const EXAM_SESSION_TOKEN_VERSION = "v1";
const DEFAULT_EXAM_SESSION_TOKEN_TTL_MS = 1000 * 60 * 60 * 4;
const MIN_SECRET_LENGTH = 32;

interface ExamSessionTokenInput {
  examAttemptId: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
}

interface IssueExamSessionTokenInput extends Omit<ExamSessionTokenInput, "expiresAt"> {
  ttlMs?: number;
}

interface ExamSessionTokenIssueResult {
  token: string;
  tokenHash: string;
  issuedAt: number;
  expiresAt: number;
}

interface ValidateExamSessionTokenInput extends ExamSessionTokenInput {
  token: string;
  expectedHash: string;
  now?: number;
}

interface ValidateExamSessionTokenResult {
  valid: boolean;
  reason?: string;
}

function getExamSessionTokenSecret(): string {
  const secret = process.env.EXAM_SESSION_TOKEN_SECRET?.trim();
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "EXAM_SESSION_TOKEN_SECRET is missing or too short. Minimum length is 32 characters."
    );
  }
  return secret;
}

function buildPayload(input: ExamSessionTokenInput): string {
  return [
    EXAM_SESSION_TOKEN_VERSION,
    input.examAttemptId,
    input.userId,
    String(input.issuedAt),
    String(input.expiresAt),
  ].join(":");
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const digestArray = Array.from(new Uint8Array(digest));
  return digestArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

async function buildTokenFromPayload(payload: string, secret: string): Promise<string> {
  const signature = await sha256Hex(`${secret}:sign:${payload}`);
  return `${payload}:${signature}`;
}

async function buildTokenHash(token: string, secret: string): Promise<string> {
  return sha256Hex(`${secret}:hash:${token}`);
}

export async function issueExamSessionToken(
  input: IssueExamSessionTokenInput
): Promise<ExamSessionTokenIssueResult> {
  const secret = getExamSessionTokenSecret();
  const ttlMs = input.ttlMs ?? DEFAULT_EXAM_SESSION_TOKEN_TTL_MS;
  const issuedAt = input.issuedAt;
  const expiresAt = issuedAt + Math.max(1000, ttlMs);
  const payload = buildPayload({
    examAttemptId: input.examAttemptId,
    userId: input.userId,
    issuedAt,
    expiresAt,
  });
  const token = await buildTokenFromPayload(payload, secret);
  const tokenHash = await buildTokenHash(token, secret);

  return {
    token,
    tokenHash,
    issuedAt,
    expiresAt,
  };
}

export async function deriveExamSessionToken(input: ExamSessionTokenInput): Promise<string> {
  const secret = getExamSessionTokenSecret();
  const payload = buildPayload(input);
  return buildTokenFromPayload(payload, secret);
}

export async function validateExamSessionToken(
  input: ValidateExamSessionTokenInput
): Promise<ValidateExamSessionTokenResult> {
  const secret = getExamSessionTokenSecret();
  const now = input.now ?? Date.now();

  if (now > input.expiresAt) {
    return {
      valid: false,
      reason: "Session token expired.",
    };
  }

  const expectedToken = await buildTokenFromPayload(
    buildPayload({
      examAttemptId: input.examAttemptId,
      userId: input.userId,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
    }),
    secret
  );

  if (!constantTimeEqual(input.token, expectedToken)) {
    return {
      valid: false,
      reason: "Session token signature mismatch.",
    };
  }

  const hashedToken = await buildTokenHash(input.token, secret);
  if (!constantTimeEqual(hashedToken, input.expectedHash)) {
    return {
      valid: false,
      reason: "Session token hash mismatch.",
    };
  }

  return {
    valid: true,
  };
}
