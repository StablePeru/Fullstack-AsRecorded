// app/root.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { apiFetch } from "~/utils/api.server";
import {
  Form,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";

import stylesheet from "./tailwind.css?url";

export function links() {
  return [{ rel: "stylesheet", href: stylesheet }];
}

/**
 * Loader function to fetch user authentication status and role.
 * This data is made available to the Layout component.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");

  try {
    console.log("--- [root.tsx Loader] Calling authenticator.isAuthenticated...");
    const user = await authenticator.isAuthenticated(request);

    let userWithRole = user;
    if (user) {
      try {
        const res = await apiFetch(request, "/users/me");
        if (res.ok) {
          const { user: me } = await res.json();
          userWithRole = { ...user, rol: me.rol };
        }
      } catch (e) {
        console.warn("[root.loader] Could not fetch user role:", e);
      }
    }

    console.log("--- [root.tsx Loader] isAuthenticated success, user:", userWithRole);
    return json({ user: userWithRole });
  } catch (error) {
    console.error("--- [root.tsx Loader] Error:", error);
    return json({ user: null });
  }
}

/**
 * Main layout component for the application.
 * Renders the header, main content area, and global scripts.
 */
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const user = data?.user;

  return (
    <html lang="es" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>{user ? `AsRecorded (${user.nombre})` : "AsRecorded Gestor"}</title>
      </head>
      <body className="h-full flex flex-col text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950">
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {/* Application Logo/Title Link */}
              <Link to="/" className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500">
                AsRecorded
              </Link>
              {/* Main navigation links - hidden on small screens */}
              <div className="hidden md:flex items-center space-x-4 font-medium text-sm">
                <Link to="/" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Inicio</Link>
                {user && (
                  <>
                    <Link to="/series" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Series</Link>
                    {user.rol === "admin" && (
                      <Link to="/admin/user" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400">Usuarios</Link>
                    )}
                  </>
                )}
              </div>
            </div>
            <div>
              {user ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* User greeting - hidden on extra-small screens */}
                  <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">Hola, {user.nombre}!</span>
                  <Form method="post" action="/logout">
                    <button
                      type="submit"
                      className="btn btn-danger-sm"
                    >
                      Salir
                    </button>
                  </Form>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="btn btn-primary btn-sm"
                >
                  Iniciar Sesión
                </Link>
              )}
            </div>
          </nav>
          {/* Mobile navigation - shows main links for smaller screens */}
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-2 py-2 space-x-2 text-center">
             <Link to="/" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md">Inicio</Link>
              {user && (
                <>
                  <Link to="/series" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md">Series</Link>
                  {user.rol === "admin" && (
                    <Link to="/admin/user" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md">Usuarios</Link>
                  )}
                </>
              )}
          </div>
        </header>
        <main className="flex-grow container mx-auto p-4 md:p-6">
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Default export for the application root.
 * Renders the matched child route via <Outlet />.
 */
export default function App() {
  return <Outlet />;
}

/**
 * Error boundary for the root of the application.
 * Catches and displays errors that occur during rendering or in loaders/actions.
 */
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("--- Root Error Boundary Caught ---:", error);

  let status = 500;
  let title = "Error Inesperado";
  let message = "Ha ocurrido un error procesando tu solicitud.";
  let stackTrace = null;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    title = `Error ${status}`;
    message = error.data?.message || error.statusText || "Error de servidor.";
    if (process.env.NODE_ENV === 'development' && error.data?.stack) {
      stackTrace = error.data.stack;
    }
  } else if (error instanceof Error) {
    title = "Error en la Aplicación";
    message = error.message;
    if (process.env.NODE_ENV === 'development') {
      stackTrace = error.stack;
    }
  }

  return (
    <html lang="es" className="h-full">
      <head>
        <title>{title} - AsRecorded</title>
        <Meta />
        <Links />
      </head>
      <body className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
        {/* Custom styled error page, not using .card to allow specific error styling */}
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8 border-2 border-red-400 dark:border-red-600 text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-red-600 dark:text-red-500">¡Oops! Algo salió mal.</h1>
          <h2 className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400"><i>{status}: {message}</i></p>

          <div className="mt-6 space-y-3">
            <Link
              to="/"
              className="btn btn-primary w-full"
            >
              Volver a la página principal
            </Link>
            {status === 401 && ( // Show login link for unauthenticated errors
              <Link
                to="/login"
                className="btn btn-secondary w-full"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          {process.env.NODE_ENV === 'development' && stackTrace && (
            <div className="mt-6 text-left">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Detalles del error (solo en desarrollo):</p>
              <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-all">
                {stackTrace}
              </pre>
            </div>
          )}
        </div>
        <Scripts />
      </body>
    </html>
  );
}