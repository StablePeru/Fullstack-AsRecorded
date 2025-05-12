// app/services/session.server.ts
import { createCookieSessionStorage } from "@remix-run/node"; // o "@remix-run/cloudflare" si aplica

console.log("--- [session.server.ts] START Executing ---"); // <-- NUEVO LOG

// Asegúrate que SESSION_SECRET está definida en tu docker-compose.yml para el frontend
// ¡CAMBIA "tu-secreto-largo-y-aleatorio-aqui" por uno real y seguro!
const sessionSecret = process.env.SESSION_SECRET;
console.log("--- [session.server.ts] SESSION_SECRET:", sessionSecret ? 'Defined' : '!!! UNDEFINED !!!'); // <-- NUEVO LOG
if (!sessionSecret) {
  console.error("--- [session.server.ts] FATAL: SESSION_SECRET must be set ---"); // <-- NUEVO LOG
  throw new Error("SESSION_SECRET must be set as an environment variable");
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session", // Nombre de la cookie
    httpOnly: true, // Impide acceso desde JavaScript del cliente
    path: "/",
    sameSite: "lax", // Protección CSRF
    secrets: [sessionSecret], // ¡Usa tu secreto real aquí!
    secure: process.env.NODE_ENV === "production", // True en producción (HTTPS)
    maxAge: 60 * 60 * 24 * 30, // Opcional: 30 días de duración
  },
});

console.log("--- [session.server.ts] sessionStorage created ---"); // <-- NUEVO LOG

export const { getSession, commitSession, destroySession } = sessionStorage;
console.log("--- [session.server.ts] END Executing ---"); // <-- NUEVO LOG