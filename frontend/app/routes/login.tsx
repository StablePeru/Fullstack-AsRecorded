// app/routes/login.tsx
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, Link } from "@remix-run/react"; // Eliminado useActionData ya que no se usa

import {
  sessionStorage,
  commitSession,
  getSession,
} from "~/services/session.server";

export const meta: MetaFunction = () => [{ title: "Iniciar Sesión - AsRecorded" }];

/* -----------------------------------------------------------------------------
 * 1. Loader → si ya hay sesión, salta a /series. También recupera errores
 * ---------------------------------------------------------------------------*/
export async function loader({ request }: LoaderFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");
  await authenticator.isAuthenticated(request, { successRedirect: "/series" });

  const session = await getSession(request.headers.get("Cookie"));
  const error = session.get(authenticator.sessionErrorKey); // El error es un objeto { message: string }

  // Limpiar el error de la sesión después de leerlo
  session.unset(authenticator.sessionErrorKey);

  return json(
    { error }, // error puede ser undefined si no hay error
    { headers: { "Set-Cookie": await commitSession(session) } },
  );
}

/* -----------------------------------------------------------------------------
 * 2. Action → procesa el <Form>, autentica y re‑emite cookie de Flask
 * ---------------------------------------------------------------------------*/
export async function action({ request }: ActionFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");

  // authenticator.authenticate manejará la redirección en caso de fallo a /login (y pondrá el error en la sesión)
  // o devolverá el usuario en caso de éxito.
  const user = await authenticator.authenticate("user-pass", request, {
    failureRedirect: "/login",
  });

  // Si llegamos aquí, la autenticación fue exitosa y 'user' tiene los datos.
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  session.set(authenticator.sessionKey, user);

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.commitSession(session));

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
  // El error viene del loader, que lo saca de la sesión.
  // El formato esperado de 'error' es un objeto como { message: "Mensaje de error" }
  // o undefined si no hay error.
  const errorMessage = error?.message;

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Puedes añadir un logo aquí si quieres */}
        {/* <img className="mx-auto h-10 w-auto" src="https://tailwindui.com/img/logos/mark.svg?color=indigo&shade=600" alt="AsRecorded" /> */}
        <h2 className="mt-6 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900 dark:text-white">
          Iniciar Sesión en AsRecorded
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <Form method="post" className="space-y-6">
          <div>
            <label htmlFor="nombre" className="form-label">
              Nombre de Usuario
            </label>
            <div className="mt-1"> {/* Ajustado margen de acuerdo a .form-label mb-1 */}
              <input
                id="nombre"
                name="nombre"
                type="text"
                autoComplete="username"
                required
                className={`input-text ${errorMessage ? "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                aria-describedby={errorMessage ? "login-error-message" : undefined}
                aria-invalid={!!errorMessage}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="mt-1"> {/* Ajustado margen */}
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={`input-text ${errorMessage ? "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
                aria-describedby={errorMessage ? "login-error-message" : undefined}
                aria-invalid={!!errorMessage}
              />
            </div>
          </div>

          {errorMessage && (
            <div id="login-error-message" className="alert alert-error" role="alert">
              <div className="flex"> {/* Contenedor flex para alinear icono y texto */}
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm"> {/* Ya no necesitamos font-medium aquí, alert-error lo maneja */}
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              className="btn btn-primary w-full" // Aplicado btn y w-full
            >
              Entrar
            </button>
          </div>
        </Form>

        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿No tienes cuenta?{" "}
          <Link
            to="/register"
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}