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
  useRef, // <-- AÑADIDO para limpiar formulario
  useMemo, // <-- AÑADIDO para UI optimista
} from "react";

import { UserSession, authenticator } from "~/services/auth.server";
import { apiFetch } from "~/utils/api.server";

// --- Interfaces, Tipos, Helpers, Meta, Loader, Action, Action Handlers (SIN CAMBIOS SIGNIFICATIVOS, excepto que handleAddSerie ya devuelve la serie) ---
// (Mantenemos el código de la respuesta anterior para estas secciones, ya que eran robustos)
/** Domain models */
interface Serie {
  id: number;
  numero_referencia: string;
  nombre_serie: string;
}
interface Capitulo {
  id: number;
  numero_capitulo: number;
  titulo_capitulo: string | null;
}
/** Remix data contracts */
export type LoaderData = {
  user: UserSession;
  series: Serie[];
  error?: string;
};
export type ActionData =
  | { _action: "add_serie"; success?: boolean; error?: string; serie?: Serie }
  | { _action: "delete_serie"; deletedSerieId?: number; success?: boolean; error?: string; }
  | { _action: "import_excel"; success?: boolean; message?: string; error?: string; }
  | { error: string };
/** Helpers */
const getApiBaseUrl = () => { return process.env.API_BASE_URL || ""; };
const asJson = <T,>(data: T, status = 200) => json<T>(data, { status });
const isMultipart = (req: Request) => (req.headers.get("Content-Type") ?? "").includes("multipart/form-data");
/** Meta */
export const meta: MetaFunction = () => [{ title: "Gestión de Series" }];
/** Loader */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, { failureRedirect: "/login", });
  try {
    const res = await apiFetch(request, "/series");
    if (!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.error || `API respondió ${res.status}`); }
    const series: Serie[] = await res.json();
    return asJson<LoaderData>({ user, series });
  } catch (err: unknown) { const error = err instanceof Error ? err : new Error(String(err)); console.error("[/series.loader] error:", error.message); return asJson<LoaderData>({ user, series: [], error: error.message }, 500); }
}
/** Action */
export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  if (isMultipart(request)) return handleImportExcel(request);
  const form = await request.formData();
  switch (form.get("_action")) {
    case "add_serie": return handleAddSerie(request, form);
    case "delete_serie": return handleDeleteSerie(request, form);
    default: return asJson<ActionData>({ error: "Acción desconocida." }, 400);
  }
}
/** Action handlers */
async function handleImportExcel(req: Request) {
  const apiEndpoint = "/import/excel";
  const uploadHandler = createMemoryUploadHandler({ maxPartSize: 10 * 1024 * 1024 });
  const form = await parseMultipartFormData(req, uploadHandler);
  const file = form.get("excel_file") as File | null;
  if (!file || file.size === 0) return asJson<ActionData>({ _action: "import_excel", error: "Archivo Excel requerido y no puede estar vacío." }, 400);
  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) return asJson<ActionData>({ _action: "import_excel", error: "Formato de archivo no válido. Solo .xlsx o .xls." }, 400);
  const apiForm = new FormData(); apiForm.append("file", file, file.name);
  try {
    const res = await apiFetch(req, apiEndpoint, { method: "POST", body: apiForm, });
    const payload = await res.json().catch(() => ({ message: "Respuesta no JSON", error: "Error procesando respuesta." }));
    return asJson<ActionData>( { _action: "import_excel", success: res.ok, message: payload.message, error: res.ok ? undefined : payload.error ?? `Error ${res.status}`, }, res.status );
  } catch (err: unknown) { const e = err instanceof Error ? err : new Error(String(err)); return asJson<ActionData>({ _action: "import_excel", error: e.message }, 500); }
}
async function handleAddSerie(req: Request, form: FormData) {
  const numero_referencia = (form.get("numero_referencia") as string)?.trim();
  const nombre_serie = (form.get("nombre_serie") as string)?.trim();
  if (!numero_referencia || !nombre_serie) return asJson<ActionData>({ _action: "add_serie", error: "Referencia y nombre son obligatorios." }, 400);
  try {
    const res = await apiFetch(req, "/series", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numero_referencia, nombre_serie }), });
    const payload = await res.json().catch(() => ({})); // payload puede ser la nueva serie o un error
    return asJson<ActionData>(
      { _action: "add_serie", success: res.ok, serie: res.ok ? payload : undefined, /* Asumimos que la API devuelve la serie creada directamente en el cuerpo */ error: res.ok ? undefined : payload.error ?? `Error ${res.status}`, },
      res.status
    );
  } catch (err: unknown) { const e = err instanceof Error ? err : new Error(String(err)); return asJson<ActionData>({ _action: "add_serie", error: e.message }, 500); }
}
async function handleDeleteSerie(req: Request, form: FormData) {
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
  const { user, series: loadedSeries, error: loaderError } = useLoaderData<LoaderData>(); // Renombrado a loadedSeries
  const actionData = useActionData<ActionData>();
  const nav = useNavigation();
  const submit = useSubmit();
  const [expandedSerieId, setExpandedSerieId] = useState<number | null>(null);

  const isSubmittingAction = (actionName: string) => nav.state === "submitting" && nav.formData?.get("_action") === actionName;
  const deletingSerieId = isSubmittingAction("delete_serie") ? Number(nav.formData?.get("serie_id")) : undefined;

  // MEJORA 3: UI Optimista para Añadir Serie
  const series = useMemo(() => {
    let currentSeries = [...(loadedSeries || [])];

    if (isSubmittingAction("add_serie") && nav.formData) {
      const numero_referencia = nav.formData.get("numero_referencia") as string;
      const nombre_serie = nav.formData.get("nombre_serie") as string;
      if (numero_referencia && nombre_serie) {
        const optimisticSerie: Serie = {
          id: -Date.now(), // ID temporal negativo para distinguirlo
          numero_referencia,
          nombre_serie,
        };
        // Añadir al principio para que sea visible inmediatamente
        currentSeries = [optimisticSerie, ...currentSeries];
      }
    }
    return currentSeries;
  }, [loadedSeries, nav.state, nav.formData]);


  const handleConfirmDelete = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const serieName = e.currentTarget.dataset.serieName;
    if (window.confirm(`¿Eliminar la serie “${serieName}” y todos sus capítulos y takes asociados? Esta acción es irreversible.`)) {
      submit(e.currentTarget);
    }
  }, [submit]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-10">
      <header className="pb-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Gestión de Series
        </h1>
      </header>

      {loaderError && <ErrorAlert message={`Error al cargar series: ${loaderError}`} />}

      <ImportExcelForm feedback={actionData} disabled={isSubmittingAction("import_excel")} />
      
      <section className="space-y-6">
        <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                Series Existentes
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Haz clic en una serie para ver sus capítulos o gestionarla.
            </p>
        </div>
        {actionData?._action === "delete_serie" && actionData.error && (
            <ErrorAlert message={`Error al eliminar serie: ${actionData.error}`} />
        )}
        <SeriesList
          series={series} // <-- USAR LA LISTA OPTIMISTA/CARGADA
          expandedSerieId={expandedSerieId}
          toggleSerieExpansion={(id) => setExpandedSerieId(expandedSerieId === id ? null : id)}
          onDeleteConfirm={handleConfirmDelete}
          deletingSerieId={deletingSerieId}
        />
      </section>

      <AddSerieForm feedback={actionData} disabled={isSubmittingAction("add_serie")} />
    </div>
  );
}

/** UI helpers con Tailwind */
function ErrorAlert({ message }: { message: string }) { /* ... (sin cambios) ... */ return ( <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-600" role="alert"> <span className="font-medium">Error:</span> {message} </div> ); }
function SuccessAlert({ message }: { message: string }) { /* ... (sin cambios) ... */ return ( <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-600" role="alert"> <span className="font-medium">Éxito:</span> {message} </div> ); }
function StyledDetails({ summary, children, initiallyOpen = false }: { summary: string, children: React.ReactNode, initiallyOpen?: boolean }) { /* ... (sin cambios, pero añadida prop initiallyOpen) ... */ 
    return (
    <details open={initiallyOpen} className="bg-white dark:bg-gray-800/50 shadow-md rounded-lg border border-gray-200 dark:border-gray-700 open:ring-1 open:ring-indigo-500 open:shadow-lg">
      <summary className="px-5 py-3 text-lg font-medium text-gray-700 dark:text-gray-200 cursor-pointer list-none flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-t-lg">
        {summary}
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 transform details-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </summary>
      <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-600">
        {children}
      </div>
    </details>
  );
}

function ImportExcelForm({ feedback, disabled, }: { feedback: ActionData | undefined; disabled: boolean; }) { /* ... (sin cambios) ... */ 
    const formRef = useRef<HTMLFormElement>(null); // Para limpiar el input de archivo
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
          <label htmlFor="excel_file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seleccionar archivo Excel (.xlsx, .xls)</label>
          <input type="file" id="excel_file" name="excel_file" accept=".xlsx,.xls" required
            className="block w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-800 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-700"
          />
           <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Tamaño máximo: 10MB.</p>
        </div>
        {feedback?._action === "import_excel" && (feedback.error ? <ErrorAlert message={feedback.error} /> : feedback.success ? <SuccessAlert message={feedback.message ?? "¡Importación completada!"} /> : null)}
        <button type="submit" disabled={disabled} className="inline-flex items-center justify-center px-4 py-2 btn-primary"><span className="material-icons-outlined mr-2 text-base">upload_file</span>{disabled ? "Importando…" : "Importar Archivo"}</button>
      </Form>
    </StyledDetails>
  );
}

function AddSerieForm({ feedback, disabled, }: { feedback: ActionData | undefined; disabled: boolean; }) {
  // MEJORA 1: Limpiar Formulario de "Añadir Serie"
  const formRef = useRef<HTMLFormElement>(null);
  const [lastSubmissionStatus, setLastSubmissionStatus] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (feedback?._action === "add_serie") {
      if (feedback.success) {
        formRef.current?.reset(); // Limpia el formulario
        setLastSubmissionStatus("success");
      } else if (feedback.error) {
        setLastSubmissionStatus("error");
      }
    }
  }, [feedback]);

  // Si el formulario se está enviando de nuevo, resetear el estado del último envío
  useEffect(() => {
    if (disabled) { // disabled es true cuando isSubmittingAction("add_serie")
      setLastSubmissionStatus("idle");
    }
  }, [disabled]);

  return (
    <StyledDetails summary="Añadir Nueva Serie Manualmente" initiallyOpen={lastSubmissionStatus === 'error'}>
      <Form ref={formRef} method="post" className="space-y-6">
        <input type="hidden" name="_action" value="add_serie" />
        <div>
          <label htmlFor="numero_referencia" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Número de Referencia</label>
          <input type="text" name="numero_referencia" id="numero_referencia" required 
                 className="mt-1 input-text-primary" />
        </div>
        <div>
          <label htmlFor="nombre_serie" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nombre de la Serie</label>
          <input type="text" name="nombre_serie" id="nombre_serie" required 
                 className="mt-1 input-text-primary" />
        </div>

        {lastSubmissionStatus === 'error' && feedback?._action === "add_serie" && feedback.error && (<ErrorAlert message={feedback.error} />)}
        {lastSubmissionStatus === 'success' && feedback?._action === "add_serie" && feedback.success && (<SuccessAlert message="¡Serie añadida correctamente!" />)}
        
        <button type="submit" disabled={disabled} 
                className="inline-flex items-center justify-center px-4 py-2 btn-success">
          {disabled ? "Añadiendo…" : "Añadir Serie"}
        </button>
      </Form>
    </StyledDetails>
  );
}

function SeriesList({ series, expandedSerieId, toggleSerieExpansion, onDeleteConfirm, deletingSerieId, }: { series: Serie[]; expandedSerieId: number | null; toggleSerieExpansion: (id: number) => void; onDeleteConfirm: (e: React.FormEvent<HTMLFormElement>) => void; deletingSerieId?: number; }) {
  // ... (sin cambios significativos, pero ahora recibe 'series' que puede ser la lista optimista)
  if (!series.length && !deletingSerieId) return <p className="mt-4 text-center text-gray-500 dark:text-gray-400 italic">No hay series registradas actualmente.</p>;
  return (
    <ul className="space-y-4">
      {series.map((s) => {
        const isOptimistic = s.id < 0; // Identificar series optimistas por ID negativo
        return (
        <li key={s.id} className={`bg-white dark:bg-gray-800/60 shadow-lg rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${isOptimistic ? 'opacity-60 animate-pulse' : ''}`}>
          <header
            className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/70 transition-colors"
            onClick={() => !isOptimistic && toggleSerieExpansion(s.id)} // No expandir series optimistas
            aria-expanded={expandedSerieId === s.id}
            aria-controls={`chapters-${s.id}`}
          >
            <div className="flex-grow">
              <h3 className="text-lg font-semibold text-indigo-700 dark:text-indigo-400">{s.nombre_serie}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ref: {s.numero_referencia} {isOptimistic ? '(Guardando...)' : `• ID: ${s.id}`}
              </p>
            </div>
            <div className="flex-shrink-0 ml-4">
                {!isOptimistic && ( // No mostrar botón de eliminar para series optimistas
                <Form method="post" data-serie-name={s.nombre_serie} onSubmit={onDeleteConfirm} onClick={(e) => e.stopPropagation()} >
                    <input type="hidden" name="_action" value="delete_serie" />
                    <input type="hidden" name="serie_id" value={s.id} />
                    <button type="submit" disabled={deletingSerieId === s.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:bg-gray-400 dark:disabled:bg-red-800/50 disabled:cursor-not-allowed transition-colors">
                        {deletingSerieId === s.id ? "Eliminando…" : "Eliminar"}
                    </button>
                </Form>
                )}
            </div>
            {!isOptimistic && (
            <svg className={`w-5 h-5 text-gray-500 dark:text-gray-400 ml-3 transform transition-transform duration-200 ${expandedSerieId === s.id ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            )}
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

function SerieChapters({ serieId }: { serieId: number }) {
  const fetcher = useFetcher<{ capitulos?: Capitulo[]; error?: string }>();

  useEffect(() => {
    if (fetcher.state === "idle" && (!fetcher.data || fetcher.data.capitulos === undefined)) {
      fetcher.load(`/api/chapters/${serieId}`);
    }
  }, [fetcher, serieId]);

  // MEJORA 2: Mejorar Indicador de Carga de Capítulos
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
  if (fetcher.data?.error) return <ErrorAlert message={fetcher.data.error} />;

  const capitulos = fetcher.data?.capitulos ?? [];
  if (!capitulos.length) return <p className="text-sm text-gray-500 dark:text-gray-400 italic">Esta serie no tiene capítulos registrados.</p>;

  // ... (resto del componente SerieChapters sin cambios)
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

// He definido algunas clases comunes para botones e inputs aquí para simplificar,
// pero idealmente estarían en tu tailwind.config.js como componentes o en un CSS global.
// Por ejemplo:
// .btn-primary { @apply inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-indigo-500 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:opacity-70; }
// .btn-success { @apply ... bg-green-600 hover:bg-green-700 ... focus:ring-green-500 ...; }
// .input-text-primary { @apply mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100; }
// Para los botones en ImportExcelForm y AddSerieForm, he usado clases directas de Tailwind.