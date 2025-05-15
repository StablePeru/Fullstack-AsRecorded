// frontend/app/routes/takes.$capituloId.tsx

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";

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
type UpdateTimecodeActionData = {
  ok: boolean;
  error?: string;
  interventionId?: number;
  tc_in?: string | null;
  type: "update_timecode";
};
type ActionData =
  | UpdateStatusActionData
  | UpdateDialogActionData
  | UpdateTimecodeActionData;

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
    throw new Response("ID de capítulo inválido proporcionado.", {
      status: 400,
    });
  }

  try {
    const res = await apiFetch(request, `/capitulos/${capId}/details`);
    if (!res.ok) {
      const errorData = await res
        .json()
        .catch(() => ({ error: `Error ${res.status} del API al cargar detalles.` }));
      return json<LoaderData>(
        {
          capitulo: null,
          takes: [],
          error: errorData.error || `API devolvió ${res.status}`,
        },
        { status: res.status }
      );
    }
    const { capitulo, takes } = (await res.json()) as {
      capitulo: CapituloDetails;
      takes: Take[];
    };

    const personajes = new Set<string>();
    takes.forEach((take) =>
      take.intervenciones.forEach((int) => personajes.add(int.personaje))
    );
    const personajesUnicos = Array.from(personajes).sort((a, b) =>
      a.localeCompare(b)
    );

    return json<LoaderData>({ capitulo, takes, personajesUnicos });
  } catch (error) {
    console.error(
      "[takes.$capituloId.loader] Error fetching chapter details:",
      error
    );
    return json<LoaderData>(
      {
        capitulo: null,
        takes: [],
        error: "No se pudieron cargar los datos del capítulo.",
      },
      { status: 500 }
    );
  }
}

/* ---------------------------------------------------------------------- */
/*                                ACTION                                  */
/* ---------------------------------------------------------------------- */
async function handleUpdateStatusAction(request: Request, form: FormData): Promise<Response> {
  const id = Number(form.get("interventionId"));
  const newState = form.get("newState") === "true";
  if (isNaN(id) || id <= 0) return json<UpdateStatusActionData>({ type: "update_status", ok: false, error: "ID de intervención inválido" }, { status: 400 });
  try {
    const res = await apiFetch(request, `/intervenciones/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completo: newState }), });
    if (!res.ok) { const eData = await res.json().catch(() => ({})); return json<UpdateStatusActionData>({ type: "update_status", ok: false, interventionId: id, error: eData.error || `API devolvió ${res.status}`}, { status: res.status }); }
    return json<UpdateStatusActionData>({ type: "update_status", ok: true, interventionId: id, newState: newState });
  } catch (err) { console.error("[takes.$capituloId.action.update_status] Error:", err); return json<UpdateStatusActionData>({ type: "update_status", ok: false, interventionId: id, error: "Error al actualizar el estado." }, { status: 500 }); }
}

async function handleUpdateDialogAction(request: Request, form: FormData): Promise<Response> {
  const id = Number(form.get("interventionId"));
  const newDialog = form.get("dialogo") as string | null;
  if (isNaN(id) || id <= 0) return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, error: "ID de intervención inválido" }, { status: 400 });
  if (newDialog === null) return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: "El diálogo no puede ser nulo." }, { status: 400 });
  try {
    const res = await apiFetch(request, `/intervenciones/${id}/dialogo`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dialogo: newDialog }), });
    if (!res.ok) { const eData = await res.json().catch(() => ({})); return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: eData.error || `API devolvió ${res.status}`}, { status: res.status }); }
    return json<UpdateDialogActionData>({ type: "update_dialog", ok: true, interventionId: id, newDialog: newDialog });
  } catch (err) { console.error("[takes.$capituloId.action.update_dialog] Error:", err); return json<UpdateDialogActionData>({ type: "update_dialog", ok: false, interventionId: id, error: "Error al actualizar el diálogo." }, { status: 500 }); }
}

async function handleUpdateTimecodeAction(request: Request, form: FormData): Promise<Response> {
  const id = Number(form.get("interventionId"));
  const tcInValue = form.get("tc_in") as string | null;
  if (isNaN(id) || id <= 0) return json<UpdateTimecodeActionData>({ type: "update_timecode", ok: false, error: "ID de intervención inválido" }, { status: 400 });
  
  const tcRegex = /^\d{2}:\d{2}:\d{2}:\d{2}$/;
  if (tcInValue && !tcRegex.test(tcInValue)) {
      return json<UpdateTimecodeActionData>({ type: "update_timecode", ok: false, interventionId: id, error: "Formato de Timecode inválido. Debe ser HH:MM:SS:FF." }, { status: 400 });
  }

  try {
    const res = await apiFetch(request, `/intervenciones/${id}/timecode`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tc_in: tcInValue }), });
    if (!res.ok) { const eData = await res.json().catch(() => ({})); return json<UpdateTimecodeActionData>({ type: "update_timecode", ok: false, interventionId: id, error: eData.error || `API devolvió ${res.status}`}, { status: res.status }); }
    const responsePayload = await res.json().catch(() => ({ tc_in: tcInValue }));
    return json<UpdateTimecodeActionData>({ type: "update_timecode", ok: true, interventionId: id, tc_in: responsePayload.tc_in ?? tcInValue });
  } catch (err) { console.error("[takes.$capituloId.action.update_timecode] Error:", err); return json<UpdateTimecodeActionData>({ type: "update_timecode", ok: false, interventionId: id, error: "Error al actualizar el timecode." }, { status: 500 }); }
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  const form = await request.formData();
  const actionType = form.get("_action") as string;

  switch (actionType) {
    case "update_status":
      return handleUpdateStatusAction(request, form);
    case "update_dialog":
      return handleUpdateDialogAction(request, form);
    case "update_timecode":
      return handleUpdateTimecodeAction(request, form);
    default:
      return json<ActionData>(
        { type: "update_status", ok: false, error: "Acción desconocida" } as UpdateStatusActionData, 
        { status: 400 }
      );
  }
}

// --- Componente TimecodeInput ---
interface TimecodeInputProps {
  initialValue: string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  framesPerSecond?: number; 
}

export const TimecodeInput: React.FC<TimecodeInputProps> = ({
  initialValue,
  onSubmit,
  onCancel,
  framesPerSecond = 25,
}) => {
  const [digits, setDigits] = useState(() =>
    (initialValue ? initialValue.replace(/:/g, "") : "00000000").slice(-8)
  );
  const digitsRef = useRef<string>(digits);
  const cursorRef = useRef<number>(7); 
  const inputRef = useRef<HTMLInputElement>(null);

  const fmt = (d: string) =>
    `${d.slice(0, 2)}:${d.slice(2, 4)}:${d.slice(4, 6)}:${d.slice(6, 8)}`;

  const isValid = (d: string) => {
    const hh = +d.slice(0, 2),
      mm = +d.slice(2, 4),
      ss = +d.slice(4, 6),
      ff = +d.slice(6, 8);
    return hh < 24 && mm < 60 && ss < 60 && ff < framesPerSecond;
  };

  const resetCursor = () => (cursorRef.current = 7);

  const commitDigits = (next: string) => {
    digitsRef.current = next;
    setDigits(next);
  };

  const writeDigit = (d: string) => {
    const arr = digitsRef.current.split("");
    for (let i = cursorRef.current + 1; i <= 7; i++) arr[i - 1] = arr[i];
    arr[7] = d;
    commitDigits(arr.join(""));
  };

  const undoDigit = () => {
    const arr = digitsRef.current.split("");
    for (let i = 7; i > cursorRef.current; i--) arr[i] = arr[i - 1];
    arr[cursorRef.current] = "0";
    commitDigits(arr.join(""));
  };

  const submit = () => {
    resetCursor();
    const value = digitsRef.current;
    onSubmit(isValid(value) ? fmt(value) : "");
  };

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    resetCursor();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      writeDigit(e.key);
      if (cursorRef.current > 0) cursorRef.current -= 1;
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (cursorRef.current < 7) {
        cursorRef.current += 1;
        undoDigit();
      } else {
        commitDigits(digitsRef.current.slice(0, 7) + "0");
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      resetCursor();
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={fmt(digits)}
      readOnly
      onKeyDown={handleKeyDown}
      onBlur={submit}
      className="w-24 font-mono text-xs sm:text-sm text-gray-800
                 dark:text-gray-100 bg-white dark:bg-gray-700/90
                 border border-indigo-500 rounded shadow-inner
                 px-1 py-0.5 text-center"
    />
  );
};

// --- Componente IntervencionEditable ---
interface IntervencionEditableProps {
  intervencion: Intervencion;
  isSearchedAndPending: boolean;
  isUpdatingStatus: boolean; // Prop para saber si *esta* intervención está siendo actualizada por fetcherStatus
  isUpdatingDialog: boolean; // Prop para saber si *esta* intervención está siendo actualizada por fetcherDialog
  isUpdatingTimecode: boolean; // Prop para saber si *esta* intervención está siendo actualizada por fetcherTimecode
  displayCompleto: boolean; // Estado visual actual (puede ser optimista)
  fetcherStatus: ReturnType<typeof useFetcher<UpdateStatusActionData>>;
  fetcherDialog: ReturnType<typeof useFetcher<UpdateDialogActionData>>;
  fetcherTimecode: ReturnType<typeof useFetcher<UpdateTimecodeActionData>>;
}

function IntervencionEditable({
  intervencion,
  isSearchedAndPending,
  isUpdatingStatus,
  isUpdatingDialog,
  isUpdatingTimecode,
  displayCompleto, // Este es el estado que ya considera el optimismo del fetcherStatus
  fetcherStatus,
  fetcherDialog,
  fetcherTimecode,
}: IntervencionEditableProps) {
  const [isEditingDialog, setIsEditingDialog] = useState(false);
  const [editableDialog, setEditableDialog] = useState(intervencion.dialogo);
  const [isEditingTCIn, setIsEditingTCIn] = useState(false);
  
  // Estado para controlar la animación de "onda" al completar
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    // Actualiza el diálogo editable si la prop de intervención cambia (ej. por submit de otro usuario)
    // y no estamos actualmente editando.
    if (!isEditingDialog) {
      setEditableDialog(intervencion.dialogo);
    }
  }, [intervencion.dialogo, isEditingDialog]);

  // Resetea el estado de la animación de "onda" después de que termine
  useEffect(() => {
    if (isCompleting) {
      const timer = setTimeout(() => {
        setIsCompleting(false);
      }, 600); // Debe coincidir con la duración de la animación `radialExpandGreen`
      return () => clearTimeout(timer);
    }
  }, [isCompleting]);

  const handleDialogSubmit = (
    e: React.FormEvent<HTMLFormElement> | React.FocusEvent<HTMLTextAreaElement>
  ) => {
    e.preventDefault();
    if (editableDialog.trim() === intervencion.dialogo.trim() && e.type !== "submit") {
      setIsEditingDialog(false);
      setEditableDialog(intervencion.dialogo); // Restaura si no hay cambios
      return;
    }
    const formData = new FormData();
    formData.set("_action", "update_dialog");
    formData.set("interventionId", String(intervencion.id));
    formData.set("dialogo", editableDialog);
    fetcherDialog.submit(formData, { method: "post" });
    setIsEditingDialog(false);
  };

  const handleTCInSubmit = (newTcInValue: string) => {
    // No enviar si el valor no cambió (considerando null/undefined como "00:00:00:00")
    const currentTc = intervencion.tc_in || "00:00:00:00";
    const newTc = newTcInValue || "00:00:00:00";
    if (newTc === currentTc && newTcInValue !== "") { // Si es string vacío, sí se envía para borrar
       setIsEditingTCIn(false);
       return;
    }
    if (newTcInValue === "" && !intervencion.tc_in) { // Si ya era null y se envía vacío, no hacer nada
      setIsEditingTCIn(false);
      return;
    }

    const formData = new FormData();
    formData.set("_action", "update_timecode");
    formData.set("interventionId", String(intervencion.id));
    formData.set("tc_in", newTcInValue); // Enviar string vacío si es el caso
    fetcherTimecode.submit(formData, { method: "post" });
    setIsEditingTCIn(false);
  };
  
  // `displayCompleto` ya incluye el estado optimista del fetcherStatus para `completo`
  // No necesitamos `optimisticallyCompleto` aquí porque `displayCompleto` lo maneja desde TakesPage.
  const showAsComplete = displayCompleto; 

  let baseBgColorClass = "bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700";
  let activeBgColorClass = "";

  if (showAsComplete) {
    activeBgColorClass = "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700";
  } else if (isSearchedAndPending) {
    activeBgColorClass = "bg-orange-50 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600";
  }
  
  const finalBgColorClass = activeBgColorClass || baseBgColorClass;

  const optimisticDialogToShow =
    fetcherDialog.state !== "idle" && // Si el fetcherDialog está activo para esta intervención
    fetcherDialog.formData?.get("interventionId") === String(intervencion.id) &&
    fetcherDialog.formData?.get("_action") === "update_dialog"
      ? (fetcherDialog.formData.get("dialogo") as string)
      : intervencion.dialogo; // Sino, el valor actual de la intervención

  const optimisticTCInToShow =
    fetcherTimecode.state !== "idle" && // Si el fetcherTimecode está activo para esta intervención
    fetcherTimecode.formData?.get("interventionId") === String(intervencion.id) &&
    fetcherTimecode.formData?.get("_action") === "update_timecode"
      ? (fetcherTimecode.formData.get("tc_in") as string | null) // Puede ser null si se borra
      : intervencion.tc_in;

  const timecodeDisplay = optimisticTCInToShow || "00:00:00:00";

  // Determina si hay alguna actualización en curso específica para esta intervención
  const isCurrentlyUpdatingForThisItem = isUpdatingStatus || isUpdatingDialog || isUpdatingTimecode;

  return (
    <div
      key={intervencion.id}
      className={`relative overflow-hidden flex items-start sm:items-center gap-3 sm:gap-4 p-3 border rounded-md 
                  transform hover:-translate-y-px 
                  ${(isCurrentlyUpdatingForThisItem && !isCompleting) ? "opacity-60 animate-pulse" : "opacity-100"} 
                  ${finalBgColorClass}
                  transition-all duration-200 ease-in-out 
                  hover:shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500
                  motion-safe:transition-colors motion-safe:duration-500 motion-safe:ease-out 
                  `}
    >
      {/* Elemento para la animación de "onda" verde */}
      {/* Se muestra si `isCompleting` es true Y la intención es marcar como completo (`showAsComplete` será true) */}
      {isCompleting && showAsComplete && (
        <div
          className="absolute bg-green-400/50 dark:bg-green-500/40 rounded-full animate-radialExpandGreen z-0 pointer-events-none"
          style={{
            width: '30px',    
            height: '30px',
            top: 'calc(50% - 15px)', 
            right: '10px', // AJUSTA ESTO A LA POSICIÓN DE TU CHECKBOX
                           // Y EL `scale` EN LA ANIMACIÓN CSS PARA QUE CUBRA TODO
          }}
        />
      )}

      {/* Contenido de la intervención (personaje, TC) */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:gap-2 w-32 sm:w-40 md:w-48 flex-shrink-0 text-right sm:text-left pt-0.5 sm:pt-0">
        {isEditingTCIn ? (
          <div className="animate-scaleUpAndFadeIn">
            <TimecodeInput
              initialValue={intervencion.tc_in} // Siempre el valor original para edición
              onSubmit={handleTCInSubmit}
              onCancel={() => setIsEditingTCIn(false)}
            />
          </div>
        ) : (
          <span
            className="text-xs sm:text-sm font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap order-2 sm:order-1 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 px-1 rounded transition-colors"
            onClick={() => setIsEditingTCIn(true)}
            title="Haz clic para editar el Timecode de entrada"
          >
            {timecodeDisplay}
          </span>
        )}
        <strong className="text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 order-1 sm:order-2">
          {intervencion.personaje}:
        </strong>
      </div>

      {/* Contenido de la intervención (diálogo) */}
      <div className="relative z-10 flex-grow">
        {isEditingDialog ? (
          <fetcherDialog.Form onSubmit={handleDialogSubmit} className="flex-grow animate-scaleUpAndFadeIn">
            <textarea
              name="dialogo"
              value={editableDialog}
              onChange={(e) => setEditableDialog(e.target.value)}
              onBlur={handleDialogSubmit} // Guardar al perder foco
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleDialogSubmit(e as any); }
                else if (e.key === "Escape") { setIsEditingDialog(false); setEditableDialog(intervencion.dialogo); }
              }}
              autoFocus
              rows={Math.max(2, editableDialog.split("\n").length)}
              className="w-full p-1 text-sm sm:text-base text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700/90 border border-indigo-500 rounded shadow-inner resize-y focus:ring-1 focus:ring-indigo-500 transition-all duration-150"
            />
          </fetcherDialog.Form>
        ) : (
          <span
            className="flex-grow text-sm sm:text-base text-gray-800 dark:text-gray-100 leading-relaxed break-words cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 p-1 rounded min-h-[2.25rem] flex items-center transition-colors"
            onClick={() => setIsEditingDialog(true)}
            title="Haz clic para editar el diálogo"
          >
            {optimisticDialogToShow || (<span className="italic text-gray-400">(Vacío)</span>)}
          </span>
        )}
      </div>
      
      {/* Controles (iconos de error, checkbox) */}
      <div className="relative z-10 flex items-center gap-2 ml-auto flex-shrink-0">
        {fetcherStatus.data?.error &&
          fetcherStatus.data.interventionId === intervencion.id && // Solo mostrar error para esta intervención
          fetcherStatus.data.type === "update_status" && (
            <span title={fetcherStatus.data.error} className="text-red-500 cursor-help">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            </span>
          )}
        {fetcherDialog.data?.error &&
          fetcherDialog.data.interventionId === intervencion.id &&
          fetcherDialog.data.type === "update_dialog" && (
            <span title={fetcherDialog.data.error} className="text-red-500 cursor-help">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            </span>
          )}
        {fetcherTimecode.data?.error &&
          fetcherTimecode.data.interventionId === intervencion.id &&
          fetcherTimecode.data.type === "update_timecode" && (
            <span title={fetcherTimecode.data.error} className="text-red-500 cursor-help">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            </span>
          )}
        <fetcherStatus.Form 
            method="post" 
            className="m-0" // Asegura que el form no añada márgenes
            onSubmit={(e) => {
                const currentForm = e.currentTarget;
                const formData = new FormData(currentForm);
                const newCompletoState = formData.get("newState") === "true";

                // Iniciar animación de "onda" solo si se está marcando como completo
                if (newCompletoState && !isCurrentlyUpdatingForThisItem) { 
                    setIsCompleting(true);
                }
                // No es necesario llamar a e.preventDefault() ni a fetcherStatus.submit() aquí si el botón es type="submit"
            }}
        >
          <input type="hidden" name="_action" value="update_status" />
          <input type="hidden" name="interventionId" value={String(intervencion.id)} />
          <input type="hidden" name="newState" value={String(!intervencion.completo)} /> {/* El valor real de la intervención */}
          <button
            type="submit"
            // Deshabilitar si hay alguna actualización en curso para ESTE item,
            // o si la animación de completar está activa (para evitar doble submit rápido)
            disabled={isCurrentlyUpdatingForThisItem || isCompleting}
            className="appearance-none focus:outline-none p-1 rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800" 
            aria-label={`Marcar intervención de ${intervencion.personaje} como ${showAsComplete ? "incompleta" : "completa"}`}
          >
            <input
              type="checkbox"
              checked={showAsComplete} // El estado visual del checkbox se basa en `showAsComplete`
              readOnly // El input en sí es solo visual, el control lo lleva el botón
              className="input-checkbox pointer-events-none" // Tailwind class para el estilo del checkbox
            />
          </button>
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
  const fetcherTimecode = useFetcher<UpdateTimecodeActionData>();

  const [currentTakeIndex, setCurrentTakeIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [isPerformingSearchJump, setIsPerformingSearchJump] = useState(false);

  // Aplicar actualizaciones optimistas a los 'takes'
  const takes = useMemo(() => {
    if (!initialTakes) return [];
    return initialTakes.map((take) => ({
      ...take,
      intervenciones: take.intervenciones.map((interv) => {
        let updatedInterv = { ...interv };

        // Optimismo para estado 'completo'
        if (
          fetcherStatus.formData &&
          fetcherStatus.formData.get("interventionId") === String(interv.id) &&
          fetcherStatus.formData.get("_action") === "update_status"
        ) {
          updatedInterv.completo = fetcherStatus.formData.get("newState") === "true";
        } else if (
          fetcherStatus.data?.ok && 
          fetcherStatus.data.interventionId === interv.id &&
          fetcherStatus.data.type === "update_status" &&
          typeof fetcherStatus.data.newState === 'boolean' // Asegurarse que newState está presente
        ) {
           // Aplicar el estado confirmado por el servidor si el fetcher ya terminó
           // Esto es útil si el fetcher actualiza el estado antes de que el loader recargue
           updatedInterv.completo = fetcherStatus.data.newState;
        }


        // Optimismo para diálogo
        if (
          fetcherDialog.formData &&
          fetcherDialog.formData.get("interventionId") === String(interv.id) &&
          fetcherDialog.formData.get("_action") === "update_dialog"
        ) {
          updatedInterv.dialogo = fetcherDialog.formData.get("dialogo") as string;
        } else if (
          fetcherDialog.data?.ok &&
          fetcherDialog.data.interventionId === interv.id &&
          fetcherDialog.data.type === "update_dialog" &&
          typeof fetcherDialog.data.newDialog === 'string'
        ) {
          updatedInterv.dialogo = fetcherDialog.data.newDialog;
        }

        // Optimismo para timecode
        if (
          fetcherTimecode.formData &&
          fetcherTimecode.formData.get("interventionId") === String(interv.id) &&
          fetcherTimecode.formData.get("_action") === "update_timecode"
        ) {
          const newTcIn = fetcherTimecode.formData.get("tc_in") as string | null;
          // Aquí no es necesario `updatedInterv.tc_in = newTcIn` porque el componente IntervencionEditable
          // ya muestra el valor del formData directamente para tc_in (optimisticTCInToShow).
          // Si quisiéramos que el `takes` en sí mismo se actualice, sí lo haríamos.
          // Por ahora, dejaremos que IntervencionEditable maneje la visualización optimista del TC.
          // Sin embargo, para consistencia, podríamos añadirlo:
           if (newTcIn !== undefined) { // Si es null, es un valor válido (borrar TC)
             updatedInterv.tc_in = newTcIn;
           }
        } else if (
            fetcherTimecode.data?.ok &&
            fetcherTimecode.data.interventionId === interv.id &&
            fetcherTimecode.data.type === "update_timecode" &&
            (fetcherTimecode.data.tc_in !== undefined ) // Puede ser null
        ) {
            updatedInterv.tc_in = fetcherTimecode.data.tc_in;
        }


        return updatedInterv;
      }),
    }));
  }, [
    initialTakes,
    fetcherStatus.formData, fetcherStatus.data,
    fetcherDialog.formData, fetcherDialog.data,
    fetcherTimecode.formData, fetcherTimecode.data,
  ]);

  const currentTake = useMemo(() => {
    if (!takes || takes.length === 0 || currentTakeIndex < 0 || currentTakeIndex >= takes.length) return null;
    return takes[currentTakeIndex];
  }, [takes, currentTakeIndex]);

  const filteredInterventions = useMemo(() => {
    if (!currentTake) return [];
    // Aquí no se aplica filtro por searchTerm, se muestran todas las del take actual.
    // El resaltado por searchTerm se hace en IntervencionEditable.
    return currentTake.intervenciones;
  }, [currentTake]);

  const findTakeWithPendingIntervention = useCallback(
    (characterName: string, startIndex: number, direction: "forward" | "backward"): number => {
      if (!takes || takes.length === 0 || !characterName) return -1;
      const charLower = characterName.toLowerCase().trim();
      if (direction === "forward") {
        for (let i = startIndex; i < takes.length; i++) {
          if (i < 0) continue; // Asegura que el índice no sea negativo
          const take = takes[i];
          if (take.intervenciones.some(int => int.personaje.toLowerCase().includes(charLower) && !int.completo)) {
            return i;
          }
        }
      } else { // backward
        for (let i = startIndex; i >= 0; i--) {
          if (i >= takes.length) continue; // Asegura que el índice no se pase
          const take = takes[i];
          if (take.intervenciones.some(int => int.personaje.toLowerCase().includes(charLower) && !int.completo)) {
            return i;
          }
        }
      }
      return -1;
    },
    [takes]
  );

  useEffect(() => {
    if (searchTerm.trim() !== "" && isPerformingSearchJump) {
      setSearchMessage(null); // Limpia mensaje anterior
      const firstTakeIndex = findTakeWithPendingIntervention(searchTerm, 0, "forward");
      if (firstTakeIndex !== -1) {
        setCurrentTakeIndex(firstTakeIndex);
      } else {
        // Si no hay pendientes, buscar la primera aparición (completa o no)
        const anyTakeIndex = takes.findIndex(take =>
          take.intervenciones.some(int => int.personaje.toLowerCase().includes(searchTerm.trim().toLowerCase()))
        );
        if (anyTakeIndex !== -1) {
          setCurrentTakeIndex(anyTakeIndex);
          setSearchMessage(`No hay intervenciones pendientes para ${searchTerm}. Mostrando primera aparición.`);
        } else {
          setSearchMessage(`${searchTerm} no tiene intervenciones en este capítulo.`);
        }
      }
      setIsPerformingSearchJump(false); // Resetea el flag de salto
    } else if (searchTerm.trim() === "") {
      setSearchMessage(null); // Limpia el mensaje si el término de búsqueda se borra
    }
  }, [searchTerm, takes, findTakeWithPendingIntervention, isPerformingSearchJump]);


  const handleSearchTermChange = (newSearchTerm: string) => {
    const oldSearchTerm = searchTerm;
    setSearchTerm(newSearchTerm);
    if (newSearchTerm.trim() !== "" && newSearchTerm.trim().toLowerCase() !== oldSearchTerm.trim().toLowerCase()) {
      setIsPerformingSearchJump(true);
    } else if (newSearchTerm.trim() === "" && oldSearchTerm.trim() !== "") {
      // Si se borra el término de búsqueda, no es necesario un "salto", 
      // simplemente se dejará de resaltar.
      setIsPerformingSearchJump(false); 
    }
  };

  const goToNextTake = () => {
    if (searchTerm.trim() !== "") {
      const searchStartIndex = Math.min(takes.length - 1, currentTakeIndex + 1);
      const nextFoundIndex = findTakeWithPendingIntervention(searchTerm, searchStartIndex, "forward");
      if (nextFoundIndex !== -1) {
        setCurrentTakeIndex(nextFoundIndex);
        setSearchMessage(null);
      } else {
        setSearchMessage(`No más intervenciones pendientes para ${searchTerm} después de este take.`);
      }
    } else {
      setCurrentTakeIndex((prevIndex) => Math.min(prevIndex + 1, takes.length - 1));
    }
  };

  const goToPrevTake = () => {
    if (searchTerm.trim() !== "") {
      const searchStartIndex = Math.max(0, currentTakeIndex - 1);
      const prevFoundIndex = findTakeWithPendingIntervention(searchTerm, searchStartIndex, "backward");
      if (prevFoundIndex !== -1) {
        setCurrentTakeIndex(prevFoundIndex);
        setSearchMessage(null);
      } else {
        setSearchMessage(`No más intervenciones pendientes para ${searchTerm} antes de este take.`);
      }
    } else {
      setCurrentTakeIndex((prevIndex) => Math.max(prevIndex - 1, 0));
    }
  };
  
  const handleTakeSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIndex = parseInt(event.target.value, 10);
    if (!isNaN(selectedIndex)) {
      setCurrentTakeIndex(selectedIndex);
      setIsPerformingSearchJump(false); // Reset jump state on manual take selection
    }
  };


  if (loaderError) {
    return (
      <div className="alert alert-error m-4" role="alert">
        <strong className="alert-title">Error al cargar los datos del capítulo:</strong>
        <p>{loaderError}</p>
        {capitulo?.serie_id && (
          <Link
            to={`/series/${capitulo.serie_id}`} 
            className="mt-4 btn btn-primary btn-sm"
          >
            Volver a la serie
          </Link>
        )}
      </div>
    );
  }
  if (!takes || takes.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl text-gray-600 dark:text-gray-400">
          No hay takes disponibles para este capítulo.
        </p>
        {capitulo?.serie_id && (
          <Link
            to={`/series/${capitulo.serie_id}`} 
            className="mt-4 btn btn-primary"
          >
            Volver a la serie
          </Link>
        )}
      </div>
    );
  }
  if (!currentTake) {
    // Esto podría pasar brevemente si los takes se cargan pero currentTakeIndex es inválido.
    // O si el useMemo de currentTake aún no se ha ejecutado con los takes cargados.
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        Cargando take actual...
      </div>
    );
  }

  const noNextTakeForSearch =
    searchTerm.trim() !== "" &&
    findTakeWithPendingIntervention(searchTerm, currentTakeIndex + 1, "forward") === -1;
  const noPrevTakeForSearch =
    searchTerm.trim() !== "" &&
    findTakeWithPendingIntervention(searchTerm, currentTakeIndex - 1, "backward") === -1;


  return (
    <div className="p-4 md:p-6 space-y-6">
      <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
        {capitulo && (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white mb-1">
              Capítulo {capitulo.numero_capitulo}
              {capitulo.titulo_capitulo ? `: ${capitulo.titulo_capitulo}` : ""}
            </h1>
            <Link
              to="/series" // Asumiendo que esta es la ruta correcta para la lista de series
              className="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
            >
              Volver a la Lista de Series
            </Link>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            onClick={goToPrevTake}
            disabled={
              (searchTerm.trim() === "" && currentTakeIndex === 0) ||
              (searchTerm.trim() !== "" && noPrevTakeForSearch)
            }
            className="btn btn-primary"
          >
            Anterior
          </button>

          <div className="flex-grow flex flex-col sm:flex-row items-center justify-center gap-4 mx-auto px-2">
            <div className="flex-shrink-0">
              <label htmlFor="take-select" className="sr-only">
                Ir al Take:
              </label>
              <select
                id="take-select"
                value={currentTakeIndex}
                onChange={handleTakeSelect}
                className="input-select mt-0 w-full sm:w-auto"
              >
                {takes.map((take, index) => (
                  <option key={take.id} value={index}>
                    Take {take.numero_take} ({take.tc_in || "N/A"} -{" "}
                    {take.tc_out || "N/A"})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto">
              <label htmlFor="search-personaje" className="sr-only">
                Buscar Personaje:
              </label>
              <input
                id="search-personaje"
                type="search"
                list="personajes-datalist"
                placeholder="Buscar personaje..."
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                className="input-text mt-0 w-full"
              />
              {personajesUnicos && personajesUnicos.length > 0 && (
                <datalist id="personajes-datalist">
                  {personajesUnicos.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              )}
            </div>
          </div>

          <button
            onClick={goToNextTake}
            disabled={
              (searchTerm.trim() === "" && currentTakeIndex === takes.length - 1) ||
              (searchTerm.trim() !== "" && noNextTakeForSearch)
            }
            className="btn btn-primary"
          >
            Siguiente
          </button>
        </div>
        {searchMessage && (
          <p 
            key={searchMessage} 
            className="mt-2 text-sm text-center text-blue-600 dark:text-blue-400 animate-fadeIn"
          >
            {searchMessage}
          </p>
        )}
      </header>

      <section 
        key={currentTake.id} 
        aria-labelledby={`take-heading-${currentTake.id}`}
        className="animate-fadeInUp" 
      >
        <div
          id={`take-heading-${currentTake.id}`}
          className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-800 dark:text-gray-100 shadow"
        >
          <h3 className="text-lg font-semibold">
            Take {currentTake.numero_take}:{" "}
            <span className="ml-2 font-normal text-sm text-gray-600 dark:text-gray-400">
              TC In: {currentTake.tc_in ?? "N/A"} / TC Out:{" "}
              {currentTake.tc_out ?? "N/A"}
            </span>
          </h3>
        </div>

        {filteredInterventions.length > 0 ? (
          <div className="space-y-3">
            {filteredInterventions.map((interv) => {
              // Determinar si esta intervención específica está siendo actualizada por cada fetcher
              const isUpdatingThisStatus =
                fetcherStatus.state !== "idle" &&
                fetcherStatus.formData?.get("interventionId") === String(interv.id) &&
                fetcherStatus.formData?.get("_action") === "update_status";
              
              const isUpdatingThisDialog =
                fetcherDialog.state !== "idle" &&
                fetcherDialog.formData?.get("interventionId") === String(interv.id) &&
                fetcherDialog.formData?.get("_action") === "update_dialog";

              const isUpdatingThisTimecode =
                fetcherTimecode.state !== "idle" &&
                fetcherTimecode.formData?.get("interventionId") === String(interv.id) &&
                fetcherTimecode.formData?.get("_action") === "update_timecode";

              // Determinar el estado 'completo' visual para esta intervención (considerando optimismo)
              // `interv.completo` aquí viene del `useMemo(takes, ...)` que ya maneja el optimismo.
              const displayIntervCompleto = interv.completo;
                
              const isSearched =
                searchTerm.trim() !== "" &&
                interv.personaje.toLowerCase().includes(searchTerm.trim().toLowerCase());
              const isSearchedAndPending = isSearched && !displayIntervCompleto;

              return (
                <IntervencionEditable
                  key={interv.id}
                  intervencion={interv} // Pasar la intervención del array 'takes' (que ya es optimista)
                  isSearchedAndPending={isSearchedAndPending}
                  isUpdatingStatus={isUpdatingThisStatus}
                  isUpdatingDialog={isUpdatingThisDialog}
                  isUpdatingTimecode={isUpdatingThisTimecode}
                  displayCompleto={displayIntervCompleto} // Pasar el estado optimista de 'completo'
                  fetcherStatus={fetcherStatus}
                  fetcherDialog={fetcherDialog}
                  fetcherTimecode={fetcherTimecode}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-6">
            {searchTerm
              ? `No se encontraron intervenciones para "${searchTerm}" en este take.`
              : "No hay intervenciones en este take."}
          </p>
        )}
      </section>
    </div>
  );
}