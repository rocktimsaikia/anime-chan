import type { NextFunction, Request, Response } from "express";
import { prisma } from "~/libs/prisma";
import { rateLimitOnApiKey, rateLimitOnIP } from "~/libs/rate-limit";
import { redisClient } from "~/libs/redis";
import { isProtectedEndpoint, isValidEndpoint } from "./auth.util";

export const protectedRoutes = async (req: Request, res: Response, next: NextFunction) => {
	// If endpoint is not valid at all, return 404
	// No need to hit the Redis nor the main db.
	if (!isValidEndpoint(req.path)) {
		return res.status(404).json({ message: "Endpoint not found" });
	}

	// Verification for protected endpoints
	const reqApiKey = req.headers["x-api-key"] as string;

	if (!reqApiKey) {
		// If no API key is provided and the requested endpoint is protected
		// Return 401 immediately and end the request.
		if (isProtectedEndpoint(req.url)) {
			return res.status(401).json({ message: "Unauthorized. Missing API key!" });
		}

		// If no API key is provided and the requested endpoint is FREE
		// Continue to the request with IP based rate limiting.
		return rateLimitOnIP(req, res, next);
	}

	// Below we put all the validations if an potential API key
	// is found in the incoming API request headers.
	if (!reqApiKey.startsWith("ani-") || reqApiKey.length < 60) {
		return res.status(401).json({ message: "Unauthorized. Invalid API key!" });
	}

	// Check if the API key is already cached in Redis store.
	// If it is that means, it is a valid key since we only store
	// valid keys in Redis.
	const cachedApiKey = await redisClient.get(`rl_api:${reqApiKey}`);

	// If it is not in the cache, lastly check if it is in the database
	// and add it to the cache if found. Else return 401.
	if (!cachedApiKey) {
		const apiKeyObj = await prisma.apiKey.findUnique({
			where: { key: reqApiKey },
		});
		if (!apiKeyObj) {
			console.log("db check");
			return res.status(401).json({ message: "Invalid API key" });
		}
	}
	return rateLimitOnApiKey(reqApiKey)(req, res, next);
};
