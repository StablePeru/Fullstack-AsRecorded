/**
 *  app/routes/api.chapters.$serieId.ts
 *  Resource route: devuelve los capítulos de una serie
 *  (se llama desde fetcher.load(...) en SeriesList)
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  /* 1. Exige sesión: si no hay, Remix redirige a /login (o devuelve 401 si es un fetch) */
  // Para resource routes llamadas por fetch, failureRedirect no funciona como en las UI routes.
  // authenticator.isAuthenticated devolverá null si no está autenticado.
  // O lanzará una Response si se configura `throwOnError: true` o si la estrategia lo hace.
  // Es importante manejar el caso de no autenticado devolviendo un error JSON apropiado.
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    // Si la solicitud es de un fetcher/loader del lado del cliente, esto devolverá un 401
    // que puede ser manejado por el ErrorBoundary de la ruta que lo llamó o globalmente.
    return json({ error: "No autenticado" }, { status: 401 });
  }

  /* 2. Valida el parámetro */
  const serieId = Number(params.serieId);
  if (isNaN(serieId) || serieId <= 0) { // Validación un poco más robusta
    return json({ error: "ID de serie inválido" }, { status: 400 });
  }

  console.log(
    `[api.chapters.$serieId] Fetching chapters for serie ID: ${serieId}`
  );

  /* 3. Llama al backend reenviando la cookie */
  try {
    const res = await apiFetch(request, `/series/${serieId}/capitulos`);

    if (!res.ok) {
      let errorPayload = { error: `Error del API al obtener capítulos: ${res.status}` };
      try {
        // Intenta parsear el error específico del API backend
        const backendError = await res.json();
        if (backendError && backendError.error) {
          errorPayload.error = backendError.error;
        }
      } catch (e) {
        // No se pudo parsear el JSON del error, usar el mensaje genérico
        console.warn(`[api.chapters.$serieId] API error response for /series/${serieId}/capitulos was not valid JSON. Status: ${res.status}`);
      }
      return json(errorPayload, { status: res.status });
    }

    // Asumimos que la API devuelve directamente el array de capítulos o un objeto que los contiene.
    // Si la API devuelve { "data": [...] } o similar, ajusta esto.
    const capitulos = await res.json();
    return json({ capitulos }); // { capitulos: [...] }

  } catch (error) {
    console.error(`[api.chapters.$serieId] Error catastrófico al llamar a /series/${serieId}/capitulos:`, error);
    return json({ error: "Error interno del servidor al contactar el API." }, { status: 500 });
  }
}