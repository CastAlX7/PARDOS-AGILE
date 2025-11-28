// =============================================================================
// MÓDULO: CAJERA
// Responsabilidad: Gestionar cobros, emitir comprobantes, validar reservas y
//                  permitir la edición final de pedidos.
// =============================================================================

// --- VARIABLES GLOBALES DEL MÓDULO (ASUMIDAS GLOBALES EN LA APLICACIÓN) ---
let COMANDA_EDIT_ACTUAL_ID = null;
let COMANDA_TEMPORAL_DATA = null;
// Nota: Se asume que window.CART, window.MENU_DATA, fetchAPI, closeModal, 
//       showToast, showConfirm, setPageTitle y showLoader existen globalmente.

// =============================================================================
// I. GESTIÓN DE CAJA Y PAGO
// =============================================================================

/**
 * Función: renderCaja
 * ---------------------------------------------------------------------------
 * Propósito: Renderiza la vista principal de la Cajera, mostrando las comandas
 * listas para cobrar (estado 'completada').
 */
async function renderCaja() {
    setPageTitle('Caja - Pagos y Comprobantes', 'fa-cash-register');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const comandas = await fetchAPI('/comandas');
        const porCobrar = comandas.filter(c => c.estado === 'completada');
        
        content.innerHTML = `
            <div class="caja-layout">
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3><i class="fas fa-list"></i> Comandas por Cobrar</h3>
                            <span class="badge badge-completada">${porCobrar.length} pendientes</span>
                        </div>
                        <div id="lista-cobrar">
                            ${porCobrar.length === 0 ? 
                                '<p class="text-center" style="padding: 30px; color: #666;"><i class="fas fa-check-circle" style="font-size: 2em;"></i><br>No hay cuentas pendientes</p>' :
                                porCobrar.map(c => `
                                    <div class="cart-item" style="cursor: pointer;" onclick="seleccionarCuenta(${c.id})">
                                        <div class="cart-item-info">
                                            <div class="cart-item-name"><i class="fas fa-chair"></i> Mesa ${c.mesa}</div>
                                            <div class="cart-item-price">${c.nombre_cliente || 'Cliente General'} - ${c.hora}</div>
                                        </div>
                                        <div>
                                            <strong style="color: var(--primary);">S/ ${c.total.toFixed(2)}</strong>
                                        </div>
                                    </div>
                                `).join('')
                            }
                        </div>
                    </div>
                </div>
                
                <div>
                    <div class="card" id="panel-pago">
                        <div class="card-header">
                            <h3><i class="fas fa-receipt"></i> Detalle de Cuenta</h3>
                        </div>
                        <div class="text-center" style="padding: 40px; color: #999;">
                            <i class="fas fa-hand-pointer" style="font-size: 3em;"></i>
                            <p style="margin-top: 15px;">Seleccione una cuenta de la izquierda para cobrar</p>
                        </div>
                    </div>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar caja</div>';
    }
}

/**
 * Función: seleccionarCuenta
 * ---------------------------------------------------------------------------
 * Propósito: Carga los detalles de una comanda seleccionada y prepara el panel de pago.
 */
async function seleccionarCuenta(idComanda) {
    const contentArea = document.getElementById('content-area');
    const isEditing = contentArea.querySelector('.caja-layout') === null;

    if (!isEditing) {
        const panel = document.getElementById('panel-pago');
        panel.innerHTML = `<div class="card-header"><h3><i class="fas fa-receipt"></i> Cargando...</h3></div>${showLoader()}`;
    } else {
         renderCaja();
         setTimeout(() => seleccionarCuenta(idComanda), 50); 
         return;
    }
    
    try {
        const comandas = await fetchAPI('/comandas');
        const comandaActual = comandas.find(c => c.id === idComanda);
        if (!comandaActual || comandaActual.estado === 'pagada') { renderCaja(); return; }
        
        const cuenta = await fetchAPI(`/cuentas/previsualizar/${idComanda}`);
        const reservas = await fetchAPI('/reservas');
        const hoy = new Date().toISOString().split('T')[0];
        const reservaVinculada = reservas.find(r => 
            r.id_mesa === comandaActual.id_mesa && r.fecha === hoy &&
            ['pendiente', 'confirmada'].includes(r.estado)
        );
        
        if (reservaVinculada && reservaVinculada.estado === 'pendiente') {
            document.getElementById('panel-pago').innerHTML = `<div style="padding: 40px; text-align: center;"><h3 style="color: var(--warning);">⚠️ Reserva Pendiente</h3><p>La Reserva #${reservaVinculada.id_reserva} debe ser confirmada antes de cobrar.</p><button class="btn btn-primary" onclick="renderConfirmarReservas()">Ir a Confirmaciones</button></div>`;
            return;
        }
        
        const idReservaSafe = reservaVinculada ? reservaVinculada.id_reserva : 'null';

        COMANDA_TEMPORAL_DATA = { id: idComanda, comanda: comandaActual };
        const panel = document.getElementById('panel-pago');

        panel.innerHTML = `
            <div class="card-header">
                <h3><i class="fas fa-receipt"></i> Mesa ${cuenta.mesa}</h3>
                <span class="badge badge-completada">Comanda #${idComanda}</span>
            </div>
            
            <div style="padding: 20px;">
                <div style="background: #f8f9fa; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
                    <div id="cuenta-items" style="max-height: 150px; overflow-y: auto;">
                        ${cuenta.items.map(item => `
                            <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #ddd; padding:5px 0;">
                                <span>${item.cantidad}x ${item.nombre}</span>
                                <div style="display:flex; align-items:center; gap:5px;">
                                    <strong>S/ ${item.subtotal.toFixed(2)}</strong>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="cuenta-total"><span>TOTAL</span><span>S/ ${cuenta.total.toFixed(2)}</span></div>
                </div>
                
                <hr style="margin: 10px 0;">
                
                <h4><i class="fas fa-file-invoice-dollar"></i> Datos de Comprobante</h4>
                
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group">
                        <label>Tipo</label>
                        <select id="pago-tipo" onchange="toggleCamposComprobante()">
                            <option value="boleta">🧾 Boleta</option>
                            <option value="factura">📄 Factura</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Pago</label>
                        <select id="pago-metodo">
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Tarjeta">💳 Tarjeta</option>
                            <option value="Yape">📱 Yape</option>
                            <option value="Plin">📱 Plin</option>
                        </select>
                    </div>
                </div>

                <div id="campos-boleta">
                    <div class="form-group">
                        <label>DNI (8 dígitos)</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="pago-dni" maxlength="8" placeholder="DNI (opcional)" onkeyup="if(this.value.length===8) buscarClienteDNI()">
                            <button class="btn btn-info btn-sm" onclick="buscarClienteDNI()"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Nombre Cliente</label>
                        <input type="text" id="pago-nombre" value="${comandaActual.nombre_cliente || ''}" placeholder="Cliente General">
                    </div>
                </div>

                <div id="campos-factura" class="hidden">
                    <div class="form-group">
                        <label>RUC (11 dígitos)</label>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" id="pago-ruc" maxlength="11" placeholder="Ingrese RUC" onkeyup="if(this.value.length===11) buscarClienteRUC()">
                            <button class="btn btn-info btn-sm" onclick="buscarClienteRUC()"><i class="fas fa-search"></i></button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Razón Social</label>
                        <input type="text" id="pago-razon" placeholder="Nombre de la Empresa">
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
                    <button class="btn btn-info" onclick="imprimirPrecuenta(${idComanda})"><i class="fas fa-print"></i> Pre-cuenta</button>
                    <button class="btn btn-warning" onclick="editarComandaPagoFinal(${idComanda})"><i class="fas fa-edit"></i> Editar Pedido</button>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px;">
                    <button class="btn btn-danger" onclick="anularComandaCompletamente(${idComanda})"><i class="fas fa-trash"></i> Anular</button>
                    <button class="btn btn-success" onclick="procesarPago(${idComanda}, ${cuenta.total}, ${idReservaSafe})"><i class="fas fa-check"></i> COBRAR</button>
                </div>
            </div>`;
        toggleCamposComprobante();
    } catch (e) {
        document.getElementById('panel-pago').innerHTML = '<div class="text-center" style="color: var(--danger); padding: 20px;">❌ Error al cargar datos de la cuenta</div>';
    }
}

/**
 * Función: toggleCamposComprobante
 * Propósito: Muestra/oculta los campos DNI/RUC.
 */
function toggleCamposComprobante() {
    const tipo = document.getElementById('pago-tipo').value;
    document.getElementById('campos-boleta').classList.toggle('hidden', tipo !== 'boleta');
    document.getElementById('campos-factura').classList.toggle('hidden', tipo !== 'factura');
}

/**
 * Función: buscarClienteDNI
 * Propósito: Conecta con la API de DNI.
 */
async function buscarClienteDNI() {
    const dni = document.getElementById('pago-dni').value;
    if (dni.length !== 8) return;
    
    const inputNombre = document.getElementById('pago-nombre');
    inputNombre.placeholder = "Buscando...";
    inputNombre.value = "Buscando..."; 
    
    try {
        const data = await fetchAPI(`/consulta-dni/${dni}`);
        if (data.success) {
            inputNombre.value = `${data.nombres || ''} ${data.apellido_paterno || ''} ${data.apellido_materno || ''}`.trim();
            showToast('✅ Datos de DNI encontrados', 'success');
        } else {
            inputNombre.value = "";
            inputNombre.placeholder = "DNI no encontrado";
            showToast('⚠️ DNI no encontrado. Ingrese nombre manual.', 'warning');
        }
    } catch (e) {
        inputNombre.value = "";
        inputNombre.placeholder = "Error de conexión";
        showToast('Error en la búsqueda DNI', 'error');
    }
}

/**
 * Función: buscarClienteRUC
 * Propósito: Simula la búsqueda de RUC.
 */
async function buscarClienteRUC() {
    const ruc = document.getElementById('pago-ruc').value;
    if (ruc.length !== 11) return;
    
    const inputRazon = document.getElementById('pago-razon');
    inputRazon.value = "Buscando...";
    
    // Simulación: Respuesta Sunat
    setTimeout(() => {
        if (ruc.startsWith('20')) {
             inputRazon.value = `RAZÓN SOCIAL PRUEBA RUC ${ruc.substring(0, 4)} S.A.C.`;
             showToast('✅ Razón Social Autocompletada', 'success');
        } else {
            inputRazon.value = "";
            showToast('⚠️ RUC no encontrado o no disponible en demo', 'warning');
        }
    }, 500);
}

// =============================================================================
// II. FUNCIONALIDAD DE EDICIÓN EN INTERFAZ COMPLETA
// =============================================================================

/**
 * Función: editarComandaPagoFinal
 * ---------------------------------------------------------------------------
 * Propósito: Prepara el entorno y navega a la interfaz de edición de página completa.
 * @param {number} idComanda ID de la comanda a editar.
 */
async function editarComandaPagoFinal(idComanda) {
    showToast('Cargando items para edición...', 'info');
    
    COMANDA_EDIT_ACTUAL_ID = idComanda;

    try {
        const comanda = await fetchAPI(`/comandas/${idComanda}`);
        const menuData = await fetchAPI('/menu');
        
        // Obtener el número de mesa real
        const mesas = await fetchAPI('/mesas');
        const mesaObj = mesas.find(m => m.id === comanda.id_mesa);
        comanda.mesa = mesaObj ? mesaObj.numero : 'Indefinida'; 
        
        window.MENU_DATA = menuData;
        window.CART = []; 

        // 1. Llenar el carrito con los items de la comanda actual
        comanda.items.forEach(item => {
            window.CART.push({
                id_menu: item.id_menu,
                nombre: item.nombre,
                precio: parseFloat(item.precio),
                cantidad: parseInt(item.cantidad),
                observaciones: item.observaciones || ''
            });
        });
        
        // 2. Renderizar la interfaz de edición de página completa.
        renderEdicionCaja(idComanda, comanda);
        
    } catch (e) {
        showToast('❌ Error al cargar la comanda para edición', 'error');
        console.error('Error al editar comanda:', e);
        seleccionarCuenta(idComanda); 
    }
}

/**
 * Función: renderEdicionCaja (Reemplaza a mostrarModalEdicionCaja)
 * ---------------------------------------------------------------------------
 * Propósito: Renderiza la interfaz de edición (menú y carrito) en una vista de página completa.
 */
function renderEdicionCaja(idComanda, comanda) {
    setPageTitle(`✏️ Edición Pedido #${idComanda} - Mesa ${comanda.mesa}`, 'fa-edit');
    const content = document.getElementById('content-area');

    if (!window.MENU_DATA) window.MENU_DATA = {};
    const categorias = Object.keys(window.MENU_DATA);
    
    // --- ESTILOS DE PÁGINA COMPLETA ---
    const estiloMesaCliente = 'font-size: 1.1em; color: var(--primary-dark); margin-bottom: 5px; font-weight: bold;';
    const estiloObservaciones = 'background: #f8f8f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #eee;';
    const estiloBuscador = 'width: 100%; padding: 12px; border: 2px solid var(--primary); border-radius: 8px; font-size: 1.1em; margin-bottom: 15px;';
    
    const mesaNumero = comanda.mesa; 

    content.innerHTML = `
        <div style="padding: 20px 0;">
            <div style="display: grid; grid-template-columns: 1fr 400px; gap: 30px; max-width: 1200px; margin: 0 auto;">
                
                <div class="card" style="padding: 20px;">
                    <h3><i class="fas fa-utensils"></i> Menú Disponible</h3>
                    <div style="margin-bottom: 20px;">
                        <input type="text" id="search-menu-caja" 
                            placeholder="🔍 Buscar platos por nombre..." 
                            style="${estiloBuscador}"
                            oninput="cambiarCategoriaCaja(document.querySelector('#modal-menu-categorias .category-btn.active')?.textContent || '${categorias[0]}')">
                    </div>
                    
                    <div class="menu-categories" id="modal-menu-categorias" style="overflow-x: auto; white-space: nowrap; padding-bottom: 15px; border-bottom: 1px solid #ddd; margin-bottom: 20px;">
                        ${categorias.map((c, i) => 
                            // 🚀 ESTILOS PARA QUE EL BOTÓN ACTIVO SEA ROJO CON LETRA BLANCA
                            `<button class="btn category-btn ${i === 0 ? 'active' : ''}" 
                                onclick="cambiarCategoriaCaja('${c}')" 
                                style="
                                    min-width: 120px; 
                                    padding: 10px 15px; 
                                    margin-right: 10px; 
                                    background-color: ${i === 0 ? 'var(--danger)' : '#f0f0f0'};
                                    color: ${i === 0 ? 'white' : 'black'};
                                    border: 1px solid ${i === 0 ? 'var(--danger)' : '#ccc'};
                                    border-radius: 20px; /* Estilo pill */
                                    transition: all 0.2s;
                                "
                                data-category="${c}"
                            >${c}</button>`
                        ).join('')}
                    </div>
                    
                    <div class="menu-items" id="menu-items-caja" style="
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); 
                        gap: 15px; 
                        max-height: 55vh; 
                        overflow-y: auto; 
                        padding: 5px;
                    ">
                        <p style="grid-column: 1/-1; text-align: center; color: #999; padding: 30px;">Seleccione una categoría o busque un plato.</p>
                    </div>
                </div>
                
                <div class="card" style="padding: 25px; background: #fff;">
                    
                    <h2 style="margin-top: 0; color: var(--primary);"><i class="fas fa-shopping-cart"></i> Carrito de Edición</h2>
                    <p style="${estiloMesaCliente}"><i class="fas fa-chair"></i> Mesa **${mesaNumero}** - <i class="fas fa-user"></i> Cliente: ${comanda.nombre_cliente || 'General'}</p>
                    <hr style="border: none; border-top: 1px dashed #ddd; margin: 15px 0;">
                    
                    <div style="${estiloObservaciones}">
                        <label for="pedido-obs-modal" style="font-size: 1em; font-weight: bold; color: #333;">Observaciones del Pedido</label>
                        <textarea id="pedido-obs-modal" rows="3" style="width: 100%; border: 1px solid #ccc; border-radius: 4px; margin-top: 8px; padding: 10px;">${comanda.observaciones || ''}</textarea>
                    </div>

                    <div class="cart-items" id="cart-items-caja" style="max-height: 35vh; overflow-y: auto; padding: 5px 0;">
                        </div>
                    
                    <div class="cart-total" id="cart-total-caja" style="margin-top: 25px; padding-top: 20px; border-top: 2px solid var(--primary-dark);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 1.5em; font-weight: bold;">TOTAL ESTIMADO</span>
                            <span id="total-amount-caja" style="font-size: 1.8em; font-weight: bold; color: var(--success);">S/ 0.00</span>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 30px;">
                        <button class="btn btn-secondary btn-lg" onclick="seleccionarCuenta(${idComanda});">
                            <i class="fas fa-times"></i> Cancelar y Volver
                        </button>
                        <button class="btn btn-success btn-lg" onclick="guardarCambiosPedidoCaja(${idComanda}, ${comanda.id_mesa}, '${comanda.nombre_cliente || 'Cliente General'}')" id="btn-guardar-caja">
                            <i class="fas fa-save"></i> Guardar Cambios
                        </button>
                    </div>

                </div>
            </div>
        </div>`;

    if (categorias.length > 0) cambiarCategoriaCaja(categorias[0]);
    actualizarCarritoCaja();
}


/**
 * Función: cambiarCategoriaCaja
 * ---------------------------------------------------------------------------
 * Propósito: Filtra los items del menú por categoría y término de búsqueda, y aplica estilos.
 */
function cambiarCategoriaCaja(categoria) {
    document.querySelectorAll('#modal-menu-categorias .category-btn').forEach(btn => {
        const isActive = btn.textContent === categoria;
        btn.classList.toggle('active', isActive);
        
        // 🚀 CORRECCIÓN DE ESTILO: Aplica rojo/blanco si está activo, o gris/negro si no
        if (isActive) {
            btn.style.backgroundColor = 'var(--danger)'; // Fondo Rojo
            btn.style.color = 'white'; // Texto Blanco
            btn.style.borderColor = 'var(--danger)'; // Borde Rojo
        } else {
            btn.style.backgroundColor = '#f0f0f0'; // Fondo Gris claro (inactivo)
            btn.style.color = 'black'; // Texto Negro (inactivo)
            btn.style.borderColor = '#ccc'; // Borde Gris claro
        }
    });
    
    const items = window.MENU_DATA[categoria] || [];
    const searchInput = document.getElementById('search-menu-caja');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const filtrados = items.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(searchTerm))
    );
    
    const container = document.getElementById('menu-items-caja');
    if (!container) return;
    
    if (filtrados.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #999;">No se encontraron platos</p>';
        return;
    }
    
    container.innerHTML = filtrados.map(item => `
        <div class="menu-item" style="border: 1px solid #ddd; padding: 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'" onclick="agregarAlCarritoCaja(${item.id}, '${item.nombre.replace(/'/g, "\\'")}', ${item.precio})">
            <div class="item-name" style="font-weight: bold;">${item.nombre}</div>
            <div class="item-price" style="color: var(--success); font-weight: bold;">S/ ${item.precio.toFixed(2)}</div>
            ${item.descripcion ? `<small style="color: #888; font-size: 0.85em; margin-top: 5px; display: block;">${item.descripcion}</small>` : ''}
        </div>
    `).join('');
}

/**
 * Función: agregarAlCarritoCaja
 * ---------------------------------------------------------------------------
 * Propósito: Agrega un item al carrito temporal de edición.
 */
function agregarAlCarritoCaja(id, nombre, precio) {
    const existe = window.CART.find(item => item.id_menu === id);
    if (existe) existe.cantidad++;
    else window.CART.push({ id_menu: id, nombre, precio, cantidad: 1, observaciones: '' });
    actualizarCarritoCaja();
    showToast(`${nombre} agregado`, 'success');
}

/**
 * Función: actualizarCarritoCaja
 * ---------------------------------------------------------------------------
 * Propósito: Renderiza el carrito temporal (window.CART) y calcula el total dentro de la interfaz.
 */
function actualizarCarritoCaja() {
    const container = document.getElementById('cart-items-caja');
    const totalEl = document.getElementById('total-amount-caja');
    const cartTotalDiv = document.getElementById('cart-total-caja');
    const btnGuardar = document.getElementById('btn-guardar-caja');
    
    if (!container) return;
    
    if (window.CART.length === 0) {
        container.innerHTML = `<p class="text-center" style="padding: 30px; color: #999;"><i class="fas fa-cart-plus" style="font-size: 2.5em;"></i><br>Agregue items para el pedido</p>`;
        if (cartTotalDiv) cartTotalDiv.style.display = 'none';
        if (btnGuardar) btnGuardar.disabled = true;
        return;
    }
    
    const total = window.CART.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    
    container.innerHTML = window.CART.map((item, idx) => `
        <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f0f0;">
            <div class="cart-item-info">
                <div class="cart-item-name" style="font-weight: bold;">${item.nombre}</div>
                <div class="cart-item-price" style="font-size: 0.9em; color: #666;">S/ ${item.precio.toFixed(2)} c/u</div>
            </div>
            <div class="cart-item-actions" style="display: flex; align-items: center; gap: 8px;">
                <button class="btn btn-sm btn-info" onclick="cambiarCantidadCaja(${idx}, -1)" style="padding: 5px 10px;">-</button>
                <span class="cart-item-qty" style="font-weight: bold; min-width: 20px; text-align: center;">${item.cantidad}</span>
                <button class="btn btn-sm btn-info" onclick="cambiarCantidadCaja(${idx}, 1)" style="padding: 5px 10px;">+</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarritoCaja(${idx})" style="padding: 5px 8px;"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
    
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
    if (cartTotalDiv) cartTotalDiv.style.display = 'block';
    if (btnGuardar) btnGuardar.disabled = false;
}

/**
 * Función: cambiarCantidadCaja
 * Propósito: Cambia la cantidad de un item en el carrito de edición.
 */
function cambiarCantidadCaja(idx, delta) {
    if (!window.CART[idx]) return;
    window.CART[idx].cantidad += delta;
    if (window.CART[idx].cantidad <= 0) window.CART.splice(idx, 1);
    actualizarCarritoCaja();
}

/**
 * Función: eliminarDelCarritoCaja
 * Propósito: Elimina un item completamente del carrito de edición.
 */
function eliminarDelCarritoCaja(idx) {
    if (!window.CART[idx]) return;
    window.CART.splice(idx, 1);
    actualizarCarritoCaja();
}


/**
 * Función: guardarCambiosPedidoCaja
 * ---------------------------------------------------------------------------
 * Propósito: Envía el carrito de edición actualizado al servidor (PUT /comandas/:id) y vuelve al panel de pago.
 */
async function guardarCambiosPedidoCaja(idComanda, idMesa, nombreCliente) {
    if (window.CART.length === 0) {
        return showToast('❌ Debe haber al menos un item para guardar', 'error');
    }
    
    const obs = document.getElementById('pedido-obs-modal')?.value || '';
    
    const data = {
        id_mesa: idMesa,
        nombre_cliente: nombreCliente,
        observaciones: obs,
        items: window.CART.map(i => ({
            id_menu: i.id_menu,
            cantidad: i.cantidad,
            observaciones: i.observaciones 
        }))
    };
    
    showConfirm('Guardar Edición', '¿Guardar los cambios en el pedido y regresar a cobrar?', async () => {
        try {
            await fetchAPI(`/comandas/${idComanda}`, { 
                method: 'PUT', 
                body: JSON.stringify(data) 
            });
            
            showToast('✅ Pedido actualizado. La cuenta se recalculará.', 'success');
            
            // 🚀 CORRECCIÓN: Regresar al menú principal de procesar pagos
            window.CART = [];
            COMANDA_EDIT_ACTUAL_ID = null;
            
            await renderCaja(); 
            seleccionarCuenta(idComanda); 
            
        } catch (e) {
            showToast('❌ Error al guardar la edición del pedido', 'error');
        }
    }, 'fa-save', 'var(--success)');
}

// =============================================================================
// III. OPERACIONES DE PAGO Y ANULACIÓN
// =============================================================================

/**
 * Función: imprimirPrecuenta
 * Propósito: Generar el documento provisional de cobro (Pre-cuenta).
 */
async function imprimirPrecuenta(idComanda) {
    try {
        const cuenta = await fetchAPI(`/cuentas/previsualizar/${idComanda}`);
        const fecha = new Date().toLocaleString('es-PE');

        const tipoDoc = document.getElementById('pago-tipo').value;
        const dni = document.getElementById('pago-dni')?.value.trim() || '';
        const ruc = document.getElementById('pago-ruc')?.value.trim() || '';
        const razon = document.getElementById('pago-razon')?.value.trim() || '';
        const nombreCliente = document.getElementById('pago-nombre')?.value.trim() || 'Cliente General';
        
        let datosComprobanteHTML = '';

        if (tipoDoc === 'factura' && ruc) {
             datosComprobanteHTML = `
                <div style="text-align: left; padding: 10px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>RUC:</strong> ${ruc}</p>
                    <p style="margin: 5px 0;"><strong>Razón Social:</strong> ${razon || 'Sin Razón Social'}</p>
                </div>`;
        } else if (tipoDoc === 'boleta') {
             datosComprobanteHTML = `
                <div style="text-align: left; padding: 10px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>Nombre:</strong> ${nombreCliente}</p>
                    ${dni ? `<p style="margin: 5px 0;"><strong>DNI:</strong> ${dni}</p>` : ''}
                </div>`;
        }
        
        const bodyHtml = `
            <div style="text-align: center; padding: 20px; border: 2px dashed #ccc; border-radius: 10px; background: white;">
                <div style="margin-bottom: 15px;">
                    <h2 style="color: var(--primary); margin: 0;"><i class="fas fa-drumstick-bite"></i> PARDOS CHICKEN</h2>
                    <p style="color: #666; margin: 5px 0;">RUC: 20123456789</p>
                </div>
                
                <hr style="margin: 15px 0; border-style: dashed;">
                
                <h3 style="text-transform: uppercase; margin: 15px 0; color: #FFC107;">⚠️ PRE-CUENTA (NO OFICIAL)</h3>
                <p style="color: #666; font-size: 0.9em;">${fecha}</p>
                
                <hr style="margin: 15px 0; border-style: dashed;">
                
                ${datosComprobanteHTML}
                
                <div style="text-align: left; margin: 15px 0;">
                    <h4 style="margin-bottom: 10px; color: var(--primary);">Detalle del Pedido:</h4>
                    ${cuenta.items.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ddd;">
                            <div><strong>${item.cantidad}x</strong> ${item.nombre}</div>
                            <strong>S/ ${item.subtotal.toFixed(2)}</strong>
                        </div>
                    `).join('')}
                </div>
                
                <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                    <h2 style="margin: 0; font-size: 2em;">TOTAL: S/ ${cuenta.total.toFixed(2)}</h2>
                </div>
                
                <hr style="margin: 15px 0; border-style: dashed;">
                <p style="font-size: 0.75em; color: #dc3545; margin: 10px 0 0; font-weight: bold;">⚠️ DOCUMENTO PROVISIONAL</p>
            </div>`;
        
        const footerHtml = `
            <button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-times"></i> Cerrar</button>
            <button class="btn btn-info" onclick="imprimirHTML('${btoa(unescape(encodeURIComponent(bodyHtml)))}')"><i class="fas fa-print"></i> Imprimir Pre-cuenta</button>`;
        
        openModal('📋 Pre-cuenta (Provisional)', bodyHtml, footerHtml);
    } catch (e) {
        showToast('❌ Error al generar pre-cuenta', 'error');
    }
}

/**
 * Función: imprimirHTML
 * Propósito: Abre una ventana nueva para imprimir el contenido HTML.
 */
function imprimirHTML(base64Content) {
    const content = decodeURIComponent(escape(atob(base64Content)));
    const w = window.open('', '', 'height=600,width=800');
    
    // 1. Inclusión de Font Awesome (iconos)
    w.document.write('<html><head><title>Comprobante</title><link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">');
    
    // 2. Estilos esenciales (incluyendo el :root para las variables)
    w.document.write('<style>');
    w.document.write(`
        body { font-family: Arial, sans-serif; padding: 20px; }
        
        /* Definición de variables CSS esenciales para la impresión */
        :root {
            --primary: #C41E3A;
            --primary-dark: #8B0000;
            --success: #28a745;
            --warning: #ffc107;
            --danger: #dc3545;
            --info: #17a2b8;
        }

        /* Estilos específicos del comprobante/pre-cuenta */
        .badge { 
            padding: 5px 10px; border-radius: 12px; font-size: 0.85em; font-weight: bold;
            display: inline-block;
        }
        .badge-success { background: var(--success); color: white; }
        .badge-warning { background: var(--warning); color: #333; }
        
        /* Asegurarse que el fondo del total salga bien */
        .total-bg-primary { 
            background: linear-gradient(135deg, var(--primary), var(--primary-dark)); 
            color: white; 
        }
    `);
    w.document.write('</style>');
    
    // 3. Contenido del Comprobante
    w.document.write('</head><body>');
    w.document.write(content);
    w.document.write('</body></html>');
    
    w.document.close();
    
    // 🔑 LÍNEA CLAVE: Dispara la impresión
    w.print();
}

/**
 * Función: procesarPago
 * Propósito: Finaliza la transacción, genera el comprobante y marca la comanda/reserva como pagada.
 */
async function procesarPago(idComanda, total, idReserva) {
    const tipo = document.getElementById('pago-tipo').value;
    const metodo = document.getElementById('pago-metodo').value;
    
    const data = {
        id_comanda: idComanda,
        total: total,
        tipo: tipo,
        metodo: metodo,
        id_reserva: idReserva,
        dni: null, 
        ruc: null, 
        razon_social: null
    };

    if (tipo === 'boleta') {
        data.dni = document.getElementById('pago-dni').value.trim();
        data.nombre_cliente = document.getElementById('pago-nombre').value.trim();
    } else {
        data.ruc = document.getElementById('pago-ruc').value.trim();
        data.razon_social = document.getElementById('pago-razon').value.trim();
        
        if (!data.ruc || data.ruc.length !== 11) {
            return showToast('❌ El RUC debe tener 11 dígitos', 'error');
        }
        if (!data.razon_social) {
            return showToast('❌ La razón social es obligatoria para factura', 'error');
        }
    }
    
    showConfirm(
        '💳 Confirmar Pago FINAL',
        `¿Cobrar S/ ${total.toFixed(2)}?\nTipo: ${tipo === 'boleta' ? '🧾 Boleta' : '📄 Factura'}\nMétodo: ${metodo}`,
        async () => {
            try {
                const res = await fetchAPI('/pagos', { method: 'POST', body: JSON.stringify(data) });
                showToast('✅ ' + res.message, 'success');
                
                mostrarComprobanteFinal(res.id_comprobante, data, total);
                
                setTimeout(() => renderCaja(), 100);
            } catch (e) {
                showToast('❌ Error al procesar pago', 'error');
            }
        }, 
        'fa-cash-register', 
        'var(--success)'
    );
}

/**
 * Función: mostrarComprobanteFinal
 * Propósito: Renderiza el ticket final (Boleta/Factura) para impresión.
 */
function mostrarComprobanteFinal(idComprobante, data, total) {
    const clienteNombre = data.tipo === 'factura' ? data.razon_social : (document.getElementById('pago-nombre')?.value || 'Cliente General');
    const documento = data.tipo === 'factura' ? `RUC: ${data.ruc}` : (data.dni ? `DNI: ${data.dni}` : '');
    
    const fecha = new Date().toLocaleString('es-PE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const bodyHtml = `
        <div style="text-align: center; padding: 20px; border: 2px dashed #ccc; border-radius: 10px; background: white;">
            <div style="margin-bottom: 15px;">
                <h2 style="color: var(--primary); margin: 0;"><i class="fas fa-drumstick-bite"></i> PARDOS CHICKEN</h2>
                <p style="color: #666; margin: 5px 0;">RUC: 20123456789</p>
                <p style="color: #666; margin: 0; font-size: 0.9em;">Jr. Francisco Pizarro 123 - Lima</p>
            </div>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            
            <h3 style="text-transform: uppercase; margin: 15px 0;">${data.tipo === 'boleta' ? '🧾 BOLETA DE VENTA' : '📄 FACTURA'}</h3>
            <p style="color: #666; font-size: 0.9em; margin: 5px 0;">Nº ${String(idComprobante).padStart(8, '0')}</p>
            <p style="color: #666; font-size: 0.9em;">${fecha}</p>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            
            <div style="text-align: left; padding: 10px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">
                <p style="margin: 5px 0;"><strong>Cliente:</strong> ${clienteNombre}</p>
                <p style="margin: 5px 0;"><strong>Doc:</strong> ${documento}</p>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h2 style="margin: 0; font-size: 2em;">TOTAL: S/ ${total.toFixed(2)}</h2>
                <p style="margin: 10px 0 0; opacity: 0.9;">Método: ${data.metodo}</p>
            </div>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="color: var(--success); margin: 0;"><i class="fas fa-check-circle"></i> <strong>PAGADO</strong></p>
            </div>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            <p style="font-size: 0.85em; color: #888; margin: 5px 0;">¡Gracias por su preferencia!</p>
            <p style="font-size: 0.75em; color: #aaa; margin: 10px 0 0;">Representación impresa del comprobante electrónico</p>
        </div>`;
    
    const footer = `<button class="btn btn-secondary" onclick="closeModal()"><i class="fas fa-check"></i> Cerrar</button> 
                    <button class="btn btn-info" onclick="imprimirHTML('${btoa(unescape(encodeURIComponent(bodyHtml)))}')"><i class="fas fa-print"></i> Imprimir</button>`;
    
    openModal('Comprobante de Pago', bodyHtml, footer);
}


/**
 * Función: anularComandaCompletamente
 * Propósito: Elimina una comanda que no se va a pagar.
 */
function anularComandaCompletamente(idComanda) {
    showConfirm(
        '⚠️ ANULAR COMANDA',
        '¿Está SEGURO de anular esta comanda SIN cobrar?\n\nEsta acción es IRREVERSIBLE.',
        async () => {
            try {
                await fetchAPI(`/comandas/${idComanda}`, { 
                    method: 'DELETE'
                });
                showToast('✅ Comanda anulada. Mesa liberada.', 'success');
                setTimeout(() => renderCaja(), 1500);
            } catch (e) {
                showToast('❌ Error al anular comanda', 'error');
            }
        },
        'fa-trash-alt',
        'var(--danger)'
    );
}

// =============================================================================
// IV. CONFIRMACIÓN DE RESERVAS (Lógica Cajera)
// =============================================================================

/**
 * Función: renderConfirmarReservas
 * Propósito: Lista las reservas pendientes de aprobación.
 */
async function renderConfirmarReservas() {
    setPageTitle('Confirmar Reservas', 'fa-clipboard-check');
    const content = document.getElementById('content-area');
    content.innerHTML = showLoader();
    
    try {
        const reservas = await fetchAPI('/reservas?estado=pendiente');
        
        if (reservas.length === 0) {
            content.innerHTML = `
                <div class="card text-center" style="padding: 60px;">
                    <i class="fas fa-check-circle" style="font-size: 4em; color: var(--success);"></i>
                    <h3 style="margin-top: 20px; color: var(--success);">¡Todo confirmado!</h3>
                    <p style="color: #666;">No hay reservas pendientes de confirmación</p>
                </div>`;
            return;
        }
        
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3><i class="fas fa-clock"></i> Reservas Pendientes de Confirmación</h3>
                    <span class="badge badge-pendiente">${reservas.length} pendientes</span>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Fecha/Hora</th>
                                <th>Cliente</th>
                                <th>DNI</th>
                                <th>Teléfono</th>
                                <th>Mesa</th>
                                <th>Personas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reservas.map(r => `
                                <tr>
                                    <td><strong>#${r.id_reserva}</strong></td>
                                    <td>${r.fecha}<br><strong>${r.hora}</strong></td>
                                    <td>${r.cliente}</td>
                                    <td>${r.dni}</td>
                                    <td>${r.telefono || '-'}</td>
                                    <td><span class="badge badge-confirmada">Mesa ${r.mesa}</span></td>
                                    <td>${r.personas}</td>
                                    <td>
                                        <button class="btn btn-success btn-sm" onclick="confirmarReservaCajera(${r.id_reserva})">
                                            <i class="fas fa-check"></i> Confirmar
                                        </button>
                                        <button class="btn btn-danger btn-sm" onclick="rechazarReservaCajera(${r.id_reserva})">
                                            <i class="fas fa-times"></i> Rechazar
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">❌ Error al cargar reservas pendientes</div>';
    }
}

/**
 * Función: confirmarReservaCajera
 * Propósito: Cambia el estado de una reserva a 'confirmada'.
 */
function confirmarReservaCajera(id) {
    showConfirm(
        'Confirmar Reserva', 
        '¿Confirmar esta reserva? El cliente podrá proceder con su visita.',
        async () => {
            try {
                await fetchAPI(`/reservas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'confirmada' }) 
                });
                showToast('✅ Reserva confirmada. El cliente puede proceder.', 'success');
                renderConfirmarReservas();
            } catch (e) {
                showToast('❌ Error al confirmar reserva', 'error');
            }
        }, 
        'fa-check-circle', 
        'var(--success)'
    );
}

/**
 * Función: rechazarReservaCajera
 * Propósito: Cambia el estado de una reserva a 'rechazada'.
 */
function rechazarReservaCajera(id) {
    showConfirm(
        'Rechazar Reserva', 
        '¿Está seguro de rechazar esta reserva? Esta acción notificará al cliente.',
        async () => {
            try {
                await fetchAPI(`/reservas/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ estado: 'rechazada' }) 
                });
                showToast('⚠️ Reserva rechazada correctamente', 'warning');
                renderConfirmarReservas();
            } catch (e) {
                showToast('❌ Error al rechazar reserva', 'error');
            }
        }, 
        'fa-times-circle', 
        'var(--danger)'
    );
}