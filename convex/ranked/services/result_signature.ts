import { Id } from "../../_generated/dataModel";
import { stableStringify, sha256Hex } from "../../exams/services/hash";
import {
  getRankedResultSignatureSecret,
  getRankedResultSigningConfig,
} from "./security_config";

interface RankedResultTokenPayload {
  version: string;
  runId: string;
  userId: string;
  score: number;
  timestamp: number;
  salt: string;
}

export interface IssueRankedResultTokenInput {
  runId: Id<"rankedRuns">;
  userId: Id<"users">;
  score: number;
  timestamp: number;
}

export interface IssueRankedResultTokenResult {
  token: string;
  tokenHash: string;
  signatureHash: string;
  signature: string;
  payload: RankedResultTokenPayload;
  salt: string;
  issuedAt: number;
  version: string;
}

function generateSalt(bytes = 16): string {
  if ("crypto" in globalThis && globalThis.crypto?.getRandomValues) {
    const array = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const fallback = `${Date.now()}-${Math.random()}-${Math.random()}`;
  return fallback.replace(/[^a-zA-Z0-9]/g, "").slice(0, bytes * 2);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function buildTokenPayload(input: {
  runId: string;
  userId: string;
  score: number;
  timestamp: number;
  version: string;
  salt: string;
}): RankedResultTokenPayload {
  return {
    version: input.version,
    runId: input.runId,
    userId: input.userId,
    score: Math.round(input.score * 100) / 100,
    timestamp: input.timestamp,
    salt: input.salt,
  };
}

async function buildSignature(payloadText: string, secret: string): Promise<string> {
  return sha256Hex(`${secret}:sign:${payloadText}`);
}

export async function issueRankedResultToken(
  input: IssueRankedResultTokenInput
): Promise<IssueRankedResultTokenResult> {
  const signing = getRankedResultSigningConfig();
  if (!signing.enabled) {
    throw new Error("Ranked result signing is not configured. Set RANKED_RESULT_SIGNATURE_SECRET.");
  }

  const secret = getRankedResultSignatureSecret();
  const issuedAt = Date.now();
  const salt = generateSalt();

  const payload = buildTokenPayload({
    runId: input.runId,
    userId: input.userId,
    score: input.score,
    timestamp: input.timestamp,
    version: signing.version,
    salt,
  });

  const payloadText = stableStringify(payload);
  const signature = await buildSignature(payloadText, secret);
  const token = `${payloadText}.${signature}`;

  const tokenHash = await sha256Hex(`${secret}:token:${token}`);
  const signatureHash = await sha256Hex(`${secret}:signature:${signature}`);

  return {
    token,
    tokenHash,
    signatureHash,
    signature,
    payload,
    salt,
    issuedAt,
    version: signing.version,
  };
}

export async function verifyRankedResultToken(input: {
  token: string;
  expectedTokenHash: string;
  expectedSignatureHash: string;
}): Promise<boolean> {
  const signing = getRankedResultSigningConfig();
  if (!signing.enabled) {
    return false;
  }

  const secret = getRankedResultSignatureSecret();
  const tokenHash = await sha256Hex(`${secret}:token:${input.token}`);
  if (!constantTimeEqual(tokenHash, input.expectedTokenHash)) {
    return false;
  }

  const separatorIndex = input.token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === input.token.length - 1) {
    return false;
  }

  const payloadText = input.token.slice(0, separatorIndex);
  const signature = input.token.slice(separatorIndex + 1);

  const expectedSignature = await buildSignature(payloadText, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  const signatureHash = await sha256Hex(`${secret}:signature:${signature}`);
  return constantTimeEqual(signatureHash, input.expectedSignatureHash);
}
