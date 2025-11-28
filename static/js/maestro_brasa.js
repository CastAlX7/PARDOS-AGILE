// =============================================================================
// MÓDULO: MAESTRO BRASA (COCINERO)
// Responsabilidad: Gestionar la preparación de platos.
// Recibe comandas (del Mozo o de Reservas), las visualiza y marca como listas.
// =============================================================================

let COCINA_REFRESH_INTERVAL = null; // Variable para el auto-refresco de la pantalla

// ==================== 1. PEDIDOS DEL MOZO (WALK-IN) ====================

/**
 * Función: renderCocina
 * Propósito: Muestra las comandas creadas directamente en el restaurante por el Mozo.
 * Lógica: Filtra las comandas que NO tienen un ID de reserva asociado.
 * Async: Obtiene datos del servidor y renderiza la interfaz.
 */
async function renderCocina() {
    setPageTitle('Pedidos del Mozo (En Sala)', 'fa-fire-alt');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        
        // ✅ FILTRO CLAVE: Comandas SIN reserva (id_reserva es null o undefined)
        // Mostramos pendientes (para cocinar) y completadas (historial del turno)
        const comandasMozo = comandas.filter(c => 
            ['pendiente', 'completada'].includes(c.estado) &&
            (!c.id_reserva || c.id_reserva === null)
        );
        
        // Renderizamos usando la función común
        renderInterfazCocina(content, comandasMozo, 'Mozo');
        
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar pedidos del mozo</div>';
    }
}

// ==================== 2. PEDIDOS DE RESERVAS (ANFITRIONA) ====================

/**
 * Función: renderPedidosReservas
 * Propósito: Muestra las comandas que provienen de una Reserva Confirmada.
 * Lógica:
 * 1. Obtiene comandas y reservas.
 * 2. Filtra comandas que TIENEN id_reserva.
 * 3. Verifica que esa reserva exista y esté 'confirmada'.
 * Async: Requiere cargar ambas listas para cruzar datos.
 */
async function renderPedidosReservas() {
    setPageTitle('Pedidos de Reservas', 'fa-calendar-check');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        // Carga paralela para eficiencia
        const [comandas, reservas] = await Promise.all([
            fetchAPI('/comandas'),
            fetchAPI('/reservas')
        ]);
        
        // ✅ FILTRO CLAVE: Comandas CON reserva CONFIRMADA
        const pedidosReserva = comandas.filter(c => {
            // Debe tener un ID de reserva
            if (!c.id_reserva) return false;
            
            // Buscamos la reserva asociada
            const reservaAsociada = reservas.find(r => r.id_reserva === c.id_reserva); // Asegurarse que el ID coincida (id o id_reserva según API)
            
            // Solo mostramos si la reserva existe y está confirmada (o pendiente si la política lo permite, pero idealmente confirmada)
            return reservaAsociada && ['confirmada', 'pendiente'].includes(reservaAsociada.estado);
        });
        
        // Enriquecemos la data con info de la reserva (ej: cantidad de personas)
        const pedidosConDatos = pedidosReserva.map(c => {
            const reserva = reservas.find(r => r.id_reserva === c.id_reserva);
            // Agregamos datos extra al objeto comanda para mostrar en la tarjeta
            return { 
                ...c, 
                cantidad_personas: reserva ? reserva.personas : '?',
                nombre_reserva: reserva ? reserva.cliente : 'Cliente Reserva'
            };
        });

        renderInterfazCocina(content, pedidosConDatos, 'Reserva');
        
    } catch (e) {
        console.error(e);
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar pedidos de reserva</div>';
    }
}

// ==================== RENDERIZADO COMÚN (INTERFAZ) ====================

/**
 * Función: renderInterfazCocina
 * Propósito: Genera el HTML de la grilla de tarjetas de cocina.
 * Parámetros:
 * - container: Elemento DOM donde pintar.
 * - listaComandas: Array de objetos comanda filtrados.
 * - tipoOrigen: String ('Mozo' o 'Reserva') para saber qué recargar.
 */
function renderInterfazCocina(container, listaComandas, tipoOrigen) {
    // Estado Vacío
    if (listaComandas.length === 0) {
        container.innerHTML = `
            <div class="card text-center" style="padding: 60px;">
                <i class="fas fa-check-double" style="font-size: 4em; color: var(--success);"></i>
                <h3 style="margin-top: 20px; color: var(--success);">¡Todo Listo!</h3>
                <p style="color: #666;">No hay pedidos de ${tipoOrigen} pendientes en este momento.</p>
                <button class="btn btn-primary mt-3" onclick="${tipoOrigen === 'Mozo' ? 'renderCocina()' : 'renderPedidosReservas()'}">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>`;
        if (COCINA_REFRESH_INTERVAL) clearInterval(COCINA_REFRESH_INTERVAL);
        return;
    }

    // Separar por estado para el resumen
    const pendientes = listaComandas.filter(c => c.estado === 'pendiente');
    const listos = listaComandas.filter(c => c.estado === 'completada');

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div class="card" style="text-align: center; padding: 20px; background: #fff3cd; border-left: 5px solid #ffc107;">
                <h2 style="margin: 0; color: #856404; font-size: 2.5em;">${pendientes.length}</h2>
                <p style="margin: 5px 0 0; color: #856404; font-weight: bold;">🔥 EN PREPARACIÓN</p>
            </div>
            <div class="card" style="text-align: center; padding: 20px; background: #d4edda; border-left: 5px solid #28a745;">
                <h2 style="margin: 0; color: #155724; font-size: 2.5em;">${listos.length}</h2>
                <p style="margin: 5px 0 0; color: #155724; font-weight: bold;">✅ LISTOS PARA SERVIR</p>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
            ${listaComandas.map(c => renderComandaCard(c, tipoOrigen)).join('')}
        </div>
    `;

    // Configurar Auto-refresh cada 15 segundos para ver nuevos pedidos automáticamente
    if (COCINA_REFRESH_INTERVAL) clearInterval(COCINA_REFRESH_INTERVAL);
    COCINA_REFRESH_INTERVAL = setInterval(() => {
        // Solo refrescar si seguimos en la misma pantalla
        const titulo = document.getElementById('page-title')?.textContent;
        if (titulo?.includes('Pedidos del Mozo') && tipoOrigen === 'Mozo') renderCocina();
        else if (titulo?.includes('Pedidos de Reservas') && tipoOrigen === 'Reserva') renderPedidosReservas();
    }, 15000);
}

/**
 * Función: renderComandaCard
 * Propósito: Genera el HTML de una tarjeta individual de comanda.
 * Muestra: Mesa, Items, Observaciones y Botón de acción.
 */
function renderComandaCard(c, tipoOrigen) {
    const esPendiente = c.estado === 'pendiente';
    const colorEstado = esPendiente ? '#ffc107' : '#28a745'; // Amarillo o Verde
    const textoEstado = esPendiente ? 'EN PROCESO' : 'TERMINADO';
    
    // Si es de reserva, mostramos info extra
    const infoExtra = c.cantidad_personas ? 
        `<span style="background: #e3f2fd; color: #0d47a1; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; margin-left: 10px;">
            <i class="fas fa-users"></i> ${c.cantidad_personas} pers.
         </span>` : '';

    return `
        <div class="card" style="border-top: 5px solid ${colorEstado}; padding: 0; overflow: hidden;">
            <div style="padding: 15px; background: #f8f9fa; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; color: var(--primary); font-size: 1.4em;">Mesa ${c.mesa}</h3>
                    <div style="display: flex; align-items: center; margin-top: 5px;">
                        <span style="font-size: 0.9em; color: #666;">#${c.id}</span>
                        ${infoExtra}
                    </div>
                </div>
                <div style="text-align: right;">
                    <span style="background: ${colorEstado}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold;">
                        ${textoEstado}
                    </span>
                    <div style="font-size: 0.85em; color: #888; margin-top: 5px;">${c.hora}</div>
                </div>
            </div>
            
            <div style="padding: 15px;">
                ${c.nombre_cliente ? `<p style="margin: 0 0 10px; font-weight: bold; color: #333;"><i class="fas fa-user"></i> ${c.nombre_cliente}</p>` : ''}
                
                <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 10px;">
                    ${c.items.map(i => `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 8px;">
                            <div style="flex: 1;">
                                <span style="font-weight: bold; font-size: 1.1em; color: var(--primary); margin-right: 5px;">${i.cantidad}x</span>
                                <span style="font-size: 1.05em;">${i.nombre}</span>
                                ${i.observaciones ? `
                                    <div style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; margin-top: 4px;">
                                        <i class="fas fa-exclamation-circle"></i> ${i.observaciones}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${c.observaciones_general ? `
                    <div style="margin-top: 10px; padding: 10px; background: #ffebee; color: #c62828; border-radius: 8px; font-size: 0.9em;">
                        <strong>Nota General:</strong> ${c.observaciones_general}
                    </div>
                ` : ''}
            </div>
            
            ${esPendiente ? `
                <div style="padding: 15px; background: #f8f9fa; border-top: 1px solid #eee;">
                    <button class="btn btn-success btn-block" onclick="marcarListo(${c.id}, '${tipoOrigen}')" style="font-weight: bold; padding: 12px;">
                        <i class="fas fa-check-circle"></i> PLATOS LISTOS
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// ==================== ACCIÓN: MARCAR COMO LISTO ====================

/**
 * Función: marcarListo
 * Propósito: Cambia el estado de la comanda a 'completada'.
 * Lógica: Envía PUT al servidor y recarga la vista actual.
 */
function marcarListo(id, tipoOrigen) {
    showConfirm(
        'Confirmar Preparación',
        '¿Confirma que todos los platos de esta mesa están listos para servir?',
        async () => {
            try {
                await fetchAPI(`/comandas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'completada' }) 
                });
                showToast('✅ ¡Oído cocina! Pedido listo.', 'success');
                
                // Recargar la vista correcta para ver el cambio
                if (tipoOrigen === 'Mozo') renderCocina();
                else renderPedidosReservas();
                
            } catch (e) {
                showToast('Error al actualizar pedido', 'error');
            }
        },
        'fa-fire',
        'var(--success)'
    );
}