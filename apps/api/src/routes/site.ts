import { Hono } from "hono";
import { getHomepageSettings } from "../lib/site-settings.js";

export const siteRouter = new Hono();

siteRouter.get("/homepage", async (c) => c.json(await getHomepageSettings()));
