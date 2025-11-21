// ==================== MÓDULO CAJERA ====================
// HUO12, HUO13, HUO14

// HUO12, HUO13, HUO14: Caja y Pagos
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
                                            <div class="cart-item-price">${c.nombre_cliente || 'Sin nombre'} - ${c.hora}</div>
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
                            <p style="margin-top: 15px;">Seleccione una cuenta para cobrar</p>
                        </div>
                    </div>
                </div>
            </div>`;
    } catch (e) {
        content.innerHTML = '<div class="card text-center" style="color: var(--danger);">Error al cargar caja</div>';
    }
}

async function seleccionarCuenta(idComanda) {
    const panel = document.getElementById('panel-pago');
    panel.innerHTML = `<div class="card-header"><h3><i class="fas fa-receipt"></i> Detalle de Cuenta</h3></div>${showLoader()}`;
    
    try {
        const cuenta = await fetchAPI(`/cuentas/previsualizar/${idComanda}`);
        
        panel.innerHTML = `
            <div class="card-header">
                <h3><i class="fas fa-receipt"></i> Mesa ${cuenta.mesa}</h3>
                <span class="badge badge-completada">Comanda #${cuenta.id_comanda}</span>
            </div>
            
            <div style="padding: 20px;">
                ${cuenta.nombre_cliente ? `<p><i class="fas fa-user"></i> <strong>${cuenta.nombre_cliente}</strong></p>` : ''}
                
                <h4 style="margin: 15px 0 10px;"><i class="fas fa-utensils"></i> Items del Pedido</h4>
                <div id="cuenta-items">
                    ${cuenta.items.map((item, idx) => `
                        <div class="cuenta-item" id="cuenta-item-${idx}">
                            <div>
                                <span>${item.cantidad}x</span> ${item.nombre}
                                ${item.observaciones ? `<small style="color: #888;"> (${item.observaciones})</small>` : ''}
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span>S/ ${item.subtotal.toFixed(2)}</span>
                                <button class="btn btn-danger btn-sm" onclick="quitarItemCuenta(${idComanda}, ${item.id_detalle})" title="Quitar">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="cuenta-total">
                    <span>TOTAL A PAGAR</span>
                    <span id="total-pagar">S/ ${cuenta.total.toFixed(2)}</span>
                </div>
                
                <hr style="margin: 20px 0;">
                
                <h4><i class="fas fa-credit-card"></i> Forma de Pago</h4>
                <div class="form-row" style="margin-top: 15px;">
                    <div class="form-group">
                        <label>Método de Pago</label>
                        <select id="pago-metodo">
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Tarjeta">💳 Tarjeta</option>
                            <option value="Yape">📱 Yape</option>
                            <option value="Plin">📱 Plin</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Tipo Comprobante</label>
                        <select id="pago-tipo" onchange="toggleCamposComprobante()">
                            <option value="boleta">🧾 Boleta</option>
                            <option value="factura">📄 Factura</option>
                        </select>
                    </div>
                </div>
                
                <div id="campos-boleta">
                    <div class="form-group">
                        <label><i class="fas fa-id-card"></i> DNI Cliente</label>
                        <input type="text" id="pago-dni" maxlength="8" placeholder="DNI (opcional)">
                    </div>
                </div>
                
                <div id="campos-factura" class="hidden">
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> RUC *</label>
                        <input type="text" id="pago-ruc" maxlength="11" placeholder="RUC de la empresa">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-building"></i> Razón Social *</label>
                        <input type="text" id="pago-razon" placeholder="Nombre de la empresa">
                    </div>
                </div>
                
                <button class="btn btn-success btn-block mt-3" onclick="procesarPago(${idComanda}, ${cuenta.total})">
                    <i class="fas fa-check-circle"></i> Procesar Pago y Emitir Comprobante
                </button>
            </div>`;
    } catch (e) {
        panel.innerHTML = '<div class="text-center" style="color: var(--danger); padding: 20px;">Error al cargar cuenta</div>';
    }
}

function toggleCamposComprobante() {
    const tipo = document.getElementById('pago-tipo').value;
    document.getElementById('campos-boleta').classList.toggle('hidden', tipo !== 'boleta');
    document.getElementById('campos-factura').classList.toggle('hidden', tipo !== 'factura');
}

// HUO14: Modificar pedido antes de pagar
async function quitarItemCuenta(idComanda, idDetalle) {
    showConfirm('Quitar Item', '¿Está seguro de quitar este item de la cuenta?', async () => {
        try {
            const comanda = await fetchAPI(`/comandas/${idComanda}`);
            const nuevosItems = comanda.items.filter(i => i.id_detalle !== idDetalle);
            
            if (nuevosItems.length === 0) {
                showToast('La comanda debe tener al menos un item', 'error');
                return;
            }
            
            await fetchAPI(`/comandas/${idComanda}`, {
                method: 'PUT',
                body: JSON.stringify({
                    items: nuevosItems.map(i => ({
                        id_menu: i.id_menu,
                        cantidad: i.cantidad,
                        observaciones: i.observaciones
                    }))
                })
            });
            
            showToast('Item eliminado de la cuenta', 'success');
            seleccionarCuenta(idComanda);
        } catch (e) {}
    }, 'fa-times-circle', 'var(--danger)');
}

// HUO12, HUO13: Procesar pago y generar comprobante
async function procesarPago(idComanda, total) {
    const tipo = document.getElementById('pago-tipo').value;
    const metodo = document.getElementById('pago-metodo').value;
    
    const data = {
        id_comanda: idComanda,
        total: total,
        tipo: tipo,
        metodo: metodo
    };
    
    if (tipo === 'boleta') {
        data.dni = document.getElementById('pago-dni').value.trim();
    } else {
        data.ruc = document.getElementById('pago-ruc').value.trim();
        data.razon_social = document.getElementById('pago-razon').value.trim();
        
        if (!data.ruc || data.ruc.length !== 11) {
            return showToast('El RUC debe tener 11 dígitos', 'error');
        }
        if (!data.razon_social) {
            return showToast('La razón social es obligatoria para factura', 'error');
        }
    }
    
    showConfirm('Confirmar Pago', `¿Procesar pago de S/ ${total.toFixed(2)} y generar ${tipo}?`, async () => {
        try {
            const res = await fetchAPI('/pagos', { method: 'POST', body: JSON.stringify(data) });
            showToast(res.message, 'success');
            
            mostrarComprobante(tipo, total, metodo, data, res.id_comprobante);
            
            setTimeout(() => renderCaja(), 2000);
        } catch (e) {}
    }, 'fa-cash-register', 'var(--success)');
}

function mostrarComprobante(tipo, total, metodo, data, idComprobante) {
    const fecha = new Date().toLocaleString('es-PE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const bodyHtml = `
        <div style="text-align: center; padding: 20px; border: 2px dashed #ccc; border-radius: 10px; background: white;">
            <div style="margin-bottom: 15px;">
                <h2 style="color: var(--primary); margin: 0;"><i class="fas fa-drumstick-bite"></i> PARDOS CHICKEN</h2>
                <p style="color: #666; margin: 5px 0;">RUC: 20123456789</p>
                <p style="color: #666; margin: 0; font-size: 0.9em;">Jr. Francisco Pizarro 123 - Lima</p>
            </div>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            
            <h3 style="text-transform: uppercase; margin: 15px 0;">${tipo === 'boleta' ? '🧾 BOLETA DE VENTA' : '📄 FACTURA'}</h3>
            <p style="color: #666; font-size: 0.9em; margin: 5px 0;">N° ${String(idComprobante).padStart(8, '0')}</p>
            <p style="color: #666; font-size: 0.9em;">${fecha}</p>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            
            ${tipo === 'factura' ? `
                <div style="text-align: left; padding: 10px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>RUC:</strong> ${data.ruc}</p>
                    <p style="margin: 5px 0;"><strong>Razón Social:</strong> ${data.razon_social}</p>
                </div>
            ` : data.dni ? `
                <div style="text-align: left; padding: 10px; background: #f8f9fa; border-radius: 5px; margin: 10px 0;">
                    <p style="margin: 5px 0;"><strong>DNI:</strong> ${data.dni}</p>
                </div>
            ` : ''}
            
            <div style="background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; padding: 20px; border-radius: 8px; margin: 15px 0;">
                <h2 style="margin: 0; font-size: 2em;">TOTAL: S/ ${total.toFixed(2)}</h2>
                <p style="margin: 10px 0 0; opacity: 0.9;">Método: ${metodo}</p>
            </div>
            
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p style="color: var(--success); margin: 0;"><i class="fas fa-check-circle"></i> <strong>PAGADO</strong></p>
            </div>
            
            <hr style="margin: 15px 0; border-style: dashed;">
            <p style="font-size: 0.85em; color: #888; margin: 5px 0;">¡Gracias por su preferencia!</p>
            <p style="font-size: 0.85em; color: #888; margin: 5px 0;">www.pardoschicken.pe</p>
            <p style="font-size: 0.75em; color: #aaa; margin: 10px 0 0;">Representación impresa del comprobante electrónico</p>
        </div>`;
    
    const footerHtml = `
        <button class="btn btn-secondary" onclick="imprimirComprobante()"><i class="fas fa-print"></i> Imprimir</button>
        <button class="btn btn-primary" onclick="closeModal()"><i class="fas fa-check"></i> Cerrar</button>`;
    
    openModal('Comprobante Generado', bodyHtml, footerHtml);
}

function imprimirComprobante() {
    const contenido = document.getElementById('modal-body').innerHTML;
    const ventana = window.open('', '', 'height=600,width=800');
    ventana.document.write('<html><head><title>Comprobante</title>');
    ventana.document.write('<style>body{font-family:Arial,sans-serif;padding:20px;}</style>');
    ventana.document.write('</head><body>');
    ventana.document.write(contenido);
    ventana.document.write('</body></html>');
    ventana.document.close();
    ventana.print();
}