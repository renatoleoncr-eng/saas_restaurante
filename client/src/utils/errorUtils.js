/**
 * Limpieza y traducción de mensajes de error técnicos a español amigable
 */
export function humanizeErrorMessage(error) {
    if (!error) return 'Ocurrió un error inesperado. Por favor, intente nuevamente.';

    const rawMsg = typeof error === 'string' 
        ? error 
        : (error.response?.data?.error || error.response?.data?.message || error.message || String(error));
        
    if (!rawMsg || typeof rawMsg !== 'string') {
        return 'Ocurrió un error inesperado al procesar la solicitud.';
    }

    const lower = rawMsg.toLowerCase();

    // 1. Timeouts de red
    if (lower.includes('timeout') && lower.includes('exceeded')) {
        return 'SUNAT tardó demasiado tiempo en responder (tiempo límite agotado). Por favor, reintente en unos minutos.';
    }

    // 2. Conexión / Red
    if (lower.includes('network error') || lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('enotfound') || lower.includes('socket hang up')) {
        return 'No se pudo conectar con el servidor de facturación. Verifique su conexión a internet o reintente en unos momentos.';
    }

    // 3. Fallas internas de almacenamiento en SUNAT (0132, 0133)
    if (lower.includes('archivo backup') || lower.includes('archivo zip') || lower.includes('0132')) {
        return 'SUNAT presenta saturación temporal en sus servidores (no puede almacenar el archivo). Espere unos minutos o cobre sin comprobante fiscal por ahora.';
    }
    if (lower.includes('entrada del log') || lower.includes('dejar traza') || lower.includes('0133')) {
        return 'SUNAT se encuentra en mantenimiento temporal o interrupción de servicio. Por favor, reintente en unos minutos.';
    }

    // 4. Ticket 422 / 0130
    if (lower.includes('obtener ticket error') || lower.includes('422') || lower.includes('ticket de proceso') || lower.includes('0130')) {
        return 'SUNAT no pudo procesar el ticket del comprobante (Error 422 en SUNAT). Por favor, espere un momento y vuelva a intentar.';
    }

    // 5. Documento igual en proceso (0140)
    if (lower.includes('existe un documento igual en proceso') || lower.includes('0140') || lower.includes('15 minutos')) {
        return 'Existe un documento igual en proceso en SUNAT. Por favor, espere unos minutos antes de volver a enviar.';
    }

    // 6. Error 500 / Internal error
    if (lower.includes('status code 500') || lower.includes('internal error')) {
        return 'Error interno en los servidores de SUNAT. El servicio tributario está intermitente. Reintente en unos minutos.';
    }

    // 7. Limpiar prefijos y detalles técnicos
    let clean = rawMsg
        .replace(/^Error de SUNAT Hub( al anular)?:\s*/i, '')
        .replace(/^SUNAT ERROR:\s*/i, '')
        .replace(/- Detalle:.*$/is, '')
        .trim();

    return clean || 'SUNAT no pudo procesar la solicitud en este momento. Intente nuevamente.';
}
