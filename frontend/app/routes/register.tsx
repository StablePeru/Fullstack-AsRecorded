// frontend/app/routes/register.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";

// Importa authenticator para comprobar si ya está logueado en el loader
import { authenticator } from "~/services/auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Registrar Nuevo Usuario" }];
};

// Loader: Si el usuario ya está logueado, no tiene sentido que vea el registro.
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    successRedirect: "/series",
  });
  return json({});
}


// Action: Maneja el envío del formulario de registro
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const nombre = formData.get("nombre") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;
  const rol = ((formData.get("rol") as string | null) ?? "tecnico").toLowerCase();

  // --- Validación ---
  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    return json({ error: "El nombre de usuario es obligatorio." }, { status: 400 });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return json({ error: "La contraseña es obligatoria y debe tener al menos 6 caracteres." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return json({ error: "Las contraseñas no coinciden." }, { status: 400 });
  }
  // --- Fin Validación ---

  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    console.error("API_BASE_URL no está configurado para la acción de registro.");
    return json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  try {
    console.log(`Register Action: Intentando registrar usuario ${nombre} en ${apiBaseUrl}/register`);
    const response = await fetch(`${apiBaseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nombre: nombre.trim(), password, rol }),
    });

    console.log(`Register Action: Respuesta API status: ${response.status}`);

    if (response.ok) {
      console.log(`Register Action: Usuario ${nombre} registrado exitosamente.`);
      return redirect("/login");
    } else {
      let errorMessage = `Error al registrar (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.warn("Register Action: No se pudo parsear JSON de la respuesta de error de la API.");
      }
      console.log(`Register Action: Fallo registro API: ${errorMessage}`);
      return json({ error: errorMessage }, { status: response.status });
    }

  } catch (error) {
    console.error("Register Action: Error durante fetch a /register:", error);
    return json({ error: "No se pudo conectar con el servicio de registro. Inténtalo más tarde." }, { status: 500 });
  }
}

// Componente: Muestra el formulario de registro y errores
export default function RegisterPage() {
  const actionData = useActionData<typeof action>();
  const hasError = Boolean(actionData?.error);

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900 dark:text-white">
          Registrar Nuevo Usuario
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <Form method="post" className="space-y-6">
          <div>
            <label
              htmlFor="nombre"
              className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200"
            >
              Nombre de Usuario
            </label>
            <div className="mt-2">
              <input
                type="text"
                id="nombre"
                name="nombre"
                required
                autoComplete="username"
                aria-describedby={hasError ? "form-error-message" : undefined}
                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-800 shadow-sm ring-1 ring-inset ${
                  hasError
                    ? "ring-red-500 focus:ring-red-500"
                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-600 dark:focus:ring-indigo-500"
                } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="rol"
              className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200"
            >
              Rol del usuario
            </label>
            <div className="mt-2">
              <select
                id="rol"
                name="rol"
                defaultValue="tecnico"
                aria-describedby={hasError ? "form-error-message" : undefined}
                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-800 shadow-sm ring-1 ring-inset ${
                  hasError
                    ? "ring-red-500 focus:ring-red-500"
                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-600 dark:focus:ring-indigo-500"
                } focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
              >
                <option value="tecnico">Técnico</option>
                <option value="director">Director</option>
                 {/* Podrías añadir más roles si es necesario, ej: <option value="admin">Administrador</option> */}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200"
            >
              Contraseña (mín. 6 caracteres)
            </label>
            <div className="mt-2">
              <input
                type="password"
                id="password"
                name="password"
                required
                minLength={6}
                autoComplete="new-password"
                aria-describedby={hasError ? "form-error-message" : undefined}
                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-800 shadow-sm ring-1 ring-inset ${
                  hasError
                    ? "ring-red-500 focus:ring-red-500"
                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-600 dark:focus:ring-indigo-500"
                } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200"
            >
              Confirmar Contraseña
            </label>
            <div className="mt-2">
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                required
                minLength={6}
                autoComplete="new-password"
                aria-describedby={hasError ? "form-error-message" : undefined}
                className={`block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white dark:bg-gray-800 shadow-sm ring-1 ring-inset ${
                  hasError
                    ? "ring-red-500 focus:ring-red-500"
                    : "ring-gray-300 dark:ring-gray-600 focus:ring-indigo-600 dark:focus:ring-indigo-500"
                } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6`}
              />
            </div>
          </div>

          {actionData?.error && (
            <div
              id="form-error-message" // ID para aria-describedby
              className="rounded-md bg-red-50 dark:bg-red-900/30 p-4" // Ajustado el fondo oscuro para el error
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    {actionData.error}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
            >
              Registrar
            </button>
          </div>
        </Form>

        <p className="mt-10 text-center text-sm text-gray-500 dark:text-gray-400">
          ¿Ya tienes cuenta?{" "}
          <Link
            to="/login"
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Inicia Sesión
          </Link>
        </p>
      </div>
    </div>
  );
}