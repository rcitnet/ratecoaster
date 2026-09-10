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
  linkUrl: string,
  imageUrl?: string
): Promise<PublishResult> {
  switch (platform) {
    case "threads": return publishThreads(text);
    case "bluesky": return publishBluesky(text, linkUrl);
    case "facebook": return publishFacebook(text, linkUrl);
    case "instagram": return publishInstagram(text, imageUrl);
    default: throw new Error(`Unsupported automatic social platform: ${platform}`);
  }
}

async function metaRequest(
  host: "graph.facebook.com" | "graph.instagram.com",
  path: string,
  token: string,
  fields: Record<string, string>,
  method: "GET" | "POST" = "POST"
): Promise<Record<string, unknown>> {
  const version = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  if (!/^v\d+\.0$/.test(version)) throw new Error("Invalid META_GRAPH_API_VERSION");
  const url = new URL(`https://${host}/${version}/${path}`);
  if (method === "GET") url.search = new URLSearchParams(fields).toString();
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}` },
    body: method === "POST" ? new URLSearchParams(fields) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.error) {
    // Meta errors can echo request data. Never persist raw responses or tokens.
    const error = data.error as { code?: unknown; error_subcode?: unknown } | undefined;
    const code = typeof error?.code === "number" ? `, code ${error.code}` : "";
    const subcode = typeof error?.error_subcode === "number" ? `, subcode ${error.error_subcode}` : "";
    throw new Error(`Meta ${path.split("/").at(-1)} failed (HTTP ${response.status}${code}${subcode}). Check account permissions, token validity and media readiness.`);
  }
  return data;
}

function metaId(data: Record<string, unknown>, label: string): string {
  if (typeof data.id !== "string" || !/^\d+(?:_\d+)?$/.test(data.id)) {
    throw new Error(`${label} response did not contain a valid id`);
  }
  return data.id;
}

async function publishFacebook(text: string, linkUrl: string): Promise<PublishResult> {
  if (Array.from(text).length > 63_206) throw new Error("Facebook post is too long");
  const pageId = encodeURIComponent(required("FACEBOOK_PAGE_ID"));
  const posted = await metaRequest("graph.facebook.com", `${pageId}/feed`, required("FACEBOOK_PAGE_ACCESS_TOKEN"), {
    message: text, link: linkUrl,
  });
  const id = metaId(posted, "Facebook publish");
  return { externalPostId: id, externalUrl: `https://www.facebook.com/${id}` };
}

async function publishInstagram(text: string, imageUrl?: string): Promise<PublishResult> {
  if (Array.from(text).length > 2200) throw new Error("Instagram caption exceeds 2200 characters");
  if (!imageUrl || new URL(imageUrl).protocol !== "https:") throw new Error("Instagram requires a public HTTPS JPEG image URL");
  const userId = encodeURIComponent(required("INSTAGRAM_USER_ID"));
  const token = required("INSTAGRAM_ACCESS_TOKEN");
  const container = await metaRequest("graph.instagram.com", `${userId}/media`, token, {
    image_url: imageUrl, caption: text,
  });
  const creationId = metaId(container, "Instagram create");
  // Wait for Meta to fetch/process the JPEG. Never recreate or republish after
  // an ambiguous result; the queue surfaces the failure for manual inspection.
  for (let attempt = 0; attempt < 6; attempt++) {
    const status = await metaRequest("graph.instagram.com", creationId, token, { fields: "status_code" }, "GET");
    if (status.status_code === "FINISHED") {
      const posted = await metaRequest("graph.instagram.com", `${userId}/media_publish`, token, { creation_id: creationId });
      const id = metaId(posted, "Instagram publish");
      // A permalink lookup failure must not turn a successful post into a retry.
      const media = await metaRequest("graph.instagram.com", id, token, { fields: "permalink" }, "GET").catch(() => ({}));
      const permalink = "permalink" in media ? media.permalink : null;
      const externalUrl = typeof permalink === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(permalink) ? permalink : null;
      return { externalPostId: id, externalUrl };
    }
    if (status.status_code !== "IN_PROGRESS") throw new Error(`Instagram container ${creationId} is not publishable; inspect it before retrying.`);
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`Instagram container ${creationId} is still processing; inspect it before retrying.`);
}
