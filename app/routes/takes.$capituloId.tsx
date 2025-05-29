// frontend/app/routes/takes.$capituloId.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { useState } from "react";

import { authenticator } from "~/services/auth.server";

// --- Interfaces (Duplicadas o importadas si las centralizas) ---
interface CapituloDetails {
  id: number;
  numero_capitulo: number;
  titulo_capitulo: string | null;
  serie_id: number; // Podrías necesitar esto para volver a la serie
}
interface Personaje { // Asumiendo que puede venir info extra
  id: number;
  nombre_personaje: string;
}
interface Intervencion {
  id: number;
  take_id: number;
  dialogo: string;
  completo: boolean;
  tc_in: string | null;
  tc_out: string | null;
  orden_en_take: number | null;
  personaje: string; // Simplificado desde la API
  // personaje: Personaje; // Si la API devolviera el objeto completo
}
interface Take {
  id: number;
  numero_take: number;
  tc_in: string | null;
  tc_out: string | null;
  intervenciones: Intervencion[];
}
type LoaderData = {
  capitulo: CapituloDetails | null;
  takes: Take[];
  error?: string;
};
// Tipo para la acción de actualizar estado
type ActionData = { ok: boolean; error?: string; interventionId?: number; newState?: boolean };

// --- Meta Función ---
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const numero = data?.capitulo?.numero_capitulo;
  const title = numero ? `Takes - Capítulo ${numero}` : "Takes del Capítulo";
  return [{ title }];
};

// --- Loader: Carga todo para el capítulo ---
export async function loader({ request, params }: LoaderFunctionArgs) {
  // Proteger
  const user = await authenticator.isAuthenticated(request, { failureRedirect: "/login" });

  const capituloIdStr = params.capituloId;
  if (!capituloIdStr) throw new Response("Falta ID Capítulo", { status: 400 });
  const capituloId = parseInt(capituloIdStr, 10);
  if (isNaN(capituloId)) throw new Response("ID Capítulo Inválido", { status: 400 });

  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) throw new Response("Error Configuración Servidor", { status: 500 });

  try {
    const capituloId = parseInt(params.capituloId!, 10); // Asumiendo que ya validaste
    const apiBaseUrl = process.env.API_BASE_URL!; // Asumiendo que ya validaste
    const cookieHeader = request.headers.get("Cookie") || "";
    console.log(`LOADER /takes: Forwarding Cookie Header for chapter ${capituloId}: "${cookieHeader}"`);
    console.log(`LOADER /takes: Fetching details for chapter ${capituloId}`);
    const response = await fetch(`${apiBaseUrl}/capitulos/${capituloId}/details`, {
        headers: {
            "Cookie": cookieHeader, // Reenvía la cabecera completa
        },
    });
    if (!response.ok) {
        let errorMsg = `Error API ${response.status}`;
        try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e){}
        console.error(`LOADER /takes: API error ${response.status} for chapter ${capituloId}: ${errorMsg}`);
        // Devuelve el error de la API
        return json<LoaderData>({ capitulo: null, takes: [], error: errorMsg }, { status: response.status });
      }
  
      const data = await response.json();
      console.log(`LOADER /takes: Fetched data for chapter ${capituloId}. Takes count: ${data.takes?.length}`);
      return json<LoaderData>({
          capitulo: data.capitulo,
          takes: data.takes || [],
      });
    } catch (error) {
      console.error(`LOADER /takes: Fetch error for chapter ${capituloId}:`, error);
      return json<LoaderData>({ capitulo: null, takes: [], error: "Error de conexión cargando datos." }, { status: 500 });
    }
  }

// --- Action: Maneja actualizaciones (ej. estado 'completo') ---
export async function action({ request, params }: ActionFunctionArgs) {
    const user = await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
    const apiBaseUrl = process.env.API_BASE_URL;
    if (!apiBaseUrl) return json<ActionData>({ ok: false, error: "Configuración inválida" }, { status: 500 });

    const formData = await request.formData();
    const actionType = formData.get("_action");

    if (actionType === "update_status") {
        const interventionIdStr = formData.get("interventionId") as string | null;
        const newStateStr = formData.get("newState") as string | null; // "true" o "false"

        if (!interventionIdStr || newStateStr === null) {
            return json<ActionData>({ ok: false, error: "Faltan datos para actualizar estado." }, { status: 400 });
        }

        const interventionId = parseInt(interventionIdStr, 10);
        const newState = newStateStr === 'true';

        if (isNaN(interventionId)) {
             return json<ActionData>({ ok: false, error: "ID Intervención inválido." }, { status: 400 });
        }

        try {
            console.log(`ACTION /takes: PATCHing status for intervention ${interventionId} to ${newState}`);
            const response = await fetch(`${apiBaseUrl}/intervenciones/${interventionId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ completo: newState }),
            });

            if (response.ok) {
                return json<ActionData>({ ok: true, interventionId, newState });
            } else {
                 let errorMsg = `Error API ${response.status}`;
                 try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e){}
                 return json<ActionData>({ ok: false, error: errorMsg, interventionId }, { status: response.status });
            }
        } catch (error: any) {
             console.error(`ACTION /takes: Fetch error updating status for ${interventionId}:`, error);
            return json<ActionData>({ ok: false, error: `Error conexión: ${error.message}`, interventionId }, { status: 500 });
        }
    }
    // Añadir más 'else if' para otras acciones (editar diálogo, etc.)

    return json<ActionData>({ ok: false, error: "Acción desconocida." }, { status: 400 });
}


// --- Componente TakesPage ---
export default function TakesPage() {
  const { capitulo, takes, error: loaderError } = useLoaderData<LoaderData>();
  const params = useParams();
  const capituloId = params.capituloId; // Explicitly get capituloId
  const fetcher = useFetcher<ActionData>(); // Fetcher para enviar actualizaciones

  // Estado para el índice del take actual
  const [currentTakeIndex, setCurrentTakeIndex] = useState(0);
  // Estado para búsqueda de personaje
  const [searchTerm, setSearchTerm] = useState("");

  if (loaderError) {
    return <div style={{ color: 'red', padding: '1rem' }}>Error cargando datos: {loaderError}</div>;
  }
  if (!takes || takes.length === 0) {
    return <div>No hay takes para este capítulo.</div>;
  }

  // Derivar el take actual y las intervenciones filtradas
  const currentTake = takes[currentTakeIndex];
  const filteredInterventions = currentTake.intervenciones.filter(int =>
      int.personaje.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Handlers ---
  const goToNextTake = () => setCurrentTakeIndex(i => Math.min(i + 1, takes.length - 1));
  const goToPrevTake = () => setCurrentTakeIndex(i => Math.max(i - 1, 0));
  const handleTakeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedIndex = parseInt(event.target.value, 10);
      if (!isNaN(selectedIndex)) {
          setCurrentTakeIndex(selectedIndex);
      }
  };
  const handleCheckboxChange = (interventionId: number, currentState: boolean) => {
      const formData = new FormData();
      formData.set("_action", "update_status");
      formData.set("interventionId", String(interventionId));
      formData.set("newState", String(!currentState)); // Envía el estado contrario
      // Envía la actualización usando el fetcher
      fetcher.submit(formData, { method: "post" }); // La acción está en esta misma ruta
  };


  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      {/* Cabecera y Controles */}
      <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #ccc' }}>
        {capitulo && (
          <h2>Capítulo {capitulo.numero_capitulo}{capitulo.titulo_capitulo ? `: ${capitulo.titulo_capitulo}` : ''}</h2>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button onClick={goToPrevTake} disabled={currentTakeIndex === 0}>Take anterior</button>

          {/* Selector de Take */}
          <label>
            Ir al Take:{" "}
            <select value={currentTakeIndex} onChange={handleTakeSelect}>
              {takes.map((take, index) => (
                <option key={take.id} value={index}>
                  {take.numero_take} ({take.tc_in} - {take.tc_out})
                </option>
              ))}
            </select>
          </label>

          {/* Buscador Personaje */}
          <label>
              Buscar Personaje:{" "}
              <input
                  type="search"
                  placeholder="Nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </label>

          <button onClick={goToNextTake} disabled={currentTakeIndex === takes.length - 1}>Siguiente Take</button>
          
          {/* Export Button */}
          {capituloId && (
            <a
              href={`/api/export/takes/${capituloId}`}
              download
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745', // Green color for export
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                display: 'inline-block',
                textAlign: 'center'
              }}
            >
              Export to .xlsx
            </a>
          )}
        </div>
      </div>

      {/* Info del Take Actual */}
      <div style={{ margin: '1rem 0', padding: '0.5rem', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <strong>Take {currentTake.numero_take}:</strong> {currentTake.tc_in ?? 'N/A'} - {currentTake.tc_out ?? 'N/A'}
      </div>

      {/* Lista de Intervenciones */}
      <div>
        {filteredInterventions.map((interv) => {
            // Optimistic UI: comprueba si el fetcher está actualizando ESTA intervención
            const isUpdating = fetcher.state !== 'idle' &&
                               fetcher.formData?.get('interventionId') === String(interv.id);
            // Determina el estado mostrado: el del fetcher si está actualizando, si no el original
            const displayCompleto = isUpdating
                ? fetcher.formData?.get('newState') === 'true'
                : interv.completo;

            return (
                <div key={interv.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', padding: '0.5rem', border: '1px solid #eee', opacity: isUpdating ? 0.7 : 1 }}>
                    <strong style={{ width: '120px', textAlign: 'right' }}>{interv.personaje}:</strong>
                    <span style={{ flexGrow: 1 }}>{interv.dialogo}</span>
                    {/* Checkbox como Formulario Fetcher */}
                    <fetcher.Form method="post" style={{margin: 0}}>
                        <input type="hidden" name="_action" value="update_status" />
                        <input type="hidden" name="interventionId" value={interv.id} />
                        <input type="hidden" name="newState" value={String(!interv.completo)} /> {/* Estado al que cambiaría */}
                        <input
                            type="checkbox"
                            checked={displayCompleto}
                            onChange={() => { /* El submit maneja el cambio */ }}
                            onClick={(e) => fetcher.submit(e.currentTarget.form)} // Envía al hacer clic
                            aria-label={`Marcar como ${displayCompleto ? 'incompleto' : 'completo'}`}
                            disabled={isUpdating}
                        />
                    </fetcher.Form>
                    {/* Indicador de error para esta intervención específica */}
                    {fetcher.data?.error && fetcher.data?.interventionId === interv.id && (
                        <span title={fetcher.data.error} style={{color: 'red'}}>⚠️</span>
                    )}
                </div>
            );
          })}
          {filteredInterventions.length === 0 && searchTerm && (
              <p>No se encontraron intervenciones para "{searchTerm}" en este take.</p>
          )}
          {filteredInterventions.length === 0 && !searchTerm && (
              <p>No hay intervenciones en este take.</p>
          )}
      </div>

        {/* Puedes añadir un botón para volver */}
        {/* <Link to={`/series/${capitulo?.serie_id}/capitulos`}>Volver a capítulos</Link> */}

    </div>
  );
}