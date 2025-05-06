// app/root.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData, // Hook para datos del loader (en Layout)
  useRouteError, // Hook para errores (en ErrorBoundary)
  isRouteErrorResponse, // Helper para errores
} from "@remix-run/react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Importa DENTRO del loader
  const { authenticator } = await import("~/services/auth.server");
  try {
    console.log("--- [root.tsx Loader] Calling authenticator.isAuthenticated...");
    const user = await authenticator.isAuthenticated(request);
    console.log("--- [root.tsx Loader] isAuthenticated call successful, user:", user);
    return json({ user });
  } catch (error) {
     console.error("--- [root.tsx Loader] Error during isAuthenticated call:", error);
     return json({ user: null });
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  // Obtiene los datos EXCLUSIVAMENTE del loader
  const data = useLoaderData<typeof loader>(); // <--- Obtiene { user: UserSession | null }
  const user = data?.user; // Acceso seguro

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Ajusta el título basado en si 'user' existe */}
        <title>{user ? `Gestor (${user.nombre})` : "Gestor de Guiones"}</title>
      </head>
      <body>
        <header style={{ padding: '1rem', borderBottom: '1px solid #eee' }}>
          <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Link to="/">Inicio</Link>
              {user && (
                <>
                  {' | '} <Link to="/series">Series</Link>
                </>
              )}
            </div>
            <div>
              {user ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>Hola, {user.nombre}!</span>
                  <Form method="post" action="/logout">
                    <button type="submit">Salir</button>
                  </Form>
                </div>
              ) : (
                <Link to="/login">Iniciar Sesión</Link>
              )}
            </div>
          </nav>
        </header>
        <main style={{ padding: '1rem' }}>
          {children}
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// --- Componente Principal (Default Export) ---
// Renderiza el Outlet DENTRO del Layout definido arriba
export default function App() {
  return <Outlet />;
}

// --- Error Boundary (NUEVO Y ESENCIAL) ---
// Se renderiza en lugar de Layout/App cuando hay un error
export function ErrorBoundary() {
  const error = useRouteError();
  console.error("--- Root Error Boundary Caught ---:", error);

  // ... (lógica para mostrar el error, se mantiene igual) ...
  // Asegúrate de que esta parte NO intenta usar 'authenticator' ni nada de '.server.ts'

  let status = 500;
  let title = "Error Inesperado";
  let message = "Ha ocurrido un error procesando tu solicitud.";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    title = `Error ${status}`;
    message = error.data?.message || error.statusText || "Error de servidor.";
     // Si el error original fue el TypeError por llamar a isAuthenticate,
     // ahora no debería ocurrir, pero si ocurriera otro error en el loader:
     // podrías intentar mostrar más detalles específicos aquí si los tienes en error.data
  } else if (error instanceof Error) {
    title = "Error en la Aplicación";
    message = error.message;
    // Si el error original fue el TypeError, ahora este caso no debería darse por esa causa.
  }

  return (
    <div style={{ padding: '1rem', textAlign: 'center', border: '2px dashed red', margin: '1rem' }}>
      <h1>Oops! Algo salió mal.</h1>
      <h2>{title}</h2>
      <p><i>{status}: {message}</i></p>
      <p><Link to="/">Volver a la página principal</Link></p>
      {status === 401 && <p><Link to="/login">Iniciar Sesión</Link></p>}
      {/* Puedes añadir más detalles o logs aquí si estás en desarrollo */}
      {process.env.NODE_ENV === 'development' && error instanceof Error && (
        <pre style={{ marginTop: '1rem', textAlign: 'left', background: '#eee', padding: '0.5rem', overflowX: 'auto' }}>
          {error.stack}
        </pre>
      )}
    </div>
  );
}