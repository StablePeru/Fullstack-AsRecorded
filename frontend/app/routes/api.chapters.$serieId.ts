// app/routes/api.chapters.$serieId.ts

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  /* 1. Exige sesión */
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    return json({ error: "No autenticado" }, { status: 401 });
  }

  /* 2. Valida el parámetro */
  const serieId = Number(params.serieId);
  if (isNaN(serieId) || serieId <= 0) {
    return json({ error: "ID de serie inválido" }, { status: 400 });
  }

  console.log(
    `[api.chapters.$serieId] Fetching chapters for serie ID: ${serieId}`
  );

  /* 3. Llama al backend reenviando la cookie */
  try {
    // La ruta del backend Flask es /api/series/:id/capitulos
    const res = await apiFetch(request, `/series/${serieId}/capitulos`);

    if (!res.ok) {
      let errorPayload = { error: `Error del API (${res.status}) al obtener capítulos` };
      try {
        const backendError = await res.json();
        if (backendError && backendError.error) {
          errorPayload.error = backendError.error; // Usar error específico del backend si existe
        }
      } catch (e) {
        console.warn(`[api.chapters.$serieId] API error response for /series/${serieId}/capitulos was not valid JSON. Status: ${res.status}`);
      }
      // Devolver el error como JSON, usando el status code del backend
      return json(errorPayload, { status: res.status });
    }

    // El backend Flask devuelve directamente el array [...].
    // Lo parseamos y lo devolvemos TAL CUAL, sin envolverlo.
    const capitulosArray = await res.json();

    // Validar si realmente es un array (puede que la API Flask cambie)
    if (!Array.isArray(capitulosArray)) {
        console.error(`[api.chapters.$serieId] API response for /series/${serieId}/capitulos was not an array as expected. Received:`, capitulosArray);
        return json({ error: "Respuesta inesperada del API al obtener capítulos." }, { status: 500 });
    }

    // Devolver directamente el array parseado
    return json(capitulosArray); // <--- CAMBIO CLAVE: Devolver el array directamente

  } catch (error) {
    // Manejar errores de red o excepciones durante la llamada a apiFetch
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api.chapters.$serieId] Error llamando a /series/${serieId}/capitulos:`, errorMessage);
    // Loguear el error completo si estamos en desarrollo para más detalles
    if (process.env.NODE_ENV === 'development') {
        console.error(error);
    }
    return json({ error: "Error interno del servidor al contactar el API." }, { status: 500 });
  }
}