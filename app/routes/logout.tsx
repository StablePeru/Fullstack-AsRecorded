// app/routes/logout.tsx
import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

// El loader podría simplemente redirigir si se accede por GET
export async function loader() {
    return redirect("/");
}

// La acción se dispara con un POST (ej. desde un botón en un formulario)
export async function action({ request }: ActionFunctionArgs) {
    // 1. Llama al logout de Remix Auth para limpiar la sesión de Remix
    await authenticator.logout(request, { redirectTo: "/login" });

    // 2. (Opcional pero recomendado si Flask tiene su propia sesión) Llama a tu API Flask para invalidar su sesión
    const apiBaseUrl = process.env.API_BASE_URL;
    try {
        // IMPORTANTE: Necesitas pasar la cookie de sesión de Flask si existe y es necesaria.
        // Esto puede ser complejo si son dominios diferentes. Si corren en el mismo dominio base
        // o si manejas la autenticación del API de otra forma (ej. tokens), esto puede variar.
        // Para empezar, asumimos que la cookie se envía automáticamente si aplica, o que
        // el endpoint /api/logout de Flask invalida la sesión basada en la cookie que recibe.
        await fetch(`${apiBaseUrl}/logout`, {
            method: "POST",
            credentials: "include",
            headers: {
                // Si necesitas pasar la cookie manualmente (complejo):
                // 'Cookie': request.headers.get('Cookie') || ''
            }
        });
        console.info("Llamada a /api/logout de Flask realizada.")
    } catch (error) {
        console.error("Error llamando a /api/logout de Flask:", error);
        // No bloqueamos el logout de Remix si la llamada a Flask falla,
        // pero registramos el error.
    }

    // Nota: authenticator.logout ya se encarga de la redirección definida.
    // No necesitas retornar redirect() aquí si usaste redirectTo.
}