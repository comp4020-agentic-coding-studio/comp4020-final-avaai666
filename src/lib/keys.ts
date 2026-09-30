// An idempotency key is a lowercase UUID v4, made by the client per tap.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const isIdempotencyKey = (key: unknown): key is string => typeof key === "string" && UUID_V4.test(key);
