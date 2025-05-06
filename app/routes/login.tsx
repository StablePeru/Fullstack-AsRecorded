// app/routes/login.tsx
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, Link } from "@remix-run/react";

import {
  sessionStorage,          // ← storage de Remix
  commitSession,            // ← helper para grabar la cookie __session
  getSession,
} from "~/services/session.server";

export const meta: MetaFunction = () => [{ title: "Iniciar Sesión" }];

/* -----------------------------------------------------------------------------
 * 1. Loader → si ya hay sesión, salta a /series.  También recupera errores
 * ---------------------------------------------------------------------------*/
export async function loader({ request }: LoaderFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");

  // redirige si ya está autenticado
  await authenticator.isAuthenticated(request, { successRedirect: "/series" });

  // si viene un mensaje de error en la sesión lo sacamos
  const session = await getSession(request.headers.get("Cookie"));
  const error = session.get(authenticator.sessionErrorKey);

  return json(
    { error },
    { headers: { "Set-Cookie": await commitSession(session) } },
  );
}

/* -----------------------------------------------------------------------------
 * 2. Action → procesa el <Form>, autentica y re‑emite cookie de Flask
 * ---------------------------------------------------------------------------*/
export async function action({ request }: ActionFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");

  // auténtica sin successRedirect para quedarnos con el usuario
  const user = await authenticator.authenticate("user-pass", request, {
    failureRedirect: "/login",
  });

  /* ---- grabamos la sesión __session de Remix ----------------------------- */
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set(authenticator.sessionKey, user);

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.commitSession(session));

  /* ---- re‑emitimos la cookie que mandó Flask (flask_session) ------------- */
  if (user.flaskCookie) {
    headers.append("Set-Cookie", user.flaskCookie);
  }

  return redirect("/series", { headers });
}

/* -----------------------------------------------------------------------------
 * 3. Componente React: formulario + mensajes de error
 * ---------------------------------------------------------------------------*/
export default function LoginPage() {
  const { error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errorMessage = error?.message ?? actionData?.error;

  return (
    <div
      style={{
        maxWidth: "400px",
        margin: "2rem auto",
        padding: "2rem",
        border: "1px solid #ccc",
        borderRadius: "8px",
      }}
    >
      <h2>Iniciar Sesión</h2>

      <Form
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <label
            htmlFor="nombre"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            Nombre de Usuario:
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            style={{ width: "100%", padding: "0.5rem" }}
            aria-describedby={errorMessage ? "login-error-message" : undefined}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            Contraseña:
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            style={{ width: "100%", padding: "0.5rem" }}
            aria-describedby={errorMessage ? "login-error-message" : undefined}
          />
        </div>

        {errorMessage && (
          <p
            id="login-error-message"
            style={{
              color: "red",
              marginTop: "1rem",
              border: "1px solid red",
              padding: "0.5rem",
            }}
          >
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </Form>

      <p style={{ marginTop: "1.5rem", textAlign: "center" }}>
        ¿No tienes cuenta?{" "}
        <Link to="/register" style={{ color: "#007bff", textDecoration: "underline" }}>
          Regístrate aquí
        </Link>
      </p>
    </div>
  );
}
