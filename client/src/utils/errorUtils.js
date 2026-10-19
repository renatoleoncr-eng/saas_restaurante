/**
 * Motor universal de limpieza y traducción de errores técnicos a español amigable
 */
export function humanizeErrorMessage(error) {
    if (!error) return 'Ocurrió un error inesperado. Por favor, intente nuevamente.';

    const rawMsg = typeof error === 'string' 
        ? error 
        : (error.response?.data?.message || error.response?.data?.error || error.message || String(error));
        
    if (!rawMsg || typeof rawMsg !== 'string') {
        return 'Ocurrió un error inesperado al procesar la solicitud.';
    }

    const lower = rawMsg.toLowerCase();

    // 1. Sesión y Autenticación
    if (lower.includes('jwt expired') || lower.includes('tokenexpirederror') || lower.includes('token expired')) {
        return 'Su sesión ha expirado por seguridad. Por favor, vuelva a iniciar sesión.';
    }
    if (lower.includes('invalid token') || lower.includes('jwt malformed') || lower.includes('jwt must be provided')) {
        return 'Sesión inválida o no reconocida. Por favor, vuelva a iniciar sesión.';
    }
    if (lower.includes('no token provided') || lower.includes('unauthorized') || lower.includes('status code 401')) {
        return 'No tiene autorización para realizar esta acción o su sesión ha finalizado.';
    }
    if (lower.includes('forbidden') || lower.includes('acceso denegado') || lower.includes('status code 403')) {
        return 'No cuenta con los permisos necesarios para realizar esta operación.';
    }
    if (lower.includes('invalid credentials') || lower.includes('credenciales inválidas') || lower.includes('usuario o contraseña incorrectos')) {
        return 'Usuario o contraseña incorrectos. Verifique sus datos e intente nuevamente.';
    }

    // 2. Facturación / SUNAT específico
    const isBillingContext = lower.includes('sunat') || lower.includes('comprobante') || lower.includes('boleta') || 
                             lower.includes('factura') || lower.includes('ticket') || lower.includes('baja') || 
                             lower.includes('nota de crédito') || lower.includes('facturador');

    if (isBillingContext) {
        if ((lower.includes('timeout') && lower.includes('exceeded')) || lower.includes('econnaborted')) {
            return 'SUNAT tardó demasiado tiempo en responder (tiempo límite agotado). Por favor, reintente en unos minutos.';
        }
        if (lower.includes('archivo backup') || lower.includes('archivo zip') || lower.includes('0132')) {
            return 'SUNAT presenta saturación temporal en sus servidores (no puede almacenar el archivo). Espere unos minutos o vuelva a intentar.';
        }
        if (lower.includes('entrada del log') || lower.includes('dejar traza') || lower.includes('0133')) {
            return 'SUNAT se encuentra en mantenimiento temporal o interrupción de servicio. Por favor, reintente en unos minutos.';
        }
        if (lower.includes('obtener ticket error') || lower.includes('422') || lower.includes('ticket de proceso') || lower.includes('0130')) {
            return 'SUNAT no pudo procesar el ticket del comprobante (Error 422 en SUNAT). Por favor, espere un momento y vuelva a intentar.';
        }
        if (lower.includes('existe un documento igual en proceso') || lower.includes('0140') || lower.includes('15 minutos')) {
            return 'Existe un documento igual en proceso en SUNAT. Por favor, espere unos minutos antes de volver a enviar.';
        }
        if (lower.includes('el ticket no existe') || lower.includes('0127')) {
            return 'El ticket de procesamiento no existe en SUNAT. Verifique el estado del comprobante.';
        }
    }

    // 3. Timeouts y Conectividad General
    if ((lower.includes('timeout') && lower.includes('exceeded')) || lower.includes('econnaborted')) {
        return 'El servidor tardó demasiado en responder (tiempo límite agotado). Verifique su conexión y reintente.';
    }
    if (lower.includes('network error') || lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('err_connection_refused')) {
        return 'No se pudo conectar con el servidor central. Verifique su conexión a internet.';
    }
    if (lower.includes('socket hang up') || lower.includes('econnreset')) {
        return 'La conexión fue interrumpida inesperadamente. Por favor, vuelva a intentarlo.';
    }
    if (lower.includes('status code 502') || lower.includes('status code 504') || lower.includes('bad gateway') || lower.includes('gateway time-out')) {
        return 'El servidor se encuentra reiniciándose o en mantenimiento momentáneo. Espere unos segundos y vuelva a intentar.';
    }
    if (lower.includes('status code 500') || lower.includes('internal server error')) {
        return 'Ocurrió un inconveniente interno en el servidor. Por favor, intente nuevamente.';
    }
    if (lower.includes('status code 404') || lower.includes('not found')) {
        return 'El recurso o registro solicitado no fue encontrado en el servidor.';
    }
    if (lower.includes('status code 409') || lower.includes('conflict')) {
        return 'Existe un conflicto con el estado actual del registro. Recargue los datos.';
    }

    // 4. Base de Datos y Restricciones (Sequelize / MySQL)
    if (lower.includes('sequelizeuniqueconstrainterror') || lower.includes('duplicate entry')) {
        return 'Ya existe un registro con este mismo número, código o identificación en el sistema.';
    }
    if (lower.includes('sequelizeforeignkeyconstrainterror') || lower.includes('foreign key constraint') || lower.includes('cannot delete or update a parent row')) {
        return 'No es posible eliminar o modificar este registro porque tiene operaciones o datos vinculados (pagos, consumos, transacciones).';
    }
    if (lower.includes('data too long for column') || lower.includes('value too long')) {
        return 'El texto ingresado supera el límite de caracteres permitido para ese campo. Ingrese una descripción más breve.';
    }
    if (lower.includes('sequelizeconnectionerror') || lower.includes('too many connections') || lower.includes('etimedout')) {
        return 'La base de datos se encuentra temporalmente ocupada. Por favor, espere unos segundos y vuelva a intentar.';
    }
    if (lower.includes('deadlock found')) {
        return 'Conflicto por operaciones simultáneas en el sistema. Por favor, repita la acción.';
    }

    // 5. Archivos y Cargas (Uploads)
    if (lower.includes('file too large') || lower.includes('limit_file_size')) {
        return 'El archivo seleccionado es demasiado pesado. El límite máximo permitido es 10 MB.';
    }
    if (lower.includes('limit_unexpected_file')) {
        return 'Formato de archivo no admitido o campo de archivo inválido.';
    }
    if (lower.includes('only image files are allowed') || lower.includes('solo se permiten imágenes')) {
        return 'Solo se permite subir archivos de imagen (JPG, PNG o WEBP).';
    }

    // 6. Consultas de Identidad (DNI / RUC)
    if (lower.includes('el dni debe tener 8') || lower.includes('dni debe tener 8')) {
        return 'El DNI debe tener exactamente 8 dígitos numéricos.';
    }
    if (lower.includes('el ruc debe tener 11') || lower.includes('ruc debe tener 11')) {
        return 'El RUC debe tener exactamente 11 dígitos numéricos.';
    }
    if (lower.includes('no se encontró información para este dni') || lower.includes('dni no encontrado')) {
        return 'No se encontró información en RENIEC con el DNI ingresado. Puede escribir los nombres manualmente.';
    }
    if (lower.includes('no se encontró información para este ruc') || lower.includes('ruc no encontrado')) {
        return 'No se encontró información en SUNAT con el RUC ingresado. Puede escribir la Razón Social manualmente.';
    }

    // 7. Limpieza de prefijos y detalles técnicos
    let clean = rawMsg
        .replace(/^Error de SUNAT Hub( al anular)?:\s*/i, '')
        .replace(/^SUNAT ERROR:\s*/i, '')
        .replace(/^Error:\s*/i, '')
        .replace(/^Request failed with status code \d+:\s*/i, '')
        .replace(/- Detalle:.*$/is, '')
        .replace(/^[a-z]+Error:\s*/i, '')
        .trim();

    return clean || 'Ocurrió un error al procesar la solicitud. Intente nuevamente.';
}
