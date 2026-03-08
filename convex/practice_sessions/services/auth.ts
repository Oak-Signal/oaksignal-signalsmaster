import { Doc, Id } from "../../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../../_generated/server";

export type AuthenticatedCtx = QueryCtx | MutationCtx;

export async function getAuthenticatedUser(
	ctx: AuthenticatedCtx
): Promise<Doc<"users"> | null> {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) {
		return null;
	}

	return ctx.db
		.query("users")
		.withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
		.unique();
}

export async function requireAuthenticatedUser(
	ctx: AuthenticatedCtx,
	message = "Authentication is required."
): Promise<Doc<"users">> {
	const user = await getAuthenticatedUser(ctx);
	if (!user) {
		throw new Error(message);
	}
	return user;
}

export async function getOwnedSession(
	ctx: AuthenticatedCtx,
	userId: Id<"users">,
	sessionId: Id<"practiceSessions">,
	notFoundMessage = "Session not found or access denied"
): Promise<Doc<"practiceSessions">> {
	const session = await ctx.db.get(sessionId);
	if (!session || session.userId !== userId) {
		throw new Error(notFoundMessage);
	}
	return session;
}
