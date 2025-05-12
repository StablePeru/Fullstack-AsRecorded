# -*- coding: utf-8 -*-
"""
series_viewer_gui.py

GUI simple usando PySide6 para mostrar y AÑADIR Series
usando DataHandler y la base de datos PostgreSQL.
"""

import sys
import logging
from PySide6 import QtWidgets, QtCore, QtGui # Añadido QtGui si es necesario

try:
    # Cambiado a importación absoluta/directa según la corrección anterior
    import data_handler
    DataHandler = data_handler.DataHandler # Accede a la clase
except ImportError:
    logging.error("Error: No se pudo importar data_handler. Asegúrate de que data_handler.py está accesible.")
    app = QtWidgets.QApplication([])
    error_dialog = QtWidgets.QMessageBox()
    error_dialog.setIcon(QtWidgets.QMessageBox.Icon.Critical)
    error_dialog.setWindowTitle("Error de Importación")
    error_dialog.setText("No se pudo encontrar o importar 'data_handler'.\nAsegúrate de que el archivo está en el directorio correcto.")
    error_dialog.exec()
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class SeriesViewerWindow(QtWidgets.QMainWindow):
    """Ventana principal para visualizar y añadir series."""

    def __init__(self):
        super().__init__()

        self.setWindowTitle("Gestión de Series - DB Test")
        self.setGeometry(100, 100, 700, 500) # Ajusta tamaño si es necesario

        try:
            self.handler = DataHandler()
            logging.info("DataHandler instanciado correctamente.")
        except Exception as e:
             logging.error(f"Error al instanciar DataHandler: {e}")
             self.show_error_message(f"Error al inicializar DataHandler:\n{e}")
             self.handler = None

        self.setup_ui() # Llama a un método para configurar la UI
        self.load_series_data() # Carga los datos al iniciar

    def setup_ui(self):
        """Configura los widgets y layouts de la interfaz gráfica."""
        central_widget = QtWidgets.QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QtWidgets.QVBoxLayout(central_widget) # Layout principal vertical

        # --- Sección para Añadir Nueva Serie ---
        add_groupbox = QtWidgets.QGroupBox("Añadir Nueva Serie")
        add_layout = QtWidgets.QFormLayout(add_groupbox) # Layout de formulario para etiquetas y campos

        self.ref_input = QtWidgets.QLineEdit()
        self.ref_input.setPlaceholderText("Ej: REF001 (Máx 6 chars)")
        self.ref_input.setMaxLength(6) # Limita la longitud según la BD
        self.name_input = QtWidgets.QLineEdit()
        self.name_input.setPlaceholderText("Nombre completo de la serie")

        add_layout.addRow("Nº Referencia:", self.ref_input)
        add_layout.addRow("Nombre Serie:", self.name_input)

        self.save_button = QtWidgets.QPushButton("Guardar Nueva Serie")
        self.save_button.setIcon(QtGui.QIcon.fromTheme("document-save", QtGui.QIcon("path/to/default/save/icon.png"))) # Icono opcional
        self.save_button.clicked.connect(self.save_new_serie)
        add_layout.addRow(self.save_button) # Añade el botón al formulario

        main_layout.addWidget(add_groupbox) # Añade el grupo al layout principal

        # Separador (opcional)
        line = QtWidgets.QFrame()
        line.setFrameShape(QtWidgets.QFrame.Shape.HLine)
        line.setFrameShadow(QtWidgets.QFrame.Shadow.Sunken)
        main_layout.addWidget(line)

        # --- Sección para Mostrar Series ---
        view_groupbox = QtWidgets.QGroupBox("Series Existentes")
        view_layout = QtWidgets.QVBoxLayout(view_groupbox)

        self.reload_button = QtWidgets.QPushButton("Recargar Lista")
        self.reload_button.setIcon(QtGui.QIcon.fromTheme("view-refresh", QtGui.QIcon("path/to/default/refresh/icon.png"))) # Icono opcional
        self.reload_button.clicked.connect(self.load_series_data)
        # Añade un botón de recarga explícito
        view_layout.addWidget(self.reload_button, 0, QtCore.Qt.AlignmentFlag.AlignRight) # Alinea a la derecha


        self.table_widget = QtWidgets.QTableWidget()
        self.table_widget.setColumnCount(3)
        self.table_widget.setHorizontalHeaderLabels(["ID", "Referencia", "Nombre Serie"])
        self.table_widget.horizontalHeader().setSectionResizeMode(QtWidgets.QHeaderView.ResizeMode.Stretch)
        # Permitir resize interactivo de la última columna
        self.table_widget.horizontalHeader().setSectionResizeMode(2, QtWidgets.QHeaderView.ResizeMode.Interactive)
        self.table_widget.setEditTriggers(QtWidgets.QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table_widget.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectionBehavior.SelectRows)
        self.table_widget.setAlternatingRowColors(True) # Mejora visual

        view_layout.addWidget(self.table_widget)
        main_layout.addWidget(view_groupbox)

        # --- Barra de Estado ---
        self.statusBar().showMessage("Listo.")

    def load_series_data(self):
        """Obtiene los datos de las series usando DataHandler y los carga en la tabla."""
        if not self.handler:
            self.show_error_message("DataHandler no está disponible.")
            return

        self.statusBar().showMessage("Cargando datos de series...")
        logging.info("Intentando cargar datos de series...")
        self.table_widget.setRowCount(0) # Limpia la tabla antes de cargar

        try:
            series_data = self.handler.get_all_series()

            if series_data is None:
                 logging.warning("handler.get_all_series() retornó None.")
                 self.show_error_message("No se pudieron obtener datos (resultado None).")
                 self.statusBar().showMessage("Error al cargar datos.")
                 return

            logging.info(f"Datos recibidos: {len(series_data)} series.")
            self.table_widget.setRowCount(len(series_data))

            if not series_data:
                 self.statusBar().showMessage("No se encontraron series en la base de datos.")
                 return

            for row_index, serie in enumerate(series_data):
                id_item = QtWidgets.QTableWidgetItem(str(serie.get('id', '')))
                # Hacer el ID no editable y centrado (ejemplo)
                id_item.setFlags(id_item.flags() ^ QtCore.Qt.ItemFlag.ItemIsEditable)
                id_item.setTextAlignment(QtCore.Qt.AlignmentFlag.AlignCenter)

                ref_item = QtWidgets.QTableWidgetItem(str(serie.get('numero_referencia', '')))
                nombre_item = QtWidgets.QTableWidgetItem(str(serie.get('nombre_serie', '')))

                self.table_widget.setItem(row_index, 0, id_item)
                self.table_widget.setItem(row_index, 1, ref_item)
                self.table_widget.setItem(row_index, 2, nombre_item)

            self.table_widget.resizeColumnsToContents() # Ajusta columnas después de insertar
            self.table_widget.horizontalHeader().setSectionResizeMode(2, QtWidgets.QHeaderView.ResizeMode.Stretch) # Estira la última de nuevo

            self.statusBar().showMessage(f"Se cargaron {len(series_data)} series.")
            logging.info("Tabla actualizada con datos de series.")

        except Exception as e:
            logging.exception("Ocurrió un error al cargar los datos de series:")
            self.show_error_message(f"Error al cargar datos desde la base de datos:\n{e}")
            self.statusBar().showMessage("Error al cargar datos.")

    def save_new_serie(self):
        """Guarda la nueva serie introducida en los campos de texto."""
        if not self.handler:
            self.show_error_message("DataHandler no está disponible.")
            return

        # Obtiene los datos de los campos de entrada
        ref = self.ref_input.text().strip() # .strip() elimina espacios al inicio/final
        name = self.name_input.text().strip()

        # Validación simple
        if not ref or not name:
            self.show_error_message("El Número de Referencia y el Nombre de Serie no pueden estar vacíos.")
            return

        logging.info(f"Intentando guardar nueva serie: Ref={ref}, Nombre={name}")
        self.statusBar().showMessage("Guardando nueva serie...")

        try:
            # Llama al método del DataHandler para añadir la serie
            success = self.handler.add_serie(ref, name)

            if success:
                logging.info("Nueva serie guardada exitosamente.")
                self.statusBar().showMessage("¡Nueva serie guardada con éxito!")
                # Limpia los campos de entrada
                self.ref_input.clear()
                self.name_input.clear()
                # Recarga la tabla para mostrar la nueva serie inmediatamente
                self.load_series_data()
                # Opcional: Mostrar un mensaje de éxito
                QtWidgets.QMessageBox.information(self, "Éxito", "La nueva serie ha sido guardada.")
            else:
                # El error específico (ej. duplicado) ya se logueó en db_handler/data_handler
                logging.warning("No se pudo guardar la nueva serie (posible duplicado o error).")
                self.show_error_message("No se pudo guardar la nueva serie.\nEs posible que el Nº de Referencia o el Nombre ya existan.")
                self.statusBar().showMessage("Error al guardar la serie.")

        except Exception as e:
            # Captura errores inesperados durante el proceso de guardado
            logging.exception("Ocurrió un error al guardar la nueva serie:")
            self.show_error_message(f"Error inesperado al guardar la serie:\n{e}")
            self.statusBar().showMessage("Error inesperado al guardar.")


    def show_error_message(self, message):
        """Muestra un diálogo de mensaje de error."""
        msg_box = QtWidgets.QMessageBox(self)
        msg_box.setIcon(QtWidgets.QMessageBox.Icon.Critical)
        msg_box.setWindowTitle("Error")
        msg_box.setText(message)
        msg_box.exec()

def main():
    app = QtWidgets.QApplication(sys.argv)
    # Para usar iconos estándar del tema del sistema operativo (si existen)
    QtGui.QIcon.setThemeName("breeze") # Ejemplo para KDE/Plasma, puede variar

    window = SeriesViewerWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()