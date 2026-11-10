import { getStore } from "@netlify/blobs";

const store = getStore("naaz-plaza-videos");
const KEY = "video-list";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

async function getVideos() {
  return (await store.get(KEY, { type: "json" })) || [];
}

function authorized(request) {
  const secret = process.env.ADMIN_TOKEN;
  return !!secret &&
    request.headers.get("authorization") === `Bearer ${secret}`;
}

export default async (request) => {
  try {
    if (request.method === "GET") {
      return json({ videos: await getVideos() });
    }

    if (!authorized(request)) {
      return json({ error: "Unauthorized access" }, 401);
    }

    if (request.method === "POST") {
      const body = await request.json();

      if (body.action === "check") {
        return json({ success: true });
      }

      const { id, title, short } = body;

      if (
        typeof id !== "string" ||
        !/^[A-Za-z0-9_-]{11}$/.test(id) ||
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 150
      ) {
        return json({ error: "Invalid video details" }, 400);
      }

      const videos = await getVideos();

      if (videos.some(v => v.id === id)) {
        return json({ error: "Video already published" }, 409);
      }

      videos.unshift({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: title.trim(),
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        short: Boolean(short)
      });

      await store.setJSON(KEY, videos);
      return json({ success: true });
    }

    if (request.method === "DELETE") {
      const body = await request.json();
      const videos = await getVideos();
      const updated = videos.filter(v => v.id !== body.id);

      if (updated.length === videos.length) {
        return json({ error: "Video not found" }, 404);
      }

      await store.setJSON(KEY, updated);
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: "Server error" }, 500);
  }
};
