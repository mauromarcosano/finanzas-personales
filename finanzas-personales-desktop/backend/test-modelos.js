require('dotenv').config();

// Asegurate de que GEMINI_API_KEY sea el mismo nombre que usaste en tu archivo .env
const apiKey = process.env.GEMINI_API_KEY;

async function listarModelos() {
    if (!apiKey) {
        return console.error("❌ No se encontró la API Key. Revisá tu archivo .env");
    }

    // Le pegamos directo a la API de Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (datos.error) {
            return console.error("❌ Error de la API:", datos.error.message);
        }

        console.log("=== Modelos disponibles para tu API Key ===");
        datos.models.forEach(modelo => {
            // Filtramos un poco para que sea más fácil de leer
            if (modelo.name.includes("gemini")) {
                console.log(`- ${modelo.name} (Soporta: ${modelo.supportedGenerationMethods.join(', ')})`);
            }
        });

    } catch (error) {
        console.error("❌ Error al intentar conectar:", error);
    }
}

listarModelos();