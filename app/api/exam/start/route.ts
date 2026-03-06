import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";

import { api } from "@/convex/_generated/api";

const startExamRequestSchema = z.object({
  rulesAcknowledged: z.literal(true),
  readinessAcknowledged: z.literal(true),
  rulesViewDurationMs: z.number().finite().nonnegative(),
  stableInternetConfirmed: z.boolean(),
});

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

interface SuccessBody {
  success: true;
  data: {
    examAttemptId: string;
    startedAt: number;
  };
}

function errorResponse(status: number, code: string, message: string): Response {
  const body: ErrorBody = {
    success: false,
    error: {
      code,
      message,
    },
  };

  return Response.json(body, { status });
}

function getClientIpAddress(req: Request): string | undefined {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return undefined;
}

function parseBrowserFromUserAgent(userAgent: string | undefined): {
  browserFamily?: string;
  browserVersion?: string;
  browserSupported: boolean;
} {
  if (!userAgent) {
    return {
      browserSupported: false,
    };
  }

  const matchers = [
    { family: "Edge", regex: /Edg\/([\d.]+)/i },
    { family: "Chrome", regex: /Chrome\/([\d.]+)/i },
  ] as const;

  for (const matcher of matchers) {
    const match = userAgent.match(matcher.regex);
    if (match) {
      return {
        browserFamily: matcher.family,
        browserVersion: match[1],
        browserSupported: true,
      };
    }
  }

  return {
    browserSupported: false,
  };
}

export async function POST(req: Request) {
  let requestBody: unknown;
  try {
    requestBody = await req.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsedBody = startExamRequestSchema.safeParse(requestBody);
  if (!parsedBody.success) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Invalid exam start request payload."
    );
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return errorResponse(
      500,
      "SERVER_MISCONFIGURED",
      "Convex URL is not configured."
    );
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return errorResponse(
      401,
      "CONVEX_TOKEN_MISSING",
      "Could not obtain an authenticated Convex token."
    );
  }

  const userAgent = req.headers.get("user-agent") ?? undefined;
  const browser = parseBrowserFromUserAgent(userAgent);
  const ipAddress = getClientIpAddress(req);

  try {
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);

    const result = await convex.mutation(api.exams.startOfficialExamAttempt, {
      ...parsedBody.data,
      ipAddress,
      userAgent,
      browserFamily: browser.browserFamily,
      browserVersion: browser.browserVersion,
      browserSupported: browser.browserSupported,
    });

    const response: SuccessBody = {
      success: true,
      data: {
        examAttemptId: result.examAttemptId,
        startedAt: result.startedAt,
      },
    };

    return Response.json(response, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start official exam attempt.";
    const conflictSignals = [
      "Only cadets can start",
      "Exam is unavailable",
      "Complete at least",
      "already have an official exam attempt",
      "acknowledge",
      "review the examination rules",
    ];
    const isBusinessConflict = conflictSignals.some((signal) =>
      message.toLowerCase().includes(signal.toLowerCase())
    );

    if (isBusinessConflict) {
      return errorResponse(409, "EXAM_START_REJECTED", message);
    }

    return errorResponse(500, "INTERNAL_ERROR", "Failed to start official exam.");
  }
}
