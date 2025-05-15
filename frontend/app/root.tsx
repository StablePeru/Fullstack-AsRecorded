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
  // useNavigation, // Eliminado ya que no se usará el indicador de carga global por ahora
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

// --- Icon Components ---
// (Podrían moverse a app/components/icons/index.tsx si crecen en número)
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
  </svg>
);
// --- End Icon Components ---

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const user = data?.user;

  const [isMounted, setIsMounted] = useState(false);
  // El estado 'theme' se sincroniza con la clase en `<html>` y `localStorage`.
  // El script en <head> establece la clase inicial para evitar FOUC.
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Intenta leer el tema del script inicial o localStorage al inicializar el estado.
    // Esto es un intento de que el estado de React coincida lo antes posible.
    if (typeof window !== 'undefined') {
      if (document.documentElement.classList.contains('dark')) {
        return 'dark';
      }
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light'; // Default theme
  });

  // Sincroniza el tema con el DOM y localStorage cuando el estado `theme` cambia.
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Solo guardar en localStorage si estamos en el cliente y el tema ha sido montado/establecido
    if (isMounted) {
      localStorage.setItem('theme', theme);
    }
  }, [theme, isMounted]);
  
  // Marca como montado después del primer render en el cliente.
  useEffect(() => {
    setIsMounted(true);
  }, []);


  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
     <html lang="es" className="h-full" suppressHydrationWarning> {/* suppressHydrationWarning por el tema */}
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Título base. Las rutas específicas lo sobreescribirán/complementarán con <Meta /> */}
        <title>AsRecorded Gestor</title> 
        <Meta /> 
        <Links />
        {/* Script para aplicar el tema oscuro/claro ANTES de que React se hidrate para evitar FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var cl = document.documentElement.classList;
                var theme = localStorage.getItem('theme');
                try {
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    cl.add('dark');
                  } else {
                    cl.remove('dark'); // Asegura que 'dark' se remueva si no es el tema
                  }
                } catch (e) { /* localStorage puede fallar en algunos entornos (ej. iframes sandbox) */ }
              })();
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950">
        {/* Header de la aplicación */}
        <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm sticky top-0 z-50 flex-shrink-0">
          <nav className="container mx-auto px-4 py-3 flex justify-between items-center" aria-label="Navegación principal">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded-sm">
                AsRecorded
              </Link>
              {/* Navegación para pantallas grandes */}
              <div className="hidden md:flex items-center space-x-4 font-medium text-sm">
                <Link to="/" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-sm px-1">Inicio</Link>
                {user && (
                  <>
                    <Link to="/series" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-sm px-1">Series</Link>
                    {user.rol === "admin" && (
                      <Link to="/admin/user" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-sm px-1">Usuarios</Link>
                    )}
                  </>
                )}
              </div>
            </div>
            {/* Controles de usuario y tema */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleTheme}
                type="button" // Buena práctica para botones que no envían formularios
                className="p-2 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
                aria-label={theme === 'light' ? "Activar modo oscuro" : "Activar modo claro"}
                title={theme === 'light' ? "Activar modo oscuro" : "Activar modo claro"}
              >
                {/* El icono se renderiza basado en el tema, pero `isMounted` ayuda a evitar un flash si el SSR difiere del cliente inicial */}
                {isMounted ? (theme === 'light' ? <MoonIcon /> : <SunIcon />) : <MoonIcon /> /* Default a MoonIcon antes de montar */}
              </button>
              {user ? (
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-400" aria-label={`Usuario conectado: ${user.nombre}`}>Hola, {user.nombre}!</span>
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
          {/* Navegación para pantallas pequeñas (móvil) */}
          <div className="md:hidden border-t border-gray-200 dark:border-gray-700 px-2 py-2 space-x-2 text-center" role="navigation" aria-label="Navegación móvil">
             <Link to="/" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md focus-visible:ring-1 focus-visible:ring-indigo-500">Inicio</Link>
              {user && (
                <>
                  <Link to="/series" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md focus-visible:ring-1 focus-visible:ring-indigo-500">Series</Link>
                  {user.rol === "admin" && (
                    <Link to="/admin/user" className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-sm px-2 py-1 rounded-md focus-visible:ring-1 focus-visible:ring-indigo-500">Usuarios</Link>
                  )}
                </>
              )}
          </div>
        </header>

        {/* Contenido principal de la página */}
        <main id="main-content" className="flex-grow container mx-auto p-4 md:p-6 overflow-y-auto">
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

// ErrorBoundary con mejoras de accesibilidad y estructura
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("--- Root Error Boundary Caught ---:", error);

  let status = 500;
  let heading = "Error Inesperado"; // Cambiado a 'heading' para claridad semántica
  let message = "Ha ocurrido un error procesando tu solicitud.";
  let stackTrace = null;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    heading = `Error ${status}`;
    message = error.data?.message || error.statusText || "Error de servidor.";
    if (process.env.NODE_ENV === 'development' && error.data?.stack) {
      stackTrace = error.data.stack;
    }
  } else if (error instanceof Error) {
    heading = "Error en la Aplicación"; // Título más genérico para errores no HTTP
    message = error.message;
    if (process.env.NODE_ENV === 'development') {
      stackTrace = error.stack;
    }
  }

  const pageTitle = `${heading} - AsRecorded`;

  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <title>{pageTitle}</title>
        <Meta /> {/* Incluye metatags básicos si los hubiera */}
        <Links /> {/* Incluye el stylesheet */}
        {/* Script para aplicar el tema oscuro/claro ANTES de que React se hidrate */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var cl = document.documentElement.classList;
                var theme = localStorage.getItem('theme');
                try {
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    cl.add('dark');
                  } else {
                    cl.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
        <div role="alertdialog" aria-labelledby="error-heading" aria-describedby="error-message" className="max-w-md w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8 border-2 border-red-400 dark:border-red-600 text-center">
          <div className="mx-auto h-12 w-12 text-red-500 dark:text-red-400" aria-hidden="true"> {/* Icono decorativo */}
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 id="error-heading" className="mt-4 text-2xl font-bold text-red-600 dark:text-red-500">¡Oops! Algo salió mal.</h1>
          <h2 className="mt-2 text-lg font-semibold text-gray-700 dark:text-gray-300">{heading}</h2>
          <p id="error-message" className="mt-1 text-sm text-gray-500 dark:text-gray-400"><i>{message}</i></p>

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