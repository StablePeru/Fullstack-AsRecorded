// frontend/app/routes/series.tsx

import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  json,
  unstable_parseMultipartFormData as parseMultipartFormData,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "@remix-run/react";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import anime from 'animejs/lib/anime.es.js';

import { UserSession, authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

// --- Icono de Búsqueda (SVG - Sin cambios) ---
function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
      />
    </svg>
  );
}

// --- Interfaces, Tipos, Helpers, Meta, Loader, Action, Action Handlers (SIN CAMBIOS) ---
// ... (Todo el código existente hasta el componente SeriesPage) ...
interface Serie { id: number; numero_referencia: string; nombre_serie: string; }
interface Capitulo { id: number; numero_capitulo: number; titulo_capitulo: string | null; }
export type LoaderData = { user: UserSession; series: Serie[]; error?: string; };
export type ActionData = | { _action: "add_serie"; success?: boolean; error?: string; serie?: Serie } | { _action: "delete_serie"; deletedSerieId?: number; success?: boolean; error?: string; } | { _action: "import_excel"; success?: boolean; message?: string; error?: string; } | { error: string };
const getApiBaseUrl = () => { return process.env.API_BASE_URL || ""; };
const asJson = <T,>(data: T, status = 200) => json<T>(data, { status });
const isMultipart = (req: Request) => (req.headers.get("Content-Type") ?? "").includes("multipart/form-data");
export const meta: MetaFunction = () => [{ title: "Gestión de Series" }];
export async function loader({ request }: LoaderFunctionArgs) { /* ... sin cambios ... */
    const user = await authenticator.isAuthenticated(request, { failureRedirect: "/login", });
    try {
        const res = await apiFetch(request, "/series");
        if (!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.error || `API respondió ${res.status}`); }
        const series: Serie[] = await res.json();
        return asJson<LoaderData>({ user, series });
    } catch (err: unknown) { const error = err instanceof Error ? err : new Error(String(err)); console.error("[/series.loader] error:", error.message); return asJson<LoaderData>({ user, series: [], error: error.message }, 500); }
}
export async function action({ request }: ActionFunctionArgs) { /* ... sin cambios ... */
    await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
    if (isMultipart(request)) return handleImportExcel(request);
    const form = await request.formData();
    switch (form.get("_action")) {
        case "add_serie": return handleAddSerie(request, form);
        case "delete_serie": return handleDeleteSerie(request, form);
        default: return asJson<ActionData>({ error: "Acción desconocida." }, 400);
    }
}
async function handleImportExcel(req: Request) { /* ... sin cambios ... */
    const apiEndpoint = "/import/excel";
    const uploadHandler = createMemoryUploadHandler({ maxPartSize: 10 * 1024 * 1024 });
    const form = await parseMultipartFormData(req, uploadHandler);
    const file = form.get("excel_file") as File | null;
    if (!file || file.size === 0) return asJson<ActionData>({ _action: "import_excel", error: "Archivo Excel requerido y no puede estar vacío." }, 400);
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
        return asJson<ActionData>({ _action: "import_excel", error: "Formato de archivo no válido. Solo .xlsx o .xls." }, 400);
    }
    const apiForm = new FormData(); apiForm.append("file", file, file.name);
    try {
        const res = await apiFetch(req, apiEndpoint, { method: "POST", body: apiForm, });
        const payload = await res.json().catch(() => ({ message: "Respuesta no JSON", error: "Error procesando respuesta." }));
        return asJson<ActionData>( { _action: "import_excel", success: res.ok, message: payload.message, error: res.ok ? undefined : payload.error ?? `Error ${res.status}`, }, res.status );
    } catch (err: unknown) { const e = err instanceof Error ? err : new Error(String(err)); return asJson<ActionData>({ _action: "import_excel", error: e.message }, 500); }
}
async function handleAddSerie(req: Request, form: FormData) { /* ... sin cambios ... */
    const numero_referencia = (form.get("numero_referencia") as string)?.trim();
    const nombre_serie = (form.get("nombre_serie") as string)?.trim();
    if (!numero_referencia || !nombre_serie) return asJson<ActionData>({ _action: "add_serie", error: "Referencia y nombre son obligatorios." }, 400);
    try {
        const res = await apiFetch(req, "/series", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero_referencia, nombre_serie }), });
        const payload = await res.json().catch(() => ({}));
        return asJson<ActionData>(
            { _action: "add_serie", success: res.ok, serie: res.ok ? payload : undefined, error: res.ok ? undefined : payload.error ?? `Error ${res.status}`, },
            res.status
        );
    } catch (err: unknown) { const e = err instanceof Error ? err : new Error(String(err)); return asJson<ActionData>({ _action: "add_serie", error: e.message }, 500); }
}
async function handleDeleteSerie(req: Request, form: FormData) { /* ... sin cambios ... */
    const id = Number(form.get("serie_id"));
    if (isNaN(id) || id <=0) return asJson<ActionData>({ _action: "delete_serie", error: "ID de serie inválido." }, 400);
    try {
        const res = await apiFetch(req, `/series/${id}`, { method: "DELETE" });
        let payloadError: string | undefined; if (!res.ok) { const eD = await res.json().catch(() => ({})); payloadError = eD.error ?? `Error ${res.status}.`; }
        return asJson<ActionData>( { _action: "delete_serie", deletedSerieId: id, success: res.ok, error: payloadError, }, res.status );
    } catch (err: unknown) { const e = err instanceof Error ? err : new Error(String(err)); return asJson<ActionData>({ _action: "delete_serie", deletedSerieId: id, error: e.message }, 500); }
}


/** React component */
export default function SeriesPage() {
  const { user, series: loadedSeries, error: loaderError } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();
  const submit = useSubmit();
  const [expandedSerieId, setExpandedSerieId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  // --- NUEVO ESTADO Y REFERENCIA PARA BÚSQUEDA ANIMADA ---
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // --- FIN NUEVO ESTADO ---

  const isSubmittingAction = (actionName: string) => nav.state === "submitting" && nav.formData?.get("_action") === actionName;
  const deletingSerieId = isSubmittingAction("delete_serie") ? Number(nav.formData?.get("serie_id")) : undefined;

  const seriesWithOptimistic = useMemo(() => { /* ... sin cambios ... */
    let currentSeries = [...(loadedSeries || [])];
    if (isSubmittingAction("add_serie") && nav.formData) {
      const numero_referencia = nav.formData.get("numero_referencia") as string;
      const nombre_serie = nav.formData.get("nombre_serie") as string;
      if (numero_referencia && nombre_serie) {
        const optimisticSerie: Serie = {
          id: -Date.now(),
          numero_referencia,
          nombre_serie,
        };
        currentSeries = [optimisticSerie, ...currentSeries];
      }
    }
    return currentSeries;
  }, [loadedSeries, nav.state, nav.formData]);

  const filteredSeries = useMemo(() => { /* ... sin cambios ... */
    const lowerCaseSearch = searchTerm.toLowerCase().trim();
    if (!lowerCaseSearch) {
      return seriesWithOptimistic;
    }
    return seriesWithOptimistic.filter(serie =>
      serie.nombre_serie.toLowerCase().includes(lowerCaseSearch) ||
      serie.numero_referencia.toLowerCase().includes(lowerCaseSearch)
    );
  }, [seriesWithOptimistic, searchTerm]);

  const handleConfirmDelete = useCallback((e: React.FormEvent<HTMLFormElement>) => { /* ... sin cambios ... */
    e.preventDefault();
    const serieName = e.currentTarget.dataset.serieName;
    if (window.confirm(`¿Eliminar la serie “${serieName}” y todos sus capítulos y takes asociados? Esta acción es irreversible.`)) {
      submit(e.currentTarget);
    }
  }, [submit]);

  // --- NUEVO EFECTO PARA FOCUS ---
  useEffect(() => {
    if (isSearchExpanded) {
      // Pequeño delay para asegurar que la transición de CSS haya comenzado
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50); // 50ms suele ser suficiente
      return () => clearTimeout(timer);
    }
  }, [isSearchExpanded]);
  // --- FIN NUEVO EFECTO ---

  // --- NUEVO HANDLER PARA COLAPSAR ---
  const handleSearchBlur = () => {
    // Solo colapsar si el campo está vacío
    if (!searchTerm.trim()) {
      setIsSearchExpanded(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
          setSearchTerm(""); // Limpiar búsqueda
          setIsSearchExpanded(false);
          e.currentTarget.blur(); // Quitar foco
      }
  }
  // --- FIN NUEVO HANDLER ---

  const expandAndFocusSearch = () => {
      if (!isSearchExpanded) {
          setIsSearchExpanded(true);
          // El useEffect [isSearchExpanded] se encargará del focus
      } else {
          // Si ya está expandido, sólo asegúrate de que tiene el foco
          searchInputRef.current?.focus();
      }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10 flex-grow">
      <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Gestión de Series
        </h1>
      </header>

      {loaderError && <ErrorAlert message={`Error al cargar series: ${loaderError}`} />}

      <ImportExcelForm feedback={actionData} disabled={isSubmittingAction("import_excel")} />

      {/* --- Sección de Series Existentes con Buscador MODIFICADO --- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 flex-shrink-0">
              Series Existentes
          </h2>

          {/* --- CONTENEDOR DEL BUSCADOR ANIMADO --- */}
          <div className="relative flex items-center justify-end h-10 w-full sm:w-auto">

            {/* --- Input de Búsqueda (Ahora animado) --- */}
            <input
              ref={searchInputRef}
              type="text"
              id="search-series"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onBlur={handleSearchBlur} // <-- Mantenemos onBlur
              onFocus={() => setIsSearchExpanded(true)} // <-- Asegura expansión al recibir foco por Tab
              onKeyDown={handleSearchKeyDown} // <-- Mantenemos Escape
              placeholder={isSearchExpanded ? "Buscar por nombre o ref..." : ""}
              aria-label="Buscar series por nombre o referencia"
              // --- CLASES CONDICIONALES Y DE TRANSICIÓN ---
              className={`
                input-text absolute right-0 top-0 h-full rounded-md border shadow-sm
                focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-600 dark:focus:border-indigo-600
                transition-all duration-500 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)] /* <-- Duración y Easing personalizado */
                ${isSearchExpanded
                  ? 'w-full sm:min-w-[250px] md:min-w-[300px] pl-10 pr-4 opacity-100 z-10' // Expandido: ancho completo, padding, opacidad, encima del icono
                  : 'w-10 pl-3 pr-3 opacity-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' // Colapsado: ancho fijo, padding mínimo, cursor
                }
              `}
              // No necesitamos onClick aquí si el icono lo maneja
            />

            {/* --- Icono de Búsqueda (Posicionado Absolutamente) --- */}
            <div
                 // **MODIFICADO**: El icono ahora está encima del input colapsado y maneja el click
                 // Usamos z-index para asegurar que el icono sea clickable cuando el input está colapsado
                 // y el input esté encima cuando está expandido.
                 className={`
                    absolute inset-y-0 left-0 pl-3 flex items-center
                    transition-opacity duration-300
                    ${isSearchExpanded
                        ? 'pointer-events-none opacity-100 z-0' // Cuando está expandido, el icono no es interactivo y está detrás lógicamente
                        : 'pointer-events-auto cursor-pointer opacity-100 z-20' // Cuando está colapsado, es interactivo y está encima
                    }
                 `}
                 onClick={expandAndFocusSearch} // <-- Llama a la nueva función
                 role={!isSearchExpanded ? "button" : undefined}
                 tabIndex={!isSearchExpanded ? 0 : -1}
                 aria-expanded={isSearchExpanded}
                 aria-controls="search-series"
                 onKeyDown={(e) => { if (!isSearchExpanded && (e.key === 'Enter' || e.key === ' ')) expandAndFocusSearch(); }}
            >
               <SearchIcon className={`w-5 h-5 transition-colors duration-200 ${isSearchExpanded ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`} />
            </div>
             {/* --- FIN CONTENEDOR DEL BUSCADOR ANIMADO --- */}

          </div>
          {/* FIN: Contenedor relativo */}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {/* ... (mensaje de búsqueda sin cambios) ... */}
          Haz clic en una serie para ver sus capítulos o gestionarla.
        </p>

        {actionData?._action === "delete_serie" && actionData.error && (
            <ErrorAlert message={`Error al eliminar serie: ${actionData.error}`} />
        )}

        <SeriesList
            series={filteredSeries}
            expandedSerieId={expandedSerieId}
            toggleSerieExpansion={(id) => setExpandedSerieId(expandedSerieId === id ? null : id)}
            onDeleteConfirm={handleConfirmDelete}
            deletingSerieId={deletingSerieId}
        />
        {searchTerm && !filteredSeries.length && (
             <p className="mt-4 text-center text-gray-500 dark:text-gray-400 italic">
                 No se encontraron series que coincidan con "{searchTerm}".
            </p>
        )}
      </section>
      {/* --- FIN: Sección Series Existentes --- */}

      <AddSerieForm feedback={actionData} disabled={isSubmittingAction("add_serie")} />
    </div>
  );
}

// --- UI helpers (ErrorAlert, SuccessAlert - Sin cambios) ---
function ErrorAlert({ message }: { message: string }) { return ( <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-600" role="alert"> <span className="font-medium">Error:</span> {message} </div> ); }
function SuccessAlert({ message }: { message: string }) { return ( <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-600" role="alert"> <span className="font-medium">Éxito:</span> {message} </div> ); }


// --- StyledDetails Component (usando la versión con animación grid anterior) ---
function StyledDetails({ summary, children, initiallyOpen = false }: { summary: string, children: React.ReactNode, initiallyOpen?: boolean }) {
    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const contentId = useMemo(() => `details-content-${Math.random().toString(36).substring(2, 9)}`, []);

    return (
        <div className="bg-white dark:bg-gray-800/50 shadow-md rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div
                role="button"
                tabIndex={0}
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="px-5 py-3 text-lg font-medium text-gray-700 dark:text-gray-200 cursor-pointer list-none flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors duration-150"
            >
                {summary}
                <svg
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-300 ease-in-out transform ${isOpen ? "rotate-180" : ""}`}
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
            <div
                id={contentId}
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
                <div className="overflow-hidden">
                    <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-600">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- ImportExcelForm (Sin cambios internos, usa StyledDetails modificado) ---
function ImportExcelForm({ feedback, disabled, }: { feedback: ActionData | undefined; disabled: boolean; }) {
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        if (feedback?._action === "import_excel" && feedback.success) {
            formRef.current?.reset();
        }
    }, [feedback]);
    return (
        <StyledDetails summary="Importar Capítulos desde Excel">
        <Form ref={formRef} method="post" encType="multipart/form-data" className="space-y-6">
            <input type="hidden" name="_action" value="import_excel" />
            <div>
            <label htmlFor="excel_file" className="form-label">Seleccionar archivo Excel (.xlsx, .xls)</label>
            <input type="file" id="excel_file" name="excel_file" accept=".xlsx,.xls" required
                className="input-file"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tamaño máximo: 10MB.</p>
            </div>
            {feedback?._action === "import_excel" && (feedback.error ? <ErrorAlert message={feedback.error} /> : feedback.success ? <SuccessAlert message={feedback.message ?? "¡Importación completada!"} /> : null)}
            <button type="submit" disabled={disabled} className="btn btn-primary">
                <span className="material-icons-outlined mr-2 text-base leading-none" aria-hidden="true">upload_file</span>
                {disabled ? "Importando…" : "Importar Archivo"}
            </button>
        </Form>
        </StyledDetails>
    );
}

// --- AddSerieForm (Sin cambios internos, usa StyledDetails modificado) ---
function AddSerieForm({ feedback, disabled, }: { feedback: ActionData | undefined; disabled: boolean; }) {
    const formRef = useRef<HTMLFormElement>(null);
    const [lastSubmissionStatus, setLastSubmissionStatus] = useState<"idle" | "success" | "error">("idle");

    useEffect(() => {
        if (feedback?._action === "add_serie") {
        if (feedback.success) {
            formRef.current?.reset();
            setLastSubmissionStatus("success");
        } else if (feedback.error) {
            setLastSubmissionStatus("error");
        }
        }
    }, [feedback]);

    useEffect(() => {
        if (disabled) {
        setLastSubmissionStatus("idle");
        }
    }, [disabled]);

    return (
        <StyledDetails summary="Añadir Nueva Serie Manualmente" initiallyOpen={lastSubmissionStatus === 'error'}>
        <Form ref={formRef} method="post" className="space-y-6">
            <input type="hidden" name="_action" value="add_serie" />
            <div>
            <label htmlFor="numero_referencia" className="form-label">Número de Referencia</label>
            <input type="text" name="numero_referencia" id="numero_referencia" required
                    className="input-text" /> {/* Usar input-text base */}
            </div>
            <div>
            <label htmlFor="nombre_serie" className="form-label">Nombre de la Serie</label>
            <input type="text" name="nombre_serie" id="nombre_serie" required
                    className="input-text" /> {/* Usar input-text base */}
            </div>

            {lastSubmissionStatus === 'error' && feedback?._action === "add_serie" && feedback.error && (<ErrorAlert message={feedback.error} />)}
            {lastSubmissionStatus === 'success' && feedback?._action === "add_serie" && feedback.success && (<SuccessAlert message="¡Serie añadida correctamente!" />)}

            <button type="submit" disabled={disabled} className="btn btn-success">
            {disabled ? "Añadiendo…" : "Añadir Serie"}
            </button>
        </Form>
        </StyledDetails>
    );
}


// --- SeriesList y SerieChapters (Sin Cambios) ---
function SeriesList({ series, expandedSerieId, toggleSerieExpansion, onDeleteConfirm, deletingSerieId, }: { series: Serie[]; expandedSerieId: number | null; toggleSerieExpansion: (id: number) => void; onDeleteConfirm: (e: React.FormEvent<HTMLFormElement>) => void; deletingSerieId?: number; }) { /* ... sin cambios ... */
    if (!series.length) return null;
    return (
        <ul className="space-y-4">
            {series.map((s) => {
                const isOptimistic = s.id < 0;
                return (
                <li key={s.id} className={`bg-white dark:bg-gray-800/60 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${isOptimistic ? 'opacity-60 animate-pulse' : ''}`}>
                    <header
                        className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors"
                        onClick={() => !isOptimistic && toggleSerieExpansion(s.id)}
                        aria-expanded={expandedSerieId === s.id}
                        aria-controls={`chapters-${s.id}`}
                    >
                        <div className="flex-grow min-w-0 mr-4">
                        <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400 truncate">{s.nombre_serie}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            Ref: {s.numero_referencia} {isOptimistic ? '(Guardando...)' : `• ID: ${s.id}`}
                        </p>
                        </div>
                        <div className="flex-shrink-0 ml-auto flex items-center space-x-3">
                            {!isOptimistic && (
                            <Form method="post" data-serie-name={s.nombre_serie} onSubmit={onDeleteConfirm} onClick={(e) => e.stopPropagation()} >
                                <input type="hidden" name="_action" value="delete_serie" />
                                <input type="hidden" name="serie_id" value={s.id} />
                                <button type="submit" disabled={deletingSerieId === s.id}
                                        className="btn btn-danger-sm">
                                    {deletingSerieId === s.id ? "Eliminando…" : "Eliminar"}
                                </button>
                            </Form>
                            )}
                            {!isOptimistic && (
                                <svg className={`w-5 h-5 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${expandedSerieId === s.id ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    </header>

                    {expandedSerieId === s.id && !isOptimistic && (
                        <div id={`chapters-${s.id}`} className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 px-4 py-4 sm:px-5">
                        <SerieChapters serieId={s.id} />
                        </div>
                    )}
                </li>
                );
            })}
        </ul>
    );
}
function SerieChapters({ serieId }: { serieId: number }) { /* ... sin cambios ... */
    const fetcher = useFetcher<Capitulo[] | { error: string }>();

    useEffect(() => {
        if (fetcher.state === "idle" && !fetcher.data) {
        fetcher.load(`/api/chapters/${serieId}`);
        }
    }, [fetcher, serieId]);

    if (fetcher.state === "loading") {
        return (
        <div className="flex items-center justify-center p-4">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">Cargando capítulos…</span>
        </div>
        );
    }

    const error = fetcher.data && typeof fetcher.data === 'object' && 'error' in fetcher.data
                    ? (fetcher.data as { error: string }).error
                    : undefined;

    if (error) return <ErrorAlert message={`Error al cargar capítulos: ${error}`} />;

    const capitulos = Array.isArray(fetcher.data) ? fetcher.data : [];

    if (!capitulos.length && fetcher.state !== 'loading') {
        return <p className="text-sm text-gray-500 dark:text-gray-400 italic">Esta serie no tiene capítulos registrados.</p>;
    }

    return (
        <div className="flow-root">
            <ul role="list" className="-mb-2">
            {capitulos.map((c, index) => (
                <li key={c.id} className={`py-2 ${index !== capitulos.length -1 ? 'border-b border-gray-200 dark:border-gray-700/50' : ''}`}>
                <div className="relative group">
                    <Link
                    to={`/takes/${c.id}`}
                    className="block p-2 -m-2 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors group"
                    title={`Abrir takes para Cap. ${c.numero_capitulo}`}
                    >
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Cap. {c.numero_capitulo}{c.titulo_capitulo ? `: ${c.titulo_capitulo}` : ""}</span>
                        <svg className="w-5 h-5 text-indigo-400 dark:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ID Cap: {c.id}</p>
                    </Link>
                </div>
                </li>
            ))}
            </ul>
        </div>
    );
}


// Asegúrate que estas clases base existen en tu tailwind.css
// .input-text, .form-label, .btn-primary, .btn-success, .btn-danger-sm, .input-file