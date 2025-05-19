// app/routes/api.export-chapter.$capituloId.ts
import type { LoaderFunctionArgs } from "@remix-run/node";
import nodePkg from "@remix-run/node"; // <--- IMPORTACIÓN POR DEFECTO
const { Response } = nodePkg;          // <--- DESESTRUCTURACIÓN
import { authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    failureRedirect: "/login", // O manejar el error de otra forma
  });

  const capituloId = params.capituloId;
  if (!capituloId || isNaN(Number(capituloId))) {
    return new Response("ID de capítulo inválido", { status: 400 });
  }

  try {
    // apiFetch se encarga de la autenticación hacia tu API Flask
    const apiResponse = await apiFetch(request, `/capitulos/${capituloId}/export/excel`);

    if (!apiResponse.ok) {
      // Intentar obtener el mensaje de error del API si es JSON
      let errorMessage = `Error ${apiResponse.status} desde el API: ${apiResponse.statusText}`;
      try {
        const errorJson = await apiResponse.json();
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch (e) {
        // No era JSON o no tenía .error
      }
      return new Response(errorMessage, { status: apiResponse.status });
    }

    // Obtener el cuerpo del archivo como un stream o buffer
    const fileBuffer = await apiResponse.arrayBuffer();

    // Reenviar las cabeceras relevantes del API al cliente
    const headers = new Headers();
    const contentType = apiResponse.headers.get("Content-Type");
    const contentDisposition = apiResponse.headers.get("Content-Disposition");

    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    if (contentDisposition) {
      headers.set("Content-Disposition", contentDisposition);
    } else {
      // Nombre de archivo por defecto si el API no lo envía
      headers.set("Content-Disposition", `attachment; filename="capitulo_${capituloId}_export.xlsx"`);
    }
    headers.set("Content-Length", String(fileBuffer.byteLength));

    return new Response(fileBuffer, {
      status: 200,
      headers: headers,
    });

  } catch (error) {
    console.error("Error en la ruta de recurso de exportación:", error);
    return new Response("Error interno del servidor al procesar la exportación.", { status: 500 });
  }
}