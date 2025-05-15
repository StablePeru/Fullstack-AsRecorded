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
import { useState, useEffect } from "react";

import stylesheet from "./tailwind.css?url";

export function links() {
  return [{ rel: "stylesheet", href: stylesheet }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { authenticator } = await import("~/services/auth.server");
  try {
    const user = await authenticator.isAuthenticated(request);
    let userWithRole = user;
    if (user) {
      try {
        const res = await apiFetch(request, "/users/me");
        if (res.ok) {
          const { user: me } = await res.json();
          userWithRole = { ...user, rol: me.rol };
        } else {
          console.warn(`[root.loader] /users/me failed with status ${res.status}, but user ${user.id} is authenticated.`);
        }
      } catch (e) {
        console.warn("[root.loader] Could not fetch user role:", e);
      }
    }
    return json({ user: userWithRole });
  } catch (error) {
    console.error("--- [root.tsx Loader] Error during authentication check:", error);
    return json({ user: null });
  }
}

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const user = data?.user;

  const [isMounted, setIsMounted] = useState(false);
  // Initialize theme to 'light' (or your server's default) to match SSR
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Effect to run once on client mount to determine actual client theme
  useEffect(() => {
    setIsMounted(true); // Component is now mounted

    // Determine client's theme preference
    let clientInitialTheme: 'light' | 'dark' = 'light'; // Fallback
    const storedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (storedTheme) {
      clientInitialTheme = storedTheme;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      clientInitialTheme = 'dark';
    }
    
    // Update React state if different from SSR default
    // This will trigger a re-render with the correct client theme
    if (clientInitialTheme !== theme) {
      setTheme(clientInitialTheme);
    }
    // Note: The inline script already handled initial class on <html>.
    // This useEffect ensures React's state is in sync for subsequent logic.
  }, []); // Empty array means run once on mount

  // Effect to handle theme changes (e.g., from toggleTheme)
  useEffect(() => {
    // Only run if mounted to avoid issues during SSR or initial client render mismatch
    if (!isMounted) {
      return;
    }

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme, isMounted]); // Re-run when theme or isMounted changes

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <html lang="es" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>{user ? `AsRecorded (${user.nombre})` : "AsRecorded Gestor"}</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  // Default to 'light' if no preference set
                  var initialTheme = 'light'; 
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    initialTheme = 'dark';
                  }
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    // Explicitly remove 'dark' if 'light' or no preference
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950">
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50 flex-shrink-0">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500">
                AsRecorded
              </Link>
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
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                aria-label={theme === 'light' ? "Activar modo oscuro" : "Activar modo claro"}
                title={theme === 'light' ? "Activar modo oscuro" : "Activar modo claro"}
              >
                {/* Render icon based on theme, but ensure initial client render matches SSR */}
                {/* If SSR theme is 'light', it shows MoonIcon. Client must also show MoonIcon initially. */}
                {!isMounted || theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
              {user ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400">Hola, {user.nombre}!</span>
                  <Form method="post" action="/logout">
                    <button type="submit" className="btn btn-danger-sm">
                      Salir
                    </button>
                  </Form>
                </div>
              ) : (
                <Link to="/login" className="btn btn-primary btn-sm">
                  Iniciar Sesión
                </Link>
              )}
            </div>
          </nav>
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

        <main className="flex-grow container mx-auto p-4 md:p-6 overflow-y-auto">
          {children}
        </main>

        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  var initialTheme = 'light';
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    initialTheme = 'dark';
                  }
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8 border-2 border-red-400 dark:border-red-600 text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="mt-4 text-2xl font-bold text-red-600 dark:text-red-500">¡Oops! Algo salió mal.</h1>
          <h2 className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{title}</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400"><i>{status}: {message}</i></p>

          <div className="mt-6 space-y-3">
            <Link to="/" className="btn btn-primary w-full">
              Volver a la página principal
            </Link>
            {status === 401 && (
              <Link to="/login" className="btn btn-secondary w-full">
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