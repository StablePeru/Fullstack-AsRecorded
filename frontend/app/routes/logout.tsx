// app/routes/logout.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node"; // Añadido LoaderFunctionArgs
import { redirect } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";

// El loader podría simplemente redirigir si se accede por GET
export async function loader({ request }: LoaderFunctionArgs) { // Añadido request y tipo
    // Opcionalmente, podrías verificar si ya está deslogueado y redirigir
    // o simplemente siempre redirigir como medida de seguridad.
    // Si se accede a /logout vía GET, probablemente es un error o un intento manual.
    // Redirigir a la página de inicio o login es una buena práctica.
    console.log("--- [logout.tsx Loader] GET request to /logout, redirecting to /");
    return redirect("/");
}

// La acción se dispara con un POST (ej. desde un botón en un formulario)
export async function action({ request }: ActionFunctionArgs) {
    console.log("--- [logout.tsx Action] POST request to /logout, attempting logout...");

    // 1. Llama al logout de Remix Auth para limpiar la sesión de Remix
    // Esto ya se encarga de limpiar la cookie de sesión de Remix y redirigir.
    // La redirección a "/login" está especificada aquí.
    // await authenticator.logout(request, { redirectTo: "/login" });

    // 2. (Opcional pero recomendado si Flask tiene su propia sesión) Llama a tu API Flask para invalidar su sesión
    const apiBaseUrl = process.env.API_BASE_URL;
    if (apiBaseUrl) {
        try {
            console.log(`--- [logout.tsx Action] Calling Flask API logout endpoint: ${apiBaseUrl}/logout`);
            // Se intenta enviar la solicitud al backend de Flask.
            // `credentials: "include"` es importante si la sesión de Flask se basa en cookies HttpOnly
            // y ambos servicios (Remix y Flask) están bajo el mismo dominio o subdominios compatibles.
            const flaskLogoutResponse = await fetch(`${apiBaseUrl}/logout`, {
                method: "POST",
                credentials: "include", // Envía cookies que el navegador tenga para el dominio de la API
                headers: {
                    // No es común necesitar añadir la cookie manualmente aquí si 'credentials: "include"' funciona
                    // y el navegador gestiona el envío de la cookie de sesión de Flask.
                    // Si Flask espera un 'Authorization: Bearer <token>' y lo tienes en la sesión de Remix,
                    // tendrías que extraerlo y pasarlo aquí. Pero tu setup parece basarse en cookies.
                }
            });
            if (flaskLogoutResponse.ok) {
                console.info("--- [logout.tsx Action] Successfully called Flask API /logout.");
            } else {
                console.warn(`--- [logout.tsx Action] Flask API /logout call failed with status: ${flaskLogoutResponse.status}`);
            }
        } catch (error) {
            console.error("--- [logout.tsx Action] Error calling Flask API /logout:", error);
            // Aunque la llamada a Flask falle, el logout de Remix debería proceder.
            // El usuario será deslogueado de la parte de Remix.
        }
    } else {
        console.warn("--- [logout.tsx Action] API_BASE_URL not configured. Skipping Flask API logout call.");
    }

    // Realizar el logout de Remix Auth después de intentar el logout de Flask.
    // Esto asegura que la sesión de Remix se limpie y el usuario sea redirigido
    // incluso si la llamada a Flask tiene problemas.
    return await authenticator.logout(request, { redirectTo: "/login" });
}