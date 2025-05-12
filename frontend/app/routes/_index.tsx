// app/routes/_index.tsx
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { authenticator } from "~/services/auth.server"; // Necesario para obtener el usuario

export const meta: MetaFunction = () => {
  return [
    { title: "Bienvenido a AsRecorded" },
    { name: "description", content: "Gestor de Guiones de Doblaje AsRecorded" },
  ];
};

// Loader para obtener el estado del usuario
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);
  // No necesitamos la información del rol aquí, solo si hay un usuario o no.
  // Si quisieras el rol, tendrías que hacer la llamada a /users/me como en root.tsx
  return json({ user });
}

export default function Index() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-[calc(100vh-150px)] flex flex-col items-center justify-center text-center px-4 py-8">
      {/* El min-h es un cálculo aproximado para centrar el contenido verticalmente,
          asumiendo una altura de header de ~60-70px y algo de padding en main.
          Ajusta '150px' según la altura real de tu cabecera y el padding de <main> en root.tsx.
          O puedes usar `flex-grow` en el contenedor de <Outlet /> y `flex items-center justify-center` aquí directamente.
      */}

      <header className="mb-12">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-800 dark:text-white">
          Bienvenido a <span className="text-indigo-600 dark:text-indigo-400">AsRecorded</span>
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Tu plataforma centralizada para la gestión eficiente de guiones de doblaje.
        </p>
      </header>

      <main className="space-y-8">
        <section className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 md:p-8 max-w-lg mx-auto">
          <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
            Organiza tus Proyectos de Doblaje
          </h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Desde la importación de guiones hasta el seguimiento en sala, AsRecorded simplifica cada etapa del proceso.
            Gestiona series, capítulos, takes e intervenciones de forma intuitiva y colaborativa.
          </p>
        </section>

        {user ? (
          <section className="mt-8">
            <p className="text-lg text-gray-700 dark:text-gray-200 mb-2">
              ¡Hola de nuevo, <span className="font-semibold">{user.nombre}</span>!
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Listo para continuar gestionando tus proyectos?
            </p>
            <Link
              to="/series"
              className="inline-block px-8 py-3 text-lg font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Ir a Mis Series
            </Link>
          </section>
        ) : (
          <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-md mx-auto">
            <Link
              to="/login"
              className="block w-full px-6 py-3 text-lg font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="block w-full px-6 py-3 text-lg font-medium text-center text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 dark:text-indigo-300 dark:bg-indigo-900/50 dark:hover:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            >
              Registrarse
            </Link>
          </section>
        )}
      </main>

      <footer className="mt-16 text-sm text-gray-500 dark:text-gray-400">
        <p>© {new Date().getFullYear()} AsRecorded. Todos los derechos reservados.</p>
        <p className="mt-1">
          Una herramienta pensada para optimizar el flujo de trabajo en el doblaje.
        </p>
      </footer>
    </div>
  );
}