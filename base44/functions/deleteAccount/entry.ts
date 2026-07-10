import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Clean up the user's push subscriptions before removing the account
    try {
      await base44.asServiceRole.entities.PushSubscription.deleteMany({
        created_by_id: userId,
      });
    } catch (_err) {
      // Best-effort cleanup; continue with account deletion
    }

    // Delete the user account (service role required for User writes)
    await base44.asServiceRole.entities.User.delete(userId);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});