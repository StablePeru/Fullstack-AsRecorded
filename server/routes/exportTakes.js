// server/routes/exportTakes.js
const XLSX = require('xlsx'); // Added for XLSX generation

// Assume fetchDataForCapitulo is an existing function that fetches data.
// For example:
// const { fetchDataForCapitulo } = require('../services/dataService'); 

// Placeholder for fetchDataForCapitulo for now
const fetchDataForCapitulo = async (capituloId) => {
  // This is a mock implementation.
  // In a real scenario, this would fetch data from a database or another service.
  console.log(`Fetching data for capituloId: ${capituloId}`);
  if (capituloId === "1") {
    return {
      capitulo: { id: "1", numero_capitulo: 1, titulo_capitulo: "El Inicio", serie_id: "S1" },
      takes: [
        {
          id: "t1",
          numero_take: 1, // SCENE
          tc_in: "00:00:00:00",
          tc_out: "00:00:20:00",
          intervenciones: [
            {
              id: 101, // ID
              take_id: "t1",
              dialogo: "Hola.", // DIÁLOGO
              completo: true,
              tc_in: "00:00:10:00", // IN
              tc_out: "00:00:12:05", // OUT
              orden_en_take: 1,
              personaje: "Personaje A" // PERSONAJE
            },
            {
              id: 102,
              take_id: "t1",
              dialogo: "¿Cómo estás?",
              completo: true,
              tc_in: "00:00:13:00",
              tc_out: "00:00:15:10",
              orden_en_take: 2,
              personaje: "Personaje B"
            }
          ]
        },
        {
          id: "t2",
          numero_take: 2,
          tc_in: "00:01:00:00",
          tc_out: "00:01:10:00",
          intervenciones: [
            {
              id: 201,
              take_id: "t2",
              dialogo: "Adiós.",
              completo: false,
              tc_in: "00:01:05:00",
              tc_out: "00:01:07:00",
              orden_en_take: 1,
              personaje: "Personaje A"
            }
          ]
        }
      ]
    };
  } else if (capituloId === "nonexistent") {
    return null; // Simulate data not found
  } else {
    // Simulate other chapter data or throw an error for invalid IDs if needed
    return {
      capitulo: { id: capituloId, numero_capitulo: 2, titulo_capitulo: "Otro Capítulo", serie_id: "S1" },
      takes: [] // No takes for this example
    };
  }
};


const exportTakesHandler = async (req, res) => {
  try {
    const { capituloId } = req.params;

    if (!capituloId) {
      return res.status(400).json({ error: "capituloId is required" });
    }

    // --- Data Fetching ---
    let fetchedData;
    try {
      fetchedData = await fetchDataForCapitulo(capituloId);
    } catch (fetchError) {
      console.error("Error fetching data:", fetchError);
      return res.status(500).json({ error: "Failed to fetch data for capitulo." });
    }

    if (!fetchedData || !fetchedData.capitulo) {
      return res.status(404).json({ error: `Data not found for capituloId: ${capituloId}` });
    }

    const { takes } = fetchedData;

    // --- Data Transformation ---
    const transformedData = [];
    if (takes && takes.length > 0) {
      takes.forEach(take => {
        if (take.intervenciones && take.intervenciones.length > 0) {
          take.intervenciones.forEach(intervencion => {
            transformedData.push({
              ID: intervencion.id,
              IN: intervencion.tc_in,
              OUT: intervencion.tc_out,
              PERSONAJE: intervencion.personaje,
              DIÁLOGO: intervencion.dialogo,
              SCENE: take.numero_take
            });
          });
        }
      });
    }
    
    
    if (transformedData.length === 0) {
      // Send a message or an empty file if there's no data to export
      // For this example, let's send a 200 with a message, 
      // or you could send an empty XLSX or a 204 No Content.
      return res.status(200).json({ 
        message: "No data available to export for this capitulo.",
        capituloId: capituloId,
        capituloInfo: fetchedData.capitulo,
        transformedDataCount: 0,
        transformedData: []
      });
    }

    // --- XLSX Generation ---
    const headers = ['ID', 'IN', 'OUT', 'PERSONAJE', 'DIÁLOGO', 'SCENE'];
    
    // Create worksheet: skipHeader true because we add headers manually for exact control
    const worksheet = XLSX.utils.json_to_sheet(transformedData, { skipHeader: true });
    
    // Add headers manually to the beginning of the sheet (A1)
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TakesData'); // Sheet name

    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="takes_capitulo_${capituloId}.xlsx"`);
    
    // Send the buffer as response
    res.status(200).send(buffer);

  } catch (error) {
    console.error("Error in exportTakesHandler:", error);
    // Generic error for unexpected issues during transformation
    res.status(500).json({ error: "An unexpected error occurred during data processing." });
  }
};

// Example of how this might be mounted in an Express-like app:
// const express = require('express');
// const router = express.Router();
// router.get('/export/takes/:capituloId', exportTakesHandler);
// module.exports = router;

// For the purpose of this task, we are defining the handler and logic.
// We can export the handler if it were to be used in an actual Express app.
module.exports = { exportTakesHandler, fetchDataForCapitulo }; // Exporting fetchDataForCapitulo for potential testing
