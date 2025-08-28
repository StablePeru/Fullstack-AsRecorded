# -*- coding: utf-8 -*-
"""
data_handler.py
Capa de lógica de negocio. Orquesta las llamadas a db_handler.
"""
import db_handler
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class DataHandler:
    def __init__(self):
        logging.info("DataHandler inicializado para el nuevo esquema.")

    # --- Lógica de Convocatorias ---
    def get_convocatoria_hoy(self, sala_id, fecha):
        """
        Obtiene la convocatoria para una sala y fecha, incluyendo sus items y las intervenciones asociadas.
        """
        query = """
            SELECT c.*, ci.id as item_id, ci.odoo_item_id, t.id as take_id, t.numero as take_numero,
                   cap.id as capitulo_id, cap.numero as capitulo_numero, s.id as serie_id, s.nombre as serie_nombre
            FROM "Convocatoria" c
            JOIN "ConvocatoriaItem" ci ON c.id = ci.convocatoria_id
            JOIN "Take" t ON ci.take_id = t.id
            JOIN "Capitulo" cap ON t.capitulo_id = cap.id
            JOIN "Serie" s ON cap.serie_id = s.id
            WHERE c.sala_id = %s AND c.fecha = %s
            ORDER BY t.numero;
        """
        params = (sala_id, fecha)
        try:
            return db_handler.execute_query(query, params, fetch_mode="all")
        except Exception as e:
            logging.error(f"Error obteniendo convocatoria para sala {sala_id} en fecha {fecha}: {e}")
            return None

    # --- Lógica de Intervenciones ---
    def update_intervention_status(self, intervention_id, estado, estado_nota, user_id):
        """
        Actualiza el estado de una intervención y registra la auditoría.
        """
        query = """
            UPDATE "Intervencion"
            SET estado = %s,
                estado_nota = %s,
                realizado_por_usuario_id = %s,
                realizado_at = CASE WHEN %s IN ('realizado', 'omitido') THEN NOW() ELSE NULL END,
                "version" = "version" + 1
            WHERE id = %s
            RETURNING id, estado;
        """
        params = (estado, estado_nota, user_id, estado, intervention_id)
        try:
            result = db_handler.execute_query(query, params, fetch_mode="one")
            if result:
                db_handler.audit_log(
                    entidad='Intervencion',
                    entidad_id=intervention_id,
                    usuario_id=user_id,
                    accion='UPDATE_ESTADO',
                    payload={'estado': estado, 'nota': estado_nota}
                )
                return True
            return False
        except Exception as e:
            logging.error(f"Error actualizando estado de intervención {intervention_id}: {e}")
            return False

    def update_intervention_fx(self, intervention_id, needs_fx, fx_note, fx_source, user_id):
        """
        Actualiza la marca FX de una intervención y registra la auditoría.
        """
        query = """
            UPDATE "Intervencion"
            SET needs_fx = %s,
                fx_note = %s,
                fx_source = %s,
                fx_marked_by = %s,
                fx_marked_at = CASE WHEN %s THEN NOW() ELSE NULL END,
                "version" = "version" + 1
            WHERE id = %s
            RETURNING id;
        """
        params = (needs_fx, fx_note, fx_source, user_id, needs_fx, intervention_id)
        try:
            result = db_handler.execute_query(query, params, fetch_mode="one")
            if result:
                db_handler.audit_log(
                    entidad='Intervencion',
                    entidad_id=intervention_id,
                    usuario_id=user_id,
                    accion='UPDATE_FX',
                    payload={'needs_fx': needs_fx, 'nota': fx_note, 'source': fx_source}
                )
                return True
            return False
        except Exception as e:
            logging.error(f"Error actualizando FX de intervención {intervention_id}: {e}")
            return False

    # --- Lógica de Repartos ---
    def get_reparto(self, serie_id):
        """Obtiene el reparto (personaje -> actor) para una serie."""
        query = """
            SELECT p.id as personaje_id, p.nombre as personaje_nombre, a.id as actor_id, a.nombre as actor_nombre
            FROM "Personaje" p
            LEFT JOIN "Actor" a ON p.actor_id = a.id
            WHERE p.id IN (
                SELECT DISTINCT i.personaje_id
                FROM "Intervencion" i
                JOIN "Take" t ON i.take_id = t.id
                JOIN "Capitulo" c ON t.capitulo_id = c.id
                WHERE c.serie_id = %s
            )
            ORDER BY p.nombre;
        """
        params = (serie_id,)
        try:
            return db_handler.execute_query(query, params, fetch_mode="all")
        except Exception as e:
            logging.error(f"Error obteniendo reparto para serie {serie_id}: {e}")
            return []

    # Puedes añadir más métodos aquí para los otros flujos de trabajo...