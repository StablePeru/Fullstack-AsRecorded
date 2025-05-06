// frontend/app/routes/register.tsx

import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData } from "@remix-run/react";

// Importa authenticator para comprobar si ya está logueado en el loader
import { authenticator } from "~/services/auth.server";

export const meta: MetaFunction = () => {
  return [{ title: "Registrar Nuevo Usuario" }];
};

// Loader: Si el usuario ya está logueado, no tiene sentido que vea el registro.
// Lo redirigimos a la página principal o a donde corresponda.
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticator.isAuthenticated(request, {
    // Cambia '/series' a la ruta donde quieres enviar a los usuarios ya logueados
    successRedirect: "/series",
  });
  // Si no está autenticado, simplemente devolvemos null (o un objeto vacío)
  // para que la página se renderice.
  return json({});
}


// Action: Maneja el envío del formulario de registro
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const nombre = formData.get("nombre") as string | null;
  const password = formData.get("password") as string | null;
  const confirmPassword = formData.get("confirmPassword") as string | null;

  // --- Validación ---
  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    return json({ error: "El nombre de usuario es obligatorio." }, { status: 400 });
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    return json({ error: "La contraseña es obligatoria y debe tener al menos 6 caracteres." }, { status: 400 });
  }
  if (password !== confirmPassword) {
    return json({ error: "Las contraseñas no coinciden." }, { status: 400 });
  }
  // --- Fin Validación ---

  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    // Este error es del servidor, no del usuario
    console.error("API_BASE_URL no está configurado para la acción de registro.");
    return json({ error: "Error de configuración del servidor." }, { status: 500 });
  }

  try {
    console.log(`Register Action: Intentando registrar usuario ${nombre} en ${apiBaseUrl}/register`);
    const response = await fetch(`${apiBaseUrl}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nombre: nombre.trim(), password }), // Envía nombre sin espacios extra
    });

    console.log(`Register Action: Respuesta API status: ${response.status}`);

    if (response.ok) { // Generalmente 201 Created para un registro exitoso
      console.log(`Register Action: Usuario ${nombre} registrado exitosamente.`);
      // Redirige a la página de login después de un registro exitoso
      return redirect("/login");
      // Opcional: Podrías añadir un mensaje flash de éxito aquí antes de redirigir
    } else {
      // Intenta obtener el mensaje de error específico de la API
      let errorMessage = `Error al registrar (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage; // Usa el error de la API si existe
      } catch (e) {
        console.warn("Register Action: No se pudo parsear JSON de la respuesta de error de la API.");
      }
      console.log(`Register Action: Fallo registro API: ${errorMessage}`);
      // Devuelve el error de la API al formulario
      return json({ error: errorMessage }, { status: response.status });
    }

  } catch (error) {
    console.error("Register Action: Error durante fetch a /register:", error);
    // Error genérico si falla el fetch o algo inesperado ocurre
    return json({ error: "No se pudo conectar con el servicio de registro. Inténtalo más tarde." }, { status: 500 });
  }
}

// Componente: Muestra el formulario de registro y errores
export default function RegisterPage() {
  // Obtiene el error devuelto por la función action (si existe)
  const actionData = useActionData<typeof action>();

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '2rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Registrar Nuevo Usuario</h2>
      <Form method="post" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label htmlFor="nombre" style={{ display: 'block', marginBottom: '0.5rem' }}>Nombre de Usuario:</label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            required
            aria-describedby={actionData?.error ? "error-message" : undefined} // Para accesibilidad
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
           />
        </div>
        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem' }}>Contraseña (mín. 6 caracteres):</label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={6}
            aria-describedby={actionData?.error ? "error-message" : undefined}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '0.5rem' }}>Confirmar Contraseña:</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={6}
            aria-describedby={actionData?.error ? "error-message" : undefined}
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
          />
        </div>

        {/* Muestra el mensaje de error si existe */}
        {actionData?.error && (
          <p id="error-message" style={{ color: "red", marginTop: '1rem', border: '1px solid red', padding: '0.5rem' }}>
            {actionData.error}
          </p>
        )}

        <button
          type="submit"
          style={{ padding: '0.75rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}
        >
          Registrar
        </button>
      </Form>
      <p style={{ marginTop: '1.5rem', textAlign: 'center' }}>
        ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#007bff' }}>Inicia Sesión</Link>
      </p>
    </div>
  );
}