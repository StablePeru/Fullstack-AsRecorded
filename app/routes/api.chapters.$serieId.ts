// frontend/app/routes/api.chapters.$serieId.ts
// NOTA: El nombre del archivo define la URL: /api/chapters/:serieId

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticator } from "~/services/auth.server"; // ¡Importante para seguridad!

// Reutiliza la interfaz si ya la tienes definida en otro lugar
interface Capitulo {
  id: number;
  numero_capitulo: number;
  titulo_capitulo: string | null;
}

type LoaderData = {
    capitulos: Capitulo[];
    error?: string;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  // 1. Proteger la ruta de API también
  const user = await authenticator.isAuthenticated(request);
  if (!user) {
    // Si no está autenticado, no devolvemos datos
    return json({ error: "No autorizado" }, { status: 401 });
  }

  // 2. Obtener y validar serieId
  const serieIdStr = params.serieId;
   if (!serieIdStr) {
    return json({ error: "ID de Serie no proporcionado" }, { status: 400 });
  }
  const serieId = parseInt(serieIdStr, 10);
  if (isNaN(serieId)) {
    return json({ error: "ID de Serie inválido" }, { status: 400 });
  }

  // 3. Obtener API URL y hacer fetch
  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    console.error("LOADER /api/chapters: API_BASE_URL no configurado");
    return json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  let capitulos: Capitulo[] = [];
  let errorMsg: string | undefined = undefined;

  try {
    console.log(`RESOURCE ROUTE /api/chapters: Fetching chapters for serie ID ${serieId}`);
    // Llama a tu endpoint Flask existente
    const response = await fetch(`${apiBaseUrl}/series/${serieId}/capitulos`);

    if (!response.ok) {
      errorMsg = `Error API (${response.status}) al obtener capítulos.`;
      // Podrías intentar leer el error de la API Flask si lo devuelve en JSON
      try { const data = await response.json(); errorMsg = data.error || errorMsg;} catch(e){}
      return json({ error: errorMsg }, { status: response.status });
    }

    capitulos = await response.json() as Capitulo[];
    console.log(`RESOURCE ROUTE /api/chapters: Fetched ${capitulos.length} chapters.`);
    return json({ capitulos }); // Devuelve solo los capítulos en caso de éxito

  } catch (error) {
    console.error(`RESOURCE ROUTE /api/chapters: Fetch error for ID ${serieId}:`, error);
    return json({ error: "Error de conexión al cargar capítulos." }, { status: 500 });
  }
}