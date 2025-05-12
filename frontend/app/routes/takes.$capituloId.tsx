// frontend/app/routes/takes.$capituloId.tsx

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import { useState, useMemo, useEffect, useCallback } from "react";

import { authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

// --- Interfaces ---
interface CapituloDetails {
  id: number;
  numero_capitulo: number;
  titulo_capitulo: string | null;
  serie_id: number;
}
interface Intervencion {
  id: number;
  take_id: number;
  dialogo: string;
  completo: boolean;
  tc_in: string | null;
  tc_out: string | null;
  orden_en_take: number | null;
  personaje: string;
}
interface Take {
  id: number;
  numero_take: number;
  tc_in: string | null;
  tc_out: string | null;
  intervenciones: Intervencion[];
}

// --- Tipos de Datos para Loader y Action ---
type LoaderData = {
  capitulo: CapituloDetails | null;
  takes: Take[];
  personajesUnicos?: string[];
  error?: string;
};

type UpdateStatusActionData = {
  ok: boolean;
  error?: string;
  interventionId?: number;
  newState?: boolean;
  type: "update_status";
};
type UpdateDialogActionData = {
  ok: boolean;
  error?: string;
  interventionId?: number;
  newDialog?: string;
  type: "update_dialog";
};
type ActionData = UpdateStatusActionData | UpdateDialogActionData;


// --- Meta Función ---
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const numero = data?.capitulo?.numero_capitulo;
  return [{ title: numero ? `Takes – Capítulo ${numero}` : "Takes" }];
};

/* ---------------------------------------------------------------------- */
/*                                LOADER                                  */
/* ---------------------------------------------------------------------- */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });

  const capId = Number(params.capituloId);
  if (isNaN(capId) || capId <= 0) {
    throw new Response("ID de capítulo inválido proporcionado.", { status: 400 });
  }

  try {
    const res = await apiFetch(request, `/capitulos/${capId}/details`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: `Error ${res.status} del API al cargar detalles.` }));
      return json<LoaderData>(
        { capitulo: null, takes: [], error: errorData.error || `API devolvió ${res.status}` },
        { status: res.status }
      );
    }
    const { capitulo, takes } = (await res.json()) as { capitulo: CapituloDetails; takes: Take[] };

    const personajes = new Set<string>();
    takes.forEach(take => take.intervenciones.forEach(int => personajes.add(int.personaje)));
    const personajesUnicos = Array.from(personajes).sort((a,b) => a.localeCompare(b));

    return json<LoaderData>({ capitulo, takes, personajesUnicos });
  } catch (error) {
    console.error("[takes.$capituloId.loader] Error fetching chapter details:", error);
    return json<LoaderData>(
      { capitulo: null, takes: [], error: "No se pudieron cargar los datos del capítulo." },
      { status: 500 }
    );
  }
}

/* ---------------------------------------------------------------------- */
/*                                ACTION                                  */
/* ---------------------------------------------------------------------- */
export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  const form = await request.formData();
  const actionType = form.get("_action") as string;

  if (actionType === "update_status") {
    const id = Number(form.get("interventionId"));
    const newState = form.get("newState") === "true";
    if (isNaN(id) || id <= 0) return json<UpdateStatusActionData>({ type: "update_status", ok: false, error: "ID de intervención inválido" }, { status: 400 });
    try {
      const res = await apiFetch(request, `/intervenciones/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completo: newState }), });
      if (!res.ok) { const eData = await res.json().catch(() => ({})); return json<UpdateStatusActionData>({ type: "update_status", ok: false, interventionId: id, error: eData.error || `API devolvió ${res.status}`}, { status: res.status }); }
      return json<UpdateStatusActionData>({ type: "update_status", ok: true, interventionId: id, newState: newState });
    } catch (err) { console.error("[takes.$capituloId.action.update_status] Error:", err); return json<UpdateStatusActionData>({ type: "update_status", ok: false, interventionId: id, error: "Error al actualizar el estado." }, { status: 500 }); }
  } else if (actionType === "update_dialog") {
    const id = Number(form.get("interventionId"));
    const newDialog = form.get("dialogo") as string | null;
    if (isNaN(id) || id <= 0) return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, error: "ID de intervención inválido" }, { status: 400 });
    if (newDialog === null) return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: "El diálogo no puede ser nulo." }, { status: 400 }); // Podrías permitir diálogos vacíos ''
    try {
      // Endpoint hipotético, ajústalo a tu API: /api/intervenciones/:id/dialogo
      const res = await apiFetch(request, `/intervenciones/${id}/dialogo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dialogo: newDialog }), });
      if (!res.ok) { const eData = await res.json().catch(() => ({})); return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: eData.error || `API devolvió ${res.status}`}, { status: res.status }); }
      return json<UpdateDialogActionData>({ type: "update_dialog", ok: true, interventionId: id, newDialog: newDialog });
    } catch (err) { console.error("[takes.$capituloId.action.update_dialog] Error:", err); return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: "Error al actualizar el diálogo." }, { status: 500 }); }
  }
  return json<ActionData>({ type: "update_status", ok: false, error: "Acción desconocida" } as UpdateStatusActionData, { status: 400 });
}


// --- Componente IntervencionEditable ---
interface IntervencionEditableProps {
  intervencion: Intervencion;
  isSearchedAndPending: boolean;
  isUpdatingStatus: boolean;
  isUpdatingDialog: boolean;
  displayCompleto: boolean;
  fetcherStatus: ReturnType<typeof useFetcher<UpdateStatusActionData>>;
  fetcherDialog: ReturnType<typeof useFetcher<UpdateDialogActionData>>;
}

function IntervencionEditable({
  intervencion,
  isSearchedAndPending,
  isUpdatingStatus,
  isUpdatingDialog,
  displayCompleto,
  fetcherStatus,
  fetcherDialog,
}: IntervencionEditableProps) {
  const [isEditingDialog, setIsEditingDialog] = useState(false);
  const [editableDialog, setEditableDialog] = useState(intervencion.dialogo);

  useEffect(() => {
    // Si la intervención original cambia (ej. por optimistic UI global o recarga)
    // y no estamos activamente editando ESTA intervención, actualizamos el valor local.
    if (!isEditingDialog) {
        setEditableDialog(intervencion.dialogo);
    }
  }, [intervencion.dialogo, isEditingDialog]);


  const handleDialogSubmit = (e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    // Solo enviar si hay cambios reales, o si es un blur y se quiere confirmar.
    // Evitar envíos innecesarios si el blur ocurre sin cambios.
    if (editableDialog.trim() === intervencion.dialogo.trim() && e.type !== 'submit') { // Si es blur y no hay cambio, no enviar. Si es submit y no hay cambio, no enviar.
        setIsEditingDialog(false);
        setEditableDialog(intervencion.dialogo); // Revertir a original si no hubo cambios al hacer blur
        return;
    }

    const formData = new FormData();
    formData.set("_action", "update_dialog");
    formData.set("interventionId", String(intervencion.id));
    formData.set("dialogo", editableDialog);
    fetcherDialog.submit(formData, { method: "post" });
    setIsEditingDialog(false); // Salir del modo edición después de enviar
  };

  const isGenerallyUpdating = isUpdatingStatus || isUpdatingDialog;

  let bgColorClass = "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700";
  if (displayCompleto) {
    bgColorClass = "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700";
  } else if (isSearchedAndPending) {
    bgColorClass = "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600";
  }
  
  const optimisticDialogToShow = 
    fetcherDialog.state !== 'idle' &&
    fetcherDialog.formData?.get("interventionId") === String(intervencion.id) &&
    fetcherDialog.formData?.get("_action") === "update_dialog"
    ? fetcherDialog.formData.get("dialogo") as string
    : intervencion.dialogo;

  return (
    <div
      key={intervencion.id}
      className={`flex items-start sm:items-center gap-3 sm:gap-4 p-3 border rounded-md transition-all duration-150 
                  ${isGenerallyUpdating ? 'opacity-60 animate-pulse' : 'opacity-100'} 
                  ${bgColorClass}`}
    >
      <strong className="w-24 sm:w-28 md:w-32 text-sm sm:text-base text-right font-medium text-gray-700 dark:text-gray-300 flex-shrink-0 pt-0.5 sm:pt-0">
        {intervencion.personaje}:
      </strong>

      {isEditingDialog ? (
        <fetcherDialog.Form onSubmit={handleDialogSubmit} className="flex-grow">
          {/* Hidden inputs no son necesarios aquí si el form del fetcher los añade automáticamente, pero por claridad: */}
          {/* <input type="hidden" name="_action" value="update_dialog" /> */}
          {/* <input type="hidden" name="interventionId" value={String(intervencion.id)} /> */}
          <textarea
            name="dialogo" // Nombre usado en formData.get("dialogo")
            value={editableDialog}
            onChange={(e) => setEditableDialog(e.target.value)}
            onBlur={handleDialogSubmit} // Guardar al perder foco
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDialogSubmit(e as any); } else if (e.key === 'Escape') { setIsEditingDialog(false); setEditableDialog(intervencion.dialogo); } }}
            autoFocus
            rows={Math.max(2, editableDialog.split('\n').length)}
            className="w-full p-1 text-sm sm:text-base text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700/90 border border-indigo-500 rounded shadow-inner resize-y focus:ring-1 focus:ring-indigo-500"
          />
           {/* Podrías añadir botones explícitos de Guardar/Cancelar aquí si lo prefieres */}
        </fetcherDialog.Form>
      ) : (
        <span
          className="flex-grow text-sm sm:text-base text-gray-800 dark:text-gray-100 leading-relaxed break-words cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 p-1 rounded min-h-[2.25rem] flex items-center" // min-h para igualar altura de textarea
          onClick={() => setIsEditingDialog(true)}
          title="Haz clic para editar el diálogo"
        >
          {optimisticDialogToShow || <span className="italic text-gray-400">(Vacío)</span>}
        </span>
      )}

      <div className="flex items-center gap-2 ml-auto flex-shrink-0">
        {/* Indicadores de error específicos para cada fetcher */}
        {(fetcherStatus.data?.error && fetcherStatus.data?.interventionId === intervencion.id && fetcherStatus.data.type === "update_status") && ( <span title={fetcherStatus.data.error} className="text-red-500 cursor-help"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span> )}
        {(fetcherDialog.data?.error && fetcherDialog.data?.interventionId === intervencion.id && fetcherDialog.data.type === "update_dialog") && ( <span title={fetcherDialog.data.error} className="text-red-500 cursor-help"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg></span> )}
        
        <fetcherStatus.Form method="post" className="m-0">
          <input type="hidden" name="_action" value="update_status" />
          <input type="hidden" name="interventionId" value={String(intervencion.id)} />
          <input type="hidden" name="newState" value={String(!intervencion.completo)} />
          <input
            type="checkbox"
            checked={displayCompleto}
            onChange={() => {}} // El submit se maneja en onClick
            onClick={(e) => { if (e.currentTarget.form) { fetcherStatus.submit(e.currentTarget.form); } }}
            aria-label={`Marcar intervención de ${intervencion.personaje} como ${displayCompleto ? 'incompleta' : 'completa'}`}
            disabled={isGenerallyUpdating}
            className="h-5 w-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:focus:ring-offset-gray-800 dark:bg-gray-700 dark:checked:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          />
        </fetcherStatus.Form>
      </div>
    </div>
  );
}


// --- Componente TakesPage ---
export default function TakesPage() {
  const { capitulo, takes: initialTakes, personajesUnicos, error: loaderError } = useLoaderData<LoaderData>();
  const fetcherStatus = useFetcher<UpdateStatusActionData>();
  const fetcherDialog = useFetcher<UpdateDialogActionData>();

  const [currentTakeIndex, setCurrentTakeIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isPerformingSearchJump, setIsPerformingSearchJump] = useState(false);

  const takes = useMemo(() => {
    if (!initialTakes) return [];
    return initialTakes.map(take => ({
      ...take,
      intervenciones: take.intervenciones.map(interv => {
        let updatedInterv = { ...interv };
        // Optimistic UI para estado "completo"
        if (fetcherStatus.formData && fetcherStatus.formData.get("interventionId") === String(interv.id) && fetcherStatus.formData.get("_action") === "update_status") {
          updatedInterv.completo = fetcherStatus.formData.get("newState") === "true";
        }
        // Optimistic UI para diálogo
        if (fetcherDialog.formData && fetcherDialog.formData.get("interventionId") === String(interv.id) && fetcherDialog.formData.get("_action") === "update_dialog") {
          updatedInterv.dialogo = fetcherDialog.formData.get("dialogo") as string;
        }
        return updatedInterv;
      }),
    }));
  }, [initialTakes, fetcherStatus.formData, fetcherDialog.formData]);

  const currentTake = useMemo(() => {
    if (!takes || takes.length === 0 || currentTakeIndex < 0 || currentTakeIndex >= takes.length) return null;
    return takes[currentTakeIndex];
  }, [takes, currentTakeIndex]);

  const filteredInterventions = useMemo(() => {
    if (!currentTake) return [];
    return currentTake.intervenciones; // Mostramos todas, el resaltado se hace en IntervencionEditable
  }, [currentTake]);

  const findTakeWithPendingIntervention = useCallback((characterName: string, startIndex: number, direction: 'forward' | 'backward'): number => {
    if (!takes || takes.length === 0 || !characterName) return -1;
    const charLower = characterName.toLowerCase();
    
    if (direction === 'forward') {
      for (let i = startIndex; i < takes.length; i++) {
        if (i < 0) continue; // Asegurar que el índice no sea negativo
        const take = takes[i];
        if (take.intervenciones.some(int => int.personaje.toLowerCase().includes(charLower) && !int.completo)) {
          return i;
        }
      }
    } else { 
      for (let i = startIndex; i >= 0; i--) {
        if (i >= takes.length) continue; // Asegurar que el índice no exceda
        const take = takes[i];
        if (take.intervenciones.some(int => int.personaje.toLowerCase().includes(charLower) && !int.completo)) {
          return i;
        }
      }
    }
    return -1; 
  }, [takes]);

  useEffect(() => {
    if (searchTerm.trim() !== "" && isPerformingSearchJump) {
      setSearchMessage(null); 
      const firstTakeIndex = findTakeWithPendingIntervention(searchTerm, 0, 'forward');
      if (firstTakeIndex !== -1) {
        setCurrentTakeIndex(firstTakeIndex);
      } else {
        const anyTakeIndex = takes.findIndex(take => take.intervenciones.some(int => int.personaje.toLowerCase().includes(searchTerm.trim().toLowerCase())));
        if (anyTakeIndex !== -1) {
            setCurrentTakeIndex(anyTakeIndex);
            setSearchMessage(`No hay intervenciones pendientes para ${searchTerm}. Mostrando primera aparición.`);
        } else {
            setSearchMessage(`${searchTerm} no tiene intervenciones en este capítulo.`);
        }
      }
      setIsPerformingSearchJump(false); 
    } else if (searchTerm.trim() === "") {
      setSearchMessage(null); 
    }
  }, [searchTerm, takes, findTakeWithPendingIntervention, isPerformingSearchJump]);

  const handleSearchTermChange = (newSearchTerm: string) => {
    const oldSearchTerm = searchTerm;
    setSearchTerm(newSearchTerm);
    if (newSearchTerm.trim() !== "" && newSearchTerm.trim().toLowerCase() !== oldSearchTerm.trim().toLowerCase()) {
        setIsPerformingSearchJump(true);
    } else if (newSearchTerm.trim() === "" && oldSearchTerm.trim() !== "") {
        setIsPerformingSearchJump(false); // Si se borra la búsqueda
    }
  };

  const goToNextTake = () => {
    if (searchTerm.trim() !== "") {
      const nextSearchIndex = Math.min(takes.length -1, currentTakeIndex + 1); // No empezar la búsqueda más allá del último take
      const nextFoundIndex = findTakeWithPendingIntervention(searchTerm, nextSearchIndex, 'forward');
      if (nextFoundIndex !== -1) {
        setCurrentTakeIndex(nextFoundIndex);
        setSearchMessage(null);
      } else {
        setSearchMessage(`No más intervenciones pendientes para ${searchTerm} después de este take.`);
      }
    } else {
      setCurrentTakeIndex(i => Math.min(i + 1, takes.length - 1));
    }
  };

  const goToPrevTake = () => {
    if (searchTerm.trim() !== "") {
      const prevSearchIndex = Math.max(0, currentTakeIndex - 1); // No empezar la búsqueda antes del primer take
      const prevFoundIndex = findTakeWithPendingIntervention(searchTerm, prevSearchIndex, 'backward');
      if (prevFoundIndex !== -1) {
        setCurrentTakeIndex(prevFoundIndex);
        setSearchMessage(null);
      } else {
         setSearchMessage(`No más intervenciones pendientes para ${searchTerm} antes de este take.`);
      }
    } else {
      setCurrentTakeIndex(i => Math.max(i - 1, 0));
    }
  };
  
  const handleTakeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedIndex = parseInt(event.target.value, 10);
      if (!isNaN(selectedIndex)) {
          setCurrentTakeIndex(selectedIndex);
          setIsPerformingSearchJump(false); 
      }
  };

  if (loaderError) {
    return (
      <div className="m-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:border-red-600 rounded-md" role="alert">
        <p className="font-bold">Error al cargar los datos del capítulo:</p>
        <p>{loaderError}</p>
        {capitulo?.serie_id && (
             <Link
                to={`/series/${capitulo.serie_id}`}
                className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >Volver a la serie</Link>
        )}
      </div>
    );
  }
  if (!takes || takes.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">No hay takes disponibles para este capítulo.</p>
        {capitulo?.serie_id && (
             <Link
                to={`/series/${capitulo.serie_id}`}
                className="mt-4 inline-block px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >Volver a la serie</Link>
        )}
      </div>
    );
  }
  if (!currentTake) {
    return <div className="p-6 text-center text-gray-500 dark:text-gray-400">Cargando take...</div>;
  }

  // Define si los botones de navegación de búsqueda deben estar deshabilitados
  const noNextTakeForSearch = searchTerm.trim() !== "" && findTakeWithPendingIntervention(searchTerm, currentTakeIndex + 1, 'forward') === -1;
  const noPrevTakeForSearch = searchTerm.trim() !== "" && findTakeWithPendingIntervention(searchTerm, currentTakeIndex - 1, 'backward') === -1;


  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
        {capitulo && ( 
            <> 
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-1">
                    Capítulo {capitulo.numero_capitulo}{capitulo.titulo_capitulo ? `: ${capitulo.titulo_capitulo}` : ''}
                </h1> 
                <Link to="/series" className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline">
                  Volver a la Lista de Series
                </Link> 
            </> 
        )}
        
        <div className="mt-4 flex flex-wrap items-center gap-4">
            <button 
                onClick={goToPrevTake} 
                disabled={(searchTerm.trim() === "" && currentTakeIndex === 0) || (searchTerm.trim() !== "" && noPrevTakeForSearch)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
            >
                Anterior
            </button>

            <div className="flex-grow flex flex-col sm:flex-row items-center justify-center gap-4 mx-auto px-2">
                <div className="flex-shrink-0">
                    <label htmlFor="take-select" className="sr-only">Ir al Take:</label>
                    <select 
                        id="take-select" 
                        value={currentTakeIndex} 
                        onChange={handleTakeSelect} 
                        className="block w-full sm:w-auto mt-1 pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                    >
                        {takes.map((take, index) => ( <option key={take.id} value={index}>Take {take.numero_take} ({take.tc_in || 'N/A'} - {take.tc_out || 'N/A'})</option> ))}
                    </select>
                </div>
                <div className="w-full sm:w-auto">
                    <label htmlFor="search-personaje" className="sr-only">Buscar Personaje:</label>
                    <input 
                        id="search-personaje" 
                        type="search" 
                        list="personajes-datalist" 
                        placeholder="Buscar personaje..." 
                        value={searchTerm} 
                        onChange={(e) => handleSearchTermChange(e.target.value)}
                        className="block w-full mt-1 pl-3 pr-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    {personajesUnicos && personajesUnicos.length > 0 && (
                        <datalist id="personajes-datalist">
                            {personajesUnicos.map(p => <option key={p} value={p} />)}
                        </datalist>
                    )}
                </div>
            </div>

            <button 
                onClick={goToNextTake} 
                disabled={(searchTerm.trim() === "" && currentTakeIndex === takes.length - 1) || (searchTerm.trim() !== "" && noNextTakeForSearch)}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-gray-600 dark:disabled:text-gray-500 disabled:cursor-not-allowed"
            >
                Siguiente
            </button>
        </div>
        {searchMessage && <p className="mt-2 text-sm text-center text-blue-600 dark:text-blue-400">{searchMessage}</p>}
      </header>

      <section aria-labelledby={`take-heading-${currentTake.id}`}>
        <div id={`take-heading-${currentTake.id}`} className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-800 dark:text-gray-100 shadow">
          <h3 className="text-lg font-semibold">Take {currentTake.numero_take}: <span className="ml-2 font-normal text-sm text-gray-600 dark:text-gray-400">TC In: {currentTake.tc_in ?? 'N/A'} / TC Out: {currentTake.tc_out ?? 'N/A'}</span></h3>
        </div>

        {filteredInterventions.length > 0 ? (
          <div className="space-y-3">
            {filteredInterventions.map((interv) => {
              const isUpdatingStatus = fetcherStatus.state !== 'idle' && fetcherStatus.formData?.get('interventionId') === String(interv.id) && fetcherStatus.formData?.get('_action') === 'update_status';
              const isUpdatingDialog = fetcherDialog.state !== 'idle' && fetcherDialog.formData?.get('interventionId') === String(interv.id) && fetcherDialog.formData?.get('_action') === 'update_dialog';
              const displayCompleto = isUpdatingStatus ? fetcherStatus.formData?.get('newState') === 'true' : interv.completo;
              const isSearched = searchTerm.trim() !== "" && interv.personaje.toLowerCase().includes(searchTerm.trim().toLowerCase());
              const isSearchedAndPending = isSearched && !displayCompleto;

              return ( <IntervencionEditable key={interv.id} intervencion={interv} isSearchedAndPending={isSearchedAndPending} isUpdatingStatus={isUpdatingStatus} isUpdatingDialog={isUpdatingDialog} displayCompleto={displayCompleto} fetcherStatus={fetcherStatus} fetcherDialog={fetcherDialog} /> );
            })}
          </div>
        ) : ( <p className="text-gray-500 dark:text-gray-400 text-center py-6">{searchTerm ? `No se encontraron intervenciones para "${searchTerm}" en este take.` : "No hay intervenciones en este take."}</p> )}
      </section>
    </div>
  );
}