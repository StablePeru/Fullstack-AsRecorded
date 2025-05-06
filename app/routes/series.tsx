// frontend/app/routes/series.tsx

import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  json,
  parseMultipartFormData,
  createMemoryUploadHandler,
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
  useMemo,
  useState,
} from "react";

import { authenticator, UserSession } from "~/services/auth.server";

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Domain models                                                                                                    
 * -----------------------------------------------------------------------------------------------------------------
 */
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

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Remix data contracts                                                                                              
 * -----------------------------------------------------------------------------------------------------------------
 */
export type LoaderData = {
  user: UserSession;
  series: Serie[];
  error?: string;
};

export type ActionData =
  | { _action: "add_serie"; success?: boolean; error?: string }
  | {
      _action: "delete_serie";
      deletedSerieId?: number;
      success?: boolean;
      error?: string;
    }
  | {
      _action: "import_excel";
      success?: boolean;
      message?: string;
      error?: string;
    }
  | { error: string };

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Helpers                                                                                                           
 * -----------------------------------------------------------------------------------------------------------------
 */
const getApiBaseUrl = () => {
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error("API_BASE_URL env variable missing");
  return url;
};

const asJson = <T,>(data: T, status = 200) => json<T>(data, { status });

const isMultipart = (req: Request) =>
  (req.headers.get("Content-Type") ?? "").includes("multipart/form-data");

/**
 * -----------------------------------------------------------------------------------------------------------------
 * <Meta />                                                                                                          
 * -----------------------------------------------------------------------------------------------------------------
 */
export const meta: MetaFunction = () => [{ title: "Gestión de Series" }];

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Loader                                                                                                            
 * -----------------------------------------------------------------------------------------------------------------
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });

  try {
    const res = await fetch(`${getApiBaseUrl()}/series`);
    if (!res.ok) throw new Error(`API responded ${res.status}`);
    const series: Serie[] = await res.json();
    return asJson<LoaderData>({ user, series });
  } catch (err: any) {
    console.error("[/series] loader error:", err);
    return asJson<LoaderData>({ user, series: [], error: err.message }, 500);
  }
}

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Action                                                                                                            
 * -----------------------------------------------------------------------------------------------------------------
 */
export async function action({ request }: ActionFunctionArgs) {
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  const api = getApiBaseUrl();

  if (isMultipart(request)) return handleImportExcel(request, api);

  const form = await request.formData();
  switch (form.get("_action")) {
    case "add_serie":
      return handleAddSerie(form, api);
    case "delete_serie":
      return handleDeleteSerie(form, api);
    default:
      return asJson<ActionData>({ error: "Acción desconocida." }, 400);
  }
}

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Action handlers                                                                                                   
 * -----------------------------------------------------------------------------------------------------------------
 */
async function handleImportExcel(req: Request, api: string) {
  const uploadHandler = createMemoryUploadHandler({
    maxPartSize: 5 * 1024 * 1024,
  });
  const form = await parseMultipartFormData(req, uploadHandler);
  const file = form.get("excel_file") as File | null;

  if (!file)
    return asJson<ActionData>(
      { _action: "import_excel", error: "Archivo requerido." },
      400,
    );

  const apiForm = new FormData();
  apiForm.append("file", file, file.name);

  try {
    const res = await fetch(`${api}/import/excel`, { method: "POST", body: apiForm });
    const payload = await res.json();
    return asJson<ActionData>(
      {
        _action: "import_excel",
        success: res.ok,
        message: payload.message,
        error: res.ok ? undefined : payload.error,
      },
      res.ok ? 200 : res.status,
    );
  } catch (err: any) {
    return asJson<ActionData>({ _action: "import_excel", error: err.message }, 500);
  }
}

async function handleAddSerie(form: FormData, api: string) {
  const numero_referencia = (form.get("numero_referencia") as string)?.trim();
  const nombre_serie = (form.get("nombre_serie") as string)?.trim();

  if (!numero_referencia || !nombre_serie)
    return asJson<ActionData>({ _action: "add_serie", error: "Campos obligatorios." }, 400);

  try {
    const res = await fetch(`${api}/series`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ numero_referencia, nombre_serie }),
    });
    const payload = await res.json();
    return asJson<ActionData>(
      {
        _action: "add_serie",
        success: res.ok,
        error: res.ok ? undefined : payload.error,
      },
      res.ok ? 200 : res.status,
    );
  } catch (err: any) {
    return asJson<ActionData>({ _action: "add_serie", error: err.message }, 500);
  }
}

async function handleDeleteSerie(form: FormData, api: string) {
  const id = Number(form.get("serie_id"));
  if (Number.isNaN(id))
    return asJson<ActionData>({ _action: "delete_serie", error: "ID inválido" }, 400);

  try {
    const res = await fetch(`${api}/series/${id}`, { method: "DELETE" });
    const payload = res.ok ? null : await res.json();
    return asJson<ActionData>(
      {
        _action: "delete_serie",
        deletedSerieId: id,
        success: res.ok,
        error: res.ok ? undefined : payload?.error,
      },
      res.ok ? 200 : res.status,
    );
  } catch (err: any) {
    return asJson<ActionData>(
      { _action: "delete_serie", deletedSerieId: id, error: err.message },
      500,
    );
  }
}

/**
 * -----------------------------------------------------------------------------------------------------------------
 * React component                                                                                                   
 * -----------------------------------------------------------------------------------------------------------------
 */
export default function SeriesPage() {
  const { user, series, error: loaderError } = useLoaderData<LoaderData>();
  const action = useActionData<ActionData>();
  const nav = useNavigation();
  const submit = useSubmit();
  const [expanded, setExpanded] = useState<number | null>(null);

  const isSubmitting = (name: string) =>
    nav.state === "submitting" && nav.formData?.get("_action") === name;

  const deletingId = useMemo(() => {
    if (isSubmitting("delete_serie")) return Number(nav.formData?.get("serie_id"));
  }, [nav]);

  const confirmDelete = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const serie = e.currentTarget.dataset.serieName;
      if (
        window.confirm(
          `¿Eliminar la serie “${serie}” y todo su contenido? Esta acción es irreversible.`,
        )
      )
        submit(e.currentTarget);
    },
    [submit],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Gestión de Series</h1>
        <p className="text-sm text-gray-500">
          Usuario: {user.nombre} (ID: {user.id})
        </p>
      </header>

      <ImportExcelForm feedback={action} disabled={isSubmitting("import_excel")} />

      <section>
        <h2 className="text-xl font-semibold">Series existentes</h2>
        {loaderError && <ErrorBox message={loaderError} />}
        <SeriesList
          series={series}
          expanded={expanded}
          toggle={(id) => setExpanded((v) => (v === id ? null : id))}
          onDeleteConfirm={confirmDelete}
          deletingId={deletingId}
          feedback={action}
        />
      </section>

      <AddSerieForm feedback={action} disabled={isSubmitting("add_serie")} />
    </div>
  );
}

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Stateless UI helpers                                                                                              
 * -----------------------------------------------------------------------------------------------------------------
 */
function ErrorBox({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded border border-red-500 bg-red-50 p-2 text-sm text-red-700">
      {message}
    </p>
  );
}

function SuccessBox({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded border border-green-500 bg-green-50 p-2 text-sm text-green-700">
      {message}
    </p>
  );
}

function ImportExcelForm({
  feedback,
  disabled,
}: {
  feedback: ActionData | undefined;
  disabled: boolean;
}) {
  return (
    <details className="rounded border border-gray-200 p-4 open:mb-4">
      <summary className="cursor-pointer font-medium">
        Importar capítulo desde Excel
      </summary>
      <Form
        method="post"
        encType="multipart/form-data"
        className="mt-4 flex flex-col gap-4"
      >
        <input type="hidden" name="_action" value="import_excel" />
        <input
          type="file"
          name="excel_file"
          accept=".xlsx,.xls"
          required
          className="file:mr-4"
        />

        {feedback?._action === "import_excel" &&
          (feedback.error ? (
            <ErrorBox message={feedback.error} />
          ) : feedback.success ? (
            <SuccessBox
              message={feedback.message ?? "¡Importación completada!"}
            />
          ) : null)}

        <button type="submit" disabled={disabled} className="btn-info self-start">
          {disabled ? "Importando…" : "Importar archivo"}
        </button>
      </Form>
    </details>
  );
}

function AddSerieForm({
  feedback,
  disabled,
}: {
  feedback: ActionData | undefined;
  disabled: boolean;
}) {
  return (
    <details className="rounded border border-gray-200 p-4">
      <summary className="cursor-pointer font-medium">Añadir nueva serie</summary>
      <Form method="post" className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="_action" value="add_serie" />

        <label>
          <span className="block text-sm font-medium">Número de referencia</span>
          <input type="text" name="numero_referencia" required className="input" />
        </label>

        <label>
          <span className="block text-sm font-medium">Nombre de la serie</span>
          <input type="text" name="nombre_serie" required className="input" />
        </label>

        {feedback?._action === "add_serie" &&
          (feedback.error ? (
            <ErrorBox message={feedback.error} />
          ) : feedback.success ? (
            <SuccessBox message="Serie añadida correctamente" />
          ) : null)}

        <button type="submit" disabled={disabled} className="btn-success self-start">
          {disabled ? "Añadiendo…" : "Añadir serie"}
        </button>
      </Form>
    </details>
  );
}

function SeriesList({
  series,
  expanded,
  toggle,
  onDeleteConfirm,
  deletingId,
  feedback,
}: {
  series: Serie[];
  expanded: number | null;
  toggle: (id: number) => void;
  onDeleteConfirm: (e: React.FormEvent<HTMLFormElement>) => void;
  deletingId?: number;
  feedback?: ActionData;
}) {
  if (!series.length)
    return !feedback?.error ? (
      <p className="italic">No hay series registradas.</p>
    ) : null;

  return (
    <ul className="mt-4 space-y-2">
      {series.map((s) => (
        <li key={s.id} className="rounded border border-gray-200">
          <header
            className="flex cursor-pointer items-center justify-between p-4"
            onClick={() => toggle(s.id)}
            aria-expanded={expanded === s.id}
            aria-controls={`chapters-${s.id}`}
          >
            <div>
              <strong>{s.nombre_serie}</strong>
              <br />
              <small className="text-gray-500">
                Ref: {s.numero_referencia} • ID: {s.id}
              </small>
            </div>

            <Form
              method="post"
              data-serie-name={s.nombre_serie}
              onSubmit={onDeleteConfirm}
            >
              <input type="hidden" name="_action" value="delete_serie" />
              <input type="hidden" name="serie_id" value={s.id} />
              <button
                type="submit"
                disabled={deletingId === s.id}
                className="btn-danger"
              >
                {deletingId === s.id ? "Eliminando…" : "Eliminar"}
              </button>
            </Form>
          </header>

          {expanded === s.id && (
            <div id={`chapters-${s.id}`} className="border-t border-gray-200 p-4">
              <SerieChapters serieId={s.id} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SerieChapters({ serieId }: { serieId: number }) {
  const fetcher = useFetcher<{ capitulos?: Capitulo[]; error?: string }>();

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data) {
      fetcher.load(`/api/chapters/${serieId}`);
    }
  }, [fetcher, serieId]);

  if (fetcher.state === "loading") return <p>Cargando capítulos…</p>;
  if (fetcher.data?.error) return <ErrorBox message={fetcher.data.error} />;

  const capitulos = fetcher.data?.capitulos ?? [];
  if (!capitulos.length) return <p className="italic">No hay capítulos.</p>;

  return (
    <ul className="list-decimal space-y-1 pl-4">
      {capitulos.map((c) => (
        <li key={c.id}>
          <Link
            to={`/takes/${c.id}`}
            className="text-primary hover:underline"
            title={`Abrir takes para Cap. ${c.numero_capitulo}`}
          >
            Cap. {c.numero_capitulo}
            {c.titulo_capitulo ? `: ${c.titulo_capitulo}` : ""}
          </Link>{" "}
          <small className="text-gray-500">(ID: {c.id})</small>
        </li>
      ))}
    </ul>
  );
}

/**
 * -----------------------------------------------------------------------------------------------------------------
 * Tailwind component classes (extract to your global CSS / UI library)                                             
 * -----------------------------------------------------------------------------------------------------------------
 * .btn-info     { @apply px-4 py-2 rounded bg-cyan-600 text-white disabled:opacity-70; }
 * .btn-success  { @apply px-4 py-2 rounded bg-green-600 text-white disabled:opacity-70; }
 * .btn-danger   { @apply px-3 py-1 rounded bg-red-600 text-white disabled:opacity-70; }
 * .input        { @apply w-full px-3 py-2 rounded border border-gray-300; }
 */
