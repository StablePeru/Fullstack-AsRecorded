// app/services/auth.server.ts
import { Authenticator } from "remix-auth";
import { FormStrategy } from "remix-auth-form";
import { sessionStorage } from "./session.server";

console.log("📥  [auth.server.ts] Iniciando…");

// -----------------------------------------------------------------------------
// 1.  Tipo de los datos que queremos guardar en la cookie __session de Remix
// -----------------------------------------------------------------------------
export interface UserSession {
  id: number;
  nombre: string;
  /** Cabecera Set‑Cookie que llega de Flask; se re‑emitirá en /login */
  flaskCookie?: string;
}

// -----------------------------------------------------------------------------
// 2.  Instancia del Authenticator – usa la storage creada en session.server.ts
// -----------------------------------------------------------------------------
export const authenticator = new Authenticator<UserSession>(sessionStorage);
console.log("✅  Authenticator creado (remix-auth)");

// -----------------------------------------------------------------------------
// 3.  Estrategia de formulario (username / password)
// -----------------------------------------------------------------------------
authenticator.use(
  new FormStrategy(async ({ form }) => {
    const nombre = form.get("nombre") as string;
    const password = form.get("password") as string;

    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) {
      throw new Error("API_BASE_URL no está configurado");
    }

    // -------------------------------------------------------------------------
    // 3.1 Llamamos al endpoint /api/login del backend Flask
    // -------------------------------------------------------------------------
    const response = await fetch(`${apiBaseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, password }),
    });

    // Capturamos la cabecera Set‑Cookie que devuelve Flask
    const flaskCookie = response.headers.get("set-cookie") ?? undefined;

    // -------------------------------------------------------------------------
    // 3.2 Gestionamos posibles errores de la API
    // -------------------------------------------------------------------------
    if (!response.ok) {
      let msg = `Error ${response.status}`;
      try {
        const json = await response.json();
        msg = json?.error ?? msg;
      } catch {
        /* cuerpo no‑JSON: dejamos el mensaje por defecto */
      }
      throw new Error(msg);
    }

    // -------------------------------------------------------------------------
    // 3.3 Extraemos el cuerpo JSON con los datos del usuario
    // -------------------------------------------------------------------------
    type ApiLoginResponse = { user?: { id: number; nombre: string } };

    let data: ApiLoginResponse;
    try {
      data = (await response.json()) as ApiLoginResponse;
    } catch {
      throw new Error("Respuesta de login no es JSON válido");
    }

    if (!data?.user?.id || !data.user.nombre) {
      throw new Error("La API de login no devolvió los datos esperados");
    }

    // Devolvemos el objeto que irá a la cookie __session de Remix
    return {
      id: data.user.id,
      nombre: data.user.nombre,
      flaskCookie,
    } satisfies UserSession;
  }),
  "user-pass", // nombre de la estrategia
);

console.log("🛠️  FormStrategy (user-pass) registrada");
console.log("🏁  [auth.server.ts] Listo");
