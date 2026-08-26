import type { SocialPlatform } from "./settings.js";

export type PublishResult = {
  externalPostId: string;
  externalUrl: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function jsonResponse(res: Response, label: string): Promise<Record<string, unknown>> {
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const detail = JSON.stringify(body).slice(0, 500);
    throw new Error(`${label} returned HTTP ${res.status}: ${detail}`);
  }
  return body;
}

async function publishThreads(text: string): Promise<PublishResult> {
  if (Array.from(text).length > 500) throw new Error("Threads post exceeds 500 characters");
  const userId = required("THREADS_USER_ID");
  const token = required("THREADS_ACCESS_TOKEN");
  const create = new URL(`https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads`);
  create.searchParams.set("media_type", "TEXT");
  create.searchParams.set("text", text);
  create.searchParams.set("access_token", token);
  const container = await jsonResponse(
    await fetch(create, { method: "POST", signal: AbortSignal.timeout(30_000) }),
    "Threads create"
  );
  const creationId = typeof container.id === "string" ? container.id : null;
  if (!creationId) throw new Error("Threads create response did not contain an id");

  const publish = new URL(`https://graph.threads.net/v1.0/${encodeURIComponent(userId)}/threads_publish`);
  publish.searchParams.set("creation_id", creationId);
  publish.searchParams.set("access_token", token);
  const posted = await jsonResponse(
    await fetch(publish, { method: "POST", signal: AbortSignal.timeout(30_000) }),
    "Threads publish"
  );
  const postId = typeof posted.id === "string" ? posted.id : null;
  if (!postId) throw new Error("Threads publish response did not contain an id");
  // The Graph id is not the public Threads shortcode, so do not manufacture a
  // permalink that could send an admin to the wrong page.
  return { externalPostId: postId, externalUrl: null };
}

async function publishBluesky(text: string, linkUrl: string): Promise<PublishResult> {
  if (Array.from(text).length > 300) throw new Error("Bluesky post exceeds 300 characters");
  const identifier = required("BLUESKY_IDENTIFIER");
  const password = required("BLUESKY_APP_PASSWORD");
  const pds = (process.env.BLUESKY_PDS_URL?.trim() || "https://bsky.social").replace(/\/$/, "");

  const session = await jsonResponse(
    await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
      signal: AbortSignal.timeout(30_000),
    }),
    "Bluesky sign-in"
  );
  const accessJwt = typeof session.accessJwt === "string" ? session.accessJwt : null;
  const did = typeof session.did === "string" ? session.did : null;
  if (!accessJwt || !did) throw new Error("Bluesky sign-in response was incomplete");

  const linkIndex = text.lastIndexOf(linkUrl);
  if (linkIndex < 0) throw new Error("Bluesky post is missing its link URL");
  const byteStart = Buffer.byteLength(text.slice(0, linkIndex), "utf8");
  const byteEnd = byteStart + Buffer.byteLength(linkUrl, "utf8");
  const created = await jsonResponse(
    await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessJwt}`, "content-type": "application/json" },
      body: JSON.stringify({
        repo: did,
        collection: "app.bsky.feed.post",
        record: {
          $type: "app.bsky.feed.post",
          text,
          createdAt: new Date().toISOString(),
          langs: ["en"],
          facets: [
            {
              index: { byteStart, byteEnd },
              features: [{ $type: "app.bsky.richtext.facet#link", uri: linkUrl }],
            },
          ],
        },
      }),
      signal: AbortSignal.timeout(30_000),
    }),
    "Bluesky publish"
  );
  const uri = typeof created.uri === "string" ? created.uri : null;
  if (!uri) throw new Error("Bluesky publish response did not contain a uri");
  const rkey = uri.split("/").at(-1)!;
  return { externalPostId: uri, externalUrl: `https://bsky.app/profile/${did}/post/${rkey}` };
}

export async function publishToPlatform(
  platform: Exclude<SocialPlatform, "x">,
  text: string,
  linkUrl: string
): Promise<PublishResult> {
  return platform === "threads" ? publishThreads(text) : publishBluesky(text, linkUrl);
}
