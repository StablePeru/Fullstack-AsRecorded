import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { authenticator } from "~/services/auth.server"; // Asegúrate que la ruta es correcta
import { apiFetch } from "~/utils/api.server";

export const meta: MetaFunction = () => {
  return [{ title: "Gestión Import/Export - AsRecorded" }];
};

interface IOConfig {
  import_path?: string;
  import_schedule?: string;
  export_path?: string;
  export_schedule?: string;
  export_series_ids?: "all" | number[];
}

interface SeriesInfo {
  id: number;
  nombre_serie: string;
}

// Definimos un tipo para el usuario que esperamos después de la autenticación y obtención del rol
interface AuthenticatedUserWithRole {
  id: string | number; // o el tipo de tu user.id
  nombre: string;
  rol?: string; // El rol puede ser opcional inicialmente
  // ...otros campos que authenticator.isAuthenticated(request) pueda devolver
}


export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Autenticación básica
  const sessionUser = await authenticator.isAuthenticated(request);

  if (!sessionUser) {
    return redirect("/login");
  }

  // 2. Obtener el usuario completo con rol desde tu API (similar a root.tsx)
  let userWithRole: AuthenticatedUserWithRole;
  try {
    const res = await apiFetch(request, "/users/me"); // Llama a tu endpoint que devuelve el usuario con rol
    if (!res.ok) {
      console.error(`[admin.io-management.loader] /users/me failed with status ${res.status} for user ${sessionUser.id}. Redirecting to login.`);
      // Si no se puede obtener el rol, no se puede autorizar.
      await authenticator.logout(request, { redirectTo: "/login?error=role_fetch_failed" }); // Forzar logout y redirigir
      return null; // No se alcanzará debido al logout, pero es bueno tenerlo.
    }
    const { user: meData } = await res.json();
    if (!meData || !meData.rol) {
        console.error(`[admin.io-management.loader] /users/me did not return expected user data or rol for ${sessionUser.id}.`);
        await authenticator.logout(request, { redirectTo: "/login?error=invalid_user_data" });
        return null;
    }
    userWithRole = { ...sessionUser, ...meData }; // Combina el usuario de sesión con los detalles de /users/me
  } catch (error) {
    console.error("[admin.io-management.loader] Error fetching user details from /users/me:", error);
    await authenticator.logout(request, { redirectTo: "/login?error=api_error" });
    return null;
  }

  // 3. Comprobación de rol
  if (userWithRole.rol !== 'admin') {
    // Si no es admin, redirigir a una página apropiada (ej. inicio o "no autorizado")
    // No a /login porque ya está autenticado.
    return redirect("/series?error=not_authorized_admin"); // O una página de "Acceso Denegado"
  }

  // 4. Si es admin, proceder a cargar los datos de la página
  try {
    const configRes = await apiFetch(request, "/admin/io/config");
    if (!configRes.ok) {
      console.error("Failed to fetch I/O config", configRes.status, await configRes.text());
      // Podrías decidir si esto es un error fatal para la página o si puedes continuar con config vacía
      throw new Error("No se pudo cargar la configuración de Import/Export.");
    }
    const config: IOConfig = await configRes.json();

    const seriesRes = await apiFetch(request, "/series");
    let seriesList: SeriesInfo[] = [];
    if (seriesRes.ok) {
      seriesList = await seriesRes.json();
    } else {
      console.warn("Failed to fetch series list for I/O management. Page might be limited.");
      // Permitir que la página cargue sin la lista de series si esto no es crítico
    }

    return json({ config, seriesList, user: userWithRole }); // Pasar el usuario con rol a la página
  } catch (error: any) {
    console.error("Error in admin.io-management loader (data fetching part):", error);
    // Devolver el usuario para que el layout no se rompa, pero con un error para la página
    return json({ error: error.message || "Error cargando datos de la página.", config: {}, seriesList: [], user: userWithRole }, { status: 500 });
  }
}

// ... el resto de tu archivo admin.io-management.tsx (action, default function) permanece igual ...
export async function action({ request }: ActionFunctionArgs) {
  // Es buena idea volver a verificar el rol aquí también, o asegurarse de que la sesión no haya cambiado.
  // Para simplificar, asumimos que si el loader pasó, el action también debería, pero en casos de alta seguridad:
  const sessionUser = await authenticator.isAuthenticated(request);
   if (!sessionUser) return json({ error: "No autenticado" }, { status: 401 });

   // Re-fetch del rol para el action es más seguro si la sesión pudo haber cambiado
   // o si no quieres depender de que el loader siempre se ejecute antes (aunque lo hace).
   let userForAction: AuthenticatedUserWithRole;
    try {
        const res = await apiFetch(request, "/users/me");
        if (!res.ok) throw new Error("Failed to verify user for action");
        const { user: meData } = await res.json();
        if (!meData || !meData.rol) throw new Error("Invalid user data for action");
        userForAction = { ...sessionUser, ...meData };
    } catch (e) {
        console.error("Action role check failed:", e);
        return json({ error: "Error de verificación de usuario" }, { status: 500 });
    }

  if (userForAction.rol !== 'admin') {
    return json({ error: "No autorizado para esta acción" }, { status: 403 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save_io_config") {
    const configData: IOConfig = {
      import_path: formData.get("import_path") as string || undefined,
      import_schedule: formData.get("import_schedule") as string || undefined,
      export_path: formData.get("export_path") as string || undefined,
      export_schedule: formData.get("export_schedule") as string || undefined,
      export_series_ids: formData.get("export_series_ids_all") === "on" ? "all" :
        (formData.getAll("export_series_ids_selected") as string[]).map(id => parseInt(id, 10)).filter(id => !isNaN(id))
    };

    if (configData.export_series_ids !== "all" && Array.isArray(configData.export_series_ids) && configData.export_series_ids.length === 0){
        // No hacer nada o devolver error si "all" no está y no hay seleccionadas
    }

    try {
      const res = await apiFetch(request, "/admin/io/config", {
        method: "POST",
        body: JSON.stringify(configData),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error guardando configuración. Respuesta no JSON."}));
        return json({ error: errData.error || `Error ${res.status} guardando configuración.` , formValues: configData }, { status: res.status });
      }
      const result = await res.json();
      return json({ success: result.message || "Configuración guardada.", formValues: configData });
    } catch (error: any) {
      return json({ error: error.message || "Error de red guardando configuración.", formValues: configData }, { status: 500 });
    }
  }

  if (intent === "export_now") {
    const exportPathOverride = formData.get("export_path_override") as string || undefined;
    const seriesToExportStr = formData.get("export_series_ids_all_now") === "on" ? "all" :
        (formData.getAll("export_series_ids_selected_now") as string[]); // Mantener como string[] para map

    let seriesToExportPayload : "all" | number[];
    if (seriesToExportStr === "all") {
        seriesToExportPayload = "all";
    } else if (Array.isArray(seriesToExportStr)) {
        seriesToExportPayload = seriesToExportStr.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        if (seriesToExportPayload.length === 0) {
             return json({ error: "Debe seleccionar 'Todas las series' o series específicas para exportar ahora." });
        }
    } else {
         return json({ error: "Selección de series inválida." });
    }


    try {
      const res = await apiFetch(request, "/admin/export/now", {
        method: "POST",
        body: JSON.stringify({
            export_path_override: exportPathOverride,
            series_ids_to_export: seriesToExportPayload
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error en exportación. Respuesta no JSON."}));
        return json({ error: errData.error || `Error ${res.status} en exportación.` });
      }
      const result = await res.json();
      return json({ successExport: result.message || "Exportación iniciada." });
    } catch (error: any) {
      return json({ error: error.message || "Error de red en exportación." });
    }
  }

  return json({ error: "Intento no reconocido" }, { status: 400 });
}


export default function AdminIOManagementPage() {
  const { config, seriesList, error: loaderError, user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmittingConfig = navigation.state === "submitting" && navigation.formData?.get("intent") === "save_io_config";
  const isSubmittingExportNow = navigation.state === "submitting" && navigation.formData?.get("intent") === "export_now";

  const [formState, setFormState] = useState<IOConfig>(() => {
    if(actionData?.formValues && actionData.intent === "save_io_config") return actionData.formValues; // Solo para config
    return config || {};
  });

  const [exportNowPath, setExportNowPath] = useState<string>(config?.export_path || "/srv/exports/manual");
  const [exportNowSeriesAll, setExportNowSeriesAll] = useState(true);
  const [exportNowSelectedSeries, setExportNowSelectedSeries] = useState<number[]>([]);


  useEffect(() => {
    if (actionData?.formValues && actionData.intent === "save_io_config") {
      setFormState(actionData.formValues);
    } else if (config && (!actionData || actionData.intent !== "save_io_config" || !actionData.error)) {
      setFormState(config);
    }
  }, [config, actionData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        if (name === "export_series_ids_all") {
             setFormState(prev => ({ ...prev, export_series_ids: checked ? "all" : (Array.isArray(prev.export_series_ids) && prev.export_series_ids.length > 0 ? prev.export_series_ids : []) }));
        }
    } else {
        setFormState(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSeriesSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value, 10));
    setFormState(prev => ({
        ...prev,
        export_series_ids: selectedOptions
    }));
  };

  const handleExportNowSeriesSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value, 10));
    setExportNowSelectedSeries(selectedOptions);
  };

  if (loaderError && !user) { // Si hay un error de carga Y el usuario no se pudo cargar (ej. error en /users/me)
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold text-red-600">Error Cargando Página de Admin</h1>
        <p className="text-red-500">{loaderError}</p>
        <p className="mt-4">
            <Link to="/" className="btn btn-primary">Volver a Inicio</Link>
        </p>
      </div>
    );
  }
  
  // Si hay un loaderError pero el usuario SÍ está definido (ej. error al cargar config, pero no en auth)
  // la página puede renderizar el layout básico y mostrar el error dentro.
  // La lógica original del return para loaderError solo se activa si es un error fatal que impide renderizar el user.

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Gestión de Importación y Exportación
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Configura las rutas y la programación para la importación y exportación automática de datos.
        </p>
      </header>

      {/* Mostrar loaderError si existe y no fue un error fatal que impidió cargar 'user' */}
      {loaderError && user && (
         <div className="alert alert-error" role="alert">
          <strong className="font-bold">Error al cargar datos de la página: </strong>
          <span>{loaderError}</span>
        </div>
      )}

      {actionData?.error && (
        <div className="alert alert-error" role="alert">
          <strong className="font-bold">Error: </strong>
          <span>{actionData.error}</span>
        </div>
      )}
      {actionData?.success && (
        <div className="alert alert-success" role="alert">
          {actionData.success}
        </div>
      )}
       {actionData?.successExport && (
        <div className="alert alert-success" role="alert">
          {actionData.successExport}
        </div>
      )}

      <Form method="post" className="space-y-6 card p-6">
        <input type="hidden" name="intent" value="save_io_config" />
        
        <fieldset className="border-t border-b border-gray-200 dark:border-gray-700 py-6">
          <legend className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Configuración de Importación</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="import_path" className="form-label">
                Ruta de Carpeta para Importar (Servidor):
              </label>
              <input
                type="text"
                id="import_path"
                name="import_path"
                className="input-text"
                value={formState.import_path || ""}
                onChange={handleInputChange}
                placeholder="/srv/asrecorded/imports"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ruta absoluta en el servidor donde se buscarán archivos .xlsx.</p>
            </div>
            <div>
              <label htmlFor="import_schedule" className="form-label">
                Programación de Importación:
              </label>
              <select
                id="import_schedule"
                name="import_schedule"
                className="input-select"
                value={formState.import_schedule || "manual"}
                onChange={handleInputChange}
              >
                <option value="manual">Manual (sin programar)</option>
                <option value="daily@01:00">Diario a la 01:00</option>
                <option value="daily@05:00">Diario a las 05:00</option>
                <option value="hourly">Cada Hora</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="border-b border-gray-200 dark:border-gray-700 pb-6">
          <legend className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Configuración de Exportación</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="export_path" className="form-label">
                Ruta de Carpeta para Exportar (Servidor):
              </label>
              <input
                type="text"
                id="export_path"
                name="export_path"
                className="input-text"
                value={formState.export_path || ""}
                onChange={handleInputChange}
                placeholder="/srv/asrecorded/exports"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Ruta absoluta en el servidor donde se guardarán los archivos .xlsx exportados.</p>
            </div>
            <div>
              <label htmlFor="export_schedule" className="form-label">
                Programación de Exportación:
              </label>
              <select
                id="export_schedule"
                name="export_schedule"
                className="input-select"
                value={formState.export_schedule || "manual"}
                onChange={handleInputChange}
              >
                <option value="manual">Manual (sin programar)</option>
                <option value="daily@03:00">Diario a las 03:00</option>
                <option value="weekly@sunday@04:00">Semanal (Domingo a las 04:00)</option>
              </select>
            </div>
          </div>
          <div className="mt-6">
            <label className="form-label">Series a Exportar (para tareas programadas):</label>
            <div className="flex items-center space-x-4">
                <div className="flex items-center">
                    <input
                        id="export_series_ids_all"
                        name="export_series_ids_all"
                        type="checkbox"
                        className="input-checkbox"
                        checked={formState.export_series_ids === "all"}
                        onChange={handleInputChange}
                    />
                    <label htmlFor="export_series_ids_all" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Todas las series
                    </label>
                </div>
            </div>
            {formState.export_series_ids !== "all" && (
                <div className="mt-2">
                     <label htmlFor="export_series_ids_selected" className="form-label sr-only">Seleccionar series específicas:</label>
                    <select
                        id="export_series_ids_selected"
                        name="export_series_ids_selected"
                        multiple
                        className="input-select h-40"
                        value={(Array.isArray(formState.export_series_ids) ? formState.export_series_ids : []).map(String)}
                        onChange={handleSeriesSelectionChange}
                        disabled={formState.export_series_ids === "all"}
                    >
                        {seriesList && seriesList.map(serie => (
                            <option key={serie.id} value={serie.id}>
                                {serie.nombre_serie} (ID: {serie.id})
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Mantén Ctrl (o Cmd en Mac) para seleccionar múltiples series.</p>
                </div>
            )}
          </div>
        </fieldset>
        
        <div className="pt-5">
          <button type="submit" className="btn btn-primary" disabled={isSubmittingConfig}>
            {isSubmittingConfig ? "Guardando..." : "Guardar Configuraciones"}
          </button>
        </div>
      </Form>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Exportar Manualmente Ahora</h2>
        <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="export_now" />
            <div>
              <label htmlFor="export_path_override" className="form-label">
                Ruta de Destino (opcional, si es diferente a la configurada):
              </label>
              <input
                type="text"
                id="export_path_override"
                name="export_path_override"
                className="input-text"
                value={exportNowPath}
                onChange={(e) => setExportNowPath(e.target.value)}
                placeholder={config?.export_path || "/srv/asrecorded/exports/manual_export"}
              />
            </div>
            <div>
                <label className="form-label">Series a Exportar Ahora:</label>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <input
                            id="export_series_ids_all_now"
                            name="export_series_ids_all_now"
                            type="checkbox"
                            className="input-checkbox"
                            checked={exportNowSeriesAll}
                            onChange={(e) => setExportNowSeriesAll(e.target.checked)}
                        />
                        <label htmlFor="export_series_ids_all_now" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                            Todas las series
                        </label>
                    </div>
                </div>
                {!exportNowSeriesAll && (
                    <div className="mt-2">
                        <label htmlFor="export_series_ids_selected_now" className="form-label sr-only">Seleccionar series específicas:</label>
                        <select
                            id="export_series_ids_selected_now"
                            name="export_series_ids_selected_now"
                            multiple
                            className="input-select h-32"
                            value={exportNowSelectedSeries.map(String)}
                            onChange={handleExportNowSeriesSelectionChange}
                            disabled={exportNowSeriesAll}
                        >
                            {seriesList && seriesList.map(serie => (
                                <option key={serie.id} value={serie.id}>
                                    {serie.nombre_serie} (ID: {serie.id})
                                </option>
                            ))}
                        </select>
                         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Mantén Ctrl (o Cmd en Mac) para seleccionar múltiples series.</p>
                    </div>
                )}
            </div>
            <button type="submit" className="btn btn-success" disabled={isSubmittingExportNow}>
                {isSubmittingExportNow ? "Exportando..." : "Exportar Ahora"}
            </button>
        </Form>
      </div>
    </div>
  );
}