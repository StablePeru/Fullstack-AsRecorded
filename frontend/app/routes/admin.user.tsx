/**
 * app/routes/admin.user.tsx
 * Page for user administration. Allows searching, sorting, and role management for users.
 * Accessible only to users with the "admin" role.
 */
import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "@remix-run/react";
import { apiFetch } from "~/utils/api.server";
import { authenticator } from "~/services/auth.server";

// --- Types ---
interface User {
  id: number;
  nombre: string;
  rol: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface LoaderData {
  users: User[];
  searchTerm: string | null;
  sortBy: string; // sortBy will always have a default
  sortOrder: string; // sortOrder will always have a default
}

export const meta: MetaFunction = () => {
  return [{ title: "Administración de Usuarios - AsRecorded" }];
};

// --- Constants ---
const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: "badge-admin",
  director: "badge-director",
  tecnico: "badge-tecnico",
  default: "badge-neutral",
};

const SORTABLE_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "nombre", label: "Nombre" },
  { key: "rol", label: "Rol Actual" },
] as const; // Use "as const" for stricter typing of keys

type SortableColumnKey = typeof SORTABLE_COLUMNS[number]['key'];

const DEFAULT_SORT_BY: SortableColumnKey = "nombre";
const DEFAULT_SORT_ORDER = "ASC";

/* -------------------------------------------------------------------------- */
/*                                   LOADER                                   */
/* -------------------------------------------------------------------------- */
export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Authenticate and Authorize
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  const meRes = await apiFetch(request, "/users/me");
  if (!meRes.ok) {
    console.warn("[admin.user.loader] Failed to fetch current user details. Redirecting.");
    return redirect("/series"); // Or to login if session might be invalid
  }
  const { user: currentUser } = await meRes.json();
  if (currentUser.rol !== "admin") {
    console.warn(`[admin.user.loader] Non-admin user (ID: ${currentUser.id}, Role: ${currentUser.rol}) attempted access. Redirecting.`);
    return redirect("/series"); // Or a dedicated "Access Denied" page
  }

  // 2. Get Search and Sort Parameters from URL
  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search");
  const sortBy = (url.searchParams.get("sortBy") as SortableColumnKey) || DEFAULT_SORT_BY;
  const sortOrder = url.searchParams.get("sortOrder") || DEFAULT_SORT_ORDER;

  // 3. Fetch Users from API
  const apiQueryParams = new URLSearchParams();
  if (searchTerm) apiQueryParams.set("search", searchTerm);
  apiQueryParams.set("sortBy", sortBy);
  apiQueryParams.set("sortOrder", sortOrder);

  const usersRes = await apiFetch(request, `/users?${apiQueryParams.toString()}`);
  if (!usersRes.ok) {
    const errorText = await usersRes.text();
    console.error(`[admin.user.loader] Error fetching users (Status: ${usersRes.status}): ${errorText}`);
    throw new Response(`Error al cargar la lista de usuarios: ${usersRes.statusText || usersRes.status}`, { status: usersRes.status });
  }

  const users = (await usersRes.json()) as User[];
  return json<LoaderData>({ users, searchTerm, sortBy, sortOrder });
}

/* -------------------------------------------------------------------------- */
/*                                   ACTION                                   */
/* -------------------------------------------------------------------------- */
export async function action({ request }: ActionFunctionArgs) {
  // 1. Authenticate and Authorize Action
  await authenticator.isAuthenticated(request, { failureRedirect: "/login" });
  const meRes = await apiFetch(request, "/users/me");
  if (!meRes.ok) {
    return json({ ok: false, message: "Error de sesión. No se pudo verificar su identidad." }, { status: 500 });
  }
  const { user: currentUser } = await meRes.json();
  if (currentUser.rol !== "admin") {
    return json({ ok: false, message: "Acción no autorizada." }, { status: 403 });
  }

  // 2. Process Form Data for Role Change
  const form = await request.formData();
  const userIdString = form.get("userId") as string | null;
  const newRole = form.get("rol") as string | null;

  if (!userIdString || !newRole || isNaN(Number(userIdString))) {
    return json({ ok: false, message: "Datos del formulario incorrectos o incompletos." }, { status: 400 });
  }
  const userId = Number(userIdString);

  // 3. Call API to Update Role
  const updateRes = await apiFetch(request, `/users/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rol: newRole }),
  });

  if (!updateRes.ok) {
    let errorMessage = "Ocurrió un error al intentar actualizar el rol del usuario.";
    try {
      const errorData = await updateRes.json();
      errorMessage = errorData.message || errorMessage;
    } catch (e) {
      // If parsing errorData fails, use statusText or a generic server error message
      errorMessage = `Error del servidor (${updateRes.status}): ${updateRes.statusText || 'Por favor, intente de nuevo.'}`;
    }
    return json({ ok: false, message: errorMessage }, { status: updateRes.status });
  }

  return json({ ok: true, message: "El rol del usuario ha sido actualizado exitosamente." });
}

/* -------------------------------------------------------------------------- */
/*                                 COMPONENT                                  */
/* -------------------------------------------------------------------------- */
export default function AdminUserPage() {
  const { users, searchTerm, sortBy, sortOrder } = useLoaderData<LoaderData>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Check if any POST form is submitting (for disabling role change forms)
  const isAnyPostSubmitting = navigation.state === "submitting" && navigation.formMethod?.toLowerCase() === "post";

  // Check if a specific user's role change form is submitting
  const isRoleChangeSubmittingForUser = (userId: number): boolean => {
    return (
      isAnyPostSubmitting &&
      navigation.formData?.get("userId") === String(userId)
    );
  };

  const handleSort = (columnKey: SortableColumnKey) => {
    const newSortOrder = (sortBy === columnKey && sortOrder === "ASC") ? "DESC" : "ASC";
    setSearchParams(prev => {
      prev.set("sortBy", columnKey);
      prev.set("sortOrder", newSortOrder);
      if (searchTerm) prev.set("search", searchTerm); // Preserve search term
      else prev.delete("search"); // Clean up search if it was empty
      return prev;
    }, { replace: true }); // Use replace to avoid multiple back button entries for sorting
  };

  // Helper component for sort direction indicator
  const SortIndicator = ({ columnKey }: { columnKey: SortableColumnKey }) => {
    if (sortBy !== columnKey) {
      // Show a subtle indicator for sortable columns not currently sorted
      return <span className="ml-1 text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400">↕</span>;
    }
    return <span className="ml-1">{sortOrder === "ASC" ? "↑" : "↓"}</span>;
  };
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Gestión de Usuarios
        </h1>
      </header>

      {/* Search Form */}
      <Form method="get" className="mb-6" onSubmit={(e) => {
        // Optional: Clear sortBy and sortOrder on new search, or handle as desired
        // const formData = new FormData(e.currentTarget);
        // if (formData.get("search") !== searchTerm) {
        //   searchParams.delete("sortBy");
        //   searchParams.delete("sortOrder");
        // }
      }}>
        <div className="flex items-center gap-2">
          <input
            type="search"
            name="search"
            defaultValue={searchTerm || ""}
            placeholder="Buscar por nombre de usuario..."
            className="input-text flex-grow"
            aria-label="Buscar usuarios por nombre"
          />
          {/* Hidden inputs to preserve sort order during search submission */}
          {sortBy && <input type="hidden" name="sortBy" value={sortBy} />}
          {sortOrder && <input type="hidden" name="sortOrder" value={sortOrder} />}
          <button type="submit" className="btn btn-primary">
            Buscar
          </button>
        </div>
      </Form>

      {/* Action Feedback Message */}
      {actionData && (
        <div
          className={`mb-6 ${actionData.ok ? "alert alert-success" : "alert alert-error"}`}
          role="alert"
        >
          {actionData.message}
        </div>
      )}

      {/* Users Table */}
      <div className="shadow overflow-hidden border-b border-gray-200 dark:border-gray-700 sm:rounded-lg bg-white dark:bg-gray-800/70">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/60">
            <tr>
              {SORTABLE_COLUMNS.map(col => (
                <th key={col.key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider group">
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="flex items-center font-medium text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 focus:outline-none focus:underline"
                    aria-label={`Ordenar por ${col.label}`}
                  >
                    {col.label}
                    <SortIndicator columnKey={col.key} />
                  </button>
                </th>
              ))}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[220px]">
                Cambiar Rol
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.map((user) => {
              const isCurrentRoleChangeSubmitting = isRoleChangeSubmittingForUser(user.id);
              return (
                <tr key={user.id} className={`table-row-hover ${isCurrentRoleChangeSubmitting ? "opacity-60" : ""}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{user.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">{user.nombre}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <span className={ROLE_BADGE_CLASSES[user.rol] || ROLE_BADGE_CLASSES.default}>{user.rol}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    <Form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="rol"
                        defaultValue={user.rol}
                        className="input-select w-full"
                        disabled={isCurrentRoleChangeSubmitting || (isAnyPostSubmitting && !isCurrentRoleChangeSubmitting)}
                        aria-label={`Cambiar rol de ${user.nombre}`}
                      >
                        <option value="tecnico">Técnico</option>
                        <option value="director">Director</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isCurrentRoleChangeSubmitting || (isAnyPostSubmitting && !isCurrentRoleChangeSubmitting)}
                        aria-busy={isCurrentRoleChangeSubmitting}
                      >
                        {isCurrentRoleChangeSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-0.5 mr-1.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Guardando…
                          </>
                        ) : "Guardar"}
                      </button>
                    </Form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="mt-6 text-center text-gray-500 dark:text-gray-400">
          {searchTerm
            ? `No se encontraron usuarios que coincidan con "${searchTerm}".`
            : "No hay usuarios registrados para mostrar."}
        </p>
      )}
    </div>
  );
}